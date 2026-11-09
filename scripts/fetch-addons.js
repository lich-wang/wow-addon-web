import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { patchSBF } from './locales/sbf.js';
import { patchIceHUDZhCN } from './locales/icehud.js';
import { generateBTZhCN } from './locales/blackthornes.js';
import { patchLueur } from './locales/lueur.js';
import { patchBagnon } from './locales/bagnon.js';

const OUTPUT_DIR = path.resolve('public/addons');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
};

async function downloadBuffer(url, fallbackPath) {
  try {
    console.log(`Downloading: ${url}...`);
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    if (fallbackPath && fs.existsSync(fallbackPath)) {
      console.log(`[Cache Fallback] Download failed (${e.message}), using existing: ${fallbackPath}`);
      return fs.readFileSync(fallbackPath);
    }
    throw e;
  }
}

async function processSBF() {
  const url = 'https://github.com/Goblin-Engineering-Company/SBF/releases/download/2026.11.05.1/SBF-2026.11.05.1.zip';
  const outPath = path.join(OUTPUT_DIR, 'sbf.zip');
  const buf = await downloadBuffer(url, outPath);
  const zip = await JSZip.loadAsync(buf);

  console.log('Injecting zhCN localization for Single-Button Fishing...');
  await patchSBF(zip);

  const outBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  fs.writeFileSync(outPath, outBuf);
  console.log(`[✓] sbf.zip generated (${(outBuf.length / (1024 * 1024)).toFixed(2)} MB)`);
}

