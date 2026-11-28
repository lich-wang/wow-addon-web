import type { AddonInfo, CuratedAddon, InstallProgress } from '../types/addon';
import { installAddonFromZip } from './fsService';
import {
  downloadParts,
  downloadWithProgress,
  fetchPartsManifest,
  formatBytes,
  releaseDownloadCache,
} from './downloadService';
import bundledAddonVersions from '../generated/addon-versions.json';

type BundledVersionManifest = Record<string, { version?: string; source?: string } | undefined>;

/**
 * 读取打包脚本 (scripts/fetch-addons.js) 从实际分发产物 TOC 中解析出的版本号，拼接展示用后缀。
 * 版本号不再在此手工维护：每次部署/自动同步时脚本会拉取上游最新正式版并重写版本清单。
 * @param id - 精选插件 id
 * @param label - 版本后缀说明（如 "官方中文版"）
 * @returns 用于展示与更新比对的最新版本字符串
 */
function bundledVersion(id: string, label: string): string {
  const version = (bundledAddonVersions as BundledVersionManifest)[id]?.version;
  return version ? `${version} (${label})` : `未知版本 (${label})`;
}

/**
 * 读取打包清单中记录的上游下载地址（用于体积超过 Pages 单文件限制、改为直连/代理分发的插件）
 */
function bundledSource(id: string, fallback: string): string {
  return (bundledAddonVersions as BundledVersionManifest)[id]?.source || fallback;
}

