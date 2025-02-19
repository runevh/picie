const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = process.env.NODE_ENV !== 'test' ? (new Sequelize(
    process.env.POSTGRES_NAME,
    process.env.POSTGRES_USER,
    process.env.POSTGRES_PASSWORD,
    {
        host: 'db',
        dialect: 'postgres',
        logging: true
    })) : new Sequelize({ // Use sqlite for local testing
        dialect: 'sqlite',
        storage: ':memory:',
        logging: false
    });

const connectDB = async () => {
    try {
        await sequelize.authenticate();
        if (process.env.NODE_ENV === 'test') {
            console.log('Running in test environment');
        }
        console.log('DB Connected');
    } catch (error) {
        console.error('Unable to connect to DB:', error);
        process.exit(1);
    }
}

module.exports = { sequelize, connectDB }