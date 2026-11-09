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
