const User = require('../models/user');
const jwt = require('jsonwebtoken');

const auth = async (req, res, next) => {

    try {
        const token = req.cookies.jwt;
        const user = jwt.verify(token, process.env.JWT_SECRET);
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({message: 'Unauthorized'});
    }
}

const admin = async (req, res, next) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: { include: ['admin'] },
        })

        if (!user || !user.admin) return res.status(401).json({ message: 'Unauthorized' });

        next();
    } catch (error) {
        return res.status(401).json({message: 'Unauthorized'});
    }
}

module.exports = {
    auth, admin
};