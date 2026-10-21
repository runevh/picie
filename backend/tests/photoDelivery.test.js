jest.mock('../src/config/db', () => {
    const { Sequelize } = require('sequelize');
    return { sequelize: new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false }) };
});
const { EventEmitter } = require('events');
const { TcpClient } = require('../src/services/tcp');
const previousKey = process.env.PHOTO_ENC_KEY;
const key = Buffer.alloc(32, 7);
process.env.PHOTO_ENC_KEY = key.toString('base64');
const { transferBytes } = require('../src/services/photo/imageSender');
const { beginImageTransfer } = require('../src/services/photo/transfer');
const { sequelize } = require('../src/config/db');
const Device = require('../src/models/device');
const User = require('../src/models/user');
const { Album, Photo } = require('../src/models/photo');
const { UserDeviceRole } = require('../src/models/userDeviceRole');
const { DeviceState } = require('../src/models/deviceState');
const { confirmDevicePhoto, startUpdateScheduler } = require('../src/schedules/updateScheduler');
const { randomUUID } = require('crypto');
const flush = async () => { for (let i = 0; i < 20; ++i) await Promise.resolve(); };
let clients = [];
function frame(onWrite = () => {}) {
    const socket = new EventEmitter();
    Object.assign(socket, { writable: true, setKeepAlive() {},
        write: jest.fn(bytes => onWrite(bytes, socket)),
        destroy() { this.destroyed = true; this.emit('close'); } });
    const client = new TcpClient(socket, new Map());
    clearTimeout(client.authTimeout);
    client.authenticated = true;
    clients.push(client);
    return { client, socket };
}
function request(socket, size, prefix = []) {
    const bytes = Buffer.alloc(5); bytes[0] = 0x21; bytes.writeUInt32LE(size, 1);
    socket.emit('data', Buffer.concat([Buffer.from(prefix), bytes]));
}
beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { clients.forEach(c => c.closeConnection()); clients = []; jest.restoreAllMocks(); });
afterAll(async () => {
    await sequelize.close();
    if (previousKey === undefined) delete process.env.PHOTO_ENC_KEY; else process.env.PHOTO_ENC_KEY = previousKey;
});

test('real TCP parser handles immediate chunks and waits for refresh confirmation', async () => {
    let writes = 0;
    const { client, socket } = frame((bytes, socket) => {
        if (++writes === 1) request(socket, 2, [0x41]);
        else if (writes === 2) request(socket, 2);
    });
    let finished = false;
    const delivery = transferBytes(client, Buffer.from('test')).then(() => { finished = true; });
    await flush();
    expect(Buffer.concat(socket.write.mock.calls.slice(1).map(([bytes]) => bytes))).toEqual(Buffer.from('test'));
    expect(client.imageTransfer.sent).toBe(true);
    expect(finished).toBe(false);
    socket.emit('data', Buffer.from([0x40]));
    await delivery;
    expect(client.imageTransfer).toBeNull();
    expect(client.pendingResponses.size).toBe(0);
});

test.each([0, 5, 0xffffffff])('invalid chunk size %s closes without sending pixels', async size => {
    const { client, socket } = frame((_, socket) => request(socket, size, [0x41]));
    await expect(transferBytes(client, Buffer.from('test'))).rejects.toThrow('Invalid image chunk size');
    expect(socket.write).toHaveBeenCalledTimes(1);
    expect(client.isClosed()).toBe(true);
});

test.each([0x40, 0x4f, 0x43])('unexpected status %s cannot confirm delivery', async status => {
    const { client, socket } = frame((_, socket) => socket.emit('data', Buffer.from([status])));
    await expect(transferBytes(client, Buffer.from('test'))).rejects.toThrow();
    expect(client.isClosed()).toBe(true);
    expect(client.imageTransfer).toBeNull();
});

test('early idle after updating cannot confirm incomplete delivery', async () => {
    const { client } = frame((_, socket) => socket.emit('data', Buffer.from([0x41, 0x40])));
    await expect(transferBytes(client, Buffer.from('test'))).rejects.toThrow();
});

