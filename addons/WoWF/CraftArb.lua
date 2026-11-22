-- ============================================================================
-- WoWF CraftArb · 制造套利引擎
-- 数据源：EasyAuction 行情与专业数据库 + 本插件自行采集的原生配方
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
local format, lower, find, sub = string.format, string.lower, string.find, string.sub
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
local DEFAULT_CUT = 0.05 -- EasyAuction 未提供手续费设置时的兜底值

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

-- 与 EasyAuction 保持一致的身份规则：无限服按「规则集」，正式服/怀旧服按服务器名
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

local function realmName()
  if type(GetRealmName) ~= "function" then return "" end
  local ok, value = pcall(GetRealmName)
  if ok and type(value) == "string" then return value end
  return ""
end

---当前角色的完整身份（EasyAuction 存档键 = 角色名-规则集/服务器）
---@return table { name, ruleset, key }
function Arb.Identity()
  local name, realm = playerName(), realmName()
  local ruleset = liveRuleset() or realm or "Realm"
  return { name = name, ruleset = ruleset, key = name .. "-" .. ruleset }
end

---EasyAuction 里的存档键是否为当前角色
---按完整身份键比较；记录里带 name/ruleset 时同时校验，避免同名不同规则集串号
---@param owner string|nil EasyAuction 存档键
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
-- 3. 拍卖行行情接入（EasyAuction 优先，兼容黑石交易技能 Blackthornes_TS）
-- ============================================================================

---EasyAuction 的全局 API，未就绪时返回 nil
---@return table|nil
function Arb.Market()
  local api = _G.EasyAuctionAPI
  if type(api) ~= "table" or type(api.IsReady) ~= "function" then return nil end
  local ok, ready = pcall(api.IsReady)
  if not ok or ready ~= true then return nil end
  return api
end

local function blackthornesPriceTable()
  local db = _G.BlackthornesTSDB
  if type(db) ~= "table" or type(db.prices) ~= "table" then return nil end
  local realm = realmName()
  local faction
  if type(UnitFactionGroup) == "function" then
    local ok, value = pcall(UnitFactionGroup, "player")
    if ok and type(value) == "string" and value ~= "" then faction = value end
  end
  if realm ~= "" and faction then
    local t = db.prices[realm .. "-" .. faction]
    if type(t) == "table" and next(t) ~= nil then return t end
  end
  return nil
end

local function blackthornesApi()
  local api = _G.BlackthornesTS_API
  if type(api) == "table" and type(api.GetPrice) == "function" then return api end
  return nil
end

---当前实际生效的行情数据源："easyauction" | "blackthornes" | nil
---@return string|nil
function Arb.MarketProvider()
  if Arb.Market() then return "easyauction" end
  if blackthornesPriceTable() or blackthornesApi() then return "blackthornes" end
  return nil
end

---区分「未安装」「已安装但行情未初始化」「就绪」三种状态
---@return string
function Arb.ApiState()
  if Arb.MarketProvider() then return "ready" end
  if type(_G.EasyAuctionAPI) == "table" or type(_G.BlackthornesTSDB) == "table" or type(_G.BlackthornesTS_API) == "table" then
    return "loading"
  end
  return "missing"
end

local quoteCache, sellCache, recipeListCache, rowCache, vendorRowsCache
-- 是否在本轮分析中把 NPC 商人价作为采购成本（由 Analyse 的 preferVendor 选项设置）
local costPrefersVendor = false
-- 每次成功采集商人商品都会 +1，纳入缓存签名（同一秒内改价也能让制造行/报价缓存失效）
local vendorVersion = 0

---清空全部缓存（行情修订号变化、物品数据加载完成、拍卖行开关时调用）
function Arb.Reset()
  quoteCache, sellCache = {}, {}
  recipeListCache = { stamp = nil, list = nil }
  rowCache = { stamp = nil }
  vendorRowsCache = { stamp = nil }
end
Arb.Reset()

local function revision()
  local api = Arb.Market()
  if api and type(api.GetRevision) == "function" then
    local ok, value = pcall(api.GetRevision)
    if ok then return tonumber(value) end
  end
  local db = _G.BlackthornesTSDB
  if type(db) == "table" and (blackthornesPriceTable() or blackthornesApi()) then
    local tbl = blackthornesPriceTable()
    local count = 0
    if tbl then for _ in pairs(tbl) do count = count + 1 end end
    return tconcat({ "bt", floor(tonumber(db.lastScan) or tonumber(db.lastFullScan) or 0), count }, ":")
  end
  return nil