export const POPULAR_ADDONS: CuratedAddon[] = [
  {
    id: 'sbf',
    name: 'Single-Button Fishing (单键钓鱼)',
    description: '无限服与经典版本钓鱼必备神器！一键完成整个钓鱼循环（自动甩竿、浮漂交互、高速拾取、换竿上饵与音频聚焦增强），内置全套简体中文与按键绑定。',
    author: 'Goblin Engineering Company',
    category: 'QoL',
    icon: 'Compass',
    defaultFolderName: 'SBF',
    latestVersion: bundledVersion('sbf', '中文版'),
    downloadUrl: '/addons/sbf.zip',
    githubRepo: 'Goblin-Engineering-Company/SBF',
    homeUrl: 'https://goblineng.co',
    gameFlavors: ['forever', 'classic', 'retail', 'vanilla'],
    isForeverRecommended: true,
  },
  {
    id: 'blackthornes-tradeskills',
    name: 'Blackthornes Tradeskills (黑石交易技能)',
    description: '《魔兽世界：无限服》专属商业利器！实时扫描拍卖行计算最高利润配方、排队批量制造、智能购物清单与防亏损一口价上架，内置 3200+ 条精校简体中文。',
    author: 'Blackthornes',
    category: 'Trade',
    icon: 'Coins',
    defaultFolderName: 'Blackthornes_TS',
    latestVersion: bundledVersion('blackthornes-tradeskills', 'Forever 中文版'),
    downloadUrl: '/addons/blackthornes-tradeskills.zip',
    githubRepo: 'Blackthornes/Blackthornes_Tradeskills',
    homeUrl: 'https://www.curseforge.com/wow/addons/blackthornes-tradeskills',
    gameFlavors: ['forever', 'classic', 'vanilla'],
    isForeverRecommended: true,
  },
  {
    id: 'icehud',
    name: 'IceHUD (弧形战斗抬头显示)',
    description: '高度可定制的弧形平视框架（HUD），将角色生命值、法力/能量、施法条与目标状态直观居中展现于视野中央，补全 260+ 条缺失汉化。',
    author: 'parnic',
    category: 'UI',
    icon: 'Eye',
    defaultFolderName: 'IceHUD',
    latestVersion: bundledVersion('icehud', '全汉化版'),
    downloadUrl: '/addons/icehud.zip',
    githubRepo: 'parnic/ice-hud',
    homeUrl: 'https://www.curseforge.com/wow/addons/ice-hud',
    gameFlavors: ['forever', 'classic', 'retail', 'vanilla'],
    isForeverRecommended: true,
  },
  {
    id: 'dungeonsforever',
    name: 'Dungeonsforever (无限副本手册)',
    description: '专为经典旧世与无限服打造的内置综合地下城手册！提供全副本概览一览表、首领掉落全景表、副本任务指引与地图标记、野外专业与探索手册，作者原生全中文支持。',
    author: 'yuanyuande',
    category: 'Raid',
    icon: 'LayoutGrid',
    defaultFolderName: 'DungeonsForever',
    latestVersion: bundledVersion('dungeonsforever', '原生中文'),
    downloadUrl: '/addons/dungeonsforever.zip',
    homeUrl: 'https://www.curseforge.com/wow/addons/dungeonsforever',
    gameFlavors: ['forever', 'classic', 'retail', 'vanilla'],
    isForeverRecommended: true,
  },
  {
    id: 'bagnon',
    name: 'Bagnon (经典背包整合)',
    description: '魔兽世界最经典的全能背包整合神器！将所有背包合并为一个整洁直观的窗口，随时随地离线查看银行、公会银行与其他角色背包，支持快速搜索、高亮染色与分类过滤，内置官方简体中文。',
    author: 'Jaliborc & Tuller',
    category: 'UI',
    icon: 'Package',
    defaultFolderName: 'Bagnon',
    latestVersion: bundledVersion('bagnon', '官方中文版'),
    downloadUrl: '/addons/bagnon.zip',
    homeUrl: 'https://www.curseforge.com/wow/addons/bagnon',
    gameFlavors: ['forever', 'classic', 'retail', 'vanilla'],
    isForeverRecommended: true,
  },
  {
    id: 'lueur',
    name: 'Lueur (任务品与交互标记加强)',
    description: '基于暴雪软目标交互（Soft-Targeting）的高亮神器！接近矿脉、草药、任务拾取物、宝箱与钓鱼浮标时呈现绚丽光圈与光柱提示，支持小地图草药与矿石专属图标，并提供双采自动交替追踪助手。',
    author: 'Armytille',
    category: 'QoL',
    icon: 'Sparkles',
    defaultFolderName: 'Lueur',
    latestVersion: bundledVersion('lueur', '汉化增强版'),
    downloadUrl: '/addons/lueur.zip',
    homeUrl: 'https://www.curseforge.com/wow/addons/lueur',
    gameFlavors: ['forever', 'classic', 'vanilla'],
    isForeverRecommended: true,
  },
  {
    id: 'questie-forever',
    name: 'Questie Forever (全知地图任务雷达)',
    description: '无限服与怀旧服必装的全知任务地图雷达（已内置 QuestieDB 无限服离线数据库）！根据角色实际状态自动隐藏已完成任务与未解锁前置的任务，在大地图和小地图精准标出可接任务、怪物刷新点与掉落归属，零手动跳过。',
    author: 'Questie Team',
    category: 'QoL',
    icon: 'MapPin',
    defaultFolderName: 'Questie',
    latestVersion: bundledVersion('questie-forever', '中文版'),
    downloadUrl: '/addons/questie-forever.zip',
    githubRepo: 'Questie/Questie',
    homeUrl: 'https://www.curseforge.com/wow/addons/questie',
    gameFlavors: ['forever', 'classic', 'vanilla'],
    isForeverRecommended: true,
  },
  {
    id: 'forever-mouse-tooltip',
    name: 'Forever Mouse Tooltip (轻量鼠标提示跟随)',
    description: '专为无限服打造的零延迟鼠标提示（HUD/Tooltip）跟随插件！通过原生引擎锚点将原本固定在屏幕右下角的提示框实时跟随鼠标移动，彻底告别帧循环引起的“残影卡住1秒”与团队框体报错污染，支持自由微调方位、偏移、缩放、战斗隐藏及显示物品/法术/NPC ID。',
    author: 'Ninjaskurk',
    category: 'UI',
    icon: 'Eye',
    defaultFolderName: 'ForeverMouseTooltip',
    latestVersion: bundledVersion('forever-mouse-tooltip', '100%全汉化版'),
    downloadUrl: '/addons/forever-mouse-tooltip.zip',
    githubRepo: 'Ninjaskurk/forever-mouse-tooltip',
    homeUrl: 'https://www.curseforge.com/wow/addons/forever-mouse-tooltip',
    gameFlavors: ['forever', 'classic', 'retail', 'vanilla'],
    isForeverRecommended: true,
  },
  {
    id: 'openmap',
    name: 'OpenMap (无缝拼接世界地图)',
    description: '开源无缝世界地图插件（WoW Forever 专版）！将艾泽拉斯所有区域无缝拼接为一张连续地图，支持平滑缩放与拖拽浏览、航线与飞行点、路线导航、城镇NPC/副本/任务点标记，原生兼容暴雪地图与 Questie，内置简体中文支持。',
    author: 'OpenMap contributors',
    category: 'QoL',
    icon: 'Compass',
    defaultFolderName: 'OpenMap',
    latestVersion: bundledVersion('openmap', 'Forever 中文版'),
    // 分片清单（构建时切分，见 scripts/fetch-addons.js）；即使版本清单缺失也绝不留 GitHub 直链
    downloadUrl: bundledSource('openmap', '/addons/openmap/parts.json'),
    githubRepo: 'openmap-world/openmap',
    homeUrl: 'https://www.curseforge.com/wow/addons/openmap',
    gameFlavors: ['forever'],
    isForeverRecommended: true,
  },
  {
    id: 'spellactivationoverlay',
    name: 'SpellActivationOverlay (法术触发光效闪烁)',
    description: '专为无限服与怀旧服打造的暴雪原生风格法术触发警报！触发奥术飞弹速射、寒冰指、节能施法、热力迸发等效果时，直接在屏幕中央两侧闪烁法术光效并高亮对应技能栏，开箱即用、内置简体中文。',
    author: 'Vinny/Ennvina',
    category: 'Combat',
    icon: 'Sparkles',
    defaultFolderName: 'SpellActivationOverlay',
    latestVersion: bundledVersion('spellactivationoverlay', 'Forever 官方中文版'),
    downloadUrl: '/addons/spellactivationoverlay.zip',
    githubRepo: 'ennvina/spellactivationoverlay',
    homeUrl: 'https://www.curseforge.com/wow/addons/spellactivationoverlay',
    gameFlavors: ['forever', 'classic', 'vanilla', 'cata'],
    isForeverRecommended: true,
  },
  {
    id: 'wowf',
    name: '巫妖王的无限百科',
    description: '《魔兽世界：无限服》专属离线百科！内置完整数据快照，根据当前角色的等级、职业、专精、种族与阵营自动匹配：1-60升级路线与坐标导航、专精输出循环、10-60逐级天赋加点、一键生成职业宏、37大副本（含11个无限服新本）必接任务与掉落、露营睡袋/传承天赋/物资箱全攻略与最新热修公告。新增「制造套利」页：读取 EasyAuction 行情与角色专业等级，递归折算中间产物（布→布卷→装备）后筛选当前可制作且能盈利的配方，附魔角色还可比价装备分解收益。新增「NPC 商人购入 → 拍卖行出售」筛选通道：打开商人窗口自动采集买入价与库存，对比拍卖行最低售价（扣手续费）筛出可直接倒买倒卖的商品，制作成本也可优先采用已采集的商人材料价。支持「在售 ≥100」过滤，剔除挂单稀少的异常价格物品，利润统一按观测到的最低售价计算。',
    author: 'lich.tech',
    category: 'QoL',
    icon: 'Compass',
    defaultFolderName: 'WoWF',
    latestVersion: bundledVersion('wowf', 'Forever 离线百科'),
    downloadUrl: '/addons/wowf.zip',
    homeUrl: '/?tab=wiki',
    gameFlavors: ['forever'],
    isForeverRecommended: true,
  },
];

