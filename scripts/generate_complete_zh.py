import json
import re

with open('scripts/all_bt_keys.json', 'r', encoding='utf-8') as f:
    entries = json.load(f)

with open('scripts/generated_dict.json', 'r', encoding='utf-8') as f:
    exact = json.load(f)

# Comprehensive phrase & sentence translations
TRANSLATIONS = dict(exact)

# Massive manual & high-precision translations for Blackthornes UI & Logic
ADDITIONAL = {
  # Slash Commands & Help
  "module %s:%s failed": "模块 %s:%s 载入失败",
  "open or close the window": "打开或关闭主窗口",
  "  |c%s/bts help all|r shows more, including checks and developer tools.": "  |c%s/bts help all|r 查看更多命令（包含诊断与开发者工具）。",
  "show the main commands (/bts help all: every command)": "显示常用命令列表 (/bts help all 查看所有命令)",
  "what took longest this session, to find a hitch (/bts perf clear starts over)": "查看本会话耗时最长的操作以排查卡顿 (/bts perf clear 重置耗时统计)",
  "unknown command '%s'. Try |c%s/bts help|r.": "未知命令 '%s'。请输入 |c%s/bts help|r 获取帮助。",
  "/bts %s failed: %s": "/bts %s 执行失败: %s",
  "saved data is incomplete (part %d of %d missing); starting fresh.": "存档数据不完整（缺失第 %d/%d 部分），正在初始化全新数据。",
  "saved data could not be read; starting fresh.": "无法读取存档数据，正在初始化全新数据。",
  "empty the old CVar copy of your data (the game keeps it now)": "清空旧版 CVar 中的备份数据（游戏客户端已原生保存）",
  "nothing is saved to CVars any more; the game's own saved data keeps everything.": "不再向 CVar 写入数据；游戏客户端自带的 SavedVariables 已完整保存所有数据。",
  "measure how much a CVar can hold": "测量当前客户端单个 CVar 的最大字符容量",
  "test how much is kept when you quit: /bts cvarsoak [bytes] [parts]": "测试下线保存容量: /bts cvarsoak [字节数] [分片数]",
  "show every step of how your data is kept between sessions": "显示下线数据持久化保存的详细步骤流程",
  "type |c%s/bts|r to open the window, or |c%s/bts help|r for the commands.": "输入 |c%s/bts|r 打开主窗口，或输入 |c%s/bts help|r 查看命令帮助。",
  "Open each profession once and visit the auction house to fill in recipes and prices.": "请打开每个专业技能面板一次，并查阅一次拍卖行以收录配方与物价数据。",
  "YOUR SAVED DATA DID NOT LOAD. Prices, recipes, your queue and sales history are missing this session.": "【警告】未能成功加载存档数据！物价、已知配方、制造队列与销售记录在本次会话中暂不可用。",
  "This character remembers %d sessions of it; the game handed back %d.": "当前角色记录了 %d 次会话数据；游戏客户端返回了 %d 次。",
  "To get it back: quit the game now, without a /reload first. Then open your World of Warcraft game folder, then WTF, Account, your account name and SavedVariables, and copy Blackthornes_TS.lua.bak over Blackthornes_TS.lua. Then start the game.": "如需恢复数据：请立即完全退出游戏（切勿输入 /reload）。打开魔兽世界游戏目录下的 WTF/Account/你的账号名/SavedVariables 文件夹，将 Blackthornes_TS.lua.bak 复制并覆盖为 Blackthornes_TS.lua，然后重新启动游戏。",
  "Do this before you log out a second time: each save replaces the .bak with the newer, empty file.": "请在第二次下线退出前执行此操作：每次退出都会用新的空文件覆盖 .bak 备份！",
  "If you meant to start fresh, type /bts db fresh and this warning stops.": "如果您本就打算重新开始，请输入 /bts db fresh，此警告将不再弹出。",
  "Blackthornes Tradeskills: your saved data did not load. See chat.": "Blackthornes 商业助手：存档数据加载失败，详情请见聊天窗口。",
  "the game loaded your saved data late, after login instead of at load. Please report this, then run /bts persist.": "游戏客户端在登录后延迟加载了存档数据。请在命令行运行 /bts persist 进行保存。",
  "your saved data is from a newer version of the addon (format %d, this version reads %d), so it's being left alone": "存档数据来自更高版本的插件（格式版本 %d，当前版本读取 %d），因此未做任何改动。",
  "show what saved data loaded (/bts db fresh: stop the missing data warning)": "查看已加载的存档数据 (/bts db fresh 停止数据缺失警告)",
  "starting fresh, so the missing saved data warning won't show again.": "已初始化全新数据，数据缺失警告将不再显示。",
  "show what the game says this character is called": "显示游戏客户端认定的当前角色全名",
  "turn extra chat detail on or off": "开启或关闭聊天框调试详情输出",
  "extra chat detail on": "调试详情输出已开启",
  "extra chat detail off": "调试详情输出已关闭",

  # Tooltips & Item Infos
  "which gear is an upgrade for you, and where to get it": "哪些装备对你有提升，以及获取途径",
  "feeding and taming for hunter and warlock pets": "猎人与术士宠物的喂养与驯服指南",
  "and": "与",
  "works with other Blackthornes addons you don't have yet: %s. %s on CurseForge.": "可与您尚未安装的其它 Blackthornes 系列插件联动：%s。可在 CurseForge 搜索下载。",
  "It's": "它是",
  "They're": "它们是",
  "This note shows once.": "此提示仅显示一次。",
  "turn the once-only note about the other Blackthornes addons on or off": "开启或关闭关于其它 Blackthornes 插件的单次提示说明",
  "the note about the other Blackthornes addons is on. It shows once for any you don't have.": "已开启其它 Blackthornes 插件提示（仅在您未安装时显示一次）。",
  "the note about the other Blackthornes addons is off, in all of them.": "已关闭所有插件中关于其它 Blackthornes 插件的提示。",

  # Drawer & Post Panel
  "Reading your auctions...": "正在读取您的拍卖品列表...",
  "Your auctions": "您的拍卖品",
  "You have no auctions up.": "您当前没有任何在售的拍卖品。",
  "Cancel next": "取消下一个",
  "Cancels the auction undercut the most. It comes back in the mail.": "优先取消被压价幅度最大的拍卖。物品将通过邮件退回。",
  "One cancel per click. Items come back in the mail.": "每次点击取消一件拍卖品。物品将通过邮件退回。",
  "Posted just under the big stack. The cheaper ones should sell first.": "已挂在主力大堆货物下方。低价散货有望率先售罄。",
  "No recent scan. Scan to see if you were undercut.": "近期未扫描。请扫描拍卖行以检查是否被他人压价。",
  "UNDERCUT": "已被压价",
  "nobody under you": "无人压价 (处于最低价)",
  "NOT SCANNED LATELY": "近期未扫描",
  "scan to check": "扫描以检查",
  "ON YOUR OTHER CHARACTERS": "在您同账号其他角色上",
  "as last seen": "最后记录状态",
  "Cancel this auction": "取消此拍卖",
  "It comes back to you in the mail.": "物品将通过游戏内邮件退还给您。",
  "Listing it again costs more than you'd gain.": "重新上架的花费可能超出所获收益。",
  "that item": "该物品",
  "Your price each": "你的单件标价",
  "Cheapest not yours": "他人最低标价",
  "Under you by": "比你低出",
  "Ends in": "剩余时间",
  "only yours listed": "仅有你的拍卖在售",
  "Log in to cancel": "登录该角色以取消",
  "Cheapest": "最低价",
  "Overcut": "抬价",
  "Unknown": "未知",
  "ends in %s": "剩余时间 %s",
  "cheapest %s": "最低价 %s",
  "%d @ %s": "%d 个 @ %s",

  # UI Controls
  "Search AH": "在拍卖行搜索",
  "Search the auction house for this item": "在拍卖行搜索该物品",
  "Tick Favourites only to hide everything you haven't starred.": "勾选“仅显示收藏”可隐藏未加星标的其它物品。",
  "Deep scan": "深度全量扫描",
  "Looks up every listing of this item.": "针对该物品检索查询全部在售列表。",
  "Select an item to see its price history": "选择一件物品以查看其价格历史走势。",
  "none listed": "当前无在售挂牌",
  "not enough history": "历史样本数据不足",
  "The auction house must be open": "拍卖行窗口必须已打开",
  "No favourites yet. Click the star beside an item to keep it here.": "暂无收藏物品。点击物品旁的星标图标即可在此置顶收录。",
  "No prices of your own yet. Pick an item and type one under My price.": "暂无自设物价。选择一件物品并在“自设价格”框中输入价格。",
  "No auction data yet. Open the auction house and press Scan.": "暂无拍卖数据。请打开拍卖行窗口并点击“扫描拍卖行”。",
  "Nothing matches these filters.": "没有符合当前筛选条件的物品。",

  # Queue & Mail & Butler
  "Queue": "加入队列",
  "Queue All": "全部加入队列",
  "Clear Queue": "清空队列",
  "Craft Next": "制造下一个",
  "Craft All": "全部制造",
  "Restock": "自动补货",
  "Take from Mail": "从邮箱收取材料",
  "Send to Alts": "邮寄给小号",
  "No crafts in queue.": "制造队列中暂无任何配方。",
  "Pick a craft on the Profit tab and click Queue.": "在“制造利润”标签页中挑选配方并点击“加入队列”。",
  "Queue is empty.": "队列为空。",
  "GATHERING LIST": "材料采购/采集清单",
  "Shopping List": "购物清单",
  "Buy at AH": "在拍卖行购买",
  "Have in Bags": "背包已有",
  "Have in Bank": "银行已有",
  "Need to Buy": "尚需购买",
  "Need to Craft": "尚需制造",
  "Need to Gather": "尚需采集",
  "No materials needed right now.": "当前制造队列不需要任何额外材料。",
  "All materials are already in your bags or bank.": "制造所需的所有材料已全部在您的背包或银行中备齐。"
}

TRANSLATIONS.update(ADDITIONAL)

# Pattern replacements for templates
def smart_translate(en_key, de_val):
    if en_key in TRANSLATIONS:
        return TRANSLATIONS[en_key]

    s = en_key

    # Common exact prefixes / phrases
    rules = [
        # %d item(s) ...
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

    # Replace common compound clauses first
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

    # Word-level replacement for isolated words
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

    # Clean up dangling English glue words around Chinese
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

# Generate all entries
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
    result_lines.append(f'L[{json.dumps(k)}] = {json.dumps(zh)}')

final_lua = '\n'.join(result_lines) + '\n'

# Write to game directory
game_zh_path = 'C:/Program Files (x86)/World of Warcraft/_forever_/Interface/AddOns/Blackthornes_TS/Locale/zhCN.lua'
with open(game_zh_path, 'w', encoding='utf-8') as f:
    f.write(final_lua)
print(f"Written {len(seen_keys)} entries to {game_zh_path}")

# Write to script repository for bundling
repo_zh_path = 'scripts/locales/bt_zhCN.lua'
with open(repo_zh_path, 'w', encoding='utf-8') as f:
    f.write(final_lua)
print(f"Written to {repo_zh_path}")
