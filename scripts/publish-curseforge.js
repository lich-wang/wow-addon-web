#!/usr/bin/env node
/**
 * 将打包好的 WoWF 插件包（默认 public/addons/wowf.zip）发布到 CurseForge。
 *
 * 用法：
 *   # 本地预演：只打印将上传的 metadata，不发任何写请求
 *   CF_API_TOKEN=xxx CF_PROJECT_ID=123456 node scripts/publish-curseforge.js --dry-run
 *
 *   # 正式上传（changelog 由 CI 生成）
 *   CF_API_TOKEN=xxx CF_PROJECT_ID=123456 node scripts/publish-curseforge.js --changelog-file changelog.md
 *
 * 注意事项：
 *   - CurseForge 的 API 只能上传文件，不能创建项目。项目需先在
 *     https://authors.curseforge.com 手工创建，并在 API Tokens 页生成 token。
 *   - 接口：POST /api/projects/{projectId}/upload-file，X-Api-Token 鉴权，
 *     multipart 字段为 metadata（JSON）与 file（插件包）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import JSZip from 'jszip';

const API_BASE = (process.env.CF_API_BASE || 'https://wow.curseforge.com').replace(/\/+$/, '');
const UPLOAD_PATH_TEMPLATE = process.env.CF_UPLOAD_PATH || '/api/projects/{projectId}/upload-file';
const DEFAULT_FILE = 'public/addons/wowf.zip';
// WoWF 的 toc 声明 `## Dependencies: QuestieDB`，默认把 QuestieDB 作为必需依赖一并声明，
// 这样 CurseForge 客户端安装 WoWF 时会自动带上 QuestieDB。可用 CF_RELATIONS_JSON=off 关闭。
const DEFAULT_RELATIONS = [{ slug: 'questiedb', type: 'requiredDependency' }];

const HELP = `发布 WoWF 插件包到 CurseForge

用法：
  node scripts/publish-curseforge.js [选项]

选项：
  --file <路径>           插件包路径（默认 ${DEFAULT_FILE}）
  --version <版本>        覆盖 toc 中的版本号（默认读取 ## Version）
  --display-name <名称>   覆盖 CurseForge 文件名（默认「巫妖王的无限百科 <版本>」）
  --release-type <类型>   release | beta | alpha（默认 release）
  --changelog <文本>      变更说明（Markdown）
  --changelog-file <路径> 从文件读取变更说明（优先级低于 --changelog）
  --game-version <值>     游戏版本 ID 或精确名称（默认按 ## Interface 推导，如 16001 → 1.60.1）
  --project-id <ID>       覆盖 CF_PROJECT_ID
  --dry-run               只打印 metadata，不发起上传
  --help, -h              显示本帮助

环境变量：
  CF_API_TOKEN            必填。CurseForge API token（X-Api-Token）
  CF_PROJECT_ID           必填。CurseForge 项目数字 ID
  CF_GAME_VERSION         可选。游戏版本 ID 或名称
  CF_RELATIONS_JSON       可选。项目依赖，默认 [{"slug":"questiedb","type":"requiredDependency"}]，
                          设为 off 可关闭默认依赖
  CF_API_BASE             可选。默认 ${API_BASE}
  CF_UPLOAD_PATH          可选。默认 ${UPLOAD_PATH_TEMPLATE}
`;

function parseArgs(argv) {
  const opts = { file: DEFAULT_FILE, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
      continue;
    }
    if (arg === '--dry-run') {
      opts.dryRun = true;
      continue;
    }
    const eq = arg.indexOf('=');
    const key = eq === -1 ? arg : arg.slice(0, eq);
    const inline = eq === -1 ? undefined : arg.slice(eq + 1);
    const takeValue = () => {
      if (inline !== undefined) return inline;
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        throw new Error(`选项 ${key} 缺少值`);
      }
      i += 1;
      return next;
    };
    switch (key) {
      case '--file':
        opts.file = takeValue();
        break;
      case '--version':
        opts.version = takeValue();
        break;
      case '--display-name':
        opts.displayName = takeValue();
        break;
      case '--release-type':
        opts.releaseType = takeValue();
        break;
      case '--changelog':
        opts.changelog = takeValue();
        break;
      case '--changelog-file':
        opts.changelogFile = takeValue();
        break;
      case '--game-version':
        opts.gameVersion = takeValue();
        break;
      case '--project-id':
        opts.projectId = takeValue();
        break;
      default:
        throw new Error(`未知选项：${arg}（用 --help 查看用法）`);
    }
  }
  return opts;
}

function readTocField(toc, field) {
  const match = toc.match(new RegExp(`^##\\s*${field}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim() : null;
}

/** 从 "v1.2.51 + DB v2026.11.14" 提取短版本号 "1.2.51" */
function shortVersion(rawVersion) {
  const match = String(rawVersion || '').match(/v?(\d+(?:\.\d+){0,2})/i);
  return match ? match[1] : String(rawVersion || 'unknown').trim();
}

