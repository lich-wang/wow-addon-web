-- ============================================================================
-- 1. Lua 5.1 兼容补丁
-- ============================================================================
unpack = table.unpack
loadstring = load
table.getn = function(t) return #t end
table.foreach = function(t, f) for k, v in pairs(t) do local r = f(k, v); if r ~= nil then return r end end end
table.foreachi = function(t, f) for i, v in ipairs(t) do local r = f(i, v); if r ~= nil then return r end end end
string.gfind = string.gmatch
math.mod = math.fmod

tinsert = table.insert
tremove = table.remove
sort = table.sort
strmatch = string.match
strfind = string.find
strsub = string.sub
strlen = string.len
strlower = string.lower
strupper = string.upper
gsub = string.gsub
format = string.format

bit = bit or {
  band = function(a, b) return (a or 0) & (b or 0) end,
  bor = function(a, b) return (a or 0) | (b or 0) end,
  bxor = function(a, b) return (a or 0) ~ (b or 0) end,
  bnot = function(a) return ~(a or 0) end,
  lshift = function(a, n) return (a or 0) << (n or 0) end,
  rshift = function(a, n) return (a or 0) >> (n or 0) end,
  arshift = function(a, n) return (a or 0) >> (n or 0) end,
}
bit32 = bit

function wipe(t)
  if type(t) ~= "table" then return t end
  for k in pairs(t) do t[k] = nil end
  return t
end

function strtrim(s)
  if type(s) ~= "string" then return "" end
  return (s:gsub("^%s*(.-)%s*$", "%1"))
end

function strsplit(sep, str, pieces)
  if type(str) ~= "string" then return "" end
  sep = sep or "%s"
  local res = {}
  local pattern = string.format("([^%s]+)", sep)
  local count = 0
  for part in string.gmatch(str, pattern) do
    count = count + 1
    res[count] = part
    if pieces and count >= pieces then break end
  end
  return table.unpack(res)
end

function getglobal(name) return _G[name] end
function setglobal(name, val) _G[name] = val end

function hooksecurefunc(tblOrName, nameOrFn, fnOpt)
  local tbl, name, fn
  if type(tblOrName) == "string" then
    tbl = _G
    name = tblOrName
    fn = nameOrFn
  else
    tbl = tblOrName
    name = nameOrFn
    fn = fnOpt
  end
  if type(tbl) ~= "table" or type(fn) ~= "function" then return end
  local orig = tbl[name]
  tbl[name] = function(...)
    local results = type(orig) == "function" and { orig(...) } or {}
    fn(...)
    return table.unpack(results)
  end
end

function date(fmt, t)
  return __WOW_BRIDGE__:luaDate(fmt or "%Y-%m-%d %H:%M:%S", t)
end

function time()
  return __WOW_BRIDGE__:luaTime()
end

function GetTime()
  return __WOW_BRIDGE__:getTime()
end

-- ============================================================================
-- 2. 内部注册表与事件/脚本分发
-- ============================================================================
local __FRAMES_BY_ID__ = {}
local __SCRIPTS__ = {}
local __HOOKS__ = {}
local __EVENTS__ = {}
local __TIMERS__ = {}
local __NEXT_TIMER_ID__ = 1

function __WOW_DISPATCH_SCRIPT__(frameId, scriptName, a1, a2, a3, a4)
  local frame = __FRAMES_BY_ID__[frameId]
  if not frame then return end
  local scripts = __SCRIPTS__[frameId]
  if scripts and scripts[scriptName] then
    local ok, err = pcall(scripts[scriptName], frame, a1, a2, a3, a4)
    if not ok then
      __WOW_BRIDGE__:reportLuaError(tostring(err), scriptName)
    end
  end
  local hooks = __HOOKS__[frameId]
  if hooks and hooks[scriptName] then
    for _, hfn in ipairs(hooks[scriptName]) do
      local ok, err = pcall(hfn, frame, a1, a2, a3, a4)
      if not ok then
        __WOW_BRIDGE__:reportLuaError(tostring(err), "Hook:" .. scriptName)
      end
    end
  end
end

function __WOW_DISPATCH_EVENT__(eventName, a1, a2, a3, a4)
  for frameId, evMap in pairs(__EVENTS__) do
    if evMap[eventName] or evMap["*"] then
      local frame = __FRAMES_BY_ID__[frameId]
      local scripts = __SCRIPTS__[frameId]
      if frame and scripts and scripts["OnEvent"] then
        _G.event = eventName
        _G.arg1, _G.arg2, _G.arg3, _G.arg4 = a1, a2, a3, a4
        local ok, err = pcall(scripts["OnEvent"], frame, eventName, a1, a2, a3, a4)
        if not ok then
          __WOW_BRIDGE__:reportLuaError(tostring(err), "OnEvent:" .. tostring(eventName))
        end
      end
    end
  end
