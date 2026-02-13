const fs = require('fs');
const path = require('path');
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
    const filePath = path.join(__dirname, '..', '..', '..', 'photos', `${photoId}.data`);

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

const sendImage = async (client, photoId, options = {}) => {
    const {
        chunkTimeoutMs = 20000,
        deviceId = 'unknown',
    } = options;

    const ensureIdle = async () => {
        const start = Date.now();
        const MAX_WAIT = 60_000;
        while (true) {
            // When called from processTaskQueue we already hold the pendingTask;
            // only gate on device status, not the task queue itself.
            const busy = client.status && client.status !== 'idle';
            if (!busy) {
                console.log(`[sendImage] device ${deviceId} idle, starting transfer`);
                return;
            }

            if (typeof client.waitUntilIdle === 'function') {
                await client.waitUntilIdle();
            } else {
                await new Promise(res => setTimeout(res, 200));
            }

            if (Date.now() - start > MAX_WAIT) {
                throw new Error(`Timed out waiting for device ${deviceId} to become idle`);
            }
            console.log(`[sendImage] device ${deviceId} still busy, waiting...`);
        }
    };

    const doSend = async () => {
        await ensureIdle();

        const rawBytes = await getRawData(photoId);
        console.log(`[sendImage] start transfer device=${deviceId} photo=${photoId} bytes=${rawBytes.length}`);

        client.send([0x20]); // Ask to start image transfer
        let sentBytes = 0;
        let started = false;

        while (sentBytes < rawBytes.length) {
            const sizeData = await client.waitForResponse(0x21, chunkTimeoutMs);
            const size = sizeData.readUInt32LE(0);
            console.log(`[sendImage] device=${deviceId} requested chunk size=${size} offset=${sentBytes}`);
            if (!started) {
                started = true;
                if (typeof options.onStart === 'function') {
                    try {
                        await options.onStart();
                    } catch (err) {
                        console.warn('sendImage onStart hook failed', err);
                    }
                }
            }
            client.send(rawBytes.subarray(sentBytes, sentBytes + size));
            console.log("Sent " + size+ " bytes");
            sentBytes += size;
        }

        console.log(`[sendImage] Done sending to device=${deviceId}`);
    };

    if (typeof client.enqueueTask === 'function') {
        return client.enqueueTask(doSend, `send-image-${photoId}`);
    }

    return doSend();
}

const sendBuffer = async (client, buffer) => {
    // Request size that we should send over
    try {
        client.send([0x20]); // Ask to start image transfer
        let sentBytes = 0;

        console.log(buffer.length);

        while (sentBytes < buffer.length) {
            const sizeData = await client.waitForResponse(0x21)
            const size = sizeData.readUInt32LE(0);
            console.log(size);
            client.send(buffer.subarray(sentBytes, sentBytes + size));
            console.log("Sent " + size+ " bytes");
            sentBytes += size;
        }

        console.log("Done sending");
    } catch (e) {
        console.error('Failed send data:', e);
        throw e;
    }
}

module.exports = { sendImage, sendBuffer }
