/**
 * 校验「所有插件都由本站 Pages 分发」这条硬约束。
 *
 * 背景：OpenMap 的 Forever 包 198 MB，超过 Cloudflare Pages 25 MiB 单文件上限，
 * 早先只能让用户直连 GitHub；现在改成构建期切分片。为了避免以后又悄悄回退成外链，
 * 这里在构建收尾和 CI 里各校验一次：每个插件都必须能在 public/ 下找到自己的产物。
 *
 * 用法：
 *   node scripts/addon-hosting.js                 # 按 src/generated/addon-versions.json 校验全部
 *   (在 fetch-addons.js 内) verifyAddonHosting({ ids, addonsDir })
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** 与 scripts/fetch-addons.js 的 PAGES_MAX_FILE_BYTES 保持一致 */
export const PAGES_MAX_FILE_BYTES = 25 * 1024 * 1024;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ADDONS_DIR = path.resolve(SCRIPT_DIR, '../public/addons');
const DEFAULT_MANIFEST = path.resolve(SCRIPT_DIR, '../src/generated/addon-versions.json');

/**
 * 校验指定插件 id 的安装包是否都能从本站拿到
 * @param {object} options
 * @param {string[]} [options.ids] 要校验的插件 id，省略时取版本清单里的全部条目
 * @param {string} [options.addonsDir] public/addons 目录
 * @param {string} [options.manifestPath] 版本清单路径
 * @param {Record<string, { version?: string, source?: string }>} [options.manifest] 已加载的版本清单
 * @returns {{ id: string, kind: 'zip' | 'parts', bytes: number, files: number }[]} 校验通过的产物摘要
 * @throws {Error} 有插件缺少产物、超过单文件上限，或被配置成外部下载源
 */
export function verifyAddonHosting(options = {}) {
  const addonsDir = options.addonsDir ?? DEFAULT_ADDONS_DIR;
  const manifestPath = options.manifestPath ?? DEFAULT_MANIFEST;
  const manifest =
    options.manifest ??
    (fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) : {});
  const ids = options.ids ?? Object.keys(manifest);
  const problems = [];
  const ok = [];

  for (const id of ids) {
    const entry = manifest[id] ?? {};

    // openmap 走分片：清单必须是本站路径，且每个分片都在
    if (id === 'openmap') {
      if (entry.source && /^https?:\/\//i.test(entry.source)) {
        problems.push(`openmap: 版本清单记录的是外部地址 ${entry.source}`);
        continue;
      }
      const manifestFile = path.join(addonsDir, 'openmap', 'parts.json');
      if (!fs.existsSync(manifestFile)) {
        problems.push('openmap: 缺少 public/addons/openmap/parts.json');
        continue;
      }
      let parts = [];
      try {
        parts = JSON.parse(fs.readFileSync(manifestFile, 'utf-8')).parts ?? [];
      } catch (e) {
        problems.push(`openmap: parts.json 解析失败 ${e.message}`);
        continue;
      }
      if (parts.length === 0) {
        problems.push('openmap: parts.json 里没有任何分片');
        continue;
      }
      const missing = [];
      let bytes = 0;
      let oversized = 0;
      for (const rel of parts) {
        const file = path.join(addonsDir, 'openmap', ...rel.split('/'));
        if (!fs.existsSync(file)) {
          missing.push(rel);
          continue;
        }
        const size = fs.statSync(file).size;
        bytes += size;
        if (size > PAGES_MAX_FILE_BYTES) oversized++;
      }
      if (missing.length > 0) {
        problems.push(`openmap: 缺少分片 ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ' …' : ''}`);
      }
      if (oversized > 0) {
        problems.push(`openmap: ${oversized} 个分片超过 Pages 单文件上限`);
      }
      if (missing.length === 0 && oversized === 0) {
        ok.push({ id, kind: 'parts', bytes, files: parts.length });
      }
      continue;
    }

    const zipPath = path.join(addonsDir, `${id}.zip`);
    if (!fs.existsSync(zipPath)) {
      problems.push(`${id}: 缺少 public/addons/${id}.zip`);
      continue;
    }
    const size = fs.statSync(zipPath).size;
    if (size > PAGES_MAX_FILE_BYTES) {
      problems.push(`${id}: ${(size / 1024 / 1024).toFixed(2)} MiB 超过 Pages 单文件上限`);
      continue;
    }
    if (size < 200) {
      problems.push(`${id}: ${zipPath} 只有 ${size} 字节，可能是下载失败的空壳`);
      continue;
    }
    ok.push({ id, kind: 'zip', bytes: size, files: 1 });
  }

  if (problems.length > 0) {
    throw new Error(
      `[Hosting] 以下插件无法由本站 Pages 分发：\n  - ${problems.join('\n  - ')}`
    );
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
