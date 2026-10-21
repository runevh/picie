const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { createLoginAttempts } = require('../services/auth/loginAttempts');
const consumeLoginAttempt = createLoginAttempts();

const throttled = (res, seconds) => res.set('Retry-After', String(seconds)).status(429).json({
    message: `Too many login attempts. Try again in ${seconds} seconds.`,
});

const publicUser = (user) => ({
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    ...(user.admin ? { admin: true } : {}),
});

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
        return res.status(400).json({ message: 'Userinfo is invalid' });
    }

    if (typeof password !== 'string' || bcrypt.truncates(password) ||
        [...password].length < 6 || !password.trim()) {
        return res.status(400).json({ message: 'Password must contain at least 6 characters and fit within 72 UTF-8 bytes' });
    }

    try {
        const existing = await User.findOne({
            where: {
                [Op.or]: [{ email: email }, { username: username }],
            },
        });

        if (existing) {
            return res.status(400).json({ message: 'The provided email or username is already in use.' });
        }

        const user = await User.create({
            username,
            email,
            password,
            firstName,
            lastName,
            admin: false,
        });

        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Secure in production
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.status(200).json({
            user: publicUser(user),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error, are all your values correct?' });
    }
}

const login = async (req, res) => {
    const { username, password, } = req.body;
    // Use the actual peer, never a caller-supplied forwarded header.
    const retryAfter = consumeLoginAttempt([
        [`client:${req.socket?.remoteAddress || 'unknown'}`, 60],
        [`login:${typeof username === 'string' ? username.trim().toLowerCase() : 'invalid'}`, 10],
    ]);
    if (retryAfter) return throttled(res, retryAfter);
    if (typeof username !== 'string' || !username || username.length > 254 ||
        typeof password !== 'string' || !password || bcrypt.truncates(password)) {
        return res.status(400).json({ message: 'Incorrect password or username / email.' });
    }

    try {
        // Check if user data already exists
        const user = await User.findOne({
            where: {
                [Op.or]: [{ email: username }, { username: username }],
            },
        });

        if (!user) {
            return res.status(400).json({ message: 'Incorrect password or username / email.' });
        }

        // Email and username share the same account budget.
        const accountRetry = consumeLoginAttempt([[`account:${user.id}`, 10]]);
        if (accountRetry) return throttled(res, accountRetry);
        const passCorrect = await bcrypt.compare(password, user.password);

        if (!passCorrect) {
            return res.status(400).json({ message: 'Incorrect password or username / email.' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Secure in production
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.json({
            success: true,
            message: 'Login successful',
            user: publicUser(user),
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'There was a problem with the server. Please try again.' });
    }
}

const fetchUser = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: { exclude: ['password', 'id'] },
        })

        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        res.json({ data: publicUser(user) });
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
}

const logout = async (req, res) => {
    try {

        res.cookie('jwt', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 0,
        });

        res.status(200).json({ message: 'Successfully logged out.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error occurred during logout.' });
    }
};

module.exports = {
    register, login, logout, fetchUser
};
