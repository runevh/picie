const { getDeviceAlbum, getAlbumView } = require('../services/device/albumAccess');
const Device = require('../models/device');
const User = require('../models/user');
const { UserDeviceRole } = require('../models/userDeviceRole');
const { Album } = require('../models/photo');
const crypto = require('crypto');
const tcpServer = require('../services/tcpServer');
const { getNextUpdateLabel, setDeviceSchedule, getOrCreateDeviceState, ensureNextPlannedPhoto } = require('../schedules/updateScheduler');
const { pushNextPhotoToDevice } = require('../services/device/imageUpdateManager');
const { sendFirmware } = require('../services/device/firmwareSender');
const { dither } = require('../services/photo/dithering');
const generateNumberImage = require('../services/photo/pinImageGenerator');
const { sendBuffer } = require('../services/photo/imageSender');
const { Op } = require('sequelize');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

// Create a new device with a random secret and return its identifiers.
const createDevice = async (req, res) => {
    try {
        const rawSecret = crypto.randomBytes(31).toString('hex'); //62 hex characters

        const device = await Device.create({
            secret: rawSecret,
        });

        res.json({
            success: true,
            data: {
                uuid: device.uuid,
                publicId: device.publicId,
                secret: rawSecret,
            },
        });
    } catch (err) {
        console.error('Error creating device:', err);
        res.status(500).json({ success: false, error: 'Failed to create device' });
    }
};

// Admin overview: return every device plus live connection/status metadata.
const getAllDevices = async (req, res) => {
    try {
        const connectedDevices = tcpServer.getConnectedDevices();
        const devices = await Device.findAll({
            include: [
                {
                    model: User,
                    as: 'Users',
                    attributes: ['username', 'firstName', 'lastName'],
                    through: {
                        where: {
                            role: 'OWNER'
                        },
                        attributes: []
                    }
                }
            ]
        });

        const list = await Promise.all(devices.map(async (device) => {
            const state = await getOrCreateDeviceState(device.uuid);
            const nextUpdate = await getNextUpdateLabel(device.uuid);
            const album = state?.albumId ? await Album.findByPk(state.albumId, { attributes: ['id', 'name'] }) : null;
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const activeImage = state?.currentPhotoId ? `${baseUrl}/api/photo/get/${state.currentPhotoId}.png` : null;
            return {
                id: device.publicId,
                uuid: device.uuid,
                name: device.name,
                lastSeen: device.lastSeen,
                status: connectedDevices.get(device.uuid)?.status || 'idle',
                nextUpdate,
                albumId: state?.albumId || null,
                album: album ? { id: album.id, name: album.name } : null,
                owner: device.Users?.[0]
                    ? {
                        name: `${device.Users[0].firstName || ''} ${device.Users[0].lastName || ''}`.trim() || device.Users[0].username,
                        email: device.Users[0].username,
                    }
                    : null,
                isOnline: connectedDevices.has(device.uuid),
                updating: false,
                currentPhotoId: state?.currentPhotoId || null,
                nextPhotoId: state?.nextPhotoId || null,
                albumId: state?.albumId || null,
                album: album ? { id: album.id, name: album.name } : null,
                scheduleMode: state?.scheduleMode || null,
                intervalMinutes: state?.intervalMinutes || null,
                timesOfDay: state?.timesOfDay || [],
                activeImage,
                nextUpdateAt: state?.nextUpdateAt ? new Date(state.nextUpdateAt).toISOString() : null,
              };
            }));

        res.json({
            success: true,
            data: list
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching devices.'
        });
    }
};

// Per-user device list, enriched with schedule and album state.
const getUserDevices = async (req, res) => {
    try {
        const { id: userId } = req.user;

        console.log(userId);

        const connectedDevices = tcpServer.getConnectedDevices();
        const devices = await UserDeviceRole.findAll({
            where: {
                userId: userId,
            },
            include: [
                {
                    model: Device,
                    attributes: ['uuid', 'publicId', 'lastSeen', 'name'],
                }
            ],
        });

        const list = await Promise.all(devices.map(async (device) => {
            const state = device.Device ? await getOrCreateDeviceState(device.Device.uuid) : null;
            const nextUpdate = device.Device ? await getNextUpdateLabel(device.Device.uuid) : "update now";
            const albumView = await getAlbumView(state, userId);
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const activeImage = albumView.currentPhotoId ? `${baseUrl}/api/photo/get/${albumView.currentPhotoId}.png` : null;
            return {
                ...device.toJSON(),
                id: device.Device?.publicId,
                name: device.Device?.name,
                lastSeen: device.Device?.lastSeen,
                status: device.Device ? connectedDevices.get(device.Device.uuid)?.status || 'idle' : 'idle',
                isOnline: device.Device ? connectedDevices.has(device.Device.uuid) : false,
                updating: false,
                nextUpdate,
                ...albumView,
                activeImage,
                scheduleMode: state?.scheduleMode || null,
                intervalMinutes: state?.intervalMinutes || null,
                timesOfDay: state?.timesOfDay || [],
                nextUpdateAt: state?.nextUpdateAt ? new Date(state.nextUpdateAt).toISOString() : null,
            };
        }));

        res.json({
            success: true,
            data: list
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching devices.'
        });
    }
};

