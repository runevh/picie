const {dither } = require('../services/photo/dithering')
const fs = require("fs");
const { Photo } = require('../models/photo');

const savePhoto = async (req, res) => {
    try {
        
        const user = req.user.id;
        const buffer = req.body;

        const photo = await Photo.create({
            owner: user
        });
    
        const filePath = `./photos/${photo.id}`;
        fs.writeFileSync(filePath + ".png", buffer);

        const bytes = await dither(buffer);
        fs.writeFileSync(filePath + ".data", bytes);

        res.setHeader('Content-Type', 'image/png');
        res.status(200).json( buffer );
    } catch (e) {
        console.log(e);
        res.status(500).send("Error processing image");
    }
}

const savePhotoCollage = async (req, res) => {
    try {
        
        const user = req.user.id;
        // Check if there already exists a photocollage with these

        const photo = await Photo.create({
            owner: user
        });
    
        const filePath = `./photos/${photo.id}`;
        fs.writeFileSync(filePath + ".png", buffer);

        const bytes = await dither(buffer);
        fs.writeFileSync(filePath + ".data", bytes);

        res.setHeader('Content-Type', 'image/png');
        res.status(200).json( buffer );
    } catch (e) {
        console.log(e);
        res.status(500).send("Error processing image");
    }
}

module.exports = { savePhoto }