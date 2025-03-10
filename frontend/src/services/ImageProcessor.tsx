export const ImageProcessor = {
    generateTestImage: () => {
        const width = 600;
        const height = 20;

        const byteArray = new Uint8Array(width * height / 2);

        for (let i = 0; i < height * width / 2; i++) {
            byteArray[i] = (i / width) % 8;
            byteArray[i] |= ((i / width) % 8) << 4;
        }
    }
}