const { createPairingSessions, fail } = require('../services/device/pairingSessions');
const pairingSessions = createPairingSessions();

const pairingError = (res, error) => res.status(error.status || 500).json({
    success: false,
    message: error.status ? error.message : 'Unable to pair this frame. Try again.',
});

const startPairing = async (req, res) => {
    let session;
    try {
        const { id } = req.body;
        if (typeof id !== 'string' || !/^\d{6}$/.test(id)) throw fail(400, 'Invalid device code');
        const device = await Device.findOne({ where: { publicId: id } });
        if (!device) throw fail(404, 'No device found with that id');
        const owner = await UserDeviceRole.findOne({ where: { deviceId: device.uuid, role: 'OWNER' } });
        if (owner) throw fail(409, 'This frame already has an owner');
        const client = tcpServer.getConnectedDevices().get(device.uuid);
        if (!client) throw fail(400, 'Device is offline. Please power it on and try again.');
        if (client.status && client.status !== 'idle') throw fail(409, 'Device is busy. Please try again later.');

        session = pairingSessions.begin(req.user.id, id, device.uuid);
        const buffer = await dither(await generateNumberImage(session.pin));
        pairingSessions.get(req.user.id, id, session.sessionId);
        await sendBuffer(client, buffer);
        pairingSessions.get(req.user.id, id, session.sessionId);
        session.state = 'ready';
        return res.json({ success: true, data: { id, sessionId: session.sessionId, expiresAt: session.expiresAt } });
    } catch (error) {
        if (session) pairingSessions.remove(session);
        return pairingError(res, error);
    }
};

const completePairing = async (req, res) => {
    let session;
    try {
        const { id, sessionId, pin } = req.body;
        session = pairingSessions.claim(req.user.id, id, sessionId, pin);
        const device = await Device.sequelize.transaction(async transaction => {
            const device = await Device.findOne({
                where: { uuid: session.deviceId }, transaction, lock: transaction.LOCK.UPDATE,
            });
            pairingSessions.get(req.user.id, id, sessionId);
            if (!device) throw fail(404, 'Device not found');
            const owner = await UserDeviceRole.findOne({
                where: { deviceId: device.uuid, role: 'OWNER' }, transaction,
            });
            if (owner) throw fail(409, 'This frame already has an owner');
            // Recheck after database waits, before granting ownership.
            pairingSessions.get(req.user.id, id, sessionId);
            await UserDeviceRole.create({ userId: req.user.id, deviceId: device.uuid, role: 'OWNER' }, { transaction });
            return device;
        });
        return res.json({ success: true, data: {
            id: device.publicId, uuid: device.uuid, name: device.name, lastSeen: device.lastSeen,
        } });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') error = fail(409, 'This frame already has an owner');
        return pairingError(res, error);
    } finally {
        if (session) pairingSessions.remove(session);
    }
};

const cancelPairing = async (req, res) => {
    try {
        pairingSessions.cancel(req.user.id, req.body.id, req.body.sessionId);
        return res.json({ success: true });
    } catch (error) {
        if (error.status === 410) return res.json({ success: true });
        return pairingError(res, error);
    }
};

const isUuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const findDeviceById = async (id) => {
    if (!id) return null;
    const where = isUuid(id)
        ? { [Op.or]: [{ publicId: id }, { uuid: id }] }
        : { publicId: id };

    return Device.findOne({ where });
};

const deleteDevice = async (req, res) => {
    try {
        const { id } = req.body;
        const device = await findDeviceById(id);
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        await device.destroy();
        return res.json({ success: true });
    } catch (error) {
        console.error('Error deleting device:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete device' });
    }
};

