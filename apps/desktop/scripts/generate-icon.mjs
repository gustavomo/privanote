#!/usr/bin/env node
// scripts/generate-icon.mjs
// Generates macOS dock icon from SVG using native tools.
// Usage: node scripts/generate-icon.mjs

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resourcesDir = path.join(__dirname, '..', 'resources');
const iconsetDir = path.join(resourcesDir, 'icon.iconset');

// Create SVG with P lettermark on dark charcoal rounded square.
// Using SVG path for the "P" instead of text element to avoid font rendering issues.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="228" fill="#1e2028"/>
  <path d="M370 280h180c100 0 180 80 180 180s-80 180-180 180h-80v104h-100V280zm100 264h80c44 0 80-36 80-84s-36-80-80-80h-80v164z" fill="white"/>
</svg>`;

// Step 1: Write SVG
const svgPath = path.join(resourcesDir, 'icon.svg');
fs.writeFileSync(svgPath, svg);

// Step 2: Convert SVG to 1024px PNG using qlmanage (always available on macOS)
try {
  const pngPath = path.join(resourcesDir, 'icon.png');
  execSync(`qlmanage -t -s 1024 -o "${resourcesDir}" "${svgPath}" 2>/dev/null`);
  // qlmanage outputs as icon.svg.png
  const qlOutput = path.join(resourcesDir, 'icon.svg.png');
  if (fs.existsSync(qlOutput)) {
    fs.renameSync(qlOutput, pngPath);
  }

  // Verify PNG exists
  if (!fs.existsSync(pngPath)) {
    throw new Error('PNG not generated');
  }

  console.log('Generated icon.png (1024x1024)');

  // Step 3: Create iconset directory
  if (fs.existsSync(iconsetDir)) {
    fs.rmSync(iconsetDir, { recursive: true });
  }
  fs.mkdirSync(iconsetDir);

  // Step 4: Generate all required sizes using sips
  const sizes = [16, 32, 64, 128, 256, 512, 1024];
  for (const size of sizes) {
    const outFile = path.join(iconsetDir, `icon_${size}x${size}.png`);
    execSync(`sips -z ${size} ${size} "${pngPath}" --out "${outFile}" 2>/dev/null`);

    // Also generate @2x versions for Retina
    if (size <= 512) {
      const retinaSize = size * 2;
      const halfSize = size;
      const retinaFile = path.join(iconsetDir, `icon_${halfSize}x${halfSize}@2x.png`);
      execSync(`sips -z ${retinaSize} ${retinaSize} "${pngPath}" --out "${retinaFile}" 2>/dev/null`);
    }
  }

  console.log('Generated iconset with all sizes');

  // Step 5: Convert iconset to .icns using iconutil
  const icnsPath = path.join(resourcesDir, 'icon.icns');
  execSync(`iconutil --convert icns "${iconsetDir}" --output "${icnsPath}"`);
  console.log('Generated icon.icns');

  // Step 6: Cleanup
  fs.rmSync(iconsetDir, { recursive: true });
  fs.unlinkSync(svgPath);

  console.log('Done! Files created:');
  console.log(`  ${pngPath}`);
  console.log(`  ${icnsPath}`);

} catch (error) {
  console.error('Icon generation failed:', error.message);
  console.error('Ensure you are running on macOS with sips and iconutil available.');
  process.exit(1);
}
