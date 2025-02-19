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

module.exports = {
    auth,
};