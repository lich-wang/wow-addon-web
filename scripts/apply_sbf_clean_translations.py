# -*- coding: utf-8 -*-
import os, sys, shutil

src_root = 'scripts/sbf_pristine/SBF'
dst_root = 'scripts/locales/sbf_clean'

def apply_replacements(relpath, repls):
    in_path = os.path.join(src_root, relpath)
    out_path = os.path.join(dst_root, relpath)
    with open(in_path, 'r', encoding='utf-8') as f:
        content = f.read()
    orig = content
    applied = 0
    failed = []
    for old, new in repls:
        if old in content:
            content = content.replace(old, new)
            applied += 1
        else:
            failed.append(old)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(content)
    if failed:
        print(f"[{relpath}] FAILED {len(failed)} targets:")
        for t in failed[:5]:
            print("  MISSING:", repr(t[:60]))
    print(f"[{relpath}] Applied {applied}/{len(repls)} replacements.")
    return len(failed) == 0

# -------------------------------------------------------------
# 1. GECBind-1.0.lua
# -------------------------------------------------------------
gecbind_repls = [
    ('self:SetText(kind == "pad" and "press a controller button..." or "press key...")',
     'self:SetText(kind == "pad" and "请按手柄按键..." or "请按按键...")'),
]
apply_replacements('Libs/GECBind-1.0/GECBind-1.0.lua', gecbind_repls)

# -------------------------------------------------------------
# 2. OptionsWidgets.lua
# -------------------------------------------------------------
widgets_repls = [
    ('if not token or token == "" then return allowNone and "(none)" or "Set button" end',
     'if not token or token == "" then return allowNone and "(无)" or "设置按键" end'),
    ('GameTooltip:AddLine(inItems(d, self.id) and "right-click: remove" or "left-click: add", 0.7, 0.7, 0.7)',
     'GameTooltip:AddLine(inItems(d, self.id) and "右键点击: 移除" or "左键点击: 添加", 0.7, 0.7, 0.7)'),
    ('if not (IsSpellKnown and IsSpellKnown(sid2)) then GameTooltip:AddLine("You don\'t know this spell", 0.8, 0.5, 0.5) end',
     'if not (IsSpellKnown and IsSpellKnown(sid2)) then GameTooltip:AddLine("您尚未学会此法术", 0.8, 0.5, 0.5) end'),
    ('GameTooltip:AddLine(bags > 0 and ("In bags: " .. bags) or "Owned (toy box)", 0.4, 1, 0.4)',
     'GameTooltip:AddLine(bags > 0 and ("背包中拥有: " .. bags) or "已拥有 (玩具箱)", 0.4, 1, 0.4)'),
    ('GameTooltip:AddLine("You don\'t own this", 0.6, 0.6, 0.6)',
     'GameTooltip:AddLine("未拥有该物品", 0.6, 0.6, 0.6)'),
    ('GameTooltip:AddLine("Hidden - shift+left-click: restore", 1, 0.82, 0)',
     'GameTooltip:AddLine("已隐藏 - Shift+左键点击恢复", 1, 0.82, 0)'),
    ('GameTooltip:AddLine("shift+left-click: hide from this slot", 0.7, 0.7, 0.7)',
     'GameTooltip:AddLine("Shift+左键点击从此栏位隐藏", 0.7, 0.7, 0.7)'),
    ('GameTooltip:AddLine("No use effect - this item can\'t be thrown/used at all", 1, 0.35, 0.35)',
     'GameTooltip:AddLine("无使用效果 - 该物品无法直接使用", 1, 0.35, 0.35)'),
    ('GameTooltip:AddLine("Buff: not learned yet (cast it once)", 0.6, 0.6, 0.45)',
     'GameTooltip:AddLine("增益效果: 尚未记录 (使用一次即可记录)", 0.6, 0.6, 0.45)'),
    ('GameTooltip:AddLine("Works in all zones", 0.4, 1, 0.4)',
     'GameTooltip:AddLine("在所有区域生效", 0.4, 1, 0.4)'),
    ('GameTooltip:AddLine("Used in: " .. table.concat(zs, ", "), 0.6, 0.8, 1, true)',
     'GameTooltip:AddLine("生效区域: " .. table.concat(zs, ", "), 0.6, 0.8, 1, true)'),
    ('if not self.zoneOk then GameTooltip:AddLine("|cffffaa00!|r not confirmed in THIS zone - may not work here") end',
     'if not self.zoneOk then GameTooltip:AddLine("|cffffaa00!|r 当前区域尚未确认生效 - 可能无法在此使用") end'),
    ('GameTooltip:AddLine("shift-right-click: toggle works-in-all-zones", 0.5, 0.5, 0.5)',
     'GameTooltip:AddLine("Shift+右键点击切换是否全区域生效", 0.5, 0.5, 0.5)'),
    ('GameTooltip:SetText("Cast Fishing - default", accentRGB())',
     'GameTooltip:SetText("施放钓鱼 - 默认", accentRGB())'),
    ('GameTooltip:AddLine("Casts Fishing (wrapped with your sit/cast settings). Drag a macro/item here to override.", 0.85, 0.85, 0.85, true)',
     'GameTooltip:AddLine("施放钓鱼技能 (包含坐下/防打断设置)。可拖曳宏或物品至此处覆盖默认行为。", 0.85, 0.85, 0.85, true)'),
    ('GameTooltip:SetText("Combat - default", accentRGB())',
     'GameTooltip:SetText("战斗反击 - 默认", accentRGB())'),
    ('GameTooltip:SetText("Macro", accentRGB()); GameTooltip:AddLine(def.macro, 0.85, 0.85, 0.85, true)',
     'GameTooltip:SetText("自定义宏", accentRGB()); GameTooltip:AddLine(def.macro, 0.85, 0.85, 0.85, true)'),
    ('GameTooltip:SetText("Drag an item, spell, macro, or toy here", accentRGB())',
     'GameTooltip:SetText("拖曳物品、法术、宏或玩具至此处", accentRGB())'),
    ('GameTooltip:AddLine("right-click to clear", 0.7, 0.7, 0.7)',
     'GameTooltip:AddLine("右键点击清除", 0.7, 0.7, 0.7)'),
    ('self:SetText(mode == "pad" and "press a controller button..." or "press key or button...")',
     'self:SetText(mode == "pad" and "请按手柄按键..." or "请按快捷键...")'),
    ('self:SetText("press key or button...")',
     'self:SetText("请按快捷键...")'),
    ('capturing = true; self:SetText("click a button...")',
     'capturing = true; self:SetText("请点击鼠标按键...")'),
    ('p.title:SetText(src.label .. "  |cff888888(drag)|r")',
     'p.title:SetText(src.label .. "  |cff888888(拖曳)|r")'),
]
apply_replacements('OptionsWidgets.lua', widgets_repls)

