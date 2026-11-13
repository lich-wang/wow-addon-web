/**
 * @param {import('jszip')} zip - Forever Mouse Tooltip 插件压缩包
 * @param {string} [releaseTag] - 上游 Release 标签，用于替换未展开的 @project-version@ 占位符
 */
export async function patchForeverMouseTooltip(zip, releaseTag = 'v0.2.0') {
  // 1. Patch ForeverMouseTooltip/ForeverMouseTooltip.toc with zhCN metadata and version
  const tocFile = zip.file('ForeverMouseTooltip/ForeverMouseTooltip.toc');
  if (tocFile) {
    let toc = await tocFile.async('string');
    toc = toc.replace('## Version: @project-version@', `## Version: ${releaseTag}`);
    if (!toc.includes('Title-zhCN')) {
      toc = toc
        .replace(
          /## Title: (.*)/,
          '## Title: $1\n## Title-zhCN: |cff00ff00[界面]|r Forever Mouse Tooltip (鼠标提示跟随)'
        )
        .replace(
          /## Notes: (.*)/,
          '## Notes: $1\n## Notes-zhCN: 专为无限服 (WoW Forever) 打造的零延迟鼠标提示跟随插件！支持真正的8方位四角对齐（右下/左下/右上/左上/正下/正上）与原生引擎锚点，彻底告别右下角固定位置与残影延迟。'
        );
    }
    zip.file('ForeverMouseTooltip/ForeverMouseTooltip.toc', toc);
  }

  // 2. Patch ForeverMouseTooltip/ForeverMouseTooltip.lua with true 8-direction corner anchoring + full zhCN
  const luaFile = zip.file('ForeverMouseTooltip/ForeverMouseTooltip.lua');
  if (luaFile) {
    let lua = await luaFile.async('string');

    // Upgrade ApplyCursorAnchor and defaults to support true 8-direction cursor anchoring (like Bottom-Right below cursor)
    // while keeping native ANCHOR_CURSOR modes available and zero-taint!
    const oldDefaultsAndAnchor = `    cursorAnchorSide = "DEFAULT", -- which side of the cursor the tooltip appears on
    -- Offsets only take effect via SetAnchorType, not SetOwner's own
    -- offset params (those are documented to be ignored for cursor anchor
    -- types). Positive X moves right, positive Y moves up (Blizzard's own
    -- convention) -- so a negative Y here is "below the cursor".
    offsetX = 0,
    offsetY = 0,`;

    const newDefaultsAndAnchor = `    cursorAnchorSide = "RIGHT", -- default to true Bottom-Right of cursor
    offsetX = 16,
    offsetY = -8,`;

    lua = lua.replace(oldDefaultsAndAnchor, newDefaultsAndAnchor);

    const oldAnchorLogic = `local ANCHOR_TYPES = {
    DEFAULT = "ANCHOR_CURSOR", -- Blizzard's own default cursor anchor (bottom-right of cursor)
    RIGHT = "ANCHOR_CURSOR_RIGHT", -- tooltip appears to the right of the cursor
    LEFT = "ANCHOR_CURSOR_LEFT", -- tooltip appears to the left of the cursor
    CENTER = "ANCHOR_CURSOR_RIGHT", -- see comment above; offset is adjusted below
}

-- By the time any of our hooks run, Blizzard's own code has *always*
-- already called tooltip:SetOwner(...) -- either inside
-- GameTooltip_SetDefaultAnchor itself (for the "default corner" case: bags,
-- action bars, etc.) or natively for world-unit mouseover tooltips (which
-- bypass GameTooltip_SetDefaultAnchor entirely and call SetOwner directly,
-- which is also why switching mouseover from one unit straight to another
-- doesn't necessarily re-trigger our GameTooltip_SetDefaultAnchor hook).
-- That means we never need to call tooltip:SetOwner(...) ourselves at
-- all: SetAnchorType alone can change the anchor type and offset on an
-- already-owned tooltip, with no content-clearing side effect (unlike
-- SetOwner, which is effectively a hide/show cycle and was wiping out
-- Blizzard's own name/health/level lines whenever we called it a second
-- time from Handle*Tooltip to refine positioning after content was
-- added). This also fixes a related bug where switching mouseover
-- directly from one unit to another (e.g. NPC to player, with no gap in
-- between) could leave the tooltip "stuck" on the previous anchor,
-- because GameTooltip_SetDefaultAnchor -- our only previous trigger for
-- calling SetOwner -- doesn't reliably re-fire for that transition.
-- Calling SetAnchorType unconditionally every time, regardless of
-- whether anything changed, means there's no stale state to get stuck in.
local function ApplyCursorAnchor(tooltip)
    local side = GetSetting("cursorAnchorSide")
    local anchorType = ANCHOR_TYPES[side] or ANCHOR_TYPES.DEFAULT
    local offsetX = GetSetting("offsetX") or 0
    local offsetY = GetSetting("offsetY") or 0

    if side == "CENTER" then
        -- tooltip:GetWidth() is a plain read, not a risky call -- safe to
        -- use here. On the very first (tentative) call, before content is
        -- set, this may reflect a stale size from a previous tooltip; it
        -- gets corrected once Handle*Tooltip re-applies this after the
        -- real content (and width) is known.
        local width = tooltip:GetWidth() or 0
        offsetX = offsetX - (width / 2)
    end

    tooltip:SetAnchorType(anchorType, offsetX, offsetY)
end`;

    const newAnchorLogic = `-- Blizzard's native ANCHOR_CURSOR / ANCHOR_CURSOR_RIGHT / ANCHOR_CURSOR_LEFT
-- always attach the tooltip's BOTTOM point to the cursor (growing upward above
-- the cursor). To support true "Bottom-Right" (tooltip's TOPLEFT attached to
-- cursor, growing downward and to the right) without touching GameTooltip in an
-- OnUpdate loop, we use a 1x1 reference frame (cursorAnchor) that tracks the
-- cursor, and attach GameTooltip's chosen corner to cursorAnchor once per show.
local ANCHOR_CORNERS = {
    BOTTOM_RIGHT = "TOPLEFT",     -- 鼠标右下方（提示框左上角对齐鼠标）
    RIGHT        = "TOPLEFT",     -- 兼容旧版 RIGHT 配置，同样映射为真正的鼠标右下方
    BOTTOM_LEFT  = "TOPRIGHT",    -- 鼠标左下方（提示框右上角对齐鼠标）
    LEFT         = "TOPRIGHT",    -- 兼容旧版 LEFT 配置，映射为真正的鼠标左下方
    BOTTOM       = "TOP",         -- 鼠标正下方居中（提示框顶部居中对齐鼠标）
    CENTER       = "TOP",         -- 兼容旧版 CENTER 配置，映射为鼠标正下方居中
    TOP_RIGHT    = "BOTTOMLEFT",  -- 鼠标右上方（提示框左下角对齐鼠标）
    TOP_LEFT     = "BOTTOMRIGHT", -- 鼠标左上方（提示框右下角对齐鼠标）
    TOP          = "BOTTOM",      -- 鼠标正上方居中（提示框底部居中对齐鼠标）
}

local cursorAnchor = CreateFrame("Frame", "ForeverMouseTooltipCursorAnchor", UIParent)
cursorAnchor:SetSize(1, 1)

local function UpdateCursorAnchorPosition()
    local x, y
    if GetScaledCursorPosition then
        x, y = GetScaledCursorPosition()
    else
        local scale = UIParent:GetEffectiveScale()
        if not scale or scale == 0 then scale = 1 end
        x, y = GetCursorPosition()
        x, y = x / scale, y / scale
    end
    cursorAnchor:ClearAllPoints()
    cursorAnchor:SetPoint("BOTTOMLEFT", UIParent, "BOTTOMLEFT", x, y)
end

cursorAnchor:SetScript("OnUpdate", function()
    if not ShouldFollowCursor() or not GameTooltip:IsShown() then
        return
    end
    UpdateCursorAnchorPosition()
end)

-- Instant fade-out when mouse leaves a world object/unit so ANCHOR_NONE tooltips don't linger for 1s
if GameTooltip.FadeOut then
    hooksecurefunc(GameTooltip, "FadeOut", function(self)
        if ShouldFollowCursor() and GetSetting("cursorAnchorSide") ~= "DEFAULT" then
            self:Hide()
        end
    end)
end

local function ApplyCursorAnchor(tooltip)
    local side = GetSetting("cursorAnchorSide") or "BOTTOM_RIGHT"
    local offsetX = GetSetting("offsetX") or 0
    local offsetY = GetSetting("offsetY") or 0

    if side == "DEFAULT" then
        tooltip:SetAnchorType("ANCHOR_CURSOR", 0, 0)
        return
    end

    local point = ANCHOR_CORNERS[side] or "TOPLEFT"
    -- If user still had 0, 0 from previous default and chose BOTTOM_RIGHT/RIGHT, give a sensible breathing gap so cursor doesn't overlap border
    if offsetX == 0 and offsetY == 0 and (side == "BOTTOM_RIGHT" or side == "RIGHT") then
        offsetX = 16
        offsetY = -8
    elseif offsetX == 0 and offsetY == 0 and (side == "BOTTOM_LEFT" or side == "LEFT") then
        offsetX = -16
        offsetY = -8
    end

    UpdateCursorAnchorPosition()
    if tooltip:GetAnchorType() ~= "ANCHOR_NONE" then
        tooltip:SetAnchorType("ANCHOR_NONE", 0, 0)
    end
    tooltip:ClearAllPoints()
    local scale = tooltip:GetScale() or 1
    if scale == 0 then scale = 1 end
    tooltip:SetPoint(point, cursorAnchor, "BOTTOMLEFT", offsetX / scale, offsetY / scale)
end`;

    lua = lua.replace(oldAnchorLogic, newAnchorLogic);

    const replacements = [
      // Info lines in tooltip
      [
        'tooltip:AddLine("Faction: " .. englishFaction',
        'tooltip:AddLine("阵营: " .. (englishFaction == "Alliance" and "联盟" or (englishFaction == "Horde" and "部落" or englishFaction))'
      ],
      ['tooltip:AddLine("NPC ID: " .. npcId', 'tooltip:AddLine("NPC ID: " .. npcId'],
      ['tooltip:AddLine("Item ID: " .. itemId', 'tooltip:AddLine("物品 ID: " .. itemId'],
      ['tooltip:AddLine("Spell ID: " .. spellId', 'tooltip:AddLine("法术 ID: " .. spellId'],

      // Category title
      [
        'Settings.RegisterVerticalLayoutCategory("Forever Mouse Tooltip")',
        'Settings.RegisterVerticalLayoutCategory("Forever 鼠标提示跟随")'
      ],

      // Section: Positioning
      ['AddHeader("Positioning")', 'AddHeader("位置与锚点设置")'],
      [
        'AddCheckbox("enabled", "Enable", "Anchor tooltips to the mouse cursor instead of the default corner.", DEFAULTS.enabled)',
        'AddCheckbox("enabled", "启用鼠标跟随", "将游戏内默认固定在右下角的鼠标提示（Tooltip）改为实时跟随鼠标光标。", DEFAULTS.enabled)'
      ],
      [
        'AddCheckbox("disableInCombat", "Disable in Combat", "Keep Blizzard\'s default tooltip position while in combat.", DEFAULTS.disableInCombat)',
        'AddCheckbox("disableInCombat", "战斗中恢复默认位置", "进入战斗时保持暴雪默认的右下角固定位置，避免遮挡视野。", DEFAULTS.disableInCombat)'
      ],
      [
        'AddDropdown("pauseCursorModifier", "Pause Key", "Hold this key to temporarily keep the tooltip at Blizzard\'s default position instead of following the cursor.", DEFAULTS.pauseCursorModifier, {',
        'AddDropdown("pauseCursorModifier", "暂停跟随快捷键", "按住该修饰键时，临时将鼠标提示恢复至默认固定位置。", DEFAULTS.pauseCursorModifier, {'
      ],
      [
        '{ value = "NONE", text = "None (always follow cursor)" },',
        '{ value = "NONE", text = "无（始终跟随鼠标）" },'
      ],
      [
        `    AddDropdown("cursorAnchorSide", "Tooltip Anchor", "Which side of the cursor the tooltip appears on.", DEFAULTS.cursorAnchorSide, {
        { value = "DEFAULT", text = "Default (Can't be offset)" },
        { value = "RIGHT", text = "Bottom Right" },
        { value = "LEFT", text = "Bottom Left" },
        { value = "CENTER", text = "Bottom Center" },
    })`,
        `    local sideSetting = AddDropdown("cursorAnchorSide", "提示框相对鼠标方位", "选择提示框相对于鼠标光标显示在哪个方向。", DEFAULTS.cursorAnchorSide, {
        { value = "RIGHT", text = "鼠标右下方（推荐 · 提示框向右下展开）" },
        { value = "LEFT", text = "鼠标左下方（提示框向左下展开）" },
        { value = "CENTER", text = "鼠标正下方居中（提示框向下展开）" },
        { value = "TOP_RIGHT", text = "鼠标右上方（提示框向右上展开）" },
        { value = "TOP_LEFT", text = "鼠标左上方（提示框向左上展开）" },
        { value = "TOP", text = "鼠标正上方居中（提示框向上展开）" },
        { value = "DEFAULT", text = "暴雪原生跟随（正上方 · 不可偏移）" },
    })
    sideSetting:SetValueChangedCallback(function()
        if GameTooltip:IsShown() then UpdateTooltipPosition(GameTooltip) end
    end)`
      ],
      [
        'AddSlider("offsetX", "Horizontal Offset", "Extra breathing room between the cursor and the tooltip. Positive moves right, negative moves left.", DEFAULTS.offsetX, -50, 50, 1)',
        `local oxSetting = AddSlider("offsetX", "水平偏移 (X)", "调整鼠标与提示框之间的水平间距（正数向右，负数向左）。", DEFAULTS.offsetX, -100, 100, 1)
    oxSetting:SetValueChangedCallback(function()
        if GameTooltip:IsShown() then UpdateTooltipPosition(GameTooltip) end
    end)`
      ],
      [
        'AddSlider("offsetY", "Vertical Offset", "Extra breathing room between the cursor and the tooltip. Positive moves up, negative moves down.", DEFAULTS.offsetY, -50, 50, 1)',
        `local oySetting = AddSlider("offsetY", "垂直偏移 (Y)", "调整鼠标与提示框之间的垂直间距（正数向上，负数向下）。", DEFAULTS.offsetY, -100, 100, 1)
    oySetting:SetValueChangedCallback(function()
        if GameTooltip:IsShown() then UpdateTooltipPosition(GameTooltip) end
    end)`
      ],
      [
        'AddSlider("tooltipScale", "Tooltip Scale (%)", "Resize the tooltip. 100 = default size.", DEFAULTS.tooltipScale, 50, 200, 5)',
        'AddSlider("tooltipScale", "提示框缩放比例 (%)", "调整鼠标提示框整体大小（100% 为默认大小）。", DEFAULTS.tooltipScale, 50, 200, 5)'
      ],

      // Section: Extra Information
      ['AddHeader("Extra Information")', 'AddHeader("附加信息显示")'],
      [
        'AddCheckbox("showNpcId", "Show NPC ID", "Add the creature/vehicle\'s numeric ID to unit tooltips.", DEFAULTS.showNpcId)',
        'AddCheckbox("showNpcId", "显示 NPC ID", "在单位鼠标提示底部显示 NPC / 怪物的数字编号。", DEFAULTS.showNpcId)'
      ],
      [
        'AddCheckbox("showItemId", "Show Item ID", "Add the item\'s numeric ID to item tooltips.", DEFAULTS.showItemId)',
        'AddCheckbox("showItemId", "显示物品 ID", "在物品鼠标提示底部显示物品的数字编号。", DEFAULTS.showItemId)'
      ],
      [
        'AddCheckbox("showSpellId", "Show Spell ID", "Add the spell\'s numeric ID to spell tooltips.", DEFAULTS.showSpellId)',
        'AddCheckbox("showSpellId", "显示法术 ID", "在技能/法术鼠标提示底部显示法术的数字编号。", DEFAULTS.showSpellId)'
      ],
      [
        'AddCheckbox("showFactionName", "Show Faction", "Add Alliance/Horde faction to unit tooltips, when available.", DEFAULTS.showFactionName)',
        'AddCheckbox("showFactionName", "显示所属阵营", "在单位鼠标提示中附加显示联盟/部落阵营信息。", DEFAULTS.showFactionName)'
      ],

      // Slash messages
      [
        'print("|cff33ff99ForeverMouseTooltip|r: options panel unavailable on this client; use /fmt on|off|offset|combat instead.")',
        'print("|cff33ff99Forever鼠标提示跟随|r: 当前客户端不支持设置面板，请使用 /fmt on|off|offset|combat 命令。")'
      ],
      [
        'print("|cff33ff99ForeverMouseTooltip|r: disabled (tooltip stays at the default position).")',
        'print("|cff33ff99Forever鼠标提示跟随|r: 已关闭（提示框保持在右下角默认固定位置）。")'
      ],
      [
        'print("|cff33ff99ForeverMouseTooltip|r: enabled, tooltip follows the cursor.")',
        'print("|cff33ff99Forever鼠标提示跟随|r: 已开启，鼠标提示现在将实时跟随光标。")'
      ],
      [
        'print(("|cff33ff99ForeverMouseTooltip|r: offset set to %d, %d."):format(x, y))',
        'print(("|cff33ff99Forever鼠标提示跟随|r: 偏移量已设置为 X=%d, Y=%d。"):format(x, y))'
      ],
      [
        'print("|cff33ff99ForeverMouseTooltip|r: usage /fmt offset <x> <y> (pixels; positive x = right, positive y = up)")',
        'print("|cff33ff99Forever鼠标提示跟随|r: 用法 /fmt offset <x> <y>（像素值；正数 X 向右，正数 Y 向上）")'
      ],
      [
        'print("|cff33ff99ForeverMouseTooltip|r: will keep the default tooltip position while in combat.")',
        'print("|cff33ff99Forever鼠标提示跟随|r: 已开启【战斗中保持默认右下角位置】。")'
      ],
      [
        'print("|cff33ff99ForeverMouseTooltip|r: cursor-anchored tooltip stays active in combat.")',
        'print("|cff33ff99Forever鼠标提示跟随|r: 已关闭战斗限制，战斗中也将继续跟随鼠标。")'
      ],
      [
        'print("|cff33ff99ForeverMouseTooltip|r: usage /fmt combat on|off")',
        'print("|cff33ff99Forever鼠标提示跟随|r: 用法 /fmt combat on|off")'
      ],
      [
        'print("|cff33ff99ForeverMouseTooltip|r: /fmt on | /fmt off | /fmt offset <x> <y> | /fmt combat on|off | /fmt options")',
        'print("|cff33ff99Forever鼠标提示跟随|r: 可用命令 /fmt on | /fmt off | /fmt offset <x> <y> | /fmt combat on|off | /fmt options（打开设置面板）")'
      ]
    ];

    for (const [target, replacement] of replacements) {
      lua = lua.replace(target, replacement);
    }

    zip.file('ForeverMouseTooltip/ForeverMouseTooltip.lua', lua);
  }
}

