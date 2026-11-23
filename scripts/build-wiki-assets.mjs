/**
 * 生成网页「无限百科」页面所需的 Lua 资源（public/wiki/*.lua）。
 *
 * 由 npm 的 predev / prebuild 自动调用，保证干净检出的仓库直接执行
 * `npm run dev` / `npm run build` 也能拿到这些文件（它们不随仓库提交）。
 *
 * 只读仓库内的数据快照，不发起任何网络请求；若本地存在 QuestieDB 缓存则会一并用于补全副本任务。
 *
 * 用法：node scripts/build-wiki-assets.mjs
 */
import path from 'node:path';
import { buildWoFWikiAssets } from './locales/wowf.js';

const publicDir = path.resolve('public');
const cacheDir = path.resolve('.cache/upstream-addons');

try {
  const wikiDir = await buildWoFWikiAssets(publicDir, cacheDir);
  console.log(`[wiki] 资源已就绪：${wikiDir}`);
} catch (err) {
  console.error('[wiki] 生成失败：', err.message);
  process.exit(1);
}
