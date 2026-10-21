const { Router } = require('express');

const { savePhoto, getPhoto, savePhotoCollage, getAlbums, createAlbum, deleteAlbum, deletePhotos } = require('../controller/photoController');
const { auth } = require('../middleware/auth');

const router = Router();

router.post('/upload', auth, savePhoto);
router.post('/albums/create', auth, createAlbum);
router.post('/albums/save', auth, savePhotoCollage);
router.post('/albums/delete', auth, deleteAlbum);
router.post('/delete', auth, deletePhotos);
router.get('/albums/get', auth, getAlbums);
router.get('/get/:id.png', auth, getPhoto);

module.exports = router;