end

function __WOW_RUN_TIMER__(timerId)
  local fn = __TIMERS__[timerId]
  if fn then
    __TIMERS__[timerId] = nil
    local ok, err = pcall(fn)
    if not ok then
      __WOW_BRIDGE__:reportLuaError(tostring(err), "C_Timer")
    end
  end
end

C_Timer = {
  After = function(delay, fn)
    if type(fn) ~= "function" then return end
    local id = __NEXT_TIMER_ID__
    __NEXT_TIMER_ID__ = id + 1
    __TIMERS__[id] = fn
    __WOW_BRIDGE__:scheduleTimer(id, tonumber(delay) or 0)
  end,
  NewTimer = function(delay, fn)
    C_Timer.After(delay, fn)
    return { Cancel = function() end }
  end,
  NewTicker = function()
    return { Cancel = function() end }
  end,
}

-- ============================================================================
-- 3. FontString & Texture 对象
-- ============================================================================
local FontStringMethods = {}
local FontStringMT = { __index = FontStringMethods }

function FontStringMethods:SetPoint(point, relTo, relPoint, x, y)
  if type(relTo) == "number" then
    y = relPoint; x = relTo; relPoint = point; relTo = self._parent
  elseif type(relPoint) == "number" then
    y = x; x = relPoint; relPoint = point
  end
  local relId = type(relTo) == "table" and relTo._id or (type(relTo) == "string" and relTo or self._parentId)
  __WOW_BRIDGE__:fsSetPoint(self._id, tostring(point or "TOPLEFT"), relId, tostring(relPoint or point or "TOPLEFT"), tonumber(x) or 0, tonumber(y) or 0)
end
function FontStringMethods:ClearAllPoints() __WOW_BRIDGE__:fsClearAllPoints(self._id) end
function FontStringMethods:SetAllPoints(target)
  local relId = type(target) == "table" and target._id or self._parentId
  __WOW_BRIDGE__:fsClearAllPoints(self._id)
  __WOW_BRIDGE__:fsSetPoint(self._id, "TOPLEFT", relId, "TOPLEFT", 0, 0)
  __WOW_BRIDGE__:fsSetPoint(self._id, "BOTTOMRIGHT", relId, "BOTTOMRIGHT", 0, 0)
end
function FontStringMethods:SetText(text)
  self._text = text == nil and "" or tostring(text)
  __WOW_BRIDGE__:fsSetText(self._id, self._text)
end
function FontStringMethods:GetText() return self._text or "" end
function FontStringMethods:SetTextColor(r, g, b, a) __WOW_BRIDGE__:fsSetColor(self._id, tonumber(r) or 1, tonumber(g) or 1, tonumber(b) or 1, tonumber(a) or 1) end
function FontStringMethods:SetFont() end
function FontStringMethods:SetFontObject(obj) __WOW_BRIDGE__:fsSetFontObject(self._id, tostring(obj or "GameFontHighlight")) end
function FontStringMethods:SetJustifyH(j) __WOW_BRIDGE__:fsSetJustifyH(self._id, tostring(j or "LEFT")) end
function FontStringMethods:SetJustifyV(j) __WOW_BRIDGE__:fsSetJustifyV(self._id, tostring(j or "MIDDLE")) end
function FontStringMethods:SetWordWrap(w) __WOW_BRIDGE__:fsSetWordWrap(self._id, w ~= false) end
function FontStringMethods:SetNonSpaceWrap() end
function FontStringMethods:SetSpacing(s) __WOW_BRIDGE__:fsSetSpacing(self._id, tonumber(s) or 0) end
function FontStringMethods:SetWidth(w) __WOW_BRIDGE__:fsSetWidth(self._id, tonumber(w) or 0) end
function FontStringMethods:SetHeight(h) __WOW_BRIDGE__:fsSetHeight(self._id, tonumber(h) or 0) end
function FontStringMethods:SetSize(w, h) self:SetWidth(w); self:SetHeight(h) end
function FontStringMethods:GetStringWidth() return __WOW_BRIDGE__:fsGetStringWidth(self._id) end
function FontStringMethods:GetStringHeight() return __WOW_BRIDGE__:fsGetStringHeight(self._id) end
function FontStringMethods:GetWidth() return self:GetStringWidth() end
function FontStringMethods:GetHeight() return self:GetStringHeight() end
function FontStringMethods:Show() __WOW_BRIDGE__:fsShow(self._id, true) end
function FontStringMethods:Hide() __WOW_BRIDGE__:fsShow(self._id, false) end
function FontStringMethods:SetShown(s) if s then self:Show() else self:Hide() end end
function FontStringMethods:SetAlpha(a) __WOW_BRIDGE__:fsSetAlpha(self._id, tonumber(a) or 1) end
function FontStringMethods:SetHyperlinksEnabled(e) __WOW_BRIDGE__:fsSetHyperlinksEnabled(self._id, e ~= false) end
function FontStringMethods:EnableHyperlinks() self:SetHyperlinksEnabled(true) end
function FontStringMethods:SetShadowOffset() end
function FontStringMethods:SetShadowColor() end

