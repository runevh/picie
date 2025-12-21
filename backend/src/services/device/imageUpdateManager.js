const { sendImage } = require('../photo/imageSender');
const {
  getOrCreateDeviceState,
  ensureNextPlannedPhoto,
  markDeviceUpdateSent,
  planNextUpdate,
} = require('../../schedules/updateScheduler');

const ensureNextState = async (deviceId) => {
  let state = await getOrCreateDeviceState(deviceId);
  if (!state.nextPhotoId) {
    state = await ensureNextPlannedPhoto(deviceId);
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

  const initialState = await ensureNextState(deviceId);
  if (!initialState.nextPhotoId) {
    console.warn(`[imageUpdate] No next photo planned for device ${deviceId} (album: ${initialState.albumId || 'none'})`);
    return initialState;
  }

  const targetPhotoId = initialState.nextPhotoId;

  try {
    const sendTask = async () => {
      let state = await ensureNextState(deviceId);
      if (!state.nextPhotoId) {
        console.warn(`[imageUpdate] No next photo planned when executing send for device ${deviceId}`);
        return state;
      }

      const photoId = state.nextPhotoId;

      if (state.currentPhotoId && String(state.currentPhotoId) === String(photoId)) {
        // Already active; just move schedule forward.
        state = await markDeviceUpdateSent(deviceId, { currentPhotoId: photoId, skipPlan: true });
        return state;
      }

      await sendImage(client, photoId, {
        chunkTimeoutMs: 30000,
        onStart: async () => {
          // Mark current when bytes begin flowing, then plan the next image.
          const freshState = await getOrCreateDeviceState(deviceId);
          freshState.currentPhotoId = photoId;
          await freshState.save();
          await planNextUpdate(freshState);
        },
      });

      state = await markDeviceUpdateSent(deviceId, { currentPhotoId: photoId, skipPlan: true });
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
