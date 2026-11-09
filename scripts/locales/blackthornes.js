import fs from 'node:fs';

const DICTIONARY = {
  // Navigation & 12 Main Tabs (Both Title Case and UPPERCASE for robust matching)
  "PROFIT": "制造利润",
  "Profit": "制造利润",
  "QUEUE": "制造队列",
  "Queue": "制造队列",
  "GATHER": "材料清单",
  "Gather": "材料清单",
  "POST": "拍卖上架",
  "Post": "拍卖上架",
  "DISENCHANTING": "附魔分解",
  "Disenchanting": "附魔分解",
  "LEVEL UP": "冲级建议",
  "Level Up": "冲级建议",
  "FAVORS AND WRITS": "日常与手谕",
  "Favors and Writs": "日常与手谕",
  "DEALS": "特惠抄底",
  "Deals": "特惠抄底",
  "PRICES": "物价行情",
  "Prices": "物价行情",
  "STATS": "数据统计",
  "Stats": "数据统计",
  "SALES": "销售记录",
  "Sales": "销售记录",
  "CHARACTERS": "角色资产",
  "Characters": "角色资产",
  "SETTINGS": "插件设置",
  "Settings": "插件设置",
  "ABOUT": "关于插件",
  "About": "关于插件",
  "MISSING": "缺失配方",
  "STOCK": "当前库存",
  "SHOPPING LIST": "购物清单",

  // Sub-tabs & Headers under Profit (Image 4)
  "MY CRAFTS": "我的制造",
  "YOUR TIME": "时间收益",
  "RECIPES TO LEARN": "可学配方",
  "Recipes to learn": "可学配方详情",
  "Recipes to Learn:": "可学配方:",
  "Pick a recipe to see what goes into it and where to learn it.": "选择一个配方以查看所需材料及学习途径。",
  "Values use the prices you have scanned. Recipes come from Classic's data, corrected by what your profession windows and recipe tooltips show.": "利润根据您扫描的拍卖行物价计算。配方信息取自经典旧世数据，并根据专业技能窗口及提示动态修正。",
  "%d recipe  ·  %d make a profit at today's prices": "%d 个配方  ·  %d 个按今日物价有利润",
  "%d recipes  ·  %d make a profit at today's prices": "%d 个配方  ·  %d 个按今日物价有利润",
  "%s items priced  ·  %s recipes known  ·  %s": "%s 件物品已有报价  ·  %s 个已知配方  ·  %s",
  "Show learned too": "显示已学会的配方",
  "Search recipes": "搜索配方",
  "Search crafts": "搜索制造品",
  "All professions": "所有专业技能",
  "All": "全部",
  "Sub-crafts only": "仅显示中间材料",
  "Craftable now": "当前可制造",
  "Only what I craft with": "仅显示制造所需材料",

  // Table Column Headers (Image 4)
  "RECIPE": "配方",
  "SKILL": "技能",
  "COST": "成本",
  "SELLS": "售价",
  "DISENCHANT": "分解",
  "LEARN FROM": "学习途径",
  "LEARN NEXT": "下步学习",
  "REAGENTS": "材料",
  "MATERIALS": "材料",
  "BUY": "购买",
  "MAKE": "制造",
  "NEED": "需求",
  "HAVE": "已有",
  "DEMAND": "需求度",
  "PROFIT EACH": "单件利润",
  "COST EACH": "单件成本",
  "MARGIN": "利润率",

  // Learning Sources (Image 4)
  "Trainer": "训练师",
  "Starter": "初始学会",
  "Unknown": "未知途径",
  "Quest or other": "任务或其他",
  "Vendor": "商人出售",
  "Drop": "怪物掉落",

  // Top Bar & Scan Controls (Image 4)
  "Scan auctions": "扫描拍卖行",
  "the auction house must be open": "拍卖行必须已打开",
  "open the auction house first": "请先打开拍卖行窗口",
  "cannot scan right now": "当前无法扫描",
  "waiting to start...": "等待开始...",
  "Cancel scan": "取消扫描",
  "Stop the running scan": "停止正在运行的扫描",
  "Scan the whole auction house in one go": "一次性全量扫描整个拍卖行",
  "never scanned": "从未扫描",
  "Never scanned": "从未扫描",
  "Never scanned.": "从未扫描。",
  "not scanned yet": "尚未扫描",
  "Not scanned yet": "尚未扫描",
  "Not scanned yet, so priced from its materials": "尚未扫描，价格由材料成本估算",
  "materials not scanned": "材料尚未扫描",
  "scanned %s": "已扫描于 %s",
  "Scanned %s": "已扫描于 %s",
  "Scanned %s.": "已扫描于 %s。",
  "scanned %s (stopped at the page limit)": "已扫描于 %s (受页面上限停止)",
  "Last scan %s": "上次扫描于 %s",
  "No scan yet": "暂无扫描数据",
  "No auction data yet. Open the auction house and press Scan.": "暂无拍卖数据。请打开拍卖行窗口并点击“扫描拍卖行”。",
  "Scan complete": "扫描完成",
  "Scan complete: %s prices": "扫描完成：已收录 %s 种物价",
  "Scan complete: %s prices updated": "扫描完成：已更新 %s 种物价",
  "Scan complete: %s prices updated, %s sold out": "扫描完成：%s 种物价已更新，%s 种已售罄",
  "scanning...": "正在扫描...",
  "scanning... %d%%": "正在扫描... %d%%",
  "Times scanned": "扫描次数",
  "The buy price is the cheapest listing when last scanned (%s).": "买入价为最近一次扫描到的最低一口价 (%s)。",

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
  "auction house": "拍卖行",
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
  "Merchant": "商人出售",
  "Market Price": "市场价",
  "Historical Price": "历史价格",
  "Min Buyout": "最低一口价",
  "Recent Scan": "最近扫描",
  "Scan Now": "立即扫描",
  "Scanning...": "正在扫描拍卖行...",
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

  // Exact phrases and multi-word idioms
  const phrases = [
    [/the auction house must be open/gi, '拍卖行必须已打开'],
    [/open the auction house first/gi, '请先打开拍卖行窗口'],
    [/never scanned/gi, '从未扫描'],
    [/not scanned yet/gi, '尚未扫描'],
    [/make a profit/gi, '有制造利润'],
    [/at today's prices/gi, '按今日市价'],
    [/Auction House/g, '拍卖行'],
    [/auction house/g, '拍卖行'],
    [/Blackthornes Tradeskills/g, 'Blackthornes 商业助手'],
    [/Blackthornes/g, 'Blackthornes'],
    [/Disenchanting/g, '附魔分解'],
    [/disenchanting/g, '附魔分解'],
    [/Disenchant/g, '分解'],
    [/disenchant/g, '分解'],
    [/\bProfessions?\b/g, '专业技能'],
    [/\bprofessions?\b/g, '专业技能'],
    [/\bRecipes?\b/g, '配方'],
    [/\brecipes?\b/g, '配方'],
    [/\bMaterials?\b/g, '材料'],
    [/\bmaterials?\b/g, '材料'],
    [/\bReagents?\b/g, '材料'],
    [/\breagents?\b/g, '材料'],
    [/\bBuyout\b/g, '一口价'],
    [/\bbuyout\b/g, '一口价'],
    [/\bBid\b/g, '竞标'],
    [/\bbid\b/g, '竞标'],
    [/\bDeposit\b/g, '保管费'],
    [/\bdeposit\b/g, '保管费'],
    [/\bProfit\b/g, '利润'],
    [/\bprofit\b/g, '利润'],
    [/\bMargin\b/g, '利润率'],
    [/\bmargin\b/g, '利润率'],
    [/\bQueue\b/g, '制造队列'],
    [/\bqueue\b/g, '制造队列'],
    [/\bScanned\b/g, '已扫描'],
    [/\bscanned\b/g, '已扫描'],
    [/\bScanning\b/g, '正在扫描'],
    [/\bscanning\b/g, '正在扫描'],
    [/\bScanner\b/g, '扫描器'],
    [/\bscanner\b/g, '扫描器'],
    [/\bCharacters?\b/g, '角色'],
    [/\bcharacters?\b/g, '角色'],
    [/\bShopping list\b/gi, '购物清单'],
    [/\bLevel Up\b/gi, '冲级建议'],
    [/\bVendor\b/g, '商人'],
    [/\bvendor\b/g, '商人'],
    [/\bUndercut\b/g, '压价'],
    [/\bundercut\b/g, '压价'],
    [/\bInventory\b/g, '库存背包'],
    [/\binventory\b/g, '库存背包'],
    [/\bSettings\b/g, '设置'],
    [/\bsettings\b/g, '设置'],
    [/\bHistory\b/g, '历史记录'],
    [/\bhistory\b/g, '历史记录'],
    [/\bMailbox\b/g, '邮箱'],
    [/\bmailbox\b/g, '邮箱'],
    [/\bBank\b/g, '银行'],
    [/\bbank\b/g, '银行'],
    [/\bBags?\b/g, '背包'],
    [/\bbags?\b/g, '背包']
  ];

  for (const [re, rep] of phrases) {
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

  const seen = new Set();

  // First output all explicit DICTIONARY entries
  for (const [k, v] of Object.entries(DICTIONARY)) {
    lines.push(`L[${JSON.stringify(k)}] = ${JSON.stringify(v)}`);
    seen.add(k);
  }

  // Then process remaining entries from deDE
  for (const { key, deVal } of entries) {
    if (seen.has(key)) continue;
    const zh = translateBTKey(key, deVal);
    lines.push(`L[${JSON.stringify(key)}] = ${JSON.stringify(zh)}`);
    seen.add(key);
  }

  return lines.join('\n');
}
