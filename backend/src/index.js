const express = require('express');
const bodyParser = require('body-parser');
const { connectDB } = require('./config/db');
const { register, login, fetchUser, logout } = require('../src/controller/userController');
const { createDevice, getAllDevices, startClaimDevice, getUserDevices } = require('../src/controller/deviceController')
const { auth, admin } = require('../src/middleware/auth');
const { savePhoto, getPhoto, createPhotoCollage, getPhotoCollages, savePhotoCollage } = require('./controller/photoController');
const cors = require('cors');
const cookieParser = require("cookie-parser");

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
router.post('/photo/collage/create', auth, createPhotoCollage);
router.post('/photo/collage/save', auth, savePhotoCollage);
router.get('/photo/collage/get', auth, getPhotoCollages);
router.get('/photo/get/:id.png', auth, getPhoto);

router.post('/device/create', auth, admin, createDevice);
router.get('/device/all/admin', auth, admin, getAllDevices);
router.get('/device/all', auth, getUserDevices);
router.post('/device/claim/start', auth, startClaimDevice);

connectDB();

const port = process.env.PORT || 7734;

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => console.log("[backend]: Application Started on", port));
}

module.exports = app;