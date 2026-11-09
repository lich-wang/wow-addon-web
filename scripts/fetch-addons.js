import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { patchSBF } from './locales/sbf.js';
import { patchIceHUDZhCN } from './locales/icehud.js';
import { generateBTZhCN } from './locales/blackthornes.js';
import { patchLueur } from './locales/lueur.js';
import { patchBagnon } from './locales/bagnon.js';
import { patchBtWQuests, patchQuestie, patchQuestieDB } from './locales/quests.js';
import { patchForeverMouseTooltip } from './locales/tooltip.js';

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
  const url = 'https://github.com/Blackthornes/Blackthornes_Tradeskills/releases/download/v1.20.1/Blackthornes_TS-v1.20.1-forever.zip';
  const outPath = path.join(OUTPUT_DIR, 'blackthornes-tradeskills.zip');
  const buf = await downloadBuffer(url, outPath);
  const zip = await JSZip.loadAsync(buf);

  console.log('Injecting clean 100% complete zhCN for Blackthornes Tradeskills v1.20.1...');
  const btZhCNPath = path.resolve('scripts/locales/bt_zhCN.lua');
  if (fs.existsSync(btZhCNPath)) {
    zip.file('Blackthornes_TS/Locale/zhCN.lua', fs.readFileSync(btZhCNPath, 'utf-8'));
  }

  // Localize enchanting material names in Logic/Disenchant.lua
  const deFile = zip.file('Blackthornes_TS/Logic/Disenchant.lua');
  if (deFile) {
    let deText = await deFile.async('string');
    deText = deText
      .replace(
        /for _, material in ipairs\(Disenchant\.MATERIALS\) do\r?\n\s*MATERIAL_NAME\[material\.itemID\] = material\.name\r?\nend/,
        'for _, material in ipairs(Disenchant.MATERIALS) do\n    material.name = L[material.name]\n    MATERIAL_NAME[material.itemID] = material.name\nend'
      )
      .replace(
        /function Disenchant:MaterialName\(itemID\)\r?\n\s*return MATERIAL_NAME\[itemID\]\r?\nend/,
        'function Disenchant:MaterialName(itemID)\n    if not MATERIAL_NAME[itemID] then return nil end\n    return self:ItemName(itemID)\nend'
      );
    zip.file('Blackthornes_TS/Logic/Disenchant.lua', deText);
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
    if (!toc.includes('Title-zhCN:')) {
      toc = toc
        .replace(/## Title: (.*)/, '## Title: $1\n## Title-zhCN: |cff00ff00[商业]|r Blackthornes Tradeskills (商业制造与拍卖)')
        .replace(/## Notes: (.*)/, '## Notes: $1\n## Notes-zhCN: 专为无限服打造的专业制造与拍卖行全能管理插件，实时计算配方利润、排队制造与防亏损上架。');
      if (!toc.includes('Locale\\zhCN.lua')) {
        toc = toc.replace('Locale\\deDE.lua', 'Locale\\deDE.lua\nLocale\\zhCN.lua');
      }
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

async function processQuestieForever() {
  const coreUrl = 'https://edge.forgecdn.net/files/9502/146/Questie-v12.6.4.zip';
  const dbUrl = 'https://github.com/Questie/QuestieDB/releases/download/v1.0.13/QuestieDB-1.0.13-Forever.zip';
  const outPath = path.join(OUTPUT_DIR, 'questie-forever.zip');

  console.log('Fetching Questie Core (v12.6.4) + QuestieDB Forever (v1.0.13)...');
  const coreBuf = await downloadBuffer(coreUrl);
  const dbBuf = await downloadBuffer(dbUrl);

  const zip = await JSZip.loadAsync(coreBuf);
  await patchQuestie(zip);

  // Merge QuestieDB into the same zip archive so 1-click install sets up both Questie and QuestieDB
  await zip.loadAsync(dbBuf);
  await patchQuestieDB(zip);

  const outBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  fs.writeFileSync(outPath, outBuf);
  console.log(`[✓] questie-forever.zip generated (${(outBuf.length / (1024 * 1024)).toFixed(2)} MB)`);
}

async function processBtWQuests() {
  const url = 'https://edge.forgecdn.net/files/9498/296/BtWQuests-v2.69.1-forever.zip';
  const outPath = path.join(OUTPUT_DIR, 'btwquests.zip');
  const buf = await downloadBuffer(url, outPath);
  const zip = await JSZip.loadAsync(buf);

  console.log('Completing zhCN localization & TOC metadata for BtWQuests Forever...');
  await patchBtWQuests(zip);

  const outBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  fs.writeFileSync(outPath, outBuf);
  console.log(`[✓] btwquests.zip generated (${(outBuf.length / (1024 * 1024)).toFixed(2)} MB)`);
}

async function processForeverMouseTooltip() {
  const url = 'https://github.com/Ninjaskurk/forever-mouse-tooltip/releases/download/v0.2.0/ForeverMouseTooltip-0.2.0.zip';
  const outPath = path.join(OUTPUT_DIR, 'forever-mouse-tooltip.zip');
  const buf = await downloadBuffer(url, outPath);
  const zip = await JSZip.loadAsync(buf);

  console.log('Injecting full zhCN localization for Forever Mouse Tooltip...');
  await patchForeverMouseTooltip(zip);

  const outBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  fs.writeFileSync(outPath, outBuf);
  console.log(`[✓] forever-mouse-tooltip.zip generated (${(outBuf.length / (1024 * 1024)).toFixed(2)} MB)`);
}

async function main() {
  console.log('=== Fetching & Bundling Curated Addons for wow.lich.tech ===');
  await processSBF();
  await processBlackthornes();
  await processIceHUD();
  await processDungeonsForever();
  await processBagnon();
  await processLueur();
  await processQuestieForever();
  await processBtWQuests();
  await processForeverMouseTooltip();
  console.log('=== All 9 Addons successfully bundled & localized into public/addons/ ===');
}

main().catch(err => {
  console.error('Build addons failed:', err);
  process.exit(1);
});
