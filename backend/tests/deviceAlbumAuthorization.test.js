/**
 * Account isolation from album assignment through queued delivery.
 * Run: npm test -- --runInBand --runTestsByPath tests/deviceAlbumAuthorization.test.js
 *
 * Real Sequelize models (disposable SQLite), controller, scheduler, decryption,
 * and image sender. Only startup, photo-file reads, and device transport are
 * isolated. Authentication is supplied as req.user at the controller boundary;
 * this suite does not test HTTP middleware or physical display acknowledgement.
 */
jest.mock('../src/config/db', () => {
  const { Sequelize } = require('sequelize');
  return { sequelize: new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false }) };
});
jest.mock('../src/services/tcpServer', () => ({
  getConnectedDevices: jest.fn(() => new Map()),
}));

const { createCipheriv } = require('crypto');
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../src/config/db');

const User = require('../src/models/user');
const Device = require('../src/models/device');
const { Album, Photo } = require('../src/models/photo');
const { UserDeviceRole } = require('../src/models/userDeviceRole');
const { DeviceState } = require('../src/models/deviceState');

const previousKey = process.env.PHOTO_ENC_KEY;
const testKey = Buffer.alloc(32, 7);
process.env.PHOTO_ENC_KEY = testKey.toString('base64');
const { updateDeviceSettings, getUserDevices } = require('../src/controller/deviceController');
const { ensureNextPlannedPhoto } = require('../src/schedules/updateScheduler');
const { pushNextPhotoToDevice } = require('../src/services/device/imageUpdateManager');

let alice, bob, frame, aliceAlbum, bobAlbum, alicePhoto, bobPhoto, state;
let fileRead;
const aliceBytes = Buffer.from('synthetic Alice frame pixels');
const bobBytes = Buffer.from('synthetic Bob PRIVATE frame pixels');

function encrypted(bytes) {
  const iv = Buffer.alloc(12, 3); // Deterministic synthetic fixture, never real data.
  const cipher = createCipheriv('aes-256-gcm', testKey, iv);
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = JSON.parse(JSON.stringify(body)); return this; },
  };
}

async function assign(albumId, extra = {}) {
  const res = response();
  await updateDeviceSettings({ user: { id: alice.id }, body: {
    id: frame.publicId, albumId, ...extra,
  } }, res);
  return res;
}

function simulatedFrame() {
  const sent = [];
  return {
    status: 'idle', sent,
    send: jest.fn(bytes => sent.push(Buffer.from(bytes))),
    waitForResponse: jest.fn(async opcode => {
      if (opcode !== 0x21) throw new Error(`Unexpected opcode ${opcode}`);
      const size = Buffer.alloc(4);
      size.writeUInt32LE(8); // Exercise multiple real image chunks.
      return size;
    }),
  };
}

// Rejection or a safe no-op are both valid service-level denial policies.
// Exact byte checks and positive controls below prevent swallowed failures
// from making a broken delivery harness look like successful authorization.
async function attemptDelivery(client) {
  try { await pushNextPhotoToDevice(frame.uuid, client); } catch (_) { /* denied */ }
}

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

beforeEach(async () => {
  await sequelize.sync({ force: true });
  const user = name => ({ username: name, email: `${name}@example.test`,
    password: 'synthetic-password', firstName: name, admin: false });
  alice = await User.create(user('alice'));
  bob = await User.create(user('bob'));
  frame = await Device.create({ publicId: '123456', secret: 'synthetic-device-secret', name: 'Alice frame' });
  await UserDeviceRole.create({ userId: alice.id, deviceId: frame.uuid, role: 'OWNER' });
  aliceAlbum = await Album.create({ name: 'Alice album', owner: alice.id });
  bobAlbum = await Album.create({ name: 'Bob private album', owner: bob.id });
  alicePhoto = await Photo.create({ owner: alice.id, albumId: aliceAlbum.id });
  bobPhoto = await Photo.create({ owner: bob.id, albumId: bobAlbum.id });
  state = await DeviceState.create({ deviceId: frame.uuid, albumId: aliceAlbum.id,
    nextPhotoId: alicePhoto.id, nextUpdateAt: new Date('2030-01-01T00:00:00Z') });
  const files = new Map([
    [`${alicePhoto.id}.data`, encrypted(aliceBytes)],
    [`${bobPhoto.id}.data`, encrypted(bobBytes)],
  ]);
  fileRead = jest.spyOn(fs, 'readFile').mockImplementation((filename, callback) => {
    const data = files.get(path.basename(filename));
    if (!data) return callback(new Error(`Unexpected fixture read: ${path.basename(filename)}`));
    callback(null, data);
  });
});

afterEach(() => fileRead.mockRestore());
afterAll(async () => {
  await sequelize.close();
  jest.restoreAllMocks();
  if (previousKey === undefined) delete process.env.PHOTO_ENC_KEY;
  else process.env.PHOTO_ENC_KEY = previousKey;
});