local TextureMethods = {}
local TextureMT = { __index = TextureMethods }

function TextureMethods:SetPoint(point, relTo, relPoint, x, y)
  if type(relTo) == "number" then
    y = relPoint; x = relTo; relPoint = point; relTo = self._parent
  elseif type(relPoint) == "number" then
    y = x; x = relPoint; relPoint = point
  end
  local relId = type(relTo) == "table" and relTo._id or (type(relTo) == "string" and relTo or self._parentId)
  __WOW_BRIDGE__:texSetPoint(self._id, tostring(point or "TOPLEFT"), relId, tostring(relPoint or point or "TOPLEFT"), tonumber(x) or 0, tonumber(y) or 0)
end
function TextureMethods:ClearAllPoints() __WOW_BRIDGE__:texClearAllPoints(self._id) end
function TextureMethods:SetAllPoints(target)
  local relId = type(target) == "table" and target._id or self._parentId
  __WOW_BRIDGE__:texClearAllPoints(self._id)
  __WOW_BRIDGE__:texSetPoint(self._id, "TOPLEFT", relId, "TOPLEFT", 0, 0)
  __WOW_BRIDGE__:texSetPoint(self._id, "BOTTOMRIGHT", relId, "BOTTOMRIGHT", 0, 0)
end
function TextureMethods:SetTexture(path) __WOW_BRIDGE__:texSetTexture(self._id, path and tostring(path) or nil) end
function TextureMethods:SetColorTexture(r, g, b, a) __WOW_BRIDGE__:texSetColorTexture(self._id, tonumber(r) or 1, tonumber(g) or 1, tonumber(b) or 1, tonumber(a) or 1) end
function TextureMethods:SetVertexColor(r, g, b, a) __WOW_BRIDGE__:texSetVertexColor(self._id, tonumber(r) or 1, tonumber(g) or 1, tonumber(b) or 1, tonumber(a) or 1) end
function TextureMethods:SetTexCoord() end
function TextureMethods:SetBlendMode() end
function TextureMethods:SetWidth(w) __WOW_BRIDGE__:texSetSize(self._id, tonumber(w) or 0, nil) end
function TextureMethods:SetHeight(h) __WOW_BRIDGE__:texSetSize(self._id, nil, tonumber(h) or 0) end
function TextureMethods:SetSize(w, h) __WOW_BRIDGE__:texSetSize(self._id, tonumber(w) or 0, tonumber(h) or 0) end
function TextureMethods:Show() __WOW_BRIDGE__:texShow(self._id, true) end
function TextureMethods:Hide() __WOW_BRIDGE__:texShow(self._id, false) end
function TextureMethods:SetShown(s) if s then self:Show() else self:Hide() end end
function TextureMethods:SetAlpha(a) __WOW_BRIDGE__:texSetAlpha(self._id, tonumber(a) or 1) end

-- ============================================================================
-- 4. Frame 对象及子类方法
-- ============================================================================
local FrameMethods = {}
local FrameMT = { __index = FrameMethods }

