jest.mock('../src/services/photo/dithering', () => ({ prepareImage: jest.fn() }));
const fs = require('fs');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'picie-storage-'));
process.env.PHOTO_STORAGE_PATH = directory;
process.env.PHOTO_ENC_KEY = Buffer.alloc(32, 7).toString('base64');
const { sequelize } = require('../src/config/db');
const User = require('../src/models/user');
const Device = require('../src/models/device');
const { DeviceState } = require('../src/models/deviceState');
const { Album, Photo } = require('../src/models/photo');
const PhotoOperation = require('../src/models/photoOperation');
const { publishPhoto, removePhotos, recoverPhotoOperations, photoPath } = require('../src/services/photo/storage');
const { deletePhotos } = require('../src/controller/photoController');
let owner, other, album;
const upload = () => publishPhoto(owner.id, album.id, Buffer.from('encrypted png'), Buffer.from('encrypted pixels'));
beforeEach(async () => {
    await sequelize.sync({ force: true });
    fs.mkdirSync(directory, { recursive: true });
    [owner, other] = await Promise.all(['owner', 'other'].map(username => User.create({ username, email: `${username}@example.test`, firstName: username, password: 'synthetic-password' })));
    album = await Album.create({ owner: owner.id, name: 'Photos' });
});
afterEach(() => { jest.restoreAllMocks(); fs.rmSync(directory, { force: true, recursive: true }); });
afterAll(() => sequelize.close());

test('publishes only after both assets exist and removes the journal', async () => {
    const create = Photo.create.bind(Photo);
    jest.spyOn(Photo, 'create').mockImplementation(async (values, options) => {
        for (const extension of ['png', 'data']) expect(fs.existsSync(photoPath(values.id, extension))).toBe(true);
        expect(await Photo.count({ transaction: options.transaction })).toBe(0);
        return create(values, options);
    });
    const photo = await upload();
    expect(await Photo.count()).toBe(1);
    expect(await PhotoOperation.count()).toBe(0);
    expect(fs.readdirSync(directory).sort()).toEqual([`${photo.id}.data`, `${photo.id}.png`]);
});

test.each(['write', 'rename', 'database'])('%s failure leaves no visible record or files', async failure => {
    const object = failure === 'database' ? Photo : fs;
    const method = { write: 'writeFileSync', rename: 'renameSync', database: 'create' }[failure];
    const original = object[method].bind(object);
    let calls = 0;
    jest.spyOn(object, method).mockImplementation((...args) => {
        if (++calls === (failure === 'database' ? 1 : 2)) throw Error('injected failure');
        return original(...args);
    });
    await expect(upload()).rejects.toThrow('injected failure');
    expect(await Photo.count()).toBe(0);
    expect(await PhotoOperation.count()).toBe(0);
    expect(fs.readdirSync(directory)).toEqual([]);
});

test('failed cleanup keeps its journal and can recover after restart', async () => {
    jest.spyOn(Photo, 'create').mockRejectedValue(Error('database failed'));
    const unlink = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => { throw Object.assign(Error('disk unavailable'), { code: 'EACCES' }); });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(upload()).rejects.toThrow('database failed');
    expect(await Photo.count()).toBe(0);
    expect(await PhotoOperation.count()).toBe(1);
    unlink.mockRestore();
    await recoverPhotoOperations();
    expect(await PhotoOperation.count()).toBe(0);
    expect(fs.readdirSync(directory)).toEqual([]);
});

test('recovers interrupted uploads and preserves a published photo', async () => {
    const id = randomUUID();
    await PhotoOperation.create({ owner: owner.id, kind: 'upload', photoIds: [id] });
    fs.writeFileSync(photoPath(id, 'png'), 'partial');
    fs.writeFileSync(photoPath(id, 'data.pending'), 'partial');
    const photo = await upload();
    await PhotoOperation.create({ owner: owner.id, kind: 'upload', photoIds: [photo.id] });
    await recoverPhotoOperations();
    expect(await Photo.count()).toBe(1);
    expect(fs.readdirSync(directory).sort()).toEqual([`${photo.id}.data`, `${photo.id}.png`]);
    await recoverPhotoOperations();
});

