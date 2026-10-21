const http = require('http');
const { start } = require('../src/start');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function dependencies(initialize) {
    return { app: (_req, res) => res.end('ready'), port: 0, initialize,
        database: { close: jest.fn().mockResolvedValue() },
        tcp: { start: jest.fn().mockResolvedValue(), stop: jest.fn().mockResolvedValue() },
        schedule: jest.fn(() => jest.fn().mockResolvedValue()),
    };
}
test('waits for initialization before opening listeners or scheduling work', async () => {
    const initialization = deferred();
    const deps = dependencies(() => initialization.promise);
    const listen = jest.spyOn(http.Server.prototype, 'listen');
    const starting = start(deps);
    expect(listen).not.toHaveBeenCalled();
    expect(deps.tcp.start).not.toHaveBeenCalled();
    expect(deps.schedule).not.toHaveBeenCalled();
    initialization.resolve();
    const application = await starting;
    expect(listen).toHaveBeenCalledTimes(1);
    expect(deps.schedule).toHaveBeenCalledTimes(1);
    await application.stop();
    await application.stop();
    expect(deps.database.close).toHaveBeenCalledTimes(1);
    listen.mockRestore();
});
test('failed initialization leaves no listeners or scheduler', async () => {
    const deps = dependencies(async () => { throw Error('database unavailable'); });
    await expect(start(deps)).rejects.toThrow('database unavailable');
    expect(deps.tcp.start).not.toHaveBeenCalled();
    expect(deps.schedule).not.toHaveBeenCalled();
    expect(deps.database.close).toHaveBeenCalled();
});
test('listener startup failure cleans up initialized resources', async () => {
    const deps = dependencies(async () => {});
    deps.tcp.start.mockRejectedValue(Error('port busy'));
    await expect(start(deps)).rejects.toThrow('port busy');
    expect(deps.tcp.stop).toHaveBeenCalled();
    expect(deps.database.close).toHaveBeenCalled();
    expect(deps.schedule).not.toHaveBeenCalled();
});
test('importing the production app does not initialize a database or listen', () => {
    jest.isolateModules(() => {
        const { Sequelize, Model } = require('sequelize');
        const sync = jest.spyOn(Sequelize.prototype, 'sync');
        const modelSync = jest.spyOn(Model, 'sync');
        const authenticate = jest.spyOn(Sequelize.prototype, 'authenticate');
        const listen = jest.spyOn(require('net').Server.prototype, 'listen');
        const interval = jest.spyOn(global, 'setInterval');
        require('../src/index');
        for (const spy of [sync, modelSync, authenticate, listen, interval]) {
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        }
    });
});
