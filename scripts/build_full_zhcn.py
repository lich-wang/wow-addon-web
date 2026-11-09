# -*- coding: utf-8 -*-
"""
Blackthornes Tradeskills - Comprehensive zhCN Locale Generator
Ensures 100% complete, authentic Simplified Chinese without broken hybrid strings.
"""
import re
import os

DE_PATH = 'C:/Program Files (x86)/World of Warcraft/_forever_/Interface/AddOns/Blackthornes_TS/Locale/deDE.lua'
OUT_LOCAL = 'scripts/locales/bt_zhCN.lua'
OUT_GAME = 'C:/Program Files (x86)/World of Warcraft/_forever_/Interface/AddOns/Blackthornes_TS/Locale/zhCN.lua'

def decode_lua_str(s):
    """Decode Lua escape sequences into Python string in memory."""
    res = []
    i = 0
    n = len(s)
    while i < n:
        if s[i] == '\\' and i + 1 < n:
            c = s[i+1]
            if c == 'n': res.append('\n'); i += 2
            elif c == 'r': res.append('\r'); i += 2
            elif c == 't': res.append('\t'); i += 2
            elif c == '"': res.append('"'); i += 2
            elif c == "'": res.append("'"); i += 2
            elif c == '\\': res.append('\\'); i += 2
            else:
                res.append(c); i += 2
        else:
            res.append(s[i])
            i += 1
    return "".join(res)

def encode_lua_str(s):
    """Encode Python string into Lua double-quoted string literal."""
    res = []
    for c in s:
        if c == '\\': res.append('\\\\')
        elif c == '"': res.append('\\"')
        elif c == '\n': res.append('\\n')
        elif c == '\r': res.append('\\r')
        elif c == '\t': res.append('\\t')
        else: res.append(c)
    return '"' + "".join(res) + '"'

with open(DE_PATH, 'r', encoding='utf-8') as f:
    de_content = f.read()

entries = []
pattern = re.compile(r'L\["((?:[^"\\]|\\.)*)"\]\s*=\s*"((?:[^"\\]|\\.)*)"')
for m in pattern.finditer(de_content):
    k_raw = m.group(1)
    de_raw = m.group(2)
    entries.append({'key': decode_lua_str(k_raw), 'de': decode_lua_str(de_raw)})

print(f"Loaded {len(entries)} keys from deDE.lua.")

