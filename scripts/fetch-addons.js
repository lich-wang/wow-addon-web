import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { patchIceHUDZhCN } from './locales/icehud.js';
import { patchLueur } from './locales/lueur.js';
import { patchBagnon } from './locales/bagnon.js';
import { patchBtWQuests, patchQuestie, patchQuestieDB } from './locales/quests.js';
import { patchForeverMouseTooltip } from './locales/tooltip.js';
import { patchMapzeroth } from './locales/mapzeroth.js';

const OUTPUT_DIR = path.resolve('public/addons');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};
const GITHUB_HEADERS = {
  ...BASE_HEADERS,
  ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
};

/**
 * 根据请求目标 URL 选择适合的请求头（仅针对 GitHub 域发送敏感认证 Token）
 * @param {string} url - 目标请求地址
 * @returns {Record<string, string>} 适用的 HTTP 请求头对象
 */
function getHeadersForUrl(url) {
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname === 'github.com' ||
      parsed.hostname.endsWith('.github.com') ||
      parsed.hostname === 'api.github.com' ||
      parsed.hostname.endsWith('.githubusercontent.com')
    ) {
      return GITHUB_HEADERS;
    }
  } catch {
    // fallback to non-sensitive base headers
  }
  return BASE_HEADERS;
}

// 原始上游包缓存目录：下载失败时只回退到「未打补丁」的上游原包，
// 避免把 public/addons 下已打过补丁的产物再次打补丁（补丁重复注入）
const UPSTREAM_CACHE_DIR = path.resolve('.cache/upstream-addons');

/**
 * 安全下载远程二进制 Buffer，成功时缓存原始上游包，失败时回退到原始上游包缓存
 * @param {string} url - 远程文件下载地址
 * @param {string} [cacheName] - 原始上游包缓存文件名（如 bagnon.zip），不传则不缓存/不回退
 * @returns {Promise<Buffer>} 下载完成或读取回退的二进制数据
 */
async function downloadBuffer(url, cacheName) {
  const cachePath = cacheName ? path.join(UPSTREAM_CACHE_DIR, cacheName) : null;
  try {
    console.log(`Downloading: ${url}...`);
    const res = await fetch(url, { headers: getHeadersForUrl(url) });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (cachePath) {
      fs.mkdirSync(UPSTREAM_CACHE_DIR, { recursive: true });
      fs.writeFileSync(cachePath, buf);
    }
    return buf;
  } catch (e) {
    if (cachePath && fs.existsSync(cachePath)) {
      console.log(`[Cache Fallback] Download failed (${e.message}), using cached upstream: ${cachePath}`);
      return fs.readFileSync(cachePath);
    }
    throw e;
  }
}

/**
 * 查询 CurseForge 项目最新的正式版 (Release) 文件并拼出 CDN 下载地址
 * 使用 CurseForge 网站公开的文件列表接口（无需 API Key），失败时返回 null 由调用方使用兜底地址
 * @param {number} projectId - CurseForge 项目 ID（见插件 TOC 的 X-Curse-Project-ID）
 * @param {(fileName: string) => boolean} [fileMatch] - 文件名匹配断言（如仅匹配 -forever.zip 变体）
 * @returns {Promise<{ tag: string, fileName: string, url: string } | null>} 最新正式版信息
 */
async function getLatestCurseForgeFile(projectId, fileMatch = () => true) {
  try {
    const apiUrl =
      `https://www.curseforge.com/api/v1/mods/${projectId}/files` +
      '?pageIndex=0&pageSize=30&sort=dateCreated&sortDescending=true&removeAlphas=true';
    const res = await fetch(apiUrl, { headers: BASE_HEADERS });
    if (!res.ok) throw new Error(`CurseForge API HTTP ${res.status}`);
    const data = await res.json();
    // releaseType: 1 = Release, 2 = Beta, 3 = Alpha；只分发正式版
    const file = data.data?.find(
      f => f.releaseType === 1 && typeof f.fileName === 'string' && f.fileName.endsWith('.zip') && fileMatch(f.fileName)
    );
    if (file?.id) {
      const url = `https://edge.forgecdn.net/files/${Math.floor(file.id / 1000)}/${file.id % 1000}/${encodeURIComponent(file.fileName)}`;
      return { tag: file.displayName || file.fileName, fileName: file.fileName, url };
    }
    throw new Error('no matching release file');
  } catch (err) {
    console.warn(`[Warn] Failed to query latest CurseForge file for project ${projectId}: ${err.message}`);
  }
  return null;
}

