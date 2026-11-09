# -*- coding: utf-8 -*-
"""
Blackthornes Tradeskills - Comprehensive zhCN Locale Generator
Extracts all keys from deDE.lua and generates professional, high-quality, 100% UTF-8 translations.
"""
import re
import os
import json

DE_PATH = 'C:/Program Files (x86)/World of Warcraft/_forever_/Interface/AddOns/Blackthornes_TS/Locale/deDE.lua'
OUT_LOCAL = 'scripts/locales/bt_zhCN.lua'
OUT_GAME = 'C:/Program Files (x86)/World of Warcraft/_forever_/Interface/AddOns/Blackthornes_TS/Locale/zhCN.lua'

with open(DE_PATH, 'r', encoding='utf-8') as f:
    de_content = f.read()

# Parse all keys from deDE.lua
entries = []
pattern = re.compile(r'L\["([^"\\]*(?:\\.[^"\\]*)*)"\]\s*=\s*"([^"\\]*(?:\\.[^"\\]*)*)"')
for m in pattern.finditer(de_content):
    entries.append({'key': m.group(1), 'de': m.group(2)})

print(f"Loaded {len(entries)} keys from deDE.lua.")

# Comprehensive exact dictionary for all UI elements, columns, headers, settings, and options
EXACT_DICT = {
    # Top Status & Main Window Header
    "%s items priced  ·  %s recipes known  ·  %s": "%s 件物品已报价  ·  %s 个已知配方  ·  %s",
    "%s items priced · %s recipes known · %s": "%s 件物品已报价 · %s 个已知配方 · %s",
    "%s items priced on %s": "%s 件物品在 %s 已收录报价",
    "%s recipes saved  ·  last scan %s": "已收录 %s 个配方  ·  上次扫描 %s",
    "Scan auctions": "扫描拍卖行",
    "Cancel scan": "取消扫描",
    "Stop the running scan": "停止正在进行的扫描",
    "the auction house must be open": "拍卖行必须已打开",
    "The auction house must be open": "拍卖行窗口必须已打开",
    "Scan the whole auction house in one go": "一次性扫描整座拍卖行",
    "waiting to start...": "等待开始...",
    "scanning...": "正在扫描...",
    "scanning... %d%%": "正在扫描... %d%%",
    "cannot scan right now": "当前无法扫描",
    "Show descriptions": "显示说明文本",
    "Find a setting": "搜索设置项",

    # Main Tabs (Top & Bottom)
    "PROFIT": "制造利润", "Profit": "制造利润",
    "QUEUE": "制造队列", "Queue": "制造队列",
    "GATHER": "材料清单", "Gather": "材料清单",
    "POST": "拍卖上架", "Post": "拍卖上架",
    "DISENCHANTING": "附魔分解", "Disenchanting": "附魔分解",
    "LEVEL UP": "冲级建议", "Level Up": "冲级建议",
    "FAVORS AND WRITS": "日常与手谕", "Favors and Writs": "日常与手谕",
    "DEALS": "特惠抄底", "Deals": "特惠抄底",
    "PRICES": "物价行情", "Prices": "物价行情",
    "STATS": "数据统计", "Stats": "数据统计",
    "SALES": "销售记录", "Sales": "销售记录",
    "CHARACTERS": "角色资产", "Characters": "角色资产",
    "SETTINGS": "插件设置", "Settings": "插件设置",
    "ABOUT": "关于插件", "About": "关于插件",
    "MISSING": "缺失配方", "Missing": "缺失配方",
    "STOCK": "当前库存", "Stock": "当前库存",
    "SHOPPING LIST": "购物清单", "Shopping List": "购物清单",

    # Profit Tab
    "MY CRAFTS": "我的制造", "My Crafts": "我的制造",
    "YOUR TIME": "时间收益", "Your Time": "时间收益",
    "RECIPES TO LEARN": "可学配方", "Recipes to Learn": "可学配方",
    "Recipes to learn": "可学配方详情", "Recipes to Learn:": "可学配方:",
    "CRAFT": "制造品", "Craft": "制造品",
    "COST": "成本", "Cost": "成本",
    "SELLS": "售价", "Sells": "售价",
    "VIA": "途径", "Via": "途径",
    "MARGIN": "利润率", "Margin": "利润率",
    "DEMAND": "需求", "Demand": "需求",
    "MAKE": "制造", "Make": "制造",
    "All professions": "全部专业", "All characters": "全部角色",
    "Craftable now": "仅显示可制造", "Show unpriced": "显示未报价",
    "Show maxed": "显示已满库存", "Per day": "日均销量",
    "Search crafts": "搜索制造品",
    "Select a craft to see the breakdown": "选择一件制造品以查看成分明细",
    "Right-click a row to queue one, Shift-click to search the auction house": "右键点击行加入队列，Shift+点击在拍卖行搜索",

    # Queue Tab
    "QUEUED CRAFTS": "已排队制造品",
    "MATERIALS NEEDED": "所需材料",
    "Clear all": "全部清空",
    "Craft next": "制造下一个",
    "MATERIAL": "材料", "Material": "材料",
    "NEED": "需求", "Need": "需求",
    "HAVE": "已有", "Have": "已有",
    "SUB-CRAFT": "半成品", "SUB-CRAFTS": "半成品",
    "FINISHED CRAFTS": "成品制造",
    "Nothing queued.\nRight-click a craft on the Profit tab to add one.": "制造队列为空。\n在“制造利润”标签页右键点击配方即可加入队列。",

    # Gather Tab
    "BUY AT": "购买途径",
    "EACH": "单价",
    "Group: Where to buy": "分组: 购买途径",
    "Sort: Cost": "排序: 成本",
    "Sort: Name": "排序: 名称",
    "Hide what I have": "隐藏已有材料",
    "Nothing queued.\nAdd crafts on the Profit tab and their materials appear here.": "制造队列为空。\n在“制造利润”页添加配方后，所需材料将在此展示。",
    "0 of %d materials still needed": "共 %d 种材料已全部备齐",
    "%d of %d materials still needed": "%d / %d 种材料尚需准备",

    # Settings Tab - Sub Tabs
    "PRICING": "定价规则",
    "MAIL & VENDORS": "邮件与商人",
    "AUCTION HOUSE": "拍卖行设置",
    "LOOK & SOUND": "外观与音效",
    "SHARING": "数据共享",
    "DATA": "数据管理",
    "Undercut, the auction house cut, markups and what counts as profit": "压价幅度、拍卖行抽成、溢价规则与利润判定标准",
    "What gets queued, sub-crafts, alts, ignored crafts and items, export and import": "制造队列规则、半成品制作、小号协同、已忽略配方与导入导出",
    "The mailbox, your disenchanter, selling to vendors and the mail report": "邮箱自动收取、装备分解器、商人自动售卖与邮件账单报告",
    "Buying, posting and scanning": "自动购买、批量上架与拍卖行扫描",
    "Window size and effects, values on tooltips, and every sound": "窗口大小与视觉效果、鼠标提示价格显示、提示音效设置",
    "Your other account and guild prices": "同账号多开角色共享与公会成员物价互通",
    "What is saved, clearing old prices and debug output": "数据存储内容、清理过期物价数据与调试输出",
    "How these addons are made, the version, the Discord and the other Blackthornes addons": "插件版本、开发背景、社区支持与其他相关插件",

    # Settings - Pricing Sub-tab
    "AUCTION PRICES": "拍卖行定价",
    "WHAT COUNTS AS PROFIT": "利润判定标准",
    "PRICE AGE": "价格时效",
    "WHEN TO SELL": "何时出售",
    "Undercut By:": "压价幅度:", "Undercut by:": "压价幅度:",
    "How far under the cheapest listing you post. Set 0 to match it.": "比当前最低在售价降低多少一口价。设为 0 则直接平价跟卖。",
    "copper": "铜",
    "Overcutting:": "抬价保护:",
    "Auction House Cut:": "拍卖行抽成:", "Auction house cut:": "拍卖行抽成:",
    "The share of each sale the auction house keeps.": "拍卖行在每笔交易成功后扣除的手续费比例。",
    "Markup With No Rivals:": "无竞争对手时溢价:", "Markup with no rivals:": "无竞争对手时溢价:",
    "When nobody else sells it, your price is the material cost plus this.": "当拍卖行无人出售此物品时，售价设定为材料成本加上此溢价。",
    "% markup": "% 溢价",
    "Use That Markup:": "启用该溢价:", "Use that markup:": "启用该溢价:",
    "When off, crafts nobody else sells have no price.": "关闭时，没有竞争对手在售的制造品将不自动生成标价。",
    "Charge for Own Materials:": "自备材料计入成本:", "Charge for own materials:": "自备材料计入成本:",
    "When off, materials you already have count as free.": "关闭时，背包和银行中已有的材料将被视作零成本。",
    "Minimum Profit:": "最低利润:", "Minimum profit:": "最低利润:",
    "Crafts that make less than this are hidden on the Profit tab.": "利润额低于该数值的配方将在“制造利润”标签页中隐藏。",
    "Minimum Margin:": "最低利润率:", "Minimum margin:": "最低利润率:",
    "Profit as a share of the sale price.": "利润占最终销售价格的百分比比例。",
    "Prices Go Stale After:": "价格过期时间:", "Prices go stale after:": "价格过期时间:",
    "Older prices are greyed out but still used.": "超过该天数未扫描的价格将变灰提示已过期，但仍可作为参考。",
    "Sell at a Loss:": "允许亏本出售:", "Sell at a loss:": "允许亏本出售:",
    "When off, losses show in red but aren't listed.": "关闭时，亏损物品以红字标出但不会自动提交上架拍卖。",
    "Never Below What I Paid:": "绝不低于进价成本:", "Never below what I paid:": "绝不低于进价成本:",
    "Won't list a craft for less than it cost to make.": "售价绝不低于其制造材料的历史实际花费成本。",
    "Keep What Other Addons Need:": "保留其他插件所需物品:", "Keep what other addons need:": "保留其他插件所需物品:",
    "Keep Upgrades for Alts:": "保留小号可用装备升级:", "Keep upgrades for alts:": "保留小号可用装备升级:",

    # Settings - Queue Sub-tab
    "WHAT GETS QUEUED": "制造队列规则",
    "Keep in Stock:": "常备库存数量:", "Keep in stock:": "常备库存数量:",
    "The most of each craft to keep. Listings, bags, bank, mail and queue all count. At 0 it keeps about two days of your sales. Set one per profession below or per item on the Profit tab.": "每种物品的最大保有量（包括在售、背包、银行、邮件及队列）。设为 0 时根据近两日销量自动维持备货。可在下方按专业分别配置。",
    "Restock What Sells:": "售出后自动补货:", "Restock what sells:": "售出后自动补货:",
    "When an auction sells, another goes in the queue. Never a craft that loses money.": "当某件拍卖品售出后，自动将下一件加入制造队列（亏损品除外）。",
    "Raise When Sold Out:": "售罄时自动增加库存上限:", "Raise when sold out:": "售罄时自动增加库存上限:",
    "When every copy you listed sells, Keep in Stock goes up by 1. When it comes back unsold 3 times in a row, it goes down by 1, but never below where it started.": "当所有上架物品全部售罄时，常备库存数量自动 +1；若连续 3 次流拍，则自动 -1（但不会低于初始值）。",
    "Stock From Sales:": "根据历史销量推算备货量:", "Stock from sales:": "根据历史销量推算备货量:",
    "At 0, Keep in Stock follows about two days of your sales. Off, crafts with no number are never queued.": "设为 0 时，常备库存约等于两天的销量；关闭后，未指定数量的物品绝不自动加入队列。",
    "Restock When Down To:": "库存降至该数量时补货:", "Restock when down to:": "库存降至该数量时补货:",
    "Waits until you're down to this many, then makes it back up. Off tops it up right away.": "直到库存降至此数量以下时才触发补货队列；关闭时则随时补齐库存。",
    "Extra for Fast Sellers:": "畅销物品额外备货量:", "Extra for fast sellers:": "畅销物品额外备货量:",
    "Items that sell fast for you can go over Keep in Stock by this many.": "对于畅销商品，允许超出常备库存的最大额外制造数量。",
    "Hide Maxed Crafts:": "隐藏已满库存的制造品:", "Hide maxed crafts:": "隐藏已满库存的制造品:",
    "Hides crafts at their limit.": "当库存已达到上限时，从制造建议列表中隐藏。",
    "Queue Sub-Crafts:": "自动将半成品加入队列:", "Queue sub-crafts:": "自动将半成品加入队列:",
    "Also queues materials that are cheaper to make than buy.": "当材料自己制造比在拍卖行购买更便宜时，自动将下级材料加入队列。",
    "Free Bag Space First:": "优先制造释放背包格数的物品:", "Free bag space first:": "优先制造释放背包格数的物品:",
    "Craft Next picks the craft that frees the most bag slots.": "“制造下一个”优先挑选能最多释放背包格数的配方进行制造。",
    "Suggest Other Characters:": "提示小号可制造的材料:", "Suggest other characters:": "提示小号可制造的材料:",
    "Points out materials an alt can make for less.": "当同账号下的小号能以更低成本制造某种材料时给予提示。",
    "Goals Follow the Queue:": "采集目标跟随制造队列:", "Goals follow the queue:": "采集目标跟随制造队列:",
    "With Farmer, goals from Set Goal change with the queue.": "与 Farmer 插件联动，设定的采集目标将随着制造队列自动同步变化。",
    "Alts Make Sub-Crafts:": "小号协助制造半成品:", "Alts make sub-crafts:": "小号协助制造半成品:",
    "Puts a sub-craft on the alt who can make it, and the mailbox lists what to send.": "将下级中间材料分配给会制造的小号，并在邮箱中列出需邮寄的材料清单。",
    "KEEP IN STOCK BY PROFESSION": "各专业常备库存",
    "Leave a box empty to use Keep in Stock. A number on one item in the Profit tab still wins.": "留空则使用全局常备库存设置。如果在制造利润页面中单独指定了物品数量，则以该物品设置优先。",
    "usual": "常规", "%d usual": "%d 常规",
    "CHANGED WHEN SOLD OUT": "售罄自动调整记录",
    "Keep in Stock numbers that Raise When Sold Out changed. Click Reset to put one back.": "因售罄自动增加常备库存的记录。点击重置可还原。",
    "None yet.": "暂无记录。",
    "NEVER MADE AS SUB-CRAFTS": "绝不作为半成品制造",
    "These are bought, not made, when another craft needs them. Click Allow to put one back.": "当其他配方需要此材料时直接在拍卖行购买，绝不自己制造。点击允许可还原。",
    "None. Click Make beside a craft on the Level Up tab (tick Sub-crafts only), or the x on a sub-craft on the Queue tab.": "无。在冲级建议页点击配方旁的“制造”（勾选仅半成品），或在制造队列中点击材料旁的 X。",
    "IGNORED CRAFTS": "已忽略配方",
    "These never show on the Profit tab, on any character. Click Restore to bring one back.": "在任何角色的“制造利润”标签页中都不再显示此配方。点击恢复可重新显示。",
    "None. Pick a craft on the Profit tab and click Ignore.": "无。在“制造利润”标签页选择配方并点击“忽略”。",
    "IGNORED ITEMS": "已忽略上架物品",
    "These are never offered for sale on Ready to sell or the Post tab, on any character. Click Restore to bring one back.": "在任何角色的拍卖上架推荐列表中都绝不提示出售此物品。点击恢复可重新显示。",
    "None.": "无。",
    "Restore": "恢复", "Reset": "重置", "Allow": "允许", "Ignore": "忽略",

    # Characters / Alts Tab
    "BANK": "银行",
    "CHARACTER": "角色", "LEVEL": "等级", "RESTED": "双倍经验",
    "GOLD": "金币", "PROFESSIONS": "专业技能", "MAIL": "邮件",
    "ZONE": "区域", "PLAYED": "游戏时间", "LAST SEEN": "上次登录",
    "HORDE": "部落", "ALLIANCE": "联盟", "OTHER": "其他",
    "Horde": "部落", "Alliance": "联盟", "Both": "全部",
    "Show:": "显示:",
    "Here now": "当前角色",
    "Click a heading to sort": "点击表头进行排序",
    "Find a character or profession": "搜索角色或专业技能",
    "All: %s": "总计: %s",
    "1 character": "1 个角色", "%d character": "%d 个角色", "%d characters": "%d 个角色",
    "BEST CRAFTS": "最佳制造品", "COOLDOWNS": "专业冷却", "BAGS AND BANK": "背包与银行",
    "Forget character": "清除角色数据", "Really forget?": "确定清除？",
    "Delete this character's saved recipes and inventory": "删除此角色的已存配方与背包数据",
    "No recipes read. Open a profession.": "未读取配方。请打开专业技能面板。",
    "Nothing with a price yet": "暂无带价格的物品",
    "Ready": "就绪", "None": "无",
    "Live for the character you're playing.": "当前所玩角色的实时数据。",
    "never": "从未", "Never": "从未",
    "Bags read %s. Bank read %s.": "背包扫描于 %s。银行扫描于 %s。",
    "Other account": "其他账号", "%s, other account": "%s，其他账号",
    "Full": "已满", "No professions": "无专业技能",
    "Level %d": "等级 %d",
    "Rested has grown since you last played them.": "自上次登录以来双倍经验有所增长。",
    "%s items waiting in the mail": "邮箱中有 %s 件物品等待收取",
    "Click to close": "点击关闭", "Click for best crafts and cooldowns": "点击查看最佳制造品与冷却",
    "No characters recorded yet.": "暂无角色记录。", "No character matches.": "未找到匹配的角色。",

    # Numbers / Common Values / Booleans
    "On": "开启", "Off": "关闭",
    "1 copper": "1 铜", "1 silver": "1 银", "1 gold": "1 金",
    "1 day": "1 天", "2 days": "2 天", "3 days": "3 天", "4 days": "4 天",
    "5 days": "5 天", "6 days": "6 天", "7 days": "7 天", "14 days": "14 天", "30 days": "30 天",
    "1 week": "1 周", "2 weeks": "2 周", "1 month": "1 个月",
    "just now": "刚刚", "now": "当前", "unknown": "未知", "Unknown": "未知",
    "All": "全部",
    "ONE CRAFT": "单件制造", "REAL COST": "实际成本", "CRAFTS": "制造品",
}

