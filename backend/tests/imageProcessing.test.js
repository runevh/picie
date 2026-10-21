const sharp = require('sharp');
const { prepareImage } = require('../src/services/photo/dithering');
const { decodeImage, normalizeImage, withImageCapacity } = require('../src/services/photo/imageInput');
const png = (width, height, channels = 3) => sharp({ create: { width, height, channels, background: '#abcdef' } }).png().toBuffer();

test.each([[20, 40, 3], [40, 20, 4], [600, 448, 3]])('normalizes %ix%i with %i channels to display bytes and PNG', async (w, h, c) => {
    const result = await prepareImage(await png(w, h, c));
    expect(await sharp(result.image).metadata()).toMatchObject({ width: 600, height: 448, channels: 3, format: 'png' });
    expect(result.pixels.length).toBe(600 * 448 / 2);
    expect([...result.pixels].every(byte => (byte >> 4) < 8 && (byte & 15) < 8)).toBe(true);
});

test('rejects malformed, unsupported, oversized and truncated images', async () => {
    const valid = await png(30, 30);
    for (const buffer of [Buffer.from('bad image'), Buffer.from('<svg width="1" height="1"></svg>'), Buffer.alloc(8 * 1024 * 1024 + 1), valid.subarray(0, valid.length / 2), await png(8193, 1), await png(4000, 4000)]) {
        await expect(normalizeImage(buffer)).rejects.toMatchObject({ status: 400 });
    }
});

test('rejects animated input', async () => {
    const animation = await sharp(Buffer.alloc(24, 200), { raw: { width: 2, height: 4, channels: 3, pageHeight: 2 } }).gif({ delay: [100, 100], loop: 0 }).toBuffer();
    await expect(normalizeImage(animation)).rejects.toMatchObject({ status: 400 });
});

test('validates encoded input before allocating image work', () => {
    for (const value of [null, {}, '', '???', 'abc', 'a'.repeat(12_000_000)]) expect(() => decodeImage(value)).toThrow();
    expect(decodeImage('data:image/png;base64,YWJj')).toEqual(Buffer.from('abc'));
});

test('bounds concurrent work and releases capacity after failures', async () => {
    let release;
    const blocked = new Promise(resolve => { release = resolve; });
    const one = withImageCapacity(() => blocked), two = withImageCapacity(() => blocked);
    const excess = jest.fn();
    await expect(withImageCapacity(excess)).rejects.toMatchObject({ status: 503 });
    expect(excess).not.toHaveBeenCalled();
    release();
    await Promise.all([one, two]);
    await expect(withImageCapacity(() => Promise.reject(new Error('failed')))).rejects.toThrow('failed');
    await expect(withImageCapacity(() => Promise.resolve('ok'))).resolves.toBe('ok');
});