/**
 * 为插件下载链接附加版本查询参数，避免浏览器或 CDN 返回旧版本缓存
 */
export function withVersionQuery(url: string, version: string): string {
  if (!version) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(version)}`;
}

/** 下载阶段在总进度条上占用的百分比区间（解压写盘占用剩余部分） */
const DOWNLOAD_PERCENT_START = 5;
const DOWNLOAD_PERCENT_END = 60;

/** 进度回调节流间隔：大包会收到上万个 chunk，不节流会拖垮 UI */
const PROGRESS_THROTTLE_MS = 150;

/** 构建脚本切分 OpenMap 时写入的分片清单（见 scripts/fetch-addons.js 的 processOpenMap） */
function isPartsManifestUrl(url: string): boolean {
  return /\.json(\?.*)?$/i.test(url);
}

/**
 * 该插件是否走 Pages 分片分发（没有单个 zip 直链，链接应指向清单而不是让用户下载 JSON）
 */
export function isChunkedAddon(addon: CuratedAddon): boolean {
  return isPartsManifestUrl(addon.downloadUrl);
}

/** 站点自有域名：所有插件都必须从这里分发，不允许直连 GitHub / CurseForge 等外部源 */
const SITE_HOST = 'wow.lich.tech';

/**
 * 生成下载候选地址。
 * 只允许「当前站点」与「wow.lich.tech」两个来源——插件包要么是本目录下的 zip，
 * 要么是 build 期切好的分片清单，绝不回退到外部域名。
 * 来源比较用完整的 origin（含端口），因此 `https://wow.lich.tech:8443` 之类也会被拒。
 * @throws 当下载地址被配置成外部域名、协议相对地址或含路径穿越时抛错
 */
