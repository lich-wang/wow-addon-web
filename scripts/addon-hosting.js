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
 * 校验 OpenMap 分块清单与分块文件。
 *
 * 支持两种清单格式：
 * - format 2（当前）：`chunks` 是按内容寻址的去重块表，`parts` 是顺序拼接列表。逐块校验
 *   「长度符合清单 + 文件内容 sha256 与文件名一致」，再按 parts 顺序累加长度并复算整包 sha256。
 * - 旧格式（无 format、有 partSize）：固定偏移切片，只校验长度与整包 sha256。
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
  if (parts.length === 0 || totalSize <= 0) {
    problems.push('openmap: parts.json 缺少分片列表或 totalSize');
    return null;
  }
  // 构建端一定会写 sha256；缺失说明清单被改坏或来自旧版本，不能靠长度兜底
  if (!/^[0-9a-f]{64}$/i.test(String(partsManifest.sha256 || ''))) {
    problems.push('openmap: parts.json 缺少有效的 sha256');
    return null;
  }

  // 分片路径相对于清单所在目录解析（而不是固定 openmap/），保证门禁校验的
  // 正是客户端按清单请求的那批文件
  const partsBaseDir = path.dirname(manifestFile);
  const isChunked = Number(partsManifest.format) >= 2 && Array.isArray(partsManifest.chunks);
  const declaredSize = new Map();
  if (isChunked) {
    for (const chunk of partsManifest.chunks) {
      const digest = String(chunk?.sha256 || '').toLowerCase();
      const size = Number(chunk?.size) || 0;
      if (!/^[0-9a-f]{64}$/.test(digest) || size <= 0) {
        problems.push('openmap: chunks 条目缺少有效的 sha256 或 size');
        return null;
      }
      declaredSize.set(digest, size);
    }
  }

  const missing = [];
  const truncated = [];
  const badDigest = [];
  let sum = 0;
  let oversized = 0;
  const hash = crypto.createHash('sha256');

  for (let i = 0; i < parts.length; i++) {
    const partRel = String(parts[i]);
    const file = path.join(partsBaseDir, ...partRel.split('/'));
    if (!file.startsWith(partsBaseDir + path.sep)) {
      problems.push(`openmap: 分片路径越界 ${partRel}`);
      return null;
    }
    const stat = fs.statSync(file, { throwIfNoEntry: false });
    if (!stat || !stat.isFile()) {
      missing.push(partRel);
      continue;
    }
    if (stat.size > PAGES_MAX_FILE_BYTES) {
      // 超限的分片已经部署不了，别为它把整片读进内存算哈希
      problems.push(`openmap: ${partRel} 超过 Pages 单文件上限`);
      oversized++;
      continue;
    }
    // 内容寻址块：文件名就是内容 sha256，长度也必须与清单一致。
    // format 2 的每条 parts 都必须是这种命名——客户端按 `([0-9a-f]{64})\.bin$`
    // 从路径反解 sha 再查 chunks 表，路径不合格的清单客户端会直接拒绝，
    // 所以不能让它在托管校验这里混进旧格式分支而放行。
    const nameDigest = /^([0-9a-f]{64})\.bin$/i.exec(path.basename(file));
    if (isChunked) {
      if (!nameDigest) {
        problems.push(`openmap: format 2 的块路径 ${partRel} 不是 <sha256>.bin 命名，客户端会拒绝安装`);
        return null;
      }
      const digest = nameDigest[1].toLowerCase();
      const expected = declaredSize.get(digest);
      if (expected === undefined) {
        problems.push(`openmap: 块 ${partRel} 不在清单 chunks 里`);
        return null;
      }
      if (stat.size !== expected) {
        truncated.push(`${partRel} 实际 ${stat.size} 预期 ${expected}`);
        continue;
      }
      const content = fs.readFileSync(file);
      if (crypto.createHash('sha256').update(content).digest('hex') !== digest) {
        badDigest.push(partRel);
        continue;
      }
      sum += stat.size;
      hash.update(content);
      continue;
    }
    // 旧格式（固定偏移）：只能按顺序累加后由整包 sha256 兜底
    const partSize = Number(partsManifest.partSize) || 0;
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
  if (badDigest.length > 0) {
    problems.push(`openmap: 分块内容与文件名 sha256 不符（${badDigest.slice(0, 3).join(', ')}）`);
    return null;
  }
  if (oversized > 0) {
    return null;
  }
  if (sum !== totalSize) {
    problems.push(`openmap: 分片总长 ${sum} 与清单 totalSize ${totalSize} 不一致`);
    return null;
  }
  const actual = hash.digest('hex');
  if (actual !== String(partsManifest.sha256).toLowerCase()) {
    problems.push(`openmap: 分片拼接后的 sha256 与清单不一致（${actual.slice(0, 12)}…）`);
    return null;
  }

  return { id: 'openmap', kind: 'parts', bytes: sum, files: isChunked ? declaredSize.size : parts.length };
}

/**
 * 快速判断文件是不是 ZIP（检查末尾的 End of Central Directory 签名）。
 * 用来拦住「下载失败但写了 1 KB HTML 错误页」这种情况，不解析整个压缩包。
 * @param {string} file 文件路径
 * @returns {boolean}
 */
function hasZipEndRecord(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const size = fs.fstatSync(fd).size;
    if (size < 22) return false;
    // EOCD 固定 22 字节，注释最长 64 KiB
    const tailSize = Math.min(size, 66 * 1024);
    const tail = Buffer.alloc(tailSize);
    fs.readSync(fd, tail, 0, tailSize, size - tailSize);
    return tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])) >= 0;
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
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
    if (!hasZipEndRecord(zipPath)) {
      problems.push(`${id}: ${id}.zip 不是有效 ZIP（可能是下载失败写进来的错误页）`);
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