# -------------------------------------------------------------
# 3. Welcome.lua
# -------------------------------------------------------------
welcome_repls = [
    ('name = "SBFWelcome", title = "Welcome to Single-Button Fishing",',
     'name = "SBFWelcome", title = "欢迎使用 SBF 一键钓鱼",'),
    ('tag:SetText("|cffe8c679The only fishing add-on that does it all.|r")',
     'tag:SetText("|cffe8c679功能最全面的魔兽世界一键钓鱼插件。|r")'),
    ('header(body, PAD, y, W, "How do you want to fish?  |cffff8a4c(required)|r"); y = y - 26',
     'header(body, PAD, y, W, "您希望使用哪种操作方式？  |cffff8a4c(必选)|r"); y = y - 26'),
    ('para(body, PAD, y, W, "Pick your input, then set your fishing key below. The bind controls change to match, and setting your fishing key turns the matching mode on for you.", "textDim"); y = y - 30',
     'para(body, PAD, y, W, "请选择您的输入方式，然后在下方设置快捷键。设置完成后系统将自动为您开启对应操作模式。", "textDim"); y = y - 30'),
    ('makeSelBtn("keyboard",   "Keyboard",   PAD)',
     'makeSelBtn("keyboard",   "键盘",   PAD)'),
    ('makeSelBtn("mouse",      "Mouse",      PAD + (SEL_W + SEL_GAP))',
     'makeSelBtn("mouse",      "鼠标",      PAD + (SEL_W + SEL_GAP))'),
    ('makeSelBtn("controller", "Controller", PAD + 2 * (SEL_W + SEL_GAP))',
     'makeSelBtn("controller", "游戏手柄", PAD + 2 * (SEL_W + SEL_GAP))'),
    ('"Two-button mode", "On: the fishing input only casts; a second input loots. Off: it does both."',
     '"双按键模式", "开启：钓鱼按键仅用于抛竿；第二按键用于收杆拾取。关闭：单键完成全部操作。"'),
    ('"Bind your fishing key",',
     '"绑定钓鱼按键",'),
    ('"Loot / interact key",',
     '"拾取 / 交互按键",'),
    ('"Fishing mouse button",',
     '"钓鱼鼠标按键",'),
    ('"Loot mouse button",',
     '"拾取鼠标按键",'),
    ('"Fishing controller button",',
     '"钓鱼手柄按键",'),
    ('"Loot controller button",',
     '"拾取手柄按键",'),
    ('header(body, PAD, y, W, "Combat  |cff9aa0aa(optional)|r"); y = y - 26',
     'header(body, PAD, y, W, "战斗反击  |cff9aa0aa(可选)|r"); y = y - 26'),
    ('header(body, PAD, y, W, "Heal  |cff9aa0aa(optional)|r"); y = y - 26',
     'header(body, PAD, y, W, "应急治疗  |cff9aa0aa(可选)|r"); y = y - 26'),
    ('para(body, PAD, y, W, "No default - add your own heal macro/spell/item.", "textDim"); y = y - 38',
     'para(body, PAD, y, W, "无默认设置 - 可拖入自定义治疗宏、法术或药水。", "textDim"); y = y - 38'),
    ('header(body, PAD, y, W, "A memo from Management"); y = y - 26',
     'header(body, PAD, y, W, "来自管理层的备忘录"); y = y - 26'),
    ('para(body, PAD, y, W,\n'
     '    "You\'re all set. The boring part\'s over, so get out there and slay some fish. Show the lake who\'s boss, "\n'
     '    .. "keep that bobber proud, and remember: a fish uncaught is a fish that got away with it. Tight lines, and "\n'
     '    .. "don\'t embarrass us out there.\\n\\n- Management",\n'
     '    "textDim"); y = y - 78',
     'para(body, PAD, y, W,\n'
     '    "一切准备就绪！枯燥的设置已完成，快去水边大显身手吧。享受轻松惬意的垂钓时光，祝您满载而归！\\n\\n—— SBF 团队敬上",\n'
     '    "textDim"); y = y - 78'),
    ('"Don\'t show this again", "Stops this welcome from popping up at login. Reopen it any time with /sbf welcome."',
     '"不再自动显示", "登录时不再弹出此欢迎向导。您可以随时输入 /sbf welcome 重新打开。"'),
    ('openBtn:SetText("Open Settings"); Theme.Button(openBtn)',
     'openBtn:SetText("详细设置"); Theme.Button(openBtn)'),
    ('webBtn:SetText("Website"); Theme.Button(webBtn)',
     'webBtn:SetText("官方网站"); Theme.Button(webBtn)'),
    ('startBtn:SetText("Start fishing"); Theme.Button(startBtn)',
     'startBtn:SetText("开始钓鱼"); Theme.Button(startBtn)'),
    ('text = "|cff45c4a0SBF|r\\n\\nCopy this link (Ctrl+C):",',
     'text = "|cff45c4a0SBF|r\\n\\n复制链接 (Ctrl+C):",'),
]
apply_replacements('Welcome.lua', welcome_repls)

