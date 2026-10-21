jest.mock('../src/config/db', () => {
    const { Sequelize } = require('sequelize');
    return { sequelize: new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false }) };
});
jest.mock('../src/services/photo/dithering', () => ({ prepareImage: jest.fn() }));

const fs = require('fs');
const os = require('os');
const path = require('path');
const { randomUUID } = require('crypto');
const previousDirectory = process.env.PHOTO_STORAGE_PATH;
const previousKey = process.env.PHOTO_ENC_KEY;
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'picie-controller-'));
process.env.PHOTO_STORAGE_PATH = directory;
process.env.PHOTO_ENC_KEY = Buffer.alloc(32, 9).toString('base64');
const { sequelize } = require('../src/config/db');
const User = require('../src/models/user');
const { Album, Photo } = require('../src/models/photo');
const PhotoOperation = require('../src/models/photoOperation');
const { prepareImage } = require('../src/services/photo/dithering');
const { photoPath, recoverPhotoOperations } = require('../src/services/photo/storage');
const controller = require('../src/controller/photoController');
const image = Buffer.from('synthetic preview');
let owner, other, album;

function response() {
    return {
        statusCode: 200, headers: {},
        status(code) { this.statusCode = code; return this; },
        set(name, value) { this.headers[name] = value; return this; },
        send(body) { this.body = body; return this; },
        json(body) { this.body = body; return this; },
    };
}
async function call(method, body = {}, user = owner, params = {}) {
    const res = response();
    await controller[method]({ user: { id: user.id }, body, params,
        protocol: 'http', get: () => 'localhost' }, res);
    return res;
}
const upload = () => call('savePhoto', { albumId: album.id, data: image.toString('base64') });
const read = (id, user = owner) => call('getPhoto', {}, user, { id });

beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await sequelize.sync({ force: true });
    fs.mkdirSync(directory, { recursive: true });
    [owner, other] = await Promise.all(['owner', 'other'].map(username => User.create({
        username, email: `${username}@example.test`, firstName: username, password: 'synthetic-password',
    })));
    album = await Album.create({ owner: owner.id, name: 'Original album' });
    prepareImage.mockReset().mockResolvedValue({ image, pixels: Buffer.from('synthetic pixels') });
});
afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(directory, { recursive: true, force: true });
});
afterAll(async () => {
    await sequelize.close();
    for (const [name, value] of [['PHOTO_STORAGE_PATH', previousDirectory], ['PHOTO_ENC_KEY', previousKey]]) {
        if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
});

test.each([undefined, '', 'not base64!'])('invalid image input %p does no conversion or storage work', async data => {
    const result = await call('savePhoto', { albumId: album.id, data });
    expect(result.statusCode).toBe(400);
    expect(prepareImage).not.toHaveBeenCalled();
    expect(await Photo.count()).toBe(0);
    expect(await PhotoOperation.count()).toBe(0);
    expect(fs.readdirSync(directory)).toEqual([]);
});

test.each([400, 503, undefined])('processing failure with status %p leaves no upload behind', async status => {
    prepareImage.mockRejectedValue(Object.assign(new Error('Processing failed'), { status }));
    const result = await upload();
    expect(result.statusCode).toBe(status || 500);
    expect(result.body).toBe(status ? 'Processing failed' : 'Error processing image');
    expect(await Photo.count()).toBe(0);
    expect(await PhotoOperation.count()).toBe(0);
    expect(fs.readdirSync(directory)).toEqual([]);
});

test.each(['write', 'database'])('upload %s failure returns a safe error and cleans partial assets', async failure => {
    if (failure === 'write') {
        const write = fs.writeFileSync.bind(fs);
        let writes = 0;
        jest.spyOn(fs, 'writeFileSync').mockImplementation((...args) => {
            if (++writes === 2) throw new Error('Private disk details');
            return write(...args);
        });
    } else {
        jest.spyOn(Photo, 'create').mockRejectedValue(new Error('Private database details'));
    }
    const result = await upload();
    expect(result.statusCode).toBe(500);
    expect(result.body).toBe('Error processing image');
    expect(await Photo.count()).toBe(0);
    expect(await PhotoOperation.count()).toBe(0);
    expect(fs.readdirSync(directory)).toEqual([]);
    expect(await Album.findByPk(album.id)).not.toBeNull();
});

test('owner can read the decrypted preview, but another user cannot', async () => {
    const uploaded = await upload();
    expect(uploaded.statusCode).toBe(200);
    const result = await read(uploaded.body.id);
    expect(result.statusCode).toBe(200);
    expect(result.headers['Content-Type']).toBe('image/png');
    expect(result.body).toEqual(image);
    expect(fs.readFileSync(photoPath(uploaded.body.id, 'png'))).not.toEqual(image);
    const foreign = await read(uploaded.body.id, other);
    const missing = await read(randomUUID());
    expect(foreign.statusCode).toBe(404);
    expect(foreign).toMatchObject({ statusCode: missing.statusCode, body: missing.body });
});

test.each(['missing', 'truncated', 'tampered'])('%s stored preview never returns image data', async failure => {
    const uploaded = await upload();
    const file = photoPath(uploaded.body.id, 'png');
    if (failure === 'missing') fs.unlinkSync(file);
    else if (failure === 'truncated') fs.writeFileSync(file, Buffer.alloc(10));
    else {
        const bytes = fs.readFileSync(file);
        bytes[bytes.length - 1] ^= 1;
        fs.writeFileSync(file, bytes);
    }
    const result = await read(uploaded.body.id);
    expect(result.statusCode).toBe(403);
    expect(result.body).toBe('Forbidden');
    expect(result.headers['Content-Type']).toBeUndefined();
});

test('album creation assigns the authenticated owner', async () => {
    const result = await call('createAlbum', { owner: other.id });
    expect(result.statusCode).toBe(200);
    const created = await Album.findByPk(result.body.id);
    expect(created.owner).toBe(owner.id);
    expect(created.name).toBe(result.body.name);
    expect(result.body.photos).toEqual([]);
});

test('renaming an album is restricted to its owner', async () => {
    const foreign = await call('savePhotoCollage', { id: album.id, name: 'Denied' }, other);
    const missing = await call('savePhotoCollage', { id: randomUUID(), name: 'Missing' });
    expect(foreign.statusCode).toBe(404);
    expect(foreign.body).toBe(missing.body);
    expect((await album.reload()).name).toBe('Original album');
    expect((await call('savePhotoCollage', { id: album.id, name: 'Updated' })).statusCode).toBe(200);
    expect((await album.reload()).name).toBe('Updated');
});

test('album listing includes owned photos and excludes another user’s album', async () => {
    const uploaded = await upload();
    await Album.create({ owner: other.id, name: 'Private' });
    const result = await call('getAlbums');
    expect(result.statusCode).toBe(200);
    expect(result.body).toHaveLength(1);
    expect(result.body[0]).toMatchObject({ id: album.id, photos: [
        { id: uploaded.body.id, url: `/api/photo/get/${uploaded.body.id}.png` },
    ] });
});

test.each([{}, { ids: [] }, { ids: 'invalid' }])('rejects empty deletion input %p', async body => {
    const uploaded = await upload();
    expect((await call('deletePhotos', body)).statusCode).toBe(400);
    expect(await Photo.findByPk(uploaded.body.id)).not.toBeNull();
    expect(fs.readdirSync(directory)).toHaveLength(2);
});

test('deleting photos removes only owned records and files', async () => {
    const uploaded = await upload();
    const denied = await call('deletePhotos', { ids: [uploaded.body.id] }, other);
    expect(denied.body).toEqual({ deleted: [] });
    expect(fs.readdirSync(directory)).toHaveLength(2);
    const result = await call('deletePhotos', { ids: [uploaded.body.id, randomUUID()] });
    expect(result.body).toEqual({ deleted: [uploaded.body.id] });
    expect(await Photo.count()).toBe(0);
    expect(await Album.findByPk(album.id)).not.toBeNull();
    expect(fs.readdirSync(directory)).toEqual([]);
});

test('album deletion validates input and ownership before removing records or files', async () => {
    await upload();
    expect((await call('deleteAlbum')).statusCode).toBe(400);
    expect((await call('deleteAlbum', { id: randomUUID() })).statusCode).toBe(404);
    expect((await call('deleteAlbum', { id: album.id }, other)).statusCode).toBe(404);
    expect(await Album.findByPk(album.id)).not.toBeNull();
    expect(await Photo.count()).toBe(1);
    expect(fs.readdirSync(directory)).toHaveLength(2);
});

test('successful album deletion removes the album, photos, and assets', async () => {
    const uploaded = await upload();
    const result = await call('deleteAlbum', { id: album.id });
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ deleted: album.id, photosDeleted: [uploaded.body.id] });
    expect(await Album.findByPk(album.id)).toBeNull();
    expect(await Photo.count()).toBe(0);
    expect(await PhotoOperation.count()).toBe(0);
    expect(fs.readdirSync(directory)).toEqual([]);
});

