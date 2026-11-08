import type { CuratedAddon, InstallProgress } from '../types/addon';
import { installAddonFromZip } from './fsService';

export const POPULAR_ADDONS: CuratedAddon[] = [
  // --- 无限服 (WoW Forever) 核心专属推荐插件 ---
  {
    id: 'questie',
    name: 'Questie (任务与传承导航神器)',
    description: '《魔兽世界：无限服》练级与探索必备！在地图与小地图精确标记上千全新任务、传承任务NPC、怪物掉落与指引。',
    author: 'Aero, dyaxler & QuestieDev',
    category: 'QoL',
    icon: 'Compass',
    defaultFolderName: 'Questie',
    latestVersion: 'v10.4.2 (Forever/Classic)',
    downloadUrl: 'https://github.com/Questie/Questie/releases/latest/download/Questie.zip',
    githubRepo: 'Questie/Questie',
    homeUrl: 'https://questie.dev',
    gameFlavors: ['forever', 'classic', 'vanilla'],
    isForeverRecommended: true,
  },
  {
    id: 'threatclassic2',
    name: 'ThreatClassic2 (60级仇恨监控)',
    description: '无限服60级无仇恨修正，OT即死！实时精确计算怪物对全队目标的仇恨百分比与近战/远程OT警告。',
    author: 'dfherr',
    category: 'Combat',
    icon: 'ShieldAlert',
    defaultFolderName: 'ThreatClassic2',
    latestVersion: 'v2.50',
    downloadUrl: 'https://github.com/dfherr/ThreatClassic2/releases/latest/download/ThreatClassic2.zip',
    githubRepo: 'dfherr/ThreatClassic2',
    gameFlavors: ['forever', 'classic', 'vanilla'],
    isForeverRecommended: true,
  },
  {
    id: 'classiccastbars',
    name: 'ClassicCastbars (目标施法条)',
    description: '无限服原版默认UI不显示目标读条。本插件为怪物目标、焦点及姓名板添加精准读条与打断提示。',
    author: 'wardz',
    category: 'UI',
    icon: 'Clock',
    defaultFolderName: 'ClassicCastbars',
    latestVersion: 'v1.6.8',
    downloadUrl: 'https://github.com/wardz/ClassicCastbars/releases/latest/download/ClassicCastbars.zip',
    githubRepo: 'wardz/ClassicCastbars',
    gameFlavors: ['forever', 'classic', 'vanilla'],
    isForeverRecommended: true,
  },
  {
    id: 'weaponswingtimer',
    name: 'WeaponSwingTimer (平砍攻击计时器)',
    description: '无限服近战与猎人必备！显示主手/副手武器与远程自动射击平砍倒计时，方便猛击重置、卡刀与走位。',
    author: 'LeftHandedGlove',
    category: 'Combat',
    icon: 'Sword',
    defaultFolderName: 'WeaponSwingTimer',
    latestVersion: 'v6.3.2',
    downloadUrl: 'https://github.com/LeftHandedGlove/WeaponSwingTimer/releases/latest/download/WeaponSwingTimer.zip',
    githubRepo: 'LeftHandedGlove/WeaponSwingTimer',
    gameFlavors: ['forever', 'classic', 'vanilla'],
    isForeverRecommended: true,
  },
  {
    id: 'whatstraining',
    name: "What's Training? (技能学习速查)",
    description: '在法术书旁边增加全新一页，清晰列出当前及后续等级可以从职业训练师处学到的所有技能与金币开销。',
    author: 'CosminS',
    category: 'QoL',
    icon: 'Wrench',
    defaultFolderName: 'WhatsTraining',
    latestVersion: 'v9.0.3',
    downloadUrl: 'https://github.com/CosminS/WhatsTraining/releases/latest/download/WhatsTraining.zip',
    githubRepo: 'CosminS/WhatsTraining',
    gameFlavors: ['forever', 'classic', 'vanilla'],
    isForeverRecommended: true,
  },
  {
    id: 'atlasloot',
    name: 'AtlasLoot Classic (装备掉落大全)',
    description: '无限服地下城、世界Boss、专业制造与阵营声望掉落装备数据库，随时按部位、等级和副本查阅。',
    author: 'AtlasLoot Team',
    category: 'QoL',
    icon: 'Package',
    defaultFolderName: 'AtlasLootClassic',
    latestVersion: 'v3.1.5',
    downloadUrl: 'https://github.com/AtlasLoot/AtlasLootClassic/releases/latest/download/AtlasLootClassic.zip',
    githubRepo: 'AtlasLoot/AtlasLootClassic',
    gameFlavors: ['forever', 'classic', 'vanilla'],
    isForeverRecommended: true,
  },
  {
    id: 'weakauras',
    name: 'WeakAuras (神级监控与预警)',
    description: '全版本通用。极其强大的UI和警报框架，自定义技能CD提示、首领预警、BUFF/DEBUFF监控及华丽动态效果。',
    author: 'The WeakAuras Team',
    category: 'Raid',
    icon: 'Sparkles',
    defaultFolderName: 'WeakAuras',
    latestVersion: '5.19.4',
    downloadUrl: 'https://github.com/WeakAuras/WeakAuras2/releases/latest/download/WeakAuras.zip',
    githubRepo: 'WeakAuras/WeakAuras2',
    homeUrl: 'https://wago.io',
    gameFlavors: ['forever', 'classic', 'retail', 'vanilla'],
    isForeverRecommended: true,
  },
  {
    id: 'details',
    name: 'Details! Damage Meter',
    description: '魔兽世界中最精准、功能最强大的伤害/治疗统计插件，支持详细战斗回顾、死亡记录与图形报表。',
    author: 'Terciob',
    category: 'Combat',
    icon: 'Sword',
    defaultFolderName: 'Details',
    latestVersion: 'v11.0.2 / Classic',
    downloadUrl: 'https://github.com/Terciob/Details-Damage-Meter/releases/latest/download/Details.zip',
    githubRepo: 'Terciob/Details-Damage-Meter',
    homeUrl: 'https://www.curseforge.com/wow/addons/details',
    gameFlavors: ['forever', 'classic', 'retail'],
    isForeverRecommended: true,
  },
  {
    id: 'dbm',
    name: 'Deadly Boss Mods (DBM-Classic)',
    description: '经典副本首领警报插件，支持5人地下城、世界Boss、熔火之心/黑翼等团本的技能倒数与中文语音报牌。',
    author: 'MysticalOS',
    category: 'Raid',
    icon: 'Skull',
    defaultFolderName: 'DBM-Core',
    latestVersion: '11.0.21',
    downloadUrl: 'https://github.com/DeadlyBossMods/DeadlyBossMods/releases/latest/download/DBM.zip',
    githubRepo: 'DeadlyBossMods/DeadlyBossMods',
    homeUrl: 'https://deadlybossmods.com',
    gameFlavors: ['forever', 'classic', 'retail'],
    isForeverRecommended: true,
  },
  {
    id: 'leatrix-plus',
    name: 'Leatrix Plus (功能百宝箱)',
    description: '极度轻巧实用的多合一功能增强插件：自动售卖灰色杂物、自动修理、快速交接任务、跳过过场动画等。',
    author: 'Leatrix',
    category: 'QoL',
    icon: 'Wrench',
    defaultFolderName: 'Leatrix_Plus',
    latestVersion: '11.0.15',
    downloadUrl: 'https://github.com/leatrix/leatrix-plus/releases/latest/download/Leatrix_Plus.zip',
    gameFlavors: ['forever', 'classic', 'retail'],
    isForeverRecommended: true,
  },
  {
    id: 'bartender4',
    name: 'Bartender4 (动作条全功能替换)',
    description: '经典全功能动作条替换插件，支持任意移动主动作条、姿态条、宠物条、微型菜单与按键绑定自定义。',
    author: 'Nevcairiel',
    category: 'UI',
    icon: 'LayoutGrid',
    defaultFolderName: 'Bartender4',
    latestVersion: '4.15.0',
    downloadUrl: 'https://github.com/Nevcairiel/Bartender4/releases/latest/download/Bartender4.zip',
    gameFlavors: ['forever', 'classic', 'retail'],
    isForeverRecommended: true,
  },
  {
    id: 'omnicc',
    name: 'OmniCC (技能CD数字倒计时)',
    description: '给所有技能图标、物品、动作条添加醒目的数字倒计时与闪烁提醒，必装基础插件。',
    author: 'Tuller',
    category: 'UI',
    icon: 'Clock',
    defaultFolderName: 'OmniCC',
    latestVersion: '11.0.3',
    downloadUrl: 'https://github.com/tullamods/OmniCC/releases/latest/download/OmniCC.zip',
    githubRepo: 'tullamods/OmniCC',
    gameFlavors: ['forever', 'classic', 'retail'],
    isForeverRecommended: true,
  },
  {
    id: 'bagnon',
    name: 'Bagnon (全背包整合)',
    description: '将所有背包整合为单个大背包，支持跨角色查看银行背包、物品高亮搜索和品质染色。',
    author: 'Jaliborc',
    category: 'QoL',
    icon: 'Package',
    defaultFolderName: 'Bagnon',
    latestVersion: '11.0.8',
    downloadUrl: 'https://github.com/Jaliborc/Bagnon/releases/latest/download/Bagnon.zip',
    gameFlavors: ['forever', 'classic', 'retail'],
    isForeverRecommended: true,
  },
  {
    id: 'auctionator',
    name: 'Auctionator (拍卖行助手)',
    description: '拍卖行交易辅助利器，快速查看历史价格走势、一键批量上架下架以及自动压价计算。',
    author: 'Auctionator Team',
    category: 'Trade',
    icon: 'Coins',
    defaultFolderName: 'Auctionator',
    latestVersion: 'v11.0.18',
    downloadUrl: 'https://github.com/Auctionator/Auctionator/releases/latest/download/Auctionator.zip',
    githubRepo: 'Auctionator/Auctionator',
    gameFlavors: ['forever', 'classic', 'retail'],
    isForeverRecommended: true,
  },
  {
    id: 'tomtom',
    name: 'TomTom (坐标导航箭头)',
    description: '大地图与小地图坐标导航箭头指示器，支持宏命令设定路点 `/way 45.2 62.1`。',
    author: 'Cladhaire',
    category: 'QoL',
    icon: 'MapPin',
    defaultFolderName: 'TomTom',
    latestVersion: 'v11.0.2-1.0.0',
    downloadUrl: 'https://github.com/astur/TomTom/releases/latest/download/TomTom.zip',
    gameFlavors: ['forever', 'classic', 'retail'],
    isForeverRecommended: true,
  },
  // --- 正式服特有插件 ---
  {
    id: 'plater',
    name: 'Plater Nameplates (高阶姓名板)',
    description: '高度可定制的姓名板（血条）插件，深度支持大秘境读条颜色高亮、仇恨监控与偷断技能标记。',
    author: 'Terciob',
    category: 'UI',
    icon: 'BadgePercent',
    defaultFolderName: 'Plater',
    latestVersion: 'Plater-v11.0.2',
    downloadUrl: 'https://github.com/Terciob/Plater-Nameplates/releases/latest/download/Plater.zip',
    githubRepo: 'Terciob/Plater-Nameplates',
    gameFlavors: ['retail'],
    isForeverRecommended: false,
  },
  {
    id: 'mdt',
    name: 'Mythic Dungeon Tools (MDT大秘境)',
    description: '正式服大秘境路线规划神器，规划每波小怪进度百分比、巡逻路线、傲慢/心能怪分布及战术沙盘。',
    author: 'Nnoggie',
    category: 'Combat',
    icon: 'Compass',
    defaultFolderName: 'MythicDungeonTools',
    latestVersion: 'v5.1.8',
    downloadUrl: 'https://github.com/Nnoggie/MythicDungeonTools/releases/latest/download/MythicDungeonTools.zip',
    githubRepo: 'Nnoggie/MythicDungeonTools',
    gameFlavors: ['retail'],
    isForeverRecommended: false,
  },
  {
    id: 'rarescanner',
    name: 'RareScanner (稀有怪雷达)',
    description: '野外稀有精英与宝箱雷达探测插件，附带大地图标记、掉落物品列表及战利品模型预览。',
    author: 'mbarberog',
    category: 'QoL',
    icon: 'Eye',
    defaultFolderName: 'RareScanner',
    latestVersion: '11.0.2.7',
    downloadUrl: 'https://github.com/mbarberog/RareScanner/releases/latest/download/RareScanner.zip',
    gameFlavors: ['retail'],
    isForeverRecommended: false,
  },
  {
    id: 'simc',
    name: 'Simulationcraft (装备跑分导出)',
    description: '一键生成装备属性与天赋专精导出代码，用于 Raidbots 网站进行跑分模拟与最佳配装计算。',
    author: 'SimulationCraft Team',
    category: 'Combat',
    icon: 'Cpu',
    defaultFolderName: 'Simulationcraft',
    latestVersion: 'v11.0.2-01',
    downloadUrl: 'https://github.com/simulationcraft/simc-addon/releases/latest/download/Simulationcraft.zip',
    githubRepo: 'simulationcraft/simc-addon',
    gameFlavors: ['retail'],
    isForeverRecommended: false,
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

    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(addon.downloadUrl)}`;
    response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`下载失败 (HTTP ${response.status})，请检查网络或稍后重试`);
    }
  }

  onProgress({
    status: 'downloading',
    addonName: addon.name,
    percent: 45,
    message: '下载完成，正在解析 ZIP 压缩包...',
  });

  const arrayBuffer = await response.arrayBuffer();

  return installAddonFromZip(targetDirHandle, arrayBuffer, (progress) => {
    onProgress({
      ...progress,
      addonName: addon.name,
    });
  });
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