function FrameMethods:GetName() return self._name end
function FrameMethods:GetParent() return self._parent end
function FrameMethods:GetObjectType() return self._type end
function FrameMethods:IsObjectType(t) return self._type == t or t == "Frame" end
function FrameMethods:SetSize(w, h) __WOW_BRIDGE__:frameSetSize(self._id, tonumber(w) or 0, tonumber(h) or 0) end
function FrameMethods:SetWidth(w) __WOW_BRIDGE__:frameSetWidth(self._id, tonumber(w) or 0) end
function FrameMethods:SetHeight(h) __WOW_BRIDGE__:frameSetHeight(self._id, tonumber(h) or 0) end
function FrameMethods:GetWidth() return __WOW_BRIDGE__:frameGetWidth(self._id) end
function FrameMethods:GetHeight() return __WOW_BRIDGE__:frameGetHeight(self._id) end
function FrameMethods:GetSize() return self:GetWidth(), self:GetHeight() end
function FrameMethods:ClearAllPoints() __WOW_BRIDGE__:frameClearAllPoints(self._id) end
function FrameMethods:SetPoint(point, relTo, relPoint, x, y)
  if type(relTo) == "number" then
    y = relPoint; x = relTo; relPoint = point; relTo = self._parent
  elseif type(relPoint) == "number" then
    y = x; x = relPoint; relPoint = point
  end
  local relId = type(relTo) == "table" and relTo._id or (type(relTo) == "string" and relTo or self._parentId)
  __WOW_BRIDGE__:frameSetPoint(self._id, tostring(point or "CENTER"), relId, tostring(relPoint or point or "CENTER"), tonumber(x) or 0, tonumber(y) or 0)
end
function FrameMethods:SetAllPoints(target)
  local relId = type(target) == "table" and target._id or self._parentId
  __WOW_BRIDGE__:frameClearAllPoints(self._id)
  __WOW_BRIDGE__:frameSetPoint(self._id, "TOPLEFT", relId, "TOPLEFT", 0, 0)
  __WOW_BRIDGE__:frameSetPoint(self._id, "BOTTOMRIGHT", relId, "BOTTOMRIGHT", 0, 0)
end
function FrameMethods:GetNumPoints() return 1 end
function FrameMethods:GetPoint() return "CENTER", self._parent, "CENTER", 0, 0 end

function FrameMethods:Show()
  local wasShown = self:IsShown()
  __WOW_BRIDGE__:frameShow(self._id, true)
  if not wasShown then __WOW_DISPATCH_SCRIPT__(self._id, "OnShow") end
end
function FrameMethods:Hide()
  local wasShown = self:IsShown()
  __WOW_BRIDGE__:frameShow(self._id, false)
  if wasShown then __WOW_DISPATCH_SCRIPT__(self._id, "OnHide") end
end
function FrameMethods:SetShown(s) if s then self:Show() else self:Hide() end end
function FrameMethods:IsShown() return __WOW_BRIDGE__:frameIsShown(self._id) end
function FrameMethods:IsVisible() return __WOW_BRIDGE__:frameIsShown(self._id) end
function FrameMethods:SetAlpha(a) __WOW_BRIDGE__:frameSetAlpha(self._id, tonumber(a) or 1) end
function FrameMethods:GetAlpha() return __WOW_BRIDGE__:frameGetAlpha(self._id) end
function FrameMethods:SetScale(s) __WOW_BRIDGE__:frameSetScale(self._id, tonumber(s) or 1) end
function FrameMethods:GetScale() return 1 end
function FrameMethods:GetEffectiveScale() return 1 end
function FrameMethods:SetFrameStrata(s) __WOW_BRIDGE__:frameSetStrata(self._id, tostring(s or "MEDIUM")) end
function FrameMethods:GetFrameStrata() return "MEDIUM" end
function FrameMethods:SetFrameLevel(l) __WOW_BRIDGE__:frameSetLevel(self._id, tonumber(l) or 1) end
function FrameMethods:GetFrameLevel() return __WOW_BRIDGE__:frameGetLevel(self._id) end
function FrameMethods:SetToplevel() end
function FrameMethods:Raise() end
function FrameMethods:EnableMouse(e) __WOW_BRIDGE__:frameSetEnableMouse(self._id, e ~= false) end
function FrameMethods:SetMovable(m) __WOW_BRIDGE__:frameSetMovable(self._id, m ~= false) end
function FrameMethods:RegisterForDrag() end
function FrameMethods:RegisterForClicks() end
function FrameMethods:SetClampedToScreen() end
function FrameMethods:StartMoving() end
function FrameMethods:StopMovingOrSizing() end
function FrameMethods:SetHyperlinksEnabled(e) __WOW_BRIDGE__:frameSetHyperlinksEnabled(self._id, e ~= false) end
function FrameMethods:Enable() __WOW_BRIDGE__:frameSetEnabled(self._id, true) end
function FrameMethods:Disable() __WOW_BRIDGE__:frameSetEnabled(self._id, false) end
function FrameMethods:SetEnabled(e) __WOW_BRIDGE__:frameSetEnabled(self._id, e ~= false) end
function FrameMethods:IsEnabled() return __WOW_BRIDGE__:frameIsEnabled(self._id) end