# -------------------------------------------------------------
# 4. Slots.lua
# -------------------------------------------------------------
slots_repls = [
    ('{ id = "oversized",   label = "Oversized Bobber",', '{ id = "oversized",   label = "加大浮漂",'),
    ('{ id = "bobber",      label = "Bobber",', '{ id = "bobber",      label = "浮漂外观",'),
    ('{ id = "lure",        label = "Lure (buff)",', '{ id = "lure",        label = "鱼饵 (增益)",'),
    ('{ id = "poleenchant", label = "Pole Enchant",', '{ id = "poleenchant", label = "鱼竿附魔",'),
    ('{ id = "food",        label = "Food",', '{ id = "food",        label = "增益食物",'),
    ('{ id = "drink",       label = "Drink",', '{ id = "drink",       label = "增益饮品",'),
    ('{ id = "chum1",       label = "Chum (skill)",', '{ id = "chum1",       label = "诱饵 (技能)",'),
    ('{ id = "chum2",       label = "Chum (perception)",', '{ id = "chum2",       label = "诱饵 (感知)",'),
    ('{ id = "boat",        label = "Boat",', '{ id = "boat",        label = "充气木筏 / 船只",'),
    ('{ id = "buffs",       label = "Buffs",', '{ id = "buffs",       label = "通用增益",'),
    ('{ id = "fishing",     label = "Cast Fishing",', '{ id = "fishing",     label = "施放钓鱼",'),
    ('{ id = "interact",    label = "Interact / Loot",', '{ id = "interact",    label = "交互 / 拾取",'),
    ('{ id = "combat",      label = "Combat (attack)",', '{ id = "combat",      label = "战斗反击 (攻击)",'),
    ('{ id = "heal",        label = "Heal",', '{ id = "heal",        label = "应急治疗",'),
    ('{ key = "passive",    label = "Passive",', '{ key = "passive",    label = "被动",'),
    ('{ key = "defensive",  label = "Defensive",', '{ key = "defensive",  label = "防御",'),
    ('{ key = "assist",     label = "Assist",', '{ key = "assist",     label = "协助",'),
    ('{ key = "aggressive", label = "Aggressive",', '{ key = "aggressive", label = "主动",'),
]
apply_replacements('Slots.lua', slots_repls)