async function processBlackthornes() {
  const url = 'https://edge.forgecdn.net/files/9228/138/Blackthornes_TS-v0.64.0-forever.zip';
  const outPath = path.join(OUTPUT_DIR, 'blackthornes-tradeskills.zip');
  const buf = await downloadBuffer(url, outPath);
  const zip = await JSZip.loadAsync(buf);

  console.log('Generating zhCN localization for Blackthornes Tradeskills...');
  const deDE = await zip.file('Blackthornes_TS/Locale/deDE.lua').async('string');
  const lines = deDE.split('\n');
  const entries = [];
  for (const line of lines) {
    const m = line.match(/^L\[(".*?")\]\s*=\s*(".*?")/);
    if (m) {
      try {
        const key = JSON.parse(m[1]);
        const deVal = JSON.parse(m[2]);
        entries.push({ key, deVal });
      } catch (e) {
        // pass
      }
    }
  }

  const zhCNLua = generateBTZhCN(entries);
  zip.file('Blackthornes_TS/Locale/zhCN.lua', zhCNLua);

  const themeFile = zip.file('Blackthornes_TS/UI/Theme.lua');
  if (themeFile) {
    let themeText = await themeFile.async('string');
    if (themeText.includes('[[Fonts\\FRIZQT__.TTF]]')) {
      themeText = themeText.replace('[[Fonts\\FRIZQT__.TTF]]', '(STANDARD_TEXT_FONT or [[Fonts\\ARKai_T.TTF]])');
      zip.file('Blackthornes_TS/UI/Theme.lua', themeText);
    }
  }

  const tocFile = zip.file('Blackthornes_TS/Blackthornes_TS.toc');
  if (tocFile) {
    let toc = await tocFile.async('string');
    if (!toc.includes('Locale\\zhCN.lua')) {
      toc = toc
        .replace(/## Title: (.*)/, '## Title: $1\n## Title-zhCN: |cff00ff00[商业]|r Blackthornes Tradeskills (商业制造与拍卖)')
        .replace(/## Notes: (.*)/, '## Notes: $1\n## Notes-zhCN: 专为无限服打造的专业制造与拍卖行全能管理插件，实时计算配方利润、排队制造与防亏损上架。')
        .replace('Locale\\deDE.lua', 'Locale\\deDE.lua\nLocale\\zhCN.lua');
      zip.file('Blackthornes_TS/Blackthornes_TS.toc', toc);
    }
  }

  const outBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  fs.writeFileSync(outPath, outBuf);
  console.log(`[✓] blackthornes-tradeskills.zip generated (${(outBuf.length / (1024 * 1024)).toFixed(2)} MB) with ${entries.length} localized strings`);
}

async function processIceHUD() {
  const url = 'https://github.com/parnic/ice-hud/releases/download/v1.17.28/IceHUD-v1.17.28.zip';
  const outPath = path.join(OUTPUT_DIR, 'icehud.zip');
  const buf = await downloadBuffer(url, outPath);
  const zip = await JSZip.loadAsync(buf);

  console.log('Completing zhCN localization for IceHUD...');
  const zhCNFile = zip.file('IceHUD/loc/zhCN.lua');
  if (zhCNFile) {
    const origZhCN = await zhCNFile.async('string');
    const patchedZhCN = patchIceHUDZhCN(origZhCN);
    zip.file('IceHUD/loc/zhCN.lua', patchedZhCN);
  }

  const tocFile = zip.file('IceHUD/IceHUD.toc');
  if (tocFile) {
    let toc = await tocFile.async('string');
    if (!toc.includes('Title-zhCN')) {
      toc = toc
        .replace(/## Title: (.*)/, '## Title: $1\n## Title-zhCN: |cff00ff00[界面]|r IceHUD (弧形战斗抬头显示)')
        .replace(/## Notes: (.*)/, '## Notes: $1\n## Notes-zhCN: 高度可定制的弧形HUD平视框架，将生命、法力、能量、施法条居中直观展现。');
      zip.file('IceHUD/IceHUD.toc', toc);
    }
  }

  const outBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  fs.writeFileSync(outPath, outBuf);
  console.log(`[✓] icehud.zip generated (${(outBuf.length / (1024 * 1024)).toFixed(2)} MB)`);
}

async function processDungeonsForever() {
  const url = 'https://edge.forgecdn.net/files/9506/425/DungeonsForever2.1.31.zip';
  const outPath = path.join(OUTPUT_DIR, 'dungeonsforever.zip');
  const buf = await downloadBuffer(url, outPath);
  fs.writeFileSync(outPath, buf);
  console.log(`[✓] dungeonsforever.zip saved (${(buf.length / (1024 * 1024)).toFixed(2)} MB)`);
}

async function processBagnon() {
  const url = 'https://edge.forgecdn.net/files/9456/775/Bagnon-12.1.8.zip';
  const outPath = path.join(OUTPUT_DIR, 'bagnon.zip');
  const buf = await downloadBuffer(url, outPath);
  const zip = await JSZip.loadAsync(buf);

  console.log('Patching Bagnon TOC metadata...');
  await patchBagnon(zip);

  const outBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  fs.writeFileSync(outPath, outBuf);
  console.log(`[✓] bagnon.zip generated (${(outBuf.length / (1024 * 1024)).toFixed(2)} MB)`);
}

async function processLueur() {
  const url = 'https://edge.forgecdn.net/files/9281/32/Lueur-1.4.0.zip';
  const outPath = path.join(OUTPUT_DIR, 'lueur.zip');
  const buf = await downloadBuffer(url, outPath);
  const zip = await JSZip.loadAsync(buf);

  console.log('Injecting full zhCN localization for Lueur...');
  await patchLueur(zip);

  const outBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  fs.writeFileSync(outPath, outBuf);
  console.log(`[✓] lueur.zip generated (${(outBuf.length / (1024 * 1024)).toFixed(2)} MB)`);
}

async function processRXPGuides() {
  const url = 'https://github.com/RestedXP/RXPGuides/releases/download/v4.11.35/RXPGuides-v4.11.35.zip';
  const outPath = path.join(OUTPUT_DIR, 'rxpguides.zip');
  const buf = await downloadBuffer(url, outPath);
  fs.writeFileSync(outPath, buf);
  console.log(`[✓] rxpguides.zip saved (${(buf.length / (1024 * 1024)).toFixed(2)} MB)`);
}

async function main() {
  console.log('=== Fetching & Bundling Curated Addons for wow.lich.tech ===');
  await processSBF();
  await processBlackthornes();
  await processIceHUD();
  await processDungeonsForever();
  await processBagnon();
  await processLueur();
  await processRXPGuides();
  console.log('=== All 7 Addons successfully bundled & localized into public/addons/ ===');
}

main().catch(err => {
  console.error('Build addons failed:', err);
  process.exit(1);
});
