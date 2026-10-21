const sharp = require('sharp');

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 12_000_000;
let active = 0;

const inputError = message => Object.assign(new Error(message), { status: 400 });

function decodeImage(data) {
    if (typeof data !== 'string') throw inputError('Image data is required');
    const encoded = data.startsWith('data:') ? data.slice(data.indexOf(',') + 1) : data;
    if (!encoded || encoded.length > Math.ceil(MAX_BYTES / 3) * 4) throw inputError('Image is too large or empty');
    const buffer = Buffer.from(encoded, 'base64');
    if (!buffer.length || buffer.length > MAX_BYTES || buffer.toString('base64') !== encoded) {
        throw inputError('Invalid base64 image');
    }
    return buffer;
}

async function withImageCapacity(work) {
    if (active >= 2) throw Object.assign(new Error('Image processing is busy. Try again.'), { status: 503 });
    active++;
    try { return await work(); } finally { active--; }
}

async function normalizeImage(buffer) {
    if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_BYTES) throw inputError('Invalid image size');
    try {
        const image = sharp(buffer, { limitInputPixels: MAX_PIXELS, failOn: 'warning' });
        const metadata = await image.metadata();
        if (!['png', 'jpeg', 'webp'].includes(metadata.format) || (metadata.pages || 1) !== 1 ||
            !metadata.width || !metadata.height || Math.max(metadata.width, metadata.height) > 8192) {
            throw inputError('Use a single PNG, JPEG, or WebP image within the size limits');
        }
        return await image.rotate(metadata.height > metadata.width ? 90 : 0)
            .resize(600, 448, { fit: 'contain', background: '#ffffff' })
            .flatten({ background: '#ffffff' }).toColourspace('srgb').removeAlpha().png().toBuffer();
    } catch (error) {
        throw inputError('Invalid or unsupported image');
    }
}
module.exports = { decodeImage, normalizeImage, withImageCapacity };
