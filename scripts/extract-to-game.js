import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

async function extractZip(zipPath, targetDir) {
  console.log(`Extracting ${zipPath} to ${targetDir}...`);
  const buf = fs.readFileSync(zipPath);
  const zip = await JSZip.loadAsync(buf);
  for (const [relativePath, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    const dest = path.join(targetDir, relativePath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const content = await file.async('nodebuffer');
    fs.writeFileSync(dest, content);
  }
  console.log(`[✓] Extracted ${zipPath}`);
}

async function main() {
  const gameAddonDir = 'C:/Program Files (x86)/World of Warcraft/_forever_/Interface/AddOns';
  await extractZip('public/addons/sbf.zip', gameAddonDir);
  await extractZip('public/addons/blackthornes-tradeskills.zip', gameAddonDir);
  await extractZip('public/addons/questie-forever.zip', gameAddonDir);
  await extractZip('public/addons/forever-mouse-tooltip.zip', gameAddonDir);
  console.log('=== All addons updated in game directory! ===');
}

main().catch(console.error);
