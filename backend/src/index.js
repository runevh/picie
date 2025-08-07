const express = require('express');
const bodyParser = require('body-parser');
const { connectDB } = require('./config/db');
const { register, login, fetchUser, logout } = require('../src/controller/userController');
const { createDevice, getAllDevices, startPairing, getUserDevices } = require('../src/controller/deviceController')
const { auth, admin } = require('../src/middleware/auth');
const http = require('http');
const { savePhoto, getPhoto, getAlbums, savePhotoCollage, createAlbum } = require('./controller/photoController');
const cors = require('cors');
const cookieParser = require("cookie-parser");
const tcpServer = require('./services/tcpServer');
const generateNumberImage = require("./services/photo/pinImageGenerator");

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

/*app.use('/api/photo/upload', express.raw({
  type: 'image/*',
  limit: '10mb',
}));*/
app.use('/api/photo/upload', express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(bodyParser.json());
app.use('/api', router);

router.post('/register', register);
router.post('/login', login);
router.get('/auth', auth, fetchUser);
router.post('/logout', auth, logout);

router.post('/photo/upload', auth, savePhoto);
router.post('/photo/albums/create', auth, createAlbum);
router.post('/photo/albums/save', auth, savePhotoCollage);
router.get('/photo/albums/get', auth, getAlbums);
router.get('/photo/get/:id.png', auth, getPhoto);

router.post('/device/create', auth, admin, createDevice);
router.get('/device/all/admin', auth, admin, getAllDevices);
router.get('/device/all', auth, getUserDevices);
router.post('/device/pairing/start', auth, startPairing);
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

// Poll loop
/*setInterval(() => {
  const devices = tcpServer.getConnectedDevices();

  console.log(`Polling ${devices.size} devices...`);

  for (const [uuid, connection] of devices.entries()) {
    //sendImage(connection);
  }
}, 1000);*/

module.exports = {app};