/**
 * Single-Button Fishing zhCN Localization Generator & Comprehensive Patcher
 */

export const SBF_HELP_ZH = {
  "set.warnNoPole": {
    title: "无鱼竿时警告",
    body: "当手中未装备鱼竿且未配置穿戴规则时，按钓鱼键不会甩竿，并提示将鱼竿拖入配置方案中的鱼竿栏。取消勾选可强制甩竿。"
  },
  "set.petStance": {
    title: "钓鱼时宠物姿态",
    body: "在钓鱼时保持宠物处于此姿态。若在脱战状态下按钓鱼键且宠物处于其它姿态，SBF 将自动切换。停止钓鱼不会恢复原姿态。选择“保持原样”则不干涉宠物。"
  },
  "set.petFight": {
    title: "宠物战斗时协同攻击",
    body: "当宠物进入战斗而你尚未进入战斗时，钓鱼键将自动触发战斗动作，而不是甩竿或拾取。需在战斗栏中设置技能。"
  },
  "set.petFightTarget": {
    title: "优先以宠物攻击目标为目标",
    body: "当按钓鱼键协助宠物战斗时，自动选中宠物正在攻击的目标。"
  },
  "set.combatReleasesLoot": {
    title: "进入战斗时优先反击而非拾取",
    body: "若在浮漂上钩拾取过程中被野怪攻击进入战斗，钓鱼键将立即切换为战斗动作，防止因拾取窗口卡死在战斗中。"
  },
  "set.guardFishingOff": {
    title: "Shift+点击 关闭钓鱼动作",
    body: "开启后，按住 Shift 并点击钓鱼键可临时停用钓鱼循环模式。"
  },
  "set.sitBeforeCast": {
    title: "每次甩竿前坐下",
    body: "在每次抛竿前让角色坐下，适合休闲钓鱼体验。"
  },
  "set.autoDismount": {
    title: "钓鱼时自动下坐骑",
    body: "在坐骑上按钓鱼键时，自动取消坐骑并开始钓鱼流程。"
  },
  "set.refreshSkillOnCast": {
    title: "甩竿时刷新钓鱼技能点数",
    body: "每次抛竿时重新读取并刷新角色当前的钓鱼技能等级与加成。"
  },
  "set.combatWindows": {
    title: "战斗中隐藏界面",
    body: "进入战斗后自动隐藏 SBF 界面和浮动指示器，脱战后自动恢复。"
  },
  "set.castBackoff": {
    title: "施法失败后退避间隔",
    body: "当抛竿失败（例如距离过近或卡模型）时，设置短暂的重试冷却时间，避免狂点按键刷屏报错。"
  },
  "set.zoneIndicator": {
    title: "区域增益发光提示",
    body: "当处于特殊钓鱼区域或拥有特殊钓鱼增益效果时，高亮显示状态指示器。"
  },
  "set.idleTimeout": {
    title: "闲置超时时间",
    body: "超过指定时间未按钓鱼键后，自动判定为停止钓鱼并还原装备。"
  },
  "set.mouseDouble": {
    title: "双击间隔时间 (秒)",
    body: "设置鼠标右键双击判定的时间窗口。"
  },
  "set.useMouse": {
    title: "启用鼠标双击钓鱼",
    body: "允许通过右键双击水面或空地来触发完整的单键钓鱼流程（抛竿/拾取）。"
  },
  "set.twoButton": {
    title: "双键模式",
    body: "将抛竿与交互拾取分离为两个独立的按键，适合习惯传统双键操作的玩家。"
  },
  "set.gamepadEnable": {
    title: "启用手柄控制器支持",
    body: "支持将钓鱼循环动作绑定到手柄按键。"
  },
  "set.fastLoot": {
    title: "极速极快拾取 (跳过拾取框瞬间全拿)",
    body: "起竿瞬间自动高速拾取鱼类与物品，无需等待拾取窗口打开与动画播放。"
  },
  "set.advancedMode": {
    title: "配置方案高级模式",
    body: "解锁多套独立配置方案、条件宏支持与精细化栏位调整。"
  },
  "set.autoSwap": {
    title: "根据区域自动切换方案",
    body: "进入特定水域或副本地图时，自动切换到对应预设的鱼竿与鱼饵方案。"
  },
  "set.warnUnsavedOnClose": {
    title: "关闭时提示未保存的更改",
    body: "在关闭设置面板时，若有未保存的槽位修改则弹窗确认。"
  },
  "set.swapFlash": {
    title: "切换方案时屏幕闪烁提醒",
    body: "当自动切换方案触发时在屏幕边缘给出视觉提示。"
  },
  "set.idleRestore": {
    title: "闲置时自动换回战斗装备",
    body: "停止钓鱼一段时间后，自动换回原先的主副手武器与头饰装备。"
  },
  "set.focusAudio": {
    title: "钓鱼专注音频 (放大起竿水花声)",
    body: "钓鱼时自动调大环境音效并放大鱼儿咬钩溅水声，即使切到后台也能清晰听见起竿时机！"
  }
};