export async function patchTinyTooltipForever(zip) {
  // 1. Patch TinyTooltip/TinyTooltip.toc with zhCN metadata
  const tocFile = zip.file('TinyTooltip/TinyTooltip.toc');
  if (tocFile) {
    let toc = await tocFile.async('string');
    if (!toc.includes('Title-zhCN')) {
      toc = toc
        .replace(
          /## Title: (.*)/,
          '## Title: $1\n## Title-zhCN: |cff00ff00[界面]|r TinyTooltip Forever (全能鼠标提示增强与跟随)'
        )
        .replace(
          /## Notes: (.*)/,
          '## Notes: $1\n## Notes-zhCN: 专为无限服移植的经典全能鼠标提示增强插件！默认开启跟随鼠标光标，支持职业染色、生命条美化、3D角色模型、目标关注统计与 DIY 元素自由排版。'
        );
      zip.file('TinyTooltip/TinyTooltip.toc', toc);
    }
  }

  // 2. Patch TinyTooltip/locales/zhCN.lua for missing Forever keys & traditional Chinese fixes
  const zhFile = zip.file('TinyTooltip/locales/zhCN.lua');
  if (zhFile) {
    let zh = await zhFile.async('string');
    zh = zh
      .replace('["general.statusbarFont"]               = "HP文字字體",', '["general.statusbarFont"]               = "HP文字字体",')
      .replace('["unit.player.elements.gearScore"]      = "齒輪分數",', '["unit.player.elements.gearScore"]      = "装备评分(GS)",')
      .replace('["spell.background"]                    = "背景顔色",', '["spell.background"]                    = "背景颜色",');

    const extraKeys = [
      '    ["general.fadeOut"]                     = "渐隐淡出提示框（关闭则移开鼠标立即隐藏）",',
      '    ["dropdown.defaultTopLeft"]             = "|cffaaaaaa系统默认|r 左上角",',
      '    ["dropdown.defaultBottomLeft"]          = "|cffaaaaaa系统默认|r 左下角",',
      '    ["dropdown.defaultTopRight"]            = "|cffaaaaaa系统默认|r 右上角",',
      '    ["dropdown.defaultBottomRight"]         = "|cffaaaaaa系统默认|r 右下角",',
      '    ["dropdown.samefaction"]                = "同阵营",',
      '    ["dropdown.score"]                      = "评分染色",',
      '    ["showTargetBy"]                        = "显示被关注",',
      '    ["DIY"]                                 = "自定义布局",'
    ];

    for (const line of extraKeys) {
      const keyMatch = line.match(/\["([^"]+)"\]/);
      if (keyMatch && !zh.includes(`["${keyMatch[1]}"]`)) {
        zh = zh.replace(/\n}\s*$/, `\n${line}\n}\n`);
      }
    }

    zip.file('TinyTooltip/locales/zhCN.lua', zh);
  }

  // 3. Patch TinyTooltip/Options.lua panel titles to Chinese when in zhCN
  const optFile = zip.file('TinyTooltip/Options.lua');
  if (optFile) {
    let opt = await optFile.async('string');
    opt = opt
      .replace('frame.title:SetText(format("%s |cff33eeff%s|r", addonName, "General"))', 'frame.title:SetText(format("%s |cff33eeff%s|r", addonName, "常规与跟随设置"))')
      .replace('framePC.title:SetText(format("%s |cff33eeff%s|r", addonName, "Unit Is Player"))', 'framePC.title:SetText(format("%s |cff33eeff%s|r", addonName, "玩家提示设置"))')
      .replace('framePC.name = " - Player"', 'framePC.name = " - 玩家单位"')
      .replace('framePCScrollFrame.name = " - Player"', 'framePCScrollFrame.name = " - 玩家单位"')
      .replace('frameNPC.title:SetText(format("%s |cff33eeff%s|r", addonName, "Unit Is NPC"))', 'frameNPC.title:SetText(format("%s |cff33eeff%s|r", addonName, "NPC 提示设置"))')
      .replace('frameNPC.name = " - NPC"', 'frameNPC.name = " - NPC 单位"')
      .replace('frameNPCScrollFrame.name = " - NPC"', 'frameNPCScrollFrame.name = " - NPC 单位"')
      .replace('frameStatusbar.title:SetText(format("%s |cff33eeff%s|r", addonName, "StatusBar"))', 'frameStatusbar.title:SetText(format("%s |cff33eeff%s|r", addonName, "生命值状态条"))')
      .replace('frameStatusbar.name = " - StatusBar"', 'frameStatusbar.name = " - 生命状态条"')
      .replace('frameSpell.title:SetText(format("%s |cff33eeff%s|r", addonName, "Spell"))', 'frameStatusbar.title:SetText(format("%s |cff33eeff%s|r", addonName, "法术技能提示"))')
      .replace('frameSpell.name = " - Spell"', 'frameSpell.name = " - 法术与技能"')
      .replace('frameFont.title:SetText(format("%s |cff33eeff%s|r", addonName, "Font"))', 'frameFont.title:SetText(format("%s |cff33eeff%s|r", addonName, "字体样式"))')
      .replace('frameFont.name = " - Font"', 'frameFont.name = " - 字体样式"')
      .replace('frameVariables.title:SetText(format("%s |cff33eeff%s|r", addonName, "Variables"))', 'frameVariables.title:SetText(format("%s |cff33eeff%s|r", addonName, "配置导入与导出"))')
      .replace('frameVariables.name = " - Variables"', 'frameVariables.name = " - 配置导入导出"');
    zip.file('TinyTooltip/Options.lua', opt);
  }
}
