const net = require('net');
const EventEmitter = require('events');
const Device = require('../models/device');
const bcrypt = require('bcryptjs');
const { sendImage } = require("./photo/imageSender")

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

        this.authTimeout = setTimeout(() => {
            console.log('Auth timeout — closing connection');
            this.socket.destroy();
        }, 15000);

        this.socket.on('data', data => this.onData(data));
        this.socket.on('error', err => {
            console.error('Socket error:', err);
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
            socket.destroy();
            return;
        };

        const recvUuid = authString.substring(0, 36);
        const secret = authString.substring(36, AUTH_MSG_LENGTH);

        if (!recvUuid || !secret) {
            socket.destroy();
            return;
        }

        const device = await Device.findOne({ where: { uuid: recvUuid } });
        if (!device) {
            console.log('Device not found');
            socket.destroy();
            return;
        }

        const secretCorrect = await bcrypt.compare(secret, device.secret);

        if (!secretCorrect) {
            socket.destroy();
            return;
        }

        console.log(`Device ${recvUuid} authenticated`);
        this.authenticated = true;
        clearTimeout(this.authTimeout);
        this.uuid = recvUuid;
        this.devices.set(this.uuid, this);
        this.socket.write(Buffer.from([0x10])); // Send AUTH_OK


    }

    handleData(data) {
        const [code, ...rest] = data;
        const handler = this.pendingResponses?.get(code);
        if (handler) {
            handler(Buffer.from(rest));
        } else {
            console.warn(`No handler found for response code 0x${code.toString(16)}`);
        }
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
}

module.exports = { TcpServer, TcpClient };
