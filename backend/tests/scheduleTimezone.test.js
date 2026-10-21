const { Sequelize, DataTypes } = require('sequelize');
const { nextTimeOfDay } = require('../src/schedules/timezone');
const { migrateScheduleTimezone } = require('../src/migrations/scheduleTimezone');
const { sequelize } = require('../src/config/db');
const Device = require('../src/models/device');
const { DeviceState } = require('../src/models/deviceState');
const { computeNextRun, setDeviceSchedule } = require('../src/schedules/updateScheduler');
const next = (times, zone, now) => new Date(nextTimeOfDay(times, zone, Date.parse(now))).toISOString();
afterAll(() => sequelize.close());

test.each(['UTC', 'America/Los_Angeles', 'Asia/Tokyo'])('schedule timezone is independent of server timezone %s', serverZone => {
    const previous = process.env.TZ;
    try {
        process.env.TZ = serverZone;
        expect(next(['09:00'], 'Europe/Brussels', '2026-10-21T06:00:00Z')).toBe('2026-10-21T07:00:00.000Z');
        expect(next(['09:00'], 'Asia/Kolkata', '2026-10-21T00:00:00Z')).toBe('2026-10-21T03:30:00.000Z');
    } finally {
        if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous;
    }
});
test('spring gaps move forward by the missing hour', () => {
    expect(next(['02:30'], 'Europe/Brussels', '2026-03-29T00:00:00Z')).toBe('2026-03-29T01:30:00.000Z');
});
test('autumn repeated times run once at the earlier occurrence', () => {
    expect(next(['02:30'], 'Europe/Brussels', '2026-10-25T00:00:00Z')).toBe('2026-10-25T00:30:00.000Z');
    expect(next(['02:30'], 'Europe/Brussels', '2026-10-25T00:45:00Z')).toBe('2026-10-26T01:30:00.000Z');
});
test('chooses the nearest time across local midnight', () => {
    expect(next(['09:00', '18:00'], 'America/New_York', '2026-10-21T22:01:00Z')).toBe('2026-10-22T13:00:00.000Z');
});
test('interval schedules retain elapsed-time semantics', () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-03-29T00:50:00Z'));
    try {
        expect(computeNextRun({ scheduleMode: 'interval', intervalMinutes: 30, timeZone: 'Europe/Brussels' })).toBe(Date.parse('2026-03-29T01:20:00Z'));
    } finally { jest.restoreAllMocks(); }
});
test('persists timezone changes and rejects invalid zones without changing the schedule', async () => {
    await sequelize.sync({ force: true });
    const device = await Device.create({ secret: 'synthetic-device-secret' });
    const state = await setDeviceSchedule(device.uuid, { mode: 'times', timesOfDay: ['09:00'], timeZone: 'Europe/Brussels' });
    expect((await DeviceState.findByPk(state.id)).timeZone).toBe('Europe/Brussels');
    const before = (await state.reload()).toJSON();
    for (const timeZone of ['bad/timezone', '', null, {}, 'a'.repeat(101)]) {
        await expect(setDeviceSchedule(device.uuid, { mode: 'interval', timeZone })).rejects.toMatchObject({ status: 400 });
        expect((await state.reload()).toJSON()).toEqual(before);
    }
});
test('migration preserves the previous server zone once and is safe on a fresh database', async () => {
    const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
    try {
        await migrateScheduleTimezone(db, 'Europe/Brussels');
        const query = db.getQueryInterface();
        await query.createTable('DeviceStates', { id: { type: DataTypes.INTEGER, primaryKey: true } });
        await query.bulkInsert('DeviceStates', [{ id: 1 }]);
        await migrateScheduleTimezone(db, 'Europe/Brussels');
        await migrateScheduleTimezone(db, 'America/New_York');
        const [rows] = await db.query('SELECT * FROM DeviceStates');
        expect(rows).toEqual([{ id: 1, timeZone: 'Europe/Brussels' }]);
    } finally { await db.close(); }
});
