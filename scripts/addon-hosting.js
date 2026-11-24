/**
 * 校验「所有插件都由本站 Pages 分发」这条硬约束。
 *
 * 背景：OpenMap 的 Forever 包 198 MB，超过 Cloudflare Pages 25 MiB 单文件上限，
 * 早先只能让用户直连 GitHub；现在改成构建期切分片。为了避免以后又悄悄回退成外链，
 * 这里在构建收尾和 CI 里各校验一次：每个插件都必须能在 public/ 下找到自己的产物，
 * 且产物内容与清单自洽（长度、总长、sha256）。
 *
 * 用法：
 *   node scripts/addon-hosting.js                 # 校验 REQUIRED_ADDON_IDS 全部插件
 *   (在 fetch-addons.js 内) verifyAddonHosting({ ids, addonsDir })
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** 与 scripts/fetch-addons.js 的 PAGES_MAX_FILE_BYTES 保持一致 */
export const PAGES_MAX_FILE_BYTES = 25 * 1024 * 1024;

/**
 * 必须由本站分发的插件清单（与 src/services/catalogService.ts 的 POPULAR_ADDONS 对应）。
 * 不能从版本清单推导：版本清单缺条目时校验会“零个插件全部通过”。
 */
export const REQUIRED_ADDON_IDS = [
  'bagnon',
  'blackthornes-tradeskills',
  'dungeonsforever',
  'forever-mouse-tooltip',
  'icehud',
  'lueur',
  'openmap',
  'questie-forever',
  'sbf',
  'spellactivationoverlay',
  'wowf',
];

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ADDONS_DIR = path.resolve(SCRIPT_DIR, '../public/addons');
const DEFAULT_MANIFEST = path.resolve(SCRIPT_DIR, '../src/generated/addon-versions.json');

/**
 * 把 `/addons/openmap/parts.json?v=1` 解析成 addons 目录下的相对路径
 * @param {string} source 版本清单里的 source
 * @returns {string | null} 相对 public/addons 的路径；不是本站 /addons/ 路径时返回 null
 */
function resolveAddonRelativePath(source) {
  if (!source || !source.startsWith('/addons/')) return null;
  const rel = source.slice('/addons/'.length).split('?')[0].split('#')[0];
  if (!rel || rel.includes('..')) return null;
  return rel;
}

/**
 * 校验 OpenMap 分片清单与分片文件
 * @param {string} addonsDir public/addons 目录
 * @param {{ version?: string, source?: string }} entry 版本清单条目
 * @param {string[]} problems 收集问题
 * @returns {{ id: string, kind: 'parts', bytes: number, files: number } | null}
 */
function verifyOpenMapParts(addonsDir, entry, problems) {
  const rel = resolveAddonRelativePath(entry.source);
  if (!rel) {
    problems.push(`openmap: 版本清单 source 不是本站路径（${entry.source}）`);
    return null;
  }
  const manifestFile = path.join(addonsDir, ...rel.split('/'));
  if (!fs.existsSync(manifestFile)) {
    problems.push(`openmap: 缺少 public/addons/${rel}`);
    return null;
  }

  let partsManifest;
  try {
    partsManifest = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));
  } catch (e) {
    problems.push(`openmap: ${rel} 解析失败 ${e.message}`);
    return null;
  }

  const parts = Array.isArray(partsManifest.parts) ? partsManifest.parts : [];
  const totalSize = Number(partsManifest.totalSize) || 0;
  const partSize = Number(partsManifest.partSize) || 0;
  if (parts.length === 0 || totalSize <= 0) {
    problems.push('openmap: parts.json 缺少分片列表或 totalSize');
    return null;
  }

  const missing = [];
  const truncated = [];
  let sum = 0;
  const hash = crypto.createHash('sha256');

  for (let i = 0; i < parts.length; i++) {
    const partRel = String(parts[i]);
    const file = path.join(addonsDir, 'openmap', ...partRel.split('/'));
    const stat = fs.statSync(file, { throwIfNoEntry: false });
    if (!stat || !stat.isFile()) {
      missing.push(partRel);
      continue;
    }
    if (stat.size > PAGES_MAX_FILE_BYTES) {
      problems.push(`openmap: ${partRel} 超过 Pages 单文件上限`);
    }
    if (partSize > 0) {
      const expected = i === parts.length - 1 ? totalSize - sum : partSize;
      if (expected > 0 && stat.size !== expected) {
        truncated.push(`${partRel} 实际 ${stat.size} 预期 ${expected}`);
      }
    }
    sum += stat.size;
    hash.update(fs.readFileSync(file));
  }

  if (missing.length > 0) {
    problems.push(`openmap: 缺少分片 ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ' …' : ''}`);
    return null;
  }
  if (truncated.length > 0) {
    problems.push(`openmap: 分片长度不符（${truncated.slice(0, 3).join('；')}）`);
    return null;
  }
  if (sum !== totalSize) {
    problems.push(`openmap: 分片总长 ${sum} 与清单 totalSize ${totalSize} 不一致`);
    return null;
  }
  if (partsManifest.sha256) {
    const actual = hash.digest('hex');
    if (actual !== String(partsManifest.sha256).toLowerCase()) {
      problems.push(`openmap: 分片拼接后的 sha256 与清单不一致（${actual.slice(0, 12)}…）`);
      return null;
    }
  }

  return { id: 'openmap', kind: 'parts', bytes: sum, files: parts.length };
}

