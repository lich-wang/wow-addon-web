import type { AddonInfo, CuratedAddon, InstallProgress } from '../types/addon';
import { installAddonFromZip } from './fsService';
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
    name: 'Blackthornes Tradeskills (商业制造与拍卖)',
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
    id: 'mapzeroth',
    name: 'Mapzeroth (艾泽拉斯智能导航 GPS)',
    description: '魔兽世界公交换乘与智能 GPS 导航神器（Forever 无限服专版）！根据当前位置与已解锁飞行点/传送门，综合规划轮船、飞艇、矿道地铁、飞行管理员与炉石的最快路线，提供步进式指引与 100% 深度汉化。',
    author: 'tr0tsky0',
    category: 'QoL',
    icon: 'Compass',
    defaultFolderName: 'Mapzeroth',
    latestVersion: bundledVersion('mapzeroth', 'Forever 全汉化版'),
    downloadUrl: '/addons/mapzeroth.zip',
    githubRepo: 'tr0tsky0/Mapzeroth',
    homeUrl: 'https://www.curseforge.com/wow/addons/mapzeroth',
    gameFlavors: ['forever'],
    isForeverRecommended: true,
  },
];

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
    percent: 15,
    message: `正在从 wow.lich.tech 下载 ${addon.name}...`,
  });

  const url = addon.downloadUrl.startsWith('http')
    ? addon.downloadUrl
    : `https://wow.lich.tech${addon.downloadUrl}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载失败 (HTTP ${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();

  await installAddonFromZip(targetDirHandle, arrayBuffer, (progress) => {
    onProgress({
      ...progress,
      addonName: addon.name,
    });
  });

  return { installedFolders: [addon.defaultFolderName] };
}

/**
 * Generate a JSON export of installed addons for sharing or syncing
 */
export function generateShareManifest(
  installedAddons: { name: string; folderName: string; version: string; interfaceVersion: string }[]
): string {
  const data = {
    app: 'WoW Web Addon Manager',
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
