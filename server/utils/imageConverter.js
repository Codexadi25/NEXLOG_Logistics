const sharp = require('sharp');

/**
 * Convert an image buffer to an SVG with the image embedded as base64 data URI.
 * This preserves image fidelity while storing as SVG in MongoDB.
 */
async function imageToSvg(imageBuffer, mimeType = 'image/png') {
  try {
    // Process image with sharp - resize and optimize
    const processed = await sharp(imageBuffer)
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .png({ quality: 80, compressionLevel: 9 })
      .toBuffer();

    const { width, height } = await sharp(processed).metadata();

    // Convert to base64
    const base64 = processed.toString('base64');

    // Wrap in SVG
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>Item Image</title>
  <image
    href="data:image/png;base64,${base64}"
    width="${width}"
    height="${height}"
    x="0"
    y="0"
    preserveAspectRatio="xMidYMid meet"
  />
</svg>`;

    return { svg, width, height };
  } catch (err) {
    throw new Error(`Image conversion failed: ${err.message}`);
  }
}

/**
 * Convert a canvas signature (base64 PNG from frontend) to an SVG
 */
async function signatureToSvg(base64Png) {
  try {
    const buffer = Buffer.from(base64Png.replace(/^data:image\/\w+;base64,/, ''), 'base64');

    const processed = await sharp(buffer)
      .resize(600, 200, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();

    const { width, height } = await sharp(processed).metadata();
    const b64 = processed.toString('base64');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>Delivery Signature</title>
  <rect width="${width}" height="${height}" fill="white"/>
  <image
    href="data:image/png;base64,${b64}"
    width="${width}"
    height="${height}"
    x="0" y="0"
  />
</svg>`;

    return svg;
  } catch (err) {
    throw new Error(`Signature conversion failed: ${err.message}`);
  }
}

/**
 * Create a simple placeholder SVG for items without images
 */
function createPlaceholderSvg(label = 'Package') {
  const initial = label.charAt(0).toUpperCase();
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <rect width="200" height="200" rx="12" fill="#1a2744"/>
  <rect x="60" y="70" width="80" height="60" rx="6" fill="none" stroke="#00d4ff" stroke-width="3"/>
  <line x1="60" y1="90" x2="140" y2="90" stroke="#00d4ff" stroke-width="2"/>
  <line x1="100" y1="70" x2="100" y2="130" stroke="#00d4ff" stroke-width="2"/>
  <text x="100" y="160" font-family="Arial" font-size="14" fill="#00d4ff" text-anchor="middle">${label.substring(0, 12)}</text>
  <text x="100" y="55" font-family="Arial" font-size="28" font-weight="bold" fill="#ffffff" text-anchor="middle">${initial}</text>
</svg>`;
}

module.exports = { imageToSvg, signatureToSvg, createPlaceholderSvg };
