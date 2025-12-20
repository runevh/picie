const fs = require('fs');
const path = require('path');


async function getRawData(photoId) {
    const filePath = path.join(__dirname, '..', '..', '..', 'photos', `${photoId}.data`);

    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                return reject(err);
            }
            resolve(data); // data is a Buffer of raw bytes from .data file
        });
    });
}

const sendImage = async (client, photoId) => {
    // Request size that we should send over

    try {
        const rawBytes = await getRawData(photoId);

        client.send([0x20]); // Ask to start image transfer
        let sentBytes = 0;

        console.log(rawBytes.length);

        while (sentBytes < rawBytes.length) {
            const sizeData = await client.waitForResponse(0x21)
            const size = sizeData.readUInt32LE(0);
            console.log(size);
            client.send(rawBytes.subarray(sentBytes, sentBytes + size));
            console.log("Sent " + size+ " bytes");
            sentBytes += size;
        }

        console.log("Done sending");
    } catch (e) {
        console.error('Failed send data:', e);
    }
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
    }
}

module.exports = { sendImage, sendBuffer }