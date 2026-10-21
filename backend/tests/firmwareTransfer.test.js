jest.mock('fs/promises', () => ({ readFile: jest.fn() }));
jest.mock('../src/models/device', () => ({ update: jest.fn().mockResolvedValue([1]) }));

const fs = require('fs/promises');
const { EventEmitter } = require('events');
const { sendFirmware } = require('../src/services/device/firmwareSender');
const { TcpClient } = require('../src/services/tcp');

const firmware = Buffer.from([0xe9, 0x01, 0x02, 0x03, 0x04, 0xff]);
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
let clients;

function chunk(size) {
    const bytes = Buffer.alloc(4);
    bytes.writeUInt32LE(size);
    return bytes;
}

function stubClient(...sizes) {
    const client = {
        status: 'idle',
        send: jest.fn(),
        waitForResponse: jest.fn(),
    };
    sizes.forEach(size => client.waitForResponse.mockResolvedValueOnce(chunk(size)));
    return client;
}

function frame(onWrite = () => {}) {
    const socket = new EventEmitter();
    Object.assign(socket, {
        writable: true,
        setKeepAlive() {},
        write: jest.fn(bytes => onWrite(bytes, socket)),
        destroy() { this.destroyed = true; this.emit('close'); },
    });
    const client = new TcpClient(socket, new Map());
    clearTimeout(client.authTimeout);
    client.authenticated = true;
    clients.push(client);
    return { client, socket };
}

function request(socket, size) {
    socket.emit('data', Buffer.concat([Buffer.from([0x31]), chunk(size)]));
}

