import { posix } from 'node:path';

// 无限服客户端（1.60.1 / Interface 16001）同时认 Camelot 与 Forever 两种 flavor 后缀，
// 且 Camelot 的优先级更高——同一目录下只要存在 *_Camelot.toc，客户端就会优先用它。
// 上游插件包陆续停止附带 *_Camelot.toc，而网页端安装器只覆盖写入、不删除旧文件，
// 于是用户本地残留的旧版 Camelot 清单会压过新下载的代码：Questie 12.10.0 的清单缺
// Modules\Map\ProfessionStations.lua，配 12.12.0 的模块就让 OnLogin 直接 nil 报错。
//
// 这里对每个随网站分发的插件包做两件事，覆盖所有插件而不只是 Questie：
//   1) 对齐：任何 *_Forever.toc 都补一份内容完全一致的 *_Camelot.toc（缺失补建、内容不同覆盖），
//      反向也补齐（只有 Camelot 时补 Forever），保证客户端无论加载哪一份都是本期代码；
//   2) 校验：所有 TOC 引用的文件必须真的在包里，且 Forever / Camelot 两份清单必须字节一致，
//      不满足就让 fetch-addons 构建失败，把「清单与代码漂移」挡在发布之前。

/** 客户端优先级更高的 flavor 后缀，以及需要与之一致的别名后缀 */
const CANONICAL_FLAVOR = 'Forever';
const CLIENT_PREFERRED_FLAVOR = 'Camelot';

/** 可能出现在 TOC 文件名里的 flavor 后缀（Questie 用 `_`，QuestieTrace 用 `-`） */
const FLAVOR_SUFFIX_RE = /^(.*)([_-])(Forever|Camelot)\.toc$/i;

/**
 * 只看插件根目录下的 TOC（跳过 Libs/ 等子目录里的库内清单）
 * @param {import('jszip')} zip
 * @returns {Array<{ path: string, dir: string, file: string }>}
 */
