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

test('photo URLs stay relative despite untrusted proxy and host headers', async () => {
    const album = await Album.create({ name: 'Test', owner: alice.id });
    const photo = await Photo.create({ owner: alice.id, albumId: album.id });
    const result = await request(app).get('/api/photo/albums/get').set('Cookie', cookie)
        .set('Host', 'attacker.example').set('X-Forwarded-Proto', 'http');
    expect(result.status).toBe(200);
    expect(result.body[0].photos[0].url).toBe(`/api/photo/get/${photo.id}.png`);
    expect(new URL(result.body[0].photos[0].url, 'https://photos.example').origin).toBe('https://photos.example');
});