function buildDownloadCandidates(addon: CuratedAddon): string[] {
  const pageOrigin =
    typeof location !== 'undefined' && /^https?:$/.test(location.protocol) ? location.origin : null;
  const allowedOrigins = new Set<string>([`https://${SITE_HOST}`]);
  if (pageOrigin) allowedOrigins.add(pageOrigin);

  if (/^https?:\/\//i.test(addon.downloadUrl)) {
    let parsed: URL;
    try {
      parsed = new URL(addon.downloadUrl);
    } catch {
      throw new Error(`插件 ${addon.name} 的下载地址无法解析：${addon.downloadUrl}`);
    }
    if (!allowedOrigins.has(parsed.origin)) {
      throw new Error(`插件 ${addon.name} 的下载源不在本站（${parsed.origin}），已拒绝外部下载`);
    }
    return [withVersionQuery(parsed.href, addon.latestVersion)];
  }

  if (addon.downloadUrl.startsWith('//')) {
    throw new Error(`插件 ${addon.name} 使用了协议相对下载地址，已拒绝：${addon.downloadUrl}`);
  }
  if (!addon.downloadUrl.startsWith('/') || addon.downloadUrl.includes('..')) {
    throw new Error(`插件 ${addon.name} 的下载地址必须是本站绝对路径：${addon.downloadUrl}`);
  }

  const candidates: string[] = [];
  const seenResolved = new Set<string>();
  const addCandidate = (candidateUrl: string) => {
    const resolved = pageOrigin ? new URL(candidateUrl, pageOrigin).href : candidateUrl;
    if (seenResolved.has(resolved)) return;
    seenResolved.add(resolved);
    candidates.push(candidateUrl);
  };
  if (pageOrigin) {
    addCandidate(withVersionQuery(addon.downloadUrl, addon.latestVersion));
  }
  addCandidate(withVersionQuery(`https://${SITE_HOST}${addon.downloadUrl}`, addon.latestVersion));
  return candidates;
}

/**
 * 下载精选插件压缩包。
 * 说明：巫妖王的无限百科 的百科数据已在构建期烘焙进 wowf.zip，
 * 下载后无需再做任何联网同步。
 */