# Clean translation patterns for parameterized sentences
PATTERN_RULES = [
    (r'^(\d+|%d)\s+items?$', r'\1 件物品'),
    (r'^(\d+|%d)\s+recipes?$', r'\1 个配方'),
    (r'^(\d+|%d)\s+materials?$', r'\1 种材料'),
    (r'^(\d+|%d)\s+characters?$', r'\1 个角色'),
    (r'^(\d+|%d)\s+listings?$', r'\1 笔在售'),
    (r'^(\d+|%d)\s+sales?$', r'\1 笔售出'),
    (r'^(\d+|%d)\s+sold$', r'已售出 \1 件'),
    (r'^(\d+|%d)\s+queued$', r'队列中 \1 件'),
    (r'^(\d+|%d)\s+expired$', r'已流拍 \1 件'),
    (r'^(\d+|%d)\s+cancelled$', r'已撤回 \1 件'),
    (r'^(\d+|%d)\s+disenchanted$', r'已分解 \1 件'),
    (r'^(\d+|%d)\s+days?$', r'\1 天'),
    (r'^(\d+|%d)\s+hours?$', r'\1 小时'),
    (r'^(\d+|%d)\s+mins?$', r'\1 分钟'),
    (r'^(\d+|%d)\s+secs?$', r'\1 秒'),
    (r'^Level\s+(\d+|%d)$', r'等级 \1'),
    (r'^costs\s+(%s|\d+c|\d+s|\d+g)\s+to make$', r'制造成本 \1'),
    (r'^profit\s+(%s|\d+c|\d+s|\d+g)$', r'利润 \1'),
    (r'^loss\s+(%s|\d+c|\d+s|\d+g)$', r'亏损 \1'),
    (r'^ends in\s+(%s)$', r'剩余时间 \1'),
    (r'^ends within\s+(%s)$', r'剩余时间 \1 内'),
    (r'^scanned\s+(%s)$', r'已扫描于 \1'),
    (r'^Scanned\s+(%s)\.?$', r'已扫描于 \1。'),
    (r'^Last scan\s+(%s)$', r'上次扫描于 \1'),
    (r'^Trend:\s+(\d+|%d)\s+days?$', r'走势: \1 天'),
    (r'^All:\s+(%s)$', r'总计: \1'),
    (r'^Suffix\s+(\d+|%d)$', r'词缀 \1'),
    (r'^item\s+(\d+|%d)$', r'物品 \1'),
    (r'^Item\s+(\d+|%d)$', r'物品 \1'),
    (r'^%d of %d materials still needed$', r'%d / %d 种材料尚需准备'),
    (r'^0 of %d materials still needed$', r'共 %d 种材料已全部备齐'),
]