export const SBF_OPTIONS_REPLACEMENTS = [
  // 8 Main Tabs across the top (Images 1-5)
  [
    `local tabDefs = {
    { key = "buttons",  label = "Profile" },
    { key = "behavior", label = "Settings" },
    { key = "keys",     label = "Keybinds" },
    { key = "skillbook", label = "Skill Book" },
    { key = "log",      label = "Log" },
    { key = "stats",    label = "Stats" },
    { key = "world",    label = "World" },   -- expansion/season content watches (Patiently Rewarded, ...)
    { key = "about",    label = "About" },
  }`,
    `local tabDefs = {
    { key = "buttons",  label = "配置方案" },
    { key = "behavior", label = "功能设置" },
    { key = "keys",     label = "按键绑定" },
    { key = "skillbook", label = "钓鱼技能" },
    { key = "log",      label = "钓鱼日志" },
    { key = "stats",    label = "钓鱼统计" },
    { key = "world",    label = "世界追踪" },   -- expansion/season content watches (Patiently Rewarded, ...)
    { key = "about",    label = "关于插件" },
  }`
  ],

  // Buttons in UI
  ['addBtn:SetText("New")', 'addBtn:SetText("新建")'],
  ['dupBtn:SetText("Duplicate")', 'dupBtn:SetText("复制")'],
  ['remBtn:SetText("Remove")', 'remBtn:SetText("删除")'],
  ['saveBtn:SetText("Save")', 'saveBtn:SetText("保存")'],
  ['revertBtn:SetText("Revert")', 'revertBtn:SetText("还原")'],
  ['indivChkText:SetText("Individual")', 'indivChkText:SetText("角色独立")'],
  ['defBtn:SetText("Set as default")', 'defBtn:SetText("设为默认")'],
  ['emBtn:SetText("Equipment Manager")', 'emBtn:SetText("装备管理器")'],
  ['unhideBtn:SetText("Restore all hidden")', 'unhideBtn:SetText("恢复所有隐藏物品")'],
  ['reset:SetText("Reset to default")', 'reset:SetText("恢复默认")'],
  ['doneBtn:SetText("Close")', 'doneBtn:SetText("关闭")'],
  ['bug:SetText("Report a bug")', 'bug:SetText("反馈问题")'],
  ['wbtn:SetText("Show welcome screen")', 'wbtn:SetText("显示欢迎引导")'],
  ['camSave = Theme.MakeButton(pBe, 150, "Save current camera"', 'camSave = Theme.MakeButton(pBe, 150, "保存当前视角"'],
  ['Theme.MakeButton(pBe, 130, "Audio settings\\226\\128\\166"', 'Theme.MakeButton(pBe, 130, "音频设置…"'],
  ['Theme.MakeButton(pBe, 130, "Reset window"', 'Theme.MakeButton(pBe, 130, "重置窗口位置"'],

  // Profile bar labels & Pole status
  ['plbl:SetText("Profile:")', 'plbl:SetText("方案:")'],
  ['nlbl:SetText("Name:")', 'nlbl:SetText("名称:")'],
  ['blbl:SetText("Bind here:")', 'blbl:SetText("绑定地点:")'],
  ['glbl:SetText("Gear set:")', 'glbl:SetText("配装方案:")'],
  ['plbl2:SetText("Fishing pole:")', 'plbl2:SetText("鱼竿栏位:")'],
  ['charLbl:SetText(Theme.Accent("Character"))', 'charLbl:SetText(Theme.Accent("角色"))'],
  ['sl:SetText("sort:")', 'sl:SetText("排序:")'],
  ['"|cff888888Skill: not loaded|r"', '"|cff888888钓鱼技能: 未加载|r"'],
  ['poleWarn:SetText("|cffff9933No pole set.|r Drag your pole here, or save it in this profile\'s gear set.")',
   'poleWarn:SetText("|cffff9933未设置鱼竿。|r 将鱼竿拖到此处，或保存在本配置方案的配装中。")'],
  ['GameTooltip:SetText("Fishing pole", accentRGB())', 'GameTooltip:SetText("鱼竿", accentRGB())'],

  // Keybindings Tab (Image 1)
  [
    `intro:SetText("Set a key or controller button for any SBF action. "\n      .. "(Controller: enable it in Settings, then press a pad button here.)")`,
    `intro:SetText("为任意 SBF 操作设置按键或手柄按钮。（手柄：请在功能设置中启用手柄支持，然后在此按下手柄按钮。）")`
  ],
  ['h:SetText(({ key1 = "Keyboard", mouse = "Mouse", ctrl = "Controller" })[key])',
   'h:SetText(({ key1 = "键盘", mouse = "鼠标", ctrl = "手柄" })[key])'],
  ['sectionAt("Main")', 'sectionAt("主要")'],
  ['sectionAt("Gear")', 'sectionAt("装备")'],
  ['sectionAt("Slots", true)', 'sectionAt("栏位", true)'],
  ['tableRow("fishing", "Action /Cast"', 'tableRow("fishing", "操作 / 抛竿"'],
  ['tableRow("interact", "Loot / Interact"', 'tableRow("interact", "拾取 / 交互"'],
  ['tableRow("equipGear", "Equip profile gear")', 'tableRow("equipGear", "换上钓鱼配装")'],
  ['tableRow("restoreGear", "Restore normal gear")', 'tableRow("restoreGear", "恢复常规装备")'],

  // Skill Book Tab (Image 2)
  ['Theme.SectionHeader(pSkill, 4, -8, "Fishing skill by expansion")',
   'Theme.SectionHeader(pSkill, 4, -8, "各资料片钓鱼技能等级")'],
  [
    `note:SetText(SBF.CLASSIC_GEAR and "Your Fishing level / max.\\n\\"-\\" means no Fishing skill yet."\n      or "Fishing level / max in each expansion.\\n\\"-\\" means no skill in that line yet.")`,
    `note:SetText(SBF.CLASSIC_GEAR and "当前角色的钓鱼技能等级 / 上限。\\n\\"-\\" 表示尚未学习钓鱼。"\n      or "各资料片的钓鱼技能等级 / 上限。\\n\\"-\\" 表示尚未学习该资料片的钓鱼。")`
  ],
  [
    `skillNote:SetText("Open your Fishing Journal once on this character to load your fishing skill "\n      .. "(a Blizzard requirement - your skill shows automatically after that), or check the box below "\n      .. "and we'll do it for you on your next cast.")`,
    `skillNote:SetText("请在此角色上打开一次专业技能或钓鱼日志以加载技能数据（暴雪客户端接口要求，之后技能点数将自动显示），或勾选下方选项在下次抛竿时自动刷新。")`
  ],
  ['"  |cff45c4a0(here)|r"', '"  |cff45c4a0(当前)|r"'],

  // Log Tab (Image 3)
  ['logHead:SetPoint("TOPLEFT", 4, -2); logHead:SetText(Theme.Accent("Fishing log"))',
   'logHead:SetPoint("TOPLEFT", 4, -2); logHead:SetText(Theme.Accent("钓鱼日志"))'],
  ['logCountLbl:SetText(#SBF.FishLog() .. " logged")',
   'logCountLbl:SetText(#SBF.FishLog() .. " 条记录")'],
  ['logMaxLbl:SetPoint("RIGHT", logMaxEb, "LEFT", -4, 0); logMaxLbl:SetText("show")',
   'logMaxLbl:SetPoint("RIGHT", logMaxEb, "LEFT", -4, 0); logMaxLbl:SetText("显示")'],
  [
    'local KIND_LABEL = { caught = "CAUGHT", expired = "EXPIRED", nothing = "NOTHING", missed = "MISSED", interrupt = "interrupt", castfail = "cast-fail", action = "ACTION", buff = "chest up", skill = "SKILL UP", chest = "CHEST", gathered = "gathered", unreachable = "out of reach",',
    'local KIND_LABEL = { caught = "已钓起", expired = "超时", nothing = "无鱼上钩", missed = "脱钩", interrupt = "打断", castfail = "抛竿失败", action = "动作", buff = "宝箱出现", skill = "技能提升", chest = "钓起宝箱", gathered = "采集", unreachable = "距离过远",'
  ],
  [
    `local nice = (rec.cause == "los" and "line of sight") or (rec.cause == "nowater" and "no fishable water")`,
    `local nice = (rec.cause == "los" and "视线受阻") or (rec.cause == "nowater" and "无有效水域") or (rec.cause == "shallow" and "水域过浅") or (rec.cause == "movement" and "移动打断")`
  ],
  ['showTip(self, "Lines to show", "How many of the most recent log lines to DISPLAY. The full log is always kept (never trimmed). Default 150.")',
   'showTip(self, "显示记录行数", "最多在界面中显示的最新钓鱼记录条数。完整日志始终完整保存，默认 150 条。")'],

  // Stats Tab (Image 4)
  ['btnAcquire(72, "All-time")', 'btnAcquire(72, "累计全部")'],
  ['btnAcquire(90, "This session")', 'btnAcquire(90, "本次会话")'],
  ['btnAcquire(64, "Today")', 'btnAcquire(64, "今日")'],
  [
    `{ tostring(totalFish), "fish" }, { tostring(casts), "casts" }, { avgCast, "avg cast" },`,
    `{ tostring(totalFish), "条鱼" }, { tostring(casts), "抛竿数" }, { avgCast, "平均耗时" },`
  ],
  [
    `{ catchRate, "catch rate" }, { timeFished, "time fished" }, { fishPerHour, "fish / hr" }`,
    `{ catchRate, "上钩率" }, { timeFished, "钓鱼时长" }, { fishPerHour, "每小时钓起" }`
  ],
  [
    `ol:SetText(("Out of reach: |cffe0b050%d|r of %d line-outs (%s)   recast: %d   |cff808080left out of casts, avg cast and catch rate|r")`,
    `ol:SetText(("超出距离: |cffe0b050%d|r / %d 次甩竿 (%s)   重新抛竿: %d   |cff808080不计入抛竿数与上钩率|r")`
  ],
  ['btnAcquire(72, "By fish")', 'btnAcquire(72, "按鱼种")'],
  ['btnAcquire(72, "By zone")', 'btnAcquire(72, "按区域")'],
  ['btnAcquire(52, "count")', 'btnAcquire(52, "数量")'],
  ['btnAcquire(52, "name")', 'btnAcquire(52, "名称")'],
  ['btnAcquire(52, "recent")', 'btnAcquire(52, "最新")'],
  ['btnAcquire(52, "quality")', 'btnAcquire(52, "品质")'],
  ['btnAcquire(150, "Reset all-time stats")', 'btnAcquire(150, "重置累计统计")'],
  ['"Refresh: Live"', '"刷新: 实时"'],

  // World Tab (Image 5)
  [
    `local intro = { section = "Watches",\n      { note = { text = "Expansion, season and zone watches. Each row can glow the screen edges in its own "\n          .. "color, announce on screen, and play a sound. Rows are grouped by the content they belong to.",\n          color = "textMuted" } },\n    }`,
    `local intro = { section = "世界追踪事件",\n      { note = { text = "资料片、赛季及特殊区域钓鱼事件追踪。触发时支持全屏光晕告警、屏幕公告以及音频提示。事件按所属资料片内容分组归类。",\n          color = "textMuted" } },\n    }`
  ],
  ['{ label = "Patiently Rewarded"', '{ label = "成就：沉着有报 (Patiently Rewarded)"'],
  ['Theme.MakeButton(pWo, 64, "Test"', 'Theme.MakeButton(pWo, 64, "测试"'],

  // Sections & Checkboxes on Settings page
  ['{ section = "Interface options"', '{ section = "操作界面设置"'],
  ['{ section = "Fishing behavior"', '{ section = "钓鱼行为设置"'],
  ['{ section = "Pet (this character)"', '{ section = "宠物协同 (当前角色)"'],
  ['"Two-button mode (separate cast & loot)"', '"双键模式 (抛竿与拾取分离)"'],
  ['"Enable controller (gamepad) support"', '"启用手柄控制器支持"'],
  ['"Use mouse (double-click)"', '"启用鼠标右键双击钓鱼"'],
  ['"Sit before each cast"', '"每次甩竿前坐下"'],
  ['"Warn when there\'s no fishing pole to fish with"', '"未装备鱼竿时发出警告提示"'],
  ['"Fight instead of looting when combat starts"', '"进入战斗时优先反击而非拾取"'],
  ['"Shift+click to turn off Cast Fishing"', '"Shift+点击 临时关闭钓鱼动作"'],
  ['"Auto-dismount to fish  (never while flying)"', '"钓鱼时自动下坐骑 (飞行中除外)"'],
  ['"Refresh skill on cast"', '"甩竿时刷新钓鱼技能点数"'],
  ['"Hide interface in combat"', '"进入战斗后自动隐藏界面"'],
  ['"Fight when my pet is fighting"', '"宠物战斗时自动协同反击"'],
  ['"Target what my pet is attacking first"', '"优先选中宠物正在攻击的目标"'],
  ['zgLabel = "Zone buff glow  (screen edges glow while a special fishing buff is on you)"', 'zgLabel = "特殊区域增益发光提示 (拥有特殊钓鱼Buff时光晕高亮)"'],

  // Labeled inputs
  ['{ note = { text = "click speed:", color = "text" } }', '{ note = { text = "双击判定:", color = "text" } }'],
  ['{ note = { text = "Cast-fail back-off"', '{ note = { text = "施法失败退避间隔"'],
  ['{ note = { text = "Idle timeout"', '{ note = { text = "闲置超时时间"'],
  ['{ note = { text = "(SBF stands down until your next cast)"', '{ note = { text = "(超时后 SBF 待机直至下次抛竿)"'],
  ['{ note = { text = "Pet stance while fishing"', '{ note = { text = "钓鱼时宠物姿态"'],

  // Sounds
  ['local SOUND_LABELS = { "Fishing start", "Cast fail", "No fish hooked", "Expired (ran full, no bite)", "Patiently Rewarded" }',
   'local SOUND_LABELS = { "开始钓鱼甩竿", "抛竿施法失败", "脱钩未钓到鱼", "超时未咬钩", "成就事件触发" }'],
  ['{ label = "Ready Check ding"', '{ label = "就位确认叮声"'],
  ['{ label = "Raid warning"', '{ label = "团队警告音"'],
  ['{ label = "Level up"', '{ label = "角色升级音"'],
  ['{ label = "Auction open"', '{ label = "打开拍卖行"'],
  ['{ label = "Map ping"', '{ label = "小地图点击"'],
  ['{ label = "Quest failed"', '{ label = "任务失败音"'],
  ['{ label = "Yay"', '{ label = "欢呼声 (Yay)"'],
  ['{ label = "Custom file (sounds/cast.ogg)"', '{ label = "自定义音频文件"'],
  ['rootMenu:CreateRadio("No sound"', 'rootMenu:CreateRadio("无提示音"'],
  ['rootMenu:CreateRadio("Leave alone"', 'rootMenu:CreateRadio("保持原样"'],
  ['rootMenu:CreateRadio("View "', 'rootMenu:CreateRadio("视角 "'],

  // Messages & Popups
  ['"Remove the profile \\"%s\\"? This can\'t be undone."', '"确定要删除方案“%s”吗？此操作无法撤销。"'],
  ['"You have unsaved changes. Switch profiles anyway?\\n(your unsaved edits will be discarded)"', '"你有未保存的更改。确定切换方案吗？\\n(未保存的修改将被放弃)"'],
  ['"Name your new profile:"', '"请输入新方案名称:"'],
  ['"Name the duplicate profile:"', '"请输入复制方案名称:"']
];

