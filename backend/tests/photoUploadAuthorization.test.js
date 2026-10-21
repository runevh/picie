/**
 * Upload ownership checks using real models, controller, and encryption.
 * SQLite and redirected temporary files isolate persistence. Image conversion
 * is stubbed; authentication is supplied at the controller boundary.
 */
jest.mock('../src/config/db', () => {
  const { Sequelize } = require('sequelize');
  return { sequelize: new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false }) };
});
jest.mock('../src/services/photo/dithering', () => ({ dither: jest.fn() }));

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createDecipheriv } = require('crypto');
const { sequelize } = require('../src/config/db');
const User = require('../src/models/user');
const { Album, Photo } = require('../src/models/photo');
const { dither } = require('../src/services/photo/dithering');

const previousKey = process.env.PHOTO_ENC_KEY;
const key = Buffer.alloc(32, 9);
process.env.PHOTO_ENC_KEY = key.toString('base64');
const { savePhoto } = require('../src/controller/photoController');
const image = Buffer.from('synthetic image input');
const pixels = Buffer.from('synthetic converted frame');
let users, albums, directory, writeFile;

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
  };
}

async function upload(user, album, extra = {}) {
  const res = response();
  await savePhoto({ user: { id: user.id }, body: {
    albumId: album.id, data: image.toString('base64'), ...extra,
  } }, res);
  return res;
}

function decrypt(filename) {
  const data = fs.readFileSync(path.join(directory, filename));
  const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]);
}

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

beforeEach(async () => {
  await sequelize.sync({ force: true });
  users = [];
  albums = [];
  for (const name of ['alice', 'bob']) {
    const user = await User.create({ username: name, email: `${name}@example.test`,
      password: 'synthetic-password', firstName: name });
    users.push(user);
    albums.push(await Album.create({ name: `${name}'s album`, owner: user.id }));
  }
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'picie-upload-test-'));
  const originalWrite = fs.writeFileSync.bind(fs);
  const photoDirectory = path.resolve(__dirname, '../photos');
  writeFile = jest.spyOn(fs, 'writeFileSync').mockImplementation((filename, data) => {
    if (path.dirname(filename) !== photoDirectory) throw new Error('Unexpected file destination');
    originalWrite(path.join(directory, path.basename(filename)), data);
  });
  dither.mockReset().mockResolvedValue(pixels);
});

afterEach(() => {
  writeFile.mockRestore();
  fs.rmSync(directory, { recursive: true, force: true });
});

afterAll(async () => {
  await sequelize.close();
  jest.restoreAllMocks();
  if (previousKey === undefined) delete process.env.PHOTO_ENC_KEY;
  else process.env.PHOTO_ENC_KEY = previousKey;
});

describe('photo upload authorization', () => {
  test.each([undefined, null, '', 'invalid', { id: 'invalid' }])('rejects invalid album id %p before any work', async albumId => {
    const res = await upload(users[0], { id: albumId });
    expect(res.statusCode).toBe(400);
    expect(await Photo.count()).toBe(0);
    expect(writeFile).not.toHaveBeenCalled();
    expect(dither).not.toHaveBeenCalled();
  });

  test('returns the same response for missing and inaccessible albums', async () => {
    const missing = await upload(users[0], { id: '00000000-0000-4000-8000-000000000000' });
    const foreign = await upload(users[0], albums[1]);
    expect(missing.statusCode).toBe(404);
    expect(foreign.statusCode).toBe(missing.statusCode);
    expect(foreign.body).toEqual(missing.body);
    expect(await Photo.count()).toBe(0);
    expect(writeFile).not.toHaveBeenCalled();
    expect(dither).not.toHaveBeenCalled();
  });

  test.each([0, 1])('rejects user %i uploading to another account’s album', async index => {
    const res = await upload(users[index], albums[1 - index]);
    expect([403, 404]).toContain(res.statusCode);
  });

  test('rejects unauthorized uploads without records, files, conversion, or album changes', async () => {
    const before = (await Album.findAll({ order: [['id', 'ASC']] })).map(album => album.toJSON());
    await upload(users[0], albums[1]);
    expect(await Photo.count()).toBe(0);
    expect(writeFile).not.toHaveBeenCalled();
    expect(fs.readdirSync(directory)).toEqual([]);
    expect(dither).not.toHaveBeenCalled();
    expect((await Album.findAll({ order: [['id', 'ASC']] })).map(album => album.toJSON())).toEqual(before);
  });

  test('checks album access before reading image data', async () => {
    const readData = jest.fn(() => image.toString('base64'));
    const body = { albumId: albums[1].id };
    Object.defineProperty(body, 'data', { get: readData });
    await savePhoto({ user: { id: users[0].id }, body }, response());
    expect(readData).not.toHaveBeenCalled();
    expect(await Photo.count()).toBe(0);
  });

  test.each([0, 1])('allows user %i to upload to their own album with matching ownership', async index => {
    const user = users[index];
    const album = albums[index];
    // Client-supplied ownership must never override the signed-in user.
    const res = await upload(user, album, { owner: users[1 - index].id });
    expect(res.statusCode).toBe(200);
    expect(await Photo.count()).toBe(1);
    const photo = await Photo.findByPk(res.body.id);
    expect(photo.owner).toBe(user.id);
    expect(photo.albumId).toBe(album.id);
    expect(fs.readdirSync(directory).sort()).toEqual([`${photo.id}.data`, `${photo.id}.png`]);
    expect(decrypt(`${photo.id}.png`)).toEqual(image);
    expect(decrypt(`${photo.id}.data`)).toEqual(pixels);
    expect(dither).toHaveBeenCalledWith(image);
  });
});