function FrameMethods:SetBackdrop(tbl)
  if type(tbl) ~= "table" then
    __WOW_BRIDGE__:frameSetBackdrop(self._id, nil)
    return
  end
  local ins = tbl.insets or {}
  __WOW_BRIDGE__:frameSetBackdrop(self._id, {
    bgFile = tbl.bgFile,
    edgeFile = tbl.edgeFile,
    tile = tbl.tile,
    tileSize = tbl.tileSize,
    edgeSize = tbl.edgeSize,
    left = ins.left or 0,
    right = ins.right or 0,
    top = ins.top or 0,
    bottom = ins.bottom or 0,
  })
end
function FrameMethods:SetBackdropColor(r, g, b, a) __WOW_BRIDGE__:frameSetBackdropColor(self._id, tonumber(r) or 0, tonumber(g) or 0, tonumber(b) or 0, tonumber(a) or 1) end
function FrameMethods:SetBackdropBorderColor(r, g, b, a) __WOW_BRIDGE__:frameSetBackdropBorderColor(self._id, tonumber(r) or 1, tonumber(g) or 1, tonumber(b) or 1, tonumber(a) or 1) end

function FrameMethods:CreateFontString(name, layer, inherits)
  local id = __WOW_BRIDGE__:createFontString(self._id, name and tostring(name) or nil, tostring(layer or "ARTWORK"), tostring(inherits or "GameFontHighlight"))
  local fs = setmetatable({ _id = id, _parent = self, _parentId = self._id, _text = "" }, FontStringMT)
  if name and name ~= "" then _G[name] = fs end
  return fs
end

function FrameMethods:CreateTexture(name, layer)
  local id = __WOW_BRIDGE__:createTexture(self._id, name and tostring(name) or nil, tostring(layer or "ARTWORK"))
  local tex = setmetatable({ _id = id, _parent = self, _parentId = self._id }, TextureMT)
  if name and name ~= "" then _G[name] = tex end
  return tex
end

function FrameMethods:SetText(txt)
  self._text = txt == nil and "" or tostring(txt)
  __WOW_BRIDGE__:frameSetText(self._id, self._text)
end
function FrameMethods:GetText() return __WOW_BRIDGE__:frameGetText(self._id) or self._text or "" end
function FrameMethods:GetTextWidth() return __WOW_BRIDGE__:frameGetTextWidth(self._id) end
function FrameMethods:GetFontString()
  if not self._btnFontString then
    self._btnFontString = self:CreateFontString(nil, "OVERLAY", "GameFontNormal")
    self._btnFontString:SetAllPoints(self)
  end
  return self._btnFontString
end
function FrameMethods:SetNormalFontObject() end
function FrameMethods:SetHighlightFontObject() end
function FrameMethods:SetDisabledFontObject() end
function FrameMethods:SetNormalTexture() end
function FrameMethods:SetPushedTexture() end
function FrameMethods:SetHighlightTexture() end
function FrameMethods:SetDisabledTexture() end
function FrameMethods:SetCheckedTexture() end
function FrameMethods:LockHighlight() end
function FrameMethods:UnlockHighlight() end
function FrameMethods:SetChecked(c) __WOW_BRIDGE__:frameSetChecked(self._id, c and true or false) end
function FrameMethods:GetChecked() return __WOW_BRIDGE__:frameGetChecked(self._id) end
function FrameMethods:SetAutoFocus() end
function FrameMethods:SetMultiLine() end
function FrameMethods:SetMaxLetters() end
function FrameMethods:SetNumeric() end
function FrameMethods:SetFontObject() end
function FrameMethods:SetFont() end
function FrameMethods:SetTextInsets() end
function FrameMethods:SetCursorPosition() end
function FrameMethods:HighlightText() end
function FrameMethods:SetFocus() end
function FrameMethods:ClearFocus() end
function FrameMethods:Insert(str) self:SetText(self:GetText() .. tostring(str or "")) end

function FrameMethods:SetScrollChild(child)
  if type(child) == "table" and child._id then
    __WOW_BRIDGE__:frameSetScrollChild(self._id, child._id)
  end
