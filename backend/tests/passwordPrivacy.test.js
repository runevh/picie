jest.mock('../src/config/db', () => {
  const { Sequelize } = require('sequelize');
  return { sequelize: new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false }) };
});

const { sequelize } = require('../src/config/db');
const User = require('../src/models/user');
const bcrypt = require('bcryptjs');
const { register, login, fetchUser } = require('../src/controller/userController');
const previousSecret = process.env.JWT_SECRET;
const profile = { username: 'alice', email: 'alice@example.test', firstName: 'Alice', lastName: 'User' };

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = JSON.parse(JSON.stringify(body)); return this; },
    cookie: jest.fn(),
  };
}

beforeAll(() => { process.env.JWT_SECRET = 'synthetic-password-test-secret'; });
beforeEach(async () => { await sequelize.sync({ force: true }); });
afterEach(() => { jest.restoreAllMocks(); });
afterAll(async () => {
  await sequelize.close();
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
});

describe('registration passwords', () => {
  test.each([
    ['missing', undefined], ['null', null], ['number', 123456], ['object', {}], ['array', ['secret']],
    ['empty', ''], ['blank', '      '], ['too short', 'abcde'],
    ['too few Unicode characters', '😀'.repeat(3)],
    ['over 72 bytes', 'a'.repeat(73)], ['over 72 UTF-8 bytes', 'é'.repeat(37)],
  ])('rejects %s before hashing or creating an account', async (_, password) => {
    const hash = jest.spyOn(bcrypt, 'hash');
    const create = jest.spyOn(User, 'create');
    const res = response();
    await register({ body: { ...profile, password } }, res);
    expect(res.statusCode).toBe(400);
    expect(hash).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(await User.count()).toBe(0);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  test.each(['abcdef', 'a'.repeat(72), 'é'.repeat(36), '😀'.repeat(18), '  secret  '])(
    'accepts a valid password without modifying it (%#)', async password => {
      const res = response();
      await register({ body: { ...profile, password } }, res);
      expect(res.statusCode).toBe(200);
      const user = await User.findOne();
      expect(await bcrypt.compare(password, user.password)).toBe(true);
      expect(JSON.stringify(res.body)).not.toContain(user.password);
      const loggedIn = response();
      await login({ body: { username: profile.username, password } }, loggedIn);
      expect(loggedIn.statusCode).toBe(200);
      expect(loggedIn.body.success).toBe(true);
    });
});

describe('public account responses', () => {
  test('registration, login and account lookup expose only safe user fields', async () => {
    const registration = response();
    await register({ body: { ...profile, password: 'synthetic-password' } }, registration);
    const user = await User.findOne();
    const loggedIn = response();
    await login({ body: { username: profile.username, password: 'synthetic-password' } }, loggedIn);
    const account = response();
    await fetchUser({ user: { id: user.id } }, account);
    const expected = { ...profile, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString() };
    expect(registration.statusCode).toBe(200);
    expect(loggedIn.statusCode).toBe(200);
    expect(account.statusCode).toBe(200);
    for (const body of [registration.body.user, loggedIn.body.user, account.body.data]) {
      expect(body).toEqual(expected);
      expect(body).not.toHaveProperty('password');
      expect(JSON.stringify(body)).not.toContain(user.password);
    }
  });

  test('administrator responses retain the admin flag without exposing password hashes', async () => {
    const user = await User.create({ ...profile, password: 'synthetic-password', admin: true });
    const loggedIn = response();
    await login({ body: { username: profile.username, password: 'synthetic-password' } }, loggedIn);
    const account = response();
    await fetchUser({ user: { id: user.id } }, account);
    for (const body of [loggedIn.body.user, account.body.data]) {
      expect(body.admin).toBe(true);
      expect(body).not.toHaveProperty('password');
      expect(JSON.stringify(body)).not.toContain(user.password);
    }
  });

  test('login rejects passwords that would be truncated to a matching prefix', async () => {
    await User.create({ ...profile, password: 'a'.repeat(72) });
    const res = response();
    await login({ body: { username: profile.username, password: 'a'.repeat(72) + 'different' } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.cookie).not.toHaveBeenCalled();
  });
});
