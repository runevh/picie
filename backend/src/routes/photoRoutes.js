const { Router } = require('express');

const { savePhoto, getPhoto, savePhotoCollage, getAlbums, createAlbum } = require('../controller/photoController');
const { auth } = require('../middleware/auth');

const router = Router();

router.post('/upload', auth, savePhoto);
router.post('/albums/create', auth, createAlbum);
router.post('/albums/save', auth, savePhotoCollage);
router.get('/albums/get', auth, getAlbums);
router.get('/get/:id.png', auth, getPhoto);

module.exports = router;