export const SBF_WIDGETS_REPLACEMENTS = [
  ['"Cast Fishing - default"', '"抛竿钓鱼 - 默认"'],
  ['"Combat - default"', '"战斗动作 - 默认"'],
  ['"Macro"', '"宏命令"'],
  ['"Drag an item, spell, macro, or toy here"', '"将物品、技能、宏或玩具拖拽至此处"'],
  ['"press a controller button..."', '"请按下手柄按键..."'],
  ['"press key or button..."', '"请按下键盘或鼠标按键..."'],
  ['"click a button..."', '"请点击鼠标按键..."'],
  ['return "Set key"', 'return "设置按键"'],
  ['or "Set key"', 'or "设置按键"'],
  ['return allowNone and "(none)" or "Set button"', 'return allowNone and "(无)" or "设置按键"'],
  ['or "Set button"', 'or "设置按键"'],
  ['local GEAR_LABEL = { equipGear = "Equip profile gear", restoreGear = "Restore normal gear" }',
   'local GEAR_LABEL = { equipGear = "换上钓鱼配装", restoreGear = "恢复常规装备" }'],
  ['slotId == "equipGear" and "Equip profile gear" or "Restore normal gear"',
   'slotId == "equipGear" and "换上钓鱼配装" or "恢复常规装备"'],
  ['{ check = { label = "Active"', '{ check = { label = "启用"']
];