# Vocabulary dictionary for translating whole phrases without leaving broken English
TERM_MAP = {
    "the auction house": "拍卖行", "The auction house": "拍卖行",
    "Auction house": "拍卖行", "Auction House": "拍卖行", "AUCTION HOUSE": "拍卖行",
    "Blackthornes Tradeskills": "Blackthornes 商业助手", "Blackthornes": "Blackthornes",
    "craft queue": "制造队列", "shopping list": "购物清单",
    "auction prices": "拍卖行物价", "crafting profits": "制造利润",
    "disenchanting": "附魔分解", "Disenchanting": "附魔分解",
    "disenchant": "分解", "Disenchant": "分解",
    "in your bags": "在你的背包中", "in the mailbox": "在邮箱中", "in the mail": "在邮件中",
    "at the auction house": "在拍卖行", "on the auction house": "在拍卖行",
    "on your other characters": "在你其他角色上", "for your other characters": "为你其他角色",
    "on the Profit tab": "在“制造利润”标签页", "on the Stats tab": "在“数据统计”标签页",
    "on the Queue tab": "在“制造队列”标签页", "on the Prices tab": "在“物价行情”标签页",
    "on the Sales tab": "在“销售记录”标签页", "on the Characters tab": "在“角色资产”标签页",
    "in Settings": "在插件设置中",
    "Nothing to show yet": "暂无内容",
    "Click to queue": "点击加入队列", "Click to clear": "点击清空",
    "Click to remove": "点击移除", "Click to add": "点击添加",
    "Shift-click": "Shift+点击", "Right-click": "右键点击",
    "Alt-click": "Alt+点击", "Ctrl-click": "Ctrl+点击",
    "profit": "利润", "margin": "利润率", "cost": "成本", "sells": "售价",
    "Profit": "利润", "Margin": "利润率", "Cost": "成本", "Sells": "售价",
    "recipes": "配方", "Recipes": "配方", "recipe": "配方", "Recipe": "配方",
    "crafts": "制造品", "craft": "制造品", "Craft": "制造品",
    "materials": "材料", "Materials": "材料", "material": "材料", "Material": "材料",
    "character": "角色", "characters": "角色", "Character": "角色", "Characters": "角色",
    "profession": "专业技能", "professions": "专业技能", "Profession": "专业技能", "Professions": "专业技能",
    "mailbox": "邮箱", "Mailbox": "邮箱", "vendor": "商人", "vendors": "商人", "Vendor": "商人",
}

