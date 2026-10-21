jest.mock('../src/models/device', () => ({ findOne: jest.fn(), update: jest.fn() }));
jest.mock('../src/schedules/updateScheduler', () => ({}));

const { EventEmitter } = require('events');
const bcrypt = require('bcryptjs');
const Device = require('../src/models/device');
const { TcpClient } = require('../src/services/tcp');
const uuid = '550e8400-e29b-41d4-a716-446655440000';
const secret = 'a'.repeat(62);
const credentials = uuid + secret;
let socket, devices, client;
const flush = () => new Promise(setImmediate);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
  Device.findOne.mockReset().mockResolvedValue({ secret: 'synthetic-hash' });
  Device.update.mockReset().mockResolvedValue([1]);
  socket = new EventEmitter();
  Object.assign(socket, {
    destroyed: false, writable: true,
    setKeepAlive: jest.fn(), write: jest.fn(),
    destroy: jest.fn(() => {
      if (!socket.destroyed) {
        socket.destroyed = true;
        socket.emit('close');
      }
    }),
  });
  devices = new Map();
  client = new TcpClient(socket, devices);
});

afterEach(() => {
  socket.destroy();
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function expectRejected() {
  expect(socket.destroyed).toBe(true);
  expect(devices.size).toBe(0);
  expect(socket.write).not.toHaveBeenCalled();
  expect(client.authenticated).toBe(false);
  expect(client.buffer.length).toBe(0);
}

describe('TCP authentication', () => {
  test.each(['\n', '\r\n'])('accepts valid credentials with delimiter %p', async delimiter => {
    socket.emit('data', Buffer.from(credentials + delimiter));
    await flush();
    expect(devices.get(uuid)).toBe(client);
    expect(socket.write).toHaveBeenCalledWith(Buffer.from([0x10]));
    expect(bcrypt.compare).toHaveBeenCalledTimes(1);
    expect(client.authenticated).toBe(true);
  });

  test('accepts credentials fragmented one byte at a time', async () => {
    for (const byte of Buffer.from(credentials + '\r\n')) socket.emit('data', Buffer.from([byte]));
    await flush();
    expect(devices.get(uuid)).toBe(client);
    expect(Device.findOne).toHaveBeenCalledTimes(1);
  });

  test.each([Buffer.alloc(101), Buffer.alloc(1024 * 1024)])('rejects oversized input before database work (%#)', async data => {
    socket.emit('data', data);
    await flush();
    expectRejected();
    expect(Device.findOne).not.toHaveBeenCalled();
  });

  test('bounds fragmented input without a newline', () => {
    socket.emit('data', Buffer.alloc(60));
    socket.emit('data', Buffer.alloc(60));
    expectRejected();
    expect(Device.findOne).not.toHaveBeenCalled();
  });

  test.each(['bad\n', 'x'.repeat(36) + secret + '\n', uuid + 'z'.repeat(62) + '\n', credentials + '\nextra'])(
    'rejects malformed authentication before database work (%#)', async data => {
      socket.emit('data', Buffer.from(data));
      await flush();
      expectRejected();
      expect(Device.findOne).not.toHaveBeenCalled();
    });

  test('rejects multiple authentication lines in one event', async () => {
    socket.emit('data', Buffer.from((credentials + '\n').repeat(2)));
    await flush();
    expectRejected();
    expect(Device.findOne).not.toHaveBeenCalled();
  });

  test('does not start a second attempt while a lookup is pending', async () => {
    const lookup = deferred();
    Device.findOne.mockReturnValue(lookup.promise);
    socket.emit('data', Buffer.from(credentials + '\n'));
    socket.emit('data', Buffer.from(credentials + '\n'));
    lookup.resolve({ secret: 'synthetic-hash' });
    await flush();
    expectRejected();
    expect(Device.findOne).toHaveBeenCalledTimes(1);
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  test.each(['lookup', 'password check'])('handles a rejected %s without an unhandled rejection', async stage => {
    if (stage === 'lookup') Device.findOne.mockRejectedValue(new Error('database unavailable'));
    else bcrypt.compare.mockRejectedValue(new Error('comparison failed'));
    await expect(client.handleAuth(credentials)).resolves.toBeUndefined();
    expectRejected();
  });

  test.each(['unknown device', 'wrong secret'])('rejects %s', async reason => {
    if (reason === 'unknown device') Device.findOne.mockResolvedValue(null);
    else bcrypt.compare.mockResolvedValue(false);
    socket.emit('data', Buffer.from(credentials + '\n'));
    await flush();
    expectRejected();
  });

  test.each(['lookup', 'password check'])('cannot authenticate after timeout or disconnect during %s', async stage => {
    const pending = deferred();
    if (stage === 'lookup') Device.findOne.mockReturnValue(pending.promise);
    else bcrypt.compare.mockReturnValue(pending.promise);
    socket.emit('data', Buffer.from(credentials + '\n'));
    await flush();
    jest.advanceTimersByTime(15000);
    pending.resolve(stage === 'lookup' ? { secret: 'synthetic-hash' } : true);
    await flush();
    expectRejected();
    expect(Device.update).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  test.each(['end', 'close', 'error'])('cannot authenticate after socket %s while lookup is pending', async event => {
    const lookup = deferred();
    Device.findOne.mockReturnValue(lookup.promise);
    socket.emit('data', Buffer.from(credentials + '\n'));
    socket.emit(event, new Error('synthetic disconnect'));
    lookup.resolve({ secret: 'synthetic-hash' });
    await flush();
    expectRejected();
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  test.each(['end', 'close', 'error'])('cannot authenticate after socket %s during password checking', async event => {
    const check = deferred();
    bcrypt.compare.mockReturnValue(check.promise);
    socket.emit('data', Buffer.from(credentials + '\n'));
    await flush();
    socket.emit(event, new Error('synthetic disconnect'));
    check.resolve(true);
    await flush();
    expectRejected();
    expect(Device.update).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  test('authenticates against a real bcrypt device secret', async () => {
    bcrypt.compare.mockRestore();
    Device.findOne.mockResolvedValue({ secret: await bcrypt.hash(secret, 4) });
    await client.handleAuth(credentials);
    expect(devices.get(uuid)).toBe(client);
    expect(socket.write).toHaveBeenCalledWith(Buffer.from([0x10]));
  });

  test('a rejected replacement leaves the existing device online', async () => {
    const previous = { socket: { destroy: jest.fn() } };
    devices.set(uuid, previous);
    bcrypt.compare.mockResolvedValue(false);
    socket.emit('data', Buffer.from(credentials + '\n'));
    await flush();
    expect(devices.get(uuid)).toBe(previous);
    expect(previous.socket.destroy).not.toHaveBeenCalled();
    expect(socket.destroyed).toBe(true);
  });

  test('closing an authenticated socket removes it and cancels heartbeat timers', async () => {
    await client.handleAuth(credentials);
    socket.destroy();
    expect(devices.size).toBe(0);
    expect(client.authenticated).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('replaces a live device only after successful authentication', async () => {
    const previous = { socket: { destroy: jest.fn() } };
    devices.set(uuid, previous);
    const lookup = deferred();
    Device.findOne.mockReturnValue(lookup.promise);
    socket.emit('data', Buffer.from(credentials + '\n'));
    expect(previous.socket.destroy).not.toHaveBeenCalled();
    lookup.resolve({ secret: 'synthetic-hash' });
    await flush();
    expect(previous.socket.destroy).toHaveBeenCalledTimes(1);
    expect(devices.get(uuid)).toBe(client);
  });
});
