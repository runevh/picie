const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./user');

// +-------------+----------+--------+
// | STRING (PK) | DATE     | STRING |
// +-------------+----------+--------+
// | id          | lastSeen | Name   |
// +-------------+----------+--------+
const Album = sequelize.define('Album', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
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
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    owner: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    albumId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Album,
            key: 'id'
        }
    }
});

User.hasMany(Photo, { foreignKey: 'owner', onDelete: 'CASCADE' }); //Todo, delete files when entry is also deleted
Photo.belongsTo(User, { foreignKey: 'owner' });

Album.hasMany(Photo, { foreignKey: 'albumId' });
Photo.belongsTo(Album, { foreignKey: 'albumId' });

module.exports = { Photo, Album };