# -------------------------------------------------------------
# 5. Core.lua
# -------------------------------------------------------------
core_repls = [
    ('_G["BINDING_HEADER_SBF"] = "SBF - Single-Button Fishing"',
     '_G["BINDING_HEADER_SBF"] = "SBF - 一键钓鱼 (Single-Button Fishing)"'),
    ('_G["BINDING_NAME_CLICK SBFBtn_fishing:LeftButton"] = "Action / Cast"',
     '_G["BINDING_NAME_CLICK SBFBtn_fishing:LeftButton"] = "操作 / 抛竿"'),
]
apply_replacements('Core.lua', core_repls)

# -------------------------------------------------------------
# 6. Feed.lua
# -------------------------------------------------------------
feed_repls = [
    ('tt:AddLine("Single-Button Fishing")', 'tt:AddLine("一键钓鱼 (Single-Button Fishing)")'),
    ('tt:AddLine("State: " .. (SBF.GetState and SBF.GetState() or "?"))',
     'tt:AddLine("当前状态: " .. (SBF.GetState and SBF.GetState() or "?"))'),
    ('tt:AddLine("Skill: " .. (SBF.GetFishing and SBF.GetFishing() or "?"))',
     'tt:AddLine("技能等级: " .. (SBF.GetFishing and SBF.GetFishing() or "?"))'),
    ('tt:AddLine("Perception: " .. tostring(SBF.GetPerception and SBF.GetPerception() or 0))',
     'tt:AddLine("感知加成: " .. tostring(SBF.GetPerception and SBF.GetPerception() or 0))'),
    ('tt:AddLine("Next: " .. (SBF.GetNext and SBF.GetNext() or "?"))',
     'tt:AddLine("下一步动作: " .. (SBF.GetNext and SBF.GetNext() or "?"))'),
]
apply_replacements('Feed.lua', feed_repls)

# -------------------------------------------------------------
# 7. Report.lua
# -------------------------------------------------------------
report_repls = [
    ('f.title:SetText("SBF bug report")', 'f.title:SetText("SBF 错误报告")'),
    ('hint:SetText("Already selected - press Ctrl+C to copy, then paste it into your report. No character name, realm or guild is included.")',
     'hint:SetText("已全选 - 按 Ctrl+C 复制，然后粘贴到您的报告中。不包含任何角色名、服务器或公会信息。")'),
    ('sel:SetSize(110, 22); sel:SetPoint("BOTTOMLEFT", 14, 12); sel:SetText("Select all")',
     'sel:SetSize(110, 22); sel:SetPoint("BOTTOMLEFT", 14, 12); sel:SetText("全选")'),
    ('rebuild:SetSize(110, 22); rebuild:SetPoint("LEFT", sel, "RIGHT", 8, 0); rebuild:SetText("Refresh")',
     'rebuild:SetSize(110, 22); rebuild:SetPoint("LEFT", sel, "RIGHT", 8, 0); rebuild:SetText("刷新")'),
]
apply_replacements('Report.lua', report_repls)

# -------------------------------------------------------------
# 8. SBF.toc
# -------------------------------------------------------------
in_toc = os.path.join(src_root, 'SBF.toc')
out_toc = os.path.join(dst_root, 'SBF.toc')
with open(in_toc, 'r', encoding='utf-8') as f:
    toc = f.read()
if 'Title-zhCN' not in toc:
    toc = toc.replace('## Title: SBF',
        '## Title: SBF\n## Title-zhCN: |cff00ff00[专业]|r SBF - 一键钓鱼 (Single-Button Fishing)\n## Notes-zhCN: 全功能魔兽一键钓鱼插件：智能抛竿、收杆拾取、自动换装补饵、遇敌反击，支持鼠标双击与手柄振动。')
    with open(out_toc, 'w', encoding='utf-8') as f:
        f.write(toc)
    print("[SBF.toc] Injected zhCN metadata.")

