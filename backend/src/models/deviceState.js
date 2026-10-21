const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Device = require('./device');

const DEFAULT_INTERVAL_MINUTES = 60 * 5; // 5 hours

const DeviceState = sequelize.define('DeviceState', {
  deviceId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: {
      model: Device,
      key: 'uuid',
    },
  },
  currentPhotoId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  nextPhotoId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  nextUpdateAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  scheduleMode: {
    type: DataTypes.ENUM('interval', 'times'),
    allowNull: false,
    defaultValue: 'interval',
  },
  intervalMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: DEFAULT_INTERVAL_MINUTES,
  },
  timeZone: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'UTC',
  },
  timesOfDay: {
    // Stored as JSON array of "HH:mm" strings for cross-db compatibility (SQLite tests, Postgres prod)
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
  },
  albumId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  indexes: [
    {
      unique: true,
      fields: ['deviceId'],
    },
  ],
});

Device.hasOne(DeviceState, { foreignKey: 'deviceId' });
DeviceState.belongsTo(Device, { foreignKey: 'deviceId' });

module.exports = { DeviceState, DEFAULT_INTERVAL_MINUTES };
