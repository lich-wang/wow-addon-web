import fs from 'node:fs';

const DICTIONARY = {
  // Navigation & Tabs
  "PROFIT": "制造利润",
  "DEALS": "特惠抄底",
  "QUEUE": "制造队列",
  "POST": "拍卖上架",
  "SALES": "销售统计",
  "STATS": "数据统计",
  "PRICES": "物价行情",
  "SETTINGS": "插件设置",
  "CHARACTERS": "角色资产",
  "ABOUT": "关于插件",
  "DISENCHANTING": "附魔分解",
  "LEVEL UP": "冲级配方",
  "MISSING": "缺失配方",
  "STOCK": "当前库存",
  "SHOPPING LIST": "购物清单",

  // Professions
  "Blacksmithing": "锻造",
  "Leatherworking": "制皮",
  "Tailoring": "裁缝",
  "Alchemy": "炼金术",
  "Enchanting": "附魔",
  "Engineering": "工程学",
  "Cooking": "烹饪",
  "First Aid": "急救",
  "Mining": "采矿",
  "Herbalism": "草药学",
  "Skinning": "剥皮",
  "Fishing": "钓鱼",

  // Core AH terms
  "Auction House": "拍卖行",
  "Auction house": "拍卖行",
  "Bid": "竞标",
  "Buyout": "一口价",
  "Deposit": "保管费",
  "Duration": "拍卖时限",
  "Undercut": "压价",
  "High": "高",
  "Medium": "中",
  "Low": "低",
  "Profit": "利润",
  "Cost": "成本",
  "Revenue": "收入",
  "Margin": "利润率",
  "Craft": "制造",
  "Craft All": "全部制造",
  "Reagents": "材料",
  "Materials": "制造原料",
  "Disenchant": "分解",
  "Disenchanting": "附魔分解",
  "Vendor": "商人",
  "Merchant": "商人出售",
  "Market Price": "市场价",
  "Historical Price": "历史价格",
  "Min Buyout": "最低一口价",
  "Recent Scan": "最近扫描",
  "Scan Now": "立即扫描",
  "Scanning...": "正在扫描拍卖行...",
  "Scan Complete": "扫描完成",
  "Full Scan": "全量扫描",
  "Fast Scan": "快速扫描",

  // Durations
  "2 hours": "2小时",
  "8 hours": "8小时",
  "24 hours": "24小时",

  // Common sentences & prompts
  "Saved for Claude, /reload to write it.": "配置已保存，输入 /reload 重新加载生效。",
  "module %s:%s failed": "模块 %s:%s 运行失败",
  "open or close the window": "打开或关闭主窗口",
  "  |c%s/bts help all|r shows more, including checks and developer tools.": "  |c%s/bts help all|r 查看更多命令（包括诊断与开发者工具）。",
  "show the main commands (/bts help all: every command)": "显示常用命令列表 (/bts help all 查看所有命令)",
  "what took longest this session, to find a hitch (/bts perf clear starts over)": "查看本会话耗时最长的操作以排查卡顿 (/bts perf clear 重置耗时统计)",
  "unknown command '%s'. Try |c%s/bts help|r.": "未知命令 '%s'。请输入 |c%s/bts help|r 获取帮助。",
  "/bts %s failed: %s": "/bts %s 执行失败: %s",
  "saved data is incomplete (part %d of %d missing); starting fresh.": "保存的数据不完整（缺失第 %d/%d 部分），正在重新初始化。",
  "saved data could not be read; starting fresh.": "无法读取已保存的数据，正在重新初始化。",
  "type |c%s/bts|r to open the window, or |c%s/bts help|r for the commands.": "输入 |c%s/bts|r 打开主窗口，或输入 |c%s/bts help|r 查看命令列表。",
  "Open each profession once and visit the auction house to fill in recipes and prices.": "请将每个专业技能窗口打开一次，并访问一次拍卖行以获取配方与物价数据。",
  "YOUR SAVED DATA DID NOT LOAD. Prices, recipes, your queue and sales history are missing this session.": "已保存的数据未能加载。本次会话缺少价格、配方、队列和销售历史。",
  "Blackthornes Tradeskills: your saved data did not load. See chat.": "Blackthornes Tradeskills: 存档数据未能加载，请查看聊天框详情。",
  "turn extra chat detail on or off": "开启或关闭聊天框额外详细信息",
  "extra chat detail on": "已开启聊天框详细信息",
  "extra chat detail off": "已关闭聊天框详细信息",
  "Guild prices are off.": "公会价格共享已关闭。",
  "marked %d %s bought to disenchant. Right-click it on the Disenchanting tab to unmark it.": "已将 %d 个 %s 标记为分解扫货。可在“附魔分解”标签页中右键取消标记。",
  "the game has not sent its name yet": "游戏尚未返回物品名称数据",
  "A few of you have asked if AI is used in the creation of my AddOns. It is.": "关于是否使用 AI 辅助制作本插件：是的，已深度借助 AI 优化代码结构。"
};

