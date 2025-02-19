const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

const isValidUserInfo = (username, firstName, lastName, email) => {
    const usernameRegex = /^(?=(.*[a-z]){3,})[a-z0-9_.]{3,16}$/; // a-z, A-Z, _, . with at least 3 letters
    if (!username || !usernameRegex.test(username)) {
        return false;
    }

    const firstNameRegex = /^[a-zA-Z]+$/; // a-z, A-Z
    if (!firstName || !firstNameRegex.test(firstName)) {
        return false;
    }

    const lastNameRegex = /^[a-zA-Z\s]*$/; // Allow empty string by using `*` instead of `+`
    if (lastName && !lastNameRegex.test(lastName)) {
        return false;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/; // email regex
    if (!email || !emailRegex.test(email)) {
        return false;
    }

    return true;
}

const register = async (req, res) => {
    const { username, email, password, firstName, lastName } = req.body;
    if (!isValidUserInfo(username, firstName, lastName, email)) {
        return res.status(400).json({ message: 'Incorrect userinfo' });
    }

    try {
        // Check if user data already exists
        const existing = await User.findOne({
            where: {
                [Op.or]: [{ email: email }, { username: username }],
            },
        });

        if (existing) {
            return res.status(400).json({ message: 'Email or username already in use.' });
        }

        const user = await User.create({
            username,
            email,
            password,
            firstName,
            lastName
        });

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(201).json({
            message: 'User registered successfully!',
            user: { id: user.id, username: user.username, email: user.email, firstName: user.firstName, lastName: user.lastName },
            token
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error, are all your values correct?' });
    }
}

module.exports = {
    register,
};