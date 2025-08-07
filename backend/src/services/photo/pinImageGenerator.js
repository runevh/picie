const sharp = require('sharp');

async function generateNumberImage(n) {
  const width = 600;
  const height = 488;

  const svgImage = `
    <svg width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="white"/>
      <text x="50%" y="50%" font-size="50" fill="black" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif">${n}</text>
    </svg>
  `;

  const buffer = await sharp(Buffer.from(svgImage))
    .png()
    .toBuffer();

  return buffer;
}

// Example usage:
module.exports = generateNumberImage