end

---按需要购买的数量取单价：优先用 EasyAuction 的可购深度，其次兼容黑石交易技能价格阶梯与存档，
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
  local api = Arb.Market()
  local btPrices = not api and blackthornesPriceTable() or nil
  local btApi = not api and blackthornesApi() or nil
  local unit, source, shortfall
  if not api and not btPrices and not btApi then
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

  if api then
    if type(api.GetDepth) == "function" then
      local ok, depth = pcall(api.GetDepth, id, 200)
      if ok and type(depth) == "table" and depth.complete == true then
        local total = tonumber(depth.totalQuantity) or 0
        local covered = tonumber(depth.coveredQuantity) or 0
        if total < wanted then
          -- 库存不足：仍可用报价估算单价，但要标记「买不齐」
          shortfall = { have = total, need = wanted }
        end
        if covered >= wanted then
          local spent, left = 0, wanted
          for _, level in ipairs(depth.levels or {}) do
            if left <= 0 then break end
            local amount = min(left, tonumber(level[2]) or 0)
            if amount > 0 then
              spent, left = spent + amount * (tonumber(level[1]) or 0), left - amount
            end
          end
          if left <= 0 and spent > 0 then unit, source = spent / wanted, "depth" end
        end
      end
    end

    if not unit and type(api.GetRecord) == "function" then
      local ok, record = pcall(api.GetRecord, id)
      if ok and type(record) == "table" then
        local price = tonumber(record.rivalMin) or tonumber(record.min) or tonumber(record.market)
        if price and price > 0 then unit, source = price, "record" end
      end
    end
  else
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

---产出可卖出的参考价：优先压过对手的最低价（rivalMin），否则当前最低价/行情估计
---@param itemID number
---@return number|nil price
---@return table|nil record
function Arb.SellQuote(itemID)
  local id = tonumber(itemID)
  if not id then return nil end
  local cached = sellCache[id]
  if cached then return cached.price, cached.record end
  local api = Arb.Market()
  if api and type(api.GetRecord) == "function" then
    local ok, record = pcall(api.GetRecord, id)
    if not ok or type(record) ~= "table" then return nil end
    local price = tonumber(record.rivalMin) or tonumber(record.min) or tonumber(record.market)
    sellCache[id] = { price = price, record = record }
    return price, record
  end
  local btPrices = blackthornesPriceTable()
  local record = btPrices and btPrices[id]
  if type(record) == "table" then
    local price = tonumber(record.rivalMin) or tonumber(record.min) or tonumber(record.market)
    if price and price > 0 then
      sellCache[id] = { price = price, record = record }
      return price, record
    end
  end
  local btApi = blackthornesApi()
  if btApi then
    local ok, price = pcall(btApi.GetPrice, id)
    if ok and type(price) == "number" and price > 0 then
      sellCache[id] = { price = price, record = nil }
      return price, nil
    end
  end
  return nil
end

---拍卖行手续费率（EasyAuction / 黑石交易技能设置，缺省 5%）
---@return number
function Arb.AuctionCut()
  local api = Arb.Market()
  if api and type(api.GetSettings) == "function" then
    local ok, settings = pcall(api.GetSettings)
    if ok and type(settings) == "table" then
      local cut = tonumber(settings.auctionCut)
      if cut and cut >= 0 and cut < 1 then return cut end
    end
  end
  local bt = _G.BlackthornesTSDB
  if type(bt) == "table" and type(bt.settings) == "table" then
    local cut = tonumber(bt.settings.auctionCut)
    if cut and cut >= 0 and cut < 1 then return cut end
  end
  return DEFAULT_CUT
end

-- ============================================================================
-- 4. 配方来源：EasyAuction 账号级专业库 + 本插件自行采集
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

---把 EasyAuction 存档里的配方记录归一化成引擎内部结构
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

