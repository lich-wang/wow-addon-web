import type { AddonInfo, CuratedAddon, InstallProgress } from '../types/addon';
import { installAddonFromZip } from './fsService';

export const POPULAR_ADDONS: CuratedAddon[] = [
  {
    id: 'sbf',
    name: 'Single-Button Fishing (单键钓鱼)',
    description: '无限服与经典版本钓鱼必备神器！一键完成整个钓鱼循环（自动甩竿、浮漂交互、高速拾取、换竿上饵与音频聚焦增强），内置全套简体中文与按键绑定。',
    author: 'Goblin Engineering Company',
    category: 'QoL',
    icon: 'Compass',
    defaultFolderName: 'SBF',
    latestVersion: '2026.11.05.1 (中文版)',
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
    latestVersion: 'v1.23.0 (Forever 中文版)',
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
    latestVersion: 'v1.17.29 (全汉化版)',
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
    latestVersion: 'v2.1.31 (原生中文)',
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
    latestVersion: 'v12.1.8 (官方中文版)',
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
    latestVersion: 'v1.4.0 (汉化增强版)',
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
    latestVersion: 'v12.6.4 + DB v1.0.14 (中文版)',
    downloadUrl: '/addons/questie-forever.zip',
    githubRepo: 'Questie/Questie',
    homeUrl: 'https://www.curseforge.com/wow/addons/questie',
    gameFlavors: ['forever', 'classic', 'vanilla'],
    isForeverRecommended: true,
  },
  {
    id: 'btwquests',
    name: 'BtWQuests (任务链与前置流程图)',
    description: '可视化任务链与前置条件追溯神器（含无限服与经典旧世完整数据模块）！以科技树流程图形式清晰展示所有主支线前后置关系，自动同步角色实际进度将已完成任务打钩，一眼定位断档任务并支持点击地图导航。',
    author: 'Breen',
    category: 'QoL',
    icon: 'Compass',
    defaultFolderName: 'BtWQuests',
    latestVersion: 'v2.69.1 (Forever 中文版)',
    downloadUrl: '/addons/btwquests.zip',
    homeUrl: 'https://www.curseforge.com/wow/addons/btw-quests',
    gameFlavors: ['forever', 'classic', 'retail', 'vanilla'],
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
    latestVersion: 'v0.2.0 (100%全汉化版)',
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
    latestVersion: 'v1.0.0 (Forever 全汉化版)',
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

/**
 * 从版本字符串中提取版本数字分段数组（例如 "v12.6.4 + DB v1.0.14" -> [12, 6, 4, 1, 0, 14]）
 * 仅提取纯版本号段以及以 DB 标识的数据库版本号段，忽略括号内说明文字中的数字（如 100%全汉化版）
 * @param versionStr - 原始版本字符串
 * @returns 解析得到的完整版本数字段数组，若无法解析则返回 null
 */
export function extractVersionNumbers(versionStr: string): number[] | null {
  if (!versionStr || versionStr.includes('未知')) return null;

  // 1. 若包含复合版本（如 "+ DB v..."），提取主版本与 DB 版本，避免说明文字污染
  const parts: number[] = [];
  const dbMatch = versionStr.match(/DB\s*v?(\d+(?:\.\d+)*)/i);
  const mainMatch = versionStr.match(/v?(\d+(?:\.\d+)*)/);

  if (mainMatch) {
    for (const seg of mainMatch[1].split('.')) {
      parts.push(parseInt(seg, 10));
    }
  }

  if (dbMatch) {
    for (const seg of dbMatch[1].split('.')) {
      parts.push(parseInt(seg, 10));
    }
  }

  return parts.length > 0 ? parts : null;
}

/**
 * 校验本地已安装版本与远端精选市场最新版本是否存在可用更新
 * 当本地版本未知或无法确认落后时，保守返回 false，避免误报更新
 * @param localVersion - 本地插件 TOC 解析出的版本号
 * @param remoteVersion - 市场最新版本号
 * @returns true 表示存在新版本可用，false 表示已是最新、无需更新或版本未知
 */
export function isUpdateAvailable(localVersion: string, remoteVersion: string): boolean {
  if (!localVersion || localVersion === '未知' || localVersion === '未知版本') {
    return false;
  }
  const localParts = extractVersionNumbers(localVersion);
  const remoteParts = extractVersionNumbers(remoteVersion);

  if (!localParts || !remoteParts) {
    return false;
  }

  const maxLen = Math.max(localParts.length, remoteParts.length);
  for (let i = 0; i < maxLen; i++) {
    const l = localParts[i] ?? 0;
    const r = remoteParts[i] ?? 0;
    if (r > l) return true;
    if (r < l) return false;
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
    return {
      ...addon,
      status: hasUpdate ? 'update-available' : 'up-to-date',
      latestVersion: matched.latestVersion,
      downloadUrl: matched.downloadUrl,
    };
  });
}
