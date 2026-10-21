jest.mock('../src/models/device', () => ({ update: jest.fn().mockResolvedValue([1]) }));
const { EventEmitter } = require('events');
const { TcpClient } = require('../src/services/tcp');
let client, socket;

beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    socket = new EventEmitter();
    Object.assign(socket, {
        writable: true, destroyed: false, readableEnded: false, setKeepAlive() {}, write: jest.fn(),
        destroy() { this.destroyed = true; this.emit('close'); },
    });
    client = new TcpClient(socket, new Map());
    clearTimeout(client.authTimeout);
    client.authenticated = true;
    client.startHeartbeat();
});
afterEach(async () => {
    client.closeConnection();
    await jest.advanceTimersByTimeAsync(0);
    expect(jest.getTimerCount()).toBe(0);
    expect(client.pendingResponses.size).toBe(0);
    jest.useRealTimers();
    jest.restoreAllMocks();
});

test('healthy pong schedules the next heartbeat five minutes later', async () => {
    await jest.advanceTimersByTimeAsync(299999);
    expect(socket.write).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(socket.write).toHaveBeenLastCalledWith(Buffer.from([0x01]));
    socket.emit('data', Buffer.from([0x02]));
    await jest.advanceTimersByTimeAsync(299999);
    expect(socket.write).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(socket.write).toHaveBeenCalledTimes(2);
    expect(client.isClosed()).toBe(false);
});

test('three consecutive missed pongs close the connection', async () => {
    await jest.advanceTimersByTimeAsync(300000);
    await jest.advanceTimersByTimeAsync(10000);
    expect(client.missedHeartbeats).toBe(1);
    expect(client.isClosed()).toBe(false);
    await jest.advanceTimersByTimeAsync(15000);
    expect(client.missedHeartbeats).toBe(2);
    expect(client.isClosed()).toBe(false);
    await jest.advanceTimersByTimeAsync(15000);
    expect(socket.write).toHaveBeenCalledTimes(3);
    expect(client.isClosed()).toBe(true);
});

test('a pong on retry resets misses and restores the normal interval', async () => {
    await jest.advanceTimersByTimeAsync(315000);
    expect(socket.write).toHaveBeenCalledTimes(2);
    expect(client.missedHeartbeats).toBe(1);
    socket.emit('data', Buffer.from([0x02]));
    await jest.advanceTimersByTimeAsync(0);
    expect(client.missedHeartbeats).toBe(0);
    await jest.advanceTimersByTimeAsync(299999);
    expect(socket.write).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);
    expect(socket.write).toHaveBeenCalledTimes(3);
});

test.each([0, 300000])('disconnect at %i ms cancels scheduled and pending heartbeat work', async elapsed => {
    await jest.advanceTimersByTimeAsync(elapsed);
    socket.destroy();
    const writes = socket.write.mock.calls.length;
    await jest.advanceTimersByTimeAsync(600000);
    expect(socket.write).toHaveBeenCalledTimes(writes);
    expect(client.pendingResponses.size).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
});
