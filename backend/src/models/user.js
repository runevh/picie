const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/db');

// +----------+----------+--------+----------+-----------+----------+---------+
// | INT (PK) | STRING   | STRING | STRING   | STRING    | STRING   | BOOLEAN |
// |----------+----------+--------+----------+-----------+----------+---------+
// | id       | username | email  | password | firstName | lastName | admin   |
// +----------+----------+--------+----------+-----------+----------+---------+

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true,
        },
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    firstName: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    lastName: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    admin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
});

User.beforeSave(async (user, options) => {
    // Check if password changed, so no rehash each time something gets updated
    if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(user.password, salt);
        user.password = hash;
    }
})

module.exports = User