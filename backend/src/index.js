const express = require('express');
const bodyParser = require('body-parser');
const { connectDB } = require('./config/db');
const { register } = require('../src/controller/userController')
require('dotenv').config();

const app = express();
const router = express.Router();

app.use(bodyParser.json());
app.use('/api', router);

router.post('/register', register);

connectDB();

const port = process.env.PORT || 7734;

if (process.env.NODE_ENV !== "test") {
    app.listen(port, () => console.log("[backend]: Application Started on", port));
}

module.exports = app;