export async function fetchCuratedAddonZip(
  addon: CuratedAddon,
  onProgress?: (p: InstallProgress) => void
): Promise<ArrayBuffer> {
  onProgress?.({
    status: 'downloading',
    addonName: addon.name,
    percent: DOWNLOAD_PERCENT_START,
    message: `正在连接下载源：${addon.name}...`,
  });

  const candidates = buildDownloadCandidates(addon);
  const isChunked = isPartsManifestUrl(addon.downloadUrl);

  let lastEmit = 0;
  let lastPercent = -1;
  let progressFloor = DOWNLOAD_PERCENT_START;
  const report = (loaded: number, total: number) => {
    const ratio = total > 0 ? Math.min(1, loaded / total) : 0;
    const rawPercent = DOWNLOAD_PERCENT_START + Math.floor(ratio * (DOWNLOAD_PERCENT_END - DOWNLOAD_PERCENT_START));
    const percent = Math.min(DOWNLOAD_PERCENT_END, Math.max(progressFloor, rawPercent));
    const now = Date.now();
    // 已知总长度时按百分比变化节流；未知时按时间节流（否则百分比永远不变，进度条不会动）
    if (now - lastEmit < (total > 0 ? PROGRESS_THROTTLE_MS : 500)) return;
    if (total > 0 && percent === lastPercent) return;
    lastEmit = now;
    lastPercent = percent;
    onProgress?.({
      status: 'downloading',
      addonName: addon.name,
      percent,
      message:
        total > 0
          ? `正在下载 ${addon.name}：${formatBytes(loaded)} / ${formatBytes(total)}（${Math.floor(ratio * 100)}%）`
          : `正在下载 ${addon.name}：已接收 ${formatBytes(loaded)}`,
    });
  };

  let lastError: unknown = null;

  if (isChunked) {
    // Pages 分块路线：先取清单，再按内容寻址下载各块并拼接。
    // 块 URL 只由内容决定，所以升级到新版本时只有真正变化的块会重新下载。
    const partsDownloadOptions = {
      onChunk: report,
      onCacheHit: (cached: number, total: number) => {
        const cachedPercent = Math.min(
          DOWNLOAD_PERCENT_END,
          DOWNLOAD_PERCENT_START +
            Math.floor((cached / Math.max(1, total)) * (DOWNLOAD_PERCENT_END - DOWNLOAD_PERCENT_START))
        );
        progressFloor = Math.max(progressFloor, cachedPercent);
        lastPercent = Math.max(lastPercent, progressFloor);
        onProgress?.({
          status: 'downloading',
          addonName: addon.name,
          percent: progressFloor,
          message: `复用本地缓存：已有 ${cached}/${total} 个分块命中，只需下载变化的 ${total - cached} 块`,
        });
      },
    };

    const baseOrigin =
      typeof location !== 'undefined' && /^https?:$/.test(location.protocol)
        ? location.origin
        : `https://${SITE_HOST}`;

    for (const url of candidates) {
      progressFloor = DOWNLOAD_PERCENT_START;
      lastPercent = -1;
      lastEmit = 0;
      try {
        const manifest = await fetchPartsManifest(url);
        let buffer: ArrayBuffer;
        try {
          buffer = await downloadParts(url, manifest, partsDownloadOptions);
        } catch (partsError) {
          const message = partsError instanceof Error ? partsError.message : String(partsError);
          if (!/HTTP 404|收到 HTML 页面/.test(message)) throw partsError;
          // CDN 缓存了旧清单时可能指向已替换的分块（Cloudflare Pages SPA 模式对缺失分块返回 200 HTML），
          // 绕过缓存重拉一次清单再试
          progressFloor = DOWNLOAD_PERCENT_START;
          lastPercent = -1;
          lastEmit = 0;
          const parsed = new URL(url, baseOrigin);
          parsed.searchParams.set('_t', String(Date.now()));
          const bustUrl = url.startsWith('/') ? `${parsed.pathname}${parsed.search}${parsed.hash}` : parsed.href;
          const freshManifest = await fetchPartsManifest(bustUrl);
          buffer = await downloadParts(bustUrl, freshManifest, partsDownloadOptions);
        }
        if (buffer.byteLength > 200) return buffer;
        lastError = new Error('分块拼接结果为空');
      } catch (error) {
        lastError = error;
      }
    }
    // 注意：这里绝不回退到清单里的 source（GitHub 直链）。本站分块不可用时宁可报错，
    // 也不要让用户的下载绕到外部源——这正是「所有插件都由本站 Pages 分发」的要求。
  } else {
    for (const url of candidates) {
      try {
        const arrayBuffer = await downloadWithProgress(url, { onChunk: report });
        if (arrayBuffer.byteLength > 200) {
          return arrayBuffer;
        }
        lastError = new Error('下载内容过小，可能不是有效的插件压缩包');
      } catch (error) {
        lastError = error;
      }
    }
  }

  const reason = lastError instanceof Error ? lastError.message : 'Network Error';
  throw new Error(`下载失败：${reason}`);
}

/**
 * Fetch and install addon by download URL with progress tracking
 */
export async function downloadAndInstallAddon(
  addon: CuratedAddon,
  targetDirHandle: FileSystemDirectoryHandle,
  onProgress: (p: InstallProgress) => void
): Promise<{ installedFolders: string[] }> {
  onProgress({
    status: 'downloading',
    addonName: addon.name,
    percent: DOWNLOAD_PERCENT_START,
    message: `正在下载 ${addon.name}...`,
  });

  const arrayBuffer = await fetchCuratedAddonZip(addon, onProgress);

  await installAddonFromZip(
    targetDirHandle,
    arrayBuffer,
    (progress) => {
      onProgress({
        ...progress,
        addonName: addon.name,
      });
    },
    { percentRange: [DOWNLOAD_PERCENT_END, 97] }
  );

  // 装完才整理缓存：解压/写盘失败时保留，重试不必重下 198 MB。
  // 注意这里不再按插件清空——分块按内容寻址，旧版本的块就是新版本的块，
  // 清掉等于把下次升级重新变回全量下载；只在超出预算时淘汰最久未用的。
  await releaseDownloadCache();

  return { installedFolders: [addon.defaultFolderName] };
}