test('deletion failures return pending cleanup rather than success and retain retry data', async () => {
    const photo = await upload();
    const unlink = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => { throw Object.assign(Error('denied'), { code: 'EACCES' }); });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await deletePhotos({ user: { id: owner.id }, body: { ids: [photo.id] } }, res);
    expect(res.statusCode).toBe(503);
    expect(res.body.message).toMatch(/cleanup is pending/);
    expect(await Photo.count()).toBe(0);
    expect(await PhotoOperation.count()).toBe(1);
    unlink.mockRestore();
    await removePhotos(owner.id, [photo.id]);
    expect(await PhotoOperation.count()).toBe(0);
    expect(fs.readdirSync(directory)).toEqual([]);
});

test('database deletion failure preserves records and assets', async () => {
    const photo = await upload();
    jest.spyOn(Photo, 'destroy').mockRejectedValue(Error('database failed'));
    await expect(removePhotos(owner.id, [photo.id])).rejects.toThrow('database failed');
    expect(await Photo.count()).toBe(1);
    expect(await PhotoOperation.count()).toBe(0);
    expect(fs.readdirSync(directory)).toHaveLength(2);
});

test('deletes owned photos and clears affected device selections', async () => {
    const photo = await upload();
    const device = await Device.create({ secret: 'synthetic-device-secret' });
    const state = await DeviceState.create({ deviceId: device.uuid, albumId: album.id, currentPhotoId: photo.id, nextPhotoId: photo.id });
    expect(await removePhotos(other.id, [photo.id])).toEqual([]);
    expect(await Photo.count()).toBe(1);
    await removePhotos(owner.id, [], album.id);
    expect(await Album.count()).toBe(0);
    expect(await Photo.count()).toBe(0);
    expect(fs.readdirSync(directory)).toEqual([]);
    await state.reload();
    expect(state.albumId).toBeNull();
    expect(state.currentPhotoId).toBeNull();
    expect(state.nextPhotoId).toBeNull();
});


test('encryption failure happens before any durable upload work', async () => {
    const { prepareImage } = require('../src/services/photo/dithering');
    prepareImage.mockResolvedValue({ image: undefined, pixels: Buffer.from('pixels') });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, send(body) { this.body = body; return this; } };
    await require('../src/controller/photoController').savePhoto({ user: { id: owner.id }, body: { albumId: album.id, data: Buffer.from('image').toString('base64') } }, res);
    expect(res.statusCode).toBe(500);
    expect(await Photo.count()).toBe(0);
    expect(await PhotoOperation.count()).toBe(0);
    expect(fs.readdirSync(directory)).toEqual([]);
});

test('a journal database failure never writes assets', async () => {
    jest.spyOn(PhotoOperation, 'create').mockRejectedValue(Error('journal unavailable'));
    await expect(upload()).rejects.toThrow('journal unavailable');
    expect(await Photo.count()).toBe(0);
    expect(fs.readdirSync(directory)).toEqual([]);
});

test('album cleanup survives partial deletion and retries after a restart', async () => {
    const photo = await upload();
    const unlink = fs.unlinkSync.bind(fs);
    jest.spyOn(fs, 'unlinkSync').mockImplementation(filename => {
        if (filename === photoPath(photo.id, 'data')) throw Object.assign(Error('denied'), { code: 'EACCES' });
        return unlink(filename);
    });
    await expect(removePhotos(owner.id, [], album.id)).rejects.toMatchObject({ status: 503 });
    expect(await Album.count()).toBe(0);
    expect(await Photo.count()).toBe(0);
    expect(await PhotoOperation.count()).toBe(1);
    expect(fs.readdirSync(directory)).toEqual([`${photo.id}.data`]);
    jest.restoreAllMocks();
    await recoverPhotoOperations();
    expect(await PhotoOperation.count()).toBe(0);
    expect(fs.readdirSync(directory)).toEqual([]);
});