end
function FrameMethods:SetVerticalScroll(v) __WOW_BRIDGE__:frameSetVerticalScroll(self._id, tonumber(v) or 0) end
function FrameMethods:GetVerticalScroll() return __WOW_BRIDGE__:frameGetVerticalScroll(self._id) end
function FrameMethods:GetVerticalScrollRange() return __WOW_BRIDGE__:frameGetVerticalScrollRange(self._id) end
function FrameMethods:SetHorizontalScroll() end
function FrameMethods:UpdateScrollChildRect() end
function FrameMethods:SetMinMaxValues(mn, mx) __WOW_BRIDGE__:frameSetMinMax(self._id, tonumber(mn) or 0, tonumber(mx) or 100) end
function FrameMethods:SetValue(v) __WOW_BRIDGE__:frameSetValue(self._id, tonumber(v) or 0) end
function FrameMethods:GetValue() return __WOW_BRIDGE__:frameGetValue(self._id) end
function FrameMethods:SetValueStep() end
function FrameMethods:SetOrientation() end
function FrameMethods:SetStatusBarTexture() end
function FrameMethods:SetStatusBarColor() end

function FrameMethods:SetScript(name, fn)
  __SCRIPTS__[self._id] = __SCRIPTS__[self._id] or {}
  __SCRIPTS__[self._id][name] = fn
end
function FrameMethods:GetScript(name) return __SCRIPTS__[self._id] and __SCRIPTS__[self._id][name] or nil end
function FrameMethods:HookScript(name, fn)
  if type(fn) ~= "function" then return end
  __HOOKS__[self._id] = __HOOKS__[self._id] or {}
  __HOOKS__[self._id][name] = __HOOKS__[self._id][name] or {}
  table.insert(__HOOKS__[self._id][name], fn)
end
function FrameMethods:RegisterEvent(ev)
  __EVENTS__[self._id] = __EVENTS__[self._id] or {}
  __EVENTS__[self._id][ev] = true
end
function FrameMethods:UnregisterEvent(ev)
  if __EVENTS__[self._id] then __EVENTS__[self._id][ev] = nil end
end
function FrameMethods:RegisterAllEvents()
  __EVENTS__[self._id] = __EVENTS__[self._id] or {}
  __EVENTS__[self._id]["*"] = true
end
function FrameMethods:AddMessage(msg, r, g, b)
  __WOW_BRIDGE__:addChatMessage(tostring(msg or ""), tonumber(r) or 1, tonumber(g) or 1, tonumber(b) or 1)
end

function CreateFrame(frameType, name, parent, template)
  local parentId = type(parent) == "table" and parent._id or nil
  local id = __WOW_BRIDGE__:createFrame(tostring(frameType or "Frame"), name and tostring(name) or nil, parentId, template and tostring(template) or nil)
  local f = setmetatable({
    _id = id,
    _name = name,
    _type = frameType or "Frame",
    _parent = parent or UIParent,
    _parentId = parentId or (UIParent and UIParent._id or nil),
    _text = "",
  }, FrameMT)
  __FRAMES_BY_ID__[id] = f
  if name and name ~= "" then _G[name] = f end
  if template == "UIPanelScrollFrameTemplate" and name then
    f.ScrollBar = CreateFrame("Slider", name .. "ScrollBar", f)
  end
  return f
end

BackdropTemplateMixin = {}
UISpecialFrames = {}
UIParent = CreateFrame("Frame", "UIParent", nil)
UIParent:SetSize(1280, 720)
UIParent:Show()
WorldFrame = UIParent
Minimap = CreateFrame("Frame", "Minimap", UIParent)
Minimap:SetSize(140, 140)
Minimap:SetPoint("TOPRIGHT", UIParent, "TOPRIGHT", -16, -16)
Minimap:Show()

DEFAULT_CHAT_FRAME = CreateFrame("MessageFrame", "DEFAULT_CHAT_FRAME", UIParent)
ChatFrame1 = DEFAULT_CHAT_FRAME
ChatFrame1EditBox = CreateFrame("EditBox", "ChatFrame1EditBox", UIParent)
ChatFrame1EditBox:Hide()

WorldMapFrame = CreateFrame("Frame", "WorldMapFrame", UIParent)
WorldMapFrame:SetSize(700, 480)
WorldMapFrame:Hide()
WorldMapFrame.ScrollContainer = { Child = CreateFrame("Frame", "WorldMapScrollChild", WorldMapFrame) }
function WorldMapFrame:SetMapID(id) self._mapID = id end
function WorldMapFrame:GetMapID() return self._mapID or 1411 end

