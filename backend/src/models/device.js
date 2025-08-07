const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid'); // UUID generator
const SALT_ROUNDS = 12;

// +-------------+----------+--------+
// | STRING (PK) | DATE     | STRING |
// |-------------+----------+--------+
// | id          | lastSeen | Name   |
// +-------------+----------+--------+

const Device = sequelize.define('Device', {
    uuid: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: uuidv4,
    },
    publicId: {
        type: DataTypes.STRING(6),
        unique: true,
        allowNull: false,
        validate: {
        is: /^\d{6}$/
        }
    },
    secret: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    lastSeen: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: true,
    },
}, {
    hooks: {
        beforeValidate: async (device) => {
            if (!device.publicId) {
                device.publicId = await generateUniquePublicId();
            }
        },
        beforeSave: async (device) => {
            if (device.changed('secret')) {
                const salt = await bcrypt.genSalt(10);
                device.secret = await bcrypt.hash(device.secret, salt);;
            }
        }
    }

});

async function generateUniquePublicId() {
    const chars = '0123456789';
    
    while (true) {
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const existingDevice = await Device.findOne({ where: { publicId: result } });
        if (!existingDevice) {
            return result; // Return unique id
        }
    }
}

module.exports = Device;
