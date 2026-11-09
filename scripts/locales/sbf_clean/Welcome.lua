-- Welcome.lua — first-run guided onboarding for SBF. A movable, themed, scrolling panel that pops
-- on the first login (until dismissed) and walks a new user through the only thing they MUST set (the
-- fishing key) plus the handful of optional essentials (two-button mode, pole, combat, heal, scope).
--
-- It REUSES the real settings widgets (ns.MakeKeybindButton / ns.MakeItemButton / ns.MakeGameBindButton,
-- exposed by Options.lua) so there is ONE source of truth — editing a field here persists EXACTLY as it
-- does in full Settings (fishing key -> SBFDB.binds; combat/heal -> per-character SBF.SlotDef; pole ->
-- the working profile via SBF.working/SBF.MarkDirty/SBF.SaveWorking).
local ADDON, ns = ...
SBF = SBF or {}

-- Same per-addon-palette Theme proxy Options.lua uses: every read re-activates SBF's preset first, so a
-- later-running render closure still gets SBF's palette (mirrors the taint-safe-widgets rule).
local Theme = LibStub("GECTheme-1.0").ForAddon(
  function() return (SBFDB and SBFDB.themePreset) or "everforest" end,
  function(v) SBFDB.themePreset = v end)

local WEBSITE_URL = "https://goblineng.co"   -- community link (configurable; placeholder)

-- "Welcome dismissed" is PER-CHARACTER — each character (esp. a fresh one) should get the welcome until IT
-- dismisses it. Keyed by Name-Realm under SBFDB.welcomeHide. (A legacy account-wide boolean is treated as
-- "not dismissed" so everyone sees it once under the new per-char model.)
local function welcomeHidden()
  local w = SBFDB and SBFDB.welcomeHide
  return (type(w) == "table" and w[SBF.CharKey()]) or false
end
local function setWelcomeHidden(v)
  if type(SBFDB.welcomeHide) ~= "table" then SBFDB.welcomeHide = {} end
  SBFDB.welcomeHide[SBF.CharKey()] = (v and true) or nil
end

local welcome   -- the window frame (built lazily)

-- keep the full-Settings two-button UI in sync if it has been built (its panel is built lazily on first open)
local function syncSettingsLootUI()
  local p = SBF._optionsPanel
  if p and p._refreshLootUI then p._refreshLootUI() end
  if p and p._refreshKeysPage then p._refreshKeysPage() end
  if p and p._refreshInputChecks then p._refreshInputChecks() end   -- flip the Use-mouse / controller ticks live
end