---读取 EasyAuction / 黑石交易技能 账号级专业数据库里的全部角色配方
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

  local ea = _G.EasyAuctionDB12
  local eaProf = type(ea) == "table" and ea.professions
  readChars(type(eaProf) == "table" and eaProf.characters or nil, "easyauction")

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
  local ea = _G.EasyAuctionDB12
  local eaEntry = type(ea) == "table" and ea.professions
  scanChars(type(eaEntry) == "table" and eaEntry.characters or nil)
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
  -- 本插件采集的配方只属于当前角色；与 EasyAuction 逐条去重，保留 EasyAuction 条目并补充本插件独有配方
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
      local price, record = Arb.SellQuote(offer.itemID)
      -- 单件买入价即最低档价（批量时按档位逐段计价，见 VendorBuyFor）
      local buyForOne = Arb.VendorBuyFor(offer.itemID, 1)
      local buyPrice = (buyForOne and buyForOne.unit) or offer.price
      local row = {
        outputID = offer.itemID, name = Arb.ItemName(offer.itemID), kind = "vendor",
        vendorPrice = buyPrice, listPrice = offer.price, vendorNPC = offer.npc, vendorZone = offer.zone,
        vendorStock = offer.stock, vendorStack = offer.stack, vendorInfinite = offer.infinite == true,
        vendorSources = offer.sources, vendorTotalStock = offer.totalStock,
        vendorAt = offer.at,
        price = price, record = record,
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

    if row.craftable then
      priced = priced + 1
      local price, record = Arb.SellQuote(recipe.output)
      row.price, row.record = price, record
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
---@param options table { mode = "sell"|"de", source = "craft"|"vendor"|"both", profession = key|table|nil,
---                        ownOnly = bool, onlyProfitable = bool, onlySkillUp = bool, crossOwner = bool,
---                        sort = "profit"|"roi", query = string }
---@return table[] rows
---@return table meta
function Arb.Analyse(options)
  options = type(options) == "table" and options or {}
  ensureFresh()
  local mode = options.mode == "de" and "de" or "sell"
  local source = options.source == "vendor" and "vendor"
    or (options.source == "both" and "both" or "craft")
  -- 商人套利只看「商人买入 → 拍卖行卖出」，与成品出售/分解模式无关，固定用 sell 口径
  if source == "vendor" then mode = "sell" end
  local crossOwner = options.crossOwner == true
  costPrefersVendor = options.preferVendor == true
  local cacheKey = mode .. (crossOwner and ":cross" or ":own") .. (costPrefersVendor and ":vendor" or "")
  local cache = rowCache[cacheKey]
  local cut, cachedPriced
  if not cache then
    cache, cut, cachedPriced = buildRows(mode, crossOwner)
    rowCache[cacheKey] = { rows = cache, priced = cachedPriced, cut = cut }
  else
    cut, cachedPriced = cache.cut, cache.priced
    cache = cache.rows
  end
  cut = cut or DEFAULT_CUT

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
  local craftCache = cache
  local vendorRows, vendorMeta
  if source ~= "craft" then
    vendorRows, vendorMeta = Arb.VendorArbitrage({
      onlyProfitable = options.onlyProfitable, query = options.query,
    })
    for _, row in ipairs(vendorRows) do
      tinsert(rows, row)
      if row.profit and row.profit > 0 then profitable = profitable + 1 end
    end
  end
  for _, row in ipairs(source == "vendor" and {} or craftCache) do
    local keep = true
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

  local api = Arb.Market()
  local marketInfo
  if api and type(api.GetMarketInfo) == "function" then
    local ok, value = pcall(api.GetMarketInfo)
    if ok then marketInfo = value end
  elseif type(_G.BlackthornesTSDB) == "table" and Arb.MarketProvider() == "blackthornes" then
    local bt = _G.BlackthornesTSDB
    local updated = tonumber(bt.lastScan) or tonumber(bt.lastFullScan) or 0
    if updated > 0 then marketInfo = { updatedAt = updated } end
  end

  local total, pricedCount, hiddenCount = 0, 0, 0
  if source ~= "vendor" then
    total = #craftCache
    pricedCount = cachedPriced or 0
    hiddenCount = hiddenByKeep
  end
  if vendorMeta then
    total = total + vendorMeta.offers
    pricedCount = pricedCount + vendorMeta.priced
    hiddenCount = hiddenCount + vendorMeta.hidden
  end
  return rows, {
    mode = mode, source = source, cut = cut, state = Arb.ApiState(), provider = Arb.MarketProvider(), revision = revision(),
    market = marketInfo, professions = professions,
    total = total, priced = pricedCount, shown = #rows, hidden = hiddenCount,
    profitable = profitable, best = rows[1],
    players = #storedRecipeSets(), ownProfessions = Arb.Professions(), identity = Arb.Identity(),
    vendorOffers = vendorMeta and vendorMeta.offers or 0,
  }
end

-- ============================================================================
-- 8. 一键写入 EasyAuction 购物清单
-- ============================================================================

---按 UTF-8 字符边界截断字符串并附加 "…"，总字节数不超过 maxBytes
local function truncateUtf8(text, maxBytes)
  if #text <= maxBytes then return text end
  local limit = maxBytes - 3
  if limit <= 0 then return "…" end
  local pos = limit
  while pos > 0 do
    local b = text:byte(pos)
    if b < 0x80 or b >= 0xC0 then
      local charLen = 1
      if b >= 0xF0 then charLen = 4
      elseif b >= 0xE0 then charLen = 3
      elseif b >= 0xC0 then charLen = 2 end
      if pos + charLen - 1 <= limit then
        return sub(text, 1, pos + charLen - 1) .. "…"
      end
      return sub(text, 1, pos - 1) .. "…"
    end
    pos = pos - 1
  end
  return "…"
end

---把一条利润行需要采购的叶子材料写入 EasyAuction 或黑石交易技能购物清单
---@param row table Analyse 返回的利润行
---@param label string|nil 清单名后缀（一般是产出物品名）
---@return boolean ok
---@return string|number listID 或失败原因
---@return string|nil note 部分成功时的补充说明
function Arb.AddToShoppingList(row, label)
  if type(row) ~= "table" or type(row.leaves) ~= "table" or #row.leaves == 0 then
    return false, "该配方没有需要采购的材料"
  end
  local title = "WoWF 制造套利"
  if type(label) == "string" and label ~= "" then
    title = truncateUtf8(title .. " · " .. label, 48)
  end

  local api = Arb.Market()
  if api then
    if type(api.CreateShoppingList) ~= "function" or type(api.SetShoppingListItem) ~= "function" then
      return false, "EasyAuction 版本过旧，缺少购物清单 API"
    end
    local created, listID = pcall(api.CreateShoppingList, title, true)
    if not created then return false, tostring(listID or "创建购物清单失败") end
    if not listID then return false, "创建购物清单失败" end

    local accepted, failed = 0, {}
    for _, leaf in ipairs(row.leaves) do
      -- 数量向上取整到整件；单价上限给 5% 余量，避免材料涨价后清单直接失效
      local cap = leaf.unit and ceil(leaf.unit * 1.05) or nil
      local okItem, reason = pcall(api.SetShoppingListItem, listID, leaf.itemID,
        ceil(leaf.quantity), cap, Arb.ItemName(leaf.itemID))
      if okItem and reason == true then
        accepted = accepted + 1
      else
        tinsert(failed, tostring(reason or "未知错误"))
      end
    end
    if type(api.OpenShoppingList) == "function" then
      -- 拍卖行没打开时这里会返回 auction-house-closed，属于预期情况，不影响清单写入
      pcall(api.OpenShoppingList, listID)
    end
    if accepted == 0 then
      return false, (failed[1] and ("写入购物清单失败: " .. failed[1])) or "写入购物清单失败"
    end
    if #failed > 0 then
      return true, listID, format("%d/%d 条材料写入成功", accepted, #row.leaves)
    end
    return true, listID
  end

  local bt = _G.BlackthornesTSDB
  if type(bt) == "table" then
    if type(bt.shoppingLists) ~= "table" then bt.shoppingLists = {} end
    local nextId = tonumber(bt.shoppingListNextId) or (#bt.shoppingLists + 1)
    if nextId < 1 then nextId = 1 end
    local items = {}
    for _, leaf in ipairs(row.leaves) do
      local cap = leaf.unit and ceil(leaf.unit * 1.05) or nil
      tinsert(items, { id = leaf.itemID, want = max(1, ceil(leaf.quantity or 1)), maxPay = cap })
    end
    tinsert(bt.shoppingLists, { id = nextId, name = title, items = items })
    bt.shoppingListNextId = nextId + 1
    return true, nextId, "已写入黑石交易技能购物清单"
  end

  return false, "EasyAuction / 黑石交易技能均未就绪"
end
