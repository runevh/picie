const net = require('net');
const EventEmitter = require('events');
const Device = require('../models/device');
const bcrypt = require('bcryptjs');
const { Validator } = require('sequelize');

const AUTH_MSG_LENGTH = 98; // UUID(36) + hex key(62)
const MAX_AUTH_FRAME_BYTES = AUTH_MSG_LENGTH + 2; // Optional CR followed by LF
// Device-to-server frame lengths, including the opcode byte.
const MESSAGE_LENGTHS = new Map([
  [0x02, 1], // Heartbeat pong
  [0x21, 5], // Image chunk request: uint32 LE
  [0x31, 5], // Firmware chunk request: uint32 LE
  [0x40, 1], [0x41, 1], [0x42, 1], [0x43, 1], [0x44, 1], [0x4f, 1], // Status
]);
const HEARTBEAT_BASE_MS = 300_000;      // 5 minutes between healthy pings
const HEARTBEAT_RETRY_MS = 5_000;       // retry interval after a miss
const HEARTBEAT_MAX_RETRIES = 3;        // destroy after this many consecutive misses
const IDLE_WAIT_TIMEOUT_MS = 60_000;    // cap how long we wait for devices to report idle

class TcpServer extends EventEmitter {
    constructor(port) {
        super();
        this.port = port;
        this.sockets = new Set();
        this.devices = new Map();
        this.server = net.createServer(socket => this.handleConnection(socket));
    }

    start() {
        return new Promise((resolve, reject) => {
            this.server.once('error', reject);
            this.server.listen(this.port, '0.0.0.0', () => {
                this.server.removeListener('error', reject);
                resolve();
            });
        });
    }

    stop() {
        for (const socket of this.sockets) socket.destroy();
        return new Promise((resolve, reject) => {
            if (!this.server.listening) return resolve();
            this.server.close(error => error ? reject(error) : resolve());
        });
    }

  handleConnection(socket) {
    this.sockets.add(socket);
    socket.once('close', () => this.sockets.delete(socket));
    console.log('New client connected:', socket.remoteAddress);
    new TcpClient(socket, this.devices);
  }

    getConnectedDevices() {
        return this.devices;
    }
}

class TcpClient {
  constructor(socket, devices) {
    this.socket = socket;
    this.uuid = null;
    this.authenticated = false;
    this.authPending = false;
    this.closed = false;
    this.buffer = Buffer.alloc(0);
    this.pendingResponses = new Map();
    this.lastSeenUpdate = 0;
    this.status = 'idle';
    this.statusWaiters = [];
    this.pendingTask = null;
    this.processingTask = false;
    this.activeTask = null;
    this.heartbeatTimer = null;
    this.missedHeartbeats = 0;

    // Enable TCP-level keepalive so we notice abrupt device power-offs
    // instead of holding a half-open connection indefinitely.
    this.socket.setKeepAlive(true, 15_000);

    this.authTimeout = setTimeout(() => {
      console.log('Auth timeout — closing connection');
      this.closeConnection();
    }, 15000);

    this.socket.on('data', data => this.onData(data));
    this.socket.on('error', err => {
      console.error('Socket error:', err);
      this.closeConnection();
    });
    this.socket.on('end', () => this.closeConnection());
    this.socket.on('close', () => this.closeConnection());
    this.devices = devices
  }

  closeConnection() {
    if (this.closed) return;
    this.closed = true;
    const error = new Error('Device disconnected');
    this.imageTransfer?.cancel(error);
    for (const handler of this.pendingResponses.values()) handler.cancel?.(error);
    for (const waiter of [...this.statusWaiters]) waiter.cancel(error);
    this.pendingTask?.reject(error);
    this.pendingTask = null;
    this.activeTask?.reject(error);
    this.authenticated = false;
    this.buffer = Buffer.alloc(0);
    clearTimeout(this.authTimeout);
    clearTimeout(this.rebootTimer);
    this.stopHeartbeat();
    if (this.uuid && this.devices.get(this.uuid) === this) {
      this.devices.delete(this.uuid);
    }
    if (!this.socket.destroyed) this.socket.destroy();
  }

  isClosed() {
    return this.closed || this.socket.destroyed || this.socket.readableEnded;
  }

  onData(data) {
    if (this.isClosed()) return;
    if (this.authenticated) {
      this.readMessages(data);
      return;
    }

    // Devices must wait for AUTH_OK before sending anything else.
    if (this.authPending || this.buffer.length + data.length > MAX_AUTH_FRAME_BYTES) {
      this.closeConnection();
      return;
    }
    this.buffer = Buffer.concat([this.buffer, data]);
    const newline = this.buffer.indexOf('\n');
    if (newline === -1) return;
    if (newline !== this.buffer.length - 1) {
      this.closeConnection();
      return;
    }

    const line = this.buffer.subarray(0, newline).toString('utf8').replace(/\r$/, '');
    this.buffer = Buffer.alloc(0);
    void this.handleAuth(line);
  }