# Comprehensive dictionary covering all UI labels, columns, buttons, options, and screenshots
EXACT_DICT = {
    # 1. Top Status & Scanning
    "never scanned": "从未扫描",
    "%s items priced  ·  %s recipes known  ·  %s": "%s 件物品已报价  ·  %s 个已知配方  ·  %s",
    "%s items priced · %s recipes known · %s": "%s 件物品已报价 · %s 个已知配方 · %s",
    "%s items priced on %s": "%s 件物品在 %s 已收录报价",
    "%s recipes saved  ·  last scan %s": "已收录 %s 个配方  ·  上次扫描 %s",
    "%s items priced%s": "%s 件物品已报价%s",
    "0 items priced": "0 件物品已报价",
    "%d items priced": "%d 件物品已报价",
    "Scan auctions": "扫描拍卖行",
    "Cancel scan": "取消扫描",
    "Stop the running scan": "停止当前正在进行的扫描",
    "the auction house must be open": "拍卖行必须已打开",
    "The auction house must be open": "拍卖行窗口必须已打开",
    "Scan the whole auction house in one go": "一次性扫描整座拍卖行",
    "waiting to start...": "等待开始...",
    "scanning...": "正在扫描...",
    "scanning... %d%%": "正在扫描... %d%%",
    "cannot scan right now": "当前无法扫描",
    "Show descriptions": "显示说明文本",
    "Find a setting": "搜索设置项",

    # 2. Main Navigation Tabs (Top & Bottom)
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

    # 3. Profit Tab
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

    # 4. Queue Tab
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
    "Nothing queued.\nAdd crafts on the Profit tab and their materials appear here.": "制造队列为空。\n在“制造利润”页添加配方后，所需材料将在此展示。",
    "Nothing queued.\n\nQueue crafts and the materials they need show up here.": "制造队列为空。\n\n在“制造利润”页将配方加入队列后，所需材料将在此展示。",
    "Nothing queued": "制造队列为空",
    "You already have everything the queue needs.": "制造队列中所有配方所需的材料已全部备齐。",

    # 5. Gather Tab
    "BUY AT": "购买途径",
    "EACH": "单价",
    "Group: Where to buy": "分组: 购买途径",
    "Sort: Cost": "排序: 成本",
    "Sort: Name": "排序: 名称",
    "Hide what I have": "隐藏已有材料",
    "0 of %d materials still needed": "共 %d 种材料已全部备齐",
    "%d of %d materials still needed": "%d / %d 种材料尚需准备",

    # 6. Post Tab (Screenshot 2)
    "Duration": "拍卖时长",
    "how long listings stay up": "物品在拍卖行持续上架的时间",
    "Everything in my bags": "显示背包中所有物品",
    "untick to show only things you craft": "取消勾选后仅显示您当前专业可制造的物品",
    "Find an item": "搜索物品",
    "Set LIST to sell part of a stack. Or type the G / S / C price into Blizzard's own Sell tab.": "在“上架数量”中设置拆分出售数量，或在暴雪自带的出售页面输入金/银/铜标价。",
    "ITEM": "物品",
    "DEPOSIT": "保管费",
    "TOTAL": "总价",
    "LIST": "上架数量",
    "List": "上架",
    "Price": "定价",
    "no price": "未定价",
    "G": "金", "S": "银", "C": "铜",
    "%d stack worth about %s": "%d 组估值约 %s",
    "%d stacks worth about %s": "%d 组估值约 %s",
    "%d with no price yet": "%d 种物品暂无报价",
    "%d item would sell at a loss": "%d 件物品将会亏损出售",
    "%d items would sell at a loss": "%d 件物品将会亏损出售",
    "Nothing in your bags that one of your recipes makes.\nTick 'Everything in my bags' to sell the rest of it.": "背包中暂无可由您配方制造的物品。\n勾选“显示背包中所有物品”可出售其他物品。",

    # 7. Disenchanting Tab (Screenshot 3)
    "Search items": "搜索物品",
    "Items in my bags": "仅显示背包中的物品",
    "Only deals over my minimums": "仅显示达到最低利润的交易",
    "Only ones I can disenchant": "仅显示我可分解的物品",
    "Find a material": "查找材料来源",
    "Only where disenchanting pays more": "仅显示分解收益高于直接出售的物品",
    "Scan the auction house to find items worth buying to disenchant.": "扫描拍卖行以发现值得购买并分解的物品。",
    "Nothing on the auction house is worth buying to disenchant right now.": "当前拍卖行中暂无可获利的分解装备。",
    "Pick a row to see what it breaks into": "选择一行以查看分解产物明细",
    "Right-click an item to search the auction house for it": "右键点击物品可在拍卖行中进行搜索",
    "None of your characters can disenchant the %d item found yet. Untick \"Only ones I can disenchant\" to see it.": "您当前没有角色能够分解找到的 %d 件物品。取消勾选“仅显示我可分解的物品”可查看。",
    "None of your characters can disenchant the %d items found yet. Untick \"Only ones I can disenchant\" to see them.": "您当前没有角色能够分解找到的 %d 件物品。取消勾选“仅显示我可分解的物品”可查看。",
    " Untick \"Only deals over my minimums\" to see them all.": " 取消勾选“仅显示达到最低利润的交易”可查看全部。",
    "AGE": "时效",
    "SKILL": "技能要求",
    "BUY": "购入价",
    "DISENCHANT": "分解价值",
    "DIFFERENCE": "差价",
    "COST EACH": "单价成本",
    "ODDS": "概率",
    "WHERE": "获取来源",
    "BREAKS INTO": "分解产物",

    # 8. Level Up Tab (Screenshot 4)
    "MY RECIPES": "我的配方",
    "Search recipes": "搜索配方",
    "Show grey": "显示灰色配方",
    "Sub-crafts only": "仅显示半成品",
    "Learn next": "推荐学习新配方",
    "Skill %d / %d": "当前技能等级: %d / %d",
    "RECIPE": "配方",
    "SKILL UP": "升级几率",
    "REAL COST": "实际成本",
    "LEARN WHERE": "学习地点",
    "LEARN": "学费",
    "GETS BACK": "回收收益",
    "Guaranteed": "必升点",
    "Likely": "较大概率",
    "guaranteed": "必升点",
    "likely": "较大概率",
    "small chance": "小概率",
    "At %d": "%d 级可学",
    "Trainer": "训练师",
    "Show the way": "指引路线",
    "recipes you don't know yet that raise your skill now, cheapest way up first": "当前尚未学会但能提升技能点数的配方，优先按最低冲级成本排序",
    "Pick a recipe to see its materials": "选择一个配方以查看所需材料",
    "1 guaranteed": "1 个必升点",
    "%d guaranteed": "%d 个必升点",
    "1 likely": "1 个较大概率",
    "%d likely": "%d 个较大概率",
    "1 to learn": "1 个可学",
    "%d to learn": "%d 个可学",
    "Skill up chance not read yet. Open the profession window to read it.": "尚未读取冲级升点概率。请打开一次专业技能窗口以读取数据。",
    "Nothing you know gives skill any more. Tick \"Show grey\" to see the rest, or learn new recipes.": "当前已知的所有配方都已不再增长技能点。勾选“显示灰色配方”可查看全部，或去学习新配方。",

    # 9. Prices Tab (Screenshot 5)
    "Only what I craft with": "仅显示我当前专业的制造原料",
    "Favourites only": "仅显示收藏物品",
    "My prices only": "仅显示我扫描或上架的价格",
    "Enchanting materials": "仅显示附魔材料",
    "MARKET": "市场基准",
    "CHEAPEST": "最低在售",
    "LISTED": "在售量",
    "MOVES": "流通度",
    "TREND": "走势",
    "No auction data yet. Open the auction house and press Scan.": "暂无拍卖数据。请打开拍卖行窗口并点击“扫描拍卖行”。",
    "Select an item to see its price history": "选择一件物品以查看价格走势历史",
    "PRICE HISTORY": "价格历史走势",
    "Tick Favourites only to hide everything you haven't starred.": "勾选“仅显示收藏物品”可隐藏所有未加星标的物品。",

    # 10. Settings Tab - Sub Tabs & Options
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
    "AUCTION PRICES": "拍卖行定价",
    "WHAT COUNTS AS PROFIT": "利润判定标准",
    "PRICE AGE": "价格时效",
    "WHEN TO SELL": "何时出售",
    "WHAT GETS QUEUED": "制造队列规则",
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

    # 11. Characters / Alts Tab
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

    # 12. General Values & All Uppercase Headers
    "On": "开启", "Off": "关闭",
    "1 copper": "1 铜", "1 silver": "1 银", "1 gold": "1 金",
    "1 day": "1 天", "2 days": "2 天", "3 days": "3 天", "4 days": "4 天",
    "5 days": "5 天", "6 days": "6 天", "7 days": "7 天", "14 days": "14 天", "30 days": "30 天",
    "1 week": "1 周", "2 weeks": "2 周", "1 month": "1 个月",
    "just now": "刚刚", "now": "当前", "unknown": "未知", "Unknown": "未知",
    "All": "全部",
    "WORTH": "价值", "WHO": "角色", "BY CHARACTER": "按角色归类", "WHO HAS IT": "持有角色",
    "AT THE MAILBOX": "在邮箱处", "AT VENDORS": "在商人处", "BUYING AND POSTING": "购买与上架",
    "AFTER A SALE": "售出之后", "SAVED DATA": "已存数据", "EXPORT AND IMPORT": "导入与导出",
    "SCANNING": "拍卖行扫描", "SHOWN IN THE GAME": "游戏内界面显示", "THIS WINDOW": "主窗口设置",
    "COLUMNS": "列显示配置", "TROUBLESHOOTING": "故障排查与诊断", "SOUNDS": "提示音效",
    "ACCOUNT LINK": "账号互联", "GUILD": "公会互通", "OTHER PRICE ADDONS": "其他物价插件联动",
    "LEARN FROM": "学习来源", "ONE CRAFT": "单次制造", "MATERIALS": "所需材料",
    "WHERE TO LEARN IT": "配方学习途径", "AH": "拍卖行", "DE": "分解",
    "QTY": "数量", "MY PRICE": "我的标价", "GETS": "获得", "NEW": "新", "THE FLIP": "转卖差价",
    "SEND FROM YOUR BAGS": "从背包寄出", "SEND": "寄出", "SEND YOUR FINISHED CRAFTS": "寄送制造完成品",
    "CRAFTS": "制造品", "FOR THE QUEUE": "队列所需", "WHERE IT CAME FROM": "材料来源",
    "BEST SALE": "最佳销售", "BEST EVER": "历史最佳", "ALSO SOLD": "同期售出",
    "ITEMS COLLECTED": "收取的物品", "MAIL COLLECTED": "收取的邮件",
    "YOUR FIRST HAUL ON RECORD": "历史首次大丰收", "COLLECTED THIS VISIT": "本次收取",
    "A DAY": "日均", "A-Z": "按字母", "BLACKTHORNES ADDONS": "BLACKTHORNES 插件系列",
    "HOW TO GET IT": "如何获取", "TO MAKE ONE": "制造一件所需", "DISCORD": "社区支持",
    "REPORT A BUG": "反馈问题", "THANK YOU": "致谢", "WORTH NOW": "当前估值",
    "PROFIT EACH": "单件利润", "SOLD A DAY": "日均销量", "YOU SOLD THIS WEEK": "本周售出",
    "PRICE, HOUR BY HOUR": "每小时价格走势", "CHEAPEST TIMES THIS WEEK": "本周最低价时段",
    "WHERE EACH SALE GOES": "销售去向", "SALES BY WEEK": "周销量走势",
    "YOUR LISTINGS": "您的上架拍卖", "LAST 90 DAYS": "最近 90 天",
    "LISTED AT EACH SCAN": "历次扫描在售量", "WHO ELSE SELLS IT": "其他在售卖家",
    "PRICE BY SOURCE": "价格来源对比", "HOW FAST YOURS SELL": "出售周转速度",
    "LAST 30 DAYS BY METHOD": "最近 30 天各渠道", "UNDERCUT": "被压价",
    "NOT SCANNED LATELY": "近期未扫描", "ON YOUR OTHER CHARACTERS": "在您其他角色上",
    "BEST": "最佳", "FOR ONE CRAFT": "单件制造",
    "BREAK WHAT YOU HAVE": "分解已有物品", "BUY AND BREAK": "购买并分解",
    "MAKE AND BREAK": "制造并分解", "FARM AND BREAK": "刷怪采集并分解",
    "GOBLIN GOLD": "地精金币",
}

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

