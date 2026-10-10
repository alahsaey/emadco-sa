import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function generate() {
  const svgPath = path.resolve('public/pwa-icon.svg');
  const svgBuffer = fs.readFileSync(svgPath);

  const sizes = [
    { name: 'public/pwa-icon-192.png', size: 192 },
    { name: 'public/pwa-icon-512.png', size: 512 },
    { name: 'public/apple-touch-icon.png', size: 180 },
    { name: 'public/favicon.png', size: 64 },
    { name: 'public/logo-clean.png', size: 512 }
  ];

  for (const { name, size } of sizes) {
    const outPath = path.resolve(name);
    await sharp(svgBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outPath);
    console.log(`Generated: ${name} (${size}x${size})`);
  }
}

generate().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