/**
 * Generate a JSON export of installed addons for sharing or syncing
 */
export function generateShareManifest(
  installedAddons: { name: string; folderName: string; version: string; interfaceVersion: string }[]
): string {
  const data = {
    app: '巫妖王的无限精选插件',
    createdAt: new Date().toISOString(),
    total: installedAddons.length,
    addons: installedAddons.map((a) => ({
      name: a.name,
      folder: a.folderName,
      version: a.version,
      interfaceVersion: a.interfaceVersion,
    })),
  };
  return JSON.stringify(data, null, 2);
}

export interface ParsedVersion {
  mainParts: number[];
  preRelease: string | null;
  dbParts: number[] | null;
}

/**
 * 解析版本字符串，分离主版本号、语义化预发布标识（如 -beta.1）与数据库 (DB) 版本号段
 * 自动剥离括号中的说明文字（如 100%全汉化版），防止非版本数字干扰比对
 * @param versionStr - 原始版本字符串（如 "v12.6.4 + DB v1.0.14 (中文版)" 或 "v1.17.29-beta.1"）
 * @returns 解析得到的结构化版本对象，无法解析有效版本时返回 null
 */
export function parseVersionParts(versionStr: string): ParsedVersion | null {
  if (!versionStr || versionStr.includes('未知')) return null;

  // 1. 提取 DB 版本 (如 "DB v1.0.14" -> [1, 0, 14])
  let dbParts: number[] | null = null;
  const dbMatch = versionStr.match(/DB\s*v?(\d+(?:\.\d+)*)/i);
  if (dbMatch) {
    dbParts = dbMatch[1].split('.').map((s) => parseInt(s, 10));
  }

  // 2. 提取主版本与预发布标识：去除 DB 部分以及括号文字说明后匹配版本序列
  const withoutDb = versionStr.replace(/DB\s*v?\d+(?:\.\d+)*/gi, '');
  const cleanStr = withoutDb.replace(/\(.*?\)/g, '').replace(/（.*?）/g, '').trim();
  const mainMatch = cleanStr.match(/v?(\d+(?:\.\d+)*)(?:-([a-zA-Z0-9.-]+))?/);

  if (!mainMatch) return null;

  const mainParts = mainMatch[1].split('.').map((s) => parseInt(s, 10));
  const preRelease = mainMatch[2] ? mainMatch[2].toLowerCase() : null;
  return { mainParts, preRelease, dbParts };
}

/**
 * 从版本字符串中提取主版本数字分段数组
 * @param versionStr - 原始版本字符串
 * @returns 解析得到的主版本数字数组，若无法解析则返回 null
 */
export function extractVersionNumbers(versionStr: string): number[] | null {
  const parsed = parseVersionParts(versionStr);
  return parsed ? parsed.mainParts : null;
}

/**
 * 比较两组版本数字序列
 * @returns 1 表示 remote 更新，-1 表示 local 更新，0 表示相等
 */
function compareNumberParts(local: number[], remote: number[]): number {
  const maxLen = Math.max(local.length, remote.length);
  for (let i = 0; i < maxLen; i++) {
    const l = local[i] ?? 0;
    const r = remote[i] ?? 0;
    if (r > l) return 1;
    if (r < l) return -1;
  }
  return 0;
}

/**
 * 剥离尾随的环境渠道标识 (例如 -classic, -forever, -vanilla, -retail, -era, -tbc, -release 等)，
 * 完整保留多段预发布数字序列 (例如 rc.1.1, rc.1.2, beta1.3, alpha-2)，避免渠道字母序干扰更新判定
 */
function extractCorePreRelease(tag: string | null): string | null {
  if (!tag) return null;
  const stripped = tag.trim().replace(/(?:[-_](?:forever|classic|vanilla|retail|era|tbc|wotlk|titan|release))+$/i, '');
  return stripped ? stripped.toLowerCase() : null;
}

