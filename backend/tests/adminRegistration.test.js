// Real controller, password hashing, JWTs, and models with disposable SQLite.
jest.mock('../src/config/db', () => {
  const { Sequelize } = require('sequelize');
  return { sequelize: new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false }) };
});

const { sequelize } = require('../src/config/db');
const User = require('../src/models/user');
const { register, login } = require('../src/controller/userController');
const { admin } = require('../src/middleware/auth');
const previousSecret = process.env.JWT_SECRET;

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    cookie: jest.fn(),
  };
}

async function signup(username, extra = {}) {
  const res = response();
  await register({ body: { username, email: `${username}@example.test`,
    firstName: 'Test', lastName: 'User', password: 'synthetic-password', ...extra } }, res);
  expect(res.statusCode).toBe(200);
  return User.findOne({ where: { username } });
}

beforeAll(() => { process.env.JWT_SECRET = 'synthetic-registration-test-secret'; });
beforeEach(async () => { await sequelize.sync({ force: true }); });
afterEach(() => { User.removeHook('beforeCreate', 'concurrent-registration'); });
afterAll(async () => {
  await sequelize.close();
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
});

describe('registration privileges', () => {
  test('the first public account is not an administrator', async () => {
    const user = await signup('alice');
    expect(user.admin).toBe(false);
    const res = response();
    const next = jest.fn();
    await admin({ user: { id: user.id } }, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('concurrent registrations against an empty database create no administrators', async () => {
    // Hold both inserts until both requests have passed the registration checks.
    let arrivals = 0;
    let release;
    const ready = new Promise(resolve => { release = resolve; });
    User.addHook('beforeCreate', 'concurrent-registration', async () => {
      if (++arrivals === 2) release();
      await ready;
    });
    const users = await Promise.all([signup('alice'), signup('bob')]);
    expect(users.map(user => user.admin)).toEqual([false, false]);
    expect(await User.count({ where: { admin: true } })).toBe(0);
  });

  test('ignores an administrator flag supplied in the registration request', async () => {
    const user = await signup('alice', { admin: true });
    expect(user.admin).toBe(false);
  });

  test('regular accounts can still log in', async () => {
    await signup('alice');
    const res = response();
    await login({ body: { username: 'alice', password: 'synthetic-password' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.cookie).toHaveBeenCalledWith('jwt', expect.any(String), expect.any(Object));
  });
});

describe('operator administrator provisioning', () => {
  const { promoteAdmin } = require('../scripts/promote-admin');

  test('promotes only the selected account without changing its password', async () => {
    const alice = await signup('alice');
    const bob = await signup('bob');
    const password = alice.password;
    const result = await promoteAdmin(sequelize, alice.email);
    expect(result).toEqual({ id: alice.id, email: alice.email });
    await alice.reload();
    await bob.reload();
    expect(alice.admin).toBe(true);
    expect(alice.password).toBe(password);
    expect(bob.admin).toBe(false);
    const next = jest.fn();
    await admin({ user: { id: alice.id } }, response(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('repeating promotion is safe and does not grant privileges to new registrations', async () => {
    const alice = await signup('alice');
    await promoteAdmin(sequelize, alice.email);
    await promoteAdmin(sequelize, alice.email);
    expect((await signup('bob')).admin).toBe(false);
    expect(await User.count({ where: { admin: true } })).toBe(1);
  });

  test('fails for an unknown account without creating one', async () => {
    await expect(promoteAdmin(sequelize, 'missing@example.test')).rejects.toThrow('Account not found');
    expect(await User.count()).toBe(0);
  });

  test.each([undefined, '', 'invalid', "' OR 1=1 --"])(
    'rejects invalid email %p without changing privileges', async email => {
      await signup('alice');
      await expect(promoteAdmin(sequelize, email)).rejects.toThrow('exact email address');
      expect(await User.count({ where: { admin: true } })).toBe(0);
    });
});