/**
 * 校验指定插件 id 的安装包是否都能从本站拿到
 * @param {object} options
 * @param {string[]} [options.ids] 要校验的插件 id，省略时校验 REQUIRED_ADDON_IDS
 * @param {string} [options.addonsDir] public/addons 目录
 * @param {string} [options.manifestPath] 版本清单路径
 * @param {Record<string, { version?: string, source?: string }>} [options.manifest] 已加载的版本清单
 * @returns {{ id: string, kind: 'zip' | 'parts', bytes: number, files: number }[]} 校验通过的产物摘要
 * @throws {Error} 有插件缺少产物、内容损坏、超过单文件上限，或被配置成外部下载源
 */
export function verifyAddonHosting(options = {}) {
  const addonsDir = options.addonsDir ?? DEFAULT_ADDONS_DIR;
  const manifestPath = options.manifestPath ?? DEFAULT_MANIFEST;
  const ids = options.ids ?? REQUIRED_ADDON_IDS;

  let manifest = options.manifest;
  if (!manifest) {
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`[Hosting] 版本清单不存在：${manifestPath}`);
    }
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  }

  const problems = [];
  const ok = [];

  for (const id of ids) {
    const entry = manifest[id];
    if (!entry) {
      problems.push(`${id}: 版本清单缺少该插件`);
      continue;
    }

    if (id === 'openmap') {
      const summary = verifyOpenMapParts(addonsDir, entry, problems);
      if (summary) ok.push(summary);
      continue;
    }

    const zipPath = path.join(addonsDir, `${id}.zip`);
    const stat = fs.statSync(zipPath, { throwIfNoEntry: false });
    if (!stat || !stat.isFile()) {
      problems.push(`${id}: 缺少 public/addons/${id}.zip`);
      continue;
    }
    if (stat.size > PAGES_MAX_FILE_BYTES) {
      problems.push(`${id}: ${(stat.size / 1024 / 1024).toFixed(2)} MiB 超过 Pages 单文件上限`);
      continue;
    }
    if (stat.size < 200) {
      problems.push(`${id}: ${zipPath} 只有 ${stat.size} 字节，可能是下载失败的空壳`);
      continue;
    }
    ok.push({ id, kind: 'zip', bytes: stat.size, files: 1 });
  }

  if (problems.length > 0) {
    throw new Error(`[Hosting] 以下插件无法由本站分发：\n  - ${problems.join('\n  - ')}`);
  }
  return ok;
}

/**
 * 把校验结果打印成一行摘要
 * @param {{ id: string, kind: string, bytes: number, files: number }[]} summaries
 */
export function describeHosting(summaries) {
  const totalMB = summaries.reduce((sum, item) => sum + item.bytes, 0) / 1024 / 1024;
  const chunked = summaries.filter((item) => item.kind === 'parts');
  const parts = chunked.map((item) => `${item.id}(${item.files} 片)`).join('、');
  return `[Hosting] ${summaries.length} 个插件全部由本站 Pages 分发，共 ${totalMB.toFixed(1)} MB${
    parts ? `；分片分发：${parts}` : ''
  }`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const summaries = verifyAddonHosting();
    console.log(describeHosting(summaries));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