GameTooltip = CreateFrame("GameTooltip", "GameTooltip", UIParent, "GameTooltipTemplate")
GameTooltip:Hide()
function GameTooltip:SetOwner(owner) __WOW_BRIDGE__:tooltipSetOwner(type(owner) == "table" and owner._id or nil) end
function GameTooltip:ClearLines() __WOW_BRIDGE__:tooltipClearLines() end
function GameTooltip:AddLine(text, r, g, b, wrap) __WOW_BRIDGE__:tooltipAddLine(tostring(text or ""), tonumber(r) or 1, tonumber(g) or 1, tonumber(b) or 1, wrap == true) end
function GameTooltip:AddDoubleLine(l, r, lr, lg, lb) self:AddLine(tostring(l or "") .. "  " .. tostring(r or ""), lr or 1, lg or 1, lb or 1) end
function GameTooltip:SetHyperlink(link) __WOW_BRIDGE__:tooltipSetHyperlink(tostring(link or "")) end
function GameTooltip:SetItemByID(id) __WOW_BRIDGE__:tooltipSetHyperlink("item:" .. tostring(id or 0)) end
function GameTooltip:Show() __WOW_BRIDGE__:tooltipShow(true) end
function GameTooltip:Hide() __WOW_BRIDGE__:tooltipShow(false) end
function GameTooltip:IsShown() return __WOW_BRIDGE__:tooltipIsShown() end

