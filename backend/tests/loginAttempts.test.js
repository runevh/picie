jest.mock('../src/models/user', () => ({ findOne: jest.fn() }));
jest.mock('bcryptjs', () => ({ compare: jest.fn(), truncates: () => false }));
const User = require('../src/models/user');
const bcrypt = require('bcryptjs');
const { login } = require('../src/controller/userController');
const { createLoginAttempts } = require('../src/services/auth/loginAttempts');
let now = Date.now();
const previousSecret = process.env.JWT_SECRET;
const attempt = async (username = 'alice', peer = '127.0.0.1', headers = {}) => {
    const res = { statusCode: 200, headers: {}, cookie: jest.fn(),
        status(code) { this.statusCode = code; return this; },
        set(key, value) { this.headers[key] = value; return this; },
        json(body) { this.body = body; return this; },
    };
    await login({ body: { username, password: 'synthetic-password' }, socket: { remoteAddress: peer }, headers }, res);
    return res;
};
beforeEach(() => {
    now += 300001;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    jest.clearAllMocks();
    User.findOne.mockResolvedValue({ id: 1, username: 'alice', password: 'synthetic-hash' });
    bcrypt.compare.mockResolvedValue(false);
    process.env.JWT_SECRET = 'synthetic-test-secret';
});
afterEach(() => jest.restoreAllMocks());
afterAll(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
});
test('blocks repeated guesses before lookup and password hashing', async () => {
    for (let i = 0; i < 10; i++) expect((await attempt()).statusCode).toBe(400);
    const res = await attempt();
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBe('300');
    expect(User.findOne).toHaveBeenCalledTimes(10);
    expect(bcrypt.compare).toHaveBeenCalledTimes(10);
});
test('unknown accounts have the same limit and recover after the window', async () => {
    User.findOne.mockResolvedValue(null);
    for (let i = 0; i < 10; i++) await attempt();
    expect((await attempt()).statusCode).toBe(429);
    now += 300000;
    expect((await attempt()).statusCode).toBe(400);
    expect(bcrypt.compare).not.toHaveBeenCalled();
});
test('email and username cannot bypass the account budget across clients', async () => {
    for (let i = 0; i < 10; i++) await attempt(i % 2 ? 'alice' : 'alice@example.test', `client-${i}`);
    expect((await attempt('alice@example.test', 'another-client')).statusCode).toBe(429);
    expect(bcrypt.compare).toHaveBeenCalledTimes(10);
});
test('client limit covers changing identifiers and ignores spoofed forwarded headers', async () => {
    User.findOne.mockResolvedValue(null);
    for (let i = 0; i < 60; i++) await attempt(`unknown-${i}`, 'peer', { 'x-forwarded-for': `spoof-${i}` });
    expect((await attempt('new-name', 'peer', { 'x-forwarded-for': 'new-peer' })).statusCode).toBe(429);
    expect(User.findOne).toHaveBeenCalledTimes(60);
    expect((await attempt('new-name', 'different-peer')).statusCode).toBe(400);
});
test('valid login works after throttling expires without permanent lockout', async () => {
    for (let i = 0; i < 10; i++) await attempt();
    bcrypt.compare.mockResolvedValue(true);
    expect((await attempt()).statusCode).toBe(429);
    now += 300000;
    const res = await attempt();
    expect(res.body.success).toBe(true);
    expect(res.cookie).toHaveBeenCalledWith('jwt', expect.any(String), expect.objectContaining({ httpOnly: true }));
});
test('bounds memory without evicting active attempt budgets', () => {
    const consume = createLoginAttempts({ maxEntries: 2 });
    expect(consume([['a', 1], ['b', 1]])).toBe(0);
    expect(consume([['c', 1]])).toBe(300);
    expect(consume([['a', 1]])).toBe(300);
    now += 300000;
    expect(consume([['c', 1]])).toBe(0);
});