test('album cleanup failure reports pending work and can recover', async () => {
    await upload();
    const unlink = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => { throw new Error('Disk unavailable'); });
    const result = await call('deleteAlbum', { id: album.id });
    expect(result.statusCode).toBe(503);
    expect(result.body.message).toMatch(/cleanup is pending/);
    expect(await Album.findByPk(album.id)).toBeNull();
    expect(await Photo.count()).toBe(0);
    expect(await PhotoOperation.count()).toBe(1);
    unlink.mockRestore();
    await recoverPhotoOperations();
    expect(await PhotoOperation.count()).toBe(0);
    expect(fs.readdirSync(directory)).toEqual([]);
});

test.each(['deleteAlbum', 'deletePhotos'])('%s database failure preserves data and hides internal errors', async method => {
    const uploaded = await upload();
    jest.spyOn(Photo, 'destroy').mockRejectedValue(new Error('Private database details'));
    const result = await call(method, { id: album.id, ids: [uploaded.body.id] });
    expect(result.statusCode).toBe(500);
    expect(result.body.message).toMatch(/^Error deleting/);
    expect(result.body.message).not.toContain('Private');
    expect(await Photo.count()).toBe(1);
    expect(await Album.findByPk(album.id)).not.toBeNull();
    expect(fs.readdirSync(directory)).toHaveLength(2);
});

test.each([
    ['createAlbum', 'create'],
    ['savePhotoCollage', 'findOne'],
    ['getAlbums', 'findAll'],
])('%s hides database failures without changing existing albums', async (method, query) => {
    const failure = jest.spyOn(Album, query).mockRejectedValue(new Error('Private database details'));
    const result = await call(method, { id: album.id, name: 'Changed' });
    expect(result.statusCode).toBe(500);
    expect(result.body).not.toContain('Private');
    failure.mockRestore();
    expect(await Album.count()).toBe(1);
    expect((await album.reload()).name).toBe('Original album');
});