export function translateBTKey(enKey, deVal) {
  if (DICTIONARY[enKey]) return DICTIONARY[enKey];

  let zh = enKey;

  // Direct word replacements
  const wordMap = [
    [/Auction House/g, '拍卖行'],
    [/auction house/g, '拍卖行'],
    [/Blackthornes Tradeskills/g, 'Blackthornes 商业助手'],
    [/Blackthornes/g, 'Blackthornes'],
    [/Disenchanting/g, '附魔分解'],
    [/disenchanting/g, '附魔分解'],
    [/Disenchant/g, '分解'],
    [/disenchant/g, '分解'],
    [/Professions?/g, '专业技能'],
    [/professions?/g, '专业技能'],
    [/Recipes?/g, '配方'],
    [/recipes?/g, '配方'],
    [/Materials?/g, '材料'],
    [/materials?/g, '材料'],
    [/Reagents?/g, '材料'],
    [/reagents?/g, '材料'],
    [/Buyout/g, '一口价'],
    [/buyout/g, '一口价'],
    [/Bid/g, '竞标'],
    [/bid/g, '竞标'],
    [/Deposit/g, '保管费'],
    [/deposit/g, '保管费'],
    [/Profit/g, '利润'],
    [/profit/g, '利润'],
    [/Margin/g, '利润率'],
    [/margin/g, '利润率'],
    [/Queue/g, '制造队列'],
    [/queue/g, '制造队列'],
    [/Scanner?/g, '扫描器'],
    [/scanner?/g, '扫描器'],
    [/Scanning/g, '正在扫描'],
    [/scanning/g, '正在扫描'],
    [/Characters?/g, '角色'],
    [/characters?/g, '角色'],
    [/Shopping list/g, '购物清单'],
    [/shopping list/g, '购物清单'],
    [/Level Up/g, '冲级建议'],
    [/level up/g, '提升等级'],
    [/Vendor/g, '商人'],
    [/vendor/g, '商人'],
    [/Undercut/g, '压价'],
    [/undercut/g, '压价'],
    [/Inventory/g, '库存背包'],
    [/inventory/g, '库存背包'],
    [/Settings/g, '设置'],
    [/settings/g, '设置'],
    [/History/g, '历史记录'],
    [/history/g, '历史记录'],
    [/Mailbox/g, '邮箱'],
    [/mailbox/g, '邮箱'],
    [/Bank/g, '银行'],
    [/bank/g, '银行'],
    [/Bags?/g, '背包'],
    [/bags?/g, '背包']
  ];

  for (const [re, rep] of wordMap) {
    if (re.test(zh)) {
      zh = zh.replace(re, rep);
    }
  }

  return zh;
}

export function generateBTZhCN(entries) {
  const lines = [
    '-- Blackthornes Tradeskills -- Locale/zhCN.lua',
    '-- 简体中文 (Simplified Chinese) - 强制加载全部中文',
    '',
    'local _, ns = ...',
    'local L = ns.L',
    ''
  ];

  for (const { key, deVal } of entries) {
    const zh = translateBTKey(key, deVal);
    lines.push(`L[${JSON.stringify(key)}] = ${JSON.stringify(zh)}`);
  }

  return lines.join('\n');
}