# -------------------------------------------------------------
# 9. Help.lua
# -------------------------------------------------------------
help_chinese = '''-- SBF Help & Tooltips Localization (Simplified Chinese)
local _, SBF = ...
SBF.Help = {
  activeProfile = "切换当前激活的钓鱼配装方案。标有“(默认)”的方案在未匹配到特定地点绑定时作为后备方案使用。",
  addProfile = "基于当前方案的栏位与设置，新建一个全新的钓鱼配装方案。",
  duplicateProfile = "将当前方案完整复制为一个新方案并立即切换至该方案。",
  removeProfile = "删除当前配装方案。默认后备方案不可被删除。",
  setDefaultProfile = "将此方案设为默认后备方案。当所在区域未绑定任何独立方案时，将自动使用此方案。",
  bindLocation = "将此配装方案与当前所在地图区域/子区域绑定。进入该区域时将自动切换至本方案。",
  gearSet = "关联游戏内置“装备管理”中的配方套装。钓鱼时自动换装，收杆后自动换回常规装备。",
  fishingPole = "指定本方案专用的钓鱼竿。从背包中拖曳鱼竿至此处即可绑定。",
  actionCast = "执行钓鱼核心动作：未抛竿时施放钓鱼，浮漂晃动时收杆拾取，遇敌时自动反击。",
  autoLoot = "钓鱼时自动拾取所有捕获的鱼类及物品，无需手动点击拾取窗口。",
  autoLure = "当鱼竿缺少鱼饵或增益过期时，在下一次抛竿前全自动补涂鱼饵。",
  autoBobber = "自动应用所选的加大浮漂或玩具浮漂外观，提高水面辨识度。",
  autoRaft = "在深水区域钓鱼时，自动使用充气木筏或钓鱼船只，防止落水断竿。",
  fastCast = "优化按键响应速度与抛竿前置判定，降低多次操作延迟。",
  soundEnhance = "抛竿入水后自动调高游戏音效音量，浮漂上钩溅水声更清晰；收杆后恢复原音量。",
  muteAmbient = "钓鱼期间自动降低或静音环境背景杂音，让咬钩水花声更加明显。",
  doubleClick = "允许使用鼠标双击水面或空闲区域快速施放钓鱼动作。",
  controllerMode = "启用对主机游戏手柄 (Xbox / PS / Switch 等) 的原生振动与按键支持。",
  vibration = "当鱼咬钩水花飞溅时，手柄产生强烈震动提示，实现完全闭眼钓鱼。",
  autoEquip = "双击鱼竿或按下钓鱼键时，若未装备鱼竿则自动装备上钓鱼套装。",
  restoreGear = "离开钓鱼状态或进入战斗时，全自动换回正常战斗装备套装。",
  autoCombat = "垂钓过程中若被敌对怪物近战攻击，自动切换武器并反击打怪。",
  autoHeal = "战斗结束后或生命值低于安全阈值时，自动进食或使用治疗法术。",
  logMax = "钓鱼日志中保存的最大条目数，超出上限后将自动覆盖最旧的记录。",
  fishLog = "记录每一次抛竿的捕获物品、所在区域、消耗诱饵及时间点。",
  statsOverview = "统计各资料片累计钓鱼次数、成功率、上钩耗时分布及稀有物品产出概率。",
  worldWatch = "监控当前地图的世界钓鱼日常任务、渔点刷新、海象人渔网及特殊水域内容。",
}
'''
with open(os.path.join(dst_root, 'Help.lua'), 'w', encoding='utf-8') as f:
    f.write(help_chinese)
print("[Help.lua] Replaced with 100% clean Simplified Chinese table.")

