const express = require('express');
const bodyParser = require('body-parser');
const { connectDB } = require('./config/db');
const { register, login, fetchUser, logout, updateProfile } = require('../src/controller/userController');
const { createDevice, getAllDevices, startPairing, completePairing, cancelPairing, getUserDevices, deleteDevice, unlinkDevice, rebootDevice, getDeviceLogs, getDeviceStatus, updateDeviceSettings, uploadFirmware } = require('../src/controller/deviceController')
const { auth, admin } = require('../src/middleware/auth');
const http = require('http');
const { savePhoto, getPhoto, getAlbums, savePhotoCollage, createAlbum, deletePhotos, deleteAlbum } = require('./controller/photoController');
const cors = require('cors');
const cookieParser = require("cookie-parser");
const tcpServer = require('./services/tcpServer');
const generateNumberImage = require("./services/photo/pinImageGenerator");
const { startUpdateScheduler } = require("./schedules/updateScheduler");

const { sendImage } = require("./services/photo/imageSender")

require('dotenv').config();

const app = express();
const router = express.Router();

// Setup middleware
app.use(cors({
  origin: (origin, callback) => {
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

app.use('/api/photo/upload', express.json({ limit: '10mb' }));
app.use(cookieParser());
// Accept raw binary firmware uploads (preferred) before JSON parsing.
app.use('/api/device/firmware', express.raw({ type: 'application/octet-stream', limit: '5mb' }));
// Allow larger JSON payloads for legacy base64 uploads.
app.use(bodyParser.json({ limit: '5mb' }));
app.use('/api', router);

router.post('/register', register);
router.post('/login', login);
router.get('/auth', auth, fetchUser);
router.post('/logout', auth, logout);
router.post('/user/update', auth, updateProfile);

router.post('/photo/upload', auth, savePhoto);
router.post('/photo/albums/create', auth, createAlbum);
router.post('/photo/albums/save', auth, savePhotoCollage);
router.get('/photo/albums/get', auth, getAlbums);
router.post('/photo/albums/delete', auth, deleteAlbum);
router.get('/photo/get/:id.png', auth, getPhoto);
router.post('/photo/delete', auth, deletePhotos);

router.post('/device/create', auth, admin, createDevice);
router.get('/device/all/admin', auth, admin, getAllDevices);
router.get('/device/all', auth, getUserDevices);
router.post('/device/pairing/start', auth, startPairing);
router.post('/device/claim/end', auth, completePairing);
router.post('/device/pairing/cancel', auth, cancelPairing);
router.get('/device/status', auth, getDeviceStatus);
router.post('/device/unlink', auth, unlinkDevice);
router.post('/device/delete', auth, admin, deleteDevice);
router.post('/device/reboot', auth, admin, rebootDevice);
router.post('/device/logs', auth, admin, getDeviceLogs);
router.post('/device/update', auth, updateDeviceSettings);
router.post('/device/firmware', auth, admin, uploadFirmware);
router.post('/device/set', auth, admin, (req, res) => {
  const firstEntry = tcpServer.getConnectedDevices().entries().next().value;
  const [, client] = firstEntry; // destructure to get the client instance
  sendImage(client);
})

const port = process.env.PORT || 7734;

connectDB();

generateNumberImage("0000", './number.png').catch(console.error);

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => console.log("[backend]: Application Started on", port));
}

// Start background scheduler to decide when images should update.
startUpdateScheduler(tcpServer);

// Poll loop
/*setInterval(() => {
  const devices = tcpServer.getConnectedDevices();

  console.log(`Polling ${devices.size} devices...`);

  for (const [uuid, connection] of devices.entries()) {
    //sendImage(connection);
  }
}, 1000);*/

module.exports = {app};