test.each(['disconnect', 'error', 'timeout'])('missing confirmation on %s fails and a fresh connection can retry', async failure => {
    let writes = 0;
    const { client, socket } = frame((_, socket) => {
        if (++writes === 1) request(socket, 4, [0x41]);
    });
    const result = transferBytes(client, Buffer.from('test'), { confirmationTimeoutMs: 30 }).catch(e => e);
    await flush();
    if (failure === 'disconnect') socket.emit('end');
    if (failure === 'error') socket.emit('data', Buffer.from([0x4f]));
    expect(await result).toBeInstanceOf(Error);
    socket.emit('data', Buffer.from([0x40])); // Late completion cannot revive this connection.
    expect(client.isClosed()).toBe(true);
    let retryWrites = 0;
    const retry = frame((_, socket) => {
        if (++retryWrites === 1) request(socket, 4, [0x41]);
        else socket.emit('data', Buffer.from([0x40]));
    });
    await expect(transferBytes(retry.client, Buffer.from('test'))).resolves.toBeUndefined();
});

test('fragmented chunk request is reassembled, not treated as status bytes', async () => {
    let writes = 0;
    const { client } = frame((_, socket) => {
        if (++writes === 1) {
            socket.emit('data', Buffer.from([0x41, 0x21, 4]));
            socket.emit('data', Buffer.from([0, 0, 0]));
        } else socket.emit('data', Buffer.from([0x40]));
    });
    await expect(transferBytes(client, Buffer.from('test'))).resolves.toBeUndefined();
});

test('cannot overlap a pending transfer on the same connection', () => {
    const { client } = frame();
    beginImageTransfer(client, 'first', 1000);
    expect(() => beginImageTransfer(client, 'second', 1000)).toThrow('already active');
});

async function library() {
    await sequelize.sync({ force: true });
    const owner = await User.create({ username: 'owner', firstName: 'Test', lastName: 'Owner', email: 'owner@example.test', password: 'synthetic' });
    const device = await Device.create({ uuid: randomUUID(), publicId: '123456', secret: 'synthetic' });
    await UserDeviceRole.create({ userId: owner.id, deviceId: device.uuid, role: 'OWNER' });
    const album = await Album.create({ owner: owner.id, name: 'Album' });
    const photo = await Photo.create({ owner: owner.id, albumId: album.id });
    const state = await DeviceState.create({ deviceId: device.uuid, albumId: album.id, nextPhotoId: photo.id,
        currentPhotoId: null, nextUpdateAt: new Date(0) });
    return { owner, device, album, photo, state };
}
test('confirmation updates displayed photo and schedule together', async () => {
    const { device, album, photo, state } = await library();
    const next = await Photo.create({ owner: album.owner, albumId: album.id });
    await confirmDevicePhoto(device.uuid, photo.id, album.id);
    await state.reload();
    expect(state.currentPhotoId).toBe(photo.id);
    expect(state.nextPhotoId).toBe(next.id);
    expect(+state.nextUpdateAt).toBeGreaterThan(Date.now());
});
test.each(['clear', 'empty album', 'delete', 'revoke'])('confirmation after %s cannot overwrite selection', async change => {
    const { device, album, photo, state } = await library();
    if (change === 'clear') await state.update({ albumId: null, nextPhotoId: null });
    if (change === 'empty album') {
        const other = await Album.create({ owner: album.owner, name: 'Empty' });
        await state.update({ albumId: other.id, nextPhotoId: null });
    }
    if (change === 'delete') await photo.destroy();
    if (change === 'revoke') await UserDeviceRole.destroy({ where: { deviceId: device.uuid } });
    await expect(confirmDevicePhoto(device.uuid, photo.id, album.id)).rejects.toThrow('selection changed');
    await state.reload();
    expect(state.currentPhotoId).toBeNull();
    expect(+state.nextUpdateAt).toBe(0);
});

const { pushNextPhotoToDevice } = require('../src/services/device/imageUpdateManager');
const fs = require('fs');
const { createCipheriv } = require('crypto');
function storedImage() {
    const iv = Buffer.alloc(12, 1);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([cipher.update(Buffer.from('test')), cipher.final()]);
    jest.spyOn(fs, 'readFile').mockImplementation((_, callback) => callback(null, Buffer.concat([iv, cipher.getAuthTag(), data])));
}

