require('dotenv').config();
const createApp = require('./app');
const { sequelize, connectDB } = require('./config/db');
const tcpServer = require('./services/tcpServer');
const { startUpdateScheduler } = require('./schedules/updateScheduler');
const { start } = require('./start');

// Loading the shared app registers every model before initialization begins.
const app = createApp();
const startApplication = () => start({
    app, database: sequelize, initialize: connectDB, tcp: tcpServer, schedule: startUpdateScheduler,
});

if (require.main === module) {
    startApplication().then(({ stop }) => {
        for (const signal of ['SIGINT', 'SIGTERM']) {
            process.once(signal, () => stop().catch(error => {
                console.error(error);
                process.exitCode = 1;
            }));
        }
    }).catch(error => {
        console.error('Startup failed:', error.message);
        process.exitCode = 1;
    });
}

module.exports = { app, startApplication };
