import type { CuratedAddon, InstallProgress } from '../types/addon';
import { installAddonFromZip } from './fsService';

export const POPULAR_ADDONS: CuratedAddon[] = [
  {
    id: 'details',
    name: 'Details! Damage Meter',
    description: '魔兽世界中最精准、功能最强大的伤害/治疗统计插件，支持详细战斗回顾、死亡记录与图形报表。',
    author: 'Terciob',
    category: 'Combat',
    icon: 'Sword',
    defaultFolderName: 'Details',
    latestVersion: 'v11.0.2.13054',
    downloadUrl: 'https://github.com/Terciob/Details-Damage-Meter/releases/latest/download/Details.zip',
    githubRepo: 'Terciob/Details-Damage-Meter',
    homeUrl: 'https://www.curseforge.com/wow/addons/details',
  },
  {
    id: 'weakauras',
    name: 'WeakAuras',
    description: '极其强大的UI和警报框架，自定义技能CD提示、首领技能预警、BUFF/DEBUFF监控以及华丽动态效果。',
    author: 'The WeakAuras Team',
    category: 'Raid',
    icon: 'Sparkles',
    defaultFolderName: 'WeakAuras',
    latestVersion: '5.19.4',
    downloadUrl: 'https://github.com/WeakAuras/WeakAuras2/releases/latest/download/WeakAuras.zip',
    githubRepo: 'WeakAuras/WeakAuras2',
    homeUrl: 'https://wago.io',
  },
  {
    id: 'dbm',
    name: 'Deadly Boss Mods (DBM)',
    description: '老牌且经典的副本首领警报插件，支持5人地下城、团队副本、世界Boss的技能倒数与中文语音报牌。',
    author: 'MysticalOS',
    category: 'Raid',
    icon: 'Skull',
    defaultFolderName: 'DBM-Core',
    latestVersion: '11.0.21',
    downloadUrl: 'https://github.com/DeadlyBossMods/DeadlyBossMods/releases/latest/download/DBM.zip',
    githubRepo: 'DeadlyBossMods/DeadlyBossMods',
    homeUrl: 'https://deadlybossmods.com',
  },
  {
    id: 'bigwigs',
    name: 'BigWigs Bossmods',
    description: '轻量、精准、专业高玩与首杀团队青睐的首领战警报插件，占用极低，配置简单模块化。',
    author: 'BigWigs Team',
    category: 'Raid',
    icon: 'ShieldAlert',
    defaultFolderName: 'BigWigs',
    latestVersion: 'v372.1',
    downloadUrl: 'https://github.com/BigWigsMods/BigWigs/releases/latest/download/BigWigs.zip',
    githubRepo: 'BigWigsMods/BigWigs',
  },
  {
    id: 'plater',
    name: 'Plater Nameplates',
    description: '高度可定制的姓名板（血条）插件，深度支持大秘境读条颜色高亮、仇恨监控与偷断技能标记。',
    author: 'Terciob',
    category: 'UI',
    icon: 'BadgePercent',
    defaultFolderName: 'Plater',
    latestVersion: 'Plater-v11.0.2',
    downloadUrl: 'https://github.com/Terciob/Plater-Nameplates/releases/latest/download/Plater.zip',
    githubRepo: 'Terciob/Plater-Nameplates',
  },
  {
    id: 'mdt',
    name: 'Mythic Dungeon Tools (MDT)',
    description: '大秘境路线规划神器，规划每波小怪进度百分比、巡逻路线、傲慢/心能怪分布及战术沙盘。',
    author: 'Nnoggie',
    category: 'Combat',
    icon: 'Compass',
    defaultFolderName: 'MythicDungeonTools',
    latestVersion: 'v5.1.8',
    downloadUrl: 'https://github.com/Nnoggie/MythicDungeonTools/releases/latest/download/MythicDungeonTools.zip',
    githubRepo: 'Nnoggie/MythicDungeonTools',
  },
  {
    id: 'bartender4',
    name: 'Bartender4',
    description: '经典全功能动作条替换插件，支持任意移动主动作条、姿态条、宠物条、微型菜单与按键绑定自定义。',
    author: 'Nevcairiel',
    category: 'UI',
    icon: 'LayoutGrid',
    defaultFolderName: 'Bartender4',
    latestVersion: '4.15.0',
    downloadUrl: 'https://github.com/Nevcairiel/Bartender4/releases/latest/download/Bartender4.zip',
  },
  {
    id: 'omnicc',
    name: 'OmniCC',
    description: '给所有技能图标、物品、动作条添加醒目的数字倒计时与闪烁提醒，必装基础插件。',
    author: 'Tuller',
    category: 'UI',
    icon: 'Clock',
    defaultFolderName: 'OmniCC',
    latestVersion: '11.0.3',
    downloadUrl: 'https://github.com/tullamods/OmniCC/releases/latest/download/OmniCC.zip',
    githubRepo: 'tullamods/OmniCC',
  },
  {
    id: 'bagnon',
    name: 'Bagnon',
    description: '将所有背包整合为单个大背包，支持跨角色查看银行背包、物品高亮搜索和品质染色。',
    author: 'Jaliborc',
    category: 'QoL',
    icon: 'Package',
    defaultFolderName: 'Bagnon',
    latestVersion: '11.0.8',
    downloadUrl: 'https://github.com/Jaliborc/Bagnon/releases/latest/download/Bagnon.zip',
  },
  {
    id: 'rarescanner',
    name: 'RareScanner',
    description: '野外稀有精英与宝箱雷达探测插件，附带大地图标记、掉落物品列表及战利品模型预览。',
    author: 'mbarberog',
    category: 'QoL',
    icon: 'Eye',
    defaultFolderName: 'RareScanner',
    latestVersion: '11.0.2.7',
    downloadUrl: 'https://github.com/mbarberog/RareScanner/releases/latest/download/RareScanner.zip',
  },
  {
    id: 'tomtom',
    name: 'TomTom',
    description: '大地图与小地图坐标导航箭头指示器，支持宏命令设定路点 `/way 45.2 62.1`。',
    author: 'Cladhaire',
    category: 'QoL',
    icon: 'MapPin',
    defaultFolderName: 'TomTom',
    latestVersion: 'v11.0.2-1.0.0',
    downloadUrl: 'https://github.com/astur/TomTom/releases/latest/download/TomTom.zip',
  },
  {
    id: 'leatrix-plus',
    name: 'Leatrix Plus',
    description: '极其轻巧实用的多合一功能增强插件：自动售卖灰色物品、自动修理、快速交接任务、跳过动画等。',
    author: 'Leatrix',
    category: 'QoL',
    icon: 'Wrench',
    defaultFolderName: 'Leatrix_Plus',
    latestVersion: '11.0.15',
    downloadUrl: 'https://github.com/leatrix/leatrix-plus/releases/latest/download/Leatrix_Plus.zip',
  },
  {
    id: 'simc',
    name: 'Simulationcraft',
    description: '一键生成装备属性与天赋专精导出代码，用于 Raidbots 网站进行跑分模拟与最佳配装计算。',
    author: 'SimulationCraft Team',
    category: 'Combat',
    icon: 'Cpu',
    defaultFolderName: 'Simulationcraft',
    latestVersion: 'v11.0.2-01',
    downloadUrl: 'https://github.com/simulationcraft/simc-addon/releases/latest/download/Simulationcraft.zip',
    githubRepo: 'simulationcraft/simc-addon',
  },
  {
    id: 'auctionator',
    name: 'Auctionator',
    description: '拍卖行交易辅助利器，快速查看历史价格走势、一键批量上架下架以及自动压价计算。',
    author: 'Auctionator Team',
    category: 'Trade',
    icon: 'Coins',
    defaultFolderName: 'Auctionator',
    latestVersion: 'v11.0.18',
    downloadUrl: 'https://github.com/Auctionator/Auctionator/releases/latest/download/Auctionator.zip',
    githubRepo: 'Auctionator/Auctionator',
  },
];

