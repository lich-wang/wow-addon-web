import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { patchIceHUDZhCN } from './locales/icehud.js';
import { patchLueur } from './locales/lueur.js';
import { patchBagnon } from './locales/bagnon.js';
import { patchQuestie, patchQuestieDB } from './locales/quests.js';
import { patchForeverMouseTooltip } from './locales/tooltip.js';
import { patchMapzeroth } from './locales/mapzeroth.js';
import {
  buildWoWFAddon,
  hasValidZoneQuestsBuffer,
  isValidZoneQuestsData,
} from './locales/wowf.js';
import { buildForeverTransitAddon } from './locales/foreverTransit.js';

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

// CurseForge 的 Flavor 标识：88568 = 无限服 (WoW Forever / 1.60.1)
const FOREVER_GAME_VERSION_TYPE_ID = 88568;

/**
 * 安全下载远程二进制 Buffer，成功时缓存原始上游包（及可选的 Release 标签），失败时回退到原始上游包缓存
 * @param {string} url - 远程文件下载地址
 * @param {string} [cacheName] - 原始上游包缓存文件名（如 bagnon.zip），不传则不缓存/不回退
 * @param {string} [releaseTag] - 与本次下载对应的 Release 标签，成功时随缓存一并保存，回退时挂在返回 Buffer 的 releaseTag 属性上
 * @returns {Promise<Buffer & { releaseTag?: string }>} 下载完成或读取回退的二进制数据
 */
async function downloadBuffer(url, cacheName, releaseTag, signal) {
  const SafeName = cacheName ? path.basename(cacheName) : null;
  const cachePath = SafeName ? path.join(UPSTREAM_CACHE_DIR, SafeName) : null;
  const tagPath = cachePath ? `${cachePath}.tag` : null;
  const sourcePath = cachePath ? `${cachePath}.source` : null;
  let buf;
  try {
    console.log(`Downloading: ${url}...`);
    const res = await fetch(url, { headers: getHeadersForUrl(url), ...(signal ? { signal } : {}) });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    buf = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    if (cachePath && fs.existsSync(cachePath)) {
      console.log(`[Cache Fallback] Download failed (${e.message}), using cached upstream: ${cachePath}`);
      const cached = fs.readFileSync(cachePath);
      if (tagPath && fs.existsSync(tagPath)) {
        cached.releaseTag = fs.readFileSync(tagPath, 'utf-8').trim();
      }
      cached.sourceUrl = sourcePath && fs.existsSync(sourcePath)
        ? fs.readFileSync(sourcePath, 'utf-8').trim()
        : 'cache://unknown';
      return cached;
    }
    throw e;
  }

  if (cachePath) {
    try {
      fs.mkdirSync(UPSTREAM_CACHE_DIR, { recursive: true });
      if (sourcePath && fs.existsSync(sourcePath)) fs.unlinkSync(sourcePath);
      if (tagPath && fs.existsSync(tagPath)) fs.unlinkSync(tagPath);
      fs.writeFileSync(cachePath, buf);
      if (sourcePath) {
        fs.writeFileSync(sourcePath, url, 'utf-8');
      }
      if (tagPath && releaseTag) {
        fs.writeFileSync(tagPath, releaseTag, 'utf-8');
      }
    } catch (cacheErr) {
      console.warn(`[Warn] Failed to update upstream cache ${cachePath}: ${cacheErr.message}`);
    }
  }
  if (releaseTag) buf.releaseTag = releaseTag;
  buf.sourceUrl = url;
  return buf;
}

/**
 * 按页查询 CurseForge 项目最新的正式版 (Release) 文件并拼出 CDN 下载地址
 * 使用 CurseForge 网站公开的文件列表接口（无需 API Key），失败时返回 null 由调用方使用兜底地址
 * @param {number} projectId - CurseForge 项目 ID（见插件 TOC 的 X-Curse-Project-ID）
 * @param {(fileName: string, file: { gameVersionTypeIds?: number[] }) => boolean} [fileMatch] - 文件名/文件元信息匹配断言
 *   （如仅匹配 -forever.zip 变体，或用 gameVersionTypeIds 限定必须包含无限服 88568）
 * @returns {Promise<{ tag: string, fileName: string, url: string } | null>} 最新正式版信息
 */
