jest.mock('../src/models/device', () => ({ update: jest.fn().mockResolvedValue([1]) }));
jest.mock('../src/schedules/updateScheduler', () => ({}));
const { EventEmitter } = require('events');
const { TcpClient } = require('../src/services/tcp');
let client, socket;
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
beforeEach(() => {
    jest.useFakeTimers();
    socket = new EventEmitter();
    Object.assign(socket, { writable: true, setKeepAlive() {}, write: jest.fn(), destroy() { this.destroyed = true; this.emit('close'); } });
    client = new TcpClient(socket, new Map());
    clearTimeout(client.authTimeout);
    client.authenticated = true;
});
afterEach(async () => {
    client.closeConnection();
    await flush();
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
});
test('replacing queued work settles the old promise and executes only latest work', async () => {
    client.status = 'updating_image';
    const work = jest.fn();
    const old = client.enqueueTask(work).catch(error => error.message);
    const latest = client.enqueueTask(async () => 'new');
    expect(await old).toMatch(/superseded/);
    client.status = 'idle';
    client.flushStatusWaiters();
    await expect(latest).resolves.toBe('new');
    expect(work).not.toHaveBeenCalled();
});
test('disconnect rejects active work, queued work, idle waits and response waits', async () => {
    const active = client.enqueueTask(() => new Promise(() => {})).catch(error => error.message);
    await flush();
    const queued = client.enqueueTask(jest.fn()).catch(error => error.message);
    client.status = 'updating_image';
    const idle = client.waitUntilIdle().catch(error => error.message);
    const response = client.waitForResponse(0x21).catch(error => error.message);
    client.startHeartbeat();
    client.closeConnection();
    expect(await Promise.all([active, queued, idle, response])).toEqual(Array(4).fill('Device disconnected'));
    await flush();
    expect(client.hasPendingWork()).toBe(false);
    expect(client.statusWaiters).toHaveLength(0);
    expect(client.pendingResponses.size).toBe(0);
});
test('a hung task times out without overlapping queued work', async () => {
    const hung = client.enqueueTask(() => new Promise(() => {}), 'hung', 100).catch(error => error.message);
    await flush();
    const work = jest.fn();
    const queued = client.enqueueTask(work).catch(error => error.message);
    await jest.advanceTimersByTimeAsync(100);
    expect(await hung).toMatch(/timed out/);
    expect(await queued).toMatch(/disconnected/);
    expect(work).not.toHaveBeenCalled();
    expect(client.hasPendingWork()).toBe(false);
});
test('duplicate response waiters cannot replace the original', async () => {
    const first = client.waitForResponse(0x21);
    await expect(client.waitForResponse(0x21)).rejects.toThrow('already registered');
    client.pendingResponses.get(0x21)(Buffer.from([1]));
    await expect(first).resolves.toEqual(Buffer.from([1]));
    expect(client.pendingResponses.size).toBe(0);
});
test('response and idle timeouts remove their waiters', async () => {
    client.status = 'updating_image';
    const idle = client.waitUntilIdle(10).catch(error => error.message);
    const response = client.waitForResponse(0x21, 10).catch(error => error.message);
    await jest.advanceTimersByTimeAsync(10);
    expect(await idle).toMatch(/Timed out/);
    expect(await response).toMatch(/timeout/);
    expect(client.statusWaiters).toHaveLength(0);
    expect(client.pendingResponses.size).toBe(0);
});
