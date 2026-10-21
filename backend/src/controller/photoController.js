const { photoPath, publishPhoto, removePhotos } = require('../services/photo/storage');
const { photoUrl } = require('../services/photo/photoUrl');
const { prepareImage } = require('../services/photo/dithering');
const { decodeImage } = require('../services/photo/imageInput');
const fs = require("fs");
const { Photo, Album } = require('../models/photo');
const { Validator } = require('sequelize');
const generateName = require('sillyname');
const { randomBytes, createCipheriv, createDecipheriv } = require('crypto');

const ALGO = 'aes-256-gcm';
const KEY = process.env.PHOTO_ENC_KEY ? Buffer.from(process.env.PHOTO_ENC_KEY, 'base64') : null;

const getKey = () => {
    if (!KEY || KEY.length !== 32) {
        throw new Error('PHOTO_ENC_KEY is missing or invalid length');
    }
    return KEY;
};

const encryptBuffer = (data) => {
    const key = getKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    // store iv (12) + tag (16) + ciphertext
    return Buffer.concat([iv, tag, encrypted]);
};

const decryptBuffer = (data) => {
    const key = getKey();
    if (data.length < 12 + 16) {
        throw new Error('Encrypted data too short');
    }
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const encrypted = data.subarray(28);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
};

const savePhoto = async (req, res) => {
    try {
        const user = req.user.id;
        const albumId = req.body.albumId;

        if (typeof albumId !== 'string' || !Validator.isUUID(albumId, 4)) {
            return res.status(400).json({ message: 'A valid album id is required' });
        }

        const album = await Album.findOne({ where: { id: albumId, owner: user } });
        if (!album) {
            return res.status(404).json({ message: 'Album not found' });
        }

        const { image: buffer, pixels } = await prepareImage(decodeImage(req.body.data));
        const photo = await publishPhoto(user, album.id, encryptBuffer(buffer), encryptBuffer(pixels));

        res.status(200).json({
            id: photo.id,
            image: buffer.toString('base64')
        });
    } catch (e) {
        console.warn(e);
        res.status(e.status || 500).send(e.status ? e.message : "Error processing image");
    }
}

const createAlbum = async (req, res) => {
    try {
        const user = req.user.id;
        const name = generateName();
        const album = await Album.create({
            owner: user,
            name: name,
        })

        // Check if req.collage.id exists and check if the user is the owner
        res.status(200).send({name: name, id: album.id, photos: []});
    } catch (e) {
        console.log(e);
        res.status(500).send("Error processing image");
    }
}

const savePhotoCollage = async (req, res) => {
    try {
        const user = req.user.id;

        const id = req.body.id;

        const album = await Album.findOne({
            where: {
                id: id,
                owner: user
            }
        });

        if (!album) {
            return res.status(404).send("Album not found or you don't have permission");
        }

        await album.update({
            name: req.body.name
        });

        res.status(200).send("ok");
    } catch (e) {
        console.log(e);
        res.status(500).send("Error");
    }
}

const getAlbums = async (req, res) => {
    try {
        const user = req.user.id;

        const albums = await Album.findAll({
            where: {
                owner: user
            }
        });

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const albumsWithPhotos = await Promise.all(
            albums.map(async (album) => {
                const photos = await Photo.findAll({
                    where: {
                        albumId: album.id
                    },
                    attributes: ['id']
                });

                const photosWithUrls = photos.map((photo) => ({
                    id: photo.id,
                    url: photoUrl(photo.id),
                }));

                return {
                    ...album.toJSON(),
                    photos: photosWithUrls
                };
            })
        );

        res.status(200).json(albumsWithPhotos);
    } catch (e) {
        console.log(e);
        res.status(500).send("Error");
    }
}

const getPhoto = async (req, res) => {
    try {
        const userId = req.user.id;
        const photoId = req.params.id;

        const photo = await Photo.findOne({
            where: {
                id: photoId,
                owner: userId,
            },
        })

        if (!photo) {
            return res.status(404).send('Photo not found');
        }

        const filePath = photoPath(photoId, 'png');
        const encrypted = fs.readFileSync(filePath);
        const decrypted = decryptBuffer(encrypted);

        res.set('Content-Type', 'image/png');
        res.send(decrypted);
    } catch (e) {
        console.log(e);
        res.status(403).send("Forbidden");
    }
}

const deleteAlbum = async (req, res) => {
    try {
        const userId = req.user.id;
        const albumId = req.body.id;

        if (!albumId) {
            return res.status(400).send("Album id is required");
        }

        const album = await Album.findOne({
            where: {
                id: albumId,
                owner: userId,
            },
        });

        if (!album) {
            return res.status(404).send("Album not found or you don't have permission");
        }

        const photoIds = await removePhotos(userId, [], albumId);

        res.status(200).json({ deleted: albumId, photosDeleted: photoIds });
    } catch (e) {
        console.log(e);
        res.status(e.status || 500).json({ message: e.status ? e.message : "Error deleting album" });
    }
};

const deletePhotos = async (req, res) => {
    try {
        const userId = req.user.id;
        const ids = Array.isArray(req.body.ids) ? req.body.ids : [];

        if (ids.length === 0) {
            return res.status(400).send("No photo ids provided");
        }

        const foundIds = await removePhotos(userId, ids);

        res.status(200).json({ deleted: foundIds });
    } catch (e) {
        console.log(e);
        res.status(e.status || 500).json({ message: e.status ? e.message : "Error deleting photos" });
    }
}

module.exports = { savePhoto, getPhoto, createAlbum, savePhotoCollage, getAlbums, deletePhotos, deleteAlbum }