  async handleAuth(authString) {
    if (this.isClosed()) return;
    if (this.authPending || this.authenticated) {
      this.closeConnection();
      return;
    }
    this.authPending = true;
    try {
      const recvUuid = authString.slice(0, 36);
      const secret = authString.slice(36);
      if (authString.length !== AUTH_MSG_LENGTH || !Validator.isUUID(recvUuid) ||
          !/^[0-9a-f]{62}$/i.test(secret)) {
        this.closeConnection();
        return;
      }

      const device = await Device.findOne({ where: { uuid: recvUuid } });
      if (this.isClosed()) return;
      if (!device) {
        this.closeConnection();
        return;
      }

      const secretCorrect = await bcrypt.compare(secret, device.secret);
      if (this.isClosed()) return;
      if (!secretCorrect) {
        this.closeConnection();
        return;
      }

      // Replace an existing connection only after this one has authenticated.
      const existing = this.devices.get(recvUuid);
      if (existing && existing !== this) existing.socket.destroy();

      this.authenticated = true;
      clearTimeout(this.authTimeout);
      this.uuid = recvUuid;
      this.devices.set(recvUuid, this);
      this.socket.write(Buffer.from([0x10]));
      this.updateLastSeen();
      this.startHeartbeat();
    } catch (err) {
      console.warn('Device authentication failed:', err.message);
      this.closeConnection();
    } finally {
      this.authPending = false;
    }
  }

  readMessages(data) {
    let offset = 0;
    while (offset < data.length && !this.isClosed()) {
      const code = this.buffer.length ? this.buffer[0] : data[offset];
      const length = MESSAGE_LENGTHS.get(code);
      if (!length) {
        this.closeConnection();
        return;
      }

      // Copy only enough bytes for one frame; retained input never exceeds 5 bytes.
      const count = Math.min(length - this.buffer.length, data.length - offset);
      this.buffer = Buffer.concat([this.buffer, data.subarray(offset, offset + count)]);
      offset += count;
      if (this.buffer.length < length) return;

      const message = this.buffer;
      this.buffer = Buffer.alloc(0);
      try {
        this.handleData(message);
      } catch (err) {
        console.warn('Invalid device message:', err.message);
        this.closeConnection();
      }
    }
  }

    handleData(data) {
        console.log("Received new data");
    const [code, ...rest] = data;

    if (code >= 0x40 && code <= 0x4F) {
      this.imageTransfer?.status(code);
      if (this.isClosed()) return;
      const previousStatus = this.status;
      const nextStatus = this.mapStatusCode(code);
      console.log(`Device ${this.uuid || 'unknown'} status code 0x${code.toString(16)}: ${previousStatus} -> ${nextStatus}`);
      this.status = nextStatus;
      this.updateLastSeen();
      if (this.status === 'idle' || this.status === 'error') {
        this.flushStatusWaiters();
        this.processTaskQueue();
      } else if (this.status === 'rebooting') {
        console.log(`Device ${this.uuid || 'unknown'} reported rebooting; destroying socket to allow reconnect`);
        // Give a tiny grace period to flush logs then close.
        clearTimeout(this.rebootTimer);
        this.rebootTimer = setTimeout(() => this.closeConnection(), 50);
      }
      return;
    }

        const handler = this.pendingResponses?.get(code);
        if (handler) {
            handler(Buffer.from(rest));
        } else {
            console.warn(`No handler found for response code 0x${code.toString(16)}`);
        }
    this.updateLastSeen();
  }

  waitUntilIdle(timeoutMs = IDLE_WAIT_TIMEOUT_MS) {
    if (this.isClosed()) return Promise.reject(new Error('Device disconnected'));
    if (this.status === 'idle' || this.status === 'error') return Promise.resolve();

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.statusWaiters = this.statusWaiters.filter(fn => fn !== wrapped);
      };
      const wrapped = () => { cleanup(); resolve(); };
      wrapped.cancel = error => { cleanup(); reject(error); };
      const timer = setTimeout(() => wrapped.cancel(new Error('Timed out waiting for device to become idle')), timeoutMs);