/** 把 toc 的 Interface 版本号（如 16001）换算为游戏版本（1.60.1） */
function gameVersionFromInterface(interfaceVersion) {
  const value = Number.parseInt(String(interfaceVersion || ''), 10);
  if (!Number.isFinite(value) || value <= 0) return null;
  const major = Math.floor(value / 10000);
  const minor = Math.floor((value % 10000) / 100);
  const patch = value % 100;
  return `${major}.${minor}.${patch}`;
}

/** 将版本名/ID 归一为数字序列，兼容 "1.60.1"、"1-60-1"、"1.60.01" */
function versionKey(value) {
  const parts = String(value ?? '').match(/\d+/g);
  return parts ? parts.map(part => String(Number.parseInt(part, 10))).join('.') : '';
}

function resolveGameVersion(versions, spec) {
  const list = versions.filter(item => item && item.id !== undefined && item.id !== null);
  const raw = String(spec ?? '').trim();
  if (!raw) throw new Error('缺少游戏版本，请用 --game-version 或 CF_GAME_VERSION 指定');

  if (/^\d+$/.test(raw)) {
    const byId = list.find(item => String(item.id) === raw);
    if (byId) return byId;
    throw new Error(`CurseForge 游戏版本列表中没有 ID ${raw}`);
  }

  const key = versionKey(raw);
  const exact = list.filter(item => versionKey(item.name) === key || versionKey(item.slug) === key);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    throw new Error(
      `${raw} 匹配到多个 CurseForge 游戏版本（${exact.map(item => `${item.name}#${item.id}`).join('、')}），请用 CF_GAME_VERSION 指定版本 ID。`
    );
  }

  const family = key.split('.').slice(0, 2).join('.');
  const available = list
    .map(item => item.name)
    .filter(name => String(name).startsWith(family))
    .slice(0, 12)
    .join('、');
  throw new Error(
    `CurseForge 游戏版本列表中没有精确匹配 ${raw} 的版本${available ? `（同系列候选：${available}）` : ''}。` +
      '请用 CF_GAME_VERSION 指定版本 ID 或该版本在 CurseForge 上的精确名称，避免把文件标记为错误的游戏版本。'
  );
}

function parseRelations(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return DEFAULT_RELATIONS;
  if (value === 'off' || value === 'none' || value === '[]') return [];
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('CF_RELATIONS_JSON 不是合法 JSON，示例：[{"slug":"questiedb","type":"requiredDependency"}]，或设为 off 关闭默认依赖');
  }
  if (!Array.isArray(parsed)) throw new Error('CF_RELATIONS_JSON 必须是数组，或设为 off 关闭默认依赖');
  return parsed.filter(item => item && item.slug && item.type);
}

function defaultChangelog() {
  try {
    const tag = execFileSync('git', ['describe', '--tags', '--exact-match', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    let range = 'HEAD';
    try {
      const previous = execFileSync('git', ['describe', '--tags', '--abbrev=0', `${tag}^`], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      range = `${previous}..${tag}`;
    } catch {
      // 第一个 tag：直接列出全部提交
    }
    const log = execFileSync('git', ['log', '--pretty=format:- %s (%h)', '--no-merges', range], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return [`### ${tag}`, '', log || '- WoWF 数据同步与细节修复', '', '数据来源：https://wowf.io/zh'].join('\n');
  } catch {
    return 'WoWF 数据同步与细节修复。';
  }
}

async function fetchGameVersions(token) {
  const response = await fetch(`${API_BASE}/api/game/versions`, {
    headers: { 'X-Api-Token': token, Accept: 'application/json' },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`获取 CurseForge 游戏版本失败（HTTP ${response.status}）：${text.slice(0, 300)}`);
  }
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`CurseForge 游戏版本接口返回了非 JSON 内容：${text.slice(0, 200)}`);
  }
  const versions = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : null;
  if (!versions) throw new Error('CurseForge 游戏版本接口返回格式无法识别（既不是数组也没有 data 字段）');
  return versions;
}

function buildMetadata({ changelog, displayName, releaseType, gameVersion, relations }) {
  const metadata = {
    changelog,
    changelogType: 'markdown',
    displayName,
    releaseType,
  };
  if (gameVersion?.id !== undefined && gameVersion?.id !== null) {
    metadata.gameVersions = [Number(gameVersion.id)];
  }
  if (relations.length > 0) {
    metadata.relations = { projects: relations };
  }
  return metadata;
}

async function uploadFile({ token, projectId, metadata, buffer, fileName }) {
  const url = `${API_BASE}${UPLOAD_PATH_TEMPLATE.replace('{projectId}', encodeURIComponent(projectId))}`;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const form = new FormData();
    form.append('metadata', JSON.stringify(metadata));
    form.append('file', new Blob([buffer], { type: 'application/zip' }), fileName);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'X-Api-Token': token },
      body: form,
    });
    const text = await response.text();
    if (response.ok) {
      try {
        return JSON.parse(text);
      } catch {
        return { raw: text };
      }
    }
    const retriable = response.status >= 500 || response.status === 429;
    if (retriable && attempt === 1) {
      console.warn(`[CurseForge] HTTP ${response.status}，2 秒后重试…`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      continue;
    }
    const hint =
      response.status === 401 || response.status === 403
        ? '（请检查 CF_API_TOKEN 是否有效、是否属于该项目成员）'
        : '';
    throw new Error(`上传失败（HTTP ${response.status}）${hint}：${text.slice(0, 500)}`);
  }
  throw new Error('上传失败：重试后仍未成功');
}

