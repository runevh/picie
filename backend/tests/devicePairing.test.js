jest.mock('../src/config/db', () => {
    const { Sequelize } = require('sequelize');
    return { sequelize: new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false }) };
});
jest.mock('../src/services/tcpServer', () => ({ getConnectedDevices: jest.fn() }));
jest.mock('../src/services/photo/dithering', () => ({ dither: jest.fn(async value => value) }));
jest.mock('../src/services/photo/pinImageGenerator', () => jest.fn(async pin => Buffer.from(pin)));
jest.mock('../src/services/photo/imageSender', () => ({ sendBuffer: jest.fn() }));
const { Model } = require('sequelize');
const sync = jest.spyOn(Model, 'sync').mockResolvedValue(undefined);
const { sequelize } = require('../src/config/db');
const User = require('../src/models/user');
const Device = require('../src/models/device');
const { UserDeviceRole } = require('../src/models/userDeviceRole');
const controller = require('../src/controller/deviceController');
sync.mockRestore();
const tcp = require('../src/services/tcpServer');
const generate = require('../src/services/photo/pinImageGenerator');
const { sendBuffer } = require('../src/services/photo/imageSender');
let user, other, device, now = Date.now();
async function call(method, body, caller = user) {
    const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
    await controller[method]({ user: { id: caller.id }, body }, res);
    return res;
}
async function start() {
    const res = await call('startPairing', { id: device.publicId });
    expect(res.statusCode).toBe(200);
    expect(res.body.data).not.toHaveProperty('pin');
    return { ...res.body.data, pin: generate.mock.calls.at(-1)[0] };
}
beforeEach(async () => {
    now += 960000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    await sequelize.sync({ force: true });
    [user, other] = await User.bulkCreate(['alice', 'bob'].map(username => ({
        username, email: `${username}@example.test`, firstName: username, password: 'test-password',
    })));
    device = await Device.create({ publicId: '123456', secret: 'test-secret' });
    tcp.getConnectedDevices.mockReturnValue(new Map([[device.uuid, { status: 'idle' }]]));
    sendBuffer.mockReset().mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());
afterAll(() => sequelize.close());
test('pairs once and ownership persists after expiry', async () => {
    const s = await start();
    expect(s.pin).toMatch(/^\d{4}$/);
    expect(s.expiresAt).toBe(now + 300000);
    expect((await call('completePairing', s)).statusCode).toBe(200);
    expect((await call('completePairing', s)).statusCode).toBe(410);
    now += 300000;
    expect(await UserDeviceRole.count({ where: { userId: user.id, role: 'OWNER' } })).toBe(1);
});
test('rejects cross-account completion and expiry', async () => {
    const s = await start();
    expect((await call('completePairing', s, other)).statusCode).toBe(410);
    now += 300000;
    expect((await call('completePairing', s)).statusCode).toBe(410);
    expect(await UserDeviceRole.count()).toBe(0);
});
test('rechecks and preserves existing ownership', async () => {
    const s = await start();
    await UserDeviceRole.create({ userId: other.id, deviceId: device.uuid, role: 'OWNER' });
    expect((await call('completePairing', s)).statusCode).toBe(409);
    expect((await UserDeviceRole.findOne()).userId).toBe(other.id);
    expect(await UserDeviceRole.count()).toBe(1);
});
test('concurrent completion creates one owner', async () => {
    const s = await start();
    const results = await Promise.all([call('completePairing', s), call('completePairing', s)]);
    expect(results.map(r => r.statusCode).sort()).toEqual([200, 409]);
    expect(await UserDeviceRole.count()).toBe(1);
});
test('failed display releases the reservation', async () => {
    sendBuffer.mockRejectedValueOnce(new Error('disconnected'));
    expect((await call('startPairing', { id: device.publicId })).statusCode).toBe(500);
    await start();
});
test('pending display cannot be overwritten', async () => {
    let release, entered;
    const displaying = new Promise(resolve => { entered = resolve; });
    sendBuffer.mockImplementationOnce(() => { entered(); return new Promise(resolve => { release = resolve; }); });
    const pending = call('startPairing', { id: device.publicId });
    await displaying;
    expect((await call('startPairing', { id: device.publicId }, other)).statusCode).toBe(409);
    release();
    expect((await pending).statusCode).toBe(200);
});
test('expiry during display rejects and releases the session', async () => {
    sendBuffer.mockImplementationOnce(async () => { now += 300000; });
    expect((await call('startPairing', { id: device.publicId })).statusCode).toBe(410);
    await start();
});
test('expiry during the ownership lookup prevents completion', async () => {
    const s = await start();
    const find = UserDeviceRole.findOne.bind(UserDeviceRole);
    jest.spyOn(UserDeviceRole, 'findOne').mockImplementation(async options => {
        const result = await find(options);
        now += 300000;
        return result;
    });
    expect((await call('completePairing', s)).statusCode).toBe(410);
    expect(await UserDeviceRole.count()).toBe(0);
});
test('failed ownership writes roll back and release the session', async () => {
    const s = await start();
    jest.spyOn(UserDeviceRole, 'create').mockRejectedValueOnce(new Error('database unavailable'));
    expect((await call('completePairing', s)).statusCode).toBe(500);
    expect(await UserDeviceRole.count()).toBe(0);
    expect((await call('completePairing', s)).statusCode).toBe(410);
    await start();
});
