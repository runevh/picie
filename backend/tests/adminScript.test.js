jest.mock('dotenv', () => ({ config: jest.fn() }));
jest.mock('sequelize', () => {
    const actual = jest.requireActual('sequelize');
    return { ...actual, Sequelize: jest.fn() };
});
const { Sequelize, QueryTypes } = require('sequelize');
const dotenv = require('dotenv');
const { main, promoteAdmin } = require('../scripts/promote-admin');
const previousArgv = process.argv;
const names = ['POSTGRES_HOST', 'POSTGRES_NAME', 'POSTGRES_USER', 'POSTGRES_PASSWORD'];
const previousEnv = Object.fromEntries(names.map(name => [name, process.env[name]]));
let database;

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    database = { query: jest.fn().mockResolvedValue([{ id: 'synthetic-id', email: 'owner@example.test' }]),
        close: jest.fn().mockResolvedValue() };
    Sequelize.mockImplementation(() => database);
    process.argv = ['node', 'promote-admin.js', 'owner@example.test'];
    delete process.env.POSTGRES_HOST;
    process.env.POSTGRES_NAME = 'test-database';
    process.env.POSTGRES_USER = 'test-user';
    process.env.POSTGRES_PASSWORD = 'synthetic-password';
});
afterEach(() => {
    process.argv = previousArgv;
    for (const name of names) {
        if (previousEnv[name] === undefined) delete process.env[name];
        else process.env[name] = previousEnv[name];
    }
    jest.restoreAllMocks();
});

test.each([[[]], [['owner@example.test', 'extra']]])('invalid command arguments %p never initialize a connection', async args => {
    process.argv = ['node', 'promote-admin.js', ...args];
    await expect(main()).rejects.toThrow('Usage:');
    expect(dotenv.config).not.toHaveBeenCalled();
    expect(Sequelize).not.toHaveBeenCalled();
});

test.each([undefined, 'localhost'])('promotion uses configured database and host %p, then closes it', async host => {
    if (host) process.env.POSTGRES_HOST = host;
    await main();
    expect(dotenv.config).toHaveBeenCalledTimes(1);
    expect(Sequelize).toHaveBeenCalledWith('test-database', 'test-user', 'synthetic-password',
        { host: host || 'db', dialect: 'postgres', logging: false });
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining('WHERE "email" = $email'),
        { bind: { email: 'owner@example.test' }, type: QueryTypes.SELECT });
    expect(console.log).toHaveBeenCalledWith('Administrator enabled for owner@example.test');
    expect(database.close).toHaveBeenCalledTimes(1);
});

test.each(['invalid email', 'missing account', 'database failure'])('%s closes the connection without announcing success', async failure => {
    if (failure === 'invalid email') process.argv[2] = 'invalid';
    if (failure === 'missing account') database.query.mockResolvedValue([]);
    if (failure === 'database failure') database.query.mockRejectedValue(new Error('Database unavailable'));
    await expect(main()).rejects.toThrow();
    expect(database.close).toHaveBeenCalledTimes(1);
    expect(console.log).not.toHaveBeenCalled();
    if (failure === 'invalid email') expect(database.query).not.toHaveBeenCalled();
});

test('email is a bound parameter, not interpolated into SQL', async () => {
    const email = "o'connor@example.test";
    await promoteAdmin(database, email);
    const [sql, options] = database.query.mock.calls[0];
    expect(sql).not.toContain(email);
    expect(options.bind).toEqual({ email });
});
