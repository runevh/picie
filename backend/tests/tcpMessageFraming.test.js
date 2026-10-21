jest.mock('../src/models/device', () => ({ findOne: jest.fn(), update: jest.fn().mockResolvedValue([1]) }));
jest.mock('../src/schedules/updateScheduler', () => ({}));

const { EventEmitter } = require('events');
const { TcpClient } = require('../src/services/tcp');

const frames = [
  [0x02], [0x40], [0x41], [0x42], [0x43], [0x44], [0x4f],
  [0x21, 0x40, 0x02, 0x31, 0x00],
  [0x31, 0x21, 0x40, 0x02, 0x00],
].map(bytes => Buffer.from(bytes));
const splitCases = frames.flatMap(frame =>
  Array.from({ length: frame.length + 1 }, (_, split) => [frame[0], split, frame])
);
let socket, client, dispatch;

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  socket = new EventEmitter();
  Object.assign(socket, {
    destroyed: false, writable: true, setKeepAlive: jest.fn(), write: jest.fn(),
    destroy: jest.fn(() => {
      if (!socket.destroyed) {
        socket.destroyed = true;
        socket.emit('close');
      }
    }),
  });
  const devices = new Map();
  client = new TcpClient(socket, devices);
  clearTimeout(client.authTimeout);
  client.authenticated = true;
  client.uuid = '550e8400-e29b-41d4-a716-446655440000';
  devices.set(client.uuid, client);
  dispatch = jest.spyOn(client, 'handleData');
});

afterEach(() => {
  socket.destroy();
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('TCP message framing', () => {
  test.each(splitCases)('dispatches opcode %i split at byte %i exactly once', (code, split, frame) => {
    socket.emit('data', frame.subarray(0, split));
    expect(dispatch).toHaveBeenCalledTimes(split === frame.length ? 1 : 0);
    socket.emit('data', frame.subarray(split));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(frame);
    expect(client.buffer.length).toBe(0);
    expect(socket.destroyed).toBe(false);
  });

  test('processes every message in a combined batch in order', () => {
    socket.emit('data', Buffer.concat(frames));
    expect(dispatch.mock.calls.map(([frame]) => frame)).toEqual(frames);
    expect(client.buffer.length).toBe(0);
  });

  test('preserves an incomplete tail after processing complete messages', () => {
    const frame = Buffer.from([0x21, 8, 0, 0, 0]);
    socket.emit('data', Buffer.concat([Buffer.from([0x41, 0x02]), frame.subarray(0, 3)]));
    expect(dispatch.mock.calls.map(([message]) => message)).toEqual([Buffer.from([0x41]), Buffer.from([0x02])]);
    expect(client.buffer).toEqual(frame.subarray(0, 3));
    socket.emit('data', Buffer.concat([frame.subarray(3), Buffer.from([0x40])]));
    expect(dispatch.mock.calls.map(([message]) => message)).toEqual([
      Buffer.from([0x41]), Buffer.from([0x02]), frame, Buffer.from([0x40]),
    ]);
    expect(client.status).toBe('idle');
    expect(client.buffer.length).toBe(0);
  });

  test('dispatches byte-by-byte input without treating payload bytes as opcodes', () => {
    const stream = Buffer.concat(frames);
    for (const byte of stream) socket.emit('data', Buffer.from([byte]));
    expect(dispatch.mock.calls.map(([message]) => message)).toEqual(frames);
  });

  test('resolves real image, firmware and heartbeat waiters with complete payloads', async () => {
    const image = client.waitForResponse(0x21);
    const firmware = client.waitForResponse(0x31);
    const pong = client.waitForResponse(0x02);
    socket.emit('data', Buffer.from([0x21, 8]));
    socket.emit('data', Buffer.from([0, 0, 0, 0x02, 0x31, 16, 0, 0, 0, 0x41]));
    await expect(image).resolves.toEqual(Buffer.from([8, 0, 0, 0]));
    await expect(firmware).resolves.toEqual(Buffer.from([16, 0, 0, 0]));
    await expect(pong).resolves.toEqual(Buffer.alloc(0));
    expect(client.status).toBe('updating_image');
    expect(client.pendingResponses.size).toBe(0);
  });

  test.each([0x00, 0xff, 0x45])('closes safely on unknown opcode %i', code => {
    expect(() => socket.emit('data', Buffer.from([code, 0x02]))).not.toThrow();
    expect(socket.destroyed).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
    expect(client.buffer.length).toBe(0);
  });

  test('closes on invalid trailing bytes without dispatching them', () => {
    socket.emit('data', Buffer.from([0x21, 8, 0, 0, 0, 0xff, 0x02]));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(socket.destroyed).toBe(true);
    expect(client.buffer.length).toBe(0);
  });

  test('ignores empty events and discards incomplete messages on disconnect', () => {
    socket.emit('data', Buffer.alloc(0));
    socket.emit('data', Buffer.from([0x31, 8]));
    expect(dispatch).not.toHaveBeenCalled();
    socket.destroy();
    socket.emit('data', Buffer.from([0, 0, 0]));
    expect(dispatch).not.toHaveBeenCalled();
    expect(client.buffer.length).toBe(0);
  });

  test('keeps buffered input bounded even for a large batch of valid messages', () => {
    let maximum = 0;
    dispatch.mockImplementation(() => { maximum = Math.max(maximum, client.buffer.length); });
    socket.emit('data', Buffer.concat([Buffer.alloc(65536, 0x02), Buffer.from([0x21, 8, 0, 0])]));
    expect(dispatch).toHaveBeenCalledTimes(65536);
    expect(maximum).toBeLessThanOrEqual(5);
    expect(client.buffer).toEqual(Buffer.from([0x21, 8, 0, 0]));
  });

  test('stops dispatching if a handler closes the connection', () => {
    dispatch.mockImplementationOnce(() => client.closeConnection());
    socket.emit('data', Buffer.from([0x02, 0x40]));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(client.buffer.length).toBe(0);
  });
});
