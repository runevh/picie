const {dither } = require('../services/photo/dithering')
const fs = require("fs");
const { Photo, Collage, Album } = require('../models/photo');
const generateName = require('sillyname');
const path = require('path');

const savePhoto = async (req, res) => {
    try {
        const user = req.user.id;
        const albumId = req.body.albumId;

        //TODO: Check wether person can access album

        const photo = await Photo.create({
            owner: user,
            albumId: albumId,
        });

        const base64WithoutPrefix = req.body.data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64WithoutPrefix, 'base64');
    
        const filePath = path.join(__dirname, '..', '..', 'photos', `${photo.id}`);
        console.log(filePath);
        fs.writeFileSync(filePath + ".png", buffer);

        const bytes = await dither(buffer);
        fs.writeFileSync(filePath + ".data", bytes);

        res.status(200).json({
            id: photo.id,
            image: buffer.toString('base64')
        });
    } catch (e) {
        console.warn(e);
        res.status(500).send("Error processing image");
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

        const collage = await Collage.findOne({
            where: {
                id: id,
                owner: user
            }
        });

        if (!collage) {
            return res.status(404).send("Collage not found or you don't have permission");
        }

        await collage.update({
            name: req.body.name
        })

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

        const albumsWithPhotos = await Promise.all(
            albums.map(async (album) => {
                const photos = await Photo.findAll({
                    where: {
                        albumId: album.id
                    },
                    attributes: ['id']
                });

                return {
                    ...album.toJSON(),
                    photos: photos
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

        const filePath = `./photos/${photoId}.png`;

        const stream = fs.createReadStream(filePath);

        stream.on('error', (err) => {
            if (err.code === 'ENOENT') {
                res.status(404).send('Image not found');
            } else {
                console.error(err);
                res.status(500).send('Internal server error');
            }
        });

        res.set('Content-Type', 'image/png');
        stream.pipe(res);
    } catch (e) {
        console.log(e);
        res.status(403).send("Forbidden");
    }
}

module.exports = { savePhoto, getPhoto, createAlbum, savePhotoCollage, getAlbums }