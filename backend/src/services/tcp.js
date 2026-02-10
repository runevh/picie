const net = require('net');
const EventEmitter = require('events');
const Device = require('../models/device');
const bcrypt = require('bcryptjs');
const { sendImage } = require("./photo/imageSender")
const { getOrCreateDeviceState, markDeviceUpdateSent } = require('../schedules/updateScheduler');

const AUTH_MSG_LENGTH = 98 // UUID(36)+ key(62)

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
    this.buffer = Buffer.alloc(0);
    this.pendingResponses = new Map();
    this.lastSeenUpdate = 0;
    this.status = 'idle';
    this.statusWaiters = [];
    this.pendingTask = null;
    this.processingTask = false;

    // Enable TCP-level keepalive so we notice abrupt device power-offs
    // instead of holding a half-open connection indefinitely.
    this.socket.setKeepAlive(true, 15_000);

    this.authTimeout = setTimeout(() => {
      console.log('Auth timeout — closing connection');
      this.socket.destroy();
    }, 15000);

        this.socket.on('data', data => this.onData(data));
        this.socket.on('error', err => {
            console.error('Socket error:', err);
        });
    this.socket.on('end', () => {
      if (this.uuid) {
        console.log(`Device ${this.uuid} ended connection`);
      }
    });
    this.socket.on('close', () => {
      clearTimeout(this.authTimeout);
      if (this.uuid) {
        devices.delete(this.uuid);
        console.log(`Device ${this.uuid} disconnected; cleaned up state`);
      }
    });
    this.devices = devices
  }

    onData(data) {
        this.buffer = Buffer.concat([this.buffer, data]);

        if (!this.authenticated) {
            // Auth - read string lines ending with \n
            while (true) {
                const newlineIndex = this.buffer.indexOf('\n');
                if (newlineIndex === -1) break; // wait for full auth message

                const lineBuf = this.buffer.subarray(0, newlineIndex);
                this.buffer = this.buffer.subarray(newlineIndex + 1);

                let line = lineBuf.toString('utf8').replace(/\r$/, '');

                this.handleAuth(line);

                if (this.authenticated) {
                    this.buffer = Buffer.alloc(0);
                    break;
                }
            }
        } else {
            this.handleData(this.buffer);
            this.buffer = Buffer.alloc(0);
        }
    }

    async handleAuth(authString) {
        if (authString.length != AUTH_MSG_LENGTH) { //Account for the \r at the end
            console.log('Message not right length');
            this.socket.destroy();
            return;
        };

        const recvUuid = authString.substring(0, 36);
        const secret = authString.substring(36, AUTH_MSG_LENGTH);

        if (!recvUuid || !secret) {
            this.socket.destroy();
            return;
        }

        const device = await Device.findOne({ where: { uuid: recvUuid } });
        if (!device) {
            console.log('Device not found');
            this.socket.destroy();
            return;
        }

        const secretCorrect = await bcrypt.compare(secret, device.secret);

        if (!secretCorrect) {
            this.socket.destroy();
            return;
        }

        console.log(`Device ${recvUuid} authenticated`);
        this.authenticated = true;
        clearTimeout(this.authTimeout);
        this.uuid = recvUuid;
        this.devices.set(this.uuid, this);
        this.socket.write(Buffer.from([0x10])); // Send AUTH_OK
        this.updateLastSeen();
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
      if (this.status === 'idle') {
        this.flushStatusWaiters();
        this.processTaskQueue();
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

  waitUntilIdle() {
    if (this.status === 'idle') return Promise.resolve();
    return new Promise((resolve) => {
      this.statusWaiters.push(resolve);
    });
  }

  flushStatusWaiters() {
    const waiters = [...this.statusWaiters];
    this.statusWaiters = [];
    waiters.forEach((resolve) => resolve());
  }

  enqueueTask(taskFn, label = 'task') {
    // Keep only the latest queued task; override any previous pending one.
    const promise = new Promise((resolve, reject) => {
      this.pendingTask = { taskFn, resolve, reject, label };
    });
    this.processTaskQueue();
    return promise;
  }

  async processTaskQueue() {
    if (this.processingTask) return;
    this.processingTask = true;
    while (this.pendingTask) {
      // Wait until the device reports idle before choosing which task to run.
      await this.waitUntilIdle();

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
      } catch (err) {
        console.error(`[tcp] task "${current.label}" failed for device ${this.uuid}`, err);
        current.reject(err);
      }
    }
    this.processingTask = false;
  }

  hasPendingWork() {
    return this.processingTask || Boolean(this.pendingTask) || (this.status && this.status !== 'idle');
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
            case 0x4F: return 'error';
            default: return this.status || 'idle';
        }
    }
}

module.exports = { TcpServer, TcpClient };