/**
 * 校验版本标识是否属于严格语义化预发布标签 (如 alpha, beta, rc.1.1, rc.1.2, preview, dev, test, b1 等)
 * - 针对以 b 开头的简写形式，严格要求至少携带一个后续数字 (b\d+)，避免将 burning-crusade 等魔兽资料片环境标识误判
 * - 针对标准关键字设置标签边界，仅允许其后紧跟数字序列或连接符，完整保留 rc.1.1 与 rc.1.2 的区分能力
 * - 避免将魔兽世界插件生态中的渠道/运行环境变体标识 (如 forever, classic, vanilla, retail, release 等) 误判为预发布
 */
function isTruePreRelease(tag: string | null): boolean {
  if (!tag) return false;
  const core = extractCorePreRelease(tag);
  if (!core) return false;
  return /^(?:alpha|beta|rc|preview|dev|test)(?:[.-]?\d+(?:\.\d+)*)?$|^b\d+/i.test(core);
}

/**
 * 比较主版本数字分段与预发布标识
 * 严格语义版本标准：
 * 1. 若版本数字序列不同，直接以数字大小为准
 * 2. 若版本数字序列相同，仅当一方为真正预发布标识 (alpha/beta/rc等) 时，正式版或变体版高于预发布版
 * 3. 若双方均为真正预发布版，提取核心预发布段 (如 beta1 vs beta2) 进行比对，渠道后缀不参与递增比较
 * 4. 若双方标签均为渠道变体标识 (如 forever/classic) 或均非测试版，主版本相同时视为等价，避免无限提示更新
 * @returns 1 表示 remote 更新，-1 表示 local 更新，0 表示相等
 */
function compareMainVersion(local: ParsedVersion, remote: ParsedVersion): number {
  const numDiff = compareNumberParts(local.mainParts, remote.mainParts);
  if (numDiff !== 0) return numDiff;

  const localTag = local.preRelease;
  const remoteTag = remote.preRelease;

  // 变体或预发布标签完全一致时视为相等
  if (localTag === remoteTag) return 0;

  const localIsPre = isTruePreRelease(localTag);
  const remoteIsPre = isTruePreRelease(remoteTag);

  // 1. 本地是真正预发布版，远端是正式版或变体版 -> 远端更新
  if (localIsPre && !remoteIsPre) return 1;
  // 2. 远端是真正预发布版，本地是正式版或变体版 -> 本地更新
  if (!localIsPre && remoteIsPre) return -1;
  // 3. 两者均为真正预发布版时，提取核心预发布段比较，忽略尾随的渠道名称差异
  if (localIsPre && remoteIsPre) {
    const localCore = extractCorePreRelease(localTag) ?? (localTag ?? '').toLowerCase();
    const remoteCore = extractCorePreRelease(remoteTag) ?? (remoteTag ?? '').toLowerCase();
    if (localCore === remoteCore) {
      return 0;
    }
    return remoteCore.localeCompare(localCore, undefined, {
      numeric: true,
    });
  }

  // 4. 两者均非真正预发布版（例如一侧为渠道变体 forever/classic，另一侧无标签或同为变体），主版本数字相同时视为等价
  return 0;
}

/**
 * 检查两个版本字符串是否均包含可比较的数字序列
 * 若本地或远端版本无法解析出版本号，或者远端包含 DB 版本而本地缺少 DB 版本且主版本相同，则视为不可确认最新
 * @param localVersion - 本地插件版本号
 * @param remoteVersion - 远端市场版本号
 * @returns true 表示两者均能提取出有效版本且可以完整判定是否已是最新
 */
export function canCompareVersions(localVersion: string, remoteVersion: string): boolean {
  if (!localVersion || localVersion === '未知' || localVersion === '未知版本') {
    return false;
  }
  const localParsed = parseVersionParts(localVersion);
  const remoteParsed = parseVersionParts(remoteVersion);
  if (!localParsed || !remoteParsed) {
    return false;
  }
  // 若远端要求特定的 DB 数据库版本，而本地没有解析出 DB 版本信息，且主版本号相同，无法确定是否已是最新
  if (remoteParsed.dbParts && !localParsed.dbParts) {
    const mainDiff = compareMainVersion(localParsed, remoteParsed);
    if (mainDiff === 0) {
      return false;
    }
  }
  return true;
}

