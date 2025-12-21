const { Router } = require('express');

const { createDevice, getAllDevices, getUserDevices, startPairing, completePairing, cancelPairing, triggerFramePreview, deleteDevice, unlinkDevice, rebootDevice, getDeviceLogs, getDeviceStatus, updateDeviceSettings } = require('../controller/deviceController');
const { auth, admin } = require('../middleware/auth');

const router = Router();

router.post('/create', auth, admin, createDevice);
router.get('/all/admin', auth, admin, getAllDevices);
router.get('/all', auth, getUserDevices);
router.post('/pairing/start', auth, startPairing);
router.post('/claim/end', auth, completePairing);
router.post('/pairing/cancel', auth, cancelPairing);
router.get('/status', auth, getDeviceStatus);
router.post('/unlink', auth, unlinkDevice);
router.post('/set', auth, admin, triggerFramePreview);
router.post('/delete', auth, admin, deleteDevice);
router.post('/reboot', auth, admin, rebootDevice);
router.post('/logs', auth, admin, getDeviceLogs);
router.post('/update', auth, updateDeviceSettings);

module.exports = router;