const unlinkDevice = async (req, res) => {
    try {
        const { id } = req.body;
        const { id: userId } = req.user;

        const device = await findDeviceById(id);
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        const link = await UserDeviceRole.findOne({
            where: { userId, deviceId: device.uuid }
        });

        if (!link) {
            return res.status(404).json({ success: false, message: 'You do not have this frame linked' });
        }

        await link.destroy();

        // If no other users are linked to this device, clear its state so it stops updating.
        const remainingLinks = await UserDeviceRole.count({ where: { deviceId: device.uuid } });
        if (remainingLinks === 0) {
            const state = await getOrCreateDeviceState(device.uuid);
            state.albumId = null;
            state.nextPhotoId = null;
            state.currentPhotoId = null;
            state.nextUpdateAt = null;
            await state.save();
            console.log("[device:unlink] cleared device state after unlink", { deviceId: device.uuid });
        }

        return res.json({ success: true });
    } catch (error) {
        console.error('Error unlinking device:', error);
        return res.status(500).json({ success: false, message: 'Failed to unlink device' });
    }
};

const rebootDevice = async (req, res) => {
    try {
        const { id } = req.body;
        const device = await findDeviceById(id);
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        const client = tcpServer.getConnectedDevices().get(device.uuid);
        if (!client) {
            return res.status(400).json({ success: false, message: 'Device is offline' });
        }

        // Placeholder reboot command (if supported by device firmware)
        client.send([0x30]); // e.g., 0x30 = reboot
        return res.json({ success: true });
    } catch (error) {
        console.error('Error rebooting device:', error);
        return res.status(500).json({ success: false, message: 'Failed to reboot device' });
    }
};

const getDeviceLogs = async (req, res) => {
    try {
        const { id } = req.body;
        const device = await findDeviceById(id);
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        // Logs are not stored yet; return placeholder
        return res.json({
            success: true,
            data: {
                logs: `No logs available for device ${device.publicId || device.uuid}.`
            }
        });
    } catch (error) {
        console.error('Error fetching device logs:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch device logs' });
    }
};

// Update frame metadata, schedule, and album selection; schedule immediate push when album changes.
const updateDeviceSettings = async (req, res) => {
    try {
        const { id, name, schedule, albumId } = req.body;

        if (!id) {
            return res.status(400).json({ success: false, message: "Device id is required" });
        }

        const device = await findDeviceById(id);

        if (!device) {
            return res.status(404).json({ success: false, message: "Device not found" });
        }

        const { id: userId } = req.user;

        const link = await UserDeviceRole.findOne({
            where: { userId, deviceId: device.uuid }
        });

        if (!link || link.role === 'READ') {
            return res.status(403).json({ success: false, message: "You do not have access to this frame" });
        }

        if (albumId && (!isUuid(albumId) || !await getDeviceAlbum(device.uuid, albumId, userId))) {
            return res.status(403).json({ success: false, message: "You do not have access to this album" });
        }

        if (name && name !== device.name) {
            await device.update({ name });
        }

        console.log("[device:update] request", {
            userId,
            deviceId: device.uuid,
            publicId: device.publicId,
            nameChanged: name && name !== device.name,
            scheduleProvided: !!schedule,
            albumId,
        });

        let state = await getOrCreateDeviceState(device.uuid);
        const previousAlbumId = state.albumId;

        if (schedule && device.uuid) {
            console.log("[device:update] applying schedule", {
                deviceId: device.uuid,
                mode: schedule.mode,
                intervalMinutes: schedule.intervalMinutes,
                timesOfDay: schedule.timesOfDay,
            });

            state = await setDeviceSchedule(device.uuid, {
                mode: schedule.mode,
                intervalMinutes: schedule.intervalMinutes,
                timesOfDay: Array.isArray(schedule.timesOfDay) ? schedule.timesOfDay : [],
            });
        }

        if (albumId !== undefined) {
            state.albumId = albumId || null;
            await state.save();
            console.log("[device:update] set album", { deviceId: device.uuid, albumId: state.albumId });
        }

        const albumChanged = previousAlbumId !== state.albumId;

        if (!state.nextPhotoId || albumChanged) {
            state = await ensureNextPlannedPhoto(device.uuid);
            console.log("[device:update] planned next photo", {
                deviceId: device.uuid,
                nextPhotoId: state?.nextPhotoId || null,
            });
        }

        if (albumChanged) {
            const client = tcpServer.getConnectedDevices().get(device.uuid);
            if (client) {
                // Fire-and-forget to keep the HTTP response fast; queueing and state updates happen in the task.
                // The underlying enqueueTask ensures we only send when the device is idle and deduplicates redundant sends.
                pushNextPhotoToDevice(device.uuid, client)
                    .then((nextState) => {
                        // Best-effort logging so we can trace async delivery without blocking the caller.
                        console.log("[device:update] pushed new album image asynchronously", {
                            deviceId: device.uuid,
                            currentPhotoId: nextState?.currentPhotoId || null,
                            nextPhotoId: nextState?.nextPhotoId || null,
                        });
                    })
                    .catch((err) => {
                        console.warn("[device:update] failed to push image after album change", {
                            deviceId: device.uuid,
                            error: err?.message,
                        });
                    });
            } else {
                console.log("[device:update] device offline; will update on next schedule", {
                    deviceId: device.uuid,
                });
            }
        }

        // Reload state so we return the freshest values (e.g., currentPhotoId after an async push).
        const responseState = await getOrCreateDeviceState(device.uuid);

        const albumView = await getAlbumView(responseState, userId);

        res.json({
            success: true,
            data: {
                id: device.publicId,
                name: device.name,
                nextUpdate: device.uuid ? await getNextUpdateLabel(device.uuid) : "update now",
                nextUpdateAt: responseState?.nextUpdateAt ? new Date(responseState.nextUpdateAt).toISOString() : null,
                ...albumView,
                scheduleMode: responseState?.scheduleMode || null,
                intervalMinutes: responseState?.intervalMinutes || null,
                timesOfDay: responseState?.timesOfDay || [],
            },
        });
    } catch (err) {
        console.error("Error updating device settings", err);
        res.status(500).json({ success: false, message: "Failed to update device settings" });
    }
};