function rootLevelTocs(zip) {
  const tocs = [];
  for (const [entryPath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const parts = entryPath.split('/');
    if (parts.length !== 2) continue;
    if (!/\.toc$/i.test(parts[1])) continue;
    tocs.push({ path: entryPath, dir: parts[0], file: parts[1] });
  }
  return tocs;
}

/**
 * 把 TOC 文件名里的 flavor 后缀换成另一个 flavor，保留原有的分隔符
 * @param {string} fileName
 * @param {'Forever'|'Camelot'} flavor
 * @returns {string|null}
 */
function replaceFlavor(fileName, flavor) {
  const m = fileName.match(FLAVOR_SUFFIX_RE);
  if (!m) return null;
  return `${m[1]}${m[2]}${flavor}.toc`;
}

/**
 * 在 zip 里按大小写不敏感方式定位同名条目（README 与 TOC 的大小写常来自不同来源）
 * @param {import('jszip')} zip
 * @param {string} entryPath
 * @returns {string|null}
 */
function findEntryIgnoreCase(zip, entryPath) {
  if (zip.file(entryPath)) return entryPath;
  const lower = entryPath.toLowerCase();
  for (const key of Object.keys(zip.files)) {
    if (key.toLowerCase() === lower) return key;
  }
  return null;
}

/**
 * 把 flavor 别名清单补成与权威清单字节一致（缺失补建、内容不同覆盖）
 * @param {import('jszip')} zip
 * @returns {Promise<string[]>} 实际写入的路径
 */
export async function syncFlavorTocs(zip) {
  const written = [];
  const tocs = rootLevelTocs(zip);

  // 第一轮：Forever 是权威版本，覆盖任何残留的 Camelot 清单
  const canonical = [];
  for (const toc of tocs) {
    const m = toc.file.match(FLAVOR_SUFFIX_RE);
    if (!m || m[3].toLowerCase() !== CANONICAL_FLAVOR.toLowerCase()) continue;
    canonical.push({ toc, targetFile: replaceFlavor(toc.file, CLIENT_PREFERRED_FLAVOR) });
  }

  for (const { toc, targetFile } of canonical) {
    const targetPath = `${toc.dir}/${targetFile}`;
    const sourceBuf = await zip.file(toc.path).async('nodebuffer');
    const existingPath = findEntryIgnoreCase(zip, targetPath);
    if (existingPath) {
      const existingBuf = await zip.file(existingPath).async('nodebuffer');
      if (existingBuf.equals(sourceBuf)) continue;
    }
    zip.file(targetPath, sourceBuf);
    written.push(targetPath);
  }

  // 第二轮：只有 Camelot 没有 Forever 的包，补一份 Forever，保证扫描器与客户端读到同一份清单
  const camelotOnly = [];
  for (const toc of tocs) {
    const m = toc.file.match(FLAVOR_SUFFIX_RE);
    if (!m || m[3].toLowerCase() !== CLIENT_PREFERRED_FLAVOR.toLowerCase()) continue;
    const counterpartFile = replaceFlavor(toc.file, CANONICAL_FLAVOR);
    // tocs 是同步前的快照，这里按当前 zip 状态判断是否已有 Forever
    if (findEntryIgnoreCase(zip, `${toc.dir}/${counterpartFile}`)) continue;
    camelotOnly.push({ toc, targetFile: counterpartFile });
  }

  for (const { toc, targetFile } of camelotOnly) {
    const source = zip.file(toc.path);
    if (!source) continue; // 第一轮可能刚把它替换掉
    const sourceBuf = await source.async('nodebuffer');
    zip.file(`${toc.dir}/${targetFile}`, sourceBuf);
    written.push(`${toc.dir}/${targetFile}`);
  }

  return written;
}

/**
 * 解析 TOC 里声明要加载的文件（忽略注释与空行）
 * @param {string} tocText
 * @returns {string[]}
 */
function tocEntries(tocText) {
  const entries = [];
  for (const rawLine of tocText.split(/\r?\n/)) {
    const line = rawLine.replace(/^\uFEFF/, '').trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    if (!/\.(lua|xml)$/i.test(line)) continue;
    entries.push(line.replace(/\\/g, '/').replace(/^\.\//, ''));
  }
  return entries;
}

/**
 * 把 TOC 里的相对路径解析成包内路径（BagBrother 等子插件会用 `..\` 跨目录引用）
 * @param {string} addonDir 插件根目录名
 * @param {string} rel TOC 中的相对路径
 * @returns {string}
 */
function resolveTocEntry(addonDir, rel) {
  const joined = rel.startsWith('/') ? rel.slice(1) : `${addonDir}/${rel}`;
  return posix.normalize(joined).replace(/^\.\//, '');
}

/**
 * 校验插件包的 flavor 清单是否自洽
 * @param {import('jszip')} zip
 * @returns {Promise<string[]>} 问题描述，空数组表示通过
 */
export async function validateFlavorTocs(zip) {
  const problems = [];
  const tocs = rootLevelTocs(zip);
  const allEntries = new Set(Object.keys(zip.files).map(p => p.toLowerCase()));

  for (const toc of tocs) {
    const text = await zip.file(toc.path).async('string');
    const missing = tocEntries(text).filter(rel => {
      const resolved = resolveTocEntry(toc.dir, rel);
      return !allEntries.has(resolved.toLowerCase());
    });
    if (missing.length > 0) {
      problems.push(`${toc.path} 引用了包内不存在的文件：${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` 等 ${missing.length} 个` : ''}`);
    }
  }

  // Forever 与 Camelot 必须同时存在且字节一致
  for (const toc of tocs) {
    const m = toc.file.match(FLAVOR_SUFFIX_RE);
    if (!m || m[3].toLowerCase() !== CANONICAL_FLAVOR.toLowerCase()) continue;
    const aliasFile = replaceFlavor(toc.file, CLIENT_PREFERRED_FLAVOR);
    const aliasPath = findEntryIgnoreCase(zip, `${toc.dir}/${aliasFile}`);
    if (!aliasPath) {
      problems.push(`${toc.path} 缺少配套的 ${aliasFile}（客户端会优先加载 Camelot flavor）`);
      continue;
    }
    const [canonicalBuf, aliasBuf] = await Promise.all([
      zip.file(toc.path).async('nodebuffer'),
      zip.file(aliasPath).async('nodebuffer'),
    ]);
    if (!canonicalBuf.equals(aliasBuf)) {
      problems.push(`${aliasPath} 与 ${toc.path} 内容不一致（半更新会导致初始化报错）`);
    }
  }

  return problems;
}
