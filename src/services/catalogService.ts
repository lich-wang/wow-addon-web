import type { CuratedAddon, InstallProgress } from '../types/addon';
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
    description: '《魔兽世界：无限服》专属商业利器！实时扫描拍卖行计算最高利润配方、排队批量制造、智能购物清单与防亏损一口价上架，内置 2700+ 条全量简体中文。',
    author: 'Blackthornes',
    category: 'Trade',
    icon: 'Coins',
    defaultFolderName: 'Blackthornes_TS',
    latestVersion: 'v0.64.0 (Forever 中文版)',
    downloadUrl: '/addons/blackthornes-tradeskills.zip',
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
    latestVersion: 'v1.17.28 (全汉化版)',
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
    id: 'rxpguides',
    name: 'RestedXP Guide (任务攻略)',
    description: '全球极速升级必备的高效任务导航攻略！自动规划最高效的任务路线、精准指引任务NPC与目标点、自动追踪等级进度，内置海量官方简体中文指引与多版本任务路线。',
    author: 'RestedXP',
    category: 'QoL',
    icon: 'MapPin',
    defaultFolderName: 'RXPGuides',
    latestVersion: 'v4.11.35 (官方中文版)',
    downloadUrl: '/addons/rxpguides.zip',
    githubRepo: 'RestedXP/RXPGuides',
    homeUrl: 'https://www.restedxp.com',
    gameFlavors: ['forever', 'classic', 'retail', 'vanilla'],
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
