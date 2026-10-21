const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

// A durable cleanup record survives a crash between filesystem and database work.
module.exports = sequelize.define('PhotoOperation', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    owner: { type: DataTypes.INTEGER, allowNull: false },
    kind: { type: DataTypes.STRING, allowNull: false },
    photoIds: { type: DataTypes.JSON, allowNull: false },
});
