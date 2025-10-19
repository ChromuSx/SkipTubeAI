import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Create icons directory if it doesn't exist
const iconsDir = join(__dirname, 'icons');
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}

// Icon sizes required for Chrome Web Store
const sizes = [16, 32, 48, 128];

// Source logo
const sourceLogo = join(__dirname, 'logo.png');

async function generateIcons() {
  console.log('🎨 Generating optimized icons...\n');

  for (const size of sizes) {
    const outputPath = join(iconsDir, `icon${size}.png`);

    try {
      await sharp(sourceLogo)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 } // transparent background
        })
        .png({
          compressionLevel: 9, // Maximum compression
          quality: 100
        })
        .toFile(outputPath);

      console.log(`✓ Created ${size}x${size} icon at ${outputPath}`);
    } catch (error) {
      console.error(`✗ Error creating ${size}x${size} icon:`, error.message);
    }
  }

  console.log('\n✅ Icon generation complete!');
  console.log('📁 Icons saved to:', iconsDir);
}

generateIcons().catch(console.error);
