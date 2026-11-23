/**
 * 「无限百科」页面使用的页签定义。
 * slash 与插件内 TAB_DEFS 的别名保持一致，因此网页与游戏内渲染的是同一套页面。
 */
export interface WikiTab {
  id: string;
  label: string;
  slash: string;
}

export const WIKI_TABS: WikiTab[] = [
  { id: 'home', label: '智能匹配', slash: '/wowf' },
  { id: 'route', label: '升级路线', slash: '/wowf route' },
  { id: 'class', label: '职业与天赋', slash: '/wowf class' },
  { id: 'macro', label: '一键宏库', slash: '/wowf macro' },
  { id: 'dungeon', label: '地下城百科', slash: '/wowf dungeon' },
  { id: 'news', label: '专业&无限特色', slash: '/wowf news' },
  { id: 'rep', label: '声望', slash: '/wowf rep' },
  { id: 'cmd', label: '无限服速查', slash: '/wowf cmd' },
  { id: 'arb', label: '制造套利', slash: '/wowf arb' },
];

/** 职业下拉的固定顺序，与插件内 CLASS_ORDER 一致 */
export const CLASS_ORDER = [
  'WARRIOR',
  'PALADIN',
  'HUNTER',
  'ROGUE',
  'PRIEST',
  'SHAMAN',
  'MAGE',
  'WARLOCK',
  'DRUID',
];

/** 种族下拉的固定顺序：先联盟后部落，天裔放最后 */
export const ROUTE_ORDER = [
  'human',
  'dwarf',
  'night-elf',
  'gnome',
  'skyborne-alliance',
  'orc',
  'undead',
  'tauren',
  'troll',
  'skyborne-horde',
];