/** 显式 --project-id 必须是数字，避免空串静默回退到 CF_PROJECT_ID 后上传到错误项目 */
function resolveProjectId(opts) {
  if (opts.projectId !== undefined) {
    const value = String(opts.projectId).trim();
    if (!/^\d+$/.test(value)) {
      throw new Error(`--project-id 必须是非空的数字 ID，收到：${JSON.stringify(opts.projectId)}`);
    }
    return value;
  }
  return process.env.CF_PROJECT_ID;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(HELP);
    return;
  }

  const filePath = path.resolve(opts.file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`找不到插件包 ${filePath}，请先执行：node scripts/fetch-addons.js --only=wowf`);
  }

  const fileBuffer = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(fileBuffer);
  const tocEntry = zip.file('WoWF/WoWF.toc');
  if (!tocEntry) throw new Error(`${filePath} 中缺少 WoWF/WoWF.toc，不是有效的 WoWF 插件包`);
  const toc = await tocEntry.async('string');

  const rawVersion = opts.version || readTocField(toc, 'Version');
  if (!rawVersion) throw new Error('无法从 toc 读取 ## Version，请用 --version 指定');
  const version = shortVersion(rawVersion);
  const interfaceVersion = readTocField(toc, 'Interface');
  const derivedGameVersion = gameVersionFromInterface(interfaceVersion);
  const displayName = opts.displayName || `巫妖王的无限百科 ${version}`;
  const releaseType = opts.releaseType || 'release';
  if (!['release', 'beta', 'alpha'].includes(releaseType)) {
    throw new Error(`--release-type 只能是 release / beta / alpha，收到：${releaseType}`);
  }

  let changelog = opts.changelog;
  if (!changelog && opts.changelogFile) {
    changelog = fs.readFileSync(path.resolve(opts.changelogFile), 'utf8').trim();
  }
  if (!changelog) changelog = defaultChangelog();

  const token = process.env.CF_API_TOKEN;
  const projectId = resolveProjectId(opts);
  const gameVersionSpec = opts.gameVersion || process.env.CF_GAME_VERSION || derivedGameVersion;
  const relations = parseRelations(process.env.CF_RELATIONS_JSON);

  let gameVersion = null;
  if (token) {
    const versions = await fetchGameVersions(token);
    gameVersion = resolveGameVersion(versions, gameVersionSpec);
  }

  const metadata = buildMetadata({ changelog, displayName, releaseType, gameVersion, relations });
  const fileName = `WoWF-${version.replace(/[^\w.-]+/g, '-')}.zip`;

  console.log('[CurseForge] 插件包：', filePath);
  console.log(`[CurseForge] toc 版本：${rawVersion} → 文件版本 ${version}`);
  console.log(`[CurseForge] Interface：${interfaceVersion || '未知'} → 推导游戏版本 ${derivedGameVersion || '未知'}`);
  if (gameVersion) {
    console.log(`[CurseForge] 游戏版本：${gameVersion.name}（ID ${gameVersion.id}）`);
  } else {
    console.log('[CurseForge] 游戏版本：未解析（未提供 CF_API_TOKEN 或 ID），将不包含 gameVersions 字段');
  }
  console.log('[CurseForge] metadata：');
  console.log(JSON.stringify(metadata, null, 2));

  if (opts.dryRun) {
    console.log('[CurseForge] dry-run：未发起上传。');
    return;
  }

  if (!token || !projectId) {
    throw new Error(
      '缺少 CF_API_TOKEN / CF_PROJECT_ID。\n' +
        '  1. 在 https://authors.curseforge.com/#/settings/api-tokens 生成 token\n' +
        '  2. 在仓库 Secrets 中配置 CF_API_TOKEN 与 CF_PROJECT_ID（项目页 URL 中的数字 ID）'
    );
  }

  const result = await uploadFile({ token, projectId, metadata, buffer: fileBuffer, fileName });
  if (result?.id !== undefined) {
    const slug = process.env.CF_PROJECT_SLUG;
    const url = slug
      ? `https://www.curseforge.com/wow/addons/${slug}/files/${result.id}`
      : `https://www.curseforge.com/projects/${projectId}`;
    console.log(`[✓] 已上传到 CurseForge：file ID ${result.id}（${url}）`);
  } else {
    console.log('[✓] 已上传到 CurseForge：', JSON.stringify(result));
  }
}

main().catch(error => {
  console.error(`[✗] 发布 CurseForge 失败：${error.message}`);
  process.exit(1);
});
