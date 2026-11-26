-- ============================================================================
-- WoWF CraftArb · 制造套利引擎
-- 数据源：黑石交易技能（Blackthornes_TS）行情与专业数据库 + 本插件自行采集的原生配方
-- 职责：递归折算材料成本（含中间产物自产）、估算售价/分解收益与净利润
-- 本文件只做数据与计算，不创建任何界面元素；界面在 WoWF.lua 的「制造套利」页
-- ============================================================================

local Arb = {}
WoWF_CraftArb = Arb
WoWFDB = WoWFDB or {}

Arb.VERSION = 1
local harvestVersion = 0

local type, tonumber, tostring, pairs, ipairs, pcall = type, tonumber, tostring, pairs, ipairs, pcall
local floor, ceil, max, min, abs, huge = math.floor, math.ceil, math.max, math.min, math.abs, math.huge
local tinsert, tsort, tconcat, sort = table.insert, table.sort, table.concat, table.sort
local format, lower, find, sub, gsub = string.format, string.lower, string.find, string.sub, string.gsub
local time = time
local Enum = _G.Enum
local C_TradeSkillUI = _G.C_TradeSkillUI
local C_Item = _G.C_Item
local C_GameRules = _G.C_GameRules

local function now()
  local ok, value = pcall(time)
  if ok then return tonumber(value) or 0 end
  return 0
end

local MAX_CRAFT_DEPTH = 4 -- 递归展开中间产物的最大层数（布 → 卷 → 装备 = 2 层）
local DEFAULT_CUT = 0.05 -- 黑石交易技能未提供手续费设置时的兜底值

-- ============================================================================
-- 1. 专业名称、角色身份与专业等级
-- ============================================================================

local PROFESSION_KEYS = {
  ["裁缝"] = "tailoring", tailoring = "tailoring",
  ["附魔"] = "enchanting", enchanting = "enchanting",
  ["锻造"] = "blacksmithing", blacksmithing = "blacksmithing",
  ["工程学"] = "engineering", engineering = "engineering",
  ["炼金术"] = "alchemy", alchemy = "alchemy",
  ["制皮"] = "leatherworking", leatherworking = "leatherworking",
  ["珠宝加工"] = "jewelcrafting", jewelcrafting = "jewelcrafting",
  ["铭文"] = "inscription", inscription = "inscription",
  ["草药学"] = "herbalism", herbalism = "herbalism",
  ["采矿"] = "mining", mining = "mining",
  ["剥皮"] = "skinning", skinning = "skinning",
  ["钓鱼"] = "fishing", fishing = "fishing",
  ["烹饪"] = "cooking", cooking = "cooking",
  ["急救"] = "firstaid", firstaid = "firstaid",
}

Arb.ProfessionNames = {
  tailoring = "裁缝", enchanting = "附魔", blacksmithing = "锻造", engineering = "工程学",
  alchemy = "炼金术", leatherworking = "制皮", jewelcrafting = "珠宝加工", inscription = "铭文",
  herbalism = "草药学", mining = "采矿", skinning = "剥皮", fishing = "钓鱼",
  cooking = "烹饪", firstaid = "急救",
}

local SKILL_LINE_PROFESSIONS = {
  [2937] = "alchemy",        [171] = "alchemy",
  [2938] = "blacksmithing",  [164] = "blacksmithing",
  [2940] = "enchanting",     [333] = "enchanting",
  [2941] = "engineering",    [202] = "engineering",
  [2944] = "herbalism",      [182] = "herbalism",
  [2945] = "leatherworking", [165] = "leatherworking",
  [2946] = "mining",         [186] = "mining",
  [2947] = "skinning",       [393] = "skinning",
  [2948] = "tailoring",      [197] = "tailoring",
  [185] = "cooking",         [129] = "firstaid",
}

local GATHERING = { herbalism = true, mining = true, skinning = true, fishing = true }

---把专业名（中文/英文）或 skillLineID 归一化成稳定的内部 key
---@param name string|nil
---@param skillLineID number|nil
---@return string|nil
function Arb.ProfessionKey(name, skillLineID)
  local line = tonumber(skillLineID)
  if line and SKILL_LINE_PROFESSIONS[line] then return SKILL_LINE_PROFESSIONS[line] end
  if type(name) ~= "string" or name == "" then return nil end
  return PROFESSION_KEYS[name] or PROFESSION_KEYS[lower(name)]
end

---该专业是否属于采集类（采集专业本身不产出可拍卖配方，仅用于说明）
---@param key string|nil
---@return boolean
function Arb.IsGathering(key)
  return GATHERING[key] == true
end

-- 角色身份规则：无限服按「规则集」，正式服/怀旧服按服务器名
local RULESET_LABELS = {
  pvp = "PvP", pve = "PvE", normal = "PvE", rp = "RP", rppvp = "RP-PvP",
  hardcore = "Hardcore", ["普通"] = "PvE", ["角色扮演"] = "RP",
  ["角色扮演pvp"] = "RP-PvP", ["专家模式"] = "Hardcore", ["硬核"] = "Hardcore",
}

local function liveRuleset()
  local rules = Enum and Enum.GameRule
  local active = C_GameRules and C_GameRules.IsGameRuleActive
  if rules and active then
    local function on(flag)
      if not flag then return nil end
      local ok, value = pcall(active, flag)
      if ok then return value end
    end
    local hardcore, pvp, rp = on(rules.HardcoreRuleset), on(rules.PvPRuleset), on(rules.RPRuleset)
    if hardcore == true then return "Hardcore" end
    if rp == true and pvp == true then return "RP-PvP" end
    if rp == true then return "RP" end
    if pvp == true then return "PvP" end
    if hardcore == false and pvp == false and rp == false then return "PvE" end
  end
  return nil
end

local function playerName()
  if type(UnitName) ~= "function" then return "Player" end
  local ok, value = pcall(UnitName, "player")
  if ok and type(value) == "string" and value ~= "" then return value end
  return "Player"
end

local function plainString(fn, ...)
  if type(fn) ~= "function" then return nil end
  local ok, value = pcall(function(...)
    local v = fn(...)
    if type(v) == "string" and v ~= "" then return v .. "" end
  end, ...)
  if ok and type(value) == "string" and value ~= "" then return value end
  return nil
end

local function realmName()
  return plainString(GetRealmName) or ""
end

---当前角色的完整身份（角色名-规则集/服务器）
---@return table { name, ruleset, key }
function Arb.Identity()
  local name, realm = playerName(), realmName()
  local ruleset = liveRuleset() or realm or "Realm"
  return { name = name, ruleset = ruleset, key = name .. "-" .. ruleset }
end

---专业库里的存档键是否为当前角色
---按完整身份键比较；记录里带 name/ruleset 时同时校验，避免同名不同规则集串号
---@param owner string|nil 存档键
---@param ownerName string|nil 记录里的角色名
---@param ruleset string|nil 记录里的规则集/服务器
---@return boolean
function Arb.IsOwnCharacter(owner, ownerName, ruleset)
  local identity = Arb.Identity()
  if type(ownerName) == "string" and ownerName ~= "" then
    if ownerName ~= identity.name then return false end
    local label = type(ruleset) == "string" and RULESET_LABELS[lower(ruleset)] or nil
    return (label or ruleset) == nil or label == identity.ruleset or ruleset == identity.ruleset
  end
  return type(owner) == "string" and owner == identity.key
end

---读取当前角色已学的专业与等级（优先 GetProfessions，其次 C_TradeSkillUI）
---@return table[] 形如 { key, name, level, max, skillLineID, texture }
function Arb.Professions()
  local list, seen = {}, {}
  local function add(name, level, maxLevel, skillLineID, texture)
    local key = Arb.ProfessionKey(name, skillLineID)
    if not key or seen[key] then return end
    local current, ceiling = tonumber(level) or 0, tonumber(maxLevel) or 0
    if current <= 0 and ceiling <= 0 then return end
    seen[key] = true
    tinsert(list, {
      key = key, name = Arb.ProfessionNames[key] or name, level = current, max = ceiling,
      skillLineID = skillLineID, texture = texture,
    })
  end

  if type(GetProfessions) == "function" and type(GetProfessionInfo) == "function" then
    local ok, ids = pcall(function() return { GetProfessions() } end)
    if ok and type(ids) == "table" then
      for index = 1, 12 do
        local skillLineID = ids[index]
        if skillLineID then
          local okInfo, info = pcall(function() return { GetProfessionInfo(skillLineID) } end)
          if okInfo and type(info) == "table" and type(info[1]) == "string" then
            add(info[1], info[3], info[4], info[7] or skillLineID, info[2])
          end
        end
      end
    end
  end

  if type(C_TradeSkillUI) == "table" and type(C_TradeSkillUI.GetAllProfessionTradeSkillLines) == "function" then
    local ok, lines = pcall(C_TradeSkillUI.GetAllProfessionTradeSkillLines)
    if ok and type(lines) == "table" then
      for _, skillLineID in ipairs(lines) do
        local okInfo, info = pcall(C_TradeSkillUI.GetProfessionInfoBySkillLineID, skillLineID)
        if okInfo and type(info) == "table" and (tonumber(info.maxSkillLevel) or 0) > 0 then
          local texture
          if type(C_TradeSkillUI.GetTradeSkillTexture) == "function" then
            local okTexture, value = pcall(C_TradeSkillUI.GetTradeSkillTexture, info.professionID or skillLineID)
            if okTexture then texture = value end
          end
          add(info.professionName, info.skillLevel, info.maxSkillLevel, info.professionID or skillLineID, texture)
        end
      end
    end
  end

  tsort(list, function(left, right)
    if left.level ~= right.level then return left.level > right.level end
    return (left.name or "") < (right.name or "")
  end)
  return list
end

-- ============================================================================
-- 2. 物品数据（名称/品质/装等/类型），带客户端异步加载处理
-- ============================================================================

local QUALITY_COLORS = {
  [0] = "|cff9d9d9d", [1] = "|cffffffff", [2] = "|cff1eff00",
  [3] = "|cff0070dd", [4] = "|cffa335ee", [5] = "|cffff8000", [6] = "|cffe6cc80",
}

local GEAR_CLASS_BY_ID = { [2] = "weapon", [4] = "armor" }
local GEAR_CLASS_BY_TEXT = { ["武器"] = "weapon", ["护甲"] = "armor", weapon = "weapon", armor = "armor" }

local itemCache = {}
local pendingItems = {}
-- 物品数据从「未加载」变成「已加载」时自增，用于让分析缓存失效
local itemDataVersion = 0

local function rawItemInfo(itemID)
  local getter
  if type(C_Item) == "table" and type(C_Item.GetItemInfo) == "function" then
    getter = C_Item.GetItemInfo
  elseif type(GetItemInfo) == "function" then
    getter = GetItemInfo
  end
  if not getter then return nil end
  local ok, values = pcall(function() return { getter(itemID) } end)
  if not ok or type(values) ~= "table" then return nil end
  return values
end

---读取物品基础信息；客户端尚未加载时返回只带 id 的表，并在下一次渲染重试
---@param itemID number
---@return table|nil
function Arb.Items(itemID)
  local id = tonumber(itemID)
  if not id then return nil end
  local cached = itemCache[id]
  if cached and cached.loaded then return cached end
  local values = rawItemInfo(id)
  if not values or type(values[1]) ~= "string" or values[1] == "" then
    -- 首次读取会触发客户端加载，待加载事件到达后再重绘
    pendingItems[id] = true
    if type(C_Item) == "table" and type(C_Item.RequestLoadItemDataByID) == "function" then
      pcall(C_Item.RequestLoadItemDataByID, id)
    end
    return { id = id }
  end
  -- GetItemInfo 返回值顺序：name, link, quality, iLevel, reqLevel, class, subClass,
  -- maxStack, equipLoc, texture, sellPrice（C_Item.GetItemInfo 前若干项一致）
  local info = {
    id = id, loaded = true, name = values[1], link = values[2],
    quality = tonumber(values[3]) or 1, ilvl = tonumber(values[4]) or 0,
    reqLevel = tonumber(values[5]), sellPrice = tonumber(values[11]),
  }
  local class = values[6]
  local kind = GEAR_CLASS_BY_ID[class] or (type(class) == "string" and GEAR_CLASS_BY_TEXT[class])
  info.weapon, info.armor = kind == "weapon", kind == "armor"
  info.gear = info.weapon or info.armor
  itemCache[id] = info
  pendingItems[id] = nil
  itemDataVersion = itemDataVersion + 1
  return info
end

---判断指定物品是否正处于 CraftArb 等待异步加载状态
---@param itemID number
---@return boolean
function Arb.HasPendingItem(itemID)
  local id = tonumber(itemID)
  return id ~= nil and pendingItems[id] == true
end

---物品显示名，客户端未加载时退回占位
---@param itemID number
---@return string
function Arb.ItemName(itemID)
  local info = Arb.Items(itemID)
  if info and info.name then return info.name end
  return format("物品 #%s", tostring(itemID))
end

---物品品质色代码
---@param itemID number
---@return string
function Arb.QualityColor(itemID)
  local info = Arb.Items(itemID)
  return QUALITY_COLORS[(info and info.quality) or 1] or QUALITY_COLORS[1]
end

---物品游戏内超链接（已缓存时返回服务端原生 itemLink，未缓存时构造标准 item 链接以支持 Tooltip 与聊天发送）
---@param itemID number
---@param fallbackName string|nil
---@param fallbackQuality number|nil
---@return string
function Arb.ItemLink(itemID, fallbackName, fallbackQuality)
  local id = tonumber(itemID)
  if not id or id <= 0 then
    return (fallbackName and fallbackName ~= "" and tostring(fallbackName)) or Arb.ItemName(itemID)
  end
  local info = Arb.Items(id)
  if info and type(info.link) == "string" and info.link ~= "" then
    return info.link
  end
  local q = (info and info.quality) or tonumber(fallbackQuality) or 1
  local color = QUALITY_COLORS[q] or QUALITY_COLORS[1]
  local name = (info and info.name) or (fallbackName and fallbackName ~= "" and tostring(fallbackName)) or format("物品 #%d", id)
  return format("%s|Hitem:%d:0:0:0:0:0:0:0|h[%s]|h|r", color, id, name)
end

-- ============================================================================
-- 3. 拍卖行行情接入（黑石交易技能 Blackthornes_TS）
-- ============================================================================

local function playerFaction()
  return plainString(UnitFactionGroup, "player")
end

local function isSavedRealm(value)
  return type(value) == "string" and value ~= "" and value ~= "?" and value ~= "UnknownRealm"
end

local function hasEntries(tbl)
  return type(tbl) == "table" and next(tbl) ~= nil
end

local function tableEntryCount(tbl)
  local count = 0
  for _ in pairs(tbl) do count = count + 1 end
  return count
end

local function hasFullScanForKey(db, key)
  if type(db) ~= "table" or type(key) ~= "string" or key == "" then return false end
  if type(db.lastFullScanByRealm) == "table" then
    return (tonumber(db.lastFullScanByRealm[key]) or 0) > 0
  end
  return false
end

