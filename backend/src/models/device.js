const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');


// +-------------+----------+--------+
// | STRING (PK) | DATE     | STRING |
// |-------------+----------+--------+
// | id          | lastSeen | Name   |
// +-------------+----------+--------+

const Device = sequelize.define('Device', {
    id: {
        type: DataTypes.STRING(6),
        primaryKey: true,
        allowNull: false
    },
    lastSeen: {
        type: DataTypes.DATE,
        allowNull: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    hooks: {
        beforeCreate: async (device) => {
            device.id = await generateUniqueId();
        }
    }
});

async function generateUniqueId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    
    while (true) {
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const existingDevice = await Device.findOne({ where: { id: result } });
        if (!existingDevice) {
            return result; // Return unique id
        }
    }
}

module.exports = Device;
