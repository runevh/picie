const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./user');

// +-------------+----------+--------+
// | STRING (PK) | DATE     | STRING |
// +-------------+----------+--------+
// | id          | lastSeen | Name   |
// +-------------+----------+--------+
const Collage = sequelize.define('Collage', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    owner: {
        type: DataTypes.INTEGER,
        allowNull: false, 
        references: {
            model: User,
            key: 'id'
        }
    },
});


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
    collageId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Collage,
            key: 'id'
        }
    }
});

User.hasMany(Photo, { foreignKey: 'owner', onDelete: 'CASCADE' }); //Todo, delete files when entry is also deleted
Photo.belongsTo(User, { foreignKey: 'owner' });

Collage.hasMany(Photo, { foreignKey: 'collageId' });
Photo.belongsTo(Collage, { foreignKey: 'collageId' });

module.exports = { Photo, Collage };