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

  console.log('Injecting clean 100% zhCN localization for Single-Button Fishing...');
  const cleanDir = path.resolve('scripts/locales/sbf_clean');
  if (fs.existsSync(cleanDir)) {
    for (const f of fs.readdirSync(cleanDir)) {
      const fullPath = path.join(cleanDir, f);
      if (fs.statSync(fullPath).isFile()) {
        zip.file(`SBF/${f}`, fs.readFileSync(fullPath, 'utf-8'));
      }
    }
    const gecBind = path.join(cleanDir, 'Libs/GECBind-1.0/GECBind-1.0.lua');
    if (fs.existsSync(gecBind)) {
      zip.file('SBF/Libs/GECBind-1.0/GECBind-1.0.lua', fs.readFileSync(gecBind, 'utf-8'));
    }
  }

  const outBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  fs.writeFileSync(outPath, outBuf);
  console.log(`[✓] sbf.zip generated (${(outBuf.length / (1024 * 1024)).toFixed(2)} MB)`);
}

async function processBlackthornes() {
  const url = 'https://edge.forgecdn.net/files/9228/138/Blackthornes_TS-v0.64.0-forever.zip';
  const outPath = path.join(OUTPUT_DIR, 'blackthornes-tradeskills.zip');
  const buf = await downloadBuffer(url, outPath);
  const zip = await JSZip.loadAsync(buf);

  console.log('Injecting clean 100% complete zhCN for Blackthornes Tradeskills...');
  const btZhCNPath = path.resolve('scripts/locales/bt_zhCN.lua');
  if (fs.existsSync(btZhCNPath)) {
    zip.file('Blackthornes_TS/Locale/zhCN.lua', fs.readFileSync(btZhCNPath, 'utf-8'));
  }

  // Patch money unit symbols to 金/银/铜
  const utilFile = zip.file('Blackthornes_TS/Core/Util.lua');
  if (utilFile) {
    let utilText = await utilFile.async('string');
    utilText = utilText
      .replace('local GOLD_SUFFIX   = "|cffffd700g|r"', 'local GOLD_SUFFIX   = "|cffffd700金|r"')
      .replace('local SILVER_SUFFIX = "|cffc7c7cfs|r"', 'local SILVER_SUFFIX = "|cffc7c7cf银|r"')
      .replace('local COPPER_SUFFIX = "|cffeda55fc|r"', 'local COPPER_SUFFIX = "|cffeda55f铜|r"')
      .replace('g, s, c = "g", "s", "c"', 'g, s, c = "金", "银", "铜"');
    zip.file('Blackthornes_TS/Core/Util.lua', utilText);
  }

  const peFile = zip.file('Blackthornes_TS/UI/PriceEditor.lua');
  if (peFile) {
    let peText = await peFile.async('string');
    peText = peText
      .replace('Coin(48, 214748, "|cffffd700g|r")', 'Coin(48, 214748, "|cffffd700金|r")')
      .replace('Coin(30, 99, "|cffc7c7cfs|r")', 'Coin(30, 99, "|cffc7c7cf银|r")')
      .replace('Coin(30, 99, "|cffeda55fc|r")', 'Coin(30, 99, "|cffeda55f铜|r")');
    zip.file('Blackthornes_TS/UI/PriceEditor.lua', peText);
  }

  const tpFile = zip.file('Blackthornes_TS/UI/Tab_Prices.lua');
  if (tpFile) {
    let tpText = await tpFile.async('string');
    tpText = tpText
      .replace('Coin("gold", 44, 214748, "|cffffd700g|r")', 'Coin("gold", 44, 214748, "|cffffd700金|r")')
      .replace('Coin("silver", 28, 99, "|cffc7c7cfs|r")', 'Coin("silver", 28, 99, "|cffc7c7cf银|r")')
      .replace('Coin("copper", 28, 99, "|cffeda55fc|r")', 'Coin("copper", 28, 99, "|cffeda55f铜|r")');
    zip.file('Blackthornes_TS/UI/Tab_Prices.lua', tpText);
  }

  const ggFile = zip.file('Blackthornes_TS/UI/GoldGoal.lua');
  if (ggFile) {
    let ggText = await ggFile.async('string');
    ggText = ggText.replace('unit:SetText("g")', 'unit:SetText("金")');
    zip.file('Blackthornes_TS/UI/GoldGoal.lua', ggText);
  }

  const tsFile = zip.file('Blackthornes_TS/UI/Tab_Settings.lua');
  if (tsFile) {
    let tsText = await tsFile.async('string');
    tsText = tsText.replace('AddUnit(goalRow, widgets.goldGoal, "g")', 'AddUnit(goalRow, widgets.goldGoal, "金")');
    zip.file('Blackthornes_TS/UI/Tab_Settings.lua', tsText);
  }

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
  console.log(`[✓] blackthornes-tradeskills.zip generated (${(outBuf.length / (1024 * 1024)).toFixed(2)} MB)`);
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