beforeEach(() => {
    jest.useFakeTimers();
    clients = [];
    fs.readFile.mockReset().mockResolvedValue(firmware);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(async () => {
    clients.forEach(client => client.closeConnection());
    await flush();
    jest.useRealTimers();
    jest.restoreAllMocks();
});

test('sends a little-endian size header and the exact binary in requested chunks', async () => {
    const client = stubClient(2, 1, 3);
    await expect(sendFirmware(client, 'firmware.bin')).resolves.toEqual({ bytesSent: 6, totalSize: 6 });
    expect(client.send.mock.calls.map(([bytes]) => bytes)).toEqual([
        Buffer.from([0x30, 6, 0, 0, 0]),
        firmware.subarray(0, 2), firmware.subarray(2, 3), firmware.subarray(3),
    ]);
    expect(client.waitForResponse).toHaveBeenCalledTimes(3);
    expect(client.waitForResponse).toHaveBeenCalledWith(0x31, 20000);
});

test('rejects a missing device before reading the binary', async () => {
    await expect(sendFirmware(null, 'firmware.bin')).rejects.toThrow('No TCP client');
    expect(fs.readFile).not.toHaveBeenCalled();
});

test('file read failures send nothing to the device', async () => {
    fs.readFile.mockRejectedValue(new Error('File unavailable'));
    const client = stubClient();
    await expect(sendFirmware(client, 'missing.bin')).rejects.toThrow('File unavailable');
    expect(client.send).not.toHaveBeenCalled();
});

test('waits for an idle device before sending the header', async () => {
    const client = stubClient(6);
    client.status = 'updating_image';
    let becomeIdle;
    client.waitUntilIdle = jest.fn(() => new Promise(resolve => { becomeIdle = resolve; }));
    const delivery = sendFirmware(client, 'firmware.bin');
    await flush();
    expect(client.send).not.toHaveBeenCalled();
    client.status = 'idle';
    becomeIdle();
    await delivery;
    expect(client.send).toHaveBeenCalledTimes(2);
});

test('a device that stays busy times out without receiving firmware', async () => {
    const client = stubClient();
    client.status = 'updating_image';
    const result = sendFirmware(client, 'firmware.bin').catch(error => error);
    await jest.advanceTimersByTimeAsync(60200);
    expect(await result).toEqual(expect.objectContaining({ message: 'Timed out waiting for device to become idle' }));
    expect(client.send).not.toHaveBeenCalled();
});

test.each([null, Buffer.alloc(3), Buffer.alloc(5)])('rejects a malformed chunk request: %s', async response => {
    const client = stubClient();
    client.waitForResponse.mockResolvedValue(response);
    await expect(sendFirmware(client, 'firmware.bin')).rejects.toThrow('Malformed chunk request');
    expect(client.send).toHaveBeenCalledTimes(1);
});

test('a chunk timeout closes the connection and removes the response waiter', async () => {
    const { client, socket } = frame();
    const result = sendFirmware(client, 'firmware.bin', { chunkTimeoutMs: 25 }).catch(error => error);
    await jest.advanceTimersByTimeAsync(25);
    expect(await result).toBeInstanceOf(Error);
    expect(client.isClosed()).toBe(true);
    expect(socket.write).toHaveBeenCalledTimes(1);
    expect(client.pendingResponses.size).toBe(0);
});

test('disconnecting partway through rejects instead of reporting success', async () => {
    const { client, socket } = frame();
    const result = sendFirmware(client, 'firmware.bin').catch(error => error);
    await flush();
    request(socket, 2);
    await flush();
    expect(socket.write.mock.calls[1][0]).toEqual(firmware.subarray(0, 2));
    socket.destroy();
    expect(await result).toEqual(expect.objectContaining({ message: 'Device disconnected' }));
    expect(client.pendingResponses.size).toBe(0);
});

test('firmware waits behind active work in the real device queue', async () => {
    const { client, socket } = frame();
    let finish;
    const active = client.enqueueTask(() => new Promise(resolve => { finish = resolve; }));
    await flush();
    const delivery = sendFirmware(client, 'firmware.bin');
    await flush();
    expect(socket.write).not.toHaveBeenCalled();
    finish();
    await active;
    await flush();
    request(socket, 6);
    await expect(delivery).resolves.toEqual({ bytesSent: 6, totalSize: 6 });
});

test('rejects an empty firmware file before sending a header', async () => {
    fs.readFile.mockResolvedValue(Buffer.alloc(0));
    const client = stubClient();
    await expect(sendFirmware(client, 'empty.bin')).rejects.toThrow();
    expect(client.send).not.toHaveBeenCalled();
});

test.each([0, 7, 0xffffffff])('rejects invalid chunk size %s without sending payload', async size => {
    const client = stubClient(size);
    await expect(sendFirmware(client, 'firmware.bin')).rejects.toThrow();
    expect(client.send).toHaveBeenCalledTimes(1);
});

test('a zero-size request after a partial transfer cannot report success', async () => {
    const client = stubClient(2, 0);
    await expect(sendFirmware(client, 'firmware.bin')).rejects.toThrow();
});

test('immediate device requests are handled before and between chunks', async () => {
    let writes = 0;
    const { client, socket } = frame((bytes, socket) => {
        if (++writes === 1) request(socket, 2);
        else if (writes === 2) request(socket, 4);
    });
    const result = sendFirmware(client, 'firmware.bin', { chunkTimeoutMs: 25 }).catch(error => error);
    await jest.advanceTimersByTimeAsync(25);
    expect(await result).toEqual({ bytesSent: 6, totalSize: 6 });
    expect(Buffer.concat(socket.write.mock.calls.slice(1).map(([bytes]) => bytes))).toEqual(firmware);
});

test('invalid chunks close the stream and cancel queued work', async () => {
    const { client, socket } = frame();
    const result = sendFirmware(client, 'firmware.bin').catch(error => error);
    await flush();
    const work = jest.fn();
    const queued = client.enqueueTask(work).catch(error => error);
    request(socket, 0);
    expect(await result).toBeInstanceOf(Error);
    expect(await queued).toBeInstanceOf(Error);
    expect(client.isClosed()).toBe(true);
    expect(work).not.toHaveBeenCalled();
    expect(socket.write).toHaveBeenCalledTimes(1);
    expect(client.pendingResponses.size).toBe(0);
});

test('disconnect during the final write cannot report a completed transfer', async () => {
    let writes = 0;
    const { client } = frame((bytes, socket) => {
        if (++writes === 1) request(socket, 6);
        else socket.destroy();
    });
    await expect(sendFirmware(client, 'firmware.bin')).rejects.toThrow('Device disconnected');
});