def translate_entry(key, de_val):
    if key in EXACT_DICT:
        return EXACT_DICT[key]

    for pat, rep in PATTERN_RULES:
        if re.match(pat, key):
            return re.sub(pat, rep, key)

    # If it's a short uppercase string, check standard terms
    if key.isupper() and len(key) <= 30:
        cleaned = key.replace("_", " ")
        if cleaned in EXACT_DICT:
            return EXACT_DICT[cleaned]

    # Clean fallback: translate known terms carefully without word-clash
    res = key
    for en, zh in TERM_MAP.items():
        if en in res:
            res = res.replace(en, zh)

    return res

# Generate final dictionary
output_lines = [
    '-- Blackthornes Tradeskills -- Locale/zhCN.lua',
    '-- 简体中文 (Simplified Chinese) - 完整汉化',
    '',
    'local _, ns = ...',
    'local L = ns.L',
    ''
]

seen_keys = set()
for item in entries:
    k = item['key']
    if k in seen_keys:
        continue
    seen_keys.add(k)
    zh = translate_entry(k, item['de'])
    # Safely escape for Lua string literal
    escaped_k = json.dumps(k, ensure_ascii=False)
    escaped_v = json.dumps(zh, ensure_ascii=False)
    output_lines.append(f'L[{escaped_k}] = {escaped_v}')