/**
 * 校验本地已安装版本与远端精选市场最新版本是否存在可用更新
 * 独立按主版本 -> DB 版本顺序比对，保留版本边界，避免多段复合版本错位
 * 当本地版本未知或无法确认落后时，保守返回 false，避免误报更新
 * @param localVersion - 本地插件 TOC 解析出的版本号
 * @param remoteVersion - 市场最新版本号
 * @returns true 表示存在新版本可用，false 表示已是最新、无需更新或版本未知
 */
export function isUpdateAvailable(localVersion: string, remoteVersion: string): boolean {
  if (!localVersion || localVersion === '未知' || localVersion === '未知版本') {
    return false;
  }
  const localParsed = parseVersionParts(localVersion);
  const remoteParsed = parseVersionParts(remoteVersion);

  if (!localParsed || !remoteParsed) {
    return false;
  }

  // 1. 先独立比较主版本号及预发布标签
  const mainDiff = compareMainVersion(localParsed, remoteParsed);
  if (mainDiff > 0) return true;
  if (mainDiff < 0) return false;

  // 2. 主版本相等时，若两端均有 DB 数据库版本，比较 DB 版本号
  if (localParsed.dbParts && remoteParsed.dbParts) {
    const dbDiff = compareNumberParts(localParsed.dbParts, remoteParsed.dbParts);
    if (dbDiff > 0) return true;
    if (dbDiff < 0) return false;
  }

  return false;
}

/**
 * 在精选插件库中查找与本地已装插件相匹配的项目
 * 严格按照文件夹标识及精确名称/别名匹配，避免因通用子字符串误匹配无关插件
 * @param addon - 本地已扫描插件信息
 * @param curatedList - 待匹配的精选插件列表（默认使用 POPULAR_ADDONS）
 * @returns 匹配到的精选插件对象，未匹配时返回 undefined
 */
export function findMatchingCuratedAddon(
  addon: { folderName: string; name: string; subFolders?: string[] },
  curatedList: CuratedAddon[] = POPULAR_ADDONS
): CuratedAddon | undefined {
  const folder = addon.folderName.toLowerCase();
  const subFolders = addon.subFolders?.map((f) => f.toLowerCase()) || [];
  const name = addon.name.toLowerCase().trim();

  return curatedList.find((c) => {
    const defaultFolder = c.defaultFolderName.toLowerCase();
    const id = c.id.toLowerCase();
    const cName = c.name.toLowerCase().trim();

    // 1. 文件夹名或子文件夹名与精选 defaultFolderName 严格匹配
    if (folder === defaultFolder || subFolders.includes(defaultFolder)) return true;
    // 2. 文件夹名与精选 id 严格匹配
    if (folder === id || subFolders.includes(id)) return true;
    // 3. 插件名称全等，或去除括号说明后全等
    if (name === cName) return true;
    const cleanAddonName = name.replace(/\(.*?\)/g, '').replace(/（.*?）/g, '').trim();
    const cleanCuratedName = cName.replace(/\(.*?\)/g, '').replace(/（.*?）/g, '').trim();
    if (cleanAddonName.length >= 3 && cleanAddonName === cleanCuratedName) return true;

    return false;
  });
}

/**
 * 为已扫描插件列表注入市场比对状态（标记 update-available 或 up-to-date）
 * @param addons - 扫描得到的插件列表
 * @param curatedList - 市场精选插件列表
 * @returns 附带最新状态与下载链接的插件列表
 */
export function enrichAddonsWithUpdateStatus(
  addons: AddonInfo[],
  curatedList: CuratedAddon[] = POPULAR_ADDONS
): AddonInfo[] {
  return addons.map((addon) => {
    const matched = findMatchingCuratedAddon(addon, curatedList);
    if (!matched) {
      return addon;
    }
    const hasUpdate = isUpdateAvailable(addon.version, matched.latestVersion);
    const isComparable = canCompareVersions(addon.version, matched.latestVersion);
    return {
      ...addon,
      status: hasUpdate ? 'update-available' : isComparable ? 'up-to-date' : 'unknown',
      latestVersion: matched.latestVersion,
      downloadUrl: matched.downloadUrl,
    };
  });
}