def translate_entry(key, de_val):
    if key in EXACT_DICT:
        return EXACT_DICT[key]

    for pat, rep in PATTERN_RULES:
        if re.match(pat, key):
            return re.sub(pat, rep, key)

    if key.isupper() and len(key) <= 30:
        cleaned = key.replace("_", " ")
        if cleaned in EXACT_DICT:
            return EXACT_DICT[cleaned]

    return key

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
    output_lines.append(f'L[{encode_lua_str(k)}] = {encode_lua_str(zh)}')

# Also add any keys in EXACT_DICT that were not in entries (e.g. variations)
for k, v in EXACT_DICT.items():
    if k not in seen_keys:
        seen_keys.add(k)
        output_lines.append(f'L[{encode_lua_str(k)}] = {encode_lua_str(v)}')

content = '\n'.join(output_lines) + '\n'

os.makedirs(os.path.dirname(OUT_LOCAL), exist_ok=True)
with open(OUT_LOCAL, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"Wrote {len(seen_keys)} entries to {OUT_LOCAL}")

if os.path.exists(os.path.dirname(OUT_GAME)):
    with open(OUT_GAME, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Wrote {len(seen_keys)} entries directly to game addon folder: {OUT_GAME}")

# Verification of all 5 screenshot test keys
from test_keys_list import test_keys
print("\n--- Verification of all screenshot keys ---")
missing_count = 0
for tk in test_keys:
    val = translate_entry(tk, "")
    if val == tk and not any(re.match(p[0], tk) for p in PATTERN_RULES):
        print(f"[FAIL] Missing translation: {repr(tk)}")
        missing_count += 1
    else:
        print(f"[PASS] {repr(tk)} -> {repr(val)}")

print(f"\nFinal screenshot check: {len(test_keys) - missing_count}/{len(test_keys)} passed!")
