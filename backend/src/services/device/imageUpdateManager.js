const { DeviceState } = require('../../models/deviceState');
const { getDevicePhoto } = require('./albumAccess');
const { sendImage } = require('../photo/imageSender');
const {
  getOrCreateDeviceState,
  ensureNextPlannedPhoto,
  confirmDevicePhoto,
} = require('../../schedules/updateScheduler');

const ensureNextState = async (deviceId) => {
  let state = await getOrCreateDeviceState(deviceId);
  if (!state.nextPhotoId) {
    state = await ensureNextPlannedPhoto(deviceId);
  }
  if (!await getDevicePhoto(state, state.nextPhotoId)) {
    await DeviceState.update({ nextPhotoId: null }, {
      where: { deviceId, albumId: state.albumId, nextPhotoId: state.nextPhotoId, updatedAt: state.updatedAt },
    });
    state = await getOrCreateDeviceState(deviceId);
  }
  return state;
};

/**
 * Sends the planned next photo to the connected device and updates state.
 * If no next photo is planned yet, it will plan one from the configured album.
 */
const pushNextPhotoToDevice = async (deviceId, client) => {
  if (!client) {
    console.warn(`[imageUpdate] No client found for device ${deviceId}`);
    return null;
  }

  console.log(`[imageUpdate] pushNextPhotoToDevice start`, {
    deviceId,
    clientStatus: client?.status || 'unknown',
  });
  const initialState = await ensureNextState(deviceId);
  if (!initialState.nextPhotoId) {
    console.warn(`[imageUpdate] No next photo planned for device ${deviceId} (album: ${initialState.albumId || 'none'})`);
    return initialState;
  }

  const targetPhotoId = initialState.nextPhotoId;

  try {
    const sendTask = async () => {
      console.log(`[imageUpdate] enqueue send-image task`, {
        deviceId,
        nextPhotoId: initialState.nextPhotoId,
        currentPhotoId: initialState.currentPhotoId || null,
      });

      let state = await ensureNextState(deviceId);
      if (!state.nextPhotoId) {
        console.warn(`[imageUpdate] No next photo planned when executing send for device ${deviceId}`);
        return state;
      }

      const photoId = state.nextPhotoId;

      await sendImage(client, photoId, {
        chunkTimeoutMs: 30000,
        deviceId,
        enqueue: false, // already inside enqueueTask
        authorize: async (started = false) => {
          // Recheck the captured photo before every chunk and after confirmation.
          const fresh = await getOrCreateDeviceState(deviceId);
          if (fresh.albumId !== state.albumId || (!started && fresh.nextPhotoId !== photoId) ||
              !await getDevicePhoto(fresh, photoId)) {
            throw new Error('Photo access changed during delivery');
          }
        },
      });

      state = await confirmDevicePhoto(deviceId, photoId, state.albumId);
      return state;
    };

    if (typeof client.enqueueTask === 'function') {
      const resultState = await client.enqueueTask(sendTask, `send-image-${targetPhotoId}`);
      console.log(`[imageUpdate] Sent photo ${resultState?.currentPhotoId || targetPhotoId} to device ${deviceId}, next up ${resultState?.nextPhotoId || 'none'}`);
      return resultState;
    }

    if (typeof client.waitUntilIdle === 'function' && client.status !== 'idle') {
      await client.waitUntilIdle();
    }

    const resultState = await sendTask();
    console.log(`[imageUpdate] Sent photo ${resultState?.currentPhotoId || targetPhotoId} to device ${deviceId}, next up ${resultState?.nextPhotoId || 'none'}`);
    return resultState;
  } catch (err) {
    console.error(`[imageUpdate] Failed to send photo to device ${deviceId}`, err);
    throw err;
  }
};

module.exports = { pushNextPhotoToDevice };
