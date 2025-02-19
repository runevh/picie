const express = require('express');
const bodyParser = require('body-parser');
const { connectDB } = require('./config/db');
const { register, login, fetchUser, logout } = require('../src/controller/userController')
const { auth } = require('../src/middleware/auth');
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
app.use(cookieParser());
app.use(bodyParser.json());
app.use('/api', router);


router.post('/register', register);
router.post('/login', login);
router.get('/auth', auth, fetchUser);
router.post('/logout', auth, logout);

connectDB();

const port = process.env.PORT || 7734;

if (process.env.NODE_ENV !== "test") {
    app.listen(port, () => console.log("[backend]: Application Started on", port));
}

module.exports = app;