/**
 * 从 zip 中的 TOC 文件读取 `## Version:` 字段（取第一个出现的值）
 * @param {JSZip} zip - 插件压缩包
 * @param {string} tocPath - TOC 文件路径
 * @returns {Promise<string | null>} 版本号字符串，未找到时返回 null
 */
async function readTocVersion(zip, tocPath) {
  const f = zip.file(tocPath);
  if (!f) return null;
  const toc = await f.async('string');
  const m = toc.match(/^##\s*Version:\s*(.+?)\s*$/m);
  return m ? m[1] : null;
}

/**
 * 统一版本展示格式：纯数字语义版本补 v 前缀，日期型版本 (如 2026.11.05.1) 与已带前缀的保持原样
 * @param {string} version - 原始版本号
 * @returns {string} 规范化后的版本号
 */
function normalizeVersion(version) {
  const v = version.trim();
  if (/^\d{4}\.\d{1,2}\.\d{1,2}/.test(v)) return v;
  return /^\d/.test(v) ? `v${v}` : v;
}

// 本次打包得到的真实插件版本（从产物 TOC 读取），最终写入前端版本清单
const BUNDLED_VERSIONS_PATH = path.resolve('src/generated/addon-versions.json');
const bundledVersions = {};

/**
 * 记录某个精选插件本次打包的真实版本
 * @param {string} id - 精选插件 id（与 catalogService 中 POPULAR_ADDONS 的 id 对应）
 * @param {string | null} version - 产物中的版本号
 * @param {string} source - 上游来源（下载地址）
 */
function recordBundledVersion(id, version, source) {
  if (!version) {
    console.warn(`[Warn] Could not determine bundled version for ${id}, keeping previous manifest entry.`);
    return;
  }
  bundledVersions[id] = { version: normalizeVersion(version), source };
  console.log(`[Version] ${id} => ${bundledVersions[id].version}`);
}

/**
 * 将本次打包的版本合并写入前端版本清单（未成功解析的条目保留旧值）
 */
function writeBundledVersions() {
  let previous = {};
  if (fs.existsSync(BUNDLED_VERSIONS_PATH)) {
    try {
      previous = JSON.parse(fs.readFileSync(BUNDLED_VERSIONS_PATH, 'utf-8'));
    } catch {
      previous = {};
    }
  }
  const merged = { ...previous, ...bundledVersions };
  const sorted = Object.fromEntries(Object.keys(merged).sort().map(k => [k, merged[k]]));
  fs.mkdirSync(path.dirname(BUNDLED_VERSIONS_PATH), { recursive: true });
  fs.writeFileSync(BUNDLED_VERSIONS_PATH, JSON.stringify(sorted, null, 2) + '\n', 'utf-8');
  console.log(`[✓] Bundled addon versions written to ${path.relative(process.cwd(), BUNDLED_VERSIONS_PATH)}`);
}

/**
 * 查询指定 GitHub 仓库的最新 Release，并匹配对应资产文件的下载信息
 * @param {string} repo - GitHub 仓库全名（例如 owner/repo）
 * @param {(name: string) => boolean} assetMatch - 资产文件名匹配断言函数
 * @returns {Promise<{ tag: string, url: string } | null>} 匹配到的标签与下载链接，失败时返回 null
 */
async function getLatestGitHubRelease(repo, assetMatch) {
  try {
    const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;
    const res = await fetch(apiUrl, { headers: GITHUB_HEADERS });
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
  const buf = await downloadBuffer(url, 'sbf.zip');
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
  recordBundledVersion('sbf', await readTocVersion(zip, 'SBF/SBF.toc'), url);
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
  const buf = await downloadBuffer(url, 'blackthornes-tradeskills.zip');
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
  recordBundledVersion('blackthornes-tradeskills', await readTocVersion(zip, 'Blackthornes_TS/Blackthornes_TS.toc') || tag, url);
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
  const buf = await downloadBuffer(url, 'icehud.zip');
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
  recordBundledVersion('icehud', await readTocVersion(zip, 'IceHUD/IceHUD.toc'), url);
  console.log(`[✓] icehud.zip generated (${(outBuf.length / (1024 * 1024)).toFixed(2)} MB)`);
}

// ---------------------------------------------------------------------------
// 4. DungeonsForever
// ---------------------------------------------------------------------------
async function processDungeonsForever() {
  // 兜底地址仅在 CurseForge 接口不可用时使用；正常情况下始终分发上游最新正式版
  let url = 'https://edge.forgecdn.net/files/9506/425/DungeonsForever2.1.31.zip';
  const latest = await getLatestCurseForgeFile(1709577, name => /^DungeonsForever[\d.]+\.zip$/i.test(name));
  if (latest?.url) url = latest.url;

  const outPath = path.join(OUTPUT_DIR, 'dungeonsforever.zip');
  const buf = await downloadBuffer(url, 'dungeonsforever.zip');
  fs.writeFileSync(outPath, buf);
  const zip = await JSZip.loadAsync(buf);
  recordBundledVersion('dungeonsforever', await readTocVersion(zip, 'DungeonsForever/DungeonsForever.toc'), url);
  console.log(`[✓] dungeonsforever.zip saved (${(buf.length / (1024 * 1024)).toFixed(2)} MB)`);
}

// ---------------------------------------------------------------------------
// 5. Bagnon
// ---------------------------------------------------------------------------
async function processBagnon() {
  // Bagnon 内置 StaleCheck 会与同队/同公会玩家互相广播版本，分发旧版就会在游戏内被提示"版本可能已过期"，
  // 因此必须始终跟随上游最新正式版，而不是屏蔽该检测
  let url = 'https://edge.forgecdn.net/files/9456/775/Bagnon-12.1.8.zip';
  const latest = await getLatestCurseForgeFile(1592, name => /Bagnon-\d+(?:\.\d+)*\.zip$/i.test(name));
  if (latest?.url) url = latest.url;

  const outPath = path.join(OUTPUT_DIR, 'bagnon.zip');
  const buf = await downloadBuffer(url, 'bagnon.zip');
  const zip = await JSZip.loadAsync(buf);

  console.log('Patching Bagnon TOC metadata...');
  await patchBagnon(zip);

  const outBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  fs.writeFileSync(outPath, outBuf);
  recordBundledVersion('bagnon', await readTocVersion(zip, 'Bagnon/Bagnon.toc'), url);
  console.log(`[✓] bagnon.zip generated (${(outBuf.length / (1024 * 1024)).toFixed(2)} MB)`);
}

// ---------------------------------------------------------------------------
// 6. Lueur
// ---------------------------------------------------------------------------
async function processLueur() {
  let url = 'https://edge.forgecdn.net/files/9281/32/Lueur-1.4.0.zip';
  const latest = await getLatestCurseForgeFile(1732324, name => /^Lueur-[\d.]+\.zip$/i.test(name));
  if (latest?.url) url = latest.url;

  const outPath = path.join(OUTPUT_DIR, 'lueur.zip');
  const buf = await downloadBuffer(url, 'lueur.zip');
  const zip = await JSZip.loadAsync(buf);

  console.log('Injecting full zhCN localization for Lueur...');
  await patchLueur(zip);

  const outBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  fs.writeFileSync(outPath, outBuf);
  recordBundledVersion('lueur', await readTocVersion(zip, 'Lueur/Lueur.toc'), url);
  console.log(`[✓] lueur.zip generated (${(outBuf.length / (1024 * 1024)).toFixed(2)} MB)`);
}

// ---------------------------------------------------------------------------
// 7. Questie Forever
// ---------------------------------------------------------------------------
async function processQuestieForever() {
  // Questie 同样会在队伍/公会内广播版本并提示 "You have an outdated version of Questie!"，需跟随上游
  let coreUrl = 'https://edge.forgecdn.net/files/9502/146/Questie-v12.6.4.zip';
  const latestCore = await getLatestCurseForgeFile(334372, name => /^Questie-v[\d.]+\.zip$/i.test(name));
  if (latestCore?.url) coreUrl = latestCore.url;

  let dbUrl = 'https://github.com/Questie/QuestieDB/releases/download/v1.0.13/QuestieDB-1.0.13-Forever.zip';
  const latestDB = await getLatestGitHubRelease('Questie/QuestieDB', name => name.includes('Forever') && name.endsWith('.zip'));
  if (latestDB?.url) dbUrl = latestDB.url;

  const outPath = path.join(OUTPUT_DIR, 'questie-forever.zip');

  console.log('Fetching Questie Core + QuestieDB Forever...');
  const coreBuf = await downloadBuffer(coreUrl, 'questie-core.zip');
  const dbBuf = await downloadBuffer(dbUrl, 'questie-db-forever.zip');

  const zip = await JSZip.loadAsync(coreBuf);
  await patchQuestie(zip);
  await zip.loadAsync(dbBuf);
  await patchQuestieDB(zip);

  const outBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  fs.writeFileSync(outPath, outBuf);

  const coreVersion = await readTocVersion(zip, 'Questie/Questie_Forever.toc');
  const dbVersion = await readTocVersion(zip, 'QuestieDB/QuestieDB_Forever.toc');
  recordBundledVersion(
    'questie-forever',
    coreVersion && dbVersion
      ? `${normalizeVersion(coreVersion)} + DB ${normalizeVersion(dbVersion.replace(/-forever$/i, ''))}`
      : coreVersion,
    `${coreUrl} + ${dbUrl}`
  );
  console.log(`[✓] questie-forever.zip generated (${(outBuf.length / (1024 * 1024)).toFixed(2)} MB)`);
}

// ---------------------------------------------------------------------------
// 8. BtWQuests
// ---------------------------------------------------------------------------
async function processBtWQuests() {
  let url = 'https://edge.forgecdn.net/files/9498/296/BtWQuests-v2.69.1-forever.zip';
  const latest = await getLatestCurseForgeFile(280369, name => /-forever\.zip$/i.test(name));
  if (latest?.url) url = latest.url;

  const outPath = path.join(OUTPUT_DIR, 'btwquests.zip');
  const buf = await downloadBuffer(url, 'btwquests.zip');
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
  let tag = 'v0.2.0';
  const latest = await getLatestGitHubRelease('Ninjaskurk/forever-mouse-tooltip', name => name.endsWith('.zip'));
  if (latest?.url) {
    url = latest.url;
    tag = latest.tag;
  }

  const outPath = path.join(OUTPUT_DIR, 'forever-mouse-tooltip.zip');
  const buf = await downloadBuffer(url, 'forever-mouse-tooltip.zip');
  const zip = await JSZip.loadAsync(buf);

  console.log('Injecting full zhCN localization for Forever Mouse Tooltip...');
  await patchForeverMouseTooltip(zip, tag);

  const outBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  fs.writeFileSync(outPath, outBuf);
  recordBundledVersion('forever-mouse-tooltip', await readTocVersion(zip, 'ForeverMouseTooltip/ForeverMouseTooltip.toc'), url);
  console.log(`[✓] forever-mouse-tooltip.zip generated (${(outBuf.length / (1024 * 1024)).toFixed(2)} MB)`);
}

// ---------------------------------------------------------------------------
// 10. Mapzeroth (Forever GPS Navigation)
// ---------------------------------------------------------------------------
async function processMapzeroth() {
  const url = 'https://github.com/tr0tsky0/Mapzeroth/archive/refs/heads/main.zip';
  const outPath = path.join(OUTPUT_DIR, 'mapzeroth.zip');
  const buf = await downloadBuffer(url, 'mapzeroth.zip');
  const srcZip = await JSZip.loadAsync(buf);

  const zip = new JSZip();
  for (const [p, file] of Object.entries(srcZip.files)) {
    if (file.dir) continue;
    // Mapzeroth-main/* -> Mapzeroth/* 并严格校验目录防路径穿越
    const rel = p.replace(/^Mapzeroth-[^/]+\//, 'Mapzeroth/');
    if (!rel.startsWith('Mapzeroth/') || rel.includes('..')) continue;
    zip.file(rel, await file.async('nodebuffer'));
  }

  console.log('Injecting 100% full zhCN localization for Mapzeroth...');
  await patchMapzeroth(zip);

  const outBuf = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
  fs.writeFileSync(outPath, outBuf);
  recordBundledVersion('mapzeroth', await readTocVersion(zip, 'Mapzeroth/Mapzeroth.toc'), url);
  console.log(`[✓] mapzeroth.zip generated (${(outBuf.length / (1024 * 1024)).toFixed(2)} MB)`);
}

async function ensureClientBinaries() {
  const downloadsDir = path.resolve('public/downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  const exePath = path.join(downloadsDir, 'WoW-Addon-Manager.exe');
  const dmgPath = path.join(downloadsDir, 'WoW-Addon-Manager.dmg');

  if (!fs.existsSync(exePath) || fs.statSync(exePath).size < 1000000) {
    console.log('Fetching WoW-Addon-Manager.exe from latest release...');
    try {
      const latest = await getLatestGitHubRelease('lich-wang/wow-addon-web', name => name === 'WoW-Addon-Manager.exe');
      const url = latest?.url || 'https://github.com/lich-wang/wow-addon-web/releases/download/v1.0.5/WoW-Addon-Manager.exe';
      const buf = await downloadBuffer(url);
      fs.writeFileSync(exePath, buf);
      console.log(`[✓] WoW-Addon-Manager.exe saved (${(buf.length / (1024 * 1024)).toFixed(2)} MB)`);
    } catch (e) {
      console.warn('Failed to fetch WoW-Addon-Manager.exe:', e.message);
    }
  }

  if (!fs.existsSync(dmgPath) || fs.statSync(dmgPath).size < 1000000) {
    console.log('Fetching WoW-Addon-Manager.dmg from latest release...');
    try {
      const latest = await getLatestGitHubRelease('lich-wang/wow-addon-web', name => name.endsWith('.dmg'));
      const url = latest?.url || 'https://github.com/lich-wang/wow-addon-web/releases/download/v1.0.5/WoW-Addon-Manager_1.0.5_universal.dmg';
      const buf = await downloadBuffer(url);
      fs.writeFileSync(dmgPath, buf);
      console.log(`[✓] WoW-Addon-Manager.dmg saved (${(buf.length / (1024 * 1024)).toFixed(2)} MB)`);
    } catch (e) {
      console.warn('Failed to fetch WoW-Addon-Manager.dmg:', e.message);
    }
  }
}

async function main() {
  console.log('=== Fetching & Bundling Curated Addons for wow.lich.tech ===');
  await ensureClientBinaries();
  await processSBF();
  await processBlackthornes();
  await processIceHUD();
  await processDungeonsForever();
  await processBagnon();
  await processLueur();
  await processQuestieForever();
  await processBtWQuests();
  await processForeverMouseTooltip();
  await processMapzeroth();
  writeBundledVersions();
  console.log('=== All 10 Addons successfully bundled & localized into public/addons/ ===');
}

main().catch(err => {
  console.error('Build addons failed:', err);
  process.exit(1);
});
