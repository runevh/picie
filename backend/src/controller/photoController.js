const { PNG } = require('pngjs');
const {dither } = require('../services/photo/dithering')

const savePhoto = async (req, res) => {
    try {

        const buffer = req.body;
        const png = PNG.sync.read(buffer);
        const byteArray = await dither(req.body);
        res.status(200).send("ok");
    } catch (e) {
        console.log(e);
        res.status(500).send("Error processing image");
    }

}

module.exports = { savePhoto }