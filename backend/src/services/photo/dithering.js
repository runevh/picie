const sharp = require("sharp");

const palette = ["#03162b", "#F2E9D8", "#2E9455", "#2B528C", "#B34040", "#9AA432", "#D95C32", "#EDD4A6"];
const hexToRGB = (hex) => hex.match(/\w\w/g).map((x) => parseInt(x, 16));
const rgbToHex = (r, g, b) => `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;

const dither = async (buffer) => {
    
    const { data, info } = await sharp(buffer)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const width = info.width;
    const height = info.height;
    const channels = info.channels;

    const pixels = new Uint8ClampedArray(data);

    const distributeError = (x, y, dx, dy, factor, error) => {
        let newX = x + dx;
        let newY = y + dy;
        if (newX >= 0 && newX < width && newY >= 0 && newY < height) {
            let newIndex = (newY * width + newX) * channels;
            for (let i = 0; i < 3; i++) {
                let newValue = pixels[newIndex + i] + error[i] * factor;
                pixels[newIndex + i] = newValue < 0 ? 0 : newValue > 255 ? 255 : newValue;
            }
        }
    };

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let index = (y * width + x) * channels;
            let oldColor = [pixels[index], pixels[index + 1], pixels[index + 2]];
            let newColor = hexToRGB(palette[findClosestPaletteColor(oldColor, palette)]);

            // Set new color
            pixels[index] = newColor[0];
            pixels[index + 1] = newColor[1];
            pixels[index + 2] = newColor[2];

            // Calculate error
            let error = oldColor.map((c, i) => c - newColor[i]);

            distributeError(x, y, 1, 0, 7 / 16, error);
            distributeError(x, y, -1, 1, 3 / 16, error);
            distributeError(x, y, 0, 1, 5 / 16, error);
            distributeError(x, y, 1, 1, 1 / 16, error);
        }
    }

    const normalizedPalette = palette.map((color) => color.toLowerCase());

    const byteArray = new Uint8Array(height * width / 2);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let pixelIndex = y * width + x;
            let dataIndex = pixelIndex * 3;
            let r = pixels[dataIndex],
                g = pixels[dataIndex + 1],
                b = pixels[dataIndex + 2];

            let hex = rgbToHex(r, g, b);
            let paletteIndex = normalizedPalette.indexOf(hex);

            const byteIndex = Math.floor(pixelIndex / 2);

            if ((pixelIndex % 2) === 0) {
                byteArray[byteIndex] = paletteIndex << 4;
            } else {
                byteArray[byteIndex] |= paletteIndex;
            }

        }
    }

    

    return byteArray;
}

function byteArrayToHexString(byteArray) {
    let hexArray = Array.from(byteArray, byte => `0x${byte.toString(16).padStart(2, '0')}`);
    return `{ ${hexArray.join(", ")} }`;
}

const findClosestPaletteColor = (color, palette) => {
    let minDist = Infinity, closest = 0;
    for (let i = 0; i < palette.length; i++) {
        let pColor = hexToRGB(palette[i]);
        let dist = Math.sqrt((pColor[0] - color[0]) ** 2 + (pColor[1] - color[1]) ** 2 + (pColor[2] - color[2]) ** 2);
        if (dist < minDist) {
            minDist = dist;
            closest = i;
        }
    }
    return closest;
};

const distributeError = (pixels, x, y, error, factor, width) => {
    if (x < 0 || x >= width || y < 0) return;

    let index = (y * width + x) * 3;
    pixels[index] += error[0] * factor;
    pixels[index + 1] += error[1] * factor;
    pixels[index + 2] += error[2] * factor;
};

module.exports = { dither }