-- ---- small themed helpers (mirror Options.lua's style) -----------------------
-- a wrapping body/help paragraph parented to `parent`, anchored TOPLEFT at (x,y), `w` wide.
local function para(parent, x, y, w, text, role)
  local fs = parent:CreateFontString(nil, "ARTWORK", "GameFontHighlightSmall")
  fs:SetPoint("TOPLEFT", x, y); fs:SetWidth(w); fs:SetJustifyH("LEFT"); fs:SetJustifyV("TOP")
  fs:SetText(text); Theme.Font(fs, role or "text")
  return fs
end

-- a section title + faint full-width divider (matches Options.lua's sectionHeader look).
local function header(parent, x, y, w, text)
  local _, ln = Theme.SectionHeader(parent, x, y, text)
  if ln then
    ln:ClearAllPoints()
    ln:SetPoint("TOPLEFT", parent, "TOPLEFT", x, y - 16)   -- re-span the lib's fixed-width line to our width
    ln:SetWidth(w); ln:SetColorTexture(unpack(Theme.colors.divider))
  end
end

-- a themed labeled checkbox. onClick(checked) runs on toggle; returns the CheckButton so callers can
-- re-sync it later. The whole label is hoverable (tooltip covers the box AND the words — project rule).
local function labeledCheck(parent, x, y, label, getChecked, onClick, tipTitle, tipBody)
  local cb = CreateFrame("CheckButton", nil, parent, "UICheckButtonTemplate")
  cb:SetSize(24, 24); cb:SetPoint("TOPLEFT", x, y); Theme.Checkbox(cb)
  cb:SetChecked(getChecked() and true or false)
  local lbl = parent:CreateFontString(nil, "ARTWORK", "GameFontHighlight")
  lbl:SetPoint("LEFT", cb, "RIGHT", 4, 0); lbl:SetText(label); Theme.Font(lbl, "text")
  cb:SetScript("OnClick", function(self) onClick(self:GetChecked() and true or false) end)
  if tipBody then
    local function tip(self)
      GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
      GameTooltip:SetText(tipTitle or label, Theme.HexToRGB(Theme.accentHex))
      GameTooltip:AddLine(tipBody, 0.85, 0.85, 0.85, true); GameTooltip:Show()
    end
    cb:HookScript("OnEnter", tip); cb:HookScript("OnLeave", GameTooltip_Hide)
    local z = CreateFrame("Frame", nil, parent); z:EnableMouse(true)
    z:SetPoint("TOPLEFT", lbl, "TOPLEFT", -2, 2); z:SetPoint("BOTTOMRIGHT", lbl, "BOTTOMRIGHT", 2, -2)
    z:SetScript("OnEnter", tip); z:SetScript("OnLeave", GameTooltip_Hide)
  end
  cb.label = lbl
  return cb
end

-- ---- pole handling -----------------------------------------------------------
-- ---- the panel ---------------------------------------------------------------
local function build()
  -- a themed, movable window. NOT a UISpecialFrame: Escape must not close it (you open bags/collections to
  -- drag items in, and Escape-to-close-those would otherwise kill the welcome). Close via its X button only.
  local f = Theme.Window({
    name = "SBFWelcome", title = "欢迎使用 Single-Button Fishing 单键钓鱼",
    width = 460, height = 560, minWidth = 420, minHeight = 360,
    strata = "DIALOG", specialFrame = false, resizable = true, collapsible = false,
    savedKey = (function() SBFDB.welcomeWin = SBFDB.welcomeWin or {}; return SBFDB.welcomeWin end)(),
  })
  welcome = f
  local content = f.content

  -- a scroll frame filling the content child, so the panel scrolls when its body is taller than the window.
  -- A plain ScrollFrame + the lib's modern auto-hiding scrollbar (the shared scroll pattern).
  local sf = CreateFrame("ScrollFrame", "SBFWelcomeScroll", content)
  -- Reserve the bottom footer band: the footer is 58 tall anchored 8 up (top at 66), so the scroll body must
  -- STOP above it (70) or the scrolling content bleeds into the "Don't show again" checkbox + buttons.
  sf:SetPoint("TOPLEFT", 12, -8); sf:SetPoint("BOTTOMRIGHT", -28, 70)
  Theme.AttachScrollBar(sf)
  local body = CreateFrame("Frame", nil, sf)
  body:SetSize(1, 1); sf:SetScrollChild(body)
  local function fitWidth() body:SetWidth(sf:GetWidth()) end
  sf:SetScript("OnSizeChanged", fitWidth); fitWidth()

  local PAD, W = 6, 392   -- content inset + wrap width for paragraphs
  local ICON = 37         -- combat/heal slot-button size
  local y = -4

  -- 1) tagline + the "one key does it ALL" showcase -----------------------------
  local tag = body:CreateFontString(nil, "OVERLAY", "GameFontNormalHuge")
  tag:SetPoint("TOPLEFT", PAD, y); tag:SetWidth(W); tag:SetJustifyH("LEFT"); tag:SetWordWrap(true)
  tag:SetText("|cffe8c679唯一一个全功能一体化钓鱼插件。|r")   -- brand gold
  y = y - 38
  -- the core loop stays WHITE; everything the one key ALSO does is tucked BETWEEN loot and recast, colour-coded
  local actions = "单个按键搞定所有钓鱼流程：抛竿、等待、拾取、"
    .. "|cffe8c679进食、喝水、鱼饵、浮标、诱饵、增益、|r "
    .. "|cfff28c28战斗、治疗、|r "
    .. "|cff7cb83a乘船、下坐骑，|r "
    .. "然后自动重新抛竿。"
  local acts = para(body, PAD, y, W, actions, "text")
  local _f, _sz, _fl = acts:GetFont(); if _f then acts:SetFont(_f, (_sz or 12) + 2, _fl) end   -- a touch bigger
  y = y - 62

  -- 2) REQUIRED: input method + per-input bind controls --------------------------
  -- A segmented selector (Keyboard / Mouse / Controller) picks HOW you fish. Selecting one ONLY shows that
  -- input's bind controls below (it changes nothing in Settings). The matching mode (mouse / gamepad) is
  -- auto-enabled ONLY once you actually SET that input's fishing key/button — wired via the bind widgets'
  -- `after` callbacks. The choice persists in SBFDB.welcomeInput; all three panels are built and overlapped
  -- (only the active one is shown), so flipping between them keeps each input's configuration.
  if not SBFDB.welcomeInput then SBFDB.welcomeInput = "keyboard" end

  header(body, PAD, y, W, "你想如何操作钓鱼？  |header(body, PAD, y, W, "你想如何钓鱼？  |cffff8a4c(必填)|r"); y = y - 26
  para(body, PAD, y, W, "选择输入方式并在下方设置快捷键。绑定控件会随之调整，设置按键后将自动为您启用对应模式。", "textDim"); y = y - 30

  -- forward decls so the selector buttons + panel refreshers can see each other
  local selButtons = {}        -- { keyboard = btn, mouse = btn, controller = btn }
  local panels = {}            -- { keyboard = frame, mouse = frame, controller = frame }
  local panelRefresh = {}      -- per-panel refreshers (two-button visibility + enable-box re-sync)
  local panelRecompute = {}    -- per-panel active-input recompute (mouse/controller only; keyboard = nil)
  local applyInput             -- (which) -> show the right panel + tint the selector

  -- Recompute the ACTIVE input mode from its required buttons. The mode is enabled IFF every required
  -- button is set: the fishing button always, AND the loot button only when two-button mode is on. If any
  -- required button is missing, the mode turns OFF (and the Settings checkbox unticks). Called from the
  -- bind widgets' `after` callbacks AND from the two-button toggle (the requirement just changed).
  local function recomputeMouse()
    local m = SBFDB.mouse or {}; SBFDB.mouse = m
    m.enabled = (m.fishButton and (not SBFDB.requireTwoButtons or m.lootButton)) and true or false
    -- Enabling mouse fishing from the welcome: just turn ON sit-before-cast (mouse fishing can't fight back
    -- mid-cast, and sitting reduces attacks). It's harmless, so we set it silently instead of nagging with a popup.
    if m.enabled then SBFDB.sitBeforeCast = true end
    if SBF.MouseApply then SBF.MouseApply() end
    syncSettingsLootUI()
  end
  local function recomputeController()
    -- fishing + interact controller binds are NATIVE now — read the pad key from the native bindings, not the
    -- old internal bindsCtrl store, so auto-enable still fires when a pad button is set in this panel.
    local fishPad = SBF.NativeKeyOfKind(SBF.FISHING_CMD, "pad")
    local lootPad = SBF.NativeKeyOfKind("INTERACTTARGET", "pad")
    SBFDB.gamepadEnable = (fishPad and (not SBFDB.requireTwoButtons or lootPad)) and true or false
    -- Only ENABLE the pad when SBF needs it; never force it OFF here. GamePadEnable is a GLOBAL CVar, so a user
    -- who turned their gamepad on outside SBF must keep it — force-writing "0" when SBF's pad button is unset
    -- would silently disable their controller. (QC finding.)
    if SBFDB.gamepadEnable then pcall(SetCVar, "GamePadEnable", "1") end
    syncSettingsLootUI()
  end

  -- the three segmented buttons in a row
  local SEL_W, SEL_GAP = 122, 6
  local function makeSelBtn(which, label, ax)
    local b = CreateFrame("Button", nil, body, "UIPanelButtonTemplate")
    b:SetSize(SEL_W, 24); b:SetPoint("TOPLEFT", ax, y); b:SetText(label); Theme.Button(b)
    b:SetScript("OnClick", function()
      -- selecting a segment ONLY switches the shown panel + tint. Nothing in Settings changes here;
      -- the matching mode (mouse / gamepad) auto-enables ONLY when the fishing key/button is actually set
      -- (the `after` callbacks wired into the bind widgets below).
      SBFDB.welcomeInput = which
      applyInput(which)
    end)
    selButtons[which] = b
    return b
  end
  makeSelBtn("keyboard", "键盘", PAD)
  makeSelBtn("mouse", "鼠标", PAD + (SEL_W + SEL_GAP))
  makeSelBtn("controller", "手柄", PAD + 2 * (SEL_W + SEL_GAP))
  y = y - 34

  -- a fixed-height container the three input panels stack inside (all anchored to its TOPLEFT). It is sized
  -- to the TALLEST case (two-button ON) so combat/heal below never overlap whichever panel is showing.
  -- Layout per panel: THREE stacked rows — LEFT column (x=0) holds labels + the two-button checkbox, RIGHT
  -- column (x=COL_R) holds the bind buttons:
  --   Row 1 (y=0):   fishing label (left) + fishing bind button (right)
  --   Row 2 (y=-30): the "use a separate key/button to loot" two-button checkbox (left)
  --   Row 3 (y=-58): loot label (left) + loot bind button (right) — shown ONLY when two-button is on
  local COL_R   = 184          -- right-column x within the panel (left labels cap at COL_R - 8 = 176)
  local LBL_W   = COL_R - 8     -- left-label width cap so they don't collide with the right column
  local PANEL_H = 84           -- 3 rows (two-button ON is the tallest case: row3 still fits inside)
  local panelBox = CreateFrame("Frame", nil, body)
  panelBox:SetPoint("TOPLEFT", PAD, y); panelBox:SetSize(W, PANEL_H)

  -- builds one input panel. `kind` controls which bind widgets it holds:
  --   "keyboard"   -> fishing key (key) + loot game-bind (INTERACTTARGET)
  --   "mouse"      -> fishing mouse button + loot mouse button
  --   "controller" -> fishing pad button + loot pad button (bindsCtrl)
  -- `after` is the auto-enable callback fired by BOTH bind widgets when a key/button is set or cleared
  -- (keyboard passes nil — nothing to enable). mkFish/mkLoot receive (p, x, y, after) and forward `after`
  -- to the underlying widget. Each panel also carries its own two-button checkbox + a loot row revealed
  -- only when two-button is on.
  local function buildInputPanel(kind, after, mkFishLabel, mkFish, mkLootLabel, mkLoot)
    local p = CreateFrame("Frame", nil, panelBox)
    p:SetPoint("TOPLEFT", 0, 0); p:SetSize(W, PANEL_H)
    panelRecompute[kind] = after   -- mouse/controller carry a recompute; keyboard's is nil

    -- ROW 1: fishing label (left) + fishing bind button (right)
    para(p, 0, -4, LBL_W, mkFishLabel, "text")
    mkFish(p, COL_R, 0, after)

    -- ROW 2: the two-button toggle (left). All three panels show the SAME flag (SBFDB.requireTwoButtons) — one
    -- setting, not three — so refreshPanel re-ticks this checkbox from the flag whenever any panel flips it or
    -- you switch panels. (Capturing the checkbox is what lets the others mirror the change.)
    local twoChk = labeledCheck(p, 0, -30,
      "使用独立" .. (kind == "mouse" and "鼠标键" or "按键") .. "拾取",
      function() return SBFDB.requireTwoButtons end,
      function(v)
        SBFDB.requireTwoButtons = v and true or nil
        -- the loot requirement just changed — recompute the ACTIVE input mode (a loot button may now be
        -- required, or no longer required), which also re-syncs the Settings ticks via syncSettingsLootUI.
        local rc = panelRecompute[SBFDB.welcomeInput or "keyboard"]
        if rc then rc() else syncSettingsLootUI() end
        if SBF.Apply then SBF.Apply() end
        -- the OTHER panels' checkboxes mirror the same flag — re-sync them all
        for _, r in pairs(panelRefresh) do r() end
      end,
      "双键模式", "开启：钓鱼键只负责抛竿，按第二个键拾取。关闭：单键同时完成抛竿与拾取。")

    -- ROW 3: loot label (left) + loot bind button (right) — shown only when two-button is on
    local lootLbl = para(p, 0, -62, LBL_W, mkLootLabel, "textDim")
    local lootCtrl = mkLoot(p, COL_R, -58, after)

    local function refreshPanel()
      local on = SBFDB.requireTwoButtons and true or false
      twoChk:SetChecked(on)                 -- mirror the shared flag (panels share ONE two-button setting)
      if lootLbl then lootLbl:SetShown(on) end
      if lootCtrl then lootCtrl:SetShown(on) end
    end
    refreshPanel()

    panels[kind] = p
    panelRefresh[kind] = refreshPanel
    return p
  end

  -- Keyboard panel: fishing KEY + INTERACTTARGET loot bind. The keyboard is always available, so there is
  -- nothing to auto-enable — `after` is nil.
  buildInputPanel("keyboard",
    nil,
    "绑定钓鱼按键",
    function(p, px, py, after) return ns.MakeNativeBindButton(p, px, py, SBF.FISHING_CMD, 130, after, "key") end,
    "拾取 / 交互按键",
    function(p, px, py, after) return ns.MakeNativeBindButton(p, px, py, "INTERACTTARGET", 130, after, "key") end)

  -- Mouse panel: fishing/loot MOUSE buttons. recomputeMouse enables mouse mode IFF every required button is
  -- set (fishing always; loot only in two-button mode) and unticks it otherwise — fired by BOTH widgets.
  buildInputPanel("mouse",
    recomputeMouse,
    "钓鱼鼠标按键",
    function(p, px, py, after) return ns.MakeMouseButton(p, px, py, "fishButton", 130, false, after) end,
    "拾取鼠标按键",
    function(p, px, py, after) return ns.MakeMouseButton(p, px, py, "lootButton", 130, false, after) end)

  -- Controller panel: fishing/loot PAD buttons (both on bindsCtrl). recomputeController enables gamepad IFF
  -- every required button is set (fishing always; loot only in two-button mode), else unticks — both widgets.
  buildInputPanel("controller",
    recomputeController,
    "钓鱼手柄按钮",
    function(p, px, py, after) return ns.MakeNativeBindButton(p, px, py, SBF.FISHING_CMD, 130, after, "pad") end,
    "拾取手柄按钮",
    function(p, px, py, after) return ns.MakeNativeBindButton(p, px, py, "INTERACTTARGET", 130, after, "pad") end)

  -- show the active panel + tint the selected segment button (bold gold label = active)
  applyInput = function(which)
    if not panels[which] then which = "keyboard"; SBFDB.welcomeInput = "keyboard" end
    for k, p in pairs(panels) do p:SetShown(k == which) end
    for k, b in pairs(selButtons) do
      local active = (k == which)
      b:SetNormalFontObject(active and "GameFontNormal" or "GameFontDisable")
    end
    -- re-sync the now-active panel's loot-bind row visibility against the shared two-button flag
    if panelRefresh[which] then panelRefresh[which]() end
  end
  applyInput(SBFDB.welcomeInput)

  -- advance the cursor past the WHOLE container (not just the shown panel) so combat/heal can't overlap
  y = y - PANEL_H - 4

  -- 4) combat --------------------------------------------------------------------
  header(body, PAD, y, W, "战斗动作  |cff9aa0aa(可选项)|r"); y = y - 26
  para(body, PAD, y, W, SBF.CLASSIC_GEAR
    and "战斗默认使用自动攻击（猎人自动射击）。可拖入您自己的技能宏。"
    or "战斗默认使用单键战斗助手。可拖入您自己的技能宏进行覆盖。", "textDim"); y = y - 38
  -- the REAL action-slot widget; SBF.SlotDef("combat") routes to the PER-CHARACTER combat config
  ns.MakeItemButton(body, PAD, y, SBF.SlotDef("combat"), nil, "combat")
  y = y - (ICON + 12)

  -- 5) heal ----------------------------------------------------------------------
  header(body, PAD, y, W, "治疗动作  |cff9aa0aa(可选项)|r"); y = y - 26
  para(body, PAD, y, W, "默认无 - 可在此拖入您自己的治疗宏/法术/物品。", "textDim"); y = y - 38
  ns.MakeItemButton(body, PAD, y, SBF.SlotDef("heal"), nil, "heal")
  y = y - (ICON + 16)

  -- Sign-off instead of more setup. Advanced mode stays ON by default (SBFDB.advancedMode ~= false); the
  -- Settings checkbox still toggles it — it's just not surfaced on this welcome panel anymore. The fishing
  -- skill loads itself once you open your Fishing Journal, so there's nothing to click here either.
  header(body, PAD, y, W, "来自渔协的备忘录"); y = y - 26
  para(body, PAD, y, W,
    "一切准备就绪！枯燥的配置已搞定，快去尽情享受钓鱼的乐趣吧！让水里的鱼儿见识见识谁才是老大！祝竿竿中大鱼，盆满钵满！\n\n- 渔协管理团队",
    "textDim"); y = y - 78

  -- size the scroll child to the laid-out content (a little tail so the last line isn't flush to the edge)
  body:SetHeight(-y + 12)

  -- keep the input selector + two-button rows honest if the window is reopened later
  f._refresh = function()
    applyInput(SBFDB.welcomeInput or "keyboard")   -- re-show the active panel + re-sync its two-button visibility
  end

  -- ---- footer (fixed band under the scroll frame) -----------------------------
  local footer = CreateFrame("Frame", nil, content)
  footer:SetPoint("BOTTOMLEFT", 12, 8); footer:SetPoint("BOTTOMRIGHT", -12, 8); footer:SetHeight(58)

  -- "不再显示此向导" persists to SBFDB.welcomeHide (the auto-pop reads it).
  local hideChk = labeledCheck(footer, 0, -2,
    "不再显示此向导",
    function() return welcomeHidden() end,
    function(v) setWelcomeHidden(v) end,
    "不再显示此向导", "登录时不再弹出此欢迎向导。随时可在聊天框输入 /sbf welcome 重新打开。")
  hideChk:ClearAllPoints(); hideChk:SetPoint("TOPLEFT", footer, "TOPLEFT", 0, -2)

  -- Open Settings (jumps to the full options window)
  local openBtn = CreateFrame("Button", nil, footer, "UIPanelButtonTemplate")
  openBtn:SetSize(120, 24); openBtn:SetPoint("BOTTOMLEFT", footer, "BOTTOMLEFT", 0, 0)
  openBtn:SetText("打开设置"); Theme.Button(openBtn)
  openBtn:SetScript("OnClick", function() if SBF.ShowOptions then SBF.ShowOptions() end end)

  -- Website (community link)
  local webBtn = CreateFrame("Button", nil, footer, "UIPanelButtonTemplate")
  webBtn:SetSize(90, 24); webBtn:SetPoint("LEFT", openBtn, "RIGHT", 8, 0)
  webBtn:SetText("访问网站"); Theme.Button(webBtn)
  webBtn:SetScript("OnClick", function() SBF.ShowWebsite() end)

  -- Start fishing (close)
  local startBtn = CreateFrame("Button", nil, footer, "UIPanelButtonTemplate")
  startBtn:SetSize(120, 24); startBtn:SetPoint("BOTTOMRIGHT", footer, "BOTTOMRIGHT", 0, 0)
  startBtn:SetText("开始钓鱼"); Theme.Button(startBtn)
  startBtn:SetScript("OnClick", function() f:Hide() end)

  return f
end

-- ---- public API --------------------------------------------------------------
-- Show the website link. WoW addons can't open a browser, so present the URL in a copyable popup.
function SBF.ShowWebsite()
  StaticPopupDialogs["SBF_WEBSITE"] = StaticPopupDialogs["SBF_WEBSITE"] or {
    text = "|cff45c4a0SBF|r\n\nCopy this link (Ctrl+C):",
    button1 = CLOSE or "Close",
    hasEditBox = true, editBoxWidth = 280,
    OnShow = function(self)
      local eb = self.editBox or (self.GetEditBox and self:GetEditBox())
      if eb then eb:SetText(WEBSITE_URL); eb:HighlightText(); eb:SetFocus() end
    end,
    EditBoxOnEscapePressed = function(self) self:GetParent():Hide() end,
    timeout = 0, whileDead = true, hideOnEscape = true, preferredIndex = 3,
  }
  StaticPopup_Show("SBF_WEBSITE")
end

function SBF.ShowWelcome()
  if not welcome then build() end
  if welcome._refresh then welcome._refresh() end
  welcome:Show(); welcome:Raise()
end

-- combat-safe-windows helpers (Core's regen watcher hides the Welcome in combat since it blocks the screen).
function SBF.WelcomeShown() return welcome and welcome:IsShown() and true or false end
function SBF.HideWelcome() if welcome then welcome:Hide() end end

-- First-run auto-pop: on login, show the welcome unless the user has dismissed it. Own event frame
-- (PLAYER_LOGIN) so it can't double-fire with Core's handler. Deferred a tick so Options/profile state
-- (SBF.working etc.) is ready when the pole/scope widgets read it.
local trigger = CreateFrame("Frame")
trigger:RegisterEvent("PLAYER_LOGIN")
trigger:SetScript("OnEvent", function()
  if welcomeHidden() then return end
  C_Timer.After(0.5, function()
    if welcomeHidden() then return end   -- re-check (could be set during load)
    SBF.ShowWelcome()
  end)
end)