      this.statusWaiters.push(wrapped);
    });
  }

  flushStatusWaiters() {
    const waiters = [...this.statusWaiters];
    this.statusWaiters = [];
    waiters.forEach((resolve) => resolve());
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.missedHeartbeats = 0;
    this.heartbeatTimer = setTimeout(() => this.sendHeartbeat(), HEARTBEAT_BASE_MS);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  async sendHeartbeat() {
    if (!this.authenticated) return;
    try {
      // 0x01 = ping, expect 0x02 = pong
      this.socket.write(Buffer.from([0x01]));
      await this.waitForResponse(0x02, 10_000);
      if (this.isClosed()) return;
      this.missedHeartbeats = 0;
      // Schedule the next regular heartbeat after a healthy pong.
      this.stopHeartbeat();
      this.heartbeatTimer = setTimeout(() => this.sendHeartbeat(), HEARTBEAT_BASE_MS);
    } catch (err) {
      if (this.isClosed()) return;
      this.missedHeartbeats += 1;
      if (this.missedHeartbeats >= HEARTBEAT_MAX_RETRIES) {
        console.warn(`Heartbeat missed ${this.missedHeartbeats} times for device ${this.uuid}; destroying socket`);
        this.socket.destroy();
        return;
      }
      // Retry sooner after a miss.
      this.stopHeartbeat();
      this.heartbeatTimer = setTimeout(() => this.sendHeartbeat(), HEARTBEAT_RETRY_MS);
    }
  }

  enqueueTask(taskFn, label = 'task', timeoutMs = 120000) {
    if (this.isClosed()) return Promise.reject(new Error('Device disconnected'));
    this.pendingTask?.reject(new Error('Task superseded by newer work'));
    const task = { taskFn, label, settled: false };
    task.promise = new Promise((resolve, reject) => {
      const finish = (callback, value) => {
        if (task.settled) return;
        task.settled = true;
        clearTimeout(task.timer);
        callback(value);
      };
      task.resolve = value => finish(resolve, value);
      task.reject = error => finish(reject, error);
    });
    task.timer = setTimeout(() => {
      task.reject(new Error('Device task timed out'));
      // An unfinished transfer must not overlap the next task.
      this.closeConnection();
    }, timeoutMs);
    this.pendingTask = task;
    void this.processTaskQueue();
    return task.promise;
  }

  async processTaskQueue() {
    if (this.processingTask) return;
    this.processingTask = true;
    try {
      while (this.pendingTask && !this.isClosed()) {
        try {
          await this.waitUntilIdle();
        } catch (error) {
          this.pendingTask?.reject(error);
          this.pendingTask = null;
          continue;
        }
        const task = this.pendingTask;
        this.pendingTask = null;
        if (!task || task.settled || this.isClosed()) continue;
        this.activeTask = task;
        const execute = async () => {
          if (task.settled || this.isClosed()) throw new Error('Device task cancelled');
          return task.taskFn();
        };
        try {
          const result = await Promise.race([execute(), task.promise]);
          task.resolve(result);
        } catch (error) {
          task.reject(error);
        } finally {
          this.activeTask = null;
        }
      }
    } finally {
      this.processingTask = false;
    }
  }

  hasPendingWork() {
    // Only treat queued/actively running tasks as "pending work".
    // Do NOT block merely because the device reports a non-idle status; downstream
    // sendImage/waitUntilIdle already wait for the device to become idle before pushing.
    return this.processingTask || Boolean(this.pendingTask);
  }

  send(data) {
    if (!this.isClosed() && this.authenticated && this.socket.writable) {
      this.socket.write(Buffer.from(data));
    } else {
      console.warn(`Attempt to send to unauthenticated or closed socket: ${this.uuid}`);
        }
    }

    waitForResponse(code, timeout = 15000) {
        if (this.isClosed()) return Promise.reject(new Error('Device disconnected'));
        if (this.pendingResponses.has(code)) return Promise.reject(new Error('Response waiter already registered'));
        return new Promise((resolve, reject) => {
            const cleanup = () => {
                clearTimeout(timer);
                if (this.pendingResponses.get(code) === handler) this.pendingResponses.delete(code);
            };
            const handler = data => { cleanup(); resolve(data); };
            handler.cancel = error => { cleanup(); reject(error); };
            const timer = setTimeout(() => handler.cancel(new Error('Response timeout')), timeout);
            this.pendingResponses.set(code, handler);
        });
    }

    async updateLastSeen() {
        if (!this.uuid) return;

        const now = Date.now();
        if (now - this.lastSeenUpdate < 15_000) return;

        this.lastSeenUpdate = now;
        try {
            await Device.update(
                { lastSeen: new Date() },
                { where: { uuid: this.uuid } }
            );
        } catch (err) {
            console.error(`Failed to update lastSeen for device ${this.uuid}:`, err);
        }
    }

    mapStatusCode(code) {
        switch (code) {
            case 0x40: return 'idle';
            case 0x41: return 'updating_image';
            case 0x42: return 'pairing';
            case 0x43: return 'updating_frame';
            case 0x44: return 'rebooting';
            case 0x4F: return 'error';
            default: return this.status || 'idle';
        }
    }
}

module.exports = { TcpServer, TcpClient };
