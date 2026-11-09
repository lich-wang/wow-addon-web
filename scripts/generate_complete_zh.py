import json
import re
import os

de_path = 'C:/Program Files (x86)/World of Warcraft/_forever_/Interface/AddOns/Blackthornes_TS/Locale/deDE.lua'
with open(de_path, 'r', encoding='utf-8') as f:
    de_content = f.read()

entries = []
for m in re.finditer(r'L\["([^"\\]*(?:\\.[^"\\]*)*)"\]\s*=\s*"([^"\\]*(?:\\.[^"\\]*)*)"', de_content):
    entries.append({'key': m.group(1), 'de': m.group(2)})

print(f"Parsed {len(entries)} entries directly from deDE.lua.")

# Navigation & 14 Main Tabs (Short, clean labels)
EXACT_DICT = {
  "PRICING": "定价规则", "MAIL & VENDORS": "邮件与商人", "AUCTION HOUSE": "拍卖行设置",
  "LOOK & SOUND": "外观与音效", "SHARING": "数据共享", "DATA": "数据管理",
  "BANK": "公会仓/银行", "PROFIT": "利润", "Profit": "利润",
  "QUEUE": "制造队列", "Queue": "制造队列", "GATHER": "材料清单", "Gather": "材料清单",
  "POST": "拍卖上架", "Post": "拍卖上架", "DISENCHANTING": "附魔分解", "Disenchanting": "附魔分解",
  "LEVEL UP": "冲级建议", "Level Up": "冲级建议", "FAVORS AND WRITS": "日常与手谕", "Favors and Writs": "日常与手谕",
  "DEALS": "特惠抄底", "Deals": "特惠抄底", "PRICES": "物价行情", "Prices": "物价行情",
  "STATS": "数据统计", "Stats": "数据统计", "SALES": "销售记录", "Sales": "销售记录",
  "CHARACTERS": "角色资产", "Characters": "角色资产", "SETTINGS": "插件设置", "Settings": "插件设置",
  "ABOUT": "关于插件", "About": "关于插件", "MISSING": "缺失配方", "STOCK": "当前库存",
  "SHOPPING LIST": "购物清单", "MY CRAFTS": "我的制造", "YOUR TIME": "时间收益",
  "RECIPES TO LEARN": "可学配方", "Recipes to learn": "可学配方详情", "Recipes to Learn:": "可学配方:",

  # Settings
  "Find a setting": "搜索设置项", "Show descriptions": "显示说明文本",
  "AUCTION PRICES": "拍卖行定价", "WHAT COUNTS AS PROFIT": "利润认定标准", "PRICE AGE": "物价时效", "WHEN TO SELL": "出售时机",
  "BAGS AND BANK": "背包与银行", "CRAFT QUEUE": "制造队列设置", "MAILBOX": "邮箱设置",
  "RESTOCKING": "补货与备货", "WINDOW": "窗口外观", "SOUNDS": "提示音效",
  "COLOR PALETTE": "主题配色", "DATABASE": "数据库", "BACKUP": "备份与还原",
  "Undercut By:": "压价幅度:", "Undercut by:": "压价幅度:",
  "Overcutting:": "抬价销售:", "Auction House Cut:": "拍卖行抽成:", "Auction house cut:": "拍卖行抽成:",
  "Markup With No Rivals:": "无竞争时溢价:", "Markup with no rivals:": "无竞争时溢价:",
  "Use That Markup:": "启用无竞争溢价:", "Use that markup:": "启用无竞争溢价:",
  "Charge for Own Materials:": "计入自备材料成本:", "Charge for own materials:": "计入自备材料成本:",
  "Minimum Profit:": "最低利润额:", "Minimum profit:": "最低利润额:",
  "Minimum Margin:": "最低利润率:", "Minimum margin:": "最低利润率:",
  "Prices Go Stale After:": "物价过期时间:", "Prices go stale after:": "物价过期时间:",
  "Sell at a Loss:": "允许亏损出售:", "Sell at a loss:": "允许亏损出售:",
  "Never Below What I Paid:": "绝不低于进价成本:", "Never below what I paid:": "绝不低于进价成本:",
  "Keep What Other Addons Need:": "保留其他插件所需材料:", "Keep what other addons need:": "保留其他插件所需材料:",
  "Keep Upgrades for Alts:": "保留小号提升装备:", "Keep upgrades for alts:": "保留小号提升装备:",
  "Keep in Stock:": "常备库存数量:", "Keep in stock:": "常备库存数量:",
  "Restock What Sells:": "售出后自动补货:", "Restock what sells:": "售出后自动补货:",
  "Raise When Sold Out:": "售罄时自动增加库存上限:", "Raise when sold out:": "售罄时自动增加库存上限:",
  "Stock From Sales:": "根据历史销量推算备货量:", "Stock from sales:": "根据历史销量推算备货量:",
  "Restock When Down To:": "库存降至该数量时补货:", "Restock when down to:": "库存降至该数量时补货:",
  "Extra for Fast Sellers:": "畅销物品额外备货量:", "Extra for fast sellers:": "畅销物品额外备货量:",
  "Hide Maxed Crafts:": "隐藏已满库存的制造品:", "Hide maxed crafts:": "隐藏已满库存的制造品:",
  "Queue Sub-Crafts:": "自动将半成品加入队列:", "Queue sub-crafts:": "自动将半成品加入队列:",
  "Free Bag Space First:": "优先制造释放背包格数的物品:", "Free bag space first:": "优先制造释放背包格数的物品:",
  "Suggest Other Characters:": "提示小号可制造的材料:", "Suggest other characters:": "提示小号可制造的材料:",
  "Goals Follow the Queue:": "采集目标跟随制造队列:", "Goals follow the queue:": "采集目标跟随制造队列:",
  "Alts Make Sub-Crafts:": "小号协助制造半成品:", "Alts make sub-crafts:": "小号协助制造半成品:",
  "Disenchant Next Button:": "一键分解下一个物品按钮:", "Disenchant next button:": "一键分解下一个物品按钮:",
  "Take Queue Materials from Mail:": "打开邮箱自动收取队列材料:",
  "Play Sound on Scan Complete:": "扫描完成时播放提示音:", "Scan Sound:": "扫描提示音:",
  "On": "开启", "Off": "关闭", "All": "全部", "None": "无", "none": "无", "never": "从未", "Never": "从未",
  "just now": "刚刚", "now": "当前", "Full": "已满", "Ready": "就绪", "unknown": "未知", "Unknown": "未知",
  "1 copper": "1 铜", "% markup": "% 溢价", "2 days": "2 天", "3 days": "3 天",
  "5 days": "5 天", "7 days": "7 天", "14 days": "14 天", "30 days": "30 天",
  "How far under the cheapest listing you post. Set 0 to match it.": "在最低一口价基础上降低的压价幅度。设为 0 则直接跟价平排。",
  "When nobody else sells it, your price is the material cost plus this.": "当拍卖行无竞品在售时，定价为自备材料成本加上此溢价比例。",
  "When off, crafts nobody else sells have no price.": "关闭时，没有竞争对手在售的物品将不自动生成标价。",
  "When off, materials you already have count as free.": "关闭时，背包与银行已有的材料视为零成本（计入免费）。",
  "When off, losses show in red but aren't listed.": "关闭时，亏损物品以红字标出但不会自动提交上架拍卖。",
  "Won't list a craft for less than it cost to make.": "售价绝不低于其制造材料的历史实际花费成本。",
  "Crafts that make less than this are hidden on the Profit tab.": "利润额低于该数值的配方将在“制造利润”标签页中隐藏。",
  "Profit as a share of the sale price.": "利润占最终销售价格的百分比比例。",
  "Older prices are greyed out but still used.": "超过该天数未扫描的价格将变灰提示已过期，但仍可作为参考。",
  "The most of each craft to keep. Listings, bags, bank, mail and queue all count. At 0 it keeps about two days of your sales. Set one per profession below or per item on the Profit tab.": "每种物品的最大保有量（包括在售、背包、银行、邮件及队列）。设为 0 时根据近两日销量自动维持备货。可在下方按专业分别配置。",
  "When an auction sells, another goes in the queue. Never a craft that loses money.": "当某件拍卖品售出后，自动将下一件加入制造队列（亏损品除外）。",
  "When every copy you listed sells, Keep in Stock goes up by 1. When it comes back unsold 3 times in a row, it goes down by 1, but never below where it started.": "当所有上架物品全部售罄时，常备库存数量自动 +1；若连续 3 次流拍，则自动 -1（但不会低于初始值）。",
  "At 0, Keep in Stock follows about two days of your sales. Off, crafts with no number are never queued.": "设为 0 时，常备库存约等于两天的销量；关闭后，未指定数量的物品绝不自动加入队列。",
  "Waits until you're down to this many, then makes it back up. Off tops it up right away.": "直到库存降至此数量以下时才触发补货队列；关闭时则随时补齐库存。",
  "Items that sell fast for you can go over Keep in Stock by this many.": "对于畅销商品，允许超出常备库存的最大额外制造数量。",
  "Hides crafts at their limit.": "当库存已达到上限时，从制造建议列表中隐藏。",
  "Also queues materials that are cheaper to make than buy.": "当材料自己制造比在拍卖行购买更便宜时，自动将下级材料加入队列。",
  "Craft Next picks the craft that frees the most bag slots.": "“制造下一个”优先挑选能最多释放背包格数的配方进行制造。",
  "Points out materials an alt can make for less.": "当同账号下的小号能以更低成本制造某种材料时给予提示。",
  "With Farmer, goals from Set Goal change with the queue.": "与 Farmer 插件联动，设定的采集目标将随着制造队列自动同步变化。",
  "Puts a sub-craft on the alt who can make it, and the mailbox lists what to send.": "将下级中间材料分配给会制造的小号，并在邮箱中列出需邮寄的材料清单。",
  "A button that disenchants the next item your queue marked DE, one per click.": "提供一个一键分解按钮，每次点击自动分解队列中标记为分解的下一个物品。",
  "Leave a box empty to use Keep in Stock. A number on one item in the Profit tab still wins.": "留空则使用全局常备库存设置。如果在制造利润页面中单独指定了物品数量，则以该物品设置优先。",
  "Posts just under the big stack when a few cheaper ones should sell within a day. Only for things that stack.": "当低价少量散碎物品有望在一天内售罄时，直接将大堆物品挂在主力价格线下方压价。仅对可堆叠物品生效。",

  # Characters
  "Find a character or profession": "搜索角色或专业技能", "Show:": "显示:", "Both": "全部阵营",
  "Horde": "部落", "Alliance": "联盟", "ALLIANCE": "联盟", "HORDE": "部落", "OTHER": "其他",
  "Here now": "当前在线", "Click a heading to sort": "点击表头可排序", "Click to close": "点击关闭",
  "Click for best crafts and cooldowns": "点击查看高利润配方与技能冷却",
  "Live for the character you're playing.": "当前正在游玩的角色实时数据。",
  "Rested has grown since you last played them.": "双倍经验自上次下线后已有增长。",
  "No character matches.": "没有匹配的角色。", "No characters recorded yet.": "暂无收录的角色数据。",
  "No professions": "未学习专业技能", "Other account": "其他账号",
  "Forget character": "删除角色数据", "Really forget?": "确定删除？",
  "Delete this character's saved recipes and inventory": "清空并删除该角色的配方库与背包/银行库存数据",
  "No recipes read. Open a profession.": "尚未读取配方。请打开专业技能窗口。",
  "Nothing with a price yet": "暂无带报价的数据",
  "CHARACTER": "角色", "LEVEL": "等级", "RESTED": "双倍经验", "GOLD": "金币",
  "PROFESSIONS": "专业技能", "MAIL": "邮件", "ZONE": "当前区域", "PLAYED": "游戏时间", "LAST SEEN": "最后在线",
  "BEST CRAFTS": "最赚配方", "COOLDOWNS": "专业冷却", "BAGS AND BANK": "背包与银行",
  "1 character": "1 个角色", "%d character": "%d 个角色", "%d characters": "%d 个角色",
  "All: %s": "总计: %s", "Level %d": "%d 级", "%s, other account": "%s (其他账号)",
  "%s items waiting in the mail": "邮箱中有 %s 件物品等待查收",
  "Bags read %s. Bank read %s.": "背包读取于 %s，银行读取于 %s。",

  # Sales
  "Recent sales": "最近销售", "Recent, all": "最近全部", "Still listed": "在售未结",
  "By item": "按物品归类", "Profit by method": "按渠道利润", "Mailbox visits": "查阅邮箱记录",
  "Gold in and out": "收支流水", "unknown item": "未知物品", "sold": "已售出", "Sold": "已售出",
  "sold  ·  gold waiting in the mail": "已售出 · 金币待收取", "gold still held": "金币待收",
  "you cancelled it": "已主动撤回", "expired, nobody bought it": "流拍，无人竞价购买", "ended": "已结束",
  "sold or back in the mail": "已售出或已退回信箱", "item": "物品", "cost not known": "成本未知",
  "Profit (some est.)": "利润 (含部分预估)", "Costed sales": "含成本销售",
  "Profit per sale": "单笔利润", "nothing dated": "暂无记录", "Units sold": "售出件数",
  "Expired": "流拍", "You cancelled": "已撤回", "Sell-through": "售罄率",
  "Taken in": "累计入账", "Average per sale": "单笔均价", "Auction cut": "拍卖行抽成",
  "Profit tab says": "制造利润页标定", "Still being paid": "结算中",
  "The auction cut and cancellations here are from this session only.": "此处的拍卖行抽成与撤回记录仅统计本次游戏会话。",
  "A cost marked est. is what the materials cost today.": "标有预估（est.）的成本系按今日材料市场均价折算。",
  "Each sale counts as one, even a whole stack.": "每笔交易计为一次销售（整组亦按一笔计算）。",
  "Everything": "全部统计", "Items sold": "售出物品", "Different items": "不同物品种数",
  "Mailbox read": "上次查阅邮箱", "Open a mailbox to bring in your newest sales.": "打开邮箱以同步最新销售记录。",
  "Click an item to see how it has done. Sell-through leaves out listings you cancelled.": "点击物品查看销售走势与表现。售罄率已剔除您主动撤回的拍卖品。",
  "this session": "本次会话", "today": "今日", "the last 7 days": "最近 7 天", "the last 30 days": "最近 30 天",
  "Nothing yet. Gold you make and spend from now on is written down here, with where it came from.": "暂无流水。从现在起您赚取和花费的金币及来源都将在此记录。",
  "Nothing yet for this period. Sales at auction, to vendors and disenchants are written down as they happen, with what each cost you.": "此期间暂无记录。拍卖出售、商人售卖与附魔分解均会在发生时在此记录并核算成本。",
  "Cost": "成本", "Costs are what crafting or buying on the auction house cost you.": "成本为您在制造物品或在拍卖行购买原材料时所产生的实际花费。",
  "Open the auction house once and what you have listed shows here, even after you log out.": "只需打开一次拍卖行，您上架在售的物品就会显示在此处（下线后依然保留）。",
  "Nothing was listed at your last auction house visit.": "您上次查阅拍卖行时没有上架任何物品。",
  "Nothing recorded yet. Sales and expiries are written down when you open the mailbox they arrive in.": "暂无销售记录。物品售出或流拍后，查阅一次邮箱即可自动记录。",
  "Nothing recorded yet. Visit a mailbox after a listing has ended and it will appear here.": "暂无销售记录。物品售出后查阅一次邮箱即可在此显示。",
  "No mailbox visits yet. Collect mail and each visit shows up here. Click one to see its report again.": "暂无邮箱查阅记录。收取邮件后每次记录都会在此显示，点击可重新查看账单报告。",
  "Nothing sold yet. Switch to 'Recent, all' to see what came back.": "暂无售出记录。可切换到“最近全部”查看退回的流拍物品。",
  "Search sales": "搜索销售记录", "Click to see this visit's report again": "点击重新查看本次查阅的邮件报告",
  "0 listings": "0 笔", "1 listing": "1 笔", "%d listings": "%d 笔",
  "0 sold  ·  taken in 0c": "已售出 0 件  ·  累计入账 0 铜",
  "%d sold  ·  taken in %s": "已售出 %d 件  ·  累计入账 %s",
  "%d sold": "已售出 %d 件", "%d sold to vendors": "售给商人 %d 件", "%d disenchanted": "分解 %d 件",
  "%d expired": "%d 件流拍", "%d cancelled": "%d 件撤回", "%d listed": "%d 件在售",
  "%d%% sold through": "售罄率 %d%%", "profit %s": "利润 %s", "cost %s": "成本 %s", "cut %s": "抽成 %s",

  # Stats
  "Sun": "周日", "Mon": "周一", "Tue": "周二", "Wed": "周三", "Thu": "周四", "Fri": "周五", "Sat": "周六",
  "Scan the auction house at different times of day to fill this in.": "在一天的不同时段扫描拍卖行以填充此数据。",
  "It costs about the same all day.": "该物品全天各个时段的价格基本平稳持平。",
  "Keep scanning at different hours to learn its cheapest time.": "请在更多不同时段进行扫描，以获悉全周最低价时机。",
  "You don't craft this, so there is no cost to show.": "您未学习此配方，暂无制造成本可展示。",
  "Its materials have no price yet.": "其制造材料暂无拍卖价格数据。",
  "Materials": "材料成本", "Auction house cut": "拍卖行抽成", "Deposit": "保管费",
  "You keep": "个人净得", "Sells for": "最终售价",
  "Nothing listed yet. Your sales and returns show here as the mail comes in.": "暂无挂牌记录。物品销售与流拍退信将随着收取邮件在此更新。",
  "Came back": "流拍退回", "Taken down": "下架撤回",
  "No sales yet. Each week you sell it shows here.": "暂无销售数据。每周的销售统计将在此展示。",
  "Best week yet, this week": "历史最佳周（本周）", "Best week": "历史最佳周",
  "Scan the auction house to see how many are listed.": "请扫描拍卖行以查看在售挂牌数量。",
  "Your scans": "个人扫描数据", "Your guild": "公会数据", "A vendor pays": "商人收购价",
  "A vendor sells it for": "商人售价", "No price from anywhere yet.": "暂无任何渠道的价格数据。",
  "Starts from today. Each day you scan adds a day here, up to ninety.": "从今日起计。每天扫描拍卖行即可累加一天的数据记录，最长支持 90 天。",
  "Fills in from your next full scan of the auction house.": "将在下次全量扫描拍卖行后自动填充数据。",
  "seller at the last full scan": "位卖家在上次全量扫描中在售", "sellers at the last full scan": "位卖家在上次全量扫描中在售",
  "Biggest seller has": "在售最多的卖家拥有", "You have": "你拥有",
  "Under 2 hours": "2 小时以内", "2 to 8 hours": "2 到 8 小时", "8 to 24 hours": "8 到 24 小时", "Longer": "更久",
  "Fills in as your listings sell, from today on.": "自今日起，随着您的物品售出将自动记录售出速度。",
  "Nothing sold in the last 30 days.": "最近 30 天内暂无售出记录。",
  "CHEAPEST TIMES THIS WEEK": "本周最低价时段", "WHERE EACH SALE GOES": "销售成本与利润去向",
  "SALES BY WEEK": "每周销售量走势", "YOUR LISTINGS": "个人在售记录", "LAST 90 DAYS": "最近 90 天",
  "LISTED AT EACH SCAN": "每次扫描在售数量", "WHO ELSE SELLS IT": "竞争对手在售情况",
  "PRICE BY SOURCE": "各渠道价格分布", "HOW FAST YOURS SELL": "个人售出速度", "LAST 30 DAYS BY METHOD": "近30天渠道分布",
  "Sells a day": "日均销量", "under 1": "小于 1", "Up for sale now": "当前在售", "Stock that sells a day": "日均消化在售量",
  "Time to sell what's up": "预计清仓耗时", "under a day": "不到 1 天", "about 1 day": "约 1 天",
  "none sold yet": "尚未售出过", "Your own listings": "个人上架记录", "What the market wants": "市场需求热度",
  "From your auction scans.": "来源于您的拍卖行扫描数据。",
  "no price from a week ago yet": "暂无一周前的价格数据", "no price for it yet": "暂无此物品价格数据",
  "you don't craft this": "你无法制造此物品", "by your scans": "基于您的扫描数据", "in the last 7 days": "最近 7 天内",
  "You craft this": "你可制造此物品", "starred": "已收藏", "not scanned yet": "尚未扫描",
  "This chart could not be drawn.": "暂无足够数据以绘制此图表。", "Search AH": "在拍卖行搜索",
  "Search the auction house for this item": "在拍卖行搜索该物品",
  "WORTH NOW": "当前价值", "PROFIT EACH": "单件利润", "SOLD A DAY": "日均销量",
  "YOU SOLD THIS WEEK": "本周个人销量", "PRICE, HOUR BY HOUR": "价格走势 (小时级)",
  "Pick an item on the left to see its charts.": "在左侧列表中选择一件物品以查看走势图表。",
  "Nothing matches that search.": "没有匹配该搜索条件的物品。",
  "Nothing to show yet. Items you craft, star or sell show here.": "暂无数据。你制造、收藏或出售的物品都将在此展示。",
  "Search items": "搜索物品", "open the Stats tab, at an item when you name or link one": "打开数据统计标签页，并跳转至所输入的物品",
  "No item by that name to show.": "未找到该名称对应的物品。",
  "24 Hours": "24小时", "7 Day": "7天", "14 Day": "14天",
  "No scans in the last 24 hours. Scan the auction house to start the line.": "最近 24 小时内无扫描记录。请扫描拍卖行以绘制价格曲线。",
  "Best times: learning (%d of %d hours, %d of %d days)": "最佳时机: 正在学习 (%d/%d 小时, %d/%d 天)",
  "a material has no price data": "部分材料暂无价格数据",

  # Prices
  "TREND": "走势", "AGE": "时效", "MOVES": "热度", "LISTED": "在售数量",
  "CHEAPEST": "最低一口价", "MARKET": "市场均价",
  "Remove from favourites": "取消收藏", "Add to favourites": "加入收藏",
  "Tick Favourites only to hide everything you haven't starred.": "勾选“仅显示收藏”可隐藏未加星标的其它物品。",
  "Use this price": "指定该自产价格", "Never below": "设为保底底价",
  "Used instead of the AH price": "直接替代拍卖行均价作为标价",
  "AH price, but never below": "采用拍卖行市价，但绝不低于该底价",
  "MY PRICE": "自设价格", "Clear": "清空", "Back to the auction house price": "还原为拍卖行市价",
  "My price": "自设价格", "Your own price. Pick whether it replaces the auction house price or is the lowest it can go.": "您自己设定的专属价格。可选择直接替代拍卖行市价，或作为上架的最低保底底价。",
  "Not set, the AH price is used": "未指定，默认采用拍卖行市价",
  "See this item's charts on the Stats tab": "在数据统计标签页中查看该物品的详细图表",
  "Market value": "市场参考均价", "Cheapest listing": "当前最低一口价", "Cheapest rival": "竞争对手最低价",
  "Your listing": "你的在售价格", "Listed quantity": "在售总数量", "Times scanned": "扫描收录次数",
  "Confidence": "可信度", "Stock movement": "库存周转速率", "In your bags": "背包内数量",
  "Random suffixes": "随机词缀附魔", "Price for each suffix": "各词缀专属报价", "PRICE HISTORY": "价格历史走势",
  "Deep scan": "深度全量扫描", "Looks up every listing of this item.": "针对该物品检索查询全部在售列表。",
  "Select an item to see its price history": "选择一件物品以查看其价格历史走势。",
  "none listed": "当前无在售挂牌", "not enough history": "历史样本数据不足",
  "The auction house must be open": "拍卖行窗口必须已打开",
  "No favourites yet. Click the star beside an item to keep it here.": "暂无收藏物品。点击物品旁的星标图标即可在此置顶收录。",
  "No prices of your own yet. Pick an item and type one under My price.": "暂无自设物价。选择一件物品并在“自设价格”框中输入价格。",
  "No auction data yet. Open the auction house and press Scan.": "暂无拍卖数据。请打开拍卖行窗口并点击“扫描拍卖行”。",
  "Nothing matches these filters.": "没有符合当前筛选条件的物品。",
  "Trend: 7 days": "价格走势: 7 天", "Trend: 14 days": "价格走势: 14 天", "Trend: %d days": "价格走势: %d 天",
  "Only what I craft with": "仅显示制造所需材料", "Favourites only": "仅显示收藏",
  "My prices only": "仅显示自设物价", "Enchanting materials": "附魔分解材料", "ITEM": "物品",
  "0 items priced": "0 件物品已收录报价", "%d items priced": "%d 件物品已收录报价",
  "%s item priced%s": "%s 件物品已收录报价%s", "%s items priced%s": "%s 件物品已收录报价%s",

  # Top Bar & Status
  "Scan auctions": "扫描拍卖行",
  "the auction house must be open": "拍卖行必须已打开",
  "open the auction house first": "请先打开拍卖行窗口",
  "cannot scan right now": "当前无法扫描",
  "waiting to start...": "等待开始...",
  "Cancel scan": "取消扫描",
  "Stop the running scan": "停止正在运行的扫描",
  "Scan the whole auction house in one go": "一次性全量扫描整个拍卖行",
  "Never scanned": "从未扫描", "Never scanned.": "从未扫描。",
  "Not scanned yet, so priced from its materials": "尚未扫描，价格由材料成本估算",
  "materials not scanned": "材料尚未扫描",
  "scanned %s": "已扫描于 %s", "Scanned %s": "已扫描于 %s", "Scanned %s.": "已扫描于 %s。",
  "scanned %s (stopped at the page limit)": "已扫描于 %s (受页面上限停止)",
  "Last scan %s": "上次扫描于 %s", "No scan yet": "暂无扫描数据",
  "No auction data yet. Open the auction house and press Scan.": "暂无拍卖数据。请打开拍卖行窗口并点击“扫描拍卖行”。",
  "Scan complete": "扫描完成", "Scan complete: %s prices": "扫描完成：已收录 %s 种物价",
  "Scan complete: %s prices updated": "扫描完成：已更新 %s 种物价",
  "Scan complete: %s prices updated, %s sold out": "扫描完成：%s 种物价已更新，%s 种已售罄",
  "scanning...": "正在扫描...", "scanning... %d%%": "正在扫描... %d%%",
  "The buy price is the cheapest listing when last scanned (%s).": "买入价为最近一次扫描到的最低一口价 (%s)。",
  "0 items priced · 0 known recipes · never scanned": "已收录 0 件物价 · 0 个已知配方 · 从未扫描",
  "%s items priced  ·  %s known recipes  ·  %s": "已收录 %s 件物价  ·  %s 个已知配方  ·  %s",

  # Professions & Sources
  "Blacksmithing": "锻造", "Leatherworking": "制皮", "Tailoring": "裁缝", "Alchemy": "炼金术",
  "Enchanting": "附魔", "Engineering": "工程学", "Jewelcrafting": "珠宝加工", "Inscription": "铭文",
  "Cooking": "烹饪", "First Aid": "急救", "Fishing": "钓鱼", "Mining": "采矿", "Herbalism": "草药学", "Skinning": "剥皮",
  "Trainer": "训练师", "Starter": "初始学会", "Quest or other": "任务或其他", "Vendor": "商人出售", "Drop": "怪物掉落",

  # Queue & Gathering
  "Queue All": "全部加入队列", "Clear Queue": "清空队列", "Craft Next": "制造下一个", "Craft All": "全部制造",
  "Restock": "自动补货", "Take from Mail": "从邮箱收取材料", "Send to Alts": "邮寄给小号",
  "No crafts in queue.": "制造队列中暂无任何配方。", "Pick a craft on the Profit tab and click Queue.": "在“制造利润”标签页中挑选配方并点击“加入队列”。",
  "Queue is empty.": "队列为空。", "GATHERING LIST": "材料清单", "Shopping List": "购物清单",
  "Buy at AH": "在拍卖行购买", "Have in Bags": "背包已有", "Have in Bank": "银行已有",
  "Need to Buy": "尚需购买", "Need to Craft": "尚需制造", "Need to Gather": "尚需采集",
  "No materials needed right now.": "当前制造队列不需要任何额外材料。",
  "All materials are already in your bags or bank.": "制造所需的所有材料已全部在您的背包或银行中备齐。"
}

