const path = require('path');
const directory = path.resolve(process.env.PHOTO_STORAGE_PATH || path.join(__dirname, '../../../photos'));
const photoPath = (id, extension) => path.join(directory, `${id}.${extension}`);
module.exports = { directory, photoPath };