local __DROPDOWN_ITEMS__ = {}
function UIDropDownMenu_CreateInfo() return {} end
function UIDropDownMenu_AddButton(info)
  if type(info) ~= "table" then return end
  table.insert(__DROPDOWN_ITEMS__, info)
  local isChecked = false
  if type(info.checked) == "function" then
    local ok, res = pcall(info.checked)
    isChecked = ok and (res and true or false) or false
  else
    isChecked = info.checked and true or false
  end
  __WOW_BRIDGE__:dropdownAddItem(#__DROPDOWN_ITEMS__, tostring(info.text or ""), isChecked, info.disabled and true or false, info.isTitle and true or false, info.isNotRadio and true or false, info.notCheckable and true or false, info.keepShownOnClick and true or false)
end
function UIDropDownMenu_Initialize(frame, initFunc) if type(frame) == "table" then frame._initFunc = initFunc end end
function ToggleDropDownMenu(level, value, dropDownFrame, anchorName)
  if __WOW_BRIDGE__:dropdownIsOpen() then CloseDropDownMenus(); return end
  __DROPDOWN_ITEMS__ = {}
  __WOW_BRIDGE__:dropdownClear()
  if type(dropDownFrame) == "table" and type(dropDownFrame._initFunc) == "function" then
    local ok, err = pcall(dropDownFrame._initFunc, dropDownFrame, level or 1)
    if not ok then __WOW_BRIDGE__:reportLuaError(tostring(err), "UIDropDownMenu") end
  end
  __WOW_BRIDGE__:dropdownOpen(type(anchorName) == "table" and anchorName._id or nil)
end
function CloseDropDownMenus() __WOW_BRIDGE__:dropdownClose() end

SlashCmdList = {}
hash_SlashCmdList = {}
function __WOW_RUN_SLASH__(cmdText)
  local trimmed = strtrim(cmdText or "")
  if trimmed == "" then return false end
  local cmd, rest = string.match(trimmed, "^(/%S+)%s*(.*)$")
  if not cmd then return false end
  local lowerCmd = string.lower(cmd)
  for prefix, fn in pairs(SlashCmdList) do
    for i = 1, 10 do
      local alias = _G["SLASH_" .. prefix .. i]
      if alias and string.lower(alias) == lowerCmd then
        local ok, err = pcall(fn, rest or "")
        if not ok then __WOW_BRIDGE__:reportLuaError(tostring(err), "SlashCmd:" .. lowerCmd) end
        return true
      end
    end
  end
  return false
end

function GetLocale() return "zhCN" end
function GetBuildInfo() return "3.3.5", "16001", "Nov 2026", 16001 end
function UnitName() return __WOW_BRIDGE__:getCharField("name") end
function UnitLevel() return __WOW_BRIDGE__:getCharField("level") end
function UnitClass()
  local ck = __WOW_BRIDGE__:getCharField("classKey")
  local names = { WARRIOR="战士", PALADIN="圣骑士", HUNTER="猎人", ROGUE="潜行者", PRIEST="牧师", SHAMAN="萨满祭司", MAGE="法师", WARLOCK="术士", DRUID="德鲁伊" }
  return names[ck] or "战士", ck
end
function UnitRace() local rk = __WOW_BRIDGE__:getCharField("raceKey"); return rk or "人类", rk or "Human" end
function UnitFactionGroup() local f = __WOW_BRIDGE__:getCharField("faction"); return f, f == "Horde" and "部落" or "联盟" end
function GetRealZoneText() return __WOW_BRIDGE__:getCharField("zone") end
function GetZoneText() return __WOW_BRIDGE__:getCharField("zone") end
function GetSubZoneText() return "" end
function GetMoney() return __WOW_BRIDGE__:getCharField("gold") * 10000 end
function GetCoinTextureString(copper)
  local c = tonumber(copper) or 0
  return string.format("%dg %ds %dc", math.floor(c / 10000), math.floor((c % 10000) / 100), c % 100)
end

C_QuestLog = {
  IsQuestFlaggedCompleted = function(qid) return __WOW_BRIDGE__:isQuestCompleted(tonumber(qid) or 0) end,
  IsOnQuest = function(qid) return __WOW_BRIDGE__:isQuestActive(tonumber(qid) or 0) end,
}
function IsQuestFlaggedCompleted(qid) return C_QuestLog.IsQuestFlaggedCompleted(qid) end
function GetNumQuestLogEntries() return 0, 0 end
function GetQuestLogTitle() return nil end
function GetQuestLink(qid) return string.format("|cffffff00|Hquest:%d:1|h[任务 #%d]|h|r", tonumber(qid) or 0, tonumber(qid) or 0) end
function GetQuestDifficultyColor() return { r = 1, g = 0.82, b = 0 } end

C_Map = {
  GetBestMapForUnit = function() return 1411 end,
  GetMapInfo = function(id) return { mapID = id, name = __WOW_BRIDGE__:getCharField("zone") } end,
  GetAreaInfo = function(areaId)
    local areas = { [1537] = "铁炉堡", [267] = "希尔斯布莱德丘陵", [796] = "血色修道院", [1519] = "暴风城", [1637] = "奥格瑞玛" }
    return areas[tonumber(areaId) or 0] or ""
  end,
  SetUserWaypoint = function(pt)
    if type(pt) == "table" and pt.position then
      __WOW_BRIDGE__:addWaypoint(__WOW_BRIDGE__:getCharField("zone"), "标记点", (pt.position.x or 0) * 100, (pt.position.y or 0) * 100)
    end
  end,
}
function ToggleWorldMap() WorldMapFrame:Show() end
function SetMapToCurrentZone() end
function GetCurrentMapZone() return 1 end
function GetCurrentMapContinent() return 1 end

function GetItemInfo(item)
  local id = tonumber(item) or tonumber(string.match(tostring(item or ""), "item:(%d+)"))
  if not id then return nil end
  return "物品 #" .. id, string.format("|cff1eff00|Hitem:%d:0:0:0:0:0:0:0|h[物品 #%d]|h|r", id, id), 2, 20, 1, "消耗品", "其他", 20, "", 134400, 100
end
function GetItemIcon() return 134400 end
function GetSpellInfo(spell) return "技能 #" .. tostring(spell or ""), "", 134400 end
function GetNumSkillLines() return __WOW_BRIDGE__:getNumSkills() end
function GetSkillLineInfo(idx) return __WOW_BRIDGE__:getSkillInfo(idx) end
function GetNumTradeSkills() return 0 end
function GetTradeSkillInfo() return nil end
function ExpandTradeSkillSubClass() end

function IsShiftKeyDown() return false end
function IsControlKeyDown() return false end
function IsAltKeyDown() return false end
function IsModifiedClick() return false end
function ChatEdit_InsertLink(link) __WOW_BRIDGE__:addChatMessage("[聊天插入] " .. tostring(link or ""), 1, 0.82, 0); return true end
function ChatEdit_ActivateChat() end
function ChatEdit_GetActiveWindow() return nil end
function SetItemRef(link, text) __WOW_BRIDGE__:addChatMessage("[超链接点击] " .. tostring(text or link or ""), 0.4, 0.8, 1) end

SOUNDKIT = { IG_MAINMENU_OPEN = 850, IG_MAINMENU_CLOSE = 851, IG_MAINMENU_OPTION_CHECKBOX_ON = 856 }
function PlaySound() end
function StaticPopup_Show() end
function UIErrorsFrame_AddMessage(msg) __WOW_BRIDGE__:addChatMessage("[UI错误] " .. tostring(msg or ""), 1, 0.2, 0.2) end
UIErrorsFrame = { AddMessage = function(_, msg) __WOW_BRIDGE__:addChatMessage("[UI错误] " .. tostring(msg or ""), 1, 0.2, 0.2) end }