export const SBF_WELCOME_REPLACEMENTS = [
  ['title = "Welcome to Single-Button Fishing"', 'title = "欢迎使用 Single-Button Fishing 一键钓鱼"'],
  ['"|cffe8c679The only fishing add-on that does it all.|r"', '"|cffe8c679唯一一个全功能一体化单键钓鱼插件。|r"'],
  [
    `local actions = "One key runs your whole fishing loop - cast, wait, loot, "\n    .. "|cffe8c679eat, drink, lures, bobbers, chum, buffs,|r "\n    .. "|cfff28c28fight, heal,|r "\n    .. "|cff7cb83aboat, dismount,|r "\n    .. "then recast - automatically."`,
    `local actions = "单个按键搞定所有钓鱼流程：抛竿、等待、拾取、"\n    .. "|cffe8c679进食、喝水、鱼饵、浮标、诱饵、增益、|r "\n    .. "|cfff28c28战斗、治疗、|r "\n    .. "|cff7cb83a乘船、下坐骑，|r "\n    .. "然后自动重新抛竿。"`
  ],
  ['header(body, PAD, y, W, "How do you want to fish?  |cffff8a4c(required)|r")',
   'header(body, PAD, y, W, "你想如何操作钓鱼？  |cffff8a4c(必选项)|r")'],
  ['para(body, PAD, y, W, "Pick your input, then set your fishing key below. The bind controls change to match, and setting your fishing key turns the matching mode on for you.", "textDim")',
   'para(body, PAD, y, W, "选择输入方式并在下方设置快捷键。绑定控件会随之调整，设置按键后将自动为您启用对应模式。", "textDim")'],
  ['makeSelBtn("keyboard",   "Keyboard",   PAD)', 'makeSelBtn("keyboard",   "键盘",   PAD)'],
  ['makeSelBtn("mouse",      "Mouse",      PAD + (SEL_W + SEL_GAP))', 'makeSelBtn("mouse",      "鼠标",      PAD + (SEL_W + SEL_GAP))'],
  ['makeSelBtn("controller", "Controller", PAD + 2 * (SEL_W + SEL_GAP))', 'makeSelBtn("controller", "手柄", PAD + 2 * (SEL_W + SEL_GAP))'],
  ['"Bind your fishing key"', '"绑定钓鱼按键"'],
  ['"Loot / interact key"', '"拾取 / 交互按键"'],
  ['"Fishing mouse button"', '"钓鱼鼠标按键"'],
  ['"Loot mouse button"', '"拾取鼠标按键"'],
  ['"Fishing controller button"', '"钓鱼手柄按钮"'],
  ['"Loot controller button"', '"拾取手柄按钮"'],
  ['"Use a separate " .. (kind == "mouse" and "button" or "key") .. " to loot"',
   '"使用独立" .. (kind == "mouse" and "鼠标键" or "按键") .. "拾取"'],
  ['"Two-button mode", "On: the fishing input only casts; a second input loots. Off: it does both."',
   '"双键模式", "开启：钓鱼键只负责抛竿，按第二个键拾取。关闭：单键同时完成抛竿与拾取。"'],
  ['header(body, PAD, y, W, "Combat  |cff9aa0aa(optional)|r")', 'header(body, PAD, y, W, "战斗动作  |cff9aa0aa(可选项)|r")'],
  [
    `para(body, PAD, y, W, SBF.CLASSIC_GEAR\n    and "Combat defaults to auto-attack (hunters also fire Auto Shot). Drag in your own macro for real abilities."\n    or "Combat defaults to WoW's Single-Button Assistant, cast at whatever you are already fighting. Drag in your own macro to override.", "textDim")`,
    `para(body, PAD, y, W, SBF.CLASSIC_GEAR\n    and "战斗默认使用自动攻击（猎人自动射击）。可拖入您自己的技能宏。"\n    or "战斗默认使用单键战斗助手。可拖入您自己的技能宏进行覆盖。", "textDim")`
  ],
  ['header(body, PAD, y, W, "Heal  |cff9aa0aa(optional)|r")', 'header(body, PAD, y, W, "治疗动作  |cff9aa0aa(可选项)|r")'],
  ['para(body, PAD, y, W, "No default - add your own heal macro/spell/item.", "textDim")',
   'para(body, PAD, y, W, "默认无 - 可在此拖入您自己的治疗宏/法术/物品。", "textDim")'],
  ['header(body, PAD, y, W, "A memo from Management")', 'header(body, PAD, y, W, "来自渔协的备忘录")'],
  [
    `"You're all set. The boring part's over, so get out there and slay some fish. Show the lake who's boss, "\n    .. "keep that bobber proud, and remember: a fish uncaught is a fish that got away with it. Tight lines, and "\n    .. "don't embarrass us out there.\\n\\n- Management"`,
    `"一切准备就绪！枯燥的配置已搞定，快去尽情享受钓鱼的乐趣吧！让水里的鱼儿见识见识谁才是老大！祝竿竿中大鱼，盆满钵满！\\n\\n- 渔协管理团队"`
  ],
  ['"Don\'t show this again"', '"不再显示此向导"'],
  ['"Stops this welcome from popping up at login. Reopen it any time with /sbf welcome."',
   '"登录时不再弹出此欢迎向导。随时可在聊天框输入 /sbf welcome 重新打开。"'],
  ['openBtn:SetText("Open Settings")', 'openBtn:SetText("打开完整设置")'],
  ['webBtn:SetText("Website")', 'webBtn:SetText("访问网站")'],
  ['startBtn:SetText("Start fishing")', 'startBtn:SetText("开始钓鱼")']
];

