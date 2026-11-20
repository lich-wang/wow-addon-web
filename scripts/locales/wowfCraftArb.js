/**
 * 生成 WoWF/CraftArb.lua —— 「制造套利」引擎（纯数据与计算，不创建任何界面元素）
 *
 * 数据来源：
 * - EasyAuction 行情：全局 `EasyAuctionAPI`（GetRecord / GetDepth / GetSettings / GetMarketInfo）
 * - EasyAuction 专业数据库：账号级存档 `EasyAuctionDB12.professions.characters[*]`，
 *   含各角色已学配方与专业等级（详见 EasyAuction/EASYAUCTION_API.md 的存档结构说明）
 * - 本插件自行采集：`C_TradeSkillUI`（WoWFDB.recipeCache），在打开专业窗口时补全
 *
 * 计算模型：把每条已学配方折算成「按拍卖行采购 → 制作 → 出售或分解」的净利润，
 * 材料成本会递归展开中间产物（布 → 布卷 → 装备），附魔角色额外估算分解期望值。
 */

/**
 * @returns {string} WoWF/CraftArb.lua 的完整 Lua 源码
 */
export function generateWoWFCraftArbLua() {
  return String.raw`-- ============================================================================
-- WoWF CraftArb · 制造套利引擎
-- 数据源：EasyAuction 行情与专业数据库 + 本插件自行采集的原生配方
-- 职责：递归折算材料成本（含中间产物自产）、估算售价/分解收益与净利润
-- 本文件只做数据与计算，不创建任何界面元素；界面在 WoWF.lua 的「制造套利」页
-- ============================================================================

local Arb = {}
WoWF_CraftArb = Arb
WoWFDB = WoWFDB or {}

Arb.VERSION = 1

local type, tonumber, tostring, pairs, ipairs, pcall = type, tonumber, tostring, pairs, ipairs, pcall
local floor, ceil, max, min, huge = math.floor, math.ceil, math.max, math.min, math.huge
local tinsert, tsort, tconcat = table.insert, table.sort, table.concat
local format, lower, find = string.format, string.lower, string.find
local time = time
local Enum = _G.Enum
local C_TradeSkillUI = _G.C_TradeSkillUI
local C_Item = _G.C_Item

local function now()
  local ok, value = pcall(time)
  if ok then return tonumber(value) or 0 end
  return 0
end

local MAX_CRAFT_DEPTH = 4 -- 递归展开中间产物的最大层数（布 → 卷 → 装备 = 2 层）
local DEFAULT_CUT = 0.05 -- EasyAuction 未提供手续费设置时的兜底值

-- ============================================================================
-- 1. 专业名称与角色专业等级
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

local GATHERING = { herbalism = true, mining = true, skinning = true, fishing = true }

---把专业名（中文或英文）归一化成稳定的内部 key
---@param name string|nil
---@return string|nil
function Arb.ProfessionKey(name)
  if type(name) ~= "string" or name == "" then return nil end
  return PROFESSION_KEYS[name] or PROFESSION_KEYS[lower(name)]
end

---该专业是否属于采集类（采集专业本身不产出可拍卖配方，仅用于说明）
---@param key string|nil
---@return boolean
function Arb.IsGathering(key)
  return GATHERING[key] == true
end

---读取当前角色已学的专业与等级（优先 GetProfessions，其次 C_TradeSkillUI）
---@return table[] 形如 { key, name, level, max, skillLineID, texture }
function Arb.Professions()
  local list, seen = {}, {}
  local function add(name, level, maxLevel, skillLineID, texture)
    local key = Arb.ProfessionKey(name)
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

---当前角色存档键（与 EasyAuction 的 name-realm 形式保持一致，仅用于展示）
---@return string
local function ownCharacter()
  local name, realm = "Player", ""
  if type(UnitName) == "function" then
    local ok, value = pcall(UnitName, "player")
    if ok and type(value) == "string" and value ~= "" then name = value end
  end
  if type(GetRealmName) == "function" then
    local ok, value = pcall(GetRealmName)
    if ok and type(value) == "string" then realm = value end
  end
  return name .. "-" .. realm
end

---EasyAuction 里的存档键是否为当前角色
---经典客户端是「角色名-服务器」，无限服是「角色名-规则集(PvE/PvP/...)」，统一按角色名前缀匹配
---@param owner string|nil
---@return boolean
function Arb.IsOwnCharacter(owner)
  if type(owner) ~= "string" or owner == "" then return false end
  local name = "Player"
  if type(UnitName) == "function" then
    local ok, value = pcall(UnitName, "player")
    if ok and type(value) == "string" and value ~= "" then name = value end
  end
  return owner == name or owner:sub(1, #name + 1) == name .. "-"
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
  if cached then return cached end
  local values = rawItemInfo(id)
  if not values or type(values[1]) ~= "string" or values[1] == "" then
    -- 首次读取会触发客户端加载，下一次渲染再取
    if type(C_Item) == "table" and type(C_Item.RequestLoadItemDataByID) == "function" then
      pcall(C_Item.RequestLoadItemDataByID, id)
    end
    return { id = id }
  end
  -- GetItemInfo 经典返回值顺序：name, link, quality, iLevel, reqLevel, class, subClass,
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
  return info
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

-- ============================================================================
-- 3. EasyAuction 行情接入
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

---区分「未安装」「已安装但行情未初始化」「就绪」三种状态
---@return string
function Arb.ApiState()
  local api = _G.EasyAuctionAPI
  if type(api) ~= "table" or type(api.IsReady) ~= "function" then return "missing" end
  local ok, ready = pcall(api.IsReady)
  if ok and ready == true then return "ready" end
  return "loading"
end

local quoteCache = {}
local sellCache = {}
-- 配方列表缓存（在「配方来源」一节填充）与分析结果缓存（在「分析入口」一节填充），
-- 统一提前声明，Reset 才能在拍卖行开关时一并清空，触发按新行情重算。
local recipeListCache = { stamp = nil, list = nil }
local rowCache = { stamp = nil }

---清空全部缓存（行情修订号变化、拍卖行开关时自动调用）
function Arb.Reset()
  quoteCache, sellCache = {}, {}
  recipeListCache.stamp, recipeListCache.list = nil, nil
  rowCache = { stamp = nil }
end

local function revision()
  local api = Arb.Market()
  if not api or type(api.GetRevision) ~= "function" then return nil end
  local ok, value = pcall(api.GetRevision)
  if ok then return tonumber(value) end
end

---按需要购买的数量取单价：优先用 EasyAuction 的可购深度，其次回落到存档报价
---@param itemID number
---@param quantity number 需要购买的数量（>0）
---@return number|nil unitPrice 单价（铜）
---@return string|nil source "depth" | "record" | "insufficient" | "no-api"
---@return table|nil detail
function Arb.PriceFor(itemID, quantity)
  local id = tonumber(itemID)
  if not id then return nil, "no-api" end
  local wanted = max(1, tonumber(quantity) or 1)
  local key = id .. "|" .. wanted
  local cached = quoteCache[key]
  if cached then return cached.unit, cached.source, cached end

  local api = Arb.Market()
  if not api then return nil, "no-api" end
  local unit, source, shortfall

  if type(api.GetDepth) == "function" then
    local ok, depth = pcall(api.GetDepth, id, 200)
    if ok and type(depth) == "table" and depth.complete == true then
      local total = tonumber(depth.totalQuantity) or 0
      local covered = tonumber(depth.coveredQuantity) or 0
      if total < wanted then
        -- 库存不足：仍可用报价估算单价，但要标记买不齐，避免给出「能全额采购」的假象
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

  local entry = { unit = unit, source = source or (shortfall and "insufficient" or "no-data"), shortfall = shortfall }
  quoteCache[key] = entry
  if not shortfall and not unit and source == nil then entry.source = "insufficient" end
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
  if not api or type(api.GetRecord) ~= "function" then return nil end
  local ok, record = pcall(api.GetRecord, id)
  if not ok or type(record) ~= "table" then return nil end
  local price = tonumber(record.rivalMin) or tonumber(record.min) or tonumber(record.market)
  sellCache[id] = { price = price, record = record }
  return price, record
end

---拍卖行手续费率（EasyAuction 设置，缺省 5%）
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

---读取 EasyAuction 账号级专业数据库里的全部角色配方
---@return table[] 形如 { owner, ownerName, skills, recipes, source }
local function storedRecipeSets()
  local sets = {}
  local db = _G.EasyAuctionDB12
  local professions = type(db) == "table" and db.professions
  local characters = type(professions) == "table" and professions.characters
  if type(characters) ~= "table" then return sets end
  for owner, record in pairs(characters) do
    if type(record) == "table" and type(record.recipes) == "table" then
      local skills = {}
      for _, skill in ipairs(record.professions or {}) do
        local key = Arb.ProfessionKey(skill.name or skill.professionName)
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
          owner = tostring(owner), ownerName = record.name or tostring(owner),
          skills = skills, recipes = recipes, source = "easyauction",
        })
      end
    end
  end
  return sets
end

---本插件自己采集的配方（WoWFDB.recipeCache），当前角色专用
---@return table|nil
local function ownRecipeSet()
  local cache = WoWFDB.recipeCache
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
  return { owner = ownCharacter(), ownerName = "当前角色", skills = skills, recipes = recipes, source = "local" }
end

---签名用于判定配方缓存是否过期（行情修订号 / 账号库采集时间 / 本地采集时间）
---@return string
local function recipeSignature()
  local count, stamp, characters = 0, 0, 0
  local db = _G.EasyAuctionDB12
  local entry = type(db) == "table" and db.professions
  local records = type(entry) == "table" and entry.characters
  if type(records) == "table" then
    for _, record in pairs(records) do
      characters = characters + 1
      local at = type(record) == "table" and tonumber(record.recipesCachedAt) or 0
      if at and at > stamp then stamp = at end
    end
  end
  local local_cache = WoWFDB.recipeCache
  if type(local_cache) == "table" then
    for _ in pairs(local_cache) do count = count + 1 end
  end
  return tconcat({ characters, floor(stamp), count, floor(tonumber(WoWFDB.recipeCacheAt) or 0) }, ":")
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
        local key = tostring(recipe.output) .. "@" .. tostring(recipe.id) .. "@" .. tostring(set.owner)
        if not seen[key] then
          seen[key] = true
          local professionKey = Arb.ProfessionKey(recipe.professionName) or Arb.ProfessionKey(set.professionName)
          local skill = professionKey and set.skills and set.skills[professionKey] or nil
          if not professionKey and type(recipe.professionName) == "string" then
            -- 未收录的专业名（如后续资料片新增专线）原样保留，避免被清空
            recipe.professionKey, recipe.professionName = nil, recipe.professionName
          else
            recipe.professionKey = professionKey
            recipe.professionName = professionKey and Arb.ProfessionNames[professionKey] or recipe.professionName
          end
          recipe.owner, recipe.ownerName, recipe.ownerSource = set.owner, set.ownerName, set.source
          recipe.skill, recipe.skillMax = skill and skill.level or nil, skill and skill.max or nil
          tinsert(list, recipe)
        end
      end
    end
  end
  local sets = storedRecipeSets()
  ingest(sets)
  local own = ownRecipeSet()
  -- 同一角色若 EasyAuction 已有采集结果，则不再叠加本插件的副本
  if own then
    local duplicated = false
    for _, set in ipairs(sets) do
      if set.owner == own.owner or Arb.IsOwnCharacter(set.owner) then duplicated = true; break end
    end
    if not duplicated then ingest({ own }) end
  end
  tsort(list, function(left, right) return left.id < right.id end)
  recipeListCache.stamp, recipeListCache.list = stamp, list
  return list
end

---从原生专业窗口采集当前专业线的全部已学配方（打开专业窗口时调用）
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
  local cache = WoWFDB.recipeCache
  if type(cache) ~= "table" then cache = {}; WoWFDB.recipeCache = cache end
  local basic = Enum and Enum.CraftingReagentType and Enum.CraftingReagentType.Basic or 1
  local count, touched = 0, {}

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
        cache[recipeID] = {
          id = recipeID, name = info.name or schematic.name, output = output,
          qMin = max(1, tonumber(schematic.quantityMin) or 1),
          qMax = max(1, tonumber(schematic.quantityMax) or tonumber(schematic.quantityMin) or 1),
          professionName = professionName, skillLineID = tonumber(skillLineID),
          difficulty = difficultyWord(info), gray = tonumber(info.maxTrivialLevel) or 0,
          reagents = reagents, slots = slots, at = now(),
        }
        count = count + 1
        if skillLineID then touched[skillLineID] = true end
      end
    end
  end

  -- 在同一专业线内清理已遗忘的配方，避免残留条目冒充「当前可以制作」
  local current = {}
  for _, recipeID in ipairs(ids) do current[recipeID] = true end
  for recipeID, record in pairs(cache) do
    local line = type(record) == "table" and tonumber(record.skillLineID)
    if line and touched[line] and not current[recipeID] then cache[recipeID] = nil end
  end

  WoWFDB.recipeCacheAt = now()
  recipeListCache.stamp = nil
  return count
end

-- ============================================================================
-- 5. 分解收益（1.60.1 经典分解表，按装等 + 品质 + 护甲/武器）
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
---@return table|nil result 形如 { ev, parts = { { itemID, chance, quantity, price, value } }, unknown }
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
-- 6. 成本引擎：递归展开中间产物
-- ============================================================================

local function averageYield(recipe)
  local low = tonumber(recipe.qMin) or 1
  local high = tonumber(recipe.qMax) or low
  if high < low then high = low end
  return (low + high) / 2
end

---递归计算一条配方的材料成本；同一（配方,深度）在单次根计算内复用
local function recipeCost(recipe, ctx)
  local key = tostring(recipe.id) .. "@" .. tostring(ctx.depth)
  local cached = ctx.crafts[key]
  if cached ~= nil then return cached end
  ctx.crafts[key] = false -- 占位，防止配方互相引用时无限递归

  local result = {
    total = 0, lines = {}, leaves = {}, leafIndex = {}, missing = {}, unknown = false,
    crafts = {}, yield = averageYield(recipe),
  }
  local function addLeaf(itemID, quantity, unit)
    local leaf = result.leafIndex[itemID]
    if leaf then
      leaf.quantity = leaf.quantity + quantity
    else
      leaf = { itemID = itemID, quantity = quantity, unit = unit }
      result.leafIndex[itemID] = leaf
      tinsert(result.leaves, leaf)
    end
  end

  local function addLine(itemID, quantity, unit, source, detail)
    local line = {
      itemID = itemID, quantity = quantity, unit = unit, source = source, detail = detail,
      cost = unit and unit * quantity or nil,
    }
    tinsert(result.lines, line)
    if line.cost then
      result.total = result.total + line.cost
    else
      result.unknown = true
      tinsert(result.missing, itemID)
    end
    if source == "craft" and detail and detail.cost then
      -- 中间产物自产时，把子配方的叶子材料按「需要几份」放大后合并上来，
      -- 否则采购清单只会停在中间产物层级，玩家仍然买不到真正的原料。
      tinsert(result.crafts, line)
      local sub = detail.cost
      local factor = sub.yield > 0 and (quantity / sub.yield) or quantity
      for _, subLeaf in ipairs(sub.leaves or {}) do
        addLeaf(subLeaf.itemID, subLeaf.quantity * factor, subLeaf.unit)
      end
      if detail.shortfall then result.stockShort = true end
    elseif source ~= "craft" then
      addLeaf(itemID, quantity, unit)
      if detail and detail.shortfall then result.stockShort = true end
    end
  end

  local function unitCost(itemID, quantity)
    local buy, source, detail = Arb.PriceFor(itemID, quantity)
    local best
    if ctx.depth > 0 and not ctx.path[itemID] then
      local producers = ctx.index[itemID]
      if producers then
        -- 先用同一角色自己的配方（才是「当前能自己做」），再按设置决定是否借用同账号其他角色
        local candidates, fallback = {}, {}
        for _, producer in ipairs(producers) do
          if producer.owner == ctx.owner then tinsert(candidates, producer) else tinsert(fallback, producer) end
        end
        if #candidates == 0 then
          if ctx.crossOwner then
            candidates, fallback = fallback, {}
          else
            candidates = {}
          end
        end
        ctx.path[itemID] = true
        for _, producer in ipairs(candidates) do
          local sub = recipeCost(producer, {
            depth = ctx.depth - 1, path = ctx.path, crafts = ctx.crafts, index = ctx.index,
            quotes = ctx.quotes, owner = ctx.owner, crossOwner = ctx.crossOwner,
          })
          if sub and not sub.unknown and sub.total and sub.total > 0 and sub.perUnit then
            if not best or sub.perUnit < best.unit then
              best = { unit = sub.perUnit, recipe = producer, cost = sub }
            end
          end
        end
        ctx.path[itemID] = nil
      end
    end
    if best and (not buy or best.unit < buy) then
      return best.unit, "craft", {
        recipe = best.recipe, cost = best.cost, marketUnit = buy,
        saved = buy and (buy - best.unit) * quantity,
        crossOwner = best.recipe.owner ~= ctx.owner,
      }
    end
    if buy then
      return buy, source or "auction", { quote = detail, shortfall = detail and detail.shortfall }
    end
    if best then return best.unit, "craft", { recipe = best.recipe, cost = best.cost, crossOwner = best.recipe.owner ~= ctx.owner } end
    return nil, (source == "insufficient") and "insufficient" or "unknown", nil
  end

  for _, reagent in ipairs(recipe.reagents or {}) do
    local unit, source, detail = unitCost(reagent.id, reagent.qty)
    addLine(reagent.id, reagent.qty, unit, source, detail)
  end
  for _, slot in ipairs(recipe.slots or {}) do
    local quantity = max(1, tonumber(slot.qty) or 1)
    local best
    for _, candidate in ipairs(slot.candidates or {}) do
      local unit, source, detail = unitCost(candidate, quantity)
      if unit and (not best or unit < best.unit) then
        best = { itemID = candidate, unit = unit, source = source, detail = detail }
      end
    end
    if best then
      addLine(best.itemID, quantity, best.unit, best.source, best.detail)
    else
      result.unknown = true
      tinsert(result.missing, (slot.candidates or {})[1] or 0)
    end
  end

  result.perUnit = (not result.unknown) and result.total / result.yield or nil
  if result.stockShort then result.partial = true end
  ctx.crafts[key] = result
  return result
end

-- ============================================================================
-- 7. 分析入口
-- ============================================================================

local function ensureFresh()
  local stamp = tostring(revision()) .. "|" .. recipeSignature()
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
  for _, recipe in ipairs(list) do
    local cost = recipeCost(recipe, {
      depth = MAX_CRAFT_DEPTH, path = {}, crafts = {}, index = index, quotes = quoteCache,
      owner = recipe.owner, crossOwner = crossOwner == true,
    })
    local row = {
      recipeID = recipe.id, outputID = recipe.output, name = recipe.name or Arb.ItemName(recipe.output),
      professionKey = recipe.professionKey, professionName = recipe.professionName,
      owner = recipe.owner, ownerName = recipe.ownerName, ownerSource = recipe.ownerSource,
      ownCharacter = Arb.IsOwnCharacter(recipe.owner),
      skillUp = recipe.difficulty, skill = recipe.skill, skillMax = recipe.skillMax,
      yield = cost and cost.yield or 1, costTotal = cost and cost.total, costPerUnit = cost and cost.perUnit,
      leaves = cost and cost.leaves or {}, craftLines = cost and cost.crafts or {},
      missing = cost and cost.missing or {}, craftable = cost and cost.perUnit ~= nil,
      stockShort = cost and cost.partial or false,
    }
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
        -- 分解收益与直接出售对照：给出「卖 vs 分」的最优选择
        if mode == "sell" then
          local de = Arb.Disenchant(recipe.output)
          if de then row.disenchantEV, row.disenchantWins = de.ev, de.ev > (price or 0) end
        end
      else
        row.reason = (mode == "de") and "无法估算分解收益" or "产物暂无市场报价"
      end
    else
      row.reason = "部分材料暂无报价"
    end
    tinsert(rows, row)
  end
  return rows, cut, priced
end

---执行一次完整分析
---@param options table { mode = "sell"|"de", profession = key|nil, onlyProfitable = bool, onlySkillUp = bool, sort = "profit"|"roi", query = string }
---@return table[] rows
---@return table meta
function Arb.Analyse(options)
  options = type(options) == "table" and options or {}
  ensureFresh()
  local mode = options.mode == "de" and "de" or "sell"
  local crossOwner = options.crossOwner == true
  local cacheKey = mode .. (crossOwner and ":cross" or ":own")
  local cache = rowCache[cacheKey]
  local cut
  if not cache then
    cache, cut, rowCache.priced = buildRows(mode, crossOwner)
    rowCache[cacheKey], rowCache.cut = cache, cut
  end
  cut = rowCache.cut or DEFAULT_CUT

  local rows, professionStats, profitable = {}, {}, 0
  for _, row in ipairs(cache) do
    local keep = true
    if options.profession and row.professionKey ~= options.profession then keep = false end
    -- 「当前可以制作」：默认只保留当前角色自己学会的配方
    if keep and options.ownOnly ~= false and not row.ownCharacter then keep = false end
    -- 「当前可以制作」：默认只看当前角色自己能做的配方
    if keep and options.ownOnly ~= false and not row.ownCharacter then keep = false end
    if keep and options.onlyProfitable and not (row.profit and row.profit > 0) then keep = false end
    if keep and options.onlySkillUp and (row.skillUp == "trivial" or row.skillUp == "unknown") then keep = false end
    if keep and options.query and options.query ~= "" then
      local hay = lower((row.name or "") .. " " .. (row.professionName or "") .. " " .. (row.ownerName or ""))
      if not find(hay, lower(options.query), 1, true) then keep = false end
    end
    if row.profit and row.profit > 0 then profitable = profitable + 1 end
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
    sorter = function(left, right) return (left.roi or -huge) > (right.roi or -huge) end
  else
    sorter = function(left, right) return (left.profit or -huge) > (right.profit or -huge) end
  end
  tsort(rows, sorter)

  local professions = {}
  for _, stats in pairs(professionStats) do tinsert(professions, stats) end
  tsort(professions, function(left, right) return left.total > right.total end)

  local api = Arb.Market()
  local marketInfo
  if api and type(api.GetMarketInfo) == "function" then
    local ok, value = pcall(api.GetMarketInfo)
    if ok then marketInfo = value end
  end

  return rows, {
    mode = mode, cut = cut, state = Arb.ApiState(), revision = revision(),
    market = marketInfo, professions = professions,
    total = #cache, priced = rowCache.priced or 0, shown = #rows, profitable = profitable, best = rows[1],
    players = #storedRecipeSets(), ownProfessions = Arb.Professions(),
  }
end

-- ============================================================================
-- 8. 一键写入 EasyAuction 购物清单
-- ============================================================================

---把一条利润行需要采购的叶子材料写入 EasyAuction 临时购物清单
---@param row table Analyse 返回的利润行
---@param label string|nil 清单名后缀（一般是产出物品名）
---@return boolean ok
---@return string|number reasonOrListID
function Arb.AddToShoppingList(row, label)
  if type(row) ~= "table" or type(row.leaves) ~= "table" or #row.leaves == 0 then
    return false, "该配方没有需要采购的材料"
  end
  local api = Arb.Market()
  if not api then return false, "EasyAuction 行情尚未就绪" end
  if type(api.CreateShoppingList) ~= "function" or type(api.SetShoppingListItem) ~= "function" then
    return false, "EasyAuction 版本过旧，缺少购物清单 API"
  end
  local title = "WoWF 制造套利"
  if type(label) == "string" and label ~= "" then
    title = title .. " · " .. label
    if #title > 48 then title = format("%s…", title:sub(1, 46)) end
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
    return true, listID, string.format("%d/%d 条材料写入成功", accepted, #row.leaves)
  end
  return true, listID
end
`;
}