// Lightweight status probe used by the client UI.
const getDeviceStatus = async (req, res) => {
    try {
        const { id } = req.query;
        const device = await Device.findOne({ where: { publicId: id } });
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        const client = tcpServer.getConnectedDevices().get(device.uuid);
        if (!client) {
            return res.status(400).json({ success: false, message: 'Device is offline', data: { status: 'offline' } });
        }

        return res.json({ success: true, data: { status: client.status || 'idle' } });
    } catch (error) {
        console.error('Error fetching device status:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch device status' });
    }
};

// Receive a firmware binary (raw octet-stream or base64 JSON) and push it to the device over TCP.
const uploadFirmware = async (req, res) => {
    try {
        const { id: idQuery, filename: filenameQuery } = req.query || {};
        const { id: idBody, filename: filenameBody, data } = req.body || {};
        const id = idQuery || idBody;
        const filename = filenameQuery || filenameBody;

        // Prefer raw binary when content-type is octet-stream; fallback to base64 JSON for backward compatibility.
        let buffer;
        if (req.is('application/octet-stream') && Buffer.isBuffer(req.body)) {
            buffer = req.body;
        } else if (data) {
            buffer = Buffer.from(data, 'base64');
        }

        if (!id || !buffer) {
            return res.status(400).json({ success: false, message: 'Device id and firmware binary are required' });
        }

        const MAX_BYTES = 2_000_000; // ~2MB safeguard for ESP8266 sketch space
        if (buffer.length === 0 || buffer.length > MAX_BYTES) {
            return res.status(400).json({ success: false, message: `Firmware size must be between 1 byte and ${MAX_BYTES} bytes` });
        }

        const device = await findDeviceById(id);
        if (!device) {
            return res.status(404).json({ success: false, message: 'Device not found' });
        }

        const client = tcpServer.getConnectedDevices().get(device.uuid);
        if (!client) {
            return res.status(400).json({ success: false, message: 'Device is offline' });
        }
        if (client.status && client.status !== 'idle') {
            return res.status(409).json({ success: false, message: `Device is busy (${client.status}). Try again when idle.` });
        }

        const safeName = filename ? filename.replace(/[^a-zA-Z0-9_.-]/g, '_') : 'firmware.bin';
        const tempPath = path.join(os.tmpdir(), `${device.uuid}-${Date.now()}-${safeName}`);

        await fs.writeFile(tempPath, buffer);

        try {
            const result = await sendFirmware(client, tempPath);
            return res.json({ success: true, data: { bytesSent: result?.bytesSent ?? buffer.length } });
        } finally {
            fs.unlink(tempPath).catch(() => {});
        }
    } catch (error) {
        console.error('Error uploading firmware:', error);
        return res.status(500).json({ success: false, message: 'Failed to push firmware to device' });
    }
};


module.exports = {
    createDevice,
    getUserDevices,
    getAllDevices,
    startPairing,
    completePairing,
    cancelPairing,
    deleteDevice,
    unlinkDevice,
    rebootDevice,
    getDeviceLogs,
    getDeviceStatus,
    updateDeviceSettings,
    uploadFirmware,
}
