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
const { Model } = require('sequelize');
const { sequelize } = require('../src/config/db');
const previousSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = 'synthetic-user-tests-secret';
// Suppress DeviceState's import-time schema sync; initialize all models below.
const importSync = jest.spyOn(Model, 'sync').mockResolvedValue(undefined);
const { app } = require('../src/index');
importSync.mockRestore();

beforeAll(async () => {
    await sequelize.sync({force: true});
})

afterAll(async () => {
    await sequelize.close();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
})

describe('POST /api/register', () => {

    it('Register new user + check duplicates', async () => {
        const newUser = {
            username: 'newuser',
            email: 'newuser@example.com',
            password: 'newpassword123',
            firstName: 'New',
            lastName: 'User'
        };

        const response = await request(app)
            .post('/api/register')
            .send(newUser);

        expect(response.status).toBe(200);
        expect(response.body.user.email).toBe(newUser.email);
        expect(response.body.user.username).toBe(newUser.username);
    
        const response1 = await request(app).post('/api/register').send(newUser);
        expect(response1.status).toBe(400);
    
        const response2 = await request(app).post('/api/register').send(newUser);
        expect(response2.status).toBe(400);
    });

    it('Register new user with incorrect username', async () => {
        const newUser = {
            username: 'newUser+1',
            email: 'newuser4@example.com',
            password: 'newpassword123',
            firstName: 'New',
            lastName: 'User'
        };

        const response = await request(app).post('/api/register').send(newUser);
        expect(response.status).toBe(400);

        newUser.username = "newUser*1";

        const response1 = await request(app).post('/api/register').send(newUser);
        expect(response1.status).toBe(400);

        newUser.username = "ne";

        const response2 = await request(app).post('/api/register').send(newUser);
        expect(response2.status).toBe(400);


        newUser.username = "newusernewusernew";

        const response3 = await request(app).post('/api/register').send(newUser);
        expect(response3.status).toBe(400);

        newUser.username = "test_user.65sdda";

        const response4 = await request(app).post('/api/register').send(newUser);
        expect(response4.status).toBe(200);
        expect(response4.body.user.email).toBe(newUser.email);
        expect(response4.body.user.username).toBe(newUser.username);

        newUser.username = "...";
        newUser.email = 'newuser5@example.com';

        const response5 = await request(app).post('/api/register').send(newUser);
        expect(response5.status).toBe(400);

        newUser.username = "aa...1.";

        const response6 = await request(app).post('/api/register').send(newUser);
        expect(response6.status).toBe(400);

        newUser.username = "abc";
        const response7 = await request(app).post('/api/register').send(newUser);
        expect(response7.status).toBe(200);
        expect(response7.body.user.email).toBe(newUser.email);
        expect(response7.body.user.username).toBe(newUser.username);
    });

    it('Register new user with incorrect first name', async () => {
        const newUser = {
            username: 'valid_user',
            email: 'validuser@example.com',
            password: 'newpassword123',
            firstName: 'New',
            lastName: 'User'
        };

        const response1 = await request(app).post('/api/register').send(newUser);
        expect(response1.status).toBe(200);
        expect(response1.body.user.firstName).toBe(newUser.firstName);

        newUser.firstName = "New123";
        newUser.email = 'user2@example.com';
        const response2 = await request(app).post('/api/register').send(newUser);
        expect(response2.status).toBe(400);

        newUser.firstName = "New@User";
        newUser.email = 'user3@example.com';
        const response3 = await request(app).post('/api/register').send(newUser);
        expect(response3.status).toBe(400);

        newUser.firstName = "New User";
        newUser.email = 'user4@example.com';
        const response4 = await request(app).post('/api/register').send(newUser);
        expect(response4.status).toBe(400);

        newUser.firstName = "N";
        newUser.email = 'user5@example.com';
        const response5 = await request(app).post('/api/register').send(newUser);
        expect(response5.status).toBe(400);

        newUser.firstName = "";
        newUser.email = 'user6@example.com';
        const response6 = await request(app).post('/api/register').send(newUser);
        expect(response6.status).toBe(400);
    });

    it('Register new user with incorrect email', async () => {
        const newUser = {
            username: 'incorrectmail',
            email: 'newuserexample.com',
            password: 'newpassword123',
            firstName: 'New',
            lastName: 'User'
        };

        const response = await request(app)
            .post('/api/register')
            .send(newUser);

        expect(response.status).toBe(400);
    });

    it('Register new user with incorrect last name', async () => {
        const newUser = {
            username: 'tvalid_user',
            email: 'tvaliduser@example.com',
            password: 'newpassword123',
            firstName: 'Valid',
            lastName: 'User' // Should be valid
        };

        const response1 = await request(app).post('/api/register').send(newUser);
        expect(response1.status).toBe(200);
        expect(response1.body.user.lastName).toBe(newUser.lastName);

        newUser.username = 'tvalid_user3',
        newUser.lastName = "";
        newUser.email = 'tuser2@example.com';
        const response2 = await request(app).post('/api/register').send(newUser);
        expect(response2.status).toBe(200);
        expect(response2.body.user.lastName).toBe(newUser.lastName);
        
        newUser.username = 'tvalid_user4',
        newUser.lastName = "User123";
        newUser.email = 'tuser3@example.com';
        const response3 = await request(app).post('/api/register').send(newUser);
        expect(response3.status).toBe(400);

        newUser.lastName = "User@Name";
        newUser.email = 'tuser4@example.com';
        const response4 = await request(app).post('/api/register').send(newUser);
        expect(response4.status).toBe(400);

        newUser.lastName = "Van Der Woodsen";
        newUser.email = 'tuser5@example.com';
        const response5 = await request(app).post('/api/register').send(newUser);
        expect(response5.status).toBe(200);
        expect(response5.body.user.lastName).toBe(newUser.lastName);

        newUser.username = 'tvalid_user6',
        newUser.lastName = "User_123!";
        newUser.email = 'tuser6@example.com';
        const response6 = await request(app).post('/api/register').send(newUser);
        expect(response6.status).toBe(400);
    });
});
it('successful logout expires the cookie and subsequent requests stay unauthenticated', async () => {
    const browser = request.agent(app);
    await browser.post('/api/register').send({
        username: 'logoutuser', email: 'logout@example.test', password: 'synthetic-password',
        firstName: 'Logout', lastName: 'Test',
    }).expect(200);
    await browser.get('/api/auth').expect(200);
    const response = await browser.post('/api/logout').expect(200);
    expect(response.headers['set-cookie'].join(';')).toMatch(/jwt=;/);
    expect(response.headers['set-cookie'].join(';')).toMatch(/Max-Age=0/);
    await browser.get('/api/auth').expect(401);
    await browser.get('/api/auth').expect(401);
});