describe('device album authorization', () => {
  test('rejects another account’s album without leaking metadata or mutating settings', async () => {
    await state.reload();
    const before = state.toJSON();
    const res = await assign(bobAlbum.id, { name: 'Unauthorized change',
      schedule: { mode: 'interval', intervalMinutes: 1 } });
    await state.reload();
    await frame.reload();
    expect([403, 404]).toContain(res.statusCode);
    expect(state.toJSON()).toEqual(before);
    expect(frame.name).toBe('Alice frame');
    expect(JSON.stringify(res.body)).not.toContain(bobAlbum.name);
    expect(JSON.stringify(res.body)).not.toContain(bobPhoto.id);
    expect(fileRead).not.toHaveBeenCalled();
  });

  test('accepts the owner’s album and delivers exactly the owner’s decrypted photo bytes', async () => {
    const res = await assign(aliceAlbum.id);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.album.id).toBe(aliceAlbum.id);
    const client = simulatedFrame();
    await pushNextPhotoToDevice(frame.uuid, client);
    expect(client.sent[0]).toEqual(Buffer.from([0x20]));
    expect(Buffer.concat(client.sent.slice(1))).toEqual(aliceBytes);
  });

  test('an unauthorized assignment cannot cause private photo bytes to be delivered', async () => {
    await assign(bobAlbum.id);
    const client = simulatedFrame();
    await attemptDelivery(client);
    const delivered = Buffer.concat(client.sent.slice(1));
    expect(delivered.includes(bobBytes)).toBe(false);
    expect(fileRead.mock.calls.some(([filename]) => path.basename(filename) === `${bobPhoto.id}.data`)).toBe(false);
  });

  test('does not expose a foreign album’s metadata through a previously stored device association', async () => {
    await state.update({ albumId: bobAlbum.id, nextPhotoId: bobPhoto.id });
    const res = response();
    await getUserDevices({ user: { id: alice.id }, protocol: 'https', get: () => 'example.test' }, res);
    expect(res.statusCode).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(bobAlbum.name);
    expect(JSON.stringify(res.body)).not.toContain(bobPhoto.id);
  });

  test('plans a photo from an authorized album', async () => {
    await state.update({ nextPhotoId: null });
    await ensureNextPlannedPhoto(frame.uuid);
    await state.reload();
    expect(state.nextPhotoId).toBe(alicePhoto.id);
  });

  test('delivers authorized queued work when access remains unchanged', async () => {
    const client = simulatedFrame();
    client.enqueueTask = async task => task();
    await pushNextPhotoToDevice(frame.uuid, client);
    expect(Buffer.concat(client.sent.slice(1))).toEqual(aliceBytes);
  });

  test('does not plan photos from an unauthorized persisted album', async () => {
    await state.update({ albumId: bobAlbum.id, nextPhotoId: null });
    try { await ensureNextPlannedPhoto(frame.uuid); } catch (_) { /* denied */ }
    await state.reload();
    expect(state.nextPhotoId).toBeNull();
  });

  test('does not deliver a foreign photo already present in persisted planned state', async () => {
    await state.update({ albumId: bobAlbum.id, nextPhotoId: bobPhoto.id });
    const client = simulatedFrame();
    await attemptDelivery(client);
    expect(client.send).not.toHaveBeenCalled();
    expect(fileRead).not.toHaveBeenCalled();
  });

  test('rejects settings changes through a read-only device link', async () => {
    await UserDeviceRole.update({ role: 'READ' }, { where: { deviceId: frame.uuid } });
    const res = await assign(null, { name: 'Changed name' });
    expect(res.statusCode).toBe(403);
    await frame.reload();
    expect(frame.name).toBe('Alice frame');
  });

  test('clearing the album removes the planned photo and prevents delivery', async () => {
    const res = await assign(null);
    expect(res.statusCode).toBe(200);
    await state.reload();
    expect(state.albumId).toBeNull();
    expect(state.nextPhotoId).toBeNull();
    const client = simulatedFrame();
    await pushNextPhotoToDevice(frame.uuid, client);
    expect(client.send).not.toHaveBeenCalled();
  });

  test('rejects a planned photo belonging to another album', async () => {
    await state.update({ nextPhotoId: bobPhoto.id });
    const client = simulatedFrame();
    await attemptDelivery(client);
    expect(client.send).not.toHaveBeenCalled();
    expect(fileRead).not.toHaveBeenCalled();
  });

  test('excludes photos whose owner does not match the album owner', async () => {
    await alicePhoto.update({ owner: bob.id });
    await ensureNextPlannedPhoto(frame.uuid);
    await state.reload();
    expect(state.nextPhotoId).toBeNull();
    await state.update({ nextPhotoId: alicePhoto.id });
    const client = simulatedFrame();
    await attemptDelivery(client);
    expect(client.send).not.toHaveBeenCalled();
  });

  test('rechecks access after waiting for the frame to become idle', async () => {
    const client = simulatedFrame();
    client.enqueueTask = async task => task();
    client.status = 'busy';
    client.waitUntilIdle = async () => {
      await UserDeviceRole.destroy({ where: { deviceId: frame.uuid } });
      client.status = 'idle';
    };
    await attemptDelivery(client);
    expect(client.send).not.toHaveBeenCalled();
    expect(fileRead).not.toHaveBeenCalled();
  });

  test('does not send photo bytes if access is revoked while awaiting the first chunk request', async () => {
    const client = simulatedFrame();
    client.waitForResponse.mockImplementation(async () => {
      await UserDeviceRole.destroy({ where: { deviceId: frame.uuid } });
      const size = Buffer.alloc(4);
      size.writeUInt32LE(8);
      return size;
    });
    await attemptDelivery(client);
    expect(client.sent).toEqual([Buffer.from([0x20])]);
    await state.reload();
    expect(state.currentPhotoId).toBeNull();
  });

  test.each(['unlink', 'device reassignment', 'album ownership revocation', 'album cleared', 'photo removed'])(
    'stops sending further photo chunks after %s during transfer', async change => {
      const client = simulatedFrame();
      let requests = 0;
      client.waitForResponse.mockImplementation(async () => {
        requests += 1;
        if (requests === 2) {
          if (change === 'unlink') await UserDeviceRole.destroy({ where: { deviceId: frame.uuid } });
          if (change === 'device reassignment') await UserDeviceRole.update({ userId: bob.id }, { where: { deviceId: frame.uuid } });
          if (change === 'album ownership revocation') await aliceAlbum.update({ owner: bob.id });
          if (change === 'album cleared') await state.update({ albumId: null });
          if (change === 'photo removed') await alicePhoto.destroy();
        }
        const size = Buffer.alloc(4);
        size.writeUInt32LE(8);
        return size;
      });
      await expect(pushNextPhotoToDevice(frame.uuid, client)).rejects.toThrow('Photo access changed');
      expect(Buffer.concat(client.sent.slice(1))).toEqual(aliceBytes.subarray(0, 8));
    });

  test('finishes the active photo after the scheduler selects the next photo', async () => {
    const nextPhoto = await Photo.create({ owner: alice.id, albumId: aliceAlbum.id });
    const client = simulatedFrame();
    await pushNextPhotoToDevice(frame.uuid, client);
    expect(Buffer.concat(client.sent.slice(1))).toEqual(aliceBytes);
    await state.reload();
    expect(state.nextPhotoId).toBe(nextPhoto.id);
  });

  test.each(['unlink', 'device reassignment', 'album ownership revocation', 'album reassignment'])(
    'rechecks authorization when queued delivery executes after %s', async change => {
      const client = simulatedFrame();
      let execute;
      let queued;
      const ready = new Promise(resolve => { queued = resolve; });
      client.enqueueTask = task => new Promise((resolve, reject) => {
        execute = () => Promise.resolve().then(task).then(resolve, reject);
        queued();
      });
      const pending = attemptDelivery(client);
      await ready;
      if (change === 'unlink') await UserDeviceRole.destroy({ where: { deviceId: frame.uuid } });
      if (change === 'device reassignment') await UserDeviceRole.update({ userId: bob.id }, { where: { deviceId: frame.uuid } });
      if (change === 'album ownership revocation') await aliceAlbum.update({ owner: bob.id });
      if (change === 'album reassignment') await state.update({ albumId: bobAlbum.id, nextPhotoId: bobPhoto.id });
      await execute();
      await pending;
      expect(client.send).not.toHaveBeenCalled();
      expect(fileRead).not.toHaveBeenCalled();
    });
});


test('current frame photos use relative URLs even with untrusted host headers', async () => {
    await state.update({ currentPhotoId: alicePhoto.id });
    const res = response();
    await getUserDevices({ user: { id: alice.id }, protocol: 'http', get: () => 'attacker.test' }, res);
    expect(JSON.stringify(res.body)).toContain(`/api/photo/get/${alicePhoto.id}.png`);
    expect(JSON.stringify(res.body)).not.toContain('attacker.test');
});

test('frame preview uses the authorized photo delivery path', async () => {
    const tcp = require('../src/services/tcpServer');
    const { triggerFramePreview } = require('../src/controller/deviceController');
    const client = simulatedFrame();
    tcp.getConnectedDevices.mockReturnValueOnce(new Map([[frame.uuid, client]]));
    const res = response();
    await triggerFramePreview({}, res);
    expect(res.statusCode).toBe(200);
    expect(Buffer.concat(client.sent.slice(1))).toEqual(aliceBytes);
    const missing = response();
    await triggerFramePreview({}, missing);
    expect(missing.statusCode).toBe(404);
});
