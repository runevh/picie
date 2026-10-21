const net = require('net');
const EventEmitter = require('events');
const Device = require('../models/device');
const bcrypt = require('bcryptjs');
const { Validator } = require('sequelize');
const { sendImage } = require("./photo/imageSender")
const { getOrCreateDeviceState, markDeviceUpdateSent } = require('../schedules/updateScheduler');

const AUTH_MSG_LENGTH = 98; // UUID(36) + hex key(62)
const MAX_AUTH_FRAME_BYTES = AUTH_MSG_LENGTH + 2; // Optional CR followed by LF
const HEARTBEAT_BASE_MS = 300_000;      // 5 minutes between healthy pings
const HEARTBEAT_RETRY_MS = 5_000;       // retry interval after a miss
const HEARTBEAT_MAX_RETRIES = 3;        // destroy after this many consecutive misses
const IDLE_WAIT_TIMEOUT_MS = 60_000;    // cap how long we wait for devices to report idle

class TcpServer extends EventEmitter {
    constructor(port) {
        super();
        this.devices = new Map();
        this.server = net.createServer(socket => this.handleConnection(socket));
        this.server.listen(port, '0.0.0.0', () => {
            console.log(`TCP server listening on port ${port}`);
        });
    }

  handleConnection(socket) {
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
    this.closed = true;
    this.authenticated = false;
    this.buffer = Buffer.alloc(0);
    clearTimeout(this.authTimeout);
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
      this.handleData(data);
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

    handleData(data) {
        console.log("Received new data");
    const [code, ...rest] = data;

    if (code >= 0x40 && code <= 0x4F) {
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
        setTimeout(() => this.socket.destroy(), 50);
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
    if (this.status === 'idle' || this.status === 'error') return Promise.resolve();

    return new Promise((resolve, reject) => {
      const wrapped = () => {
        clearTimeout(timer);
        resolve();
      };

      const timer = setTimeout(() => {
        // Remove the waiter so later idle events don't resolve a timed out promise.
        this.statusWaiters = this.statusWaiters.filter((fn) => fn !== wrapped);
        reject(new Error(`Timed out waiting for device ${this.uuid || 'unknown'} to become idle`));
      }, timeoutMs);

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

  waitForResponse(code, timeoutMs = 10_000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingResponses.delete(code);
        reject(new Error('response_timeout'));
      }, timeoutMs);

      this.pendingResponses.set(code, () => {
        clearTimeout(timeout);
        this.pendingResponses.delete(code);
        resolve();
      });
    });
  }

  async sendHeartbeat() {
    if (!this.authenticated) return;
    try {
      // 0x01 = ping, expect 0x02 = pong
      this.socket.write(Buffer.from([0x01]));
      await this.waitForResponse(0x02, 10_000);
      this.missedHeartbeats = 0;
      // Schedule the next regular heartbeat after a healthy pong.
      this.stopHeartbeat();
      this.heartbeatTimer = setTimeout(() => this.sendHeartbeat(), HEARTBEAT_BASE_MS);
    } catch (err) {
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

  enqueueTask(taskFn, label = 'task') {
    // Keep only the latest queued task; override any previous pending one.
    const promise = new Promise((resolve, reject) => {
      this.pendingTask = { taskFn, resolve, reject, label };
    });
    console.log(`[tcp] enqueueTask device=${this.uuid || 'unknown'} label=${label}`);
    this.processTaskQueue();
    return promise;
  }

  async processTaskQueue() {
    if (this.processingTask) return;
    this.processingTask = true;
    console.log(`[tcp] processTaskQueue start device=${this.uuid || 'unknown'}`);
    while (this.pendingTask) {
      // Wait until the device reports idle before choosing which task to run.
      try {
        await this.waitUntilIdle();
      } catch (err) {
        console.warn(`[tcp] waitUntilIdle timeout before ${this.pendingTask?.label || 'task'} for device ${this.uuid || 'unknown'}`, err?.message || err);
        // Reject the pending task so callers get a timely error instead of hanging until proxy timeout.
        this.pendingTask?.reject(err);
        this.pendingTask = null;
        continue;
      }

      // If a newer task arrived while we were waiting, drop the older one so the queue size stays at 1.
      const current = this.pendingTask;
      this.pendingTask = null;

      // Skip sending if the device already shows the target image.
      if (current?.label?.startsWith('send-image-') && this.uuid) {
        const targetPhotoId = current.label.substring('send-image-'.length);
        try {
          const state = await getOrCreateDeviceState(this.uuid);
          if (state?.currentPhotoId && String(state.currentPhotoId) === String(targetPhotoId)) {
            console.log(`[tcp] skipping ${current.label} for device ${this.uuid}; image already active`);
            // Still mark as sent to keep nextPhoto planning in sync.
            await markDeviceUpdateSent(this.uuid, { currentPhotoId: targetPhotoId });
            current.resolve(state);
            continue;
          }
        } catch (err) {
          console.warn(`[tcp] state check failed before ${current.label} for device ${this.uuid}`, err?.message || err);
        }
      }

      try {
        // If another task arrived after clearing pendingTask, process it next loop iteration.
        const result = await current.taskFn();
        current.resolve(result);
        console.log(`[tcp] task completed device=${this.uuid || 'unknown'} label=${current.label}`);
      } catch (err) {
        console.error(`[tcp] task "${current.label}" failed for device ${this.uuid}`, err);
        current.reject(err);
      }
    }
    console.log(`[tcp] processTaskQueue end device=${this.uuid || 'unknown'}`);
    this.processingTask = false;
  }

  hasPendingWork() {
    // Only treat queued/actively running tasks as "pending work".
    // Do NOT block merely because the device reports a non-idle status; downstream
    // sendImage/waitUntilIdle already wait for the device to become idle before pushing.
    return this.processingTask || Boolean(this.pendingTask);
  }

  send(data) {
    if (this.authenticated && this.socket.writable) {
      this.socket.write(Buffer.from(data));
    } else {
      console.warn(`Attempt to send to unauthenticated or closed socket: ${this.uuid}`);
        }
    }

    async waitForResponse(code, timeout = 15000) {
        return new Promise((resolve, reject) => {
            const handler = (data) => {
                clearTimeout(timer);
                this.pendingResponses.delete(code);
                resolve(data);
            };

            this.pendingResponses.set(code, handler);

            const timer = setTimeout(() => {
                this.pendingResponses.delete(code);
                reject(new Error(`Timeout waiting for response to code 0x${code.toString(16)}`));
            }, timeout);
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