export const SBF_SLOTS_REPLACEMENTS = [
  ['label = "Oversized Bobber"', 'label = "超大浮标"'],
  ['label = "Bobber"', 'label = "浮标"'],
  ['label = "Lure (buff)"', 'label = "鱼饵 (增益)"'],
  ['label = "Pole Enchant"', 'label = "鱼竿附魔"'],
  ['label = "Food"', 'label = "食物"'],
  ['label = "Drink"', 'label = "饮料"'],
  ['label = "Chum (skill)"', 'label = "诱饵 (技能)"'],
  ['label = "Chum (perception)"', 'label = "诱饵 (感知)"'],
  ['label = "Boat"', 'label = "船只 / 木筏"'],
  ['label = "Buffs"', 'label = "通用增益"'],
  ['label = "Cast Fishing"', 'label = "施放钓鱼"'],
  ['label = "Interact / Loot"', 'label = "交互 / 拾取"'],
  ['label = "Combat (attack)"', 'label = "战斗 (攻击)"'],
  ['label = "Heal"', 'label = "治疗"']
];

export async function patchSBF(zip) {
  // 1. Create SBF/Locale/zhCN.lua (unconditionally loaded)
  const zhCNLua = `-- SBF 简体中文本地化
local ADDON, ns = ...

_G["BINDING_HEADER_SBF"] = "SBF - 单键钓鱼助手"
_G["BINDING_NAME_CLICK SBFBtn_fishing:LeftButton"] = "钓鱼动作 / 施法与交互"

local zhHelp = ${JSON.stringify(SBF_HELP_ZH, null, 2)}

if SBF and SBF.Help then
    for k, v in pairs(zhHelp) do
        if SBF.Help[k] then
            SBF.Help[k].title = v.title
            SBF.Help[k].body = v.body
        else
            SBF.Help[k] = v
        end
    end
end
`;
  zip.file('SBF/Locale/zhCN.lua', zhCNLua);

  // 2. Patch SBF/Welcome.lua
  const welFile = zip.file('SBF/Welcome.lua');
  if (welFile) {
    let welText = await welFile.async('string');
    for (const [target, repl] of SBF_WELCOME_REPLACEMENTS) {
      if (welText.includes(target)) {
        welText = welText.replaceAll(target, repl);
      }
    }
    zip.file('SBF/Welcome.lua', welText);
  }

  // 3. Patch SBF/Slots.lua
  const slotsFile = zip.file('SBF/Slots.lua');
  if (slotsFile) {
    let slotsText = await slotsFile.async('string');
    for (const [target, repl] of SBF_SLOTS_REPLACEMENTS) {
      if (slotsText.includes(target)) {
        slotsText = slotsText.replaceAll(target, repl);
      }
    }
    zip.file('SBF/Slots.lua', slotsText);
  }

  // 4. Patch SBF/Options.lua directly
  const optFile = zip.file('SBF/Options.lua');
  if (optFile) {
    let optText = await optFile.async('string');
    for (const [target, repl] of SBF_OPTIONS_REPLACEMENTS) {
      if (optText.includes(target)) {
        optText = optText.replaceAll(target, repl);
      }
    }
    zip.file('SBF/Options.lua', optText);
  }

  // 5. Patch SBF/OptionsWidgets.lua directly
  const widFile = zip.file('SBF/OptionsWidgets.lua');
  if (widFile) {
    let widText = await widFile.async('string');
    for (const [target, repl] of SBF_WIDGETS_REPLACEMENTS) {
      if (widText.includes(target)) {
        widText = widText.replaceAll(target, repl);
      }
    }
    zip.file('SBF/OptionsWidgets.lua', widText);
  }

  // 6. Patch Core.lua for Skill Book expansions and label
  const coreFile = zip.file('SBF/Core.lua');
  if (coreFile) {
    let coreText = await coreFile.async('string');
    coreText = coreText
      .replace(
        `SBF.SKILLBOOK_ORDER = {
  { "classic",      "Classic" },        { "outland",     "Outland" },
  { "northrend",    "Northrend" },      { "cataclysm",   "Cataclysm" },
  { "pandaria",     "Pandaria" },       { "draenor",     "Draenor" },
  { "legion",       "Legion" },         { "bfa",         "Battle for Azeroth" },
  { "shadowlands",  "Shadowlands" },    { "dragonflight","Dragonflight" },
  { "warwithin",    "The War Within" }, { "midnight",    "Midnight" },
}`,
        `SBF.SKILLBOOK_ORDER = {
  { "classic",      "经典旧世" },        { "outland",     "外域" },
  { "northrend",    "诺森德" },          { "cataclysm",   "大地的裂变" },
  { "pandaria",     "潘达利亚" },        { "draenor",     "德拉诺" },
  { "legion",       "军团再临" },        { "bfa",         "争霸艾泽拉斯" },
  { "shadowlands",  "暗影国度" },        { "dragonflight","巨龙时代" },
  { "warwithin",    "地心之战" },        { "midnight",    "至暗之夜" },
}`
      )
      .replace(
        `return { { label = "Fishing", line = line, level = l and l.level, max = l and l.max, has = l ~= nil, current = true } }`,
        `return { { label = "钓鱼技能", line = line, level = l and l.level, max = l and l.max, has = l ~= nil, current = true } }`
      );

    const injection = `
-- [zhCN Localization Inject]
_G["BINDING_HEADER_SBF"] = "SBF - 单键钓鱼助手"
_G["BINDING_NAME_CLICK SBFBtn_fishing:LeftButton"] = "钓鱼动作 / 抛竿与拾取"
`;
    zip.file('SBF/Core.lua', coreText + injection);
  }

  const tocFile = zip.file('SBF/SBF.toc');
  if (tocFile) {
    let tocText = await tocFile.async('string');
    if (!tocText.includes('Locale\\zhCN.lua')) {
      tocText = tocText
        .replace(/## Title: (.*)/, '## Title: $1\n## Title-zhCN: |cff00ff00[钓鱼]|r Single-Button Fishing (单键钓鱼)')
        .replace(/## Notes: (.*)/, '## Notes: $1\n## Notes-zhCN: 单键完成钓鱼循环（抛竿、浮漂交互、自动拾取、换装上饵），完美支持无限服与各经典版本。')
        .replace('Welcome.lua', 'Welcome.lua\nLocale\\zhCN.lua');
      zip.file('SBF/SBF.toc', tocText);
    }
  }
}