async function getLatestCurseForgeFile(projectId, fileMatch = () => true) {
  const pageSize = 30;
  const maxPages = 5;
  try {
    for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
      const apiUrl =
        `https://www.curseforge.com/api/v1/mods/${projectId}/files` +
        `?pageIndex=${pageIndex}&pageSize=${pageSize}&sort=dateCreated&sortDescending=true&removeAlphas=true`;
      const res = await fetch(apiUrl, { headers: BASE_HEADERS });
      if (!res.ok) throw new Error(`CurseForge API HTTP ${res.status}`);
      const data = await res.json();
      const files = Array.isArray(data.data) ? data.data : [];
      // releaseType: 1 = Release, 2 = Beta, 3 = Alpha；只分发正式版
      const file = files.find(
        f =>
          f.releaseType === 1 &&
          typeof f.fileName === 'string' &&
          f.fileName.endsWith('.zip') &&
          fileMatch(f.fileName, f)
      );
      if (file?.id) {
        const url = `https://edge.forgecdn.net/files/${Math.floor(file.id / 1000)}/${file.id % 1000}/${encodeURIComponent(file.fileName)}`;
        return { tag: file.displayName || file.fileName, fileName: file.fileName, url };
      }
      if (files.length < pageSize) break;
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
  // 去掉 TOC 中追加的中文说明后缀（如 "(Forever 全汉化版)"），说明文字由前端 catalog 统一拼接
  const v = version.replace(/\s*[(（].*?[)）]\s*$/, '').trim();
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
async function getLatestGitHubRelease(repo, assetMatch, signal) {
  try {
    const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;
    const res = await fetch(apiUrl, { headers: GITHUB_HEADERS, ...(signal ? { signal } : {}) });
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
      // 保留上游包内的 SBF/SBF.toc，避免本地旧版 TOC 覆盖上游真实版本号
      if (f !== 'SBF.toc' && fs.statSync(fullPath).isFile()) {
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
// 2. EasyAuction (无限服拍卖行助手，上游自带简体中文)
// ---------------------------------------------------------------------------
async function processEasyAuction() {
  // 兜底地址仅在 CurseForge 接口不可用时使用；正常情况下始终分发上游最新正式版
  const fallbackUrl = 'https://edge.forgecdn.net/files/9695/475/EasyAuction-V20261119.3.zip';
  // 该项目同时发布 3.80.2 (Titan Reforged, 81212) 与 1.60.1 (无限服 Forever, 88568) 两套包，
  // 必须限定包含无限服 Flavor 的文件，避免把不兼容的 Titan Reforged 包分发给无限服玩家
  const latest = await getLatestCurseForgeFile(
    1595608,
    (name, file) =>
      /^EasyAuction-V?[\d.]+\.zip$/i.test(name) && (file?.gameVersionTypeIds ?? []).includes(FOREVER_GAME_VERSION_TYPE_ID)
  );
  const url = latest?.url || fallbackUrl;

  const outPath = path.join(OUTPUT_DIR, 'easyauction.zip');
  // 上游为专有许可协议且已自带完整简体中文与无限服 Interface (16001)，
  // 因此这里只做原样分发，不改写 TOC / Lua 等任何文件内容
  const buf = await downloadBuffer(url, 'easyauction.zip');
  fs.writeFileSync(outPath, buf);

  const zip = await JSZip.loadAsync(buf);
  recordBundledVersion('easyauction', await readTocVersion(zip, 'EasyAuction/EasyAuction.toc'), buf.sourceUrl || url);
  console.log(`[✓] easyauction.zip saved (${(buf.length / (1024 * 1024)).toFixed(2)} MB)`);
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
function makeTempQuestieDBFilename() {
  return `questie-db-forever.${process.pid}.${Date.now()}.tmp.zip`;
}

async function downloadQuestieDBForever(deadlineMs = 30000) {
  const releaseTimeoutMs = Math.min(8000, Math.floor(deadlineMs * 0.3));
  const downloadTimeoutMs = Math.max(5000, deadlineMs - releaseTimeoutMs);
  let dbUrl = 'https://github.com/Questie/QuestieDB/releases/download/v1.0.13/QuestieDB-1.0.13-Forever.zip';
  const latestDB = await getLatestGitHubRelease(
    'Questie/QuestieDB',
    name => name.includes('Forever') && name.endsWith('.zip'),
    AbortSignal.timeout(releaseTimeoutMs)
  );
  if (latestDB?.url) dbUrl = latestDB.url;
  const dbBuf = await downloadBuffer(dbUrl, undefined, undefined, AbortSignal.timeout(downloadTimeoutMs));
  return { dbUrl, dbBuf };
}

function getValidatedZoneQuestsSnapshot() {
  const snapshotPath = path.join(UPSTREAM_CACHE_DIR, 'wowf-dataset.json');
  if (!fs.existsSync(snapshotPath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    if (!isValidZoneQuestsData(data?.zoneQuests, data?.zoneAreaIds)) return null;
    return {
      zoneQuests: data.zoneQuests,
      zoneAreaIds: data.zoneAreaIds,
      zoneCoveredIds: data.zoneCoveredIds || null,
      questieDbVersion: data.meta?.questieDbVersion || '',
    };
  } catch {
    return null;
  }
}

async function validateQuestieDBArchiveBuffer(buf) {
  if (!buf || buf.length === 0) {
    return { valid: false, reason: 'QuestieDB archive buffer is empty.' };
  }
  let zip;
  try {
    zip = await JSZip.loadAsync(buf, { checkCRC32: true });
  } catch (err) {
    return { valid: false, reason: `QuestieDB ZIP integrity/CRC32 check failed: ${err.message}` };
  }
  const foreverToc = zip.file('QuestieDB/QuestieDB_Forever.toc');
  const camelotToc = zip.file('QuestieDB/QuestieDB_Camelot.toc');
  const tocFile = foreverToc || camelotToc;
  if (!tocFile) {
    return { valid: false, reason: 'QuestieDB archive is missing QuestieDB_Forever.toc / QuestieDB_Camelot.toc.' };
  }
  if (foreverToc && camelotToc) {
    const [foreverBuf, camelotBuf] = await Promise.all([
      foreverToc.async('nodebuffer'),
      camelotToc.async('nodebuffer'),
    ]);
    if (!foreverBuf.equals(camelotBuf)) {
      return { valid: false, reason: 'QuestieDB_Forever.toc and QuestieDB_Camelot.toc contents differ.' };
    }
  }
  const tocText = await tocFile.async('string');
  const fileIndex = new Set(Object.keys(zip.files).map(p => p.toLowerCase()));
  let tocFileCount = 0;
  let bakedIdx = -1;
  let apiIdx = -1;
  for (const rawLine of tocText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const rel = line.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
    if (!rel) continue;
    const lowerRel = rel.toLowerCase();
    if (!fileIndex.has(`questiedb/${lowerRel}`)) {
      return { valid: false, reason: `QuestieDB TOC references missing file: QuestieDB/${rel}` };
    }
    if (lowerRel === 'src/read/baked.lua' && bakedIdx < 0) bakedIdx = tocFileCount;
    if (lowerRel === 'src/api.lua' && apiIdx < 0) apiIdx = tocFileCount;
    tocFileCount++;
  }
  if (tocFileCount === 0 || bakedIdx < 0 || apiIdx <= bakedIdx) {
    return { valid: false, reason: 'QuestieDB TOC must declare src/read/baked.lua before src/api.lua.' };
  }
  if (!(await hasValidZoneQuestsBuffer(buf))) {
    return { valid: false, reason: 'QuestieDB archive produced an empty or incomplete zoneQuests index.' };
  }
  return { valid: true, reason: '' };
}

async function promoteValidQuestieDBBuffer(dbBuf, dbUrl = '') {
  const check = await validateQuestieDBArchiveBuffer(dbBuf);
  if (!check.valid) {
    return { valid: false, promoted: false, reason: check.reason };
  }
  const dbCachePath = path.join(UPSTREAM_CACHE_DIR, 'questie-db-forever.zip');
  const dbMetaPath = path.join(UPSTREAM_CACHE_DIR, 'questie-db-forever.meta.json');
  const tmpPath = path.join(UPSTREAM_CACHE_DIR, makeTempQuestieDBFilename());
  let promoted = false;
  try {
    fs.mkdirSync(UPSTREAM_CACHE_DIR, { recursive: true });
    fs.writeFileSync(tmpPath, dbBuf);
    fs.renameSync(tmpPath, dbCachePath);
    promoted = true;
    if (dbUrl) {
      try {
        const sha256 = crypto.createHash('sha256').update(dbBuf).digest('hex');
        fs.writeFileSync(
          dbMetaPath,
          JSON.stringify({ url: dbUrl, sha256, updatedAt: new Date().toISOString() }, null, 2)
        );
      } catch {
        // ignore metadata write error
      }
    }
  } catch (err) {
    console.warn(`[Questie] Failed to persist QuestieDB cache (${err.message}); continuing with in-memory archive.`);
  } finally {
    if (fs.existsSync(tmpPath)) {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        // ignore cleanup error
      }
    }
  }
  return { valid: true, promoted };
}

async function ensureValidQuestieDBCache() {
  const dbCachePath = path.join(UPSTREAM_CACHE_DIR, 'questie-db-forever.zip');
  if (fs.existsSync(dbCachePath)) {
    try {
      const cachedBuf = fs.readFileSync(dbCachePath);
      const check = await validateQuestieDBArchiveBuffer(cachedBuf);
      if (check.valid) {
        return { questieDbBuf: cachedBuf, useSnapshotOnly: false };
      }
    } catch {
      // fall through to download
    }
  }
  try {
    const { dbUrl, dbBuf } = await downloadQuestieDBForever();
    const { valid, reason } = await promoteValidQuestieDBBuffer(dbBuf, dbUrl);
    if (!valid) {
      throw new Error(reason || 'Downloaded questie-db-forever.zip failed archive validation.');
    }
    return { questieDbBuf: dbBuf, useSnapshotOnly: false };
  } catch (err) {
    const snapshot = getValidatedZoneQuestsSnapshot();
    if (snapshot) {
      console.warn(`[WoWF] QuestieDB refresh failed (${err.message}); falling back to cached zoneQuests snapshot.`);
      return { questieDbBuf: null, useSnapshotOnly: true, snapshot };
    }
    throw err;
  }
}

async function processQuestieForever() {
  // Questie 同样会在队伍/公会内广播版本并提示 "You have an outdated version of Questie!"，需跟随上游
  let coreUrl = 'https://edge.forgecdn.net/files/9502/146/Questie-v12.6.4.zip';
  const latestCore = await getLatestCurseForgeFile(334372, name => /^Questie-v[\d.]+\.zip$/i.test(name));
  if (latestCore?.url) coreUrl = latestCore.url;

  const outPath = path.join(OUTPUT_DIR, 'questie-forever.zip');

  console.log('Fetching Questie Core + QuestieDB Forever...');
  const coreBuf = await downloadBuffer(coreUrl, 'questie-core.zip');
  let dbUrl = 'https://github.com/Questie/QuestieDB/releases/download/v1.0.13/QuestieDB-1.0.13-Forever.zip';
  let dbBuf;
  const zip = await JSZip.loadAsync(coreBuf);
  await patchQuestie(zip);
  try {
    const res = await downloadQuestieDBForever();
    dbUrl = res.dbUrl;
    const candidateZip = await JSZip.loadAsync(res.dbBuf);
    const tocFile =
      candidateZip.file('QuestieDB/QuestieDB_Forever.toc') || candidateZip.file('QuestieDB/QuestieDB_Camelot.toc');
    if (!tocFile) {
      throw new Error('Downloaded QuestieDB archive is missing QuestieDB TOC.');
    }
    await tocFile.async('string');
    const { valid, reason } = await promoteValidQuestieDBBuffer(res.dbBuf, dbUrl);
    if (!valid) {
      throw new Error(reason || 'Downloaded QuestieDB archive failed validation.');
    }
    dbBuf = res.dbBuf;
  } catch (err) {
    const dbCachePath = path.join(UPSTREAM_CACHE_DIR, 'questie-db-forever.zip');
    const dbMetaPath = path.join(UPSTREAM_CACHE_DIR, 'questie-db-forever.meta.json');
    if (fs.existsSync(dbCachePath) && fs.statSync(dbCachePath).size > 0) {
      const cachedBuf = fs.readFileSync(dbCachePath);
      const cachedCheck = await validateQuestieDBArchiveBuffer(cachedBuf);
      if (!cachedCheck.valid) {
        throw err;
      }
      const cachedSha256 = crypto.createHash('sha256').update(cachedBuf).digest('hex');
      let cachedUrl = 'unknown (cached questie-db-forever.zip)';
      if (fs.existsSync(dbMetaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(dbMetaPath, 'utf8'));
          if (meta?.url && meta?.sha256 === cachedSha256) {
            cachedUrl = meta.url;
          }
        } catch {
          // ignore malformed meta
        }
      }
      dbUrl = cachedUrl;
      console.warn(`[Questie] QuestieDB refresh/validation failed (${err.message}); falling back to validated cached questie-db-forever.zip.`);
      dbBuf = cachedBuf;
    } else {
      throw err;
    }
  }
  await zip.loadAsync(dbBuf);
  const camelotToc = zip.file('QuestieDB/QuestieDB_Camelot.toc');
  if (camelotToc && !zip.file('QuestieDB/QuestieDB_Forever.toc')) {
    zip.file('QuestieDB/QuestieDB_Forever.toc', await camelotToc.async('nodebuffer'));
  }
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
  return dbBuf;
}

// ---------------------------------------------------------------------------
// 8. Forever Mouse Tooltip
// ---------------------------------------------------------------------------
async function processForeverMouseTooltip() {
  const fallbackTag = 'v0.2.0';
  let url = 'https://github.com/Ninjaskurk/forever-mouse-tooltip/releases/download/v0.2.0/ForeverMouseTooltip-0.2.0.zip';
  let tag = fallbackTag;
  const latest = await getLatestGitHubRelease('Ninjaskurk/forever-mouse-tooltip', name => name.endsWith('.zip'));
  if (latest?.url) {
    url = latest.url;
    tag = latest.tag;
  }

  const outPath = path.join(OUTPUT_DIR, 'forever-mouse-tooltip.zip');
  const buf = await downloadBuffer(url, 'forever-mouse-tooltip.zip', tag);
  // 若下载失败回退到缓存包，使用缓存包保存时的标签（或兜底标签），避免将新标签写入旧缓存包的 TOC
  const effectiveTag = buf.releaseTag || fallbackTag;
  const zip = await JSZip.loadAsync(buf);

  console.log('Injecting full zhCN localization for Forever Mouse Tooltip...');
  await patchForeverMouseTooltip(zip, effectiveTag);

  const outBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  fs.writeFileSync(outPath, outBuf);
  recordBundledVersion('forever-mouse-tooltip', await readTocVersion(zip, 'ForeverMouseTooltip/ForeverMouseTooltip.toc'), url);
  console.log(`[✓] forever-mouse-tooltip.zip generated (${(outBuf.length / (1024 * 1024)).toFixed(2)} MB)`);
}

// ---------------------------------------------------------------------------
// 9. Mapzeroth (Forever GPS Navigation)
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

// ---------------------------------------------------------------------------
// 10. SpellActivationOverlay (WoW Forever & Classic Proc Alerts)
// ---------------------------------------------------------------------------
async function processSpellActivationOverlay() {
  let url = 'https://github.com/ennvina/spellactivationoverlay/releases/download/v2.9.1/SpellActivationOverlay-2.9.1-universal.zip';
  const latest = await getLatestGitHubRelease('ennvina/spellactivationoverlay', name => name.endsWith('-universal.zip'));
  if (latest?.url) url = latest.url;

  const outPath = path.join(OUTPUT_DIR, 'spellactivationoverlay.zip');
  const buf = await downloadBuffer(url, 'spellactivationoverlay.zip');
  const zip = await JSZip.loadAsync(buf);
  const foreverVersion = await readTocVersion(zip, 'SpellActivationOverlay/SpellActivationOverlay_Forever.toc');
  if (!foreverVersion) {
    throw new Error(`SpellActivationOverlay ZIP 缺少 SpellActivationOverlay_Forever.toc: ${url}`);
  }
  fs.writeFileSync(outPath, buf);
  recordBundledVersion('spellactivationoverlay', foreverVersion, url);
  console.log(`[✓] spellactivationoverlay.zip saved (${(buf.length / (1024 * 1024)).toFixed(2)} MB)`);
}

// ---------------------------------------------------------------------------
// 11. WoWF Companion (wowf.io In-Game Dynamic Guide for WoW Forever)
// ---------------------------------------------------------------------------
async function processWoWF(questieDbBuf = null) {
  const { zip, source } = await buildWoWFAddon(OUTPUT_DIR, UPSTREAM_CACHE_DIR, getHeadersForUrl, questieDbBuf);
  recordBundledVersion('wowf', await readTocVersion(zip, 'WoWF/WoWF.toc'), source);
}

// ---------------------------------------------------------------------------
// 12. ForeverTransit (World Map Boat/Zeppelin/Tram Routes for WoW Forever)
// ---------------------------------------------------------------------------
async function processForeverTransit() {
  const { zip, source } = await buildForeverTransitAddon(OUTPUT_DIR);
  recordBundledVersion('forever-transit', await readTocVersion(zip, 'ForeverTransit/ForeverTransit.toc'), source);
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
  const onlyArg = process.argv.find(a => a.startsWith('--only='))?.split('=')[1];
  if (onlyArg === 'wowf') {
    const questieSource = await ensureValidQuestieDBCache();
    await processWoWF(questieSource);
    writeBundledVersions();
    return;
  }
  if (onlyArg === 'forever-transit') {
    await processForeverTransit();
    writeBundledVersions();
    return;
  }
  if (onlyArg === 'easyauction') {
    await processEasyAuction();
    writeBundledVersions();
    return;
  }

  console.log('=== Fetching & Bundling Curated Addons for wow.lich.tech ===');
  await ensureClientBinaries();
  await processSBF();
  await processEasyAuction();
  await processIceHUD();
  await processDungeonsForever();
  await processBagnon();
  await processLueur();
  const questieDbBuf = await processQuestieForever();
  await processForeverMouseTooltip();
  await processMapzeroth();
  await processSpellActivationOverlay();
  await processWoWF(questieDbBuf);
  await processForeverTransit();
  writeBundledVersions();
  console.log('=== All 12 Addons successfully bundled & localized into public/addons/ ===');
}

main().catch(err => {
  console.error('Build addons failed:', err);
  process.exit(1);
});