/**
 * Fetch and install addon by download URL with progress tracking
 * Uses CORS proxy if needed for external sources
 */
export async function downloadAndInstallAddon(
  addon: CuratedAddon,
  targetDirHandle: FileSystemDirectoryHandle,
  onProgress: (p: InstallProgress) => void
): Promise<{ installedFolders: string[] }> {
  onProgress({
    status: 'downloading',
    addonName: addon.name,
    percent: 5,
    message: `正在从服务器下载 ${addon.name}...`,
  });

  let response: Response;
  try {
    // Try direct fetch first
    response = await fetch(addon.downloadUrl, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch {
    // If blocked by CORS in browser, route via Cloudflare Function or public CORS proxy
    onProgress({
      status: 'downloading',
      addonName: addon.name,
      percent: 8,
      message: '尝试通过 Cloudflare 边缘代理通道下载...',
    });

    const proxyUrls = [
      `/api/proxy?url=${encodeURIComponent(addon.downloadUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(addon.downloadUrl)}`,
    ];

    let success = false;
    let lastErr: Error | null = null;

    for (const proxyUrl of proxyUrls) {
      try {
        response = await fetch(proxyUrl);
        if (response.ok) {
          success = true;
          break;
        }
      } catch (err) {
        lastErr = err as Error;
      }
    }

    if (!success) {
      throw new Error(`下载失败: 无法连接到插件源。${lastErr?.message || ''}`);
    }
  }

  const contentLength = +(response!.headers.get('Content-Length') || 0);
  let blob: Blob;

  if (contentLength && response!.body) {
    const reader = response!.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      const percent = Math.min(45, Math.floor(5 + (received / contentLength) * 40));
      onProgress({
        status: 'downloading',
        addonName: addon.name,
        percent,
        message: `正在下载... (${Math.round((received / 1024 / 1024) * 10) / 10} MB)`,
      });
    }

    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    blob = new Blob([merged], { type: 'application/zip' });
  } else {
    blob = await response!.blob();
  }

  // Decompress and install to local directory handle
  return await installAddonFromZip(targetDirHandle, blob, onProgress);
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
      interface: a.interfaceVersion,
    })),
  };
  return JSON.stringify(data, null, 2);
}