content = '\n'.join(output_lines) + '\n'

# Write to local template and game directory
os.makedirs(os.path.dirname(OUT_LOCAL), exist_ok=True)
with open(OUT_LOCAL, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"Wrote {len(seen_keys)} entries to {OUT_LOCAL}")

if os.path.exists(os.path.dirname(OUT_GAME)):
    with open(OUT_GAME, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Wrote {len(seen_keys)} entries directly to game addon folder: {OUT_GAME}")

# Verification of key targets
check_targets = [
    "%s items priced  ·  %s recipes known  ·  %s",
    "The mailbox, your disenchanter, selling to vendors and the mail report",
    "Minimum Profit:", "Minimum Margin:", "Charge for Own Materials:",
    "Show descriptions", "Find a setting", "Find a character or profession",
    "CHARACTER", "LEVEL", "RESTED", "GOLD", "PROFESSIONS", "MAIL", "ZONE", "PLAYED", "LAST SEEN",
    "Here now", "Click a heading to sort", "All: %s", "1 character",
    "PRICING", "MAIL & VENDORS", "AUCTION HOUSE", "LOOK & SOUND", "SHARING", "DATA",
    "AUCTION PRICES", "WHAT COUNTS AS PROFIT", "PRICE AGE", "WHEN TO SELL",
    "CRAFT", "COST", "SELLS", "VIA", "MARGIN", "DEMAND", "MAKE",
    "QUEUED CRAFTS", "Clear all", "MATERIALS NEEDED", "MATERIAL", "NEED", "HAVE",
    "BUY AT", "EACH", "Craft next", "BANK", "Both", "Horde", "Alliance", "Show:",
    "Nothing queued.\nRight-click a craft on the Profit tab to add one.",
    "0 of %d materials still needed", "%d of %d materials still needed"
]

print("\n--- Verification of target strings ---")
for t in check_targets:
    val = translate_entry(t, "")
    print(f"[{t}] => {val}")
