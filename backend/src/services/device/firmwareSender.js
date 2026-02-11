const fs = require('fs/promises');

const MAX_IDLE_WAIT_MS = 60_000;
const SLEEP_INTERVAL_MS = 200;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Streams a firmware binary to a connected device over the existing TCP protocol.
 * Protocol:
 *  - Server sends 0x30 followed by a uint32 LE total size.
 *  - Device replies with repeated 0x31 messages, each containing a uint32 LE
 *    chunk size it is ready to receive. Server sends exactly that many bytes.
 *  - Transfer ends when all bytes are delivered; the device reboots itself.
 *
 * @param {object} client TcpClient instance
 * @param {string} firmwarePath path to the firmware binary
 * @param {object} opts optional timeout override
 */
async function sendFirmware(client, firmwarePath, opts = {}) {
  const { chunkTimeoutMs = 20000 } = opts;

  if (!client) {
    throw new Error('No TCP client found for device');
  }

  const data = await fs.readFile(firmwarePath);
  const totalSize = data.length;

  const ensureIdleOrThrow = async () => {
    const start = Date.now();
    while (true) {
      if (typeof client.hasPendingWork === 'function' && client.hasPendingWork()) {
        // fall through to wait
      } else if (!client.status || client.status === 'idle') {
        return;
      }

      if (typeof client.waitUntilIdle === 'function') {
        await client.waitUntilIdle();
      } else {
        await sleep(SLEEP_INTERVAL_MS);
      }

      if (Date.now() - start > MAX_IDLE_WAIT_MS) {
        throw new Error('Timed out waiting for device to become idle');
      }
    }
  };

  const sendTask = async () => {
    await ensureIdleOrThrow();

    const header = Buffer.alloc(5);
    header[0] = 0x30;
    header.writeUInt32LE(totalSize, 1);
    client.send(header);

    let offset = 0;
    while (offset < totalSize) {
      const request = await client.waitForResponse(0x31, chunkTimeoutMs);
      if (!request || request.length < 4) {
        throw new Error('Malformed chunk request from device');
      }
      const requestedSize = request.readUInt32LE(0);
      if (requestedSize === 0) break;
      const slice = data.subarray(offset, offset + requestedSize);
      client.send(slice);
      offset += slice.length;
    }

    return { bytesSent: offset, totalSize };
  };

  if (typeof client.enqueueTask === 'function') {
    return client.enqueueTask(sendTask, `send-firmware-${Date.now()}`);
  }

  return sendTask();
}

module.exports = { sendFirmware };
