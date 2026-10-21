const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = process.env.NODE_ENV !== 'test' ? (new Sequelize(
    process.env.POSTGRES_NAME,
    process.env.POSTGRES_USER,
    process.env.POSTGRES_PASSWORD,
    {
        host: process.env.POSTGRES_HOST || 'db',
        dialect: 'postgres',
        logging: false
    })) : new Sequelize({ // Use sqlite for local testing
        dialect: 'sqlite',
        storage: ':memory:',
        logging: false
    });

const connectDB = async () => {
    await sequelize.authenticate();
    await sequelize.sync();
};

module.exports = { sequelize, connectDB };