---黑石交易技能当前角色的存档键（realm-faction，与它自己的价格表同键）
---无限服 1.60.1 上 GetRealmName() 可能返回空串或异常服名（命中空桶）：
---优先询问已加载的黑石运行时（且仅当其指向非空表、存在完整全量扫描快照或价格表为空时直接采用），
---否则依次按当前服名、BlackthornesTSCharDB.realmName、同阵营非空价格表及 UnknownRealm 回退。
---@return string|nil
local function blackthornesScopeKey()
  local db = _G.BlackthornesTSDB
  local prices = type(db) == "table" and type(db.prices) == "table" and db.prices or nil
  local preferredKey

  local ns = _G.BlackthornesTS
  local cfg = type(ns) == "table" and ns.Config
  if type(cfg) == "table" and type(cfg.GetRealmKey) == "function" then
    local ok, key = pcall(cfg.GetRealmKey, cfg)
    if ok and type(key) == "string" and key ~= "" then
      if not prices or hasEntries(prices[key]) or hasFullScanForKey(db, key) then return key end
      preferredKey = key
    end
  end

  local faction = playerFaction()
  if not faction then return preferredKey end
  local realm = realmName()
  if realm ~= "" then
    local key = realm .. "-" .. faction
    if not preferredKey then
      if not prices or hasEntries(prices[key]) or hasFullScanForKey(db, key) then return key end
      preferredKey = key
    elseif key ~= preferredKey and (not prices or hasEntries(prices[key]) or hasFullScanForKey(db, key)) then
      return key
    end
  end

  local charDb = _G.BlackthornesTSCharDB
  local remembered = type(charDb) == "table" and isSavedRealm(charDb.realmName) and charDb.realmName or nil
  local rememberedKey = remembered and (remembered .. "-" .. faction) or nil
  if rememberedKey and (not prices or hasEntries(prices[rememberedKey]) or hasFullScanForKey(db, rememberedKey)) then
    return rememberedKey
  end

  if prices then
    local suffix = "-" .. faction
    local unknownKey = "UnknownRealm" .. suffix
    local candidates = {}
    for k, t in pairs(prices) do
      if type(k) == "string" and #k > #suffix and sub(k, -#suffix) == suffix and k ~= unknownKey
        and hasEntries(t) then
        candidates[#candidates + 1] = k
      end
    end
    if #candidates == 1 then return candidates[1] end
    if #candidates > 1 then
      local bestKey, bestCount = nil, -1
      for _, k in ipairs(candidates) do
        local c = tableEntryCount(prices[k])
        if c > bestCount or (c == bestCount and k < bestKey) then
          bestKey, bestCount = k, c
        end
      end
      if bestKey then return bestKey end
    end
    if hasEntries(prices[unknownKey]) or hasFullScanForKey(db, unknownKey) then
      return unknownKey
    end
  end

  if preferredKey then return preferredKey end
  if rememberedKey then return rememberedKey end
  return "UnknownRealm-" .. faction
end

local function blackthornesPriceSnapshot()
  local ns = _G.BlackthornesTS
  local db = _G.BlackthornesTSDB
  local pricesMod = type(ns) == "table" and ns.Prices
  if type(pricesMod) == "table" and type(pricesMod.GetTable) == "function" then
    local ok, t = pcall(pricesMod.GetTable, pricesMod)
    if ok and type(t) == "table" then
      local rtFullScan = false
      if type(pricesMod.GetLastFullScan) == "function" then
        local okF, at = pcall(pricesMod.GetLastFullScan, pricesMod)
        rtFullScan = okF and (tonumber(at) or 0) > 0
      else
        local cfg = ns.Config
        local rtKey
        if type(cfg) == "table" and type(cfg.GetRealmKey) == "function" then
          local okK, k = pcall(cfg.GetRealmKey, cfg)
          if okK and type(k) == "string" and k ~= "" then rtKey = k end
        end
        if rtKey and hasFullScanForKey(db, rtKey) then
          rtFullScan = true
        elseif type(db) == "table" and type(db.lastFullScanByRealm) ~= "table" then
          rtFullScan = (tonumber(db.lastFullScan) or 0) > 0
        end
      end
      if hasEntries(t) or rtFullScan then
        return t, rtFullScan
      end
    end
  end
  if type(db) ~= "table" or type(db.prices) ~= "table" then return nil, false end
  local key = blackthornesScopeKey()
  if not key then return nil, false end
  local dbFullScan = hasFullScanForKey(db, key)
    or (type(db.lastFullScanByRealm) ~= "table" and (tonumber(db.lastFullScan) or 0) > 0)
  local t = db.prices[key]
  if type(t) == "table" and (hasEntries(t) or dbFullScan) then
    return t, dbFullScan
  end
  if t == nil and dbFullScan then
    return {}, true
  end
  return nil, false
end

local function blackthornesPriceTable()
  local t = blackthornesPriceSnapshot()
  return t
end

local function blackthornesRealmPriceTable()
  local db = _G.BlackthornesTSDB
  if type(db) ~= "table" or type(db.realmPrices) ~= "table" then return nil end
  local key = blackthornesScopeKey()
  if not key then return nil end
  local t = db.realmPrices[key]
  if hasEntries(t) then return t end
  return nil
end

local function blackthornesApi()
  local api = _G.BlackthornesTS_API
  if type(api) == "table" and type(api.GetPrice) == "function" then return api end
  return nil
end

---读取黑石交易技能最近一次「完整全量扫描」时间戳（不含截断扫描）
---@return number
local function blackthornesLastFullScan()
  local ns = _G.BlackthornesTS
  local pricesMod = type(ns) == "table" and ns.Prices
  if type(pricesMod) == "table" and type(pricesMod.GetLastFullScan) == "function" then
    local ok, at = pcall(pricesMod.GetLastFullScan, pricesMod)
    local num = ok and tonumber(at) or nil
    if num and num > 0 then return floor(num) end
  end
  local db = _G.BlackthornesTSDB
  if type(db) ~= "table" then return 0 end
  local byRealm = db.lastFullScanByRealm
  if type(byRealm) == "table" then
    local key = blackthornesScopeKey()
    return (key and floor(tonumber(byRealm[key]) or 0)) or 0
  end
  return floor(tonumber(db.lastFullScan) or 0)
end

---读取黑石交易技能最近一次扫描时间戳（优先询问黑石运行时，其次汇总存档字段）
---@return number
local function blackthornesLastScan()
  local ns = _G.BlackthornesTS
  local pricesMod = type(ns) == "table" and ns.Prices
  if type(pricesMod) == "table" and type(pricesMod.GetLastScan) == "function" then
    local ok, at = pcall(pricesMod.GetLastScan, pricesMod)
    local num = ok and tonumber(at) or nil
    if num and num > 0 then return floor(num) end
  end
  local db = _G.BlackthornesTSDB
  if type(db) ~= "table" then return 0 end
  local stamp = max(floor(tonumber(db.lastScan) or 0), floor(tonumber(db.lastFullScan) or 0))
  local key = blackthornesScopeKey()
  if key then
    local full, capped = db.lastFullScanByRealm, db.lastCappedScanByRealm
    if type(full) == "table" then stamp = max(stamp, floor(tonumber(full[key]) or 0)) end
    if type(capped) == "table" then stamp = max(stamp, floor(tonumber(capped[key]) or 0)) end
  end
  return stamp
end

---黑石行情的修订键：优先用它的会话内变更计数 Prices.changes（扫描、单物品浏览、购买都会 +1，O(1)）；
---取不到时退回扫描时间戳（按 realm-faction 的全量/截断快照，兼容账号级旧字段）+ 物品条目数。
---@return string|nil
local function blackthornesRevisionKey()
  local ns = _G.BlackthornesTS
  local prices = type(ns) == "table" and ns.Prices
  local changes = type(prices) == "table" and tonumber(prices.changes)
  if changes then return "c" .. floor(changes) end
  local tbl = blackthornesPriceTable()
  local count = tbl and tableEntryCount(tbl) or 0
  local stamp = blackthornesLastScan()
  if stamp == 0 and count == 0 and not blackthornesApi() then return nil end
  return tconcat({ "bt", stamp, count }, ":")
end

---当前实际生效的行情数据源："blackthornes" | nil
---@return string|nil
function Arb.MarketProvider()
  if blackthornesPriceTable() or blackthornesApi() then return "blackthornes" end
  return nil
end

---区分「未安装」「已安装但行情未初始化」「就绪」三种状态
---@return string
function Arb.ApiState()
  if Arb.MarketProvider() then return "ready" end
  if type(_G.BlackthornesTS) == "table" or type(_G.BlackthornesTSDB) == "table" or type(_G.BlackthornesTS_API) == "table" then
    return "loading"
  end
  return "missing"
end

local quoteCache, sellCache, recipeListCache, rowCache, vendorRowsCache, flipRowsCache, tooltipSellCache
-- 是否在本轮分析中把 NPC 商人价作为采购成本（由 Analyse 的 preferVendor 选项设置）
local costPrefersVendor = false
-- 每次成功采集商人商品都会 +1，纳入缓存签名（同一秒内改价也能让制造行/报价缓存失效）
local vendorVersion = 0
local unsellableVersion = 0

---清空全部缓存（行情修订号变化、物品数据加载完成、拍卖行开关时调用）
function Arb.Reset()
  quoteCache, sellCache = {}, {}
  recipeListCache = { stamp = nil, list = nil }
  rowCache = { stamp = nil }
  vendorRowsCache = { stamp = nil }
  flipRowsCache = { stamp = nil }
  tooltipSellCache = {}
end
Arb.Reset()

---行情修订号：行情变化时使行缓存失效
---@return string|nil
local function revision()
  return blackthornesRevisionKey()
end

---按需要购买的数量取单价：使用黑石交易技能价格阶梯、存档及公开 API，
---若已采集到 NPC 商人售价且低于行情价，则以商人价为最低成本（可选，由 options.preferVendor 控制）。
---库存买不齐时仍给出估价，但通过 detail.shortfall 标记，调用方必须区别对待
---@param itemID number
---@param quantity number 需要购买的数量（>0）
---@param options table|nil { preferVendor = bool }
---@return number|nil unitPrice 单价（铜）
---@return string|nil source "depth" | "record" | "api" | "vendor" | "insufficient" | "no-api"
---@return table|nil detail 形如 { unit, source, shortfall = {have, need}, vendor = {npc, zone, stock} }
function Arb.PriceFor(itemID, quantity, options)
  local id = tonumber(itemID)
  if not id then return nil, "no-api" end
  local wanted = max(1, ceil(tonumber(quantity) or 1))
  local preferVendor = (type(options) == "table" and options.preferVendor == true)
    or (options == nil and costPrefersVendor)
  local key = id .. "|" .. wanted .. (preferVendor and "|v" or "")
  local cached = quoteCache[key]
  if cached then return cached.unit, cached.source, cached end

  -- 商人价优先：即使行情插件缺席/未就绪，只要已采集到商人报价就可给出采购成本
  local vendorQuote
  if preferVendor then vendorQuote = Arb.VendorBuyFor(id, wanted) end
  local btPrices = blackthornesPriceTable()
  local btApi = blackthornesApi()
  local unit, source, shortfall
  if not btPrices and not btApi then
    if vendorQuote then
      local entry = {
        unit = vendorQuote.unit, source = "vendor", shortfall = vendorQuote.shortfall,
        vendor = vendorQuote.vendor,
      }
      quoteCache[key] = entry
      return entry.unit, entry.source, entry
    end
    local entry = { unit = nil, source = "no-api" }
    quoteCache[key] = entry
    return nil, entry.source, entry
  end

  local record = btPrices and btPrices[id]
  if type(record) == "table" then
    local ladder = record.ladder
    if type(ladder) == "table" and #ladder >= 2 and #ladder % 2 == 0 then
      local total, spent, left = 0, 0, wanted
      for i = 1, #ladder, 2 do
        local p, u = tonumber(ladder[i]) or 0, tonumber(ladder[i + 1]) or 0
        if u > 0 and p > 0 then
          total = total + u
          if left > 0 then
            local take = min(left, u)
            spent, left = spent + take * p, left - take
          end
        end
      end
      if total < wanted then
        shortfall = { have = total, need = wanted }
      end
      if left <= 0 and spent > 0 then unit, source = spent / wanted, "depth" end
    end
    if not unit then
      local price = tonumber(record.rivalMin) or tonumber(record.min) or tonumber(record.market)
      if price and price > 0 then unit, source = price, "record" end
    end
  end
  if not unit and btApi then
    local ok, price = pcall(btApi.GetPrice, id)
    if ok and type(price) == "number" and price > 0 then unit, source = price, "api" end
  end

  local entry = { unit = unit, source = source or (shortfall and "insufficient" or "no-data"), shortfall = shortfall }
  -- NPC 商人价兜底：比行情更低时作为采购成本；按各商人价格档位逐段计价
  if vendorQuote and vendorQuote.unit and (not unit or vendorQuote.unit < unit) then
    entry = {
      unit = vendorQuote.unit, source = "vendor", shortfall = vendorQuote.shortfall,
      vendor = vendorQuote.vendor,
    }
    unit = vendorQuote.unit
  end
  quoteCache[key] = entry
  if unit then return unit, entry.source, entry end
  return nil, entry.source, entry
end

---产出可卖出的参考价：按「观测到的最低售价」（record.min，全量扫描的原始最低挂单价）计算利润，
---避免用 rivalMin 高估收入；min 缺失时才回退 rivalMin → market → API。
---@param itemID number
---@return number|nil price
---@return table|nil record
---@return string|nil priceSource "min" | "rivalMin" | "market" | "api" | nil
function Arb.SellQuote(itemID)
  local id = tonumber(itemID)
  if not id then return nil end
  local cached = sellCache[id]
  if cached then return cached.price, cached.record, cached.priceSource end
  local btPrices = blackthornesPriceTable()
  local record = btPrices and btPrices[id]
  if type(record) == "table" then
    local price, priceSource = tonumber(record.min), "min"
    if not price or price <= 0 then price, priceSource = tonumber(record.rivalMin), "rivalMin" end
    if not price or price <= 0 then price, priceSource = tonumber(record.market), "market" end
    if price and price > 0 then
      sellCache[id] = { price = price, record = record, priceSource = priceSource }
      return price, record, priceSource
    end
  end
  local btApi = blackthornesApi()
  if btApi then
    local ok, price = pcall(btApi.GetPrice, id)
    if ok and type(price) == "number" and price > 0 then
      sellCache[id] = { price = price, record = nil, priceSource = "api" }
      return price, nil, "api"
    end
  end
  return nil
end

---读取拍卖行当前在售件数（最近一次扫描数到的总挂单件数；没有扫描记录返回 nil 表示「未知」）
---数据源：黑石交易技能价格表 record.quantity（必须带 record.seen，与它物品提示里的「现在在售」同源）。
---@param itemID number
---@return number|nil quantity 在售件数，nil 表示未知
---@return string|nil source 数据来源 "quantity" | "record" | "depth" | "fullscan" | "shared" | nil
---   "fullscan" 表示黑石已完成完整全量扫描且该物品不在挂单表中（当前 0 件在售），
---   "shared" 表示仅来自黑石全服共享价（realmPrices，不含挂单件数），
---   数量不可信所以仍返回 nil，调用方可以据此区分「从没扫描过」「共享价无件数」和「全量确认 0 件」。
function Arb.ListedSupply(itemID)
  local id = tonumber(itemID)
  if not id then return nil end
  local prices, hasFullScan = blackthornesPriceSnapshot()
  local record = prices and prices[id]
  -- record.quantity 是黑石最近一次扫描该物品时数到的挂单总件数（record.seen 是扫描时间），
  -- 与物品提示的「现在在售」同源；兼容旧版/别名存档的 bookQuantity 字段。
  if type(record) == "table" and type(record.seen) == "number" then
    local qty = tonumber(record.quantity)
    if qty and qty >= 0 then return qty, "quantity" end
  end
  if type(record) == "table" and record.bookComplete == true then
    local qty = tonumber(record.bookQuantity)
    if qty and qty >= 0 then return qty, "record" end
  end
  local btApi = blackthornesApi()
  if btApi and type(btApi.GetDepth) == "function" then
    local ok, depth = pcall(btApi.GetDepth, id)
    if ok and type(depth) == "table" and depth.complete == true then
      local qty = tonumber(depth.totalQuantity)
      if qty and qty >= 0 then return qty, "depth" end
    end
  end
  if type(prices) == "table" and record == nil and hasFullScan then
    return 0, "fullscan"
  end
  local realmPrices = blackthornesRealmPriceTable()
  if realmPrices and realmPrices[id] ~= nil then
    return nil, "shared"
  end
  return nil
end

---拍卖行手续费率（黑石交易技能设置，缺省 5%）
---@return number
function Arb.AuctionCut()
  local bt = _G.BlackthornesTSDB
  if type(bt) == "table" and type(bt.settings) == "table" then
    local cut = tonumber(bt.settings.auctionCut)
    if cut and cut >= 0 and cut < 1 then return cut end
  end
  return DEFAULT_CUT
end

-- ============================================================================
-- 4. 配方来源：黑石交易技能账号级专业库 + 本插件自行采集
-- ============================================================================

local function difficultyWord(info)
  local value = info and (info.relativeDifficulty or info.difficulty)
  if type(value) == "string" then
    local word = lower(value)
    if word == "optimal" or word == "medium" or word == "easy" or word == "trivial" then return word end
    return "unknown"
  end
  local enums = Enum and Enum.TradeskillRelativeDifficulty
  if enums and value ~= nil then
    if enums.Optimal ~= nil and enums.Optimal == value then return "optimal" end
    if enums.Medium ~= nil and enums.Medium == value then return "medium" end
    if enums.Easy ~= nil and enums.Easy == value then return "easy" end
    if enums.Trivial ~= nil and enums.Trivial == value then return "trivial" end
  end
  return "unknown"
end

---把黑石专业库存档里的配方记录归一化成引擎内部结构
---@param raw table
---@return table|nil
local function normalizeStoredRecipe(raw)
  if type(raw) ~= "table" then return nil end
  local output = tonumber(raw.outputItemID)
  if not output then return nil end
  -- complete == false 表示品质槽未选定，成本无法唯一确定，直接跳过避免给出虚假利润
  if raw.complete == false then return nil end
  local reagents, slots = {}, {}
  for _, reagent in ipairs(raw.reagents or {}) do
    local id, quantity = tonumber(reagent.itemID), tonumber(reagent.quantity) or 0
    if id and quantity > 0 then tinsert(reagents, { id = id, qty = quantity }) end
  end
  for _, slot in ipairs(raw.slots or {}) do
    local candidates, seen = {}, {}
    for _, candidate in ipairs(slot.candidates or {}) do
      local id = tonumber(candidate)
      if id and not seen[id] then seen[id] = true; tinsert(candidates, id) end
    end
    local quantity = tonumber(slot.quantity) or 0
    if #candidates > 0 and quantity > 0 then tinsert(slots, { qty = quantity, candidates = candidates }) end
  end
  if #reagents == 0 and #slots == 0 then return nil end
  return {
    id = tonumber(raw.recipeID) or 0, name = raw.name, output = output,
    qMin = max(1, tonumber(raw.quantityMin) or 1),
    qMax = max(1, tonumber(raw.quantityMax) or tonumber(raw.quantityMin) or 1),
    professionName = raw.profession, skillLineID = tonumber(raw.skillLineID),
    difficulty = raw.skillUp or "unknown", gray = tonumber(raw.gray) or 0,
    reagents = reagents, slots = slots,
  }
end

---读取黑石交易技能账号级专业数据库里的全部角色配方
---@return table[] 形如 { owner, ownerName, ruleset, skills, recipes, source }
local function storedRecipeSets()
  local sets = {}
  local function readChars(characters, source)
    if type(characters) ~= "table" then return end
    for owner, record in pairs(characters) do
      if type(record) == "table" and type(record.recipes) == "table" then
        local skills = {}
        for _, skill in ipairs(record.professions or {}) do
          local key = Arb.ProfessionKey(skill.name or skill.professionName, skill.skillLineID)
          if key and not skills[key] then
            skills[key] = { level = tonumber(skill.skillLevel) or 0, max = tonumber(skill.maxSkillLevel) or 0 }
          end
        end
        local recipes = {}
        for _, raw in pairs(record.recipes) do
          local recipe = normalizeStoredRecipe(raw)
          if recipe then tinsert(recipes, recipe) end
        end
        if #recipes > 0 then
          tinsert(sets, {
            owner = tostring(owner), ownerName = record.name, ruleset = record.ruleset or record.realm,
            skills = skills, recipes = recipes, source = source,
          })
        end
      end
    end
  end

  local bt = _G.BlackthornesTSDB
  readChars(type(bt) == "table" and bt.characters or nil, "blackthornes")

  return sets
end

---本插件自己采集的配方（WoWFDB.recipeCache[角色键]），按角色隔离
---@param owner string 角色键
---@return table|nil
local function ownRecipeSet(owner)
  local all = WoWFDB.recipeCache
  if type(all) ~= "table" then return nil end
  local cache = all[owner]
  -- 早期版本把配方直接平铺在 recipeCache 上，归属无法确认，不迁移到当前角色
  if type(cache) ~= "table" then return nil end
  local recipes = {}
  for _, raw in pairs(cache) do
    local output = tonumber(raw.output)
    if output then
      tinsert(recipes, {
        id = tonumber(raw.id) or 0, name = raw.name, output = output,
        qMin = max(1, tonumber(raw.qMin) or 1), qMax = max(1, tonumber(raw.qMax) or tonumber(raw.qMin) or 1),
        professionName = raw.professionName, skillLineID = tonumber(raw.skillLineID),
        difficulty = raw.difficulty or "unknown", gray = tonumber(raw.gray) or 0,
        reagents = raw.reagents or {}, slots = raw.slots or {},
      })
    end
  end
  if #recipes == 0 then return nil end
  local skills = {}
  for _, profession in ipairs(Arb.Professions()) do
    skills[profession.key] = { level = profession.level, max = profession.max }
  end
  return {
    owner = owner, ownerName = Arb.Identity().name, ruleset = Arb.Identity().ruleset,
    skills = skills, recipes = recipes, source = "local",
  }
end

---签名用于判定配方缓存是否过期（账号库采集时间 / 本地采集时间 / 配方条数）
---@return string
local function recipeSignature()
  local count, stamp, characters = 0, 0, 0
  local function scanChars(records)
    if type(records) ~= "table" then return end
    for _, record in pairs(records) do
      characters = characters + 1
      local at = type(record) == "table" and tonumber(record.recipesCachedAt) or 0
      if at and at > stamp then stamp = at end
    end
  end
  local bt = _G.BlackthornesTSDB
  scanChars(type(bt) == "table" and bt.characters or nil)
  local cache = WoWFDB.recipeCache
  if type(cache) == "table" then
    for _, scoped in pairs(cache) do
      if type(scoped) == "table" then
        for _ in pairs(scoped) do count = count + 1 end
      end
    end
  end
  return tconcat({ characters, floor(stamp), count, floor(tonumber(WoWFDB.recipeCacheAt) or 0), harvestVersion }, ":")
end

---展平后的配方列表：每条都带角色与专业等级信息
---@return table[]
function Arb.RecipeList()
  local stamp = recipeSignature()
  if recipeListCache.stamp == stamp and recipeListCache.list then return recipeListCache.list end
  local list, seen = {}, {}
  local function ingest(sets)
    for _, set in ipairs(sets) do
      for _, recipe in ipairs(set.recipes) do
        local key = set.owner .. "#" .. tostring(recipe.id)
        if not seen[key] then
          seen[key] = true
          local professionKey = Arb.ProfessionKey(recipe.professionName, recipe.skillLineID) or Arb.ProfessionKey(set.professionName)
          local skill = professionKey and set.skills and set.skills[professionKey] or nil
          recipe.professionKey = professionKey
          -- 未收录的专业名（如后续资料片新增专线）原样保留，避免被清空；其 skill 为 nil，页面不显示技能等级
          recipe.professionName = professionKey and Arb.ProfessionNames[professionKey] or recipe.professionName
          recipe.owner, recipe.ownerName, recipe.ownerSource = set.owner, set.ownerName, set.source
          recipe.ruleset = set.ruleset
          recipe.skill, recipe.skillMax = skill and skill.level or nil, skill and skill.max or nil
          tinsert(list, recipe)
        end
      end
    end
  end

  local sets = storedRecipeSets()
  local identity = Arb.Identity()
  -- 本插件采集的配方只属于当前角色；与黑石专业库逐条去重并补充本插件独有配方
  local own = ownRecipeSet(identity.key)
  local matchedOwner
  for _, set in ipairs(sets) do
    if set.owner == identity.key or Arb.IsOwnCharacter(set.owner, set.ownerName, set.ruleset) then
      matchedOwner = set.owner
      break
    end
  end
  ingest(sets)
  if own then
    if matchedOwner then own.owner = matchedOwner end
    ingest({ own })
  end

  tsort(list, function(left, right)
    if left.id ~= right.id then return left.id < right.id end
    return tostring(left.owner) < tostring(right.owner)
  end)
  recipeListCache.stamp, recipeListCache.list = stamp, list
  return list
end

---从原生专业窗口采集当前角色已学的配方（打开专业窗口时调用）
---@return number count
---@return string|nil message
function Arb.Harvest()
  local api = C_TradeSkillUI
  if type(api) ~= "table" or type(api.GetAllRecipeIDs) ~= "function" then
    return 0, "当前客户端没有提供 C_TradeSkillUI 配方接口"
  end
  local ok, ids = pcall(api.GetAllRecipeIDs)
  if not ok or type(ids) ~= "table" or #ids == 0 then
    return 0, "没有采集到配方（请先打开专业窗口）"
  end
  local all = WoWFDB.recipeCache
  if type(all) ~= "table" then all = {}; WoWFDB.recipeCache = all end
  local owner = Arb.Identity().key
  local cache = all[owner]
  if type(cache) ~= "table" then cache = {}; all[owner] = cache end
  local basic = Enum and Enum.CraftingReagentType and Enum.CraftingReagentType.Basic or 1
  local count, changed, touched = 0, false, {}

  for _, recipeID in ipairs(ids) do
    local okInfo, info = pcall(api.GetRecipeInfo, recipeID)
    local okSchematic, schematic = pcall(api.GetRecipeSchematic, recipeID, false)
    if okInfo and type(info) == "table" and info.learned == true and info.isDummyRecipe ~= true
      and info.disabled ~= true and okSchematic and type(schematic) == "table" then
      local professionName, skillLineID
      if type(api.GetProfessionInfoByRecipeID) == "function" then
        local okProfession, value = pcall(api.GetProfessionInfoByRecipeID, recipeID)
        if okProfession and type(value) == "table" then
          professionName, skillLineID = value.professionName, value.professionID
        end
      end
      local reagents, slots = {}, {}
      for _, slot in ipairs(schematic.reagentSlotSchematics or {}) do
        local required = slot and slot.required
        if required == nil and slot then required = slot.reagentType == basic end
        if slot and required and (tonumber(slot.quantityRequired) or 0) > 0 then
          local candidates, seen = {}, {}
          for _, candidate in ipairs(slot.reagents or {}) do
            local id = tonumber(candidate.itemID)
            if id and not seen[id] then seen[id] = true; tinsert(candidates, id) end
          end
          if #candidates == 1 then
            tinsert(reagents, { id = candidates[1], qty = tonumber(slot.quantityRequired) })
          elseif #candidates > 1 then
            tinsert(slots, { qty = tonumber(slot.quantityRequired), candidates = candidates })
          end
        end
      end
      local output = tonumber(schematic.outputItemID)
      if output and (#reagents > 0 or #slots > 0) then
        local prev = cache[recipeID]
        local diff = difficultyWord(info)
        local qMin = max(1, tonumber(schematic.quantityMin) or 1)
        local qMax = max(1, tonumber(schematic.quantityMax) or tonumber(schematic.quantityMin) or 1)
        if type(prev) ~= "table" or prev.output ~= output or prev.difficulty ~= diff
          or prev.qMin ~= qMin or prev.qMax ~= qMax or #(prev.reagents or {}) ~= #reagents or #(prev.slots or {}) ~= #slots then
          changed = true
        end
        cache[recipeID] = {
          id = recipeID, name = info.name or schematic.name, output = output,
          qMin = qMin, qMax = qMax,
          professionName = professionName, skillLineID = tonumber(skillLineID),
          difficulty = diff, gray = tonumber(info.maxTrivialLevel) or 0,
          reagents = reagents, slots = slots, at = now(),
        }
        count = count + 1
        if skillLineID then touched[skillLineID] = true end
      end
    end
  end

  -- 在同一专业线内清理已遗忘的配方，避免残留条目冒充「当前可以制作」
  if count > 0 then
    local current = {}
    for _, recipeID in ipairs(ids) do
      local okInfo, info = pcall(api.GetRecipeInfo, recipeID)
      if not (okInfo and type(info) == "table" and info.learned == false) then
        current[recipeID] = true
      end
    end
    for recipeID, record in pairs(cache) do
      local line = type(record) == "table" and tonumber(record.skillLineID)
      if line and touched[line] and not current[recipeID] then
        cache[recipeID] = nil
        changed = true
      end
    end
  end

  if changed then
    WoWFDB.recipeCacheAt = now()
    harvestVersion = harvestVersion + 1
    recipeListCache.stamp = nil
  end
  return count
end

-- ============================================================================
-- 4b. NPC 商人商品采集：打开商人窗口时记录「商品 → 买入价 / 库存 / 商人 / 地点」
-- 用途：制造套利页的「商人购入 → 拍卖行出售」筛选通道
-- ============================================================================

local function merchantName()
  if type(UnitName) ~= "function" then return nil end
  local ok, name = pcall(UnitName, "npc")
  if not ok or type(name) ~= "string" or name == "" then
    -- 部分客户端把商人放在 "target" 上
    local okTarget, target = pcall(UnitName, "target")
    if okTarget and type(target) == "string" and target ~= "" then name = target end
  end
  return (type(name) == "string" and name ~= "") and name or nil
end

local function merchantZone()
  if type(GetZoneText) ~= "function" then return nil end
  local ok, zone = pcall(GetZoneText)
  if ok and type(zone) == "string" and zone ~= "" then return zone end
  return nil
end

---在当前 NPC 商人窗口采集可售商品
---物品价格通过 GetMerchantItemInfo 的第 3 个返回值（price）取得；特殊货币商品（需求量 > 1
---且需要代币兑换）不可能是稳定「用金币买入 → 拍卖行卖出」的套利来源，直接跳过。
---@return number count 采集到的商品条数
---@return string|nil message 没有商人窗口时的说明
function Arb.HarvestVendor()
  local countFn = type(GetMerchantNumItems) == "function" and GetMerchantNumItems or nil
  if not countFn then
    return 0, "当前客户端没有提供商人商品接口"
  end
  -- 全局 GetMerchantItemInfo 优先；无限服 1.60.1 等客户端改用 C_MerchantFrame.GetItemInfo
  local globalInfo = type(GetMerchantItemInfo) == "function" and GetMerchantItemInfo or nil
  local cInfo = type(C_MerchantFrame) == "table" and type(C_MerchantFrame.GetItemInfo) == "function"
    and C_MerchantFrame.GetItemInfo or nil
  local function readInfo(slot)
    if globalInfo then
      -- name, texture, price, quantity, numAvailable, isPurchasable, isUsable, extendedCost
      local name, texture, price, quantity, numAvailable, _, _, extendedCost = globalInfo(slot)
      return name, texture, price, quantity, numAvailable, extendedCost
    elseif cInfo then
      local ok, data = pcall(cInfo, slot)
      if ok and type(data) == "table" then
        -- stackCount 与全局接口 quantity 语义一致（每「格」的商品件数）
        return data.name, data.texture, data.price, data.stackCount, data.numAvailable, data.hasExtendedCost
      end
    end
  end
  if not globalInfo and not cInfo then
    return 0, "当前客户端没有提供商人商品接口"
  end
  local okCount, count = pcall(countFn)
  if not okCount or tonumber(count) == nil or tonumber(count) <= 0 then
    return 0, "尚未打开 NPC 商人窗口"
  end

  local all = WoWFDB.vendorCache
  if type(all) ~= "table" then all = {}; WoWFDB.vendorCache = all end
  local npc = merchantName() or "未知商人"
  local zone = merchantZone()
  local npcEntry = all[npc]
  if type(npcEntry) ~= "table" then npcEntry = {}; all[npc] = npcEntry end
  npcEntry.zone, npcEntry.at = zone, now()

  local stored, seen = 0, {}
  for i = 1, tonumber(count) do
    local ok, name, texture, price, quantity, numAvailable, extendedCost = pcall(readInfo, i)
    -- 带额外成本（声望/代币）的商品无法按纯金币利润计算，跳过
    if ok and type(price) == "number" and price > 0 and quantity == 1 and not extendedCost then
      local id
      if type(GetMerchantItemLink) == "function" then
        local okLink, link = pcall(GetMerchantItemLink, i)
        if okLink and type(link) == "string" then id = tonumber(link:match("item:(%d+)")) end
      end
      if not id and type(name) == "string" then
        local okItem, itemID = pcall(function() return tonumber((select(1, GetItemInfoInstant(name)))) end)
        if okItem then id = itemID end
      end
      if id and not seen[id] then
        seen[id] = true
        local maxStack = 1
        if type(GetItemInfoInstant) == "function" then
          local okStack, _, _, _, stack = pcall(GetItemInfoInstant, id)
          if okStack and tonumber(stack) and tonumber(stack) > 0 then maxStack = tonumber(stack) end
        end
        local stock = tonumber(numAvailable) or -1
        local old = npcEntry[id]
        npcEntry[id] = {
          id = id, price = price, stock = stock, stack = maxStack, at = now(),
          -- 保留旧采集的商人地点，避免某次窗口没有 zone 时抹掉信息
          zone = zone or (type(old) == "table" and old.zone or nil),
        }
        stored = stored + 1
      end
    end
  end
  if stored > 0 then
    WoWFDB.vendorCacheAt = now()
    vendorVersion = vendorVersion + 1
    vendorRowsCache.stamp = nil
  end
  return stored
end

---展平商人采集缓存，按物品合并为一行：取最低买入价，并保留全部来源与可购入总量
---@return table[] 每行 { itemID, price, stock, stack, npc, zone, sources, totalStock }
function Arb.VendorOffers()
  local byItem, cache = {}, WoWFDB.vendorCache
  if type(cache) ~= "table" then return {} end
  for npc, entry in pairs(cache) do
    if type(entry) == "table" then
      for key, offer in pairs(entry) do
        if type(offer) == "table" then
          local id = tonumber(offer.id or key)
          local price = tonumber(offer.price)
          if id and price and price > 0 then
            local row = byItem[id]
            if not row then
              row = {
                itemID = id, price = price, stock = tonumber(offer.stock) or -1,
                stack = tonumber(offer.stack) or 1, npc = npc, zone = offer.zone or entry.zone,
                at = tonumber(offer.at) or 0, sources = {}, totalStock = 0,
              }
              byItem[id] = row
            end
            local stock = tonumber(offer.stock) or -1
            row.sources[#row.sources + 1] = {
              npc = npc, zone = offer.zone or entry.zone, price = price, stock = stock,
            }
            -- 有限库存即使合计为 0 也要保留（售罄）；出现无限库存(-1)时单独标记且不受有限合计限制
            if stock < 0 then
              row.infinite = true
            else
              row.totalStock = row.totalStock + max(0, stock)
            end
            if price < row.price then
              row.price, row.stock, row.stack = price, stock, tonumber(offer.stack) or 1
              row.npc, row.zone = npc, offer.zone or entry.zone
              row.at = tonumber(offer.at) or row.at
            end
          end
        end
      end
    end
  end
  local offers = {}
  for _, row in pairs(byItem) do
    -- 有无限库存来源时，汇总的 finite 合计不再限制可购量
    if row.infinite then row.totalStock = nil end
    offers[#offers + 1] = row
  end
  tsort(offers, function(a, b) return a.itemID < b.itemID end)
  return offers
end

---按价格档位逐段采购：先买完最低价的库存，再买下一价档，直到满足需求。
---库存语义：-1 = 无限（永远买得到），0 = 售罄，>0 = 有限库存。
---@param itemID number
---@param quantity number 需要购买的数量
---@return table|nil quote { unit, shortfall, vendor, total }
function Arb.VendorBuyFor(itemID, quantity)
  local id = tonumber(itemID)
  if not id then return nil end
  local wanted = max(1, ceil(tonumber(quantity) or 1))
  local bestOffer
  for _, offer in ipairs(Arb.VendorOffers()) do
    if offer.itemID == id then
      if not bestOffer or offer.price < bestOffer.price then bestOffer = offer end
    end
  end
  if not bestOffer then return nil end

  -- 按单价从低到高排序各来源，逐档累加真实花费
  local sources = {}
  for _, source in ipairs(bestOffer.sources or {}) do
    sources[#sources + 1] = source
  end
  tsort(sources, function(a, b) return a.price < b.price end)

  local left, spent, hasInfinite = wanted, 0, false
  for _, source in ipairs(sources) do
    if left <= 0 then break end
    local stock = tonumber(source.stock) or -1
    if stock < 0 then
      -- 无限库存：以当前档价买满剩余需求
      spent = spent + source.price * left
      left = 0
      hasInfinite = true
    elseif stock > 0 then
      local take = min(left, stock)
      spent = spent + source.price * take
      left = left - take
    end
  end
  -- 只有真正买齐才返回报价；买不齐时由行情价兜底或标记缺货，不能用部分库存算单价
  if left > 0 then
    return {
      unit = nil, shortfall = { have = wanted - left, need = wanted },
      vendor = { npc = bestOffer.npc, zone = bestOffer.zone, stock = bestOffer.stock, totalStock = bestOffer.totalStock },
    }
  end
  return {
    unit = spent / wanted, shortfall = hasInfinite and nil or (left > 0 and { have = wanted, need = wanted } or nil),
    total = spent,
    vendor = { npc = bestOffer.npc, zone = bestOffer.zone, stock = bestOffer.stock, totalStock = bestOffer.totalStock },
  }
end

---采集时间用于让套利行缓存失效（版本号确保同秒重复采集也生效）
local function vendorSignature()
  local count = (type(WoWFDB.vendorCache) == "table") and #Arb.VendorOffers() or 0
  return tconcat({ floor(tonumber(WoWFDB.vendorCacheAt) or 0), count, vendorVersion }, ":")
end

---在售数量过滤：只过滤「已确认在售数量 < 阈值」的商品；数量未知时保留，避免误杀。
---@param row table
---@param minSupply number|nil
---@return boolean keep
local function passesSupply(row, minSupply)
  if not minSupply then return true end
  local supply = row.listedSupply
  if supply == nil then return true end
  return supply >= minSupply
end

---计算「NPC 商人买入 → 拍卖行卖出」的套利行
---买入价取商人实际售价，卖出价取拍卖行对手最低价并扣除手续费；不用商人的回收价当收入。
---@return table[] rows
---@return table meta
function Arb.VendorArbitrage(options)
  options = type(options) == "table" and options or {}
  local cut = Arb.AuctionCut()
  local stamp = tconcat({ tostring(revision()), vendorSignature(), tostring(itemDataVersion) }, "|")
  if vendorRowsCache.stamp ~= stamp then
    local rows = {}
    for _, offer in ipairs(Arb.VendorOffers()) do
      local price, record, priceSource = Arb.SellQuote(offer.itemID)
      -- 单件买入价即最低档价（批量时按档位逐段计价，见 VendorBuyFor）
      local buyForOne = Arb.VendorBuyFor(offer.itemID, 1)
      local buyPrice = (buyForOne and buyForOne.unit) or offer.price
      local supply, supplySource = Arb.ListedSupply(offer.itemID)
      local row = {
        listedSupply = supply, listedSupplySource = supplySource,
        outputID = offer.itemID, name = Arb.ItemName(offer.itemID), kind = "vendor",
        vendorPrice = buyPrice, listPrice = offer.price, vendorNPC = offer.npc, vendorZone = offer.zone,
        vendorStock = offer.stock, vendorStack = offer.stack, vendorInfinite = offer.infinite == true,
        vendorSources = offer.sources, vendorTotalStock = offer.totalStock,
        vendorAt = offer.at,
        price = price, record = record, priceSource = priceSource,
      }
      if price and price > 0 then
        row.revenue = price
        row.cut = price * cut
        row.profit = price - row.cut - buyPrice
        row.roi = buyPrice > 0 and row.profit / buyPrice or 0
        row.margin = row.profit / price
        row.profitPerUnit = row.profit
      else
        row.reason = "产物暂无拍卖行报价"
      end
      rows[#rows + 1] = row
    end
    tsort(rows, function(a, b)
      if (a.profit or -huge) ~= (b.profit or -huge) then return (a.profit or -huge) > (b.profit or -huge) end
      return (a.roi or 0) > (b.roi or 0)
    end)
    vendorRowsCache = { stamp = stamp, rows = rows }
  end

  local rows, profitable, hidden, priced = {}, 0, 0, 0
  for _, row in ipairs(vendorRowsCache.rows) do
    local keep = true
    if row.price then priced = priced + 1 end
    if keep then keep = passesSupply(row, options.minSupply) end
    if keep and options.onlyProfitable and not (row.profit and row.profit > 0) then keep = false end
    if keep and options.query and options.query ~= "" then
      local parts = { row.name or "", row.vendorNPC or "", row.vendorZone or "" }
      for _, source in ipairs(row.vendorSources or {}) do
        parts[#parts + 1] = source.npc or ""
        parts[#parts + 1] = source.zone or ""
      end
      if not find(lower(tconcat(parts, " ")), lower(options.query), 1, true) then keep = false end
    end
    if keep then
      if row.profit and row.profit > 0 then profitable = profitable + 1 end
      rows[#rows + 1] = row
    else
      hidden = hidden + 1
    end
  end
  return rows, {
    offers = #Arb.VendorOffers(), shown = #rows, hidden = hidden, profitable = profitable,
    priced = priced, cut = cut, state = Arb.ApiState(), provider = Arb.MarketProvider(),
  }
end

-- ============================================================================
-- 4c. 拍卖行买入 → 卖给 NPC 商人套利（低于商人收购价的挂单，无拍卖手续费）
-- ============================================================================

-- 无限服 1.60.1 部分充能/消耗品客户端 GetItemInfo 卖价与商人实付不符的已知修正（铜）
local FOREVER_VENDOR_PAYOUTS = {
  [20744] = 100, -- 初级巫师之油（客户端数据标 5 银，无限服实测商人收购 1 银）
}

-- 无限服 1.60.1 客户端旧 GetItemInfo 仍带卖价、但实际不可卖给商人的物品黑名单
-- 典型案例：5530 致盲粉（GetItemInfo 标 1 银 25 铜，实际上无法出售给 NPC 商人）
local KNOWN_UNSELLABLE_ITEMS = {
  [5530] = true, -- 致盲粉
}

local function isUnsellableItem(itemID)
  local id = tonumber(itemID)
  if not id then return true end
  if KNOWN_UNSELLABLE_ITEMS[id] then return true end
  local saved = type(WoWFDB) == "table" and WoWFDB.unsellableItems
  return type(saved) == "table" and saved[id] == true
end

local function markUnsellableItem(itemID)
  local id = tonumber(itemID)
  if not id or id <= 0 then return false end
  WoWFDB = WoWFDB or {}
  if type(WoWFDB.unsellableItems) ~= "table" then WoWFDB.unsellableItems = {} end
  WoWFDB.unsellableItems[id] = true
  tooltipSellCache[id] = { price = 0, unsellable = true }
  unsellableVersion = unsellableVersion + 1
  flipRowsCache = { stamp = nil }
  return true
end

---将指定物品加入「拍卖→商人」永久拉黑名单（商人拒收 / 无卖价时使用）
---@param itemID number
---@return boolean
function Arb.MarkFlipUnsellable(itemID)
  return markUnsellableItem(itemID)
end

local function flipItemClass(itemID)
  local db = _G.BlackthornesTSDB
  local facts = type(db) == "table" and type(db.itemFacts) == "table" and db.itemFacts[itemID] or nil
  if type(facts) == "table" and tonumber(facts.c) then
    return tonumber(facts.c)
  end
  local instant = (type(C_Item) == "table" and type(C_Item.GetItemInfoInstant) == "function" and C_Item.GetItemInfoInstant)
    or (type(GetItemInfoInstant) == "function" and GetItemInfoInstant)
  if instant then
    local ok, _, _, _, _, _, classID = pcall(instant, itemID)
    if ok and tonumber(classID) then return tonumber(classID) end
  end
  return nil
end

local function isFlipGearClass(classID)
  return classID == 2 or classID == 4 -- 武器(2) / 护甲(4)
end

local function parseTooltipSellData(data)
  if type(data) ~= "table" or type(data.lines) ~= "table" or #data.lines == 0 then
    return nil, false, false, false
  end
  if #data.lines == 1 and type(data.lines[1]) == "table" and type(data.lines[1].leftText) == "string" then
    local txt = data.lines[1].leftText
    local retrieving = _G.RETRIEVING_ITEM_INFO
    if (type(retrieving) == "string" and retrieving ~= "" and txt == retrieving)
      or find(txt, "正在获取", 1, true) or find(lower(txt), "retrieving", 1, true) then
      return nil, false, false, false
    end
  end

  local enum = Enum and Enum.TooltipDataLineType
  local sellType = (type(enum) == "table" and enum.SellPrice) or 11
  local unsellableText = _G.ITEM_UNSELLABLE
  local chargeFmt = _G.ITEM_SPELL_CHARGES
  local chargePatterns = {}
  if type(chargeFmt) == "string" and find(chargeFmt, "%d", 1, true) then
    for _, pick in ipairs({ "%1", "%2" }) do
      local okPat, pat = pcall(function()
        local t = gsub(chargeFmt, "|4([^:;]*):([^;]*);", pick)
        t = gsub(t, "%%d", "\1")
        t = gsub(t, "([%(%)%.%%%+%-%*%?%[%]%^%$])", "%%%1")
        return "^" .. gsub(t, "\1", "(%%d+)") .. "$"
      end)
      if okPat and type(pat) == "string" then
        chargePatterns[#chargePatterns + 1] = pat
      end
    end
  end

  local foundPrice, hasCharges, explicitUnsellable = nil, false, false
  for _, line in ipairs(data.lines) do
    if type(line) == "table" then
      local price, kind, text = line.price, line.type, line.leftText
      if type(line.args) == "table" then
        for _, arg in ipairs(line.args) do
          if type(arg) == "table" then
            if arg.field == "type" and kind == nil then kind = arg.intVal end
            if arg.field == "price" and price == nil then price = arg.intVal end
            if arg.field == "leftText" and text == nil then text = arg.stringVal end
          end
        end
      end
      if foundPrice == nil and kind == sellType and type(price) == "number" and price >= 0 then
        foundPrice = price
      end
      if type(text) == "string" and text ~= "" then
        if (type(unsellableText) == "string" and unsellableText ~= "" and find(text, unsellableText, 1, true))
          or find(text, "不可出售", 1, true) or find(text, "无法出售", 1, true)
          or find(lower(text), "no sell price", 1, true) then
          explicitUnsellable = true
        end
        if text:match("^(%d+)%s*[Cc]harges?$") or text:match("^(%d+)%s*次使用") or text:match("^(%d+)%s*次充能") then
          hasCharges = true
        else
          for _, pat in ipairs(chargePatterns) do
            if text:match(pat) then
              hasCharges = true
              break
            end
          end
        end
      end
    end
  end

  if hasCharges then
    return nil, true, false, true
  end
  if explicitUnsellable or foundPrice == nil or foundPrice <= 0 then
    return 0, true, true, false
  end
  return foundPrice, true, false, false
end

local function inspectTooltipSellPrice(itemID)
  local cTip = _G.C_TooltipInfo
  if type(cTip) ~= "table" or type(cTip.GetItemByID) ~= "function" then
    return nil, false, false, false
  end
  local ok, data = pcall(cTip.GetItemByID, itemID)
  if not ok then
    return nil, false, false, false
  end
  return parseTooltipSellData(data)
end

local function inspectTooltipLinkSellPrice(itemLink)
  if type(itemLink) ~= "string" or itemLink == "" then
    return nil, false, false, false
  end
  local cTip = _G.C_TooltipInfo
  if type(cTip) ~= "table" or type(cTip.GetHyperlink) ~= "function" then
    return nil, false, false, false
  end
  local ok, data = pcall(cTip.GetHyperlink, itemLink)
  if not ok then
    return nil, false, false, false
  end
  return parseTooltipSellData(data)
end

local function flipFactsSignature()
  local ns = _G.BlackthornesTS
  local de = type(ns) == "table" and ns.Disenchant
  local deVer = (type(de) == "table" and tonumber(de.factsVersion)) or -1
  local db = _G.BlackthornesTSDB
  local factsCount = (type(db) == "table" and type(db.itemFacts) == "table") and tableEntryCount(db.itemFacts) or 0
  local paidCount = (type(db) == "table" and type(db.vendorPaid) == "table") and tableEntryCount(db.vendorPaid) or 0
  return tconcat({ tostring(revision()), floor(deVer), factsCount, paidCount, tostring(itemDataVersion), unsellableVersion }, "|")
end

local function flipBuyPrice(record)
  if type(record) ~= "table" then return nil, false end
  local price
  local ns = _G.BlackthornesTS
  local de = type(ns) == "table" and ns.Disenchant
  if type(de) == "table" and type(de._BuyPrice) == "function" then
    local ok, p = pcall(de._BuyPrice, record)
    if ok and type(p) == "number" and p > 0 then price = p end
  end
  if not price then
    local rival = tonumber(record.rivalMin)
    local lone = tonumber(record.ignoredLow)
    if rival and rival > 0 then price = rival end
    if lone and lone > 0 and (not price or lone < price) then price = lone end
    -- 若无任何 rivals/ignored/own 区分字段，说明是早期仅记录 min 的快照，允许回退到 min；
    -- 一旦存在 ownMin 而无 rivalMin/ignoredLow，说明仅有本人挂单，不得推荐「自己买自己」。
    if not price and record.rivalMin == nil and record.ignoredLow == nil and record.ownMin == nil then
      local rawMin = tonumber(record.min)
      if rawMin and rawMin > 0 then price = rawMin end
    end
  end
  if not price or price <= 0 then return nil, false end
  local loneLow = tonumber(record.ignoredLow) ~= nil and price == tonumber(record.ignoredLow)
  return price, loneLow
end

local function flipVendorSell(itemID)
  local ns = _G.BlackthornesTS
  local db = _G.BlackthornesTSDB

  local vendorMod = type(ns) == "table" and ns.Vendor
  if type(vendorMod) == "table" and type(vendorMod.GetPaid) == "function" then
    local ok, pay, paidFrom = pcall(vendorMod.GetPaid, vendorMod, itemID)
    if ok and type(pay) == "number" and pay > 0 then
      return pay, paidFrom or "sold", false, false
    end
  elseif type(db) == "table" and type(db.vendorPaid) == "table" then
    local rec = db.vendorPaid[itemID]
    local pay = type(rec) == "table" and tonumber(rec.pay) or nil
    if pay and pay > 0 then
      return pay, "sold", false, false
    end
  end
  local reported = FOREVER_VENDOR_PAYOUTS[itemID]
  if reported and reported > 0 then
    return reported, "reported", false, false
  end

  local de = type(ns) == "table" and ns.Disenchant
  if type(de) == "table" and type(de.GetSellPrice) == "function" then
    local okP, sell = pcall(de.GetSellPrice, de, itemID)
    if not okP or sell == nil then
      local gaveUp = false
      if type(de.GaveUp) == "function" then
        local okG, res = pcall(de.GaveUp, de, itemID)
        gaveUp = okG and res == true
      end
      return nil, nil, false, not gaveUp
    end
    if type(de.SellPriceUnsure) == "function" then
      local okU, isUnsure = pcall(de.SellPriceUnsure, de, itemID)
      if okU and isUnsure == true then
        return nil, nil, true, false
      end
    end
    if type(sell) == "number" and sell > 0 then
      return sell, "facts", false, false
    end
    return nil, nil, false, false
  end

  local facts = type(db) == "table" and type(db.itemFacts) == "table" and db.itemFacts[itemID] or nil
  if type(facts) ~= "table" or facts.v == nil then
    return nil, nil, false, true
  end
  if (tonumber(facts.ch) or 0) > 0 then
    return nil, nil, true, false
  end
  local sell = tonumber(facts.v)
  if sell and sell > 0 then
    return sell, "facts", false, false
  end
  return nil, nil, false, false
end

local function flipItemDisplay(itemID)
  local db = _G.BlackthornesTSDB
  local facts = type(db) == "table" and type(db.itemFacts) == "table" and db.itemFacts[itemID] or nil
  local name, quality
  if type(facts) == "table" then
    if type(facts.n) == "string" and facts.n ~= "" then name = facts.n end
    quality = tonumber(facts.q)
  end
  if not name then
    local ns = _G.BlackthornesTS
    local de = type(ns) == "table" and ns.Disenchant
    if type(de) == "table" and type(de.KnownName) == "function" then
      local ok, known = pcall(de.KnownName, de, itemID)
      if ok and type(known) == "string" and known ~= "" then name = known end
    end
  end
  if not name and itemCache[itemID] and itemCache[itemID].name then
    name = itemCache[itemID].name
    quality = quality or itemCache[itemID].quality
  end
  return name or format("物品 #%s", tostring(itemID)), quality
end

local function flipLadderSummary(record, buyPrice, vendorSell, loneLow)
  local ladder = record.ladder
  if type(ladder) == "table" and #ladder >= 2 and #ladder % 2 == 0 then
    local qty, profitTotal = 0, 0
    for i = 1, #ladder, 2 do
      local p, q = tonumber(ladder[i]) or 0, tonumber(ladder[i + 1]) or 0
      if p > 0 and q > 0 and p < vendorSell then
        qty = qty + q
        profitTotal = profitTotal + (vendorSell - p) * q
      end
    end
    if qty > 0 then return qty, profitTotal end
    if loneLow then return 1, vendorSell - buyPrice end
    return nil, nil
  end
  local ns = _G.BlackthornesTS
  local pricesMod = type(ns) == "table" and ns.Prices
  if type(pricesMod) == "table" and type(pricesMod.CountAtOrBelow) == "function" and vendorSell > 1 then
    local ok, cnt = pcall(pricesMod.CountAtOrBelow, record, vendorSell - 1)
    if ok and tonumber(cnt) and tonumber(cnt) > 0 then
      return floor(tonumber(cnt)), nil
    end
  end
  return nil, nil
end

---扫描拍卖行当前在售中「买入价低于 NPC 商人收购价」的套利商品
---严格避免全量扫描期间调用 GetItemInfo 驱逐背包缓存，仅依赖黑石已保存的物品事实与实测卖店价；
---只检视最近一次扫描见到过的在售记录，卖出给 NPC 商人无 5% 拍卖手续费。
---@param options table|nil { onlyProfitable = bool, minSupply = number|nil, query = string|nil }
---@return table[] rows
---@return table meta
function Arb.VendorFlipArbitrage(options)
  options = type(options) == "table" and options or {}
  local stamp = flipFactsSignature()
  if flipRowsCache.stamp ~= stamp then
    local built = {}
    local prices = blackthornesPriceTable() or {}
    local since = blackthornesLastScan()
    local scanned, checked, unsureCount, pendingCount = 0, 0, 0, 0
    for itemID, record in pairs(prices) do
      local id = tonumber(itemID)
      if id and type(record) == "table" and not isUnsellableItem(id)
        and (since == 0 or (tonumber(record.seen) or 0) >= since) then
        local buyPrice, loneLow = flipBuyPrice(record)
        if buyPrice then
          scanned = scanned + 1
          local vendorSell, sellSource, unsure, pending = flipVendorSell(id)
          local classID = flipItemClass(id)
          -- 任务物品（classID=12）默认不可卖给商店，除非玩家实测卖店成功过
          if classID == 12 and sellSource ~= "sold" then
            vendorSell = nil
          end
          -- 若当前可套利且非玩家实测卖店价，尝试用已缓存的 Tooltip 卖价做一次兜底校验：
          -- 黑石旧 itemFacts 会把「Tooltip 无卖价」回退成旧 GetItemInfo（如 5530 致盲粉），此处直接拦截并拉黑。
          if vendorSell and vendorSell > buyPrice and sellSource ~= "sold" then
            local tipCached = tooltipSellCache[id]
            if tipCached == nil then
              local cTip = _G.C_TooltipInfo
              if type(cTip) == "table" and type(cTip.GetItemByID) == "function" then
                local canInspect = true
                if type(C_Item) == "table" and type(C_Item.IsItemDataCachedByID) == "function" then
                  local okC, cached = pcall(C_Item.IsItemDataCachedByID, id)
                  canInspect = okC and cached == true
                end
                if canInspect then
                  local tipPrice, tipRead, tipUnsellable, tipCharges = inspectTooltipSellPrice(id)
                  if tipRead then
                    if tipCharges then
                      tipCached = { price = 0, unsure = true }
                    elseif tipUnsellable then
                      markUnsellableItem(id)
                      tipCached = tooltipSellCache[id]
                    elseif tipPrice and tipPrice > 0 then
                      tipCached = { price = tipPrice }
                    end
                    if tipCached then tooltipSellCache[id] = tipCached end
                  end
                end
              end
            end
            if tipCached then
              if tipCached.unsellable then
                vendorSell = nil
              elseif tipCached.unsure then
                vendorSell, unsure = nil, true
              elseif tipCached.price and tipCached.price > 0 then
                if sellSource == "reported" then
                  vendorSell = min(vendorSell, tipCached.price)
                else
                  vendorSell, sellSource = tipCached.price, "tooltip"
                end
              end
            end
          end

          if unsure then
            unsureCount = unsureCount + 1
          elseif pending then
            pendingCount = pendingCount + 1
          else
            checked = checked + 1
          end
          if vendorSell and vendorSell > buyPrice then
            local profit = vendorSell - buyPrice
            local buyableQty, totalProfit = flipLadderSummary(record, buyPrice, vendorSell, loneLow)
            local supply, supplySource = Arb.ListedSupply(id)
            local itemName, quality = flipItemDisplay(id)
            built[#built + 1] = {
              kind = "flip",
              outputID = id,
              name = itemName,
              quality = quality,
              classID = classID,
              isGear = isFlipGearClass(classID),
              buyPrice = buyPrice,
              loneLow = loneLow == true,
              vendorSell = vendorSell,
              vendorSellSource = sellSource,
              price = vendorSell,
              revenue = vendorSell,
              cut = 0,
              profit = profit,
              profitPerUnit = profit,
              roi = buyPrice > 0 and profit / buyPrice or 0,
              margin = vendorSell > 0 and profit / vendorSell or 0,
              buyableQty = buyableQty,
              totalProfit = totalProfit,
              listedSupply = supply,
              listedSupplySource = supplySource,
              seen = tonumber(record.seen) or 0,
            }
          end
        end
      end
    end
    tsort(built, function(a, b)
      if a.profit ~= b.profit then return a.profit > b.profit end
      if a.roi ~= b.roi then return a.roi > b.roi end
      return a.outputID < b.outputID
    end)
    flipRowsCache = {
      stamp = stamp,
      rows = built,
      scanned = scanned,
      checked = checked,
      unsure = unsureCount,
      pending = pendingCount,
    }
  end

  local rows, profitable, hidden = {}, 0, 0
  for _, row in ipairs(flipRowsCache.rows or {}) do
    local keep = not isUnsellableItem(row.outputID)
    if keep then keep = passesSupply(row, options.minSupply) end
    if keep and options.gearOnly == true and not row.isGear and row.vendorSellSource ~= "sold" then
      keep = false
    end
    if keep and options.onlyProfitable and not (row.profit and row.profit > 0) then keep = false end
    if keep and options.query and options.query ~= "" then
      local hay = lower((row.name or "") .. " " .. tostring(row.outputID or ""))
      if not find(hay, lower(options.query), 1, true) then keep = false end
    end
    if keep then
      if row.profit and row.profit > 0 then profitable = profitable + 1 end
      rows[#rows + 1] = row
    else
      hidden = hidden + 1
    end
  end
  return rows, {
    scanned = flipRowsCache.scanned or 0,
    checked = flipRowsCache.checked or 0,
    unsure = flipRowsCache.unsure or 0,
    pending = flipRowsCache.pending or 0,
    found = #(flipRowsCache.rows or {}),
    shown = #rows,
    hidden = hidden,
    profitable = profitable,
    state = Arb.ApiState(),
    provider = Arb.MarketProvider(),
  }
end

-- ============================================================================
-- 5. 分解收益（1.60.1 分解表，按装等 + 品质 + 护甲/武器）
-- 数据参考 Warcraft Wiki「Disenchanting tables」，超过表中最高档时沿用最后一档
-- ============================================================================

local DE_UNCOMMON_ARMOR = {
  { 5, 15, { { 10940, 0.80, 1, 2 }, { 10938, 0.20, 1, 2 } } },
  { 16, 20, { { 10940, 0.75, 2, 3 }, { 10939, 0.20, 1, 2 }, { 10978, 0.05, 1, 1 } } },
  { 21, 25, { { 10940, 0.75, 4, 6 }, { 10998, 0.15, 1, 2 }, { 10978, 0.10, 1, 1 } } },
  { 26, 30, { { 11083, 0.75, 1, 2 }, { 11082, 0.20, 1, 2 }, { 11084, 0.05, 1, 1 } } },
  { 31, 35, { { 11083, 0.75, 2, 5 }, { 11134, 0.20, 1, 2 }, { 11138, 0.05, 1, 1 } } },
  { 36, 40, { { 11137, 0.75, 1, 2 }, { 11135, 0.20, 1, 2 }, { 11139, 0.05, 1, 1 } } },
  { 41, 45, { { 11137, 0.75, 2, 5 }, { 11174, 0.20, 1, 2 }, { 11177, 0.05, 1, 1 } } },
  { 46, 50, { { 11176, 0.75, 1, 2 }, { 11175, 0.20, 1, 2 }, { 11178, 0.05, 1, 1 } } },
  { 51, 55, { { 11176, 0.75, 2, 5 }, { 16202, 0.20, 1, 2 }, { 14343, 0.05, 1, 1 } } },
  { 56, 60, { { 16204, 0.75, 1, 2 }, { 16203, 0.20, 1, 2 }, { 14344, 0.05, 1, 1 } } },
  { 61, 65, { { 16204, 0.75, 2, 5 }, { 16203, 0.20, 2, 3 }, { 14344, 0.05, 1, 1 } } },
}

local DE_UNCOMMON_WEAPON = {
  { 6, 15, { { 10940, 0.20, 1, 2 }, { 10938, 0.80, 1, 2 } } },
  { 16, 20, { { 10940, 0.20, 2, 3 }, { 10939, 0.75, 1, 2 }, { 10978, 0.05, 1, 1 } } },
  { 21, 25, { { 10940, 0.15, 4, 6 }, { 10998, 0.75, 1, 2 }, { 10978, 0.10, 1, 1 } } },
  { 26, 30, { { 11083, 0.20, 1, 2 }, { 11082, 0.75, 1, 2 }, { 11084, 0.05, 1, 1 } } },
  { 31, 35, { { 11083, 0.20, 2, 5 }, { 11134, 0.75, 1, 2 }, { 11138, 0.05, 1, 1 } } },
  { 36, 40, { { 11137, 0.20, 1, 2 }, { 11135, 0.75, 1, 2 }, { 11139, 0.05, 1, 1 } } },
  { 41, 45, { { 11137, 0.20, 2, 5 }, { 11174, 0.75, 1, 2 }, { 11177, 0.05, 1, 1 } } },
  { 46, 50, { { 11176, 0.20, 1, 2 }, { 11175, 0.75, 1, 2 }, { 11178, 0.05, 1, 1 } } },
  { 51, 55, { { 11176, 0.22, 2, 5 }, { 16202, 0.75, 1, 2 }, { 14343, 0.03, 1, 1 } } },
  { 56, 60, { { 16204, 0.22, 1, 2 }, { 16203, 0.75, 1, 2 }, { 14344, 0.03, 1, 1 } } },
  { 61, 65, { { 16204, 0.22, 2, 5 }, { 16203, 0.75, 2, 3 }, { 14344, 0.03, 1, 1 } } },
}

local DE_RARE = {
  { 1, 25, { { 10978, 1, 1, 1 } } },
  { 26, 30, { { 11084, 1, 1, 1 } } },
  { 31, 35, { { 11138, 1, 1, 1 } } },
  { 36, 40, { { 11139, 1, 1, 1 } } },
  { 41, 45, { { 11177, 1, 1, 1 } } },
  { 46, 50, { { 11178, 1, 1, 1 } } },
  { 51, 55, { { 14343, 1, 1, 1 } } },
  { 56, 200, { { 14344, 0.995, 1, 1 }, { 20725, 0.005, 1, 1 } } },
}

local DE_EPIC = {
  { 40, 45, { { 11177, 1, 2, 4 } } },
  { 46, 50, { { 11178, 1, 2, 4 } } },
  { 51, 55, { { 14343, 1, 2, 4 } } },
  { 56, 60, { { 20725, 1, 1, 1 } } },
  { 61, 88, { { 20725, 1, 1, 2 } } },
  { 89, 200, { { 20725, 1, 1, 2 } } },
}

---在分解表中找到覆盖该装等的一档（超出最高档时沿用最后一档）
local function pickBand(bands, ilvl)
  local last
  for _, band in ipairs(bands) do
    if ilvl >= band[1] and ilvl <= band[2] then return band[3] end
    if ilvl > band[2] then last = band[3] end
  end
  return last
end

---估算分解收益（期望值）
---@param itemID number
---@return table|nil result 形如 { ev, parts = { { itemID, chance, quantity, unit, value } }, unknown, incomplete }
---@return string|nil reason
function Arb.Disenchant(itemID)
  local info = Arb.Items(itemID)
  if not info or not info.loaded then return nil, "物品数据尚未加载" end
  if not info.gear then return nil, "该物品不是护甲或武器" end
  local quality, ilvl = info.quality or 0, info.ilvl or 0
  local bands
  if quality == 4 and ilvl >= 40 then
    bands = DE_EPIC
  elseif quality == 3 or quality == 4 then
    bands = DE_RARE
  elseif quality == 2 then
    bands = info.weapon and DE_UNCOMMON_WEAPON or DE_UNCOMMON_ARMOR
  else
    return nil, "只有绿/蓝/紫装可以分解"
  end
  local parts = pickBand(bands, ilvl)
  if not parts then return nil, "装等不在分解表范围内" end

  local result = { ev = 0, parts = {}, unknown = {} }
  for _, part in ipairs(parts) do
    local materialID, chance = part[1], part[2]
    local quantity = ((part[3] or 1) + (part[4] or part[3] or 1)) / 2
    local unit = Arb.PriceFor(materialID, 1)
    if unit then
      local value = unit * quantity * chance
      result.ev = result.ev + value
      tinsert(result.parts, { itemID = materialID, chance = chance, quantity = quantity, unit = unit, value = value })
    else
      tinsert(result.unknown, materialID)
    end
  end
  if #result.parts == 0 then return nil, "分解材料暂无报价" end
  result.incomplete = #result.unknown > 0
  return result
end

-- ============================================================================
-- 6. 成本引擎：先做结构决策，再对整条方案的原料统一计价
-- ============================================================================

local function averageYield(recipe)
  local low = tonumber(recipe.qMin) or 1
  local high = tonumber(recipe.qMax) or low
  if high < low then high = low end
  return (low + high) / 2
end

---递归路径签名：同一配方在不同路径下可用性不同，缓存键必须带上它
local function pathKey(path)
  local names = {}
  for itemID in pairs(path) do names[#names + 1] = tostring(itemID) end
  sort(names)
  return tconcat(names, ",")
end

---候选自产配方：优先当前角色，允许时可借用同账号其他角色
local function producersFor(itemID, ctx)
  local producers = ctx.index[itemID]
  if not producers then return nil end
  local own, others = {}, {}
  for _, producer in ipairs(producers) do
    if producer.owner == ctx.owner then
      tinsert(own, producer)
    else
      tinsert(others, producer)
    end
  end
  if #own > 0 then return own end
  return ctx.crossOwner and others or nil
end

---估算某物品「自己做」的单件成本与选中的配方（前向声明，供 estimateRecipe 调用）
local estimateUnit

---估算一条配方的单件成本（仅用于「直购 vs 自产」决策）
local function estimateRecipe(recipe, ctx)
  local key = "r:" .. tostring(recipe.id) .. ":" .. tostring(ctx.depth) .. ":" .. pathKey(ctx.path)
  local cached = ctx.est[key]
  if cached ~= nil then return cached or nil end
  ctx.est[key] = false

  local childCtx = {
    depth = ctx.depth - 1, path = ctx.path, est = ctx.est, index = ctx.index,
    owner = ctx.owner, crossOwner = ctx.crossOwner,
  }

  local function ingredientUnit(itemID)
    local buy, _, buyDetail = Arb.PriceFor(itemID, 1)
    local best = buy
    local made = estimateUnit(itemID, childCtx)
    local madeCost = made and made.cost or nil
    if madeCost then
      -- 直购买不齐时，即便自产更贵也应选自产，避免「缺货估价」盖掉可执行方案
      if not buy or (buyDetail and buyDetail.shortfall) or madeCost < buy then best = madeCost end
    end
    return best
  end

  local total = 0
  for _, reagent in ipairs(recipe.reagents or {}) do
    local unit = ingredientUnit(reagent.id)
    if not unit then ctx.est[key] = false; return nil end
    total = total + unit * reagent.qty
  end
  for _, slot in ipairs(recipe.slots or {}) do
    local best
    for _, candidate in ipairs(slot.candidates or {}) do
      local unit = ingredientUnit(candidate)
      if unit and (not best or unit < best) then best = unit end
    end
    if not best then ctx.est[key] = false; return nil end
    total = total + best * (slot.qty or 1)
  end

  local perUnit = total / averageYield(recipe)
  ctx.est[key] = perUnit
  return perUnit
end

---估算某物品「自己做」的单件成本与选中的配方
estimateUnit = function(itemID, ctx)
  local key = "u:" .. tostring(itemID) .. ":" .. tostring(ctx.depth) .. ":" .. pathKey(ctx.path)
  local cached = ctx.est[key]
  if cached ~= nil then return cached or nil end
  if ctx.depth <= 0 or ctx.path[itemID] then
    ctx.est[key] = false
    return nil
  end
  local producers = producersFor(itemID, ctx)
  if not producers then
    ctx.est[key] = false
    return nil
  end
  ctx.est[key] = false
  ctx.path[itemID] = true
  local best
  for _, producer in ipairs(producers) do
    local cost = estimateRecipe(producer, ctx)
    if cost and cost > 0 and (not best or cost < best.cost) then
      best = { recipe = producer, cost = cost }
    end
  end
  ctx.path[itemID] = nil
  ctx.est[key] = best or false
  return best
end

---收集整条方案需要从拍卖行购买的原料（按物品合并总量；中间产物按保底单批产量向上取整）
local function collectDemand(plan, factor, demand)
  for _, ingredient in ipairs(plan.ingredients) do
    local qty = ingredient.qty * factor
    if ingredient.craft then
      local minYield = ingredient.craft.minYield or ingredient.craft.yield or 1
      local batches = ceil(qty / minYield)
      if factor == 1 then ingredient.batches = batches end
      collectDemand(ingredient.craft, batches, demand)
    else
      demand[ingredient.itemID] = (demand[ingredient.itemID] or 0) + qty
    end
  end
end

---用合并后的数量统一计价（同一种原料只按一次真实深度购买）
local function priceDemand(demand)
  local prices, total, unpriced, short = {}, 0, {}, false
  for itemID, qty in pairs(demand) do
    local unit, source, detail = Arb.PriceFor(itemID, qty)
    prices[itemID] = { unit = unit, source = source, amount = qty, shortfall = (detail and detail.shortfall) ~= nil }
    if unit then
      total = total + unit * qty
      if detail and detail.shortfall then short = true end
    else
      tinsert(unpriced, itemID)
    end
  end
  return prices, total, unpriced, short
end

---按统一价格回算方案成本（叶子用合并单价，自产节点按保底批次递归）
local function planCost(plan, factor, prices)
  local total = 0
  for _, ingredient in ipairs(plan.ingredients) do
    local qty = ingredient.qty * factor
    if ingredient.craft then
      local minYield = ingredient.craft.minYield or ingredient.craft.yield or 1
      local batches = ceil(qty / minYield)
      local sub = planCost(ingredient.craft, batches, prices)
      if sub == nil then return nil end
      total = total + sub
    else
      local quote = prices[ingredient.itemID]
      if not quote or not quote.unit then return nil end
      total = total + quote.unit * qty
    end
  end
  return total
end

---按保底批次数对子方案进行实际深度计价（用于自产与直购决策）
local function quotePlan(plan, batches)
  local demand = {}
  collectDemand(plan, batches, demand)
  local prices, _, unpriced, short = priceDemand(demand)
  local cost = planCost(plan, batches, prices)
  return cost, #unpriced == 0 and cost ~= nil, short
end

---按结构决策展开一条配方：产出 yield 件，递归把可自产的原料替换成子配方（按实际批次数 factor 比较直购与自产）
local function expandPlan(recipe, ctx)
  local factor = max(1, ctx.factor or 1)
  local key = "p:" .. tostring(recipe.id) .. ":" .. tostring(factor) .. ":" .. tostring(ctx.depth) .. ":" .. pathKey(ctx.path)
  local cached = ctx.expanded[key]
  if cached ~= nil then return cached or nil end
  ctx.expanded[key] = false

  local minYield = max(1, tonumber(recipe.qMin) or 1)
  local plan = { recipe = recipe, yield = averageYield(recipe), minYield = minYield, ingredients = {}, crafts = {} }
  local childCtx = {
    depth = ctx.depth, path = ctx.path, est = ctx.est, expanded = ctx.expanded,
    index = ctx.index, owner = ctx.owner, crossOwner = ctx.crossOwner,
  }

  local function optionRank(complete, short, cost)
    return (complete and 0 or 2) + (short and 1 or 0), cost or huge
  end

  local function betterOption(candRank, candCost, bestRank, bestCost)
    if candRank ~= bestRank then return candRank < bestRank end
    return candCost < bestCost
  end

  local function resolve(itemID, baseQty)
    local qty = baseQty * factor
    local buy, _, buyDetail = Arb.PriceFor(itemID, qty)
    local buyComplete = buy ~= nil
    local buyShort = (buyDetail and buyDetail.shortfall) ~= nil
    local buyTotal = buy and (buy * qty) or nil
    local buyRank, buyCost = optionRank(buyComplete, buyShort, buyTotal)

    local made
    if childCtx.depth > 0 and not childCtx.path[itemID] then
      local producers = producersFor(itemID, childCtx)
      if producers then
        childCtx.path[itemID] = true
        for _, producer in ipairs(producers) do
          local subMinYield = max(1, tonumber(producer.qMin) or 1)
          local batches = ceil(qty / subMinYield)
          local sub = expandPlan(producer, {
            depth = childCtx.depth - 1, factor = batches, path = childCtx.path, est = ctx.est, expanded = ctx.expanded,
            index = ctx.index, owner = ctx.owner, crossOwner = ctx.crossOwner,
          })
          if sub then
            local batchTotal, complete, short = quotePlan(sub, batches)
            local rank, cost = optionRank(complete, short, batchTotal)
            if not made or betterOption(rank, cost, made.rank, made.cost) then
              made = { rank = rank, cost = cost, complete = complete, short = short, batchTotal = batchTotal, plan = sub }
            end
          end
        end
        childCtx.path[itemID] = nil
      end
    end
    -- 优先可买齐且完整报价的方案；同等级时比较实际所需批次总成本与直购总成本
    if made and betterOption(made.rank, made.cost, buyRank, buyCost) then
      return { itemID = itemID, qty = baseQty, craft = made.plan, crossOwner = made.plan.recipe.owner ~= ctx.owner }
    end
    return { itemID = itemID, qty = baseQty }
  end

  for _, reagent in ipairs(recipe.reagents or {}) do
    plan.ingredients[#plan.ingredients + 1] = resolve(reagent.id, reagent.qty)
  end
  for _, slot in ipairs(recipe.slots or {}) do
    local baseQuantity = max(1, tonumber(slot.qty) or 1)
    local quantity = baseQuantity * factor
    local best
    for _, candidate in ipairs(slot.candidates or {}) do
      local option = resolve(candidate, baseQuantity)
      local rank, cost
      if option.craft then
        local batches = ceil(quantity / option.craft.minYield)
        local batchTotal, complete, short = quotePlan(option.craft, batches)
        rank, cost = optionRank(complete, short, batchTotal)
      else
        local unit, _, detail = Arb.PriceFor(candidate, quantity)
        rank, cost = optionRank(unit ~= nil, (detail and detail.shortfall) ~= nil, unit and (unit * quantity) or nil)
      end
      if not best or betterOption(rank, cost, best.rank, best.cost) then
        best = { option = option, rank = rank, cost = cost }
      end
    end
    if best then plan.ingredients[#plan.ingredients + 1] = best.option end
  end

  -- 结构成本 = 完整报价时各原料按保底批次汇总的可执行成本；缺报价时保留 complete=false
  local total, complete, short = 0, true, false
  for _, ingredient in ipairs(plan.ingredients) do
    if ingredient.craft then
      local batches = ceil(ingredient.qty / ingredient.craft.minYield)
      ingredient.batches = batches
      plan.crafts[#plan.crafts + 1] = ingredient
      if ingredient.craft.complete and ingredient.craft.total then
        total = total + ingredient.craft.total * batches
      else
        complete = false
      end
      if ingredient.craft.shortfall then short = true end
    else
      local unit, _, detail = Arb.PriceFor(ingredient.itemID, ingredient.qty)
      if unit then
        total = total + unit * ingredient.qty
        if detail and detail.shortfall then short = true end
      else
        complete = false
      end
    end
  end
  plan.complete = complete
  plan.shortfall = short
  plan.total = complete and total or nil
  ctx.expanded[key] = plan
  return plan
end

---把结构里的材料明细展开成展示用数据（采购清单 + 自产说明）
local function describePlan(plan, factor, prices, leaves, leafIndex, crafts)
  for _, ingredient in ipairs(plan.ingredients) do
    local qty = ingredient.qty * factor
    if ingredient.craft then
      local minYield = ingredient.craft.minYield or ingredient.craft.yield or 1
      local batches = ceil(qty / minYield)
      local batchCost = planCost(ingredient.craft, batches, prices)
      local unit = batchCost and (batchCost / (batches * ingredient.craft.yield)) or nil
      tinsert(crafts, {
        itemID = ingredient.itemID, quantity = qty, batches = batches,
        recipe = ingredient.craft.recipe, crossOwner = ingredient.crossOwner == true,
        unit = unit, batchCost = batchCost, saved = nil,
      })
      describePlan(ingredient.craft, batches, prices, leaves, leafIndex, crafts)
    else
      local quote = prices[ingredient.itemID]
      local leaf = leafIndex[ingredient.itemID]
      if leaf then
        leaf.quantity = leaf.quantity + qty
      else
        leaf = { itemID = ingredient.itemID, quantity = qty, unit = quote and quote.unit or nil }
        leafIndex[ingredient.itemID] = leaf
        tinsert(leaves, leaf)
      end
    end
  end
end

-- ============================================================================
-- 7. 分析入口
-- ============================================================================

local function ensureFresh()
  local stamp = tconcat({
    tostring(revision()), recipeSignature(), tostring(itemDataVersion), tostring(Arb.ApiState()),
    vendorSignature(),
  }, "|")
  if rowCache.stamp ~= stamp then
    rowCache = { stamp = stamp }
    quoteCache, sellCache = {}, {}
  end
end

local function buildRows(mode, crossOwner)
  local list = Arb.RecipeList()
  local index = {}
  for _, recipe in ipairs(list) do
    local bucket = index[recipe.output]
    if not bucket then bucket = {}; index[recipe.output] = bucket end
    tinsert(bucket, recipe)
  end
  local cut = Arb.AuctionCut()
  local rows, priced = {}, 0
  local identity = Arb.Identity()

  for _, recipe in ipairs(list) do
    local ctx = {
      depth = MAX_CRAFT_DEPTH, path = {}, est = {}, expanded = {}, index = index,
      owner = recipe.owner, crossOwner = crossOwner == true,
    }
    local plan = expandPlan(recipe, ctx)
    local row = {
      recipeID = recipe.id, outputID = recipe.output, name = recipe.name or Arb.ItemName(recipe.output),
      professionKey = recipe.professionKey, professionName = recipe.professionName,
      owner = recipe.owner, ownerName = recipe.ownerName, ownerSource = recipe.ownerSource,
      ownCharacter = recipe.owner == identity.key or Arb.IsOwnCharacter(recipe.owner, recipe.ownerName, recipe.ruleset),
      skillUp = recipe.difficulty, skill = recipe.skill, skillMax = recipe.skillMax,
      yield = plan and plan.yield or averageYield(recipe),
    }

    local demand, leaves, leafIndex, crafts = {}, {}, {}, {}
    if plan then
      collectDemand(plan, 1, demand)
      local prices, baseTotal, unpriced, short = priceDemand(demand)
      describePlan(plan, 1, prices, leaves, leafIndex, crafts)
      local cost = planCost(plan, 1, prices)
      row.costTotal = cost
      row.partialCost = (cost == nil) and baseTotal or nil
      row.unpriced = unpriced
      row.stockShort = short
      row.craftable = (cost ~= nil) and (not short)
      for _, craft in ipairs(crafts) do
        local direct = Arb.PriceFor(craft.itemID, craft.quantity)
        if direct and craft.batchCost then craft.saved = direct * craft.quantity - craft.batchCost end
      end
    else
      row.craftable = false
      row.unpriced = {}
    end
    row.leaves, row.craftLines = leaves, crafts

    row.listedSupply, row.listedSupplySource = Arb.ListedSupply(recipe.output)
    if row.craftable then
      priced = priced + 1
      local price, record, priceSource = Arb.SellQuote(recipe.output)
      row.price, row.record, row.priceSource = price, record, priceSource
      row.sellRevenue = price and price * row.yield or nil
      if mode == "de" then
        local de = Arb.Disenchant(recipe.output)
        row.disenchant = de
        if de then
          row.revenue = de.ev * row.yield
          row.evPerUnit = de.ev
          row.disenchantIncomplete = de.incomplete
        end
      elseif row.sellRevenue then
        row.revenue = row.sellRevenue
      end
      if row.revenue then
        row.cut = row.revenue * cut
        row.profit = row.revenue - row.cut - row.costTotal
        row.profitPerUnit = row.profit / row.yield
        row.roi = row.costTotal > 0 and row.profit / row.costTotal or 0
        row.margin = row.revenue > 0 and row.profit / row.revenue or 0
        if mode == "sell" then
          -- 分解期望与直接出售对照：分解报价不完整时只能作为下界
          local de = Arb.Disenchant(recipe.output)
          if de then
            row.disenchantEV = de.ev
            row.disenchantIncomplete = de.incomplete
            if de.incomplete then
              row.disenchantWins = de.ev > (price or 0) and true or false
              row.disenchantUnknown = de.ev <= (price or 0)
            else
              row.disenchantWins = de.ev > (price or 0)
            end
          end
        end
      else
        row.reason = (mode == "de") and "无法估算分解收益" or "产物暂无市场报价"
      end
    elseif row.stockShort then
      row.reason = "部分材料在拍卖行库存不足"
    elseif #(row.unpriced or {}) > 0 then
      row.reason = "部分材料暂无报价"
    else
      row.reason = "配方没有可用的材料数据"
    end
    tinsert(rows, row)
  end
  return rows, cut, priced
end

---执行一次完整分析
---@param options table { mode = "sell"|"de", source = "craft"|"vendor"|"flip"|"both", profession = key|table|nil,
---                        ownOnly = bool, onlyProfitable = bool, onlySkillUp = bool, crossOwner = bool,
---                        minSupply = number|nil, sort = "profit"|"roi", query = string }
---@return table[] rows
---@return table meta
function Arb.Analyse(options)
  options = type(options) == "table" and options or {}
  ensureFresh()
  local mode = options.mode == "de" and "de" or "sell"
  local source = (options.source == "vendor" or options.source == "flip" or options.source == "both")
    and options.source or "craft"
  -- 商人→拍卖 / 拍卖→商人均与配方成品/分解模式无关，固定用 sell 口径
  if source == "vendor" or source == "flip" then mode = "sell" end
  local includeCraft = (source == "craft" or source == "both")
  local includeVendor = (source == "vendor" or source == "both")
  local includeFlip = (source == "flip" or source == "both")
  local crossOwner = options.crossOwner == true
  costPrefersVendor = options.preferVendor == true

  local craftCache, cut, cachedPriced = {}, DEFAULT_CUT, 0
  if includeCraft then
    local cacheKey = mode .. (crossOwner and ":cross" or ":own") .. (costPrefersVendor and ":vendor" or "")
    local cache = rowCache[cacheKey]
    if not cache then
      craftCache, cut, cachedPriced = buildRows(mode, crossOwner)
      rowCache[cacheKey] = { rows = craftCache, priced = cachedPriced, cut = cut }
    else
      craftCache, cut, cachedPriced = cache.rows, cache.cut, cache.priced
    end
    cut = cut or DEFAULT_CUT
  else
    cut = Arb.AuctionCut()
  end

  local professionFilter
  if type(options.profession) == "string" and options.profession ~= "" then
    professionFilter = { [options.profession] = true }
  elseif type(options.profession) == "table" then
    local set = {}
    for _, key in ipairs(options.profession) do
      if type(key) == "string" and key ~= "" then
        set[key] = true
      end
    end
    for key, enabled in pairs(options.profession) do
      if type(key) == "string" and key ~= "" and enabled then
        set[key] = true
      end
    end
    if next(set) ~= nil then
      professionFilter = set
    end
  end

  local rows, professionStats, profitable, hiddenByKeep = {}, {}, 0, 0
  local vendorRows, vendorMeta
  if includeVendor then
    vendorRows, vendorMeta = Arb.VendorArbitrage({
      onlyProfitable = options.onlyProfitable, query = options.query, minSupply = options.minSupply,
    })
    for _, row in ipairs(vendorRows) do
      tinsert(rows, row)
      if row.profit and row.profit > 0 then profitable = profitable + 1 end
    end
  end
  local flipRows, flipMeta
  if includeFlip then
    flipRows, flipMeta = Arb.VendorFlipArbitrage({
      onlyProfitable = options.onlyProfitable, query = options.query, minSupply = options.minSupply,
      gearOnly = options.flipGearOnly == true,
    })
    for _, row in ipairs(flipRows) do
      tinsert(rows, row)
      if row.profit and row.profit > 0 then profitable = profitable + 1 end
    end
  end
  for _, row in ipairs(craftCache) do
    local keep = true
    if keep then keep = passesSupply(row, options.minSupply) end
    if professionFilter and not (row.professionKey and professionFilter[row.professionKey]) then keep = false end
    -- 「当前可以制作」：默认只保留当前角色自己学会的配方
    if keep and options.ownOnly ~= false and not row.ownCharacter then keep = false end
    if keep and options.onlyProfitable and not (row.profit and row.profit > 0) then keep = false end
    if keep and options.onlySkillUp and (row.skillUp == "trivial" or row.skillUp == "unknown") then keep = false end
    if keep and options.query and options.query ~= "" then
      local hay = lower((row.name or "") .. " " .. (row.professionName or "") .. " " .. (row.ownerName or ""))
      if not find(hay, lower(options.query), 1, true) then keep = false end
    end
    if keep then
      if row.profit and row.profit > 0 then profitable = profitable + 1 end
    else
      hiddenByKeep = hiddenByKeep + 1
    end
    local stats = row.professionKey and professionStats[row.professionKey]
    if not stats and row.professionKey then
      stats = { key = row.professionKey, name = row.professionName, total = 0, profitable = 0, best = nil }
      professionStats[row.professionKey] = stats
    end
    if stats then
      stats.total = stats.total + 1
      if row.profit and row.profit > 0 then stats.profitable = stats.profitable + 1 end
      if row.profit and (not stats.best or row.profit > stats.best) then stats.best = row.profit end
    end
    if keep then tinsert(rows, row) end
  end

  local sorter
  if options.sort == "roi" then
    sorter = function(left, right)
      if (left.roi or -huge) ~= (right.roi or -huge) then return (left.roi or -huge) > (right.roi or -huge) end
      return (left.profit or -huge) > (right.profit or -huge)
    end
  else
    sorter = function(left, right)
      if (left.profit or -huge) ~= (right.profit or -huge) then return (left.profit or -huge) > (right.profit or -huge) end
      return (left.roi or -huge) > (right.roi or -huge)
    end
  end
  sort(rows, sorter)

  local professions = {}
  for _, stats in pairs(professionStats) do tinsert(professions, stats) end
  tsort(professions, function(left, right)
    if left.total ~= right.total then return left.total > right.total end
    return (left.name or "") < (right.name or "")
  end)

  local marketInfo
  if Arb.MarketProvider() == "blackthornes" then
    local updated = blackthornesLastScan()
    if updated > 0 then marketInfo = { updatedAt = updated } end
  end

  local total, pricedCount, hiddenCount = 0, 0, 0
  if includeCraft then
    total = #craftCache
    pricedCount = cachedPriced or 0
    hiddenCount = hiddenByKeep
  end
  if vendorMeta then
    total = total + vendorMeta.offers
    pricedCount = pricedCount + vendorMeta.priced
    hiddenCount = hiddenCount + vendorMeta.hidden
  end
  if flipMeta then
    total = total + flipMeta.found
    pricedCount = pricedCount + flipMeta.found
    hiddenCount = hiddenCount + flipMeta.hidden
  end
  return rows, {
    mode = mode, source = source, cut = cut, state = Arb.ApiState(), provider = Arb.MarketProvider(), revision = revision(),
    market = marketInfo, professions = professions,
    total = total, priced = pricedCount, shown = #rows, hidden = hiddenCount,
    profitable = profitable, best = rows[1],
    players = #storedRecipeSets(), ownProfessions = Arb.Professions(), identity = Arb.Identity(),
    vendorOffers = vendorMeta and vendorMeta.offers or 0,
    flipOffers = flipMeta and flipMeta.found or 0,
    flipScanned = flipMeta and flipMeta.scanned or 0,
    flipChecked = flipMeta and flipMeta.checked or 0,
    flipPending = flipMeta and flipMeta.pending or 0,
  }
end

-- ============================================================================
-- 8. 一键写入黑石交易技能购物清单
-- ============================================================================

local MAX_SHOPPING_LIST_NAME = 40

---与黑石交易技能 ShoppingLists.CleanName 保持一致：清理分隔符并按 UTF-8 边界截断到 40 字节
local function cleanListName(text)
  if type(text) ~= "string" then return nil end
  local cleaned = gsub(gsub(gsub(gsub(text, "[\r\n\t:,|]", " "), "%s+", " "), "^%s+", ""), "%s+$", "")
  if cleaned == "" then return nil end
  if #cleaned <= MAX_SHOPPING_LIST_NAME then return cleaned end
  local cut = MAX_SHOPPING_LIST_NAME
  while cut > 0 do
    local b = cleaned:byte(cut + 1)
    if not b or b < 128 or b >= 192 then break end
    cut = cut - 1
  end
  cleaned = gsub(sub(cleaned, 1, cut), "%s+$", "")
  return cleaned ~= "" and cleaned or nil
end

local function findListIndexByName(lists, name)
  if type(lists) ~= "table" or type(name) ~= "string" then return nil end
  local target = lower(name)
  for index, list in ipairs(lists) do
    if type(list) == "table" and type(list.name) == "string" and lower(list.name) == target then
      return index, list
    end
  end
  return nil
end

---把物品列表写入黑石交易技能购物清单（优先调用运行时 ShoppingLists 模块，无运行时则回退写存档）
---@param title string 清单名称
---@param items table[] 每项 { id = number, want = number, maxPay = number|nil }
---@param reuseByName boolean|nil 是否复用同名清单（商人套利共用一个「WoWF 商人套利」清单）
---@return boolean ok
---@return string|number listIDOrReason
---@return string|nil note
local function writeBlackthornesShoppingList(title, items, reuseByName)
  if type(items) ~= "table" or #items == 0 then
    return false, "没有可写入购物清单的物品"
  end
  local cleanTitle = cleanListName(title) or "WoWF 套利"
  local ns = _G.BlackthornesTS
  local sl = type(ns) == "table" and ns.ShoppingLists

  if type(sl) == "table" and type(sl.Make) == "function" and type(sl.Add) == "function" then
    local index, listObj
    if reuseByName and type(sl.All) == "function" then
      local okAll, all = pcall(sl.All, sl)
      if okAll and type(all) == "table" then
        index, listObj = findListIndexByName(all, cleanTitle)
      end
    end
    if not index then
      local okMake, madeIndex, makeErr = pcall(sl.Make, sl, cleanTitle)
      if not okMake then return false, tostring(madeIndex or "创建购物清单失败") end
      if not madeIndex then return false, tostring(makeErr or "创建购物清单失败") end
      index = madeIndex
      if type(sl.Get) == "function" then
        local okGet, fetched = pcall(sl.Get, sl, index)
        if okGet and type(fetched) == "table" then listObj = fetched end
      end
    end

    local accepted, failed, capFailed = 0, {}, {}
    for _, item in ipairs(items) do
      local id = floor(tonumber(item.id) or 0)
      local want = max(1, ceil(tonumber(item.want) or 1))
      if id > 0 then
        local itemReady = item.maxPayOnly == true
        if not itemReady then
          local okAdd, addRes, addErr = pcall(sl.Add, sl, index, id, want)
          if okAdd and addRes == true then
            itemReady = true
            accepted = accepted + 1
          else
            tinsert(failed, tostring(addErr or addRes or "未知错误"))
          end
        end
        if itemReady then
          local cap = tonumber(item.maxPay)
          if cap and cap > 0 then
            if type(sl.SetMaxPay) ~= "function" then
              tinsert(capFailed, "黑石 ShoppingLists 缺少 SetMaxPay 接口")
            else
              local okCap, capRes, capErr = pcall(sl.SetMaxPay, sl, index, id, ceil(cap))
              if not okCap or capRes ~= true then
                tinsert(capFailed, tostring(capErr or (not okCap and capRes) or "设置最高买价失败"))
              end
            end
          end
        end
      end
    end
    local actualName = (type(listObj) == "table" and listObj.name) or cleanTitle
    local listId = (type(listObj) == "table" and tonumber(listObj.id)) or index
    if #capFailed > 0 then
      if accepted > 0 then
        return false, format(
          "已写入 %d 件到黑石清单「%s」（ID: %s），但最高买价保存失败：%s（可再次点击仅补写限价）",
          accepted, actualName, tostring(listId), capFailed[1]),
          { partial = true, listId = listId, listName = actualName, added = accepted, capFailed = #capFailed }
      end
      return false, format("黑石清单「%s」最高买价保存失败：%s", actualName, capFailed[1])
    end
    if accepted == 0 then
      return false, (failed[1] and ("写入购物清单失败: " .. failed[1])) or "写入购物清单失败"
    end
    if #failed > 0 then
      return true, listId, format("%d/%d 条写入成功（黑石清单「%s」）", accepted, #items, actualName)
    end
    return true, listId, format("已写入黑石购物清单「%s」", actualName)
  end

  local bt = _G.BlackthornesTSDB
  if type(bt) == "table" then
    if type(bt.shoppingLists) ~= "table" then bt.shoppingLists = {} end
    local listObj
    if reuseByName then
      local _, found = findListIndexByName(bt.shoppingLists, cleanTitle)
      listObj = found
    end
    if not listObj then
      local nextId = max(1, floor(tonumber(bt.shoppingListNextId) or 1))
      for _, other in ipairs(bt.shoppingLists) do
        if type(other) == "table" and tonumber(other.id) and tonumber(other.id) >= nextId then
          nextId = floor(tonumber(other.id)) + 1
        end
      end
      listObj = { id = nextId, name = cleanTitle, items = {} }
      tinsert(bt.shoppingLists, listObj)
      bt.shoppingListNextId = nextId + 1
    end
    if type(listObj.items) ~= "table" then listObj.items = {} end
    local existingById = {}
    for _, entry in ipairs(listObj.items) do
      if type(entry) == "table" and tonumber(entry.id) then
        existingById[tonumber(entry.id)] = entry
      end
    end
    for _, item in ipairs(items) do
      local id = floor(tonumber(item.id) or 0)
      local want = max(1, ceil(tonumber(item.want) or 1))
      local cap = (tonumber(item.maxPay) and tonumber(item.maxPay) > 0) and ceil(tonumber(item.maxPay)) or nil
      if id > 0 then
        local existing = existingById[id]
        if existing then
          existing.want = min(99999, max(1, floor(tonumber(existing.want) or 0) + want))
          if cap then existing.maxPay = cap end
        else
          local entry = { id = id, want = min(99999, want), maxPay = cap }
          tinsert(listObj.items, entry)
          existingById[id] = entry
        end
      end
    end
    if type(sl) == "table" and type(sl.Touch) == "function" then
      pcall(sl.Touch, sl)
    end
    return true, listObj.id or cleanTitle, format("已写入黑石购物清单「%s」", listObj.name or cleanTitle)
  end

  return false, "未检测到黑石交易技能（Blackthornes_TS），请确认已启用"
end

---把一条利润行需要采购的叶子材料写入黑石交易技能购物清单
---@param row table Analyse 返回的利润行
---@param label string|nil 清单名后缀（一般是产出物品名）
---@return boolean ok
---@return string|number listID 或失败原因
---@return string|nil note 补充说明
function Arb.AddToShoppingList(row, label)
  if type(row) ~= "table" or type(row.leaves) ~= "table" or #row.leaves == 0 then
    return false, "该配方没有需要采购的材料"
  end
  local title = "WoWF 制造套利"
  if type(label) == "string" and label ~= "" then
    title = title .. " · " .. label
  end
  local items = {}
  for _, leaf in ipairs(row.leaves) do
    -- 数量向上取整到整件；单价上限给 5% 余量，避免材料涨价后清单直接失效
    local cap = leaf.unit and ceil(leaf.unit * 1.05) or nil
    tinsert(items, { id = leaf.itemID, want = max(1, ceil(leaf.quantity or 1)), maxPay = cap })
  end
  return writeBlackthornesShoppingList(title, items, false)
end

---把商人套利选中的商品写入黑石交易技能「WoWF 商人套利」购物清单（同名清单自动复用并累加数量）
---@param itemID number
---@param quantity number|nil
---@param maxPay number|nil 单件采购上限（铜）
---@return boolean ok
---@return string|number listID 或失败原因
---@return string|nil note 补充说明
function Arb.AddVendorToShoppingList(itemID, quantity, maxPay)
  local id = tonumber(itemID)
  if not id or id <= 0 then return false, "无效的物品 ID" end
  local want = max(1, ceil(tonumber(quantity) or 1))
  local cap = (tonumber(maxPay) and tonumber(maxPay) > 0) and ceil(tonumber(maxPay)) or nil
  return writeBlackthornesShoppingList("WoWF 商人套利", { { id = id, want = want, maxPay = cap } }, true)
end

---把「拍卖→商人」套利选中的商品写入黑石交易技能「WoWF 拍卖→商人」购物清单（同名清单自动复用并累加数量）
---@param itemID number
---@param quantity number|nil
---@param maxPay number|nil 单件最高扫货出价（铜，一般为 vendorSell - 1）
---@return boolean ok
---@return string|number listID 或失败原因
---@return string|nil note 补充说明
function Arb.AddFlipToShoppingList(itemID, quantity, maxPay)
  local id = tonumber(itemID)
  if not id or id <= 0 then return false, "无效的物品 ID" end
  local want = max(1, ceil(tonumber(quantity) or 1))
  local cap = (tonumber(maxPay) and tonumber(maxPay) > 0) and ceil(tonumber(maxPay)) or nil
  return writeBlackthornesShoppingList("WoWF 拍卖→商人", { { id = id, want = want, maxPay = cap } }, true)
end

---仅补写已存在购物清单条目的最高扫货价（不重复累加需求数量）
---@param listIDOrIndex number|string
---@param itemID number
---@param maxPay number
---@return boolean ok
---@return string|number listIDOrReason
---@return string|nil note
function Arb.UpdateShoppingListMaxPay(listIDOrIndex, itemID, maxPay)
  local id = tonumber(itemID)
  local cap = tonumber(maxPay)
  if not id or id <= 0 or not cap or cap <= 0 then
    return false, "无效的物品或最高买价"
  end
  local cleanCap = ceil(cap)
  local ns = _G.BlackthornesTS
  local sl = type(ns) == "table" and ns.ShoppingLists
  if type(sl) == "table" and type(sl.Get) == "function" then
    if type(sl.SetMaxPay) ~= "function" then
      return false, "黑石 ShoppingLists 缺少 SetMaxPay 接口"
    end
    local targetIndex = tonumber(listIDOrIndex)
    if (not targetIndex or not sl:Get(targetIndex)) and type(sl.All) == "function" then
      local okAll, all = pcall(sl.All, sl)
      if okAll and type(all) == "table" then
        for i, l in ipairs(all) do
          if type(l) == "table" and (l.id == listIDOrIndex or i == targetIndex) then
            targetIndex = i
            break
          end
        end
      end
    end
    if not targetIndex then return false, "未找到目标购物清单" end
    local okCap, capRes, capErr = pcall(sl.SetMaxPay, sl, targetIndex, id, cleanCap)
    if okCap and capRes == true then
      return true, targetIndex, "仅补写最高买价（未重复增加数量）"
    end
    return false, tostring(capErr or (not okCap and capRes) or "设置最高买价失败")
  end
  local bt = _G.BlackthornesTSDB
  if type(bt) == "table" and type(bt.shoppingLists) == "table" then
    for _, listObj in ipairs(bt.shoppingLists) do
      if type(listObj) == "table" and (listObj.id == listIDOrIndex or listIDOrIndex == nil) and type(listObj.items) == "table" then
        for _, entry in ipairs(listObj.items) do
          if type(entry) == "table" and tonumber(entry.id) == id then
            entry.maxPay = cleanCap
            return true, listObj.id or "WoWF 拍卖→商人", "仅补写最高买价（未重复增加数量）"
          end
        end
      end
    end
    return false, "清单中未找到该物品"
  end
  return false, "未检测到黑石交易技能（Blackthornes_TS），请确认已启用"
end

-- ============================================================================
-- 9. 诊断报告：排查游戏内作用域、价格表与在售数量来源
-- ============================================================================

local function safeCallProbe(fn, ...)
  if type(fn) ~= "function" then return false, "missing", "nil" end
  local ok, text, vtype = pcall(function(...)
    local v = fn(...)
    return tostring(v), type(v)
  end, ...)
  if not ok then return false, tostring(text), "error" end
  return true, text, vtype
end

---输出或落盘套利行情诊断报告（全基础类型结构，可直接写入 SavedVariables）
---@param itemID number|nil 指定物品 ID（缺省时检查 4497 及当前商人套利前 6 项）
---@return table { lines = string[], data = table }
function Arb.DebugReport(itemID)
  local rawRealmOk, rawRealmText, rawRealmType = safeCallProbe(GetRealmName)
  local rawFactionOk, rawFactionText, rawFactionType = safeCallProbe(UnitFactionGroup, "player")
  local ns = _G.BlackthornesTS
  local db = _G.BlackthornesTSDB
  local charDb = _G.BlackthornesTSCharDB
  local cfg = type(ns) == "table" and ns.Config
  local pricesMod = type(ns) == "table" and ns.Prices

  local btConfigOk, btConfigKey = false, nil
  if type(cfg) == "table" and type(cfg.GetRealmKey) == "function" then
    local ok, val = safeCallProbe(cfg.GetRealmKey, cfg)
    btConfigOk, btConfigKey = ok, val
  end

  local btGetTableOk, btGetTableCount, btGetTableType = false, 0, "nil"
  if type(pricesMod) == "table" and type(pricesMod.GetTable) == "function" then
    local ok, tbl = pcall(pricesMod.GetTable, pricesMod)
    btGetTableOk = ok
    btGetTableType = ok and type(tbl) or "error"
    if ok and type(tbl) == "table" then btGetTableCount = tableEntryCount(tbl) end
  end

  local scopeKey = blackthornesScopeKey()
  local priceTable = blackthornesPriceTable()
  local realmTable = blackthornesRealmPriceTable()
  local priceTableCount = priceTable and tableEntryCount(priceTable) or 0
  local charDbRealm = type(charDb) == "table" and tostring(charDb.realmName or "") or "nil"

  local dbBuckets = {}
  if type(db) == "table" and type(db.prices) == "table" then
    for k, t in pairs(db.prices) do
      dbBuckets[#dbBuckets + 1] = {
        key = tostring(k),
        count = type(t) == "table" and tableEntryCount(t) or -1,
      }
    end
    tsort(dbBuckets, function(a, b) return a.key < b.key end)
  end

  local provider = Arb.MarketProvider()
  local apiState = Arb.ApiState()
  local rev = revision()
  local lastScan = blackthornesLastScan()
  local lastFullScan = blackthornesLastFullScan()

  local targetIds, seenIds = {}, {}
  local function pushId(id)
    local num = tonumber(id)
    if num and not seenIds[num] then
      seenIds[num] = true
      targetIds[#targetIds + 1] = num
    end
  end
  local explicitId = tonumber(itemID)
  if explicitId then
    pushId(explicitId)
  else
    pushId(4497)
    local okVendor, vRows = pcall(Arb.VendorArbitrage, { onlyProfitable = false })
    if okVendor and type(vRows) == "table" then
      for _, row in ipairs(vRows) do
        if #targetIds >= 7 then break end
        pushId(row.outputID)
      end
    end
  end

  local items = {}
  for _, id in ipairs(targetIds) do
    local rec = priceTable and priceTable[id]
    local rp = realmTable and realmTable[id]
    local sellPrice, _, sellSource = Arb.SellQuote(id)
    local supply, supplySource = Arb.ListedSupply(id)
    items[#items + 1] = {
      id = id,
      inPrices = type(rec) == "table",
      inRealmPrices = rp ~= nil,
      rawMin = type(rec) == "table" and tonumber(rec.min) or nil,
      rawMarket = type(rec) == "table" and tonumber(rec.market) or nil,
      rawQty = type(rec) == "table" and tonumber(rec.quantity) or nil,
      rawSeen = type(rec) == "table" and tonumber(rec.seen) or nil,
      sellPrice = sellPrice,
      sellSource = sellSource,
      supply = supply,
      supplySource = supplySource,
    }
  end

  local bucketSummary = {}
  for _, b in ipairs(dbBuckets) do
    bucketSummary[#bucketSummary + 1] = format("%s(%d)", b.key, b.count)
  end

  local lines = {
    format("provider=%s state=%s rev=%s lastScan=%s fullScan=%s",
      tostring(provider), tostring(apiState), tostring(rev), tostring(lastScan), tostring(lastFullScan)),
    format("GetRealmName: ok=%s type=%s val=%s | UnitFactionGroup: ok=%s type=%s val=%s",
      tostring(rawRealmOk), rawRealmType, rawRealmText,
      tostring(rawFactionOk), rawFactionType, rawFactionText),
    format("BTns=%s BT.GetRealmKey=(%s:%s) BT.GetTable=(%s:%s:%d)",
      tostring(type(ns) == "table"),
      tostring(btConfigOk), tostring(btConfigKey),
      tostring(btGetTableOk), btGetTableType, btGetTableCount),
    format("scopeKey=%s priceTableCount=%d charDbRealm=%s buckets=[%s]",
      tostring(scopeKey), priceTableCount, charDbRealm, tconcat(bucketSummary, ", ")),
  }
  for _, it in ipairs(items) do
    lines[#lines + 1] = format(
      "item=%d inPrices=%s inRealm=%s raw(min=%s mkt=%s qty=%s seen=%s) sell=%s(%s) supply=%s(%s)",
      it.id, tostring(it.inPrices), tostring(it.inRealmPrices),
      tostring(it.rawMin), tostring(it.rawMarket), tostring(it.rawQty), tostring(it.rawSeen),
      tostring(it.sellPrice), tostring(it.sellSource), tostring(it.supply), tostring(it.supplySource))
  end

  local data = {
    at = now(),
    provider = provider,
    apiState = apiState,
    revision = rev,
    lastScan = lastScan,
    lastFullScan = lastFullScan,
    rawRealm = { ok = rawRealmOk, type = rawRealmType, val = rawRealmText },
    rawFaction = { ok = rawFactionOk, type = rawFactionType, val = rawFactionText },
    hasBTNs = type(ns) == "table",
    btConfigKey = btConfigKey,
    btGetTable = { ok = btGetTableOk, type = btGetTableType, count = btGetTableCount },
    scopeKey = scopeKey,
    priceTableCount = priceTableCount,
    charDbRealm = charDbRealm,
    dbBuckets = dbBuckets,
    items = items,
  }
  return { lines = lines, data = data }
end

-- ============================================================================
-- 10. 拍卖→商人连续扫货引擎（合规硬件点击/滚轮触发，每次买前实时校验价格）
-- ============================================================================

local MAX_COMMODITY_UNITS = 50 -- 单次堆叠扫货上限（避免一次锁价买太大包）
local FLIP_CONFIRM_OVER = 100000 -- 单笔购买 >= 10金 时需二次点击/滚轮确认
local FLIP_CONFIRM_WINDOW = 5 -- 二次确认有效窗口（秒）
local FLIP_SEARCH_TIMEOUT = 10 -- 单次实时检索/锁价超时（秒）
local FLIP_BUY_TIMEOUT = 12 -- 下单后等待客户端回执超时（秒）
local FLIP_NEXT_DELAY = 0.25 -- 自动切换下一件时的检索间隔（秒）
local FLIP_QUOTE_TTL = 15 -- 堆叠计划/锁价有效期（秒），过期强制重查
local MAX_ITEM_GROUP_RESEARCHES = 20 -- 同价分组单件连买时的最大重检次数上限

local function formatFlipCopper(copper)
  local value = floor(tonumber(copper) or 0)
  local gold = floor(value / 10000)
  local silver = floor((value % 10000) / 100)
  local rest = value % 100
  if gold > 0 then return format("%d金%d银%d铜", gold, silver, rest) end
  if silver > 0 then return format("%d银%d铜", silver, rest) end
  return format("%d铜", rest)
end

local function flipNowSeconds()
  if type(GetTime) == "function" then
    local ok, t = pcall(GetTime)
    if ok and type(t) == "number" then return t end
  end
  return now()
end

local function flipMoney()
  if type(GetMoney) ~= "function" then return nil end
  local ok, money = pcall(GetMoney)
  if ok and type(money) == "number" and money >= 0 then return money end
  return nil
end

local function flipPriceSort()
  local enum = Enum and Enum.AuctionHouseSortOrder
  return { { sortOrder = (enum and enum.Price) or 0, reverseSort = false } }
end

local FlipBuyer = {}
Arb.FlipBuyer = FlipBuyer

local buyer = {
  ahOpen = false,
  active = false,
  phase = "idle",
  queue = {},
  index = 0,
  sessionId = 0,
  searchToken = 0,
  buyToken = 0,
  liveAuctions = nil,
  commodityPlan = nil,
  buying = nil,
  armed = nil,
  searchItemKey = nil,
  searchItemID = nil,
  searchSent = false,
  searchRetried = false,
  boughtAuctionIDs = {},
  itemGroupResearches = 0,
  itemGroupNeedsResearch = false,
  stats = { boughtCount = 0, boughtUnits = 0, spent = 0, estProfit = 0, skipped = 0 },
  lastMessage = "待命中：在拍卖行打开本页后点击「开始连续扫货」",
  onChanged = nil,
}

local function buyerNotify()
  if type(buyer.onChanged) == "function" then
    pcall(buyer.onChanged, FlipBuyer.Status())
  end
end

local function cancelPendingCommodityQuote()
  local ah = _G.C_AuctionHouse
  if type(ah) == "table" and type(ah.CancelCommoditiesPurchase) == "function" then
    pcall(ah.CancelCommoditiesPurchase)
  end
end

local function scheduleBuyerTimer(seconds, fn)
  if type(C_Timer) == "table" and type(C_Timer.After) == "function" then
    pcall(C_Timer.After, seconds, fn)
  end
end

local searchCurrentItem

local function canAuthorizeFlipPurchase(cur)
  if type(cur) ~= "table" then return false end
  return cur.vendorSellSource == "sold" or cur.vendorSellSource == "tooltip"
end

local function isCommodityQuoteAcceptable(plan, cur, unitP, totalPrice)
  if type(plan) ~= "table" or type(cur) ~= "table" then return false end
  local count = floor(tonumber(plan.count) or 0)
  local sell = tonumber(cur.vendorSell) or 0
  if count < 1 or sell <= 1 then return false end
  if type(totalPrice) ~= "number" or totalPrice <= 0 then return false end
  if type(plan.expectedTotal) == "number" and totalPrice > plan.expectedTotal then return false end
  if totalPrice >= sell * count then return false end
  if type(unitP) == "number" and unitP > 0 and unitP >= sell then return false end
  return true
end

---在拉取搜索结果和下单前强制核对当前物品是否真能卖给 NPC 商人，
---防止客户端旧 GetItemInfo 残留假卖价导致买入不可卖店物品（如致盲粉）；
---当客户端缺少 Tooltip 核验接口时，严禁凭未核验的缓存卖价（facts/reported）下单。
local function verifyQueueItemSellable(cur)
  if type(cur) ~= "table" then return false, "无效队列条目" end
  if isUnsellableItem(cur.itemID) then
    return false, format("%s 已在不可卖店黑名单中，跳过", cur.name or tostring(cur.itemID))
  end
  if cur.vendorSellSource == "sold" then
    local soldPrice = tonumber(cur.vendorSell)
    if soldPrice and soldPrice > 1 then
      return true
    end
    return false, format("%s 实测卖店价无效，跳过", cur.name or tostring(cur.itemID))
  end
  local cTip = _G.C_TooltipInfo
  if type(cTip) == "table" and type(cTip.GetItemByID) == "function" then
    local tipPrice, tipRead, tipUnsellable, tipCharges = inspectTooltipSellPrice(cur.itemID)
    if not tipRead then
      if type(C_Item) == "table" and type(C_Item.RequestLoadItemDataByID) == "function" then
        pcall(C_Item.RequestLoadItemDataByID, cur.itemID)
      end
      return false, format("%s 物品提示尚未就绪，为防买到不可卖店物品已跳过", cur.name or tostring(cur.itemID))
    end
    if tipCharges then
      tooltipSellCache[cur.itemID] = { price = 0, unsure = true }
      return false, format("%s 属于充能消耗品且无实测卖店价，已跳过", cur.name or tostring(cur.itemID))
    end
    if tipUnsellable or not tipPrice or tipPrice <= 0 then
      markUnsellableItem(cur.itemID)
      return false, format("%s 提示无卖价（商人拒收），已自动拉黑并跳过", cur.name or tostring(cur.itemID))
    end
    tooltipSellCache[cur.itemID] = { price = tipPrice }
    local capped = tipPrice
    local knownReported = tonumber(cur.reportedSell) or FOREVER_VENDOR_PAYOUTS[cur.itemID]
    if knownReported and knownReported > 0 and knownReported < capped then
      capped = knownReported
    end
    cur.vendorSell = capped
    cur.vendorSellSource = "tooltip"
    return true
  end
  if canAuthorizeFlipPurchase(cur) then
    return true
  end
  return false, format("%s 缺少客户端 Tooltip 卖价核验接口且无实测卖店价，禁止自动买入", cur.name or tostring(cur.itemID))
end

local function advanceToNextItem(immediate)
  if not buyer.active then return end
  buyer.liveAuctions = nil
  buyer.commodityPlan = nil
  buyer.buying = nil
  buyer.armed = nil
  buyer.pendingSkip = nil
  buyer.pendingStop = nil
  buyer.pendingStopReason = nil
  buyer.searchItemKey = nil
  buyer.searchItemID = nil
  buyer.searchSent = false
  buyer.boughtAuctionIDs = {}
  buyer.itemGroupResearches = 0
  buyer.itemGroupNeedsResearch = false
  buyer.index = (buyer.index or 0) + 1
  if buyer.index > #buyer.queue then
    buyer.active = false
    buyer.phase = "done"
    buyer.lastMessage = format(
      "扫货完成：买入 %d 笔（共 %d 件），花费 %s，预计净赚 %s（已跳过 %d 种）",
      buyer.stats.boughtCount, buyer.stats.boughtUnits,
      formatFlipCopper(buyer.stats.spent), formatFlipCopper(buyer.stats.estProfit),
      buyer.stats.skipped
    )
    buyerNotify()
    return
  end
  if immediate or type(C_Timer) ~= "table" or type(C_Timer.After) ~= "function" then
    searchCurrentItem()
  else
    local sid = buyer.sessionId
    local targetIndex = buyer.index
    buyer.searchToken = buyer.searchToken + 1
    buyer.phase = "searching"
    local cur = buyer.queue[targetIndex]
    buyer.lastMessage = format("准备检索 [%d/%d] %s ...", targetIndex, #buyer.queue, cur and cur.name or "")
    buyerNotify()
    scheduleBuyerTimer(FLIP_NEXT_DELAY, function()
      if buyer.active and buyer.sessionId == sid and buyer.index == targetIndex then
        searchCurrentItem()
      end
    end)
  end
end

searchCurrentItem = function()
  if not buyer.active then return end
  local cur = buyer.queue[buyer.index]
  if not cur then
    advanceToNextItem(true)
    return
  end
  local ah = _G.C_AuctionHouse
  if type(ah) ~= "table" or type(ah.MakeItemKey) ~= "function" or type(ah.SendSearchQuery) ~= "function" then
    FlipBuyer.Stop("当前客户端不支持拍卖行实时检索接口")
    return
  end
  local okKey, itemKey = pcall(ah.MakeItemKey, cur.itemID)
  if not okKey or not itemKey then
    buyer.stats.skipped = buyer.stats.skipped + 1
    buyer.lastMessage = format("无法构造物品键：%s，已跳过", cur.name)
    advanceToNextItem(true)
    return
  end
  buyer.liveAuctions = nil
  buyer.commodityPlan = nil
  buyer.buying = nil
  buyer.armed = nil
  buyer.searchItemKey = itemKey
  buyer.searchItemID = cur.itemID
  buyer.searchSent = true
  buyer.searchRetried = false
  buyer.itemGroupNeedsResearch = false
  buyer.searchToken = buyer.searchToken + 1
  buyer.phase = "searching"
  buyer.lastMessage = format("[%d/%d] 正在实时检索 %s（商人收 %s/件）...",
    buyer.index, #buyer.queue, cur.name, formatFlipCopper(cur.vendorSell))
  buyerNotify()

  local token = buyer.searchToken
  local sid = buyer.sessionId
  local okSend, res = pcall(ah.SendSearchQuery, itemKey, flipPriceSort(), true)
  if not okSend or res == false then
    buyer.searchSent = false
    buyer.stats.skipped = buyer.stats.skipped + 1
    buyer.lastMessage = format("检索 %s 被限流或拒绝，已跳过", cur.name)
    advanceToNextItem(false)
    return
  end

  scheduleBuyerTimer(FLIP_SEARCH_TIMEOUT, function()
    if buyer.active and buyer.sessionId == sid and buyer.searchToken == token and buyer.phase == "searching" then
      buyer.stats.skipped = buyer.stats.skipped + 1
      buyer.lastMessage = format("%s 检索超时，自动切换下一件", cur.name)
      advanceToNextItem(true)
    end
  end)
end

---注册扫货状态变化回调，供悬浮控制条即时刷新文本与滚轮绑定
function FlipBuyer.SetListener(fn)
  buyer.onChanged = type(fn) == "function" and fn or nil
end

---当前拍卖行窗口是否已打开
---@return boolean
function FlipBuyer.IsAuctionHouseOpen()
  if buyer.ahOpen then return true end
  local frame = _G.AuctionHouseFrame
  if type(frame) == "table" and type(frame.IsShown) == "function" then
    local ok, shown = pcall(frame.IsShown, frame)
    if ok and shown == true then return true end
  end
  local ns = _G.BlackthornesTS
  if type(ns) == "table" and type(ns.Scanner) == "table" and ns.Scanner.isAuctionHouseOpen == true then
    return true
  end
  return false
end

---是否正在连续扫货中
---@return boolean
function FlipBuyer.IsActive()
  return buyer.active == true
end

---返回当前连续扫货状态快照
---@return table
function FlipBuyer.Status()
  return {
    ahOpen = FlipBuyer.IsAuctionHouseOpen(),
    active = buyer.active == true,
    phase = buyer.phase,
    index = buyer.index,
    total = #buyer.queue,
    current = buyer.queue[buyer.index],
    liveAuction = buyer.liveAuctions and buyer.liveAuctions[1] or nil,
    liveCount = buyer.liveAuctions and #buyer.liveAuctions or 0,
    commodity = buyer.commodityPlan,
    armed = buyer.armed ~= nil and (flipNowSeconds() - (buyer.armed.at or 0) <= FLIP_CONFIRM_WINDOW),
    stats = {
      boughtCount = buyer.stats.boughtCount,
      boughtUnits = buyer.stats.boughtUnits,
      spent = buyer.stats.spent,
      estProfit = buyer.stats.estProfit,
      skipped = buyer.stats.skipped,
    },
    message = buyer.lastMessage,
  }
end

---启动「拍卖→商人」连续扫货队列
---@param flipRows table[] 过滤后的 flip 套利行列表
---@return boolean ok
---@return string|nil message
function FlipBuyer.Start(flipRows)
  if not FlipBuyer.IsAuctionHouseOpen() then
    buyer.lastMessage = "请先打开拍卖行窗口后再开始扫货"
    buyerNotify()
    return false, buyer.lastMessage
  end
  local ah = _G.C_AuctionHouse
  if type(ah) ~= "table" or type(ah.MakeItemKey) ~= "function" or type(ah.SendSearchQuery) ~= "function" then
    buyer.lastMessage = "当前客户端不支持拍卖行实时检索接口"
    buyerNotify()
    return false, buyer.lastMessage
  end
  local cTip = _G.C_TooltipInfo
  local hasTipApi = type(cTip) == "table" and type(cTip.GetItemByID) == "function"
  local queue, skippedUnverified = {}, 0
  for _, row in ipairs(type(flipRows) == "table" and flipRows or {}) do
    local id = tonumber(row.outputID or row.itemID)
    local vendorSell = tonumber(row.vendorSell)
    if (row.kind == nil or row.kind == "flip") and id and id > 0 and vendorSell and vendorSell > 1
      and not isUnsellableItem(id) then
      if not hasTipApi and row.vendorSellSource ~= "sold" and row.vendorSellSource ~= "tooltip" then
        skippedUnverified = skippedUnverified + 1
      else
        queue[#queue + 1] = {
          itemID = id,
          name = row.name or format("物品 #%d", id),
          vendorSell = vendorSell,
          vendorSellSource = row.vendorSellSource,
          reportedSell = (row.vendorSellSource == "reported" and vendorSell) or FOREVER_VENDOR_PAYOUTS[id] or nil,
          isGear = row.isGear == true,
          estProfit = tonumber(row.profit) or 0,
        }
      end
    end
  end
  if #queue == 0 then
    if skippedUnverified > 0 then
      buyer.lastMessage = "客户端缺少 Tooltip 卖价核验接口，且当前候选物品无实测卖店价，禁止自动买入"
    else
      buyer.lastMessage = "当前列表没有可扫货的「拍卖→商人」物品"
    end
    buyerNotify()
    return false, buyer.lastMessage
  end

  cancelPendingCommodityQuote()
  buyer.queue = queue
  buyer.index = 1
  buyer.active = true
  buyer.sessionId = buyer.sessionId + 1
  buyer.stats = { boughtCount = 0, boughtUnits = 0, spent = 0, estProfit = 0, skipped = 0 }
  buyer.armed = nil
  buyer.liveAuctions = nil
  buyer.commodityPlan = nil
  buyer.buying = nil
  buyer.pendingSkip = nil
  buyer.pendingStop = nil
  buyer.pendingStopReason = nil
  buyer.searchSent = false
  buyer.boughtAuctionIDs = {}
  buyer.itemGroupResearches = 0
  buyer.itemGroupNeedsResearch = false
  searchCurrentItem()
  return true
end

---停止连续扫货并清理挂起锁价
---@param reason string|nil
function FlipBuyer.Stop(reason)
  if buyer.phase == "quoting_commodity" or buyer.phase == "ready_commodity" then
    cancelPendingCommodityQuote()
  end
  buyer.active = false
  buyer.phase = "idle"
  buyer.liveAuctions = nil
  buyer.commodityPlan = nil
  buyer.buying = nil
  buyer.armed = nil
  buyer.pendingSkip = nil
  buyer.pendingStop = nil
  buyer.pendingStopReason = nil
  buyer.searchItemKey = nil
  buyer.searchItemID = nil
  buyer.searchSent = false
  buyer.boughtAuctionIDs = {}
  buyer.itemGroupResearches = 0
  buyer.itemGroupNeedsResearch = false
  buyer.lastMessage = reason or format(
    "已停止扫货（本轮买入 %d 笔 / %d 件，花费 %s，预计净赚 %s）",
    buyer.stats.boughtCount, buyer.stats.boughtUnits,
    formatFlipCopper(buyer.stats.spent), formatFlipCopper(buyer.stats.estProfit)
  )
  buyerNotify()
end

---在等待中的买单回执结算后安全停止扫货（若当前无在途买单则立即停止）
---@param reason string|nil
function FlipBuyer.StopAfterPending(reason)
  if not buyer.active then return end
  if buyer.phase == "buying" or buyer.buying ~= nil then
    buyer.pendingStop = true
    buyer.pendingStopReason = reason
    buyer.lastMessage = (reason or "已请求停止扫货") .. "（等待当前买单回执后自动停止）"
    buyerNotify()
    return
  end
  FlipBuyer.Stop(reason)
end

---跳过当前物品并检索队列里的下一件（若当前订单仍在等待成交回执，则暂存跳过，等回执结算后再切换）
---@return boolean
function FlipBuyer.Skip()
  if not buyer.active then return false end
  local cur = buyer.queue[buyer.index]
  if buyer.phase == "buying" or buyer.buying ~= nil then
    buyer.pendingSkip = true
    buyer.lastMessage = format("%s 当前买单正在等待成交回执，将在结算后自动跳过其余挂单",
      cur and cur.name or "当前物品")
    buyerNotify()
    return false
  end
  if buyer.phase == "quoting_commodity" or buyer.phase == "ready_commodity" then
    cancelPendingCommodityQuote()
  end
  buyer.stats.skipped = buyer.stats.skipped + 1
  buyer.lastMessage = format("已跳过 %s，切换下一件...", cur and cur.name or "当前物品")
  advanceToNextItem(true)
  return true
end

---硬件点击/滚轮触发：执行当前阶段的下一步买单（买单件、堆叠锁价或确认付款）
---@return boolean|string result true | "confirm" | "quoting" | "searching" | false
---@return string|nil reason
function FlipBuyer.Step()
  if not buyer.active or not FlipBuyer.IsAuctionHouseOpen() then
    return false, "未在扫货状态或拍卖行已关闭"
  end
  local cur = buyer.queue[buyer.index]
  if not cur then
    advanceToNextItem(true)
    return false, "队列已结束"
  end
  if buyer.phase == "requote_commodity" then
    searchCurrentItem()
    return "searching"
  end
  if buyer.phase == "searching" or buyer.phase == "quoting_commodity" or buyer.phase == "buying" then
    return false, "等待拍卖行响应"
  end

  local ah = _G.C_AuctionHouse
  if type(ah) ~= "table" then return false, "拍卖行接口不可用" end

  local function needsConfirm(key, total)
    if total < FLIP_CONFIRM_OVER then
      buyer.armed = nil
      return false
    end
    local ts = flipNowSeconds()
    if buyer.armed and buyer.armed.key == key and ts - (buyer.armed.at or 0) <= FLIP_CONFIRM_WINDOW then
      buyer.armed = nil
      return false
    end
    buyer.armed = { key = key, at = ts }
    buyer.lastMessage = format("单笔金额 %s（≥10金），请再次点击或上滚确认购买", formatFlipCopper(total))
    buyerNotify()
    return true
  end

  if buyer.phase == "ready_item" then
    local sellable, reason = verifyQueueItemSellable(cur)
    if not sellable then
      buyer.stats.skipped = buyer.stats.skipped + 1
      buyer.lastMessage = reason or format("%s 不可卖店，跳过", cur.name)
      advanceToNextItem(true)
      return false, reason
    end
    local target = buyer.liveAuctions and buyer.liveAuctions[1]
    if not target then
      advanceToNextItem(true)
      return false, "当前物品无可用一口价"
    end
    local effectiveSell = min(cur.vendorSell, tonumber(target.vendorSell) or cur.vendorSell)
    if not target.total or target.total <= 0 or target.total >= effectiveSell then
      table.remove(buyer.liveAuctions, 1)
      if #buyer.liveAuctions > 0 then
        buyerNotify()
        return FlipBuyer.Step()
      end
      buyer.stats.skipped = buyer.stats.skipped + 1
      buyer.lastMessage = format("%s 实时一口价已不再低于商人收购价，跳过", cur.name)
      advanceToNextItem(true)
      return false, "不再低于商人收购价"
    end
    local money = flipMoney()
    if money and money < target.total then
      buyer.lastMessage = format("金币不足（需要 %s），无法购买 %s", formatFlipCopper(target.total), cur.name)
      buyerNotify()
      return false, "金币不足"
    end
    if needsConfirm("i:" .. tostring(target.auctionID), target.total) then
      return "confirm"
    end
    if type(ah.PlaceBid) ~= "function" then
      FlipBuyer.Stop("客户端缺少 PlaceBid 接口")
      return false, "缺少 PlaceBid"
    end
    local okBid, resBid = pcall(ah.PlaceBid, target.auctionID, target.total)
    if not okBid or resBid == false then
      table.remove(buyer.liveAuctions, 1)
      if #buyer.liveAuctions > 0 then
        buyer.lastMessage = format("%s 该挂单已被买走，尝试下一口低价...", cur.name)
        buyerNotify()
      else
        buyer.stats.skipped = buyer.stats.skipped + 1
        buyer.lastMessage = format("%s 下单失败（可能已售出），切换下一件", cur.name)
        advanceToNextItem(true)
      end
      return false, "下单失败"
    end
    buyer.phase = "buying"
    buyer.buyToken = buyer.buyToken + 1
    buyer.buying = {
      kind = "item",
      itemID = cur.itemID,
      auctionID = target.auctionID,
      count = 1,
      total = target.total,
      profit = effectiveSell - target.total,
      vendorSell = effectiveSell,
      groupQty = target.groupQty or 1,
      moneyBefore = money,
    }
    buyer.lastMessage = format("正在买入 %s ×1（%s，赚 %s）...",
      cur.name, formatFlipCopper(target.total), formatFlipCopper(buyer.buying.profit))
    buyerNotify()
    local sid, btok = buyer.sessionId, buyer.buyToken
    scheduleBuyerTimer(FLIP_BUY_TIMEOUT, function()
      if buyer.active and buyer.sessionId == sid and buyer.buyToken == btok and buyer.phase == "buying" then
        buyer.buying = nil
        if buyer.pendingStop then
          FlipBuyer.Stop(buyer.pendingStopReason)
          return
        end
        if buyer.liveAuctions and #buyer.liveAuctions > 0 then table.remove(buyer.liveAuctions, 1) end
        if buyer.pendingSkip then
          buyer.pendingSkip = nil
          buyer.stats.skipped = buyer.stats.skipped + 1
          buyer.lastMessage = format("%s 买单超时，按跳过请求切下一件", cur.name)
          advanceToNextItem(true)
        elseif buyer.liveAuctions and #buyer.liveAuctions > 0 then
          buyer.phase = "ready_item"
          buyer.lastMessage = format("%s 购买超时未回报，可点击继续或跳过", cur.name)
          buyerNotify()
        else
          buyer.stats.skipped = buyer.stats.skipped + 1
          buyer.lastMessage = format("%s 购买确认超时，自动切换下一件", cur.name)
          advanceToNextItem(true)
        end
      end
    end)
    return true
  end

  if buyer.phase == "planned_commodity" then
    local sellable, reason = verifyQueueItemSellable(cur)
    if not sellable then
      buyer.stats.skipped = buyer.stats.skipped + 1
      buyer.lastMessage = reason or format("%s 不可卖店，跳过", cur.name)
      advanceToNextItem(true)
      return false, reason
    end
    local plan = buyer.commodityPlan
    if not plan or plan.count < 1 or plan.expectedTotal >= cur.vendorSell * plan.count then
      buyer.stats.skipped = buyer.stats.skipped + 1
      buyer.lastMessage = format("%s 堆叠商品不再低于商人收购价，跳过", cur.name)
      advanceToNextItem(true)
      return false, "价格不满足"
    end
    if plan.plannedAt and (flipNowSeconds() - plan.plannedAt) > FLIP_QUOTE_TTL then
      searchCurrentItem()
      return "searching"
    end
    local money = flipMoney()
    if money and money < plan.expectedTotal then
      buyer.lastMessage = format("金币不足（预计 %s），请手动调整或跳过", formatFlipCopper(plan.expectedTotal))
      buyerNotify()
      return false, "金币不足"
    end
    if type(ah.StartCommoditiesPurchase) ~= "function" then
      FlipBuyer.Stop("客户端缺少 StartCommoditiesPurchase 接口")
      return false, "缺少 StartCommoditiesPurchase"
    end
    local okStart, resStart = pcall(ah.StartCommoditiesPurchase, plan.itemID, plan.count)
    if not okStart or resStart == false then
      buyer.stats.skipped = buyer.stats.skipped + 1
      buyer.lastMessage = format("%s 堆叠锁价请求失败，跳过", cur.name)
      advanceToNextItem(true)
      return false, "锁价失败"
    end
    buyer.phase = "quoting_commodity"
    buyer.searchToken = buyer.searchToken + 1
    buyer.lastMessage = format("[%d/%d] 正在锁价 %s ×%d（预计 %s）...",
      buyer.index, #buyer.queue, cur.name, plan.count, formatFlipCopper(plan.expectedTotal))
    buyerNotify()
    local sid, stok = buyer.sessionId, buyer.searchToken
    scheduleBuyerTimer(FLIP_SEARCH_TIMEOUT, function()
      if buyer.active and buyer.sessionId == sid and buyer.searchToken == stok and buyer.phase == "quoting_commodity" then
        cancelPendingCommodityQuote()
        buyer.stats.skipped = buyer.stats.skipped + 1
        buyer.lastMessage = format("%s 锁价超时，自动切换下一件", cur.name)
        advanceToNextItem(true)
      end
    end)
    return "quoting"
  end

  if buyer.phase == "ready_commodity" then
    local sellable, reason = verifyQueueItemSellable(cur)
    if not sellable then
      cancelPendingCommodityQuote()
      buyer.stats.skipped = buyer.stats.skipped + 1
      buyer.lastMessage = reason or format("%s 不可卖店，已取消", cur.name)
      advanceToNextItem(true)
      return false, reason
    end
    local plan = buyer.commodityPlan
    if not isCommodityQuoteAcceptable(plan, cur, plan and plan.quotedUnit, plan and plan.quotedTotal) then
      cancelPendingCommodityQuote()
      buyer.commodityPlan = nil
      buyer.armed = nil
      buyer.stats.skipped = buyer.stats.skipped + 1
      buyer.lastMessage = format("%s 锁价不再划算，已取消", cur.name)
      advanceToNextItem(true)
      return false, "锁价失效"
    end
    if plan.quotedAt and (flipNowSeconds() - plan.quotedAt) > FLIP_QUOTE_TTL then
      cancelPendingCommodityQuote()
      buyer.commodityPlan = nil
      buyer.armed = nil
      searchCurrentItem()
      return "searching"
    end
    local money = flipMoney()
    if money and money < plan.quotedTotal then
      local needTotal = plan.quotedTotal
      cancelPendingCommodityQuote()
      buyer.commodityPlan = nil
      buyer.armed = nil
      buyer.phase = "requote_commodity"
      buyer.lastMessage = format("金币不足（需要 %s），已取消本次锁价；补足金币后再次点击将按当前余额重新检索", formatFlipCopper(needTotal))
      buyerNotify()
      return false, "金币不足"
    end
    if needsConfirm("c:" .. tostring(plan.itemID) .. ":" .. tostring(plan.count), plan.quotedTotal) then
      return "confirm"
    end
    if type(ah.ConfirmCommoditiesPurchase) ~= "function" then
      cancelPendingCommodityQuote()
      FlipBuyer.Stop("客户端缺少 ConfirmCommoditiesPurchase 接口")
      return false, "缺少 ConfirmCommoditiesPurchase"
    end
    local okBuy, resBuy = pcall(ah.ConfirmCommoditiesPurchase, plan.itemID, plan.count)
    if not okBuy or resBuy == false then
      cancelPendingCommodityQuote()
      buyer.stats.skipped = buyer.stats.skipped + 1
      buyer.lastMessage = format("%s 确认购买失败，跳过", cur.name)
      advanceToNextItem(true)
      return false, "确认购买失败"
    end
    buyer.phase = "buying"
    buyer.buyToken = buyer.buyToken + 1
    buyer.buying = {
      kind = "commodity",
      itemID = plan.itemID,
      count = plan.count,
      total = plan.quotedTotal,
      profit = cur.vendorSell * plan.count - plan.quotedTotal,
      remainingDeals = plan.remainingDeals or 0,
    }
    buyer.lastMessage = format("正在确认买入 %s ×%d（%s，赚 %s）...",
      cur.name, plan.count, formatFlipCopper(plan.quotedTotal), formatFlipCopper(buyer.buying.profit))
    buyerNotify()
    local sid, btok = buyer.sessionId, buyer.buyToken
    scheduleBuyerTimer(FLIP_BUY_TIMEOUT, function()
      if buyer.active and buyer.sessionId == sid and buyer.buyToken == btok and buyer.phase == "buying" then
        cancelPendingCommodityQuote()
        buyer.buying = nil
        if buyer.pendingStop then
          FlipBuyer.Stop(buyer.pendingStopReason)
          return
        end
        buyer.pendingSkip = nil
        buyer.stats.skipped = buyer.stats.skipped + 1
        buyer.lastMessage = format("%s 堆叠购买确认超时，自动切换下一件", cur.name)
        advanceToNextItem(true)
      end
    end)
    return true
  end

  return false, "当前状态不可点击"
end

local function finishSuccessfulPurchase()
  local buying = buyer.buying
  local cur = buyer.queue[buyer.index]
  if not buying or not cur then return end
  buyer.buying = nil
  buyer.armed = nil
  buyer.stats.boughtCount = buyer.stats.boughtCount + 1
  buyer.stats.boughtUnits = buyer.stats.boughtUnits + floor(tonumber(buying.count) or 1)
  buyer.stats.spent = buyer.stats.spent + floor((tonumber(buying.total) or 0) + 0.5)
  buyer.stats.estProfit = buyer.stats.estProfit + floor((tonumber(buying.profit) or 0) + 0.5)

  if buyer.pendingStop then
    FlipBuyer.Stop(buyer.pendingStopReason)
    return
  end
  if buyer.pendingSkip then
    buyer.pendingSkip = nil
    buyer.lastMessage = format("已买入 %s ×%d，按跳过请求切下一件...", cur.name, floor(tonumber(buying.count) or 1))
    advanceToNextItem(false)
    return
  end

  if buying.kind == "item" then
    if buying.auctionID then
      buyer.boughtAuctionIDs = buyer.boughtAuctionIDs or {}
      buyer.boughtAuctionIDs[buying.auctionID] = true
    end
    if (buying.groupQty or 1) > 1 then
      buyer.itemGroupNeedsResearch = true
    end
    if buyer.liveAuctions and buyer.liveAuctions[1] and buyer.liveAuctions[1].auctionID == buying.auctionID then
      table.remove(buyer.liveAuctions, 1)
    elseif buyer.liveAuctions and #buyer.liveAuctions > 0 then
      table.remove(buyer.liveAuctions, 1)
    end
    if buyer.liveAuctions and #buyer.liveAuctions > 0 then
      buyer.phase = "ready_item"
      local nextAuction = buyer.liveAuctions[1]
      local nextSell = min(cur.vendorSell, tonumber(nextAuction.vendorSell) or cur.vendorSell)
      local nextProfit = nextSell - nextAuction.total
      buyer.lastMessage = format("已买 %s！下口 %s（再赚 %s，余 %d 口）",
        cur.name, formatFlipCopper(nextAuction.total), formatFlipCopper(nextProfit), #buyer.liveAuctions)
      buyerNotify()
      return
    end
    if buyer.itemGroupNeedsResearch and (buyer.itemGroupResearches or 0) < MAX_ITEM_GROUP_RESEARCHES then
      buyer.itemGroupNeedsResearch = false
      buyer.itemGroupResearches = (buyer.itemGroupResearches or 0) + 1
      buyer.lastMessage = format("已买 %s，复查同价剩余挂单...", cur.name)
      searchCurrentItem()
      return
    end
    buyer.lastMessage = format("已扫完 %s，切下一件...", cur.name)
    advanceToNextItem(false)
    return
  end

  -- 堆叠商品：若还有剩余低价可扫，继续检索下一批；否则切下一件
  if (buying.remainingDeals or 0) > 0 then
    buyer.lastMessage = format("已买入 %s ×%d，继续检查余量...", cur.name, buying.count or 0)
    searchCurrentItem()
  else
    buyer.lastMessage = format("已扫完 %s ×%d，切下一件...", cur.name, buying.count or 0)
    advanceToNextItem(false)
  end
end

---处理拍卖行搜索/报价/成交与金钱变动事件
---@param event string
---@param arg1 any
---@param arg2 any
function FlipBuyer.OnEvent(event, arg1, arg2)
  if event == "AUCTION_HOUSE_SHOW" then
    buyer.ahOpen = true
    if not buyer.active then
      buyer.lastMessage = "拍卖行已打开：点击「开始连续扫货」即可按队列自动检索低价捡漏"
    end
    buyerNotify()
    return
  elseif event == "AUCTION_HOUSE_CLOSED" then
    buyer.ahOpen = false
    if buyer.active then
      FlipBuyer.Stop("拍卖行已关闭，已自动停止扫货")
    else
      buyerNotify()
    end
    return
  end

  if not buyer.active then return end
  local cur = buyer.queue[buyer.index]
  local ah = _G.C_AuctionHouse

  if event == "ITEM_SEARCH_RESULTS_UPDATED" and buyer.phase == "searching"
    and buyer.searchSent == true and buyer.searchItemKey ~= nil and cur and type(ah) == "table" then
    local named = type(arg1) == "table" and tonumber(arg1.itemID) or nil
    if named and named ~= cur.itemID then return end
    local queryKey = (type(arg1) == "table" and named == cur.itemID and arg1) or buyer.searchItemKey
    if type(ah.GetNumItemSearchResults) ~= "function" or type(ah.GetItemSearchResultInfo) ~= "function" then return end
    local okN, count = pcall(ah.GetNumItemSearchResults, queryKey)
    if not okN or type(count) ~= "number" then return end
    local sellable, reason = verifyQueueItemSellable(cur)
    if not sellable then
      buyer.stats.skipped = buyer.stats.skipped + 1
      buyer.lastMessage = reason or format("%s 不可卖店，已跳过", cur.name)
      advanceToNextItem(false)
      return
    end
    local deals = {}
    local boughtMap = buyer.boughtAuctionIDs or {}
    for i = 1, count do
      local okInfo, info = pcall(ah.GetItemSearchResultInfo, queryKey, i)
      if okInfo and type(info) == "table" and info.auctionID and not info.containsOwnerItem
        and not boughtMap[info.auctionID] then
        local infoItemID = type(info.itemKey) == "table" and tonumber(info.itemKey.itemID) or nil
        local linkItemID = type(info.itemLink) == "string" and tonumber(info.itemLink:match("item:(%d+)")) or nil
        if (not infoItemID or infoItemID == cur.itemID) and (not linkItemID or linkItemID == cur.itemID) then
          local effectiveSell = cur.vendorSell
          local linkBlocked = false
          if type(info.itemLink) == "string" and info.itemLink ~= "" then
            local linkPrice, linkRead, linkUnsellable, linkCharges = inspectTooltipLinkSellPrice(info.itemLink)
            if not linkRead or linkUnsellable or linkCharges or not linkPrice or linkPrice <= 0 then
              linkBlocked = true
            elseif linkPrice < effectiveSell then
              effectiveSell = linkPrice
            end
          end
          if not linkBlocked then
            local buyout = tonumber(info.buyoutAmount)
            local listedQty = max(1, floor(tonumber(info.quantity) or 1))
            -- 无限服 1.60.1 的 ItemSearchResultInfo.buyoutAmount 是单笔(单件)拍卖的一口价，
            -- quantity 可能代表同价分组数量或全服在售总量，严禁乘以 quantity 放大收购价。
            if buyout and buyout > 0 and buyout < effectiveSell then
              deals[#deals + 1] = {
                auctionID = info.auctionID,
                total = buyout,
                count = 1,
                each = buyout,
                vendorSell = effectiveSell,
                groupQty = listedQty,
              }
            end
          end
        end
      end
    end
    if #deals == 0 then
      buyer.stats.skipped = buyer.stats.skipped + 1
      buyer.lastMessage = format("%s 当前拍卖行无低于 %s 的一口价（已过滤自己挂单）", cur.name, formatFlipCopper(cur.vendorSell))
      advanceToNextItem(false)
      return
    end
    tsort(deals, function(a, b)
      if a.each ~= b.each then return a.each < b.each end
      return a.total < b.total
    end)
    buyer.liveAuctions = deals
    buyer.phase = "ready_item"
    local top = deals[1]
    local topSell = top.vendorSell or cur.vendorSell
    local profit = topSell - top.total
    buyer.lastMessage = format("[%d/%d] %s 实时最低 %s/件（商人收 %s，赚 %s，共 %d 口低于卖店）",
      buyer.index, #buyer.queue, cur.name,
      formatFlipCopper(floor(top.each + 0.5)), formatFlipCopper(topSell), formatFlipCopper(profit), #deals)
    buyerNotify()
    return
  end

  if event == "COMMODITY_SEARCH_RESULTS_UPDATED" and buyer.phase == "searching"
    and buyer.searchSent == true and cur and type(ah) == "table" then
    local named = tonumber(arg1)
    if named and named ~= cur.itemID then return end
    if type(ah.GetNumCommoditySearchResults) ~= "function" or type(ah.GetCommoditySearchResultInfo) ~= "function" then return end
    local okN, count = pcall(ah.GetNumCommoditySearchResults, cur.itemID)
    if not okN or type(count) ~= "number" then return end
    local sellable, reason = verifyQueueItemSellable(cur)
    if not sellable then
      buyer.stats.skipped = buyer.stats.skipped + 1
      buyer.lastMessage = reason or format("%s 不可卖店，已跳过", cur.name)
      advanceToNextItem(false)
      return
    end
    local rows = {}
    for i = 1, count do
      local okRow, row = pcall(ah.GetCommoditySearchResultInfo, cur.itemID, i)
      if okRow and type(row) == "table" then
        local up = tonumber(row.unitPrice)
        local totalQty = tonumber(row.quantity) or 0
        local ownerQty = tonumber(row.numOwnerItems) or 0
        local avail = (row.containsOwnerItem == true and ownerQty <= 0)
          and 0
          or max(0, totalQty - ownerQty)
        if up and up > 0 and avail > 0 then
          rows[#rows + 1] = { unitPrice = up, quantity = avail }
        end
      end
    end
    tsort(rows, function(a, b) return a.unitPrice < b.unitPrice end)
    local money = flipMoney() or huge
    local units, expectedTotal, totalDealUnits = 0, 0, 0
    for _, r in ipairs(rows) do
      if r.unitPrice >= cur.vendorSell then break end
      totalDealUnits = totalDealUnits + r.quantity
      if units < MAX_COMMODITY_UNITS then
        local maxByGold = floor((money - expectedTotal) / r.unitPrice)
        local take = min(r.quantity, MAX_COMMODITY_UNITS - units, max(0, maxByGold))
        if take > 0 then
          units = units + take
          expectedTotal = expectedTotal + take * r.unitPrice
        end
      end
    end
    if units < 1 or expectedTotal >= cur.vendorSell * units then
      buyer.stats.skipped = buyer.stats.skipped + 1
      buyer.lastMessage = format("%s 当前无低于 %s 的可买堆叠库存", cur.name, formatFlipCopper(cur.vendorSell))
      advanceToNextItem(false)
      return
    end
    buyer.commodityPlan = {
      itemID = cur.itemID,
      count = units,
      expectedTotal = expectedTotal,
      remainingDeals = max(0, totalDealUnits - units),
      plannedAt = flipNowSeconds(),
    }
    buyer.phase = "planned_commodity"
    local estProfit = cur.vendorSell * units - expectedTotal
    buyer.lastMessage = format("[%d/%d] %s 可扫 %d 件（预计总价 %s，赚 %s），点击/上滚先锁价",
      buyer.index, #buyer.queue, cur.name, units, formatFlipCopper(expectedTotal), formatFlipCopper(estProfit))
    buyerNotify()
    return
  end

  if event == "COMMODITY_PRICE_UPDATED"
    and (buyer.phase == "quoting_commodity" or buyer.phase == "ready_commodity")
    and buyer.commodityPlan and cur then
    local plan = buyer.commodityPlan
    local unitP = tonumber(arg1)
    local totalPrice = tonumber(arg2)
    if not totalPrice or totalPrice <= 0 then
      if unitP and unitP > 0 then totalPrice = unitP * plan.count end
    end
    if not isCommodityQuoteAcceptable(plan, cur, unitP, totalPrice) then
      cancelPendingCommodityQuote()
      buyer.commodityPlan = nil
      buyer.armed = nil
      buyer.stats.skipped = buyer.stats.skipped + 1
      buyer.lastMessage = format("%s 锁价单价/总价已高于预期或卖店价（%s），自动放弃",
        cur.name, totalPrice and formatFlipCopper(totalPrice) or "无效")
      advanceToNextItem(true)
      return
    end
    if buyer.phase == "ready_commodity" and plan.quotedTotal ~= totalPrice then
      buyer.armed = nil
    end
    plan.quotedUnit = unitP
    plan.quotedTotal = totalPrice
    plan.quotedAt = flipNowSeconds()
    buyer.phase = "ready_commodity"
    local estProfit = cur.vendorSell * plan.count - totalPrice
    buyer.lastMessage = format("[%d/%d] %s 已锁价 ×%d（实付 %s，赚 %s），再次点击/上滚付款",
      buyer.index, #buyer.queue, cur.name, plan.count, formatFlipCopper(totalPrice), formatFlipCopper(estProfit))
    buyerNotify()
    return
  end

  if event == "COMMODITY_PRICE_UNAVAILABLE"
    and (buyer.phase == "quoting_commodity" or buyer.phase == "ready_commodity") and cur then
    cancelPendingCommodityQuote()
    buyer.commodityPlan = nil
    buyer.armed = nil
    buyer.stats.skipped = buyer.stats.skipped + 1
    buyer.lastMessage = format("%s 堆叠库存已被人买光，切换下一件", cur.name)
    advanceToNextItem(true)
    return
  end

  if buyer.phase == "buying" and buyer.buying then
    if event == "AUCTION_HOUSE_PURCHASE_COMPLETED" and buyer.buying.kind == "item" then
      local completedID = type(arg1) == "table" and tonumber(arg1.auctionID) or tonumber(arg1)
      if completedID and completedID == buyer.buying.auctionID then
        finishSuccessfulPurchase()
      end
      return
    elseif event == "PLAYER_MONEY" and buyer.buying.kind == "item" and buyer.buying.moneyBefore then
      local m = flipMoney()
      if m and (buyer.buying.moneyBefore - m) >= buyer.buying.total then
        buyer.buying.moneyDropSeen = true
      end
      return
    elseif event == "COMMODITY_PURCHASE_SUCCEEDED" and buyer.buying.kind == "commodity" then
      finishSuccessfulPurchase()
      return
    elseif event == "AUCTION_HOUSE_SHOW_ERROR" or event == "COMMODITY_PURCHASE_FAILED" then
      if buyer.buying.kind == "item" then
        buyer.buying = nil
        if buyer.pendingStop then
          FlipBuyer.Stop(buyer.pendingStopReason)
          return
        end
        if buyer.liveAuctions and #buyer.liveAuctions > 0 then table.remove(buyer.liveAuctions, 1) end
        if buyer.pendingSkip then
          buyer.pendingSkip = nil
          buyer.stats.skipped = buyer.stats.skipped + 1
          buyer.lastMessage = format("%s 购买失败，按跳过请求切下一件", cur and cur.name or "")
          advanceToNextItem(true)
        elseif buyer.liveAuctions and #buyer.liveAuctions > 0 then
          buyer.phase = "ready_item"
          buyer.lastMessage = format("%s 该挂单购买失败，已切到下一口挂单（可继续买入）", cur and cur.name or "")
          buyerNotify()
        else
          buyer.stats.skipped = buyer.stats.skipped + 1
          buyer.lastMessage = format("%s 购买失败（可能已被买走或金币不足），切下一件", cur and cur.name or "")
          advanceToNextItem(true)
        end
      else
        cancelPendingCommodityQuote()
        buyer.buying = nil
        if buyer.pendingStop then
          FlipBuyer.Stop(buyer.pendingStopReason)
          return
        end
        buyer.pendingSkip = nil
        buyer.stats.skipped = buyer.stats.skipped + 1
        buyer.lastMessage = format("%s 堆叠购买失败，切下一件", cur and cur.name or "")
        advanceToNextItem(true)
      end
      return
    end
  end
end

-- ============================================================================
-- 11. 商人窗口一键出售背包物品引擎（配合原生一键卖垃圾按钮）
-- ============================================================================

local MERCHANT_CONFIRM_WINDOW = 5 -- 二次点击确认窗口（秒）
local MERCHANT_SELL_GAP = 0.15 -- 逐格出售间隔（秒），兼顾服务器节流与买回安全性

local SELLER_MODE_ORDER = { "safe", "unbound", "all" }
local SELLER_MODE_LABELS = {
  safe = "安全全卖(未绑定灰白绿)",
  unbound = "未绑定全卖(含蓝紫)",
  all = "全部可卖(含绑定/蓝紫)",
}

local MerchantSeller = {}
Arb.MerchantSeller = MerchantSeller

local seller = {
  merchantOpen = nil,
  selling = false,
  mode = "safe",
  armed = nil,
  sessionId = 0,
  onChanged = nil,
}

local function sellerNotify()
  if type(seller.onChanged) == "function" then
    pcall(seller.onChanged, MerchantSeller.Status())
  end
end

local function bagMaxIndex()
  local n = tonumber(_G.NUM_BAG_SLOTS)
  if n and n >= 4 then return floor(n) end
  return 4
end

local function containerNumSlots(bag)
  local c = _G.C_Container
  if type(c) == "table" and type(c.GetContainerNumSlots) == "function" then
    local ok, n = pcall(c.GetContainerNumSlots, bag)
    if ok and type(n) == "number" then return n end
  end
  if type(_G.GetContainerNumSlots) == "function" then
    local ok, n = pcall(_G.GetContainerNumSlots, bag)
    if ok and type(n) == "number" then return n end
  end
  return 0
end

local function containerItemInfo(bag, slot)
  local c = _G.C_Container
  if type(c) == "table" and type(c.GetContainerItemInfo) == "function" then
    local ok, info = pcall(c.GetContainerItemInfo, bag, slot)
    if ok and type(info) == "table" then
      return info
    end
  end
  if type(_G.GetContainerItemInfo) == "function" then
    local ok, _, stackCount, isLocked, quality, _, _, hyperlink, _, hasNoValue, itemID, isBound =
      pcall(_G.GetContainerItemInfo, bag, slot)
    if ok and itemID then
      return {
        itemID = itemID,
        stackCount = stackCount or 1,
        isLocked = isLocked == true,
        quality = quality,
        hyperlink = hyperlink,
        hasNoValue = hasNoValue == true,
        isBound = isBound == true,
      }
    end
  end
  return nil
end

local function containerItemID(bag, slot)
  local c = _G.C_Container
  if type(c) == "table" and type(c.GetContainerItemID) == "function" then
    local ok, id = pcall(c.GetContainerItemID, bag, slot)
    if ok and tonumber(id) then return tonumber(id) end
  end
  if type(_G.GetContainerItemID) == "function" then
    local ok, id = pcall(_G.GetContainerItemID, bag, slot)
    if ok and tonumber(id) then return tonumber(id) end
  end
  local info = containerItemInfo(bag, slot)
  return info and tonumber(info.itemID) or nil
end

local function containerUseItem(bag, slot)
  local c = _G.C_Container
  if type(c) == "table" and type(c.UseContainerItem) == "function" then
    return pcall(c.UseContainerItem, bag, slot)
  end
  if type(_G.UseContainerItem) == "function" then
    return pcall(_G.UseContainerItem, bag, slot)
  end
  return false, "missing UseContainerItem"
end

local function isMerchantWindowOpen()
  if seller.merchantOpen ~= nil then return seller.merchantOpen == true end
  local mf = _G.MerchantFrame
  if type(mf) == "table" and type(mf.IsShown) == "function" then
    local ok, shown = pcall(mf.IsShown, mf)
    if ok and shown == true then return true end
  end
  return false
end

local function resolveBagItemSellPrice(id)
  local name, quality, sellPrice, classID
  local vals = rawItemInfo(id)
  if type(vals) == "table" and type(vals[1]) == "string" and vals[1] ~= "" then
    name = vals[1]
    quality = tonumber(vals[3])
    sellPrice = tonumber(vals[11])
    local rawClass = vals[6]
    if type(rawClass) == "number" then classID = rawClass end
  end
  if not classID then
    classID = flipItemClass(id)
  end
  if classID == 12 then
    return nil, name, quality, classID -- 任务物品不卖
  end
  local cTip = _G.C_TooltipInfo
  if type(cTip) == "table" and type(cTip.GetItemByID) == "function" then
    local tipPrice, tipRead, tipUnsellable, tipCharges = inspectTooltipSellPrice(id)
    if tipRead then
      if tipUnsellable or tipCharges then
        return nil, name, quality, classID
      end
      if tipPrice and tipPrice > 0 then
        sellPrice = tipPrice
      end
    end
  end
  if not sellPrice or sellPrice <= 0 then
    local facts = type(_G.BlackthornesTSDB) == "table" and type(_G.BlackthornesTSDB.itemFacts) == "table"
      and _G.BlackthornesTSDB.itemFacts[id] or nil
    if type(facts) == "table" and tonumber(facts.v) and tonumber(facts.v) > 0 and (tonumber(facts.ch) or 0) == 0 then
      sellPrice = tonumber(facts.v)
      name = name or facts.n
      quality = quality or tonumber(facts.q)
    end
  end
  return sellPrice, name, quality, classID
end

---注册商人全卖按钮状态变化回调
function MerchantSeller.SetListener(fn)
  seller.onChanged = type(fn) == "function" and fn or nil
end

---当前出售模式：safe | unbound | all
---@return string
function MerchantSeller.GetMode()
  return seller.mode
end

---设置出售模式
---@param mode string
function MerchantSeller.SetMode(mode)
  if SELLER_MODE_LABELS[mode] then
    seller.mode = mode
  else
    seller.mode = "safe"
  end
  seller.armed = nil
  sellerNotify()
end

---轮换下一个出售模式
---@return string mode
function MerchantSeller.CycleMode()
  local curIdx = 1
  for i, m in ipairs(SELLER_MODE_ORDER) do
    if m == seller.mode then curIdx = i break end
  end
  local nextMode = SELLER_MODE_ORDER[(curIdx % #SELLER_MODE_ORDER) + 1]
  MerchantSeller.SetMode(nextMode)
  return nextMode
end

---返回模式中文名
---@param mode string|nil
---@return string
function MerchantSeller.ModeLabel(mode)
  return SELLER_MODE_LABELS[mode or seller.mode] or SELLER_MODE_LABELS.safe
end

function MerchantSeller.IsMerchantOpen()
  return isMerchantWindowOpen()
end

function MerchantSeller.IsSelling()
  return seller.selling == true
end

local function merchantPlanSignature(items)
  if type(items) ~= "table" or #items == 0 then return "" end
  local parts = {}
  for _, entry in ipairs(items) do
    parts[#parts + 1] = format("%d:%d:%d:%d:%d:%d:%s",
      tonumber(entry.bag) or -1,
      tonumber(entry.slot) or -1,
      tonumber(entry.itemID) or 0,
      tonumber(entry.count) or 0,
      entry.isBound and 1 or 0,
      tonumber(entry.quality) or 1,
      tostring(entry.hyperlink or ""))
  end
  return tconcat(parts, ";")
end

function MerchantSeller.IsArmed()
  if not seller.armed then return false end
  if seller.armed.mode ~= seller.mode then
    seller.armed = nil
    return false
  end
  if flipNowSeconds() - (seller.armed.at or 0) > MERCHANT_CONFIRM_WINDOW then
    seller.armed = nil
    return false
  end
  return true
end

function MerchantSeller.Status()
  return {
    merchantOpen = MerchantSeller.IsMerchantOpen(),
    selling = seller.selling == true,
    armed = MerchantSeller.IsArmed(),
    armedCount = seller.armed and seller.armed.count or 0,
    armedValue = seller.armed and seller.armed.totalValue or 0,
    mode = seller.mode,
    modeLabel = MerchantSeller.ModeLabel(seller.mode),
  }
end

---扫描背包中当前模式下可卖给商人的物品格子
---@param mode string|nil "safe" | "unbound" | "all"
---@return table[] items
---@return table summary
function MerchantSeller.Scan(mode)
  local activeMode = SELLER_MODE_LABELS[mode] and mode or seller.mode
  local items = {}
  local summary = {
    mode = activeMode,
    count = 0,
    totalUnits = 0,
    totalValue = 0,
    boundCount = 0,
    highQualityCount = 0,
    byQuality = {},
  }
  local maxBag = bagMaxIndex()
  for bag = 0, maxBag do
    local slots = containerNumSlots(bag)
    for slot = 1, slots do
      local info = containerItemInfo(bag, slot)
      local id = info and tonumber(info.itemID)
      if id and id > 0 and not info.isLocked and not info.hasNoValue and not isUnsellableItem(id) then
        local sellPrice, resolvedName, resolvedQ = resolveBagItemSellPrice(id)
        local q = tonumber(info.quality) or resolvedQ or 1
        local isBound = info.isBound == true
        local matches = false
        if activeMode == "all" then
          matches = true
        elseif activeMode == "unbound" then
          matches = not isBound
        else
          matches = (not isBound) and q <= 2
        end
        if matches and sellPrice and sellPrice > 0 then
          local stack = max(1, floor(tonumber(info.stackCount) or 1))
          local worth = sellPrice * stack
          items[#items + 1] = {
            bag = bag,
            slot = slot,
            itemID = id,
            hyperlink = info.hyperlink,
            name = resolvedName or format("物品 #%d", id),
            count = stack,
            quality = q,
            isBound = isBound,
            unitPrice = sellPrice,
            worth = worth,
          }
          summary.count = summary.count + 1
          summary.totalUnits = summary.totalUnits + stack
          summary.totalValue = summary.totalValue + worth
          summary.byQuality[q] = (summary.byQuality[q] or 0) + 1
          if isBound then summary.boundCount = summary.boundCount + 1 end
          if q >= 3 then summary.highQualityCount = summary.highQualityCount + 1 end
        end
      end
    end
  end
  return items, summary
end

---左键点击「一键全卖」：首次预览并进入 5 秒确认态；二次点击按 0.15s 节奏安全清空匹配物品
---@param onDone function|nil 完成或中止后的回调 (soldCount, soldValue, blockedByProtect)
---@return string status "closed" | "busy" | "empty" | "confirm" | "started" | "done" | "error"
---@return string message
---@return table|nil summary
function MerchantSeller.Click(onDone)
  if not MerchantSeller.IsMerchantOpen() then
    seller.armed = nil
    sellerNotify()
    return "closed", "请先打开 NPC 商人窗口。"
  end
  if seller.selling then
    return "busy", "正在出售背包物品，请稍候..."
  end

  local items, summary = MerchantSeller.Scan(seller.mode)
  if #items == 0 then
    seller.armed = nil
    sellerNotify()
    return "empty", format("当前「%s」模式下背包没有可出售的物品。", MerchantSeller.ModeLabel(seller.mode)), summary
  end

  local sig = merchantPlanSignature(items)
  local wasArmed = MerchantSeller.IsArmed()
  if not wasArmed or seller.armed.signature ~= sig then
    seller.armed = {
      at = flipNowSeconds(),
      count = #items,
      totalValue = summary.totalValue,
      mode = seller.mode,
      signature = sig,
    }
    sellerNotify()
    local warnParts = {}
    if summary.boundCount > 0 then warnParts[#warnParts + 1] = format("含 %d 格已绑定", summary.boundCount) end
    if summary.highQualityCount > 0 then warnParts[#warnParts + 1] = format("含 %d 格蓝/紫以上", summary.highQualityCount) end
    local warnText = #warnParts > 0 and (" |cffff5555（" .. tconcat(warnParts, "，") .. "！）|r") or ""
    local prefix = wasArmed and "背包待售清单已变化，请重新核对预览：" or ""
    local msg = format(
      "%s「%s」预览：共 %d 格（%d 件），预计收入 %s%s；5 秒内再次点击开始出售！",
      prefix, MerchantSeller.ModeLabel(seller.mode), #items, summary.totalUnits,
      formatFlipCopper(summary.totalValue), warnText
    )
    return "confirm", msg, summary
  end

  -- 二次确认后开始出售：第 1 格直接在当前硬件点击内卖出，其余按 0.15s 节奏卖出
  seller.armed = nil
  seller.selling = true
  seller.sessionId = seller.sessionId + 1
  local sid = seller.sessionId
  local soldSlots, soldValue = 0, 0
  sellerNotify()

  local function finish(blockedMsg)
    if seller.sessionId ~= sid then return end
    seller.selling = false
    sellerNotify()
    if type(onDone) == "function" then
      pcall(onDone, soldSlots, soldValue, blockedMsg)
    end
  end

  local function sellOne(entry)
    local curInfo = containerItemInfo(entry.bag, entry.slot)
    if type(curInfo) ~= "table"
      or tonumber(curInfo.itemID) ~= entry.itemID
      or curInfo.isLocked == true
      or curInfo.hasNoValue == true
      or max(1, floor(tonumber(curInfo.stackCount) or 1)) ~= entry.count
      or (curInfo.isBound == true) ~= (entry.isBound == true)
      or (type(entry.hyperlink) == "string" and entry.hyperlink ~= "" and curInfo.hyperlink ~= entry.hyperlink) then
      return true, false
    end
    local okCall, errCall = containerUseItem(entry.bag, entry.slot)
    if not okCall then
      return false, tostring(errCall or "调用被客户端拒绝")
    end
    soldSlots = soldSlots + 1
    soldValue = soldValue + (entry.worth or 0)
    return true, true
  end

  local okFirst, errFirst = sellOne(items[1])
  if not okFirst then
    seller.selling = false
    sellerNotify()
    return "error", format("出售失败：%s", tostring(errFirst)), summary
  end

  if #items == 1 then
    local msg = format("一键全卖完成：共售出 %d 格，预计收入 %s。", soldSlots, formatFlipCopper(soldValue))
    finish(nil)
    return "done", msg, summary
  end

  local idx = 1
  local hasTimer = type(C_Timer) == "table" and type(C_Timer.After) == "function"
  if not hasTimer then
    for i = 2, #items do
      if not seller.selling or seller.sessionId ~= sid or not MerchantSeller.IsMerchantOpen() then break end
      local okNext = sellOne(items[i])
      if not okNext then break end
    end
    local msg = format("一键全卖完成：共售出 %d 格，预计收入 %s。", soldSlots, formatFlipCopper(soldValue))
    finish(nil)
    return "done", msg, summary
  end

  local function stepNext()
    if seller.sessionId ~= sid then return end
    idx = idx + 1
    local entry = items[idx]
    if not entry or not seller.selling or not MerchantSeller.IsMerchantOpen() then
      finish(nil)
      return
    end
    local okNext, errOrSold = sellOne(entry)
    if not okNext then
      finish(format("客户端限制定时续卖（已卖 %d 格，余 %d 格请再点按钮继续）：%s",
        soldSlots, #items - idx + 1, tostring(errOrSold)))
      return
    end
    if idx >= #items then
      finish(nil)
      return
    end
    C_Timer.After(MERCHANT_SELL_GAP, stepNext)
  end

  C_Timer.After(MERCHANT_SELL_GAP, stepNext)
  return "started", format("开始出售 %d 格物品（预计 %s）...", #items, formatFlipCopper(summary.totalValue)), summary
end

function MerchantSeller.Stop(reason)
  local wasActive = seller.selling or seller.armed ~= nil
  seller.selling = false
  seller.armed = nil
  seller.sessionId = seller.sessionId + 1
  if wasActive or reason then sellerNotify() end
end

function MerchantSeller.OnEvent(event)
  if event == "MERCHANT_SHOW" then
    seller.merchantOpen = true
    seller.armed = nil
    sellerNotify()
  elseif event == "MERCHANT_CLOSED" then
    seller.merchantOpen = false
    MerchantSeller.Stop()
    sellerNotify()
  elseif event == "BAG_UPDATE_DELAYED" and seller.merchantOpen and not seller.selling then
    sellerNotify()
  end
end
