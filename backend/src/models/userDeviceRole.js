const { sequelize } = require('../config/db');
const User = require('./user');
const Device = require('./device');
const { DataTypes } = require('sequelize');

const UserDeviceRole = sequelize.define('UserDeviceRole', {
    role: {
        type: DataTypes.ENUM('OWNER', 'EDIT', 'READ'),
        allowNull: false,
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User,
            key: 'id',
        }
    },
    deviceId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Device,
            key: 'uuid',
        }
    }

}, {
    indexes: [
        {
            unique: true,
            fields: ['deviceId', 'role'],
            where: {
                role: 'OWNER'
            }
        }
    ]
});

User.belongsToMany(Device, {
    through: UserDeviceRole,
    foreignKey: 'userId',
});

Device.belongsToMany(User, {
    through: UserDeviceRole,
    foreignKey: 'deviceId',
});

UserDeviceRole.belongsTo(Device, { foreignKey: 'deviceId' });

module.exports = { UserDeviceRole }

