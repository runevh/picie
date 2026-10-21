const request = require('supertest');
const app = require('../src/app')();
test.each(['/photo/albums/delete', '/photo/delete', '/device/set', '/device/firmware'])('shared app retains protected route %s', async route => {
    expect((await request(app).post(`/api${route}`).send({})).status).toBe(401);
});