TRANSLATIONS = dict(EXACT_DICT)

# Pattern replacements
def smart_translate(en_key, de_val):
    if en_key in TRANSLATIONS:
        return TRANSLATIONS[en_key]

    s = en_key

    # Direct templates
    rules = [
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
        (r'^Level\s+(\d+|%d)$', r'\1 级'),
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
        (r'^Item\s+(\d+|%d)$', r'物品 \1')
    ]

    for pat, rep in rules:
        if re.match(pat, s):
            return re.sub(pat, rep, s)

    compounds = [
        ("the auction house", "拍卖行"),
        ("The auction house", "拍卖行"),
        ("Auction house", "拍卖行"),
        ("Auction House", "拍卖行"),
        ("AUCTION HOUSE", "拍卖行"),
        ("Blackthornes Tradeskills", "Blackthornes 商业助手"),
        ("Blackthornes", "Blackthornes"),
        ("craft queue", "制造队列"),
        ("shopping list", "购物清单"),
        ("auction prices", "拍卖行物价"),
        ("crafting profits", "制造利润"),
        ("disenchanting", "附魔分解"),
        ("Disenchanting", "附魔分解"),
        ("disenchant", "分解"),
        ("Disenchant", "分解"),
        ("in your bags", "在你的背包中"),
        ("in the mailbox", "在邮箱中"),
        ("in the mail", "在邮件中"),
        ("at the auction house", "在拍卖行"),
        ("on the auction house", "在拍卖行"),
        ("from the auction house", "来自拍卖行"),
        ("to the auction house", "至拍卖行"),
        ("on your other characters", "在你其他角色上"),
        ("for your other characters", "为你其他角色"),
        ("on your other addons", "在其他插件中"),
        ("for your other addons", "为其他插件"),
        ("on the Profit tab", "在“制造利润”标签页"),
        ("on the Stats tab", "在“数据统计”标签页"),
        ("on the Queue tab", "在“制造队列”标签页"),
        ("on the Prices tab", "在“物价行情”标签页"),
        ("on the Sales tab", "在“销售记录”标签页"),
        ("on the Characters tab", "在“角色资产”标签页"),
        ("in Settings", "在插件设置中"),
        ("Nothing to show yet", "暂无内容"),
        ("Nothing matches", "没有匹配项"),
        ("Nothing found", "未找到内容"),
        ("No character matches", "没有匹配的角色"),
        ("No recipes read", "尚未读取配方"),
        ("No auction data", "暂无拍卖数据"),
        ("not scanned yet", "尚未扫描"),
        ("Not scanned yet", "尚未扫描"),
        ("never scanned", "从未扫描"),
        ("Never scanned", "从未扫描"),
        ("make a profit", "获取制造利润"),
        ("at today's prices", "按今日市价"),
        ("open the auction house", "打开拍卖行"),
        ("visit the auction house", "查阅拍卖行"),
        ("visit a mailbox", "查阅邮箱"),
        ("open a mailbox", "打开邮箱"),
        ("open a profession", "打开专业技能面板"),
        ("click to close", "点击关闭"),
        ("click to view", "点击查看"),
        ("click to sort", "点击排序")
    ]

    res = s
    for en_c, zh_c in compounds:
        res = res.replace(en_c, zh_c)

    word_subs = [
        (r'\bProfessions?\b', '专业技能'), (r'\bprofessions?\b', '专业技能'),
        (r'\bRecipes?\b', '配方'), (r'\brecipes?\b', '配方'),
        (r'\bMaterials?\b', '材料'), (r'\bmaterials?\b', '材料'),
        (r'\bReagents?\b', '材料'), (r'\breagents?\b', '材料'),
        (r'\bCharacters?\b', '角色'), (r'\bcharacters?\b', '角色'),
        (r'\bMailbox\b', '邮箱'), (r'\bmailbox\b', '邮箱'),
        (r'\bBank\b', '银行'), (r'\bbank\b', '银行'),
        (r'\bBags?\b', '背包'), (r'\bbags?\b', '背包'),
        (r'\bVendors?\b', '商人'), (r'\bvendors?\b', '商人'),
        (r'\bBuyout\b', '一口价'), (r'\bbuyout\b', '一口价'),
        (r'\bDeposit\b', '保管费'), (r'\bdeposit\b', '保管费'),
        (r'\bProfit\b', '利润'), (r'\bprofit\b', '利润'),
        (r'\bMargin\b', '利润率'), (r'\bmargin\b', '利润率'),
        (r'\bCosts?\b', '成本'), (r'\bcosts?\b', '成本'),
        (r'\bQueue\b', '制造队列'), (r'\bqueue\b', '制造队列'),
        (r'\bQueued\b', '已入队列'), (r'\bqueued\b', '已入队列'),
        (r'\bScanned\b', '已扫描'), (r'\bscanned\b', '已扫描'),
        (r'\bScanning\b', '正在扫描'), (r'\bscanning\b', '正在扫描'),
        (r'\bUndercut\b', '压价'), (r'\bundercut\b', '压价'),
        (r'\bOvercut\b', '抬价'), (r'\bovercut\b', '抬价'),
        (r'\bHistory\b', '历史记录'), (r'\bhistory\b', '历史记录'),
        (r'\bPrices?\b', '物价'), (r'\bprices?\b', '物价'),
        (r'\bSettings\b', '设置'), (r'\bsettings\b', '设置'),
        (r'\bFavourites\b', '收藏'), (r'\bfavourites\b', '收藏'),
        (r'\bAlts?\b', '小号'), (r'\balts?\b', '小号'),
        (r'\bUpgrades?\b', '提升装备'), (r'\bupgrades?\b', '提升装备')
    ]

    for pat, rep in word_subs:
        res = re.sub(pat, rep, res)

    glue = [
        (r'\bthe\s+([^\x00-\x7F])', r'\1'),
        (r'\ba\s+([^\x00-\x7F])', r'\1'),
        (r'\ban\s+([^\x00-\x7F])', r'\1'),
        (r'\bof\s+([^\x00-\x7F])', r'的\1'),
        (r'\bto\s+([^\x00-\x7F])', r'至\1'),
        (r'\bin\s+([^\x00-\x7F])', r'在\1'),
        (r'\bfor\s+([^\x00-\x7F])', r'为\1'),
        (r'\bwith\s+([^\x00-\x7F])', r'含\1'),
        (r'\byour\s+([^\x00-\x7F])', r'你的\1'),
        (r'\bthis\s+([^\x00-\x7F])', r'此\1'),
        (r'\bthat\s+([^\x00-\x7F])', r'该\1'),
        (r'\b([^\x00-\x7F])\s+is\b', r'\1为'),
        (r'\b([^\x00-\x7F])\s+has\b', r'\1拥有')
    ]

    for pat, rep in glue:
        res = re.sub(pat, rep, res)

    return res

result_lines = [
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
    de = item['de']
    if k in seen_keys:
        continue
    seen_keys.add(k)
    zh = smart_translate(k, de)
    result_lines.append(f'L[{json.dumps(k, ensure_ascii=False)}] = {json.dumps(zh, ensure_ascii=False)}')

final_lua = '\n'.join(result_lines) + '\n'

game_zh_path = 'C:/Program Files (x86)/World of Warcraft/_forever_/Interface/AddOns/Blackthornes_TS/Locale/zhCN.lua'
with open(game_zh_path, 'w', encoding='utf-8') as f:
    f.write(final_lua)
print(f"Written {len(seen_keys)} entries to {game_zh_path}")

repo_zh_path = 'scripts/locales/bt_zhCN.lua'
with open(repo_zh_path, 'w', encoding='utf-8') as f:
    f.write(final_lua)
print(f"Written to {repo_zh_path}")
