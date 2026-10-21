// Exercise the production Express app while isolating startup and persistence.
jest.mock('../src/config/db', () => {
    const { Sequelize } = require('sequelize');
    return {
        sequelize: new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false }),
        connectDB: jest.fn().mockResolvedValue(undefined),
    };
});
jest.mock('../src/services/tcpServer', () => ({ getConnectedDevices: () => new Map() }));
jest.mock('../src/services/photo/pinImageGenerator', () => jest.fn().mockResolvedValue(undefined));
jest.mock('../src/schedules/updateScheduler', () => ({
    ...jest.requireActual('../src/schedules/updateScheduler'),
    startUpdateScheduler: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'synthetic-profile-test-secret';
const { sequelize } = require('../src/config/db');
const User = require('../src/models/user');
const { Album, Photo } = require('../src/models/photo');
const importSync = jest.spyOn(require('sequelize').Model, 'sync').mockResolvedValue(undefined);
const { app } = require('../src/index');
importSync.mockRestore();
let alice, bob, cookie;
beforeAll(async () => {
    await sequelize.sync({ force: true });
    alice = await User.create({ username: 'alice', email: 'alice@example.test', password: 'synthetic-password', firstName: 'Alice', lastName: 'Test' });
    bob = await User.create({ username: 'bob', email: 'bob@example.test', password: 'synthetic-password', firstName: 'Bob' });
    cookie = `jwt=${jwt.sign({ id: alice.id }, process.env.JWT_SECRET)}`;
});
afterAll(() => sequelize.close());

test('profile update requires authentication', async () => {
    expect((await request(app).post('/api/user/update').send({ firstName: 'New', lastName: 'Name' })).status).toBe(401);
});
test('updates only the signed-in user’s names and returns public fields', async () => {
    const result = await request(app).post('/api/user/update').set('Cookie', cookie)
        .send({ firstName: ' Renée ', lastName: "O'Brien", id: bob.id, admin: true, password: 'changed-password' });
    expect(result.status).toBe(200);
    expect(result.body.user.firstName).toBe('Renée');
    expect(result.body.user).not.toHaveProperty('password');
    await alice.reload(); await bob.reload();
    expect(alice.admin).toBe(false);
    expect(bob.firstName).toBe('Bob');
    expect(await require('bcryptjs').compare('synthetic-password', alice.password)).toBe(true);
});
test.each([{ firstName: '', lastName: 'Test' }, { firstName: {}, lastName: 'Test' }, { firstName: 'a'.repeat(101), lastName: 'Test' }, { firstName: 'Alice', lastName: 'Test', email: 'changed@example.test' }])('rejects invalid or unsupported changes %j', async body => {
    const before = (await alice.reload()).toJSON();
    expect((await request(app).post('/api/user/update').set('Cookie', cookie).send(body)).status).toBe(400);
    expect((await alice.reload()).toJSON()).toEqual(before);
});
