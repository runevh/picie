const { getDeviceAlbum } = require('../services/device/albumAccess');
const { DeviceState, DEFAULT_INTERVAL_MINUTES } = require('../models/deviceState');
const { Photo } = require('../models/photo');

const formatNextUpdateLabel = (timestamp) => {
  if (!timestamp) return "update now";
  const diffMs = timestamp - Date.now();
  if (diffMs <= 0) return "update now";
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  return `in ${hours}h`;
};

const normalizeTimeValue = (value) => {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Math.min(23, Math.max(0, parseInt(match[1], 10) || 0));
  const minutes = Math.min(59, Math.max(0, parseInt(match[2], 10) || 0));
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const normalizeTimesOfDay = (input) => {
  const raw = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(",").map((t) => t.trim())
      : [];
  return Array.from(new Set(raw.map((t) => normalizeTimeValue(t)).filter(Boolean))).sort();
};

const ensureState = async (deviceId) => {
  const [state] = await DeviceState.findOrCreate({
    where: { deviceId },
    defaults: {
      scheduleMode: 'interval',
      intervalMinutes: DEFAULT_INTERVAL_MINUTES,
      timesOfDay: [],
      nextUpdateAt: Date.now(),
    },
  });
  return state;
};

const computeNextRun = (state) => {
  if (state.scheduleMode === "times") {
    const times = normalizeTimesOfDay(state.timesOfDay);
    state.timesOfDay = times;
    if (times.length > 0) {
      const now = new Date();
      const candidates = times
        .map((t) => {
          const [h, m] = String(t || "").split(":").map((v) => parseInt(v, 10));
          const dt = new Date(now);
          dt.setHours(isNaN(h) ? 0 : h, isNaN(m) ? 0 : m, 0, 0);
          if (dt <= now) {
            dt.setDate(dt.getDate() + 1);
          }
          return {
            timeOfDay: t,
            timestamp: dt.getTime(),
          };
        })
        .filter((entry) => Boolean(entry?.timestamp))
        .sort((a, b) => a.timestamp - b.timestamp);

      const next = candidates[0];
      console.log("[scheduler] computed next run (times mode)", {
        deviceId: state.deviceId,
        timesOfDay: times,
        selectedTimeOfDay: next?.timeOfDay || null,
        now: now.toISOString(),
        nextUpdateAt: next ? new Date(next.timestamp).toISOString() : null,
      });
      return next?.timestamp || now.getTime();
    }
    console.log("[scheduler] times mode configured without times; falling back to interval", {
      deviceId: state.deviceId,
    });
  }
  const minutes = Math.max(1, state.intervalMinutes || DEFAULT_INTERVAL_MINUTES);
  const nextTimestamp = Date.now() + minutes * 60 * 1000;
  console.log("[scheduler] computed next run (interval mode)", {
    deviceId: state.deviceId,
    intervalMinutes: minutes,
    nextUpdateAt: new Date(nextTimestamp).toISOString(),
  });
  return nextTimestamp;
};

const scheduleNextRun = async (state) => {
  state.nextUpdateAt = computeNextRun(state);
  await state.save();
  return state;
};

const selectNextPhotoId = async (state) => {
  const album = await getDeviceAlbum(state.deviceId, state.albumId);
  if (!album) return null;
  const photos = await Photo.findAll({
    where: { albumId: album.id, owner: album.owner },
    order: [['createdAt', 'ASC']],
    attributes: ['id'],
  });
  if (!photos || photos.length === 0) return null;

  const photoIds = photos.map((p) => p.id);
  const currentId = state.currentPhotoId !== null && state.currentPhotoId !== undefined
    ? String(state.currentPhotoId)
    : null;

  if (currentId) {
    const idx = photoIds.findIndex((id) => String(id) === currentId);
    if (idx !== -1) {
      return photoIds[(idx + 1) % photoIds.length];
    }
  }

  return photoIds[0];
};

const planNextUpdate = async (state) => {
  const nextPhotoId = await selectNextPhotoId(state);
  state.nextPhotoId = nextPhotoId;
  await scheduleNextRun(state);
  return state;
};

const ensureNextPlannedPhoto = async (deviceId) => {
  const state = await ensureState(deviceId);
  const nextPhotoId = await selectNextPhotoId(state);
  state.nextPhotoId = nextPhotoId;
  await state.save();
  return state;
};

const setDeviceSchedule = async (deviceId, schedule) => {
  const state = await ensureState(deviceId);
  if (schedule.mode) state.scheduleMode = schedule.mode;

  if (typeof schedule.intervalMinutes === "number" && Number.isFinite(schedule.intervalMinutes)) {
    state.intervalMinutes = Math.max(1, Math.floor(schedule.intervalMinutes));
  }

  if (schedule.timesOfDay !== undefined) {
    state.timesOfDay = normalizeTimesOfDay(schedule.timesOfDay);
  }

  await scheduleNextRun(state);
  return state;
};

const markDeviceUpdateSent = async (deviceId, options = {}) => {
  const state = await ensureState(deviceId);
  if (options.currentPhotoId !== undefined) {
    state.currentPhotoId = options.currentPhotoId;
  } else if (state.nextPhotoId) {
    state.currentPhotoId = state.nextPhotoId;
  }
  if (options.nextPhotoId !== undefined) {
    state.nextPhotoId = options.nextPhotoId;
  }
  await state.save();
  if (!options.skipPlan) {
    await planNextUpdate(state);
  }
  return state;
};

const getNextUpdateLabel = async (deviceId) => {
  const state = await ensureState(deviceId);
  return formatNextUpdateLabel(state.nextUpdateAt);
};

const startUpdateScheduler = (tcpServer) => {
  const { pushNextPhotoToDevice } = require('../services/device/imageUpdateManager');
  const tick = async () => {
    const devices = tcpServer.getConnectedDevices();
    for (const [uuid] of devices.entries()) {
      const state = await ensureState(uuid);
      if (!state.albumId) {
        console.log(`[scheduler] skip device ${uuid}; no album configured`);
        continue;
      }
      const now = Date.now();
      if (state.nextUpdateAt && state.nextUpdateAt > now) {
        console.log(`[scheduler] device ${uuid} not due yet`, {
          now: new Date(now).toISOString(),
          nextUpdateAt: new Date(state.nextUpdateAt).toISOString(),
        });
        continue;
      }

      if (!state.nextUpdateAt) {
        console.log(`[scheduler] device ${uuid} has no nextUpdateAt; proceeding immediately`);
      }

      const client = devices.get(uuid);
      const pending = client?.hasPendingWork && client.hasPendingWork();
      console.log(`[scheduler] ready check`, {
        deviceId: uuid,
        clientStatus: client?.status || 'unknown',
        pendingWork: pending,
        currentPhotoId: state.currentPhotoId || null,
        nextPhotoId: state.nextPhotoId || null,
        nextUpdateAt: state.nextUpdateAt ? new Date(state.nextUpdateAt).toISOString() : "immediate",
      });

      if (pending) {
        console.log(`[scheduler] skip device ${uuid}; work already pending (status ${client.status})`);
        continue;
      }
      
      console.log(`[scheduler] update now for device ${uuid} (current ${state.currentPhotoId || 'none'}, next ${state.nextPhotoId || 'none'})`, {
        scheduleMode: state.scheduleMode,
        timesOfDay: state.timesOfDay,
        intervalMinutes: state.intervalMinutes,
        scheduledFor: state.nextUpdateAt ? new Date(state.nextUpdateAt).toISOString() : "immediate",
      });
      try {
        const updatedState = await pushNextPhotoToDevice(uuid, client);
        if (!updatedState?.nextUpdateAt) {
          await planNextUpdate(state);
        }
      } catch (err) {
        console.error(`[scheduler] failed to push photo to device ${uuid}`, err);
        await planNextUpdate(state);
      }
    }
  };
  let running = null;
  const timer = setInterval(() => {
    if (running) return;
    running = tick().catch(error => console.error('[scheduler]', error)).finally(() => { running = null; });
  }, 60 * 1000);
  return async () => {
    clearInterval(timer);
    if (running) await running;
  };
};

const getOrCreateDeviceState = ensureState;

module.exports = {
  startUpdateScheduler,
  getNextUpdateLabel,
  markDeviceUpdateSent,
  setDeviceSchedule,
  getOrCreateDeviceState,
  planNextUpdate,
  ensureNextPlannedPhoto,
};
