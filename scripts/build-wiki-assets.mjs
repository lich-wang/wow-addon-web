/**
 * 生成网页「无限百科」页面所需的 Lua 资源（public/wiki/*.lua）。
 *
 * 由 npm 的 predev / prebuild 自动调用，保证干净检出的仓库直接执行
 * `npm run dev` / `npm run build` 也能拿到这些文件（它们不随仓库提交）。
 *
 * 一致性策略：若三份产物已存在，且都新于「插件 Lua 源码 + 数据快照」的修改时间，
 * 则直接复用——此时它们就是 fetch-addons.js 在同一次打包里写出的版本，与 wowf.zip 完全一致；
 * 一旦源码或快照更新（或产物缺失），才重新生成。
 *
 * 只读仓库内的数据快照与本地 QuestieDB 缓存，不发起任何网络请求。
 *
 * 用法：node scripts/build-wiki-assets.mjs [--force]
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildWoFWikiAssets } from './locales/wowf.js';

const publicDir = path.resolve('public');
const wikiDir = path.join(publicDir, 'wiki');
const cacheDir = path.resolve('.cache/upstream-addons');

const OUTPUTS = ['data.lua', 'core.lua', 'craftarb.lua'];
const INPUTS = [
  path.resolve('addons/WoWF/WoWF.lua'),
  path.resolve('addons/WoWF/CraftArb.lua'),
  path.resolve('scripts/locales/wowf-dataset.json'),
];

const force = process.argv.includes('--force');
const mtime = (file) => (fs.existsSync(file) ? fs.statSync(file).mtimeMs : Number.POSITIVE_INFINITY);

const outputsReady = OUTPUTS.every((name) => fs.existsSync(path.join(wikiDir, name)));
const newestInput = Math.max(...INPUTS.map(mtime));
const oldestOutput = outputsReady ? Math.min(...OUTPUTS.map((name) => mtime(path.join(wikiDir, name)))) : -1;

if (!force && outputsReady && oldestOutput >= newestInput) {
  console.log(`[wiki] 复用已有资源（与打包产物同批生成）：${wikiDir}`);
  process.exit(0);
}

try {
  const written = await buildWoFWikiAssets(publicDir, cacheDir);
  console.log(`[wiki] 资源已就绪：${written}`);
} catch (err) {
  console.error('[wiki] 生成失败：', err.message);
  process.exit(1);
}