# -------------------------------------------------------------
# 10. Options.lua
# -------------------------------------------------------------
options_repls = [
    # Top tab headers
    ("""tabDefs = {
    { key = "buttons",  label = "Profile" },
    { key = "behavior", label = "Settings" },
    { key = "keys",     label = "Keybinds" },
    { key = "skillbook", label = "Skill Book" },
    { key = "log",      label = "Log" },
    { key = "stats",    label = "Stats" },
    { key = "world",    label = "World" },   -- expansion/season content watches (Patiently Rewarded, ...)
    { key = "about",    label = "About" },
  }""",
     """tabDefs = {
    { key = "buttons",  label = "配装方案" },
    { key = "behavior", label = "常用设置" },
    { key = "keys",     label = "按键设置" },
    { key = "skillbook", label = "专业技能" },
    { key = "log",      label = "钓鱼日志" },
    { key = "stats",    label = "数据统计" },
    { key = "world",    label = "世界内容" },   -- expansion/season content watches (Patiently Rewarded, ...)
    { key = "about",    label = "关于插件" },
  }"""),

    # Window header
    ('headerProfileFS:SetText("Active: " .. Theme.Accent(curProfileName()))',
     'headerProfileFS:SetText("当前方案: " .. Theme.Accent(curProfileName()))'),
    ('parts[#parts + 1] = (warm and "Skill: " or "|cff888888Skill:|r ") .. s',
     'parts[#parts + 1] = (warm and "技能等级: " or "|cff888888技能等级:|r ") .. s'),
    ('parts[#parts + 1] = "|cff888888No fishing skill here|r"',
     'parts[#parts + 1] = "|cff888888未学会钓鱼技能|r"'),
    ('parts[#parts + 1] = "|cff888888Skill: not loaded|r"',
     'parts[#parts + 1] = "|cff888888技能等级: 未加载|r"'),
    ('if perc and perc > 0 then parts[#parts + 1] = "Perc: |cffffd100" .. perc .. "|r" end',
     'if perc and perc > 0 then parts[#parts + 1] = "感知加成: |cffffd100" .. perc .. "|r" end'),

    # Profile tab CRUD buttons
    ('revertBtn:SetText("Revert")', 'revertBtn:SetText("还原")'),
    ('saveBtn:SetText("Save")', 'saveBtn:SetText("保存")'),
    ('plbl:SetText("Profile:")', 'plbl:SetText("配装方案:")'),
    ('addBtn:SetText("Add")', 'addBtn:SetText("新建")'),
    ('dupBtn:SetSize(76, 22); dupBtn:SetPoint("LEFT", addBtn, "RIGHT", 4, 0); dupBtn:SetText("Duplicate"); Theme.Button(dupBtn)',
     'dupBtn:SetSize(76, 22); dupBtn:SetPoint("LEFT", addBtn, "RIGHT", 4, 0); dupBtn:SetText("复制"); Theme.Button(dupBtn)'),
    ('remBtn:SetText("Remove")', 'remBtn:SetText("删除")'),
    ('indivLbl:SetText("Individual")', 'indivLbl:SetText("独立设置")'),
    ('nlbl:SetText("Name:")', 'nlbl:SetText("方案名称:")'),
    ('defBtn:SetText("Set as default")', 'defBtn:SetText("设为默认")'),
    ('blbl:SetText("Bind here:")', 'blbl:SetText("绑定地点:")'),
    ('glbl:SetText("Gear set:")', 'glbl:SetText("配装方案:")'),
    ('emBtn:SetText("Equipment Manager")', 'emBtn:SetText("装备管理")'),
    ('plbl2:SetText("Fishing pole:")', 'plbl2:SetText("专用鱼竿:")'),
    ('poleWarn:SetText("|cffff9933No pole set.|r Drag your pole here, or save it in this profile\'s gear set.")',
     'poleWarn:SetText("|cffff9933未设置鱼竿。|r 将鱼竿拖曳至此处，或保存在本方案的配装中。")'),
    ('GameTooltip:SetText("Fishing pole", accentRGB())', 'GameTooltip:SetText("钓鱼竿", accentRGB())'),

    # Profile button tooltips
    ('barTip(profileDD, "Active profile", "Switch which saved fishing profile is active. The default profile (shown with \\"(default)\\") is the location fallback.")',
     'barTip(profileDD, "当前配装方案", "切换当前激活的钓鱼配装方案。标有“(默认)”的方案在未匹配到特定地点绑定时作为后备方案使用。")'),
    ('labelHover(plbl, 44, "Active profile", "Switch which saved fishing profile is active. The default profile (shown with \\"(default)\\") is the location fallback.")',
     'labelHover(plbl, 44, "当前配装方案", "切换当前激活的钓鱼配装方案。标有“(默认)”的方案在未匹配到特定地点绑定时作为后备方案使用。")'),
    ('barTip(dupBtn, "Duplicate profile", "Copy the current profile (slots and all) under a new name and switch to it.")',
     'barTip(dupBtn, "复制方案", "将当前方案完整复制为一个新方案并立即切换至该方案。")'),
    ('barTip(defBtn, "Set as default", "Make this the default profile - the one used when no location binding matches. Only one profile is the default.")',
     'barTip(defBtn, "设为默认方案", "将此方案设为默认后备方案。当所在区域未绑定任何独立方案时，将自动使用此方案。")'),

    # Keybinds tab
    ('intro:SetText("Set a key or controller button for any SBF action. "\n'
     '      .. "(Controller: enable it in Settings, then press a pad button here.)")',
     'intro:SetText("为任何 SBF 动作设置键盘按键或手柄按钮。(手柄：请先在设置中启用，然后在此处按下手柄按键。)")'),
    ('h:SetText(({ key1 = "Keyboard", mouse = "Mouse", ctrl = "Controller" })[key])',
     'h:SetText(({ key1 = "键盘", mouse = "鼠标", ctrl = "手柄" })[key])'),
    ('sectionAt("Main")', 'sectionAt("主要")'),
    ('tableRow("fishing", "Action /Cast", {', 'tableRow("fishing", "操作 / 抛竿", {'),
    ('tableRow("interact", "Loot / Interact",', 'tableRow("interact", "拾取 / 交互",'),
    ('sectionAt("Gear")', 'sectionAt("装备")'),
    ('tableRow("equipGear", "Equip profile gear")', 'tableRow("equipGear", "换上钓鱼配装")'),
    ('tableRow("restoreGear", "Restore normal gear")', 'tableRow("restoreGear", "恢复常规装备")'),
    ('sectionAt("Slots", true)', 'sectionAt("栏位动作", true)'),

    # Behavior settings tree sections
    ('{ section = "Interface options",', '{ section = "界面与操作设置",'),
    ('{ check = C("Two-button mode (separate cast & loot)",', '{ check = C("双按键模式 (独立抛竿与拾取)",'),
    ('{ check = C("Enable controller (gamepad) support",', '{ check = C("启用游戏手柄支持",'),
    ('{ check = C("Use mouse (double-click)",', '{ check = C("启用鼠标双击钓鱼",'),
    ('{ note = { text = "click speed:", color = "text" } }, { frame = mdf }, { note = { text = "sec", color = "text" } },',
     '{ note = { text = "双击判定间隔:", color = "text" } }, { frame = mdf }, { note = { text = "秒", color = "text" } },'),

    ('{ section = "Fishing behavior",', '{ section = "钓鱼行为设置",'),
    ('{ check = C("Sit before each cast",', '{ check = C("每次抛竿前自动坐下",'),
    ('{ check = C("Warn when there\'s no fishing pole to fish with",', '{ check = C("未装备鱼竿时发出警告",'),
    ('{ check = C("Fight instead of looting when combat starts",', '{ check = C("进入战斗时优先反击而非拾取",'),
    ('{ check = C("Shift+click to turn off Cast Fishing",', '{ check = C("Shift+点击关闭施放钓鱼",'),
    ('{ check = C("Auto-dismount to fish  (never while flying)",', '{ check = C("钓鱼时自动下坐骑 (飞行中除外)",'),
    ('{ check = C("Refresh skill on cast",', '{ check = C("抛竿时刷新技能等级",'),
    ('{ check = C("Hide interface in combat",', '{ check = C("战斗中隐藏插件界面",'),
    ('{ note = { text = "Cast-fail back-off", color = "text",',
     '{ note = { text = "抛竿失败冷却时间", color = "text",'),
    ('{ note = { text = "Idle timeout", color = "text",',
     '{ note = { text = "闲置超时换装时间", color = "text",'),
    ('{ note = { text = "(SBF stands down until your next cast)", color = "textMuted" } },',
     '{ note = { text = "(超时后停止动作并恢复常规装备)", color = "textMuted" } },'),

    ('{ section = "Pet (this character)",', '{ section = "宠物设置 (当前角色)",'),
    ('{ note = { text = "Pet stance while fishing", color = "text",',
     '{ note = { text = "钓鱼时宠物姿态", color = "text",'),
    ('{ check = C("Fight when my pet is fighting",', '{ check = C("宠物进入战斗时协助攻击",'),
    ('{ check = C("Target what my pet is attacking first",', '{ check = C("优先选定宠物正在攻击的目标",'),

    ('{ section = "Item pickers",', '{ section = "物品选择器",'),
    ('{ check = C("Show toys I don\'t own",', '{ check = C("显示未拥有的玩具",'),
    ('{ check = C("Show items not in my bags",', '{ check = C("显示不在背包中的物品",'),
    ('{ check = C("Show Warband items",', '{ check = C("显示战团物品",'),
    ('{ check = C("Show hidden items  (dimmed - shift+left-click one to restore it)",',
     '{ check = C("显示已隐藏物品 (变暗显示 - Shift+左键恢复)",'),
    ('unhideBtn:SetSize(130, 22); unhideBtn:SetText("Restore all hidden"); Theme.Button(unhideBtn)',
     'unhideBtn:SetSize(130, 22); unhideBtn:SetText("恢复所有隐藏项"); Theme.Button(unhideBtn)'),

    ('{ section = "Minimap",', '{ section = "小地图",'),
    ('{ check = C("Hide the minimap button",', '{ check = C("隐藏小地图图标",'),

    ('{ section = "Optimizations",', '{ section = "性能与音效优化",'),
    ('{ check = C("Ultra fast loot  (grab everything instantly, no loot window)",',
     '{ check = C("极速自动拾取 (瞬间拾取全部物品，无需弹出拾取窗口)",'),
    ('{ check = C("Focus fishing",', '{ check = C("钓鱼专注音效 (调大水声/静音杂音)",'),
    ('local faBtn = Theme.MakeButton(pBe, 130, "Audio settings\\226\\128\\166",',
     'local faBtn = Theme.MakeButton(pBe, 130, "声音详细设置…",'),

    ('{ section = "Profile advanced mode",', '{ section = "高级方案模式",'),
    ('{ check = C("Enable advanced mode",', '{ check = C("启用高级方案模式",'),
    ('{ check = C("Auto-swap profiles by location",', '{ check = C("根据所在地点自动切换方案",'),
    ('{ check = C("Ask to save unsaved changes when closing SBF",', '{ check = C("关闭界面时提示保存未保存的修改",'),
    ('{ check = C("Flash on profile swap",', '{ check = C("切换方案时屏幕边缘闪烁提示",'),
    ('{ check = C("Auto-restore gear when idle  (at the idle timeout)",', '{ check = C("闲置超时后自动恢复常规装备",'),

    ('{ section = "Bobber reach",', '{ section = "浮漂距离判定",'),
    ('{ check = C("Extend the interact key\'s reach while fishing",', '{ check = C("钓鱼期间扩展交互按键有效距离",'),
    ('{ check = C("Use my saved camera when I start fishing",', '{ check = C("开始钓鱼时自动切换至保存的视角",'),
    ('{ note = { text = "Camera view slot:", color = "text" } },', '{ note = { text = "视角槽位:", color = "text" } },'),
    ('local camSave = Theme.MakeButton(pBe, 150, "Save current camera",',
     'local camSave = Theme.MakeButton(pBe, 150, "保存当前视角",'),
    ('{ check = C("Recast when the bobber lands out of reach",', '{ check = C("当浮漂超出距离时自动重新抛竿",'),
    ('soundRowSpec("Out of reach",', 'soundRowSpec("超出距离提示",'),

    ('{ section = "Audio feedback",', '{ section = "音效提示",'),
    ('soundRowSpec("Fishing start",', 'soundRowSpec("抛竿入水",'),
    ('soundRowSpec("Cast fail",', 'soundRowSpec("抛竿失败",'),
    ('soundRowSpec("No fish hooked",', 'soundRowSpec("脱钩/未钓到鱼",'),
    ('soundRowSpec("Expired (ran full, no bite)",', 'soundRowSpec("超时未咬钩",'),
    ('soundRowSpec("Nothing (empty line)",', 'soundRowSpec("空竿",'),
    ('local t = Theme.MakeButton(pBe, 46, "Test",', 'local t = Theme.MakeButton(pBe, 46, "测试",'),

    ('{ section = "Visuals",', '{ section = "外观设置",'),
    ('{ note = { text = "Window opacity", color = "text", onBuild = function(fs) helpLabel(fs, "set.bgAlpha") end } },',
     '{ note = { text = "窗口透明度", color = "text", onBuild = function(fs) helpLabel(fs, "set.bgAlpha") end } },'),
    ('local rw = Theme.MakeButton(pBe, 130, "Reset window", ResetWindow)',
     'local rw = Theme.MakeButton(pBe, 130, "重置窗口位置", ResetWindow)'),

    # Skill Book tab
    ('rocLbl:SetText("Refresh skill on cast")', 'rocLbl:SetText("抛竿时刷新技能等级")'),
    ('skillNote:SetText("Open your Fishing Journal once on this character to load your fishing skill "\n'
     '      .. "(a Blizzard requirement - your skill shows automatically after that), or',
     'skillNote:SetText("请在本角色上打开一次专业技能面板以加载钓鱼数据 (暴雪客户端机制要求，之后将自动显示)，或'),

    # Log tab
    ('logHead:SetText(Theme.Accent("Fishing log"))', 'logHead:SetText(Theme.Accent("钓鱼日志"))'),
    ('logMaxLbl:SetText("show")', 'logMaxLbl:SetText("显示条数")'),

    # Stats tab
    ('charLbl:SetText(Theme.Accent("Character"))', 'charLbl:SetText(Theme.Accent("角色"))'),
    ('eh:SetText(Theme.Accent("Events"))', 'eh:SetText(Theme.Accent("事件统计"))'),
    ('licHdr:SetText(Theme.Accent("License"))', 'licHdr:SetText(Theme.Accent("许可协议"))'),
    ('sl:SetText("sort:")', 'sl:SetText("排序:")'),
    ('e:SetText("No events recorded for this period.")', 'e:SetText("此期间无事件记录。")'),
    ('e:SetText("No fish recorded for this period.")', 'e:SetText("此期间无钓鱼记录。")'),
    ('e:SetText("No zones recorded for this period.")', 'e:SetText("此期间无区域记录。")'),

    # About tab
    ('title:SetText(Theme.Accent("Single-Button Fishing"))', 'title:SetText(Theme.Accent("一键钓鱼 (Single-Button Fishing)"))'),
    ('bug:SetText("Report a bug")', 'bug:SetText("提交错误报告")'),
    ('tag:SetText("|cffe8c679The only fishing add-on that does it all.|r")',
     'tag:SetText("|cffe8c679功能最全面的魔兽世界一键钓鱼插件。|r")'),
    ('desc:SetText("One key runs your whole fishing loop - cast, wait, loot, recast - and handles your food, "\n'
     '      .. "drink, lures, chum, buffs, the dinghy, and fighting back when something attacks you, all automatically.")',
     'desc:SetText("一个按键即可全自动完成钓鱼循环：抛竿、等待、收杆、拾取与再抛竿，同时自动处理增益食物、饮品、鱼饵、诱饵、增益效果、充气木筏以及遇敌自动反击。")'),
    ('wlbl:SetText("Check out our other add-ons, and vote on what we build next:")',
     'wlbl:SetText("欢迎查看我们的其他插件：")'),
    ('wbtn:SetText("Show welcome screen")', 'wbtn:SetText("显示欢迎新手引导")'),
]
apply_replacements('Options.lua', options_repls)

# Remove sbf_pristine temporary directory
shutil.rmtree('scripts/sbf_pristine')
os.remove('scripts/sbf_upstream.zip')

print("=== ALL SBF CLEAN TRANSLATIONS APPLIED SUCCESSFULLY! ===")
