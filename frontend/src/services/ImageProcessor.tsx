export const ImageProcessor = {
    generateTestImage: () => {
        const width = 600;
        const height = 20;

        const byteArray = new Uint8Array(width * height / 2);

        console.log(width * height / 2);

        for (let i = 0; i < height * width / 2; i++) {
            byteArray[i] = (i / width) % 8;
            byteArray[i] |= ((i / width) % 8) << 4;
        }

        console.log(byteArrayToHexString(byteArray));
    }
}

function byteArrayToHexString(byteArray: Uint8Array) {
    let hexArray = Array.from(byteArray, byte => `0x${byte.toString(16).padStart(2, '0')}`);
    return `{ ${hexArray.join(", ")} }`;
}