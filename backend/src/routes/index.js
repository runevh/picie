const { Router } = require('express');

const authRoutes = require('./authRoutes');
const deviceRoutes = require('./deviceRoutes');
const photoRoutes = require('./photoRoutes');

const router = Router();

router.use('/', authRoutes);
router.use('/device', deviceRoutes);
router.use('/photo', photoRoutes);

module.exports = router;
