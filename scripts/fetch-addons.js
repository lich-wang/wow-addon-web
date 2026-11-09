import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { patchSBF } from './locales/sbf.js';
import { patchIceHUDZhCN } from './locales/icehud.js';
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

async function getLatestGitHubRelease(repo, assetMatch) {
  try {
    const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;
    const res = await fetch(apiUrl, { headers: HEADERS });
    if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`);
    const data = await res.json();
    const tag = data.tag_name;
    const asset = data.assets?.find(a => assetMatch(a.name));
    if (asset?.browser_download_url) {
      return { tag, url: asset.browser_download_url };
    }
  } catch (err) {
    console.warn(`[Warn] Failed to query latest release for ${repo}: ${err.message}`);
  }
  return null;
}

// ---------------------------------------------------------------------------
// 1. Single-Button Fishing (SBF)
// ---------------------------------------------------------------------------
async function processSBF() {
  let url = 'https://github.com/Goblin-Engineering-Company/SBF/releases/download/2026.11.05.1/SBF-2026.11.05.1.zip';
  const latest = await getLatestGitHubRelease('Goblin-Engineering-Company/SBF', name => name.endsWith('.zip'));
  if (latest?.url) url = latest.url;

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

// ---------------------------------------------------------------------------
// 2. Blackthornes Tradeskills (BT)
// ---------------------------------------------------------------------------
async function processBlackthornes() {
  let url = 'https://github.com/Blackthornes/Blackthornes_Tradeskills/releases/download/v1.21.0/Blackthornes_TS-v1.21.0-forever.zip';
  let tag = 'v1.21.0';
  const latest = await getLatestGitHubRelease('Blackthornes/Blackthornes_Tradeskills', name => name.endsWith('-forever.zip') || name.endsWith('.zip'));
  if (latest?.url) {
    url = latest.url;
    tag = latest.tag;
  }

  const outPath = path.join(OUTPUT_DIR, 'blackthornes-tradeskills.zip');
  const buf = await downloadBuffer(url, outPath);
  const zip = await JSZip.loadAsync(buf);

  console.log(`Injecting clean 100% complete zhCN for Blackthornes Tradeskills ${tag}...`);

  // Targeted fixes dictionary (ensuring PR changes are always applied even if upstream has new version)
  const BT_TARGETED_FIXES = {
    "Made for": "制造成本",
    "Train Artisan %s": "学习大师级%s",
    "Learn Artisan %s": "学习大师级%s",
    "Start with %s in %s. Catch the four rare fish he asks for. Then he teaches you Artisan %s.": "先去%2$s找%1$s。钓到他要的四条稀有鱼。然后他会教你大师级%3$s。",
    "%s %s: %s%s. %s.": "%s %s：%s%s。%s。",
    "Deals: Craftsman's Writs": "划算货：工匠文书",
    "Craftsman's Writ: %s": "工匠文书：%s",
    "Craftsman's Writs": "工匠文书",
    "Deals: Merchant's Favor": "划算货：商人的青睐",
    "Merchant's Favor": "商人的青睐",
    "Waylaid Crate: %s": "遭劫的货物：%s",
    "WAYLAID CRATE": "遭劫的货物",
    "All bought. Fill the crates and take them to the Supply Officer.": "都买好了。装满箱子，交给军需官。",
    // Enchanting material fallback names
    "Strange Dust": "奇异之尘",
    "Soul Dust": "灵魂之尘",
    "Vision Dust": "幻象之尘",
    "Dream Dust": "梦境之尘",
    "Illusion Dust": "幻影之尘",
    "Lesser Magic Essence": "次级魔法精华",
    "Greater Magic Essence": "强效魔法精华",
    "Lesser Astral Essence": "次级星界精华",
    "Greater Astral Essence": "强效星界精华",
    "Lesser Mystic Essence": "次级秘法精华",
    "Greater Mystic Essence": "强效秘法精华",
    "Lesser Nether Essence": "次级虚空精华",
    "Greater Nether Essence": "强效虚空精华",
    "Lesser Eternal Essence": "次级不灭精华",
    "Greater Eternal Essence": "强效不灭精华",
    "Small Glimmering Shard": "小块微光碎片",
    "Large Glimmering Shard": "大块微光碎片",
    "Small Glowing Shard": "小块闪光碎片",
    "Large Glowing Shard": "大块闪光碎片",
    "Small Radiant Shard": "小块强光碎片",
    "Large Radiant Shard": "大块强光碎片",
    "Small Brilliant Shard": "小块魔光碎片",
    "Large Brilliant Shard": "大块魔光碎片",
    "Nexus Crystal": "连结水晶",
  };

  const zhFile = zip.file('Blackthornes_TS/Locale/zhCN.lua');
  if (zhFile) {
    let zh = await zhFile.async('string');
    for (const [enKey, zhVal] of Object.entries(BT_TARGETED_FIXES)) {
      const pattern = new RegExp(`L\\["${enKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\]\\s*=\\s*"([^"\\\\]|\\\\.)*"`);
      if (pattern.test(zh)) {
        zh = zh.replace(pattern, `L[${JSON.stringify(enKey)}] = ${JSON.stringify(zhVal)}`);
      } else {
        zh += `\nL[${JSON.stringify(enKey)}] = ${JSON.stringify(zhVal)}`;
      }
    }
    zip.file('Blackthornes_TS/Locale/zhCN.lua', zh);
    // Keep scripts/locales/bt_zhCN.lua in sync
    fs.writeFileSync(path.resolve('scripts/locales/bt_zhCN.lua'), zh, 'utf-8');
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
        'function Disenchant:MaterialName(itemID)\n    return MATERIAL_NAME[itemID] and self:ItemName(itemID) or nil\nend'
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

// ---------------------------------------------------------------------------
// 3. IceHUD
// ---------------------------------------------------------------------------
async function processIceHUD() {
  let url = 'https://github.com/parnic/ice-hud/releases/download/v1.17.28/IceHUD-v1.17.28.zip';
  const latest = await getLatestGitHubRelease('parnic/ice-hud', name => name.endsWith('.zip') && !name.includes('nolib'));
  if (latest?.url) url = latest.url;

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

// ---------------------------------------------------------------------------
// 4. DungeonsForever
// ---------------------------------------------------------------------------
async function processDungeonsForever() {
  const url = 'https://edge.forgecdn.net/files/9506/425/DungeonsForever2.1.31.zip';
  const outPath = path.join(OUTPUT_DIR, 'dungeonsforever.zip');
  const buf = await downloadBuffer(url, outPath);
  fs.writeFileSync(outPath, buf);
  console.log(`[✓] dungeonsforever.zip saved (${(buf.length / (1024 * 1024)).toFixed(2)} MB)`);
}

// ---------------------------------------------------------------------------
// 5. Bagnon
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// 6. Lueur
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// 7. Questie Forever
// ---------------------------------------------------------------------------
async function processQuestieForever() {
  const coreUrl = 'https://edge.forgecdn.net/files/9502/146/Questie-v12.6.4.zip';
  let dbUrl = 'https://github.com/Questie/QuestieDB/releases/download/v1.0.13/QuestieDB-1.0.13-Forever.zip';
  const latestDB = await getLatestGitHubRelease('Questie/QuestieDB', name => name.includes('Forever') && name.endsWith('.zip'));
  if (latestDB?.url) dbUrl = latestDB.url;

  const outPath = path.join(OUTPUT_DIR, 'questie-forever.zip');

  console.log('Fetching Questie Core + QuestieDB Forever...');
  const coreBuf = await downloadBuffer(coreUrl);
  const dbBuf = await downloadBuffer(dbUrl);

  const zip = await JSZip.loadAsync(coreBuf);
  await patchQuestie(zip);
  await zip.loadAsync(dbBuf);
  await patchQuestieDB(zip);

  const outBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  fs.writeFileSync(outPath, outBuf);
  console.log(`[✓] questie-forever.zip generated (${(outBuf.length / (1024 * 1024)).toFixed(2)} MB)`);
}

// ---------------------------------------------------------------------------
// 8. BtWQuests
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// 9. Forever Mouse Tooltip
// ---------------------------------------------------------------------------
async function processForeverMouseTooltip() {
  let url = 'https://github.com/Ninjaskurk/forever-mouse-tooltip/releases/download/v0.2.0/ForeverMouseTooltip-0.2.0.zip';
  const latest = await getLatestGitHubRelease('Ninjaskurk/forever-mouse-tooltip', name => name.endsWith('.zip'));
  if (latest?.url) url = latest.url;

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
