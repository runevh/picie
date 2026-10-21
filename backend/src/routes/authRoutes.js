const { Router } = require('express');

const { register, login, fetchUser, logout, updateProfile } = require('../controller/userController');
const { auth } = require('../middleware/auth');

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/auth', auth, fetchUser);
router.post('/user/update', auth, updateProfile);
router.post('/logout', auth, logout);

module.exports = router;
