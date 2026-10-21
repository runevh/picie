const { DataTypes } = require('sequelize');

async function migrateScheduleTimezone(sequelize, legacyTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
    const query = sequelize.getQueryInterface();
    const tables = await query.showAllTables();
    if (!tables.some(table => (table.tableName || table) === 'DeviceStates')) return;
    const columns = await query.describeTable('DeviceStates');
    if (columns.timeZone) return;
    // Existing schedules retain the server's previous interpretation, once, on upgrade.
    await query.addColumn('DeviceStates', 'timeZone', {
        type: DataTypes.STRING, allowNull: false, defaultValue: legacyTimeZone,
    });
}
module.exports = { migrateScheduleTimezone };
