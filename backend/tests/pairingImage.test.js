const sharp = require('sharp');
const generateNumberImage = require('../src/services/photo/pinImageGenerator');
const { dither } = require('../src/services/photo/dithering');

// Inspect pixels rather than snapshotting platform-dependent font rendering.
async function inkBounds(image) {
    const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const points = [];
    for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
            if (data[(y * info.width + x) * info.channels] < 128) points.push([x, y]);
        }
    }
    expect(points.length).toBeGreaterThan(100);
    return {
        left: Math.min(...points.map(([x]) => x)),
        right: Math.max(...points.map(([x]) => x)),
        top: Math.min(...points.map(([, y]) => y)),
        bottom: Math.max(...points.map(([, y]) => y)),
    };
}

test.each(['0000', '0007', '9999'])('PIN %s renders a centered code on a frame-sized PNG', async pin => {
    const image = await generateNumberImage(pin);
    expect(await sharp(image).metadata()).toMatchObject({ format: 'png', width: 600, height: 448 });
    const bounds = await inkBounds(image);
    expect((bounds.left + bounds.right) / 2).toBeGreaterThan(285);
    expect((bounds.left + bounds.right) / 2).toBeLessThan(315);
    expect(bounds.top).toBeGreaterThan(170);
    expect(bounds.bottom).toBeLessThan(270);
    const corner = await sharp(image).extract({ left: 0, top: 0, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
    expect([...corner]).toEqual([255, 255, 255]);
});

test('leading zeros are retained in the visible code', async () => {
    const full = await inkBounds(await generateNumberImage('0007'));
    const single = await inkBounds(await generateNumberImage('7'));
    expect(full.right - full.left).toBeGreaterThan(3 * (single.right - single.left));
});

test('a rendered PIN converts to a complete packed display payload', async () => {
    const pixels = await dither(await generateNumberImage('0007'));
    expect(pixels).toHaveLength(600 * 448 / 2);
    const colors = new Set();
    for (const byte of pixels) {
        colors.add(byte >> 4);
        colors.add(byte & 0x0f);
    }
    expect([...colors].every(color => color <= 7)).toBe(true);
    expect(colors.has(0)).toBe(true); // Dark glyphs remain visible after conversion.
    expect(colors.has(1)).toBe(true); // Light background.
});
