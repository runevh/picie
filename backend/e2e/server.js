// Test process only: no control endpoints are added to the production app.
const net = require('net');
const fs = require('fs');
const { randomBytes, createHash, createDecipheriv } = require('crypto');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
let clockOffset = 0;
const now = Date.now;
Date.now = () => now() + clockOffset;
let pin;
const rendererPath = require.resolve('../src/services/photo/pinImageGenerator');
const render = require(rendererPath);
require.cache[rendererPath].exports = async value => {
    const image = await render(value);
    pin = { value, image };
    return image;
};
const { app } = require('../src/index');
const { start } = require('../src/start');
const { sequelize, connectDB } = require('../src/config/db');
const tcp = require('../src/services/tcpServer');
const Device = require('../src/models/device');
const { Photo, Album } = require('../src/models/photo');
const { DeviceState } = require('../src/models/deviceState');
const { UserDeviceRole } = require('../src/models/userDeviceRole');
const { dither } = require('../src/services/photo/dithering');
const sharp = require('sharp');
let lifecycle, device, secret, socket, incoming = Buffer.alloc(0), pixels = [], remaining = 0;
let authenticated = false, mode = 'confirm', transfers = [];
const size = 600 * 448 / 2;
function requestChunk() {
    const request = Buffer.alloc(5); request[0] = 0x21;
    remaining = Math.min(4096, size - pixels.reduce((n, b) => n + b.length, 0));
    request.writeUInt32LE(remaining, 1); socket.write(request);
}
async function connect() {
    incoming = Buffer.alloc(0); pixels = []; remaining = 0; authenticated = false;
    socket = net.createConnection({ host: '127.0.0.1', port: tcp.server.address().port });
    await new Promise((resolve, reject) => {
        socket.once('error', reject);
        socket.once('connect', () => socket.write(device.uuid + secret + '\n'));
        socket.on('data', data => {
            incoming = Buffer.concat([incoming, data]);
            if (!authenticated) {
                if (incoming[0] !== 0x10) return reject(new Error('Simulator authentication failed'));
                authenticated = true; incoming = incoming.subarray(1); resolve();
            }
            while (incoming.length) {
                if (remaining) {
                    const count = Math.min(remaining, incoming.length);
                    pixels.push(incoming.subarray(0, count)); incoming = incoming.subarray(count); remaining -= count;
                    if (remaining) continue;
                    if (mode === 'disconnect') { socket.destroy(); incoming = Buffer.alloc(0); return; }
                    if (pixels.reduce((n, b) => n + b.length, 0) < size) requestChunk();
                    else {
                        transfers.push(sha(Buffer.concat(pixels)));
                        if (mode === 'confirm') socket.write(Buffer.from([0x40]));
                    }
                } else {
                    const opcode = incoming[0]; incoming = incoming.subarray(1);
                    if (opcode === 0x20) { pixels = []; socket.write(Buffer.from([0x41])); requestChunk(); }
                    else if (opcode === 0x01) socket.write(Buffer.from([0x02]));
                    else throw new Error('Unexpected simulator opcode');
                }
            }
        });
    });
}
function decryptedPixels(id) {
    const data = fs.readFileSync(`${process.env.PHOTO_STORAGE_PATH}/${id}.data`);
    const decipher = createDecipheriv('aes-256-gcm', Buffer.from(process.env.PHOTO_ENC_KEY, 'base64'), data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(12, 28));
    return sha(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]));
}
const commands = {
    async snapshot() {
        const photos = await Photo.findAll();
        return { state: (await DeviceState.findOne({ where: { deviceId: device.uuid } }))?.toJSON(),
            photos: photos.map(p => ({ id: p.id, albumId: p.albumId, hash: decryptedPixels(p.id) })),
            albums: await Album.count(), links: await UserDeviceRole.count(), transfers,
            connected: tcp.getConnectedDevices().has(device.uuid),
            pending: !!tcp.getConnectedDevices().get(device.uuid)?.imageTransfer };
    },
    async pin() { return { value: pin.value, hash: sha(await dither(pin.image)) }; },
    async uploadsWritable(writable) {
        const path = process.env.PHOTO_STORAGE_PATH;
        if (writable) {
            fs.unlinkSync(path);
            fs.renameSync(`${path}.saved`, path);
        } else {
            fs.renameSync(path, `${path}.saved`);
            fs.writeFileSync(path, 'Storage unavailable for this test');
        }
    },
    async mode(value) { mode = value; },
    async disconnect() { socket.destroy(); },
    async reconnect() { await connect(); },
    async acknowledge() { socket.write(Buffer.from([0x40])); },
    async advance(ms) { clockOffset += ms; },
    async retry() { return require('../src/services/device/imageUpdateManager').pushNextPhotoToDevice(device.uuid, tcp.getConnectedDevices().get(device.uuid)); },
    async image() { return (await sharp({ create: { width: 600, height: 448, channels: 3, background: '#335577' } }).png().toBuffer()).toString('base64'); },
    async stop() { socket?.destroy(); await lifecycle.stop(); },
};
process.on('message', async ({ id, method, value }) => {
    try { process.send({ id, result: await commands[method](value) }); }
    catch (error) { process.send({ id, error: error.message }); }
});
(async () => {
    tcp.port = 0; tcp.host = '127.0.0.1';
    lifecycle = await start({ app, database: sequelize, initialize: connectDB, tcp, schedule: () => () => {}, port: 0, host: '127.0.0.1' });
    secret = randomBytes(31).toString('hex');
    device = await Device.create({ publicId: '123456', secret, name: 'Test frame' });
    await connect();
    process.send({ ready: true, port: lifecycle.server.address().port });
})().catch(error => { console.error(error); process.exit(1); });
process.on('disconnect', () => { socket?.destroy(); lifecycle?.stop().finally(() => process.exit()); });