test.each(['success', 'disconnect', 'album change'])('real sender and database preserve state until confirmation: %s', async outcome => {
    const { device, album, photo, state } = await library();
    const previous = await Photo.create({ owner: album.owner, albumId: album.id });
    await state.update({ currentPhotoId: previous.id });
    storedImage();
    let received;
    const bytesReceived = new Promise(resolve => { received = resolve; });
    let writes = 0;
    const { client, socket } = frame((_, socket) => {
        if (++writes === 1) request(socket, 4, [0x41]);
        else received();
    });
    const result = pushNextPhotoToDevice(device.uuid, client).catch(e => e);
    await bytesReceived;
    await state.reload();
    expect(state.currentPhotoId).toBe(previous.id);
    expect(state.nextPhotoId).toBe(photo.id);
    expect(+state.nextUpdateAt).toBe(0);
    expect(client.imageTransfer.photoId).toBe(photo.id);
    if (outcome === 'album change') await state.update({ albumId: null, nextPhotoId: null });
    if (outcome === 'disconnect') socket.emit('end');
    else socket.emit('data', Buffer.from([0x40]));
    const value = await result;
    await state.reload();
    if (outcome === 'success') {
        expect(value).not.toBeInstanceOf(Error);
        expect(state.currentPhotoId).toBe(photo.id);
        expect(+state.nextUpdateAt).toBeGreaterThan(Date.now());
    } else {
        expect(value).toBeInstanceOf(Error);
        expect(state.currentPhotoId).toBe(previous.id);
        expect(+state.nextUpdateAt).toBe(0);
    }
});

test('a retry sends pixels even when old state already marks the photo current', async () => {
    const { device, photo, state } = await library();
    await state.update({ currentPhotoId: photo.id });
    storedImage();
    let writes = 0;
    const { client, socket } = frame((_, socket) => {
        if (++writes === 1) request(socket, 4, [0x41]);
        else socket.emit('data', Buffer.from([0x40]));
    });
    client.uuid = device.uuid;
    await pushNextPhotoToDevice(device.uuid, client);
    expect(socket.write).toHaveBeenCalledTimes(2);
    expect(socket.write.mock.calls[1][0]).toEqual(Buffer.from('test'));
});

test('scheduler failure leaves the pending photo due for retry', async () => {
    const { device, photo, state } = await library();
    const manager = require('../src/services/device/imageUpdateManager');
    jest.spyOn(manager, 'pushNextPhotoToDevice').mockRejectedValue(new Error('Disconnected'));
    const storage = require('../src/services/photo/storage');
    jest.spyOn(storage, 'recoverPhotoOperations').mockResolvedValue();
    let tick;
    const interval = global.setInterval;
    jest.spyOn(global, 'setInterval').mockImplementation((callback, delay) => {
        tick = callback;
        return interval(() => {}, delay);
    });
    const stop = startUpdateScheduler({ getConnectedDevices: () => new Map([[device.uuid, {}]]) });
    tick();
    await stop();
    await state.reload();
    expect(state.currentPhotoId).toBeNull();
    expect(state.nextPhotoId).toBe(photo.id);
    expect(+state.nextUpdateAt).toBe(0);
});

test('confirmation does not overwrite a schedule edit made during database work', async () => {
    const { device, album, photo, state } = await library();
    const findPhotos = Photo.findAll.bind(Photo);
    jest.spyOn(Photo, 'findAll').mockImplementationOnce(async options => {
        await state.update({ intervalMinutes: 17, nextUpdateAt: new Date('2030-01-01') });
        return findPhotos(options);
    });
    await expect(confirmDevicePhoto(device.uuid, photo.id, album.id)).rejects.toThrow('selection changed');
    await state.reload();
    expect(state.intervalMinutes).toBe(17);
    expect(state.nextUpdateAt.toISOString()).toBe('2030-01-01T00:00:00.000Z');
    expect(state.currentPhotoId).toBeNull();
});

test('missing chunk request times out and removes response waiters', async () => {
    const { client } = frame((_, socket) => socket.emit('data', Buffer.from([0x41])));
    await expect(transferBytes(client, Buffer.from('test'), { chunkTimeoutMs: 10 })).rejects.toThrow('timeout');
    expect(client.pendingResponses.size).toBe(0);
    expect(client.imageTransfer).toBeNull();
    expect(client.isClosed()).toBe(true);
});
