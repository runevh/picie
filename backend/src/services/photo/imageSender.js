const { photoPath } = require('./paths');
const fs = require('fs');
const { createDecipheriv } = require('crypto');

const ALGO = 'aes-256-gcm';
const KEY = process.env.PHOTO_ENC_KEY ? Buffer.from(process.env.PHOTO_ENC_KEY, 'base64') : null;

const getKey = () => {
    if (!KEY || KEY.length !== 32) {
        throw new Error('PHOTO_ENC_KEY is missing or invalid length');
    }
    return KEY;
};

const decryptBuffer = (data) => {
    const key = getKey();
    if (data.length < 12 + 16) {
        throw new Error('Encrypted data too short');
    }
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const encrypted = data.subarray(28);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
};


async function getRawData(photoId) {
    const filePath = photoPath(photoId, 'data');

    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                return reject(err);
            }
            try {
                const decrypted = decryptBuffer(data);
                resolve(decrypted); // decrypted raw bytes from .data file
            } catch (e) {
                reject(e);
            }
        });
    });
}

const { beginImageTransfer } = require('./transfer');

async function transferBytes(client, bytes, options = {}) {
    if (!bytes.length) throw new Error('Empty image payload');
    await client.waitUntilIdle();
    if (options.authorize) await options.authorize();
    const transfer = beginImageTransfer(client, options.photoId || null, options.confirmationTimeoutMs || 90000);
    const requestChunk = () => {
        const response = client.waitForResponse(0x21, options.chunkTimeoutMs || 20000);
        response.catch(() => {});
        return response;
    };
    try {
        let response = requestChunk();
        client.send([0x20]);
        let offset = 0;
        while (offset < bytes.length) {
            const data = await response;
            if (!transfer.started) throw new Error('Chunk requested before image transfer started');
            if (data.length !== 4) throw new Error('Invalid image chunk request');
            const size = data.readUInt32LE(0);
            if (!size || size > bytes.length - offset) throw new Error('Invalid image chunk size');
            if (options.authorize) await options.authorize(offset > 0);
            if (client.isClosed()) throw new Error('Device disconnected');
            const end = offset + size;
            // Install the next waiter before writing: replies can arrive immediately.
            if (end < bytes.length) response = requestChunk();
            else transfer.sent = true;
            client.send(bytes.subarray(offset, end));
            offset = end;
        }
        await transfer.completed;
        if (options.authorize) await options.authorize(true);
    } catch (error) {
        transfer.fail(error);
        throw error;
    }
}

const sendImage = async (client, photoId, options = {}) => {
    const send = async () => {
        await client.waitUntilIdle();
        if (options.authorize) await options.authorize();
        const bytes = await getRawData(photoId);
        return transferBytes(client, bytes, { ...options, photoId });
    };
    return options.enqueue !== false ? client.enqueueTask(send, `send-image-${photoId}`) : send();
};

const sendBuffer = (client, bytes) => client.enqueueTask(() => transferBytes(client, bytes), 'send-pairing-image');
module.exports = { sendImage, sendBuffer, transferBytes };
