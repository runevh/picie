const http = require('http');

async function start({ app, database, initialize, tcp, schedule, port = process.env.PORT || 7734, host }) {
    const server = http.createServer(app);
    let stopScheduler;
    let stopped = false;
    const stop = async () => {
        if (stopped) return;
        stopped = true;
        const closingHttp = new Promise(resolve => {
            server.close(resolve);
            server.closeAllConnections();
        });
        await tcp.stop();
        if (stopScheduler) await stopScheduler();
        await closingHttp;
        await database.close();
    };
    try {
        await initialize();
        await tcp.start();
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(port, host, () => {
                server.removeListener('error', reject);
                resolve();
            });
        });
        stopScheduler = schedule(tcp);
        return { server, stop };
    } catch (error) {
        await stop();
        throw error;
    }
}
module.exports = { start };
