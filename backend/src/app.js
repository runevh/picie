const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const apiRouter = require('./routes');

const createApp = () => {
    const app = express();

    app.use(cors({
        origin: (origin, callback) => {
            callback(null, true);
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true,
    }));

    app.use('/api/photo/upload', express.json({ limit: '10mb' }));
    app.use(cookieParser());
    app.use(bodyParser.json({ limit: '20mb' }));

    app.use('/api', apiRouter);

    return app;
};

module.exports = createApp;
