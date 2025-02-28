const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./user');

// +-------------+----------+--------+
// | STRING (PK) | DATE     | STRING |
// |-------------+----------+--------+
// | id          | lastSeen | Name   |
// +-------------+----------+--------+

const Photo = sequelize.define('Photo', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    owner: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
});

User.hasMany(Photo, { foreignKey: 'owner', onDelete: 'CASCADE' }); //Todo, delete files when entry is also deleted
Photo.belongsTo(User, { foreignKey: 'owner' });

module.exports = { Photo };