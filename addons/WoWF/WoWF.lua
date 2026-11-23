-- ============================================================================
-- 巫妖王的无限百科 (无限服游戏内离线智能指南)
-- 专为《魔兽世界：无限服》(Interface: 16001) 打造
-- 支持根据当前角色等级、职业、专精、种族与阵营自动匹配升级路线、输出循环、天赋、宏与副本
-- ============================================================================

local ADDON_NAME = ...
local Data = WoWF_Data or {}

WoWFDB = WoWFDB or {}

local CLASS_ORDER = { "WARRIOR", "PALADIN", "HUNTER", "ROGUE", "PRIEST", "SHAMAN", "MAGE", "WARLOCK", "DRUID" }
local ROUTE_ORDER = {
  "human", "dwarf", "night-elf", "gnome", "skyborne-alliance",
  "orc", "undead", "tauren", "troll", "skyborne-horde"
}

-- 无限服实用命令 / 客户端 CVar 速查表
-- 只收录在《魔兽世界：无限服》里真正用得上的内容：无限服客户端专属设置、本百科与配套插件入口。
-- 每条: { title, category, code, desc, note }
-- code 为可直接粘贴到聊天框执行的命令；note 标注无限服下的注意事项。
local COMMON_COMMANDS = {
  {
    title = "世界内任务导航（无限服自带）",
    category = "客户端 / 导航",
    code = "/console showInGameNavigation 1",
    desc = "在游戏世界里给追踪中的任务目标打上黄色菱形标记，交任务时标在任务发布人头上并显示距离；目标在山洞、楼上或另一层时比平面地图更好用，不需要安装插件。",
    note = "无限服客户端自带功能；关闭改 0。它与描边、任务高亮是独立开关，可按习惯叠加。",
  },
  {
    title = "关闭描边时的任务物品闪光",
    category = "客户端 / 导航",
    code = "/console outlineModeShowLootEffectWhenDisabled 1",
    desc = "关闭「描边模式」后，任务物品与可交互目标会重新出现闪光，不会融进场景里。",
    note = "无限服专属 CVar；需先关闭描边模式（/console outlineMode 0）才生效。",
  },
  {
    title = "镜头拉到最远",
    category = "客户端 / 画面",
    code = "/console cameraDistanceMaxZoomFactor 4",
    desc = "把镜头拉到无限服客户端的最远档位（4 档，约 50 码），练级、副本走位与观察远处目标都更舒服。",
    note = "想恢复默认改 2；低配机器建议 2.5~3。",
  },
  {
    title = "关闭体积雾",
    category = "客户端 / 画面",
    code = "/console volumeFog 0",
    desc = "去掉无限服在部分地区和副本加入的飘散雾气，远处目标更清楚，旧显卡也能提帧。",
    note = "恢复改 1；设置界面只有「计算效果」滑块，没有这个开关。",
  },
  {
    title = "团本 / 主城一键性能宏",
    category = "客户端 / 性能",
    code = "/console volumeFog 0\n/console graphicsShadowQuality 0\n/console waterDetail 0\n/console farclip 777",
    desc = "把雾气、阴影、水面、视距四项一起压低：画面损失小、帧数提升最明显，40 人团本和主城人多时按一下即可。",
    note = "逐行粘贴到聊天框回车，或点「复制命令」后做成游戏宏；恢复时先用 /console volumeFog 1 打开雾气，再把阴影、水面、视距拖回原来的画面滑块档位。",
  },
  {
    title = "姓名板显示到 41 码",
    category = "客户端 / 画面",
    code = "/console nameplateMaxDistance 41",
    desc = "把姓名板显示距离拉到 41 码，野外与战场能更早发现敌人；与 TAB 选怪距离配合更顺手。",
    note = "客户端可能限制上限；可用 /dump GetCVar(\"nameplateMaxDistance\") 确认是否生效。",
  },
  {
    title = "死亡后保留色彩",
    category = "客户端 / 画面",
    code = "/console ffxDeath 0",
    desc = "灵魂状态下屏幕不再变灰，跑尸时更容易看清地标、道路与自己的尸体位置。",
    note = "想恢复灰色死亡画面改 1。",
  },
  {
    title = "百科首页（智能匹配）",
    category = "本百科 / 快捷入口",
    code = "/wowf",
    desc = "打开巫妖王的无限百科并回到智能匹配仪表盘，按当前角色等级、职业、专精、种族与阵营自动匹配攻略。",
    note = "等同点击小地图图标；输入 /wowf help 可查看全部子命令。",
  },
  {
    title = "升级路线",
    category = "本百科 / 快捷入口",
    code = "/wowf route",
    desc = "直达升级路线页：当前等级段该去哪张地图、做哪些任务、走哪条任务链，并带坐标与地图标记。",
    note = "等同点击顶部「升级路线」页签。",
  },
  {
    title = "地下城百科",
    category = "本百科 / 快捷入口",
    code = "/wowf dungeon",
    desc = "直达地下城百科：无限服新本与原有副本的入口、首领、必接任务与掉落，按当前等级筛选。",
    note = "等同点击顶部「地下城百科」页签。",
  },
  {
    title = "第三方声望",
    category = "本百科 / 快捷入口",
    code = "/wowf rep",
    desc = "直达声望页：魔兽无限新增的 16 个第三方声望与凄凉之地半人马声望（吉尔吉斯 / 玛格拉姆）的任务与上交清单，按当前声望过滤。",
    note = "等同点击顶部「声望」页签；支持单选/多选筛选声望，任务按角色等级与完成状态过滤，工匠文书按声望档位分组。",
  },
  {
    title = "制造套利",
    category = "本百科 / 快捷入口",
    code = "/wowf arb",
    desc = "直达制造套利页：读取拍卖行行情与角色专业等级，递归折算中间产物后筛出当前能赚钱的配方。",
    note = "需要启用 EasyAuction 或黑石交易技能并提供行情数据；附魔角色可切换「分解套利」模式。",
  },
  {
    title = "Questie 任务雷达设置",
    category = "配套插件",
    code = "/questie",
    desc = "打开 Questie 设置窗口；/questie toggle 可快速开关地图与小地图上的任务显示，/questie tracker show 恢复任务追踪框。",
    note = "需安装 Questie（本站「Questie Forever」）。",
  },
  {
    title = "无限副本手册",
    category = "配套插件",
    code = "/df",
    desc = "打开 DungeonsForever 无限副本手册，查看首领掉落、副本任务与地图标记。",
    note = "需安装 DungeonsForever；客户端语言异常时可用 /dfcn 强制切换简中。",
  },
  {
    title = "世界地图航线",
    category = "配套插件",
    code = "/ft",
    desc = "切换 ForeverTransit 世界地图航线显示；/ft auto、/ft all、/ft labels、/ft tram 可细分阵营过滤、站点文字与矿道地铁。",
    note = "需安装 ForeverTransit。",
  },
  {
    title = "黑石交易技能窗口",
    category = "配套插件",
    code = "/bts",
    desc = "打开 Blackthorne's 交易技能窗口：扫描拍卖行算利润、排队制造、购物清单与防亏损上架。",
    note = "需安装 Blackthorne's Tradeskills；制造套利页的行情也会参考它。",
  },
  {
    title = "鼠标提示跟随",
    category = "配套插件",
    code = "/fmt on",
    desc = "开启 ForeverMouseTooltip 的鼠标提示实时跟随；/fmt off 关闭并回右下角，/fmt combat on 让战斗中保持默认位置。",
    note = "需安装 Forever Mouse Tooltip；/fmt offset <x> <y> 可微调偏移。",
  },
}

local state = {
  autoFollow = true,
  level = 1,
  classKey = "WARRIOR",
  specIndex = 1,
  routeId = "human",
  faction = "alliance",
  zone = "",
  activeTab = 1,
  routeFilter = "MATCH", -- "MATCH" | "ALL"
  talentFilter = "MATCH", -- "MATCH" | "ALL"
  dungeonFilter = "MATCH", -- "MATCH" | "NEW" | "ALL"
  featureFilter = "MATCH", -- "MATCH" | "ALL"
  searchQuery = "",
  expandedChains = {}, -- 已手动展开的副本任务链（默认折叠已完成的前置步骤）
  craftMode = "sell", -- "sell" | "de"（制造套利的成品出售 / 分解套利）
  craftSort = "profit", -- "profit" | "roi"
  craftOnlyProfit = true, -- 默认只看能赚钱的配方
  craftProfession = nil, -- 过滤的专业集合（nil = 全部，table = { [key] = true }）
  craftCrossOwner = true, -- 允许借用同账号其他角色的中间产物配方
  craftOnlySkillUp = false, -- 只看还能涨点的配方
  craftSource = "craft", -- 套利来源: "craft" 制作套利 | "vendor" 商人购入→拍卖出售 | "both" 全部
  craftPreferVendor = false, -- 制作成本是否优先采用已采集的 NPC 商人价
  craftMinSupply = false, -- 是否过滤掉拍卖行在售少于 100 件的物品（异常价格）
  repFilter = nil, -- 声望页筛选集合（nil = 全部，table = { [key] = true }）
  repFilterMode = "multi", -- 声望页筛选模式："multi" 多选 | "single" 单选
}

local PERSISTED_STATE_KEYS = {
  "autoFollow",
  "level",
  "classKey",
  "specIndex",
  "routeId",
  "faction",
  "activeTab",
  "routeFilter",
  "talentFilter",
  "dungeonFilter",
  "featureFilter",
  "craftMode",
  "craftSort",
  "craftOnlyProfit",
  "craftProfession",
  "craftCrossOwner",
  "craftOnlySkillUp",
  "craftSource",
  "craftPreferVendor",
  "craftMinSupply",
  "repFilter",
  "repFilterMode",
}

local function NormalizeCraftProfession(val)
  if type(val) == "string" and val ~= "" then
    return { [val] = true }
  end
  if type(val) == "table" then
    local out = {}
    for _, key in ipairs(val) do
      if type(key) == "string" and key ~= "" then
        out[key] = true
      end
    end
    for key, enabled in pairs(val) do
      if type(key) == "string" and key ~= "" and enabled then
        out[key] = true
      end
    end
    if next(out) ~= nil then
      return out
    end
  end
  return nil
end

local hasLoadedPersistedState = false
local function LoadPersistedState()
  if hasLoadedPersistedState then return end
  hasLoadedPersistedState = true
  WoWFDB = WoWFDB or {}
  local saved = WoWFDB.uiState
  if type(saved) ~= "table" then return end
  for _, key in ipairs(PERSISTED_STATE_KEYS) do
    if saved[key] ~= nil then
      state[key] = saved[key]
    end
  end
  state.craftProfession = NormalizeCraftProfession(state.craftProfession)
  local function NormalizeRepFilter(val)
    if type(val) == "string" and val ~= "" then
      return { [val] = true }
    elseif type(val) == "number" then
      return { [tostring(val)] = true }
    end
    if type(val) == "table" then
      local out = {}
      for _, key in ipairs(val) do
        if type(key) == "string" and key ~= "" then
          out[key] = true
        elseif type(key) == "number" then
          out[tostring(key)] = true
        end
      end
      for key, enabled in pairs(val) do
        if type(key) == "string" and key ~= "" and enabled then
          out[key] = true
        elseif type(key) == "number" and enabled == true then
          out[tostring(key)] = true
        end
      end
      if next(out) ~= nil then
        return out
      end
    end
    return nil
  end
  local function NormalizeRepFilterMode(val)
    return (val == "single") and "single" or "multi"
  end
  state.repFilter = NormalizeRepFilter(state.repFilter)
  state.repFilterMode = NormalizeRepFilterMode(state.repFilterMode)
end

local function SavePersistedState()
  WoWFDB = WoWFDB or {}
  if type(WoWFDB.uiState) ~= "table" then
    WoWFDB.uiState = {}
  end
  for _, key in ipairs(PERSISTED_STATE_KEYS) do
    local val = state[key]
    if val == nil or (key == "craftProfession" and type(val) == "table" and next(val) == nil) then
      WoWFDB.uiState[key] = false
    else
      WoWFDB.uiState[key] = val
    end
  end
end

-- ============================================================================
-- 1. 角色状态自动探测与智能匹配
-- ============================================================================

local RACE_ID_TO_ROUTE = {
  [1] = "human",
  [2] = "orc",
  [3] = "dwarf",
  [4] = "night-elf",
  [5] = "undead",
  [6] = "tauren",
  [7] = "gnome",
  [8] = "troll",
  [95] = "skyborne-alliance",
  [96] = "skyborne-horde",
}

local CLASS_ID_TO_KEY = {
  [1] = "WARRIOR",
  [2] = "PALADIN",
  [3] = "HUNTER",
  [4] = "ROGUE",
  [5] = "PRIEST",
  [7] = "SHAMAN",
  [8] = "MAGE",
  [9] = "WARLOCK",
  [11] = "DRUID",
}

local function ResolveRouteId(raceName, wowRaceFile, raceID, faction)
  if raceID and RACE_ID_TO_ROUTE[raceID] then
    return RACE_ID_TO_ROUTE[raceID]
  end

  local r = string.gsub(string.lower(wowRaceFile or ""), "[%s_%-]", "")
  if r == "human" then return "human" end
  if r == "dwarf" then return "dwarf" end
  if r == "nightelf" then return "night-elf" end
  if r == "gnome" then return "gnome" end
  if r == "orc" then return "orc" end
  if r == "scourge" or r == "undead" then return "undead" end
  if r == "tauren" then return "tauren" end
  if r == "troll" then return "troll" end
  if string.find(r, "windshaper", 1, true) or string.find(r, "skybornehorde", 1, true) then
    return "skyborne-horde"
  end
  if string.find(r, "highelf", 1, true) or string.find(r, "skybornealliance", 1, true) then
    return "skyborne-alliance"
  end
  if string.find(r, "skyborne", 1, true) then
    return faction == "horde" and "skyborne-horde" or "skyborne-alliance"
  end

  local zh = raceName or ""
  if string.find(zh, "人类", 1, true) then return "human" end
  if string.find(zh, "矮人", 1, true) then return "dwarf" end
  if string.find(zh, "暗夜", 1, true) then return "night-elf" end
  if string.find(zh, "侏儒", 1, true) then return "gnome" end
  if string.find(zh, "兽人", 1, true) then return "orc" end
  if string.find(zh, "亡灵", 1, true) or string.find(zh, "被遗忘者", 1, true) then return "undead" end
  if string.find(zh, "牛头人", 1, true) then return "tauren" end
  if string.find(zh, "巨魔", 1, true) then return "troll" end
  if string.find(zh, "塑风", 1, true) then return "skyborne-horde" end
  if string.find(zh, "高阶", 1, true) then return "skyborne-alliance" end
  if string.find(zh, "天裔", 1, true) then
    return faction == "horde" and "skyborne-horde" or "skyborne-alliance"
  end

  return faction == "horde" and "orc" or "human"
end

local function ResolveClassKey(className, classFile, classID)
  if classID and CLASS_ID_TO_KEY[classID] then
    return CLASS_ID_TO_KEY[classID]
  end
  if classFile then
    local upper = string.upper(classFile)
    if Data.classes and Data.classes[upper] then
      return upper
    end
  end
  local zh = className or ""
  if string.find(zh, "战士", 1, true) then return "WARRIOR" end
  if string.find(zh, "圣骑士", 1, true) or string.find(zh, "骑士", 1, true) then return "PALADIN" end
  if string.find(zh, "猎人", 1, true) then return "HUNTER" end
  if string.find(zh, "潜行者", 1, true) or string.find(zh, "盗贼", 1, true) then return "ROGUE" end
  if string.find(zh, "牧师", 1, true) then return "PRIEST" end
  if string.find(zh, "萨满", 1, true) then return "SHAMAN" end
  if string.find(zh, "法师", 1, true) then return "MAGE" end
  if string.find(zh, "术士", 1, true) then return "WARLOCK" end
  if string.find(zh, "德鲁伊", 1, true) then return "DRUID" end
  return "WARRIOR"
end

local function DetectActiveTalentSpec(classFile)
  local cls = Data.classes and Data.classes[classFile or state.classKey]

  -- 1. 优先支持无限服 (Interface: 16001) C_ClassTalents + C_Traits 天赋树 API
  if C_ClassTalents and C_Traits and C_ClassTalents.GetActiveConfigID and cls and cls.specs then
    local okCfgId, configID = pcall(C_ClassTalents.GetActiveConfigID)
    if okCfgId and configID then
      local okCfg, cfgInfo = pcall(C_Traits.GetConfigInfo, configID)
      local treeID = cfgInfo and cfgInfo.treeIDs and cfgInfo.treeIDs[1]
      if treeID then
        local okNodes, nodeIDs = pcall(C_Traits.GetTreeNodes, treeID)
        if okNodes and type(nodeIDs) == "table" then
          local purchasedByName = {}
          local totalPurchased = 0
          for _, nodeID in ipairs(nodeIDs) do
            local okNode, nodeInfo = pcall(C_Traits.GetNodeInfo, configID, nodeID)
            local ranks = nodeInfo and (nodeInfo.activeRank or nodeInfo.currentRank or nodeInfo.ranksPurchased) or 0
            if ranks and ranks > 0 then
              local entryID = (nodeInfo.activeEntry and nodeInfo.activeEntry.entryID) or (nodeInfo.entryIDs and nodeInfo.entryIDs[1])
              if entryID then
                local okEntry, entryInfo = pcall(C_Traits.GetEntryInfo, configID, entryID)
                if okEntry and entryInfo and entryInfo.definitionID then
                  local okDef, defInfo = pcall(C_Traits.GetDefinitionInfo, entryInfo.definitionID)
                  local talentName = defInfo and defInfo.overrideName
                  if (not talentName or talentName == "") and defInfo and defInfo.spellID then
                    if C_Spell and C_Spell.GetSpellName then
                      local okSp, spName = pcall(C_Spell.GetSpellName, defInfo.spellID)
                      if okSp then talentName = spName end
                    elseif GetSpellInfo then
                      talentName = GetSpellInfo(defInfo.spellID)
                    end
                  end
                  if talentName and talentName ~= "" then
                    purchasedByName[talentName] = (purchasedByName[talentName] or 0) + ranks
                    totalPurchased = totalPurchased + ranks
                  end
                end
              end
            end
          end
          if totalPurchased > 0 then
            local bestSpec = 1
            local bestScore = -1
            for idx, sp in ipairs(cls.specs) do
              local score = 0
              local seenTalents = {}
              for _, st in ipairs(sp.steps or {}) do
                if st.name and not seenTalents[st.name] and purchasedByName[st.name] then
                  seenTalents[st.name] = true
                  score = score + purchasedByName[st.name]
                end
              end
              if score > bestScore then
                bestScore = score
                bestSpec = idx
              end
            end
            if bestScore > 0 then
              return bestSpec
            end
          end
        end
      end
    end
  end

  -- 2. 兼容传统 GetNumTalentTabs / GetTalentTabInfo
  if GetNumTalentTabs and GetTalentTabInfo then
    local okTabs, numTabs = pcall(GetNumTalentTabs)
    numTabs = (okTabs and tonumber(numTabs)) or 0
    if numTabs > 0 then
      local bestTab = 1
      local maxPoints = -1
      for i = 1, numTabs do
        local okInfo, a1, a2, a3, a4, a5 = pcall(GetTalentTabInfo, i)
        if okInfo then
          local pts = tonumber(a3) or tonumber(a5) or tonumber(a1) or 0
          if pts > maxPoints then
            maxPoints = pts
            bestTab = i
          end
        end
      end
      if maxPoints > 0 then
        return bestTab
      end
    end
  end

  return nil
end

local function SyncPlayerCharacter(overrideLevel)
  local rawLvl = overrideLevel or (UnitLevel and UnitLevel("player")) or state.level or 1
  local lvl = tonumber(rawLvl) or 1
  if lvl < 1 then lvl = 1 end
  if lvl > 60 then lvl = 60 end

  local className, classFile, classID
  if UnitClass then
    className, classFile, classID = UnitClass("player")
  end
  local resolvedClass = ResolveClassKey(className, classFile, classID)

  local engFaction = (UnitFactionGroup and UnitFactionGroup("player")) or nil
  local faction = (engFaction == "Horde") and "horde" or ((engFaction == "Alliance") and "alliance" or state.faction or "alliance")

  local raceName, raceFile, raceID
  if UnitRace then
    raceName, raceFile, raceID = UnitRace("player")
  end
  local routeId = ResolveRouteId(raceName, raceFile, raceID, faction)
  local routeObj = Data.routes and Data.routes[routeId]
  if routeObj and routeObj.faction then
    faction = routeObj.faction
  end

  state.zone = (GetRealZoneText and GetRealZoneText()) or state.zone or ""

  if state.autoFollow then
    local prevClass = state.classKey
    state.level = lvl
    state.classKey = resolvedClass
    state.faction = faction
    state.routeId = routeId
    local detectedSpec = DetectActiveTalentSpec(resolvedClass)
    local clsData = Data.classes and Data.classes[resolvedClass]
    if detectedSpec and clsData and clsData.specs and clsData.specs[detectedSpec] then
      state.specIndex = detectedSpec
    elseif prevClass ~= resolvedClass or not state.specIndex or not (clsData and clsData.specs and clsData.specs[state.specIndex]) then
      state.specIndex = 1
    end
  end
end

-- ============================================================================
-- 2. 地图导航、原生任务链接、聊天框发送与一键创建宏工具函数
-- ============================================================================

local ZONE_TO_UIMAP_ID = {
  -- 东部王国与六大主城
  ["暴风城"] = 1453,
  ["铁炉堡"] = 1455,
  ["幽暗城"] = 1458,
  ["艾尔文森林"] = 1429,
  ["北郡山谷"] = 1429,
  ["北郡修道院"] = 1429,
  ["闪金镇"] = 1429,
  ["东谷伐木场"] = 1429,
  ["丹莫罗"] = 1426,
  ["寒脊山谷"] = 1426,
  ["卡拉诺斯"] = 1426,
  ["古博拉采掘场"] = 1426,
  ["提瑞斯法林地"] = 1420,
  ["丧钟镇"] = 1420,
  ["布瑞尔"] = 1420,
  ["西部荒野"] = 1436,
  ["哨兵岭"] = 1436,
  ["月溪镇"] = 1436,
  ["洛克莫丹"] = 1432,
  ["塞尔萨玛"] = 1432,
  ["银松森林"] = 1421,
  ["瑟伯切尔"] = 1421,
  ["赤脊山"] = 1433,
  ["湖畔镇"] = 1433,
  ["暮色森林"] = 1431,
  ["夜色镇"] = 1431,
  ["湿地"] = 1437,
  ["米奈希尔港"] = 1437,
  ["希尔斯布莱德丘陵"] = 1424,
  ["南海镇"] = 1424,
  ["塔伦米尔"] = 1424,
  ["奥特兰克山脉"] = 1416,
  ["阿拉希高地"] = 1417,
  ["避难谷地"] = 1417,
  ["落锤镇"] = 1417,
  ["荆棘谷"] = 1434,
  ["藏宝海湾"] = 1434,
  ["格罗姆高营地"] = 1434,
  ["反抗军营地"] = 1434,
  ["荒芜之地"] = 1418,
  ["卡加斯"] = 1418,
  ["悲伤沼泽"] = 1435,
  ["斯通纳德"] = 1435,
  ["辛特兰"] = 1425,
  ["鹰巢山"] = 1425,
  ["恶齿村"] = 1425,
  ["灼热峡谷"] = 1427,
  ["瑟银哨塔"] = 1427,
  ["诅咒之地"] = 1419,
  ["守望堡"] = 1419,
  ["燃烧平原"] = 1428,
  ["摩根的岗哨"] = 1428,
  ["烈焰峰"] = 1428,
  ["黑石山"] = 1428,
  ["西瘟疫之地"] = 1422,
  ["冰风岗"] = 1422,
  ["亡灵壁垒"] = 1422,
  ["东瘟疫之地"] = 1423,
  ["圣光之愿礼拜堂"] = 1423,
  ["逆风小径"] = 1430,
  -- 卡利姆多与主城
  ["奥格瑞玛"] = 1454,
  ["雷霆崖"] = 1456,
  ["达纳苏斯"] = 1457,
  ["杜隆塔尔"] = 1411,
  ["试炼谷"] = 1411,
  ["森金村"] = 1411,
  ["剃刀岭"] = 1411,
  ["莫高雷"] = 1412,
  ["红云台地"] = 1412,
  ["血蹄村"] = 1412,
  ["泰达希尔"] = 1438,
  ["幽影谷"] = 1438,
  ["多兰纳尔"] = 1438,
  ["黑海岸"] = 1439,
  ["奥伯丁"] = 1439,
  ["贫瘠之地"] = 1413,
  ["十字路口"] = 1413,
  ["棘齿城"] = 1413,
  ["陶拉祖营地"] = 1413,
  ["石爪山脉"] = 1442,
  ["烈日石居"] = 1442,
  ["石爪峰"] = 1442,
  ["灰谷"] = 1440,
  ["阿斯特兰纳"] = 1440,
  ["碎木岗哨"] = 1440,
  ["佐拉姆加前哨站"] = 1440,
  ["千针石林"] = 1441,
  ["乱风岗"] = 1441,
  ["闪光平原"] = 1441,
  ["凄凉之地"] = 1443,
  ["尼耶尔前哨站"] = 1443,
  ["葬影村"] = 1443,
  ["尘泥沼泽"] = 1445,
  ["塞拉摩"] = 1445,
  ["塞拉摩岛"] = 1445,
  ["蕨墙村"] = 1445,
  ["奥卡兹岛"] = 1445,
  ["菲拉斯"] = 1444,
  ["羽月要塞"] = 1444,
  ["莫沙彻营地"] = 1444,
  ["厄运之槌"] = 1444,
  ["塔纳利斯"] = 1446,
  ["加基森"] = 1446,
  ["艾萨拉"] = 1447,
  ["塔伦迪斯营地"] = 1447,
  ["瓦罗莫克"] = 1447,
  ["费伍德森林"] = 1448,
  ["刺枝林地"] = 1448,
  ["血毒河"] = 1448,
  ["翡翠圣地"] = 1448,
  ["安戈洛环形山"] = 1449,
  ["马绍尔营地"] = 1449,
  ["月光林地"] = 1450,
  ["永夜港"] = 1450,
  ["希利苏斯"] = 1451,
  ["塞纳里奥要塞"] = 1451,
  ["冬泉谷"] = 1452,
  ["永望镇"] = 1452,
  -- 无限服新增地图 (Interface: 16001)
  ["泽风岛"] = 2521,
  ["泽风庇护所"] = 2521,
  ["天裔前哨"] = 2521,
  ["天裔登陆点"] = 2521,
  ["塑造者之台"] = 2521,
  ["河林"] = 2548,
  ["河林地"] = 2548,
  ["海加尔山"] = 2482,
  ["海加尔峰"] = 2482,
  ["辛德拉"] = 2524,
}

local ORDERED_ZONE_KEYWORDS = {
  "希尔斯布莱德丘陵", "奥特兰克山脉", "提瑞斯法林地", "安戈洛环形山", "西瘟疫之地", "东瘟疫之地",
  "艾尔文森林", "西部荒野", "洛克莫丹", "银松森林", "暮色森林", "阿拉希高地", "荒芜之地", "悲伤沼泽",
  "灼热峡谷", "诅咒之地", "燃烧平原", "逆风小径", "杜隆塔尔", "泰达希尔", "贫瘠之地", "石爪山脉",
  "千针石林", "凄凉之地", "尘泥沼泽", "塔纳利斯", "费伍德森林", "月光林地", "希利苏斯", "冬泉谷",
  "奥格瑞玛", "暴风城", "铁炉堡", "幽暗城", "雷霆崖", "达纳苏斯", "丹莫罗", "赤脊山", "湿地",
  "荆棘谷", "辛特兰", "黑石山", "莫高雷", "黑海岸", "灰谷", "菲拉斯", "艾萨拉",
  "泽风岛", "河林地", "河林", "海加尔山", "海加尔峰", "辛德拉",
  "藏宝海湾", "加基森", "棘齿城", "塞拉摩", "羽月要塞", "阿斯特兰纳", "永望镇", "翡翠圣地",
  "闪金镇", "卡拉诺斯", "布瑞尔", "哨兵岭", "塞尔萨玛",
  "瑟伯切尔", "湖畔镇", "夜色镇", "米奈希尔港", "南海镇", "塔伦米尔", "避难谷地", "落锤镇",
  "格罗姆高营地", "卡加斯", "斯通纳德", "鹰巢山", "恶齿村", "瑟银哨塔", "守望堡", "十字路口",
}

local function ResolveUiMapID(zoneText, placeText)
  for _, raw in ipairs({ zoneText or "", placeText or "" }) do
    if raw ~= "" then
      if ZONE_TO_UIMAP_ID[raw] then
        return ZONE_TO_UIMAP_ID[raw]
      end
      local stripped = string.gsub(raw, "%s*%b()", "")
      stripped = string.gsub(stripped, "^%s*(.-)%s*$", "%1")
      if ZONE_TO_UIMAP_ID[stripped] then
        return ZONE_TO_UIMAP_ID[stripped]
      end
      for _, kw in ipairs(ORDERED_ZONE_KEYWORDS) do
        if string.find(raw, kw, 1, true) then
          return ZONE_TO_UIMAP_ID[kw]
        end
      end
      for k, id in pairs(ZONE_TO_UIMAP_ID) do
        if string.find(raw, k, 1, true) then
          return id
        end
      end
    end
  end
  return nil
end

-- 自定义大地图高亮图钉（即使在主城或不支持原生 C_Map.SetUserWaypoint 的特殊图层，也能在打开的世界地图上精准显示发光坐标标记）
local customMapPin
local activePinState = nil

local function UpdateWorldMapHighlightPin()
  if not activePinState or not WorldMapFrame or not WorldMapFrame:IsShown() then
    if customMapPin then customMapPin:Hide() end
    return
  end
  local curMapID = WorldMapFrame.GetMapID and WorldMapFrame:GetMapID() or nil
  if not curMapID or curMapID ~= activePinState.mapID then
    if customMapPin then customMapPin:Hide() end
    return
  end
  local canvas = (WorldMapFrame.GetCanvas and WorldMapFrame:GetCanvas())
    or (WorldMapFrame.ScrollContainer and WorldMapFrame.ScrollContainer.Child)
    or nil
  if not canvas then return end

  if not customMapPin then
    customMapPin = CreateFrame("Frame", "WoWFWorldMapHighlightPin", canvas)
    customMapPin:SetSize(28, 28)
    customMapPin:SetFrameStrata("HIGH")
    customMapPin:SetFrameLevel(2000)

    local glow = customMapPin:CreateTexture(nil, "BACKGROUND")
    glow:SetSize(38, 38)
    glow:SetPoint("CENTER")
    glow:SetTexture("Interface\\Minimap\\UI-Minimap-ZoomButton-Highlight")
    glow:SetBlendMode("ADD")

    local icon = customMapPin:CreateTexture(nil, "ARTWORK")
    icon:SetSize(22, 22)
    icon:SetPoint("CENTER")
    icon:SetTexture("Interface\\Minimap\\ObjectIcons")
    icon:SetTexCoord(0.125, 0.25, 0.125, 0.25)
    customMapPin.icon = icon

    local labelBg = customMapPin:CreateTexture(nil, "BORDER")
    labelBg:SetColorTexture(0.02, 0.05, 0.08, 0.88)
    customMapPin.labelBg = labelBg

    local label = customMapPin:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
    label:SetPoint("BOTTOM", customMapPin, "TOP", 0, 3)
    customMapPin.label = label
  else
    customMapPin:SetParent(canvas)
  end

  local w = canvas:GetWidth() or 0
  local h = canvas:GetHeight() or 0
  if w <= 0 or h <= 0 then return end

  customMapPin:ClearAllPoints()
  customMapPin:SetPoint("CENTER", canvas, "TOPLEFT", (activePinState.x / 100) * w, -(activePinState.y / 100) * h)
  customMapPin.label:SetText(string.format("|cff00ffcc★ %s|r", activePinState.label or "目标点"))
  local lw = (customMapPin.label:GetStringWidth() or 80) + 10
  local lh = (customMapPin.label:GetStringHeight() or 14) + 4
  customMapPin.labelBg:ClearAllPoints()
  customMapPin.labelBg:SetPoint("CENTER", customMapPin.label, "CENTER", 0, 0)
  customMapPin.labelBg:SetSize(lw, lh)
  customMapPin:Show()
end

local mapHooked = false
local function EnsureWorldMapHooks()
  if mapHooked or not WorldMapFrame then return end
  mapHooked = true
  WorldMapFrame:HookScript("OnShow", UpdateWorldMapHighlightPin)
  if hooksecurefunc and WorldMapFrame.OnMapChanged then
    pcall(hooksecurefunc, WorldMapFrame, "OnMapChanged", UpdateWorldMapHighlightPin)
  end
  if hooksecurefunc and WorldMapFrame.SetMapID then
    pcall(hooksecurefunc, WorldMapFrame, "SetMapID", UpdateWorldMapHighlightPin)
  end
end

local function InsertLinkToChat(chatLink)
  if not chatLink or chatLink == "" then return false end
  local activeEditBox = ChatEdit_GetActiveWindow and ChatEdit_GetActiveWindow() or nil
  if activeEditBox and activeEditBox:IsVisible() then
    if ChatEdit_InsertLink and ChatEdit_InsertLink(chatLink) then
      return true
    end
    activeEditBox:Insert(chatLink)
    activeEditBox:SetFocus()
    return true
  end

  if ChatFrame_OpenChat then
    pcall(ChatFrame_OpenChat, "")
  elseif DEFAULT_CHAT_FRAME and DEFAULT_CHAT_FRAME.editBox and ChatEdit_ActivateChat then
    pcall(ChatEdit_ActivateChat, DEFAULT_CHAT_FRAME.editBox)
  end

  local openedBox = (ChatEdit_GetActiveWindow and ChatEdit_GetActiveWindow())
    or (DEFAULT_CHAT_FRAME and DEFAULT_CHAT_FRAME.editBox)
    or nil
  if openedBox then
    if not openedBox:IsShown() then
      openedBox:Show()
    end
    if ChatEdit_InsertLink and ChatEdit_InsertLink(chatLink) then
      openedBox:SetFocus()
      return true
    end
    local cur = openedBox:GetText() or ""
    if cur ~= "" and not string.find(cur, "%s$") then
      openedBox:Insert(" " .. chatLink)
    else
      openedBox:Insert(chatLink)
    end
    openedBox:SetFocus()
    return true
  end
  return false
end

local function SanitizeLinkField(str)
  if not str or str == "" then return "-" end
  local s = string.gsub(tostring(str), "|c%x%x%x%x%x%x%x%x", "")
  s = string.gsub(s, "|r", "")
  s = string.gsub(s, "[|:hH%[%]\r\n]", " ")
  s = string.gsub(s, "^%s*(.-)%s*$", "%1")
  if s == "" then return "-" end
  return s
end

-- 生成可在聊天框点击的原生世界地图链接：可见文本只显示区域/地点名称，坐标只保存在链接载荷中
local function BuildChatWorldMapLink(mapID, x, y, zone, label)
  local numX = tonumber(x)
  local numY = tonumber(y)
  if not numX or not numY then return "" end
  local mid = tonumber(mapID) or 1429
  local scaledX = math.floor(numX * 100 + 0.5)
  local scaledY = math.floor(numY * 100 + 0.5)
  local zText = (zone and zone ~= "" and zone ~= "-") and zone or ""
  local lText = (label and label ~= "" and label ~= "-") and label or ""
  local displayText
  if zText ~= "" and lText ~= "" and lText ~= zText then
    displayText = zText .. " · " .. lText
  elseif lText ~= "" then
    displayText = lText
  elseif zText ~= "" then
    displayText = zText
  else
    displayText = "地图"
  end
  displayText = SanitizeLinkField(displayText)
  return string.format("|cffffff00|Hworldmap:%d:%d:%d|h[%s]|h|r", mid, scaledX, scaledY, displayText)
end

local function OpenMapAndSetWaypoint(zone, name, x, y, explicitMapID)
  local numX = tonumber(x)
  local numY = tonumber(y)
  local mapID = tonumber(explicitMapID)
  if not mapID or mapID <= 0 then
    mapID = ResolveUiMapID(zone, name)
  end

  local displayZone = (zone and zone ~= "") and zone or "艾泽拉斯"
  if C_Map and C_Map.GetMapInfo and mapID then
    local okInfo, mapInfo = pcall(C_Map.GetMapInfo, mapID)
    if okInfo and mapInfo and mapInfo.name and mapInfo.name ~= "" and (not zone or zone == "") then
      displayZone = mapInfo.name
    end
  end
  local displayLabel = (name and name ~= "") and name or displayZone

  if not numX or not numY then
    activePinState = nil
    if C_Map and C_Map.ClearUserWaypoint then
      pcall(C_Map.ClearUserWaypoint)
    end
    UpdateWorldMapHighlightPin()
    if mapID then
      if C_Map and C_Map.OpenWorldMap then
        pcall(C_Map.OpenWorldMap, mapID)
      elseif WorldMapFrame then
        if ShowUIPanel then
          pcall(ShowUIPanel, WorldMapFrame)
        else
          WorldMapFrame:Show()
        end
        if WorldMapFrame.SetMapID then
          pcall(WorldMapFrame.SetMapID, WorldMapFrame, mapID)
        end
      end
      if WorldMapFrame and WorldMapFrame:IsShown() and WorldMapFrame.Raise then
        pcall(WorldMapFrame.Raise, WorldMapFrame)
      end
    end
    DEFAULT_CHAT_FRAME:AddMessage("|cff00ffcc[巫妖王的无限百科]|r 目标位置: |cffffd100" .. displayZone .. " - " .. displayLabel .. "|r")
    return
  end

  activePinState = {
    mapID = mapID,
    x = numX,
    y = numY,
    zone = displayZone,
    label = displayLabel,
  }

  -- 1. 设置暴雪原生大地图图钉与超距追踪箭头 (UiMapPoint + C_Map.SetUserWaypoint)
  if C_Map and C_Map.SetUserWaypoint and UiMapPoint and UiMapPoint.CreateFromCoordinates and mapID then
    local okPt, uiPt = pcall(UiMapPoint.CreateFromCoordinates, mapID, numX / 100, numY / 100)
    if okPt and uiPt then
      pcall(C_Map.SetUserWaypoint, uiPt)
      if C_SuperTrack and C_SuperTrack.SetSuperTrackedUserWaypoint then
        pcall(C_SuperTrack.SetSuperTrackedUserWaypoint, true)
      end
    end
  end

  -- 2. 打开世界地图并切换到目标区域图层，渲染高亮标记
  if C_Map and C_Map.OpenWorldMap and mapID then
    pcall(C_Map.OpenWorldMap, mapID)
  elseif WorldMapFrame then
    if ShowUIPanel then
      pcall(ShowUIPanel, WorldMapFrame)
    else
      WorldMapFrame:Show()
    end
    if WorldMapFrame.SetMapID and mapID then
      pcall(WorldMapFrame.SetMapID, WorldMapFrame, mapID)
    end
  end
  if WorldMapFrame and WorldMapFrame:IsShown() and WorldMapFrame.Raise then
    pcall(WorldMapFrame.Raise, WorldMapFrame)
  end
  EnsureWorldMapHooks()
  UpdateWorldMapHighlightPin()

  -- 3. 若安装了 TomTom，同步触发 TomTom 导航箭头
  if SlashCmdList and SlashCmdList["TOMTOM_WAY"] then
    pcall(SlashCmdList["TOMTOM_WAY"], string.format("%s %.1f %.1f %s", displayZone, numX, numY, displayLabel))
  end

  -- 4. 在聊天框输出原生可点击的 |Hworldmap:...|h 地图链接（可见文本不显示坐标）
  local worldMapLink = BuildChatWorldMapLink(mapID, numX, numY, displayZone, displayLabel)
  if worldMapLink ~= "" then
    DEFAULT_CHAT_FRAME:AddMessage("|cff00ffcc[巫妖王的无限百科]|r 已记录到世界地图: " .. worldMapLink .. " |cffaaaaaa(Shift+点击链接可直接发到聊天框)|r")
  end
end

local function SetWaypointOrPrint(zone, name, x, y, explicitMapID)
  OpenMapAndSetWaypoint(zone, name, x, y, explicitMapID)
end

local function FormatCoordLink(zone, label, x, y, prefixSpace)
  local numX = tonumber(x)
  local numY = tonumber(y)
  if not numX or not numY then return "" end
  local mapID = ResolveUiMapID(zone, label)
  if not mapID then return "" end
  local safeZone = SanitizeLinkField((zone and zone ~= "") and zone or label)
  local safeLabel = SanitizeLinkField((label and label ~= "") and label or zone)
  local sp = (prefixSpace == false) and "" or " "
  return string.format(
    "%s|cff00ffcc|Hwowfmap:%d:%.1f:%.1f:%s:%s|h[定位]|h|r",
    sp, mapID, numX, numY, safeZone, safeLabel
  )
end

local ITEM_QUALITY_COLORS_HEX = {
  [0] = "|cff9d9d9d",
  [1] = "|cffffffff",
  [2] = "|cff1eff00",
  [3] = "|cff0070dd",
  [4] = "|cffa335ee",
  [5] = "|cffff8000",
}

local function ResolveLiveItemLink(itemID, fallbackLink)
  local id = tonumber(itemID)
  if not id or id <= 0 then return fallbackLink end
  local getter = (C_Item and C_Item.GetItemInfo) or GetItemInfo
  if getter then
    local ok, _, liveLink = pcall(getter, id)
    if ok and type(liveLink) == "string" and liveLink ~= "" then
      return liveLink
    end
  end
  if C_Item and C_Item.RequestLoadItemDataByID then
    pcall(C_Item.RequestLoadItemDataByID, id)
  end
  return fallbackLink
end

local function FormatItemLink(itemID, fallbackName, fallbackQuality)
  if WoWF_CraftArb and type(WoWF_CraftArb.ItemLink) == "function" then
    local link = WoWF_CraftArb.ItemLink(itemID, fallbackName, fallbackQuality)
    -- CraftArb 缓存里只有编号时会回落到「物品 #id」，此时优先显示调用方给出的中文名
    if type(link) == "string" and fallbackName and fallbackName ~= "" and string.find(link, "[物品 #", 1, true) then
      link = string.gsub(link, "%[物品 #%d+%]", function() return "[" .. fallbackName .. "]" end, 1)
    end
    return link
  end
  local id = tonumber(itemID)
  if not id or id <= 0 then
    return (fallbackName and fallbackName ~= "" and tostring(fallbackName)) or "未知物品"
  end
  local liveLink = ResolveLiveItemLink(id, nil)
  if liveLink then return liveLink end
  local q = tonumber(fallbackQuality) or 1
  local color = ITEM_QUALITY_COLORS_HEX[q] or ITEM_QUALITY_COLORS_HEX[1]
  local name = (fallbackName and fallbackName ~= "" and tostring(fallbackName)) or ("物品 #" .. tostring(id))
  return string.format("%s|Hitem:%d:0:0:0:0:0:0:0|h[%s]|h|r", color, id, name)
end

local function FormatNpcMapLink(zone, npc, x, y, opts)
  opts = opts or {}
  local zText = (zone and zone ~= "") and tostring(zone) or ""
  local pText = (opts.place and opts.place ~= "") and tostring(opts.place) or ""
  local nText = (npc and npc ~= "") and tostring(npc) or ""
  local displayName = (nText ~= "") and nText or ((pText ~= "") and pText or ((zText ~= "") and zText or "坐标"))

  local numX = tonumber(x)
  local numY = tonumber(y)
  local mapID = (numX and numY) and ResolveUiMapID(zText ~= "" and zText or pText, nText) or nil

  local locPrefix = ""
  if opts.omitZone ~= true then
    if zText ~= "" and pText ~= "" and pText ~= zText and not string.find(zText, pText, 1, true) and not string.find(pText, zText, 1, true) then
      locPrefix = zText .. "·" .. pText
    elseif zText ~= "" then
      locPrefix = zText
    elseif pText ~= "" then
      locPrefix = pText
    end
  elseif pText ~= "" and pText ~= zText and not string.find(zText, pText, 1, true) then
    locPrefix = pText
  end

  local navZone = (zText ~= "") and zText or ((locPrefix ~= "") and locPrefix or pText)
  local linkPart
  if numX and numY and mapID then
    local safeZone = SanitizeLinkField((locPrefix ~= "" and not opts.omitZone) and locPrefix or (navZone ~= "" and navZone or nText))
    local safeLabel = SanitizeLinkField((nText ~= "") and nText or ((locPrefix ~= "") and locPrefix or zText))
    linkPart = string.format(
      "|cff00ffcc|Hwowfmap:%d:%.1f:%.1f:%s:%s|h[%s]|h|r",
      mapID, numX, numY, safeZone, safeLabel, displayName
    )
  elseif nText ~= "" then
    local safeZone = SanitizeLinkField(navZone)
    local safeLabel = SanitizeLinkField(nText)
    linkPart = string.format(
      "|cff00ffcc|Hwowfnpc:%s:%s|h[%s]|h|r",
      safeZone, safeLabel, displayName
    )
  else
    linkPart = "|cff00ffcc" .. displayName .. "|r"
  end

  if locPrefix ~= "" and nText ~= "" and locPrefix ~= nText then
    return locPrefix .. " " .. linkPart
  end
  return linkPart
end

local function FormatStepNpcInfo(st, fallbackZone)
  if type(st) ~= "table" then return "" end
  local stZone = (st.zone and st.zone ~= "") and st.zone or (fallbackZone or "")
  local startStr = ""
  if st.startItemId and (not st.npc or st.npc == "") then
    startStr = "物品: " .. FormatItemLink(st.startItemId, st.startItemName)
  else
    local hasStart = (st.npc and st.npc ~= "") or (st.x ~= nil and st.y ~= nil) or (stZone ~= "")
    startStr = hasStart and FormatNpcMapLink(stZone, st.npc, st.x, st.y, { place = st.place }) or ""
  end
  local endZone = (st.endZone and st.endZone ~= "") and st.endZone or stZone
  local hasEnd = st.endNpc and st.endNpc ~= "" and (st.endNpc ~= st.npc or endZone ~= stZone or st.endX ~= st.x or st.endY ~= st.y)
  if hasEnd then
    local endStr = FormatNpcMapLink(endZone, st.endNpc, st.endX, st.endY, { place = st.endPlace })
    if startStr ~= "" then
      return "接: " .. startStr .. "，交: " .. endStr
    end
    return "交: " .. endStr
  end
  return startStr
end

local function DetectZoneInPrefix(prefixText, fallbackZone)
  if prefixText and prefixText ~= "" then
    local bestKw = nil
    local bestPos = -1
    local bestEnd = -1
    local bestLen = 0
    for _, kw in ipairs(ORDERED_ZONE_KEYWORDS) do
      local pos = 1
      while true do
        local s, e = string.find(prefixText, kw, pos, true)
        if not s then break end
        if s > bestPos or (s == bestPos and #kw > bestLen) then
          bestPos = s
          bestEnd = e
          bestLen = #kw
          bestKw = kw
        end
        pos = e + 1
      end
    end
    if bestKw then
      return bestKw, bestEnd
    end
  end
  return fallbackZone or "", nil
end

local ZH_NPC_DELIMITERS = { "：", "、", "，", "（", "）", "。", "；" }

local function HasNpcDelimiter(s)
  if string.find(s, "[:/|,%()%.;\n]") then return true end
  for _, delim in ipairs(ZH_NPC_DELIMITERS) do
    if string.find(s, delim, 1, true) then return true end
  end
  return false
end

-- 补漏：处理 “(瑟根石 47.8, 56.3)” 这类括号内带地名、以及箭头多坐标等首轮正则覆盖不到的坐标对
-- startPos 之前的文本只作为区域推断上下文，不参与输出
local function LinkifyPlainCoordPairs(text, defaultZone, defaultLabel, startPos)
  local result = {}
  local lastPos = startPos or 1
  while true do
    local s, e, xStr, yStr = string.find(text, "(%d+%.?%d+)%s*,%s*(%d+%.?%d+)", lastPos)
    if not s then
      table.insert(result, string.sub(text, lastPos))
      break
    end
    table.insert(result, string.sub(text, lastPos, s - 1))
    local nx = tonumber(xStr)
    local ny = tonumber(yStr)
    if nx and ny and nx >= 1 and nx <= 99.9 and ny >= 1 and ny <= 99.9 then
      local contextStart = math.max(1, s - 60)
      local recentText = string.sub(text, contextStart, s - 1)
      local inferredZone = DetectZoneInPrefix(recentText, defaultZone)
      local link = FormatCoordLink(inferredZone, defaultLabel or inferredZone, nx, ny, false)
      table.insert(result, (link ~= "") and link or string.sub(text, s, e))
    else
      table.insert(result, string.sub(text, s, e))
    end
    lastPos = e + 1
  end
  return table.concat(result, "")
end

-- 跳过已有的 |H...|h...|h 链接，只对普通文本片段执行坐标补漏，避免二次链接化破坏链接载荷
-- context 保留此前片段（含链接载荷/显示名），让后续坐标仍能沿用最近的区域上下文
local function LinkifyRemainingCoordPairs(text, defaultZone, defaultLabel)
  local result = {}
  local cursor = 1
  local context = ""
  while true do
    local ls, le = string.find(text, "|H.-|h.-|h", cursor)
    local plainEnd = ls and (ls - 1) or #text
    local plain = string.sub(text, cursor, plainEnd)
    table.insert(result, LinkifyPlainCoordPairs(context .. plain, defaultZone, defaultLabel, #context + 1))
    if not ls then break end
    local linkSeg = string.sub(text, ls, le)
    table.insert(result, linkSeg)
    -- 只保留链接的可见文本作为上下文；任务链接的显示名可能包含其他区域名，不能参与后续坐标的地图推断
    local isQuestLink = string.sub(linkSeg, 1, 7) == "|Hquest" or string.sub(linkSeg, 1, 11) == "|Hwowfquest"
    local linkDisplay = (not isQuestLink and string.match(linkSeg, "|h(%b[])|h")) or ""
    context = context .. plain .. " " .. linkDisplay
    cursor = le + 1
  end
  return table.concat(result, "")
end

-- 从标题/标签中移除坐标括号，用于地图图钉与聊天文本等不显示链接的位置
local function StripCoordsFromText(text)
  if not text or text == "" then return "" end
  local out = tostring(text)
  out = string.gsub(out, "(%d)%s*，%s*(%d)", "%1,%2")
  out = string.gsub(out, "（", "(")
  out = string.gsub(out, "）", ")")
  out = string.gsub(out, "%b()", function(seg)
    if string.find(seg, "%d+%.?%d*%s*,%s*%d+%.?%d*") then return "" end
    return seg
  end)
  out = string.gsub(out, "%s+", " ")
  return (string.gsub(out, "^%s*(.-)%s*$", "%1"))
end

local function LinkifyInlineCoords(text, defaultZone, defaultLabel, opts)
  if not text or text == "" then return "" end
  local linkifyNpc = opts and opts.linkifyNpc == true
  local out = tostring(text)
  -- 仅替换两个数字之间的全角逗号，避免改动普通说明文本中的标点
  out = string.gsub(out, "(%d)%s*，%s*(%d)", "%1,%2")
  -- 将中文全角括号内的坐标统一转为半角括号再替换为可点击地图链接
  out = string.gsub(out, "（(%d+%.?%d*)%s*[,，]%s*(%d+%.?%d*)）", "(%1, %2)")
  -- 箭头/连字符多坐标（如 “(39.7, 50.0 → 50.8, 52.7)”）拆成两个独立坐标组，避免漏掉后一处坐标
  local multiCoordPatterns = {
    "%(%s*(%d+%.?%d*)%s*,%s*(%d+%.?%d*)%s*→%s*(%d+%.?%d*)%s*,%s*(%d+%.?%d*)%s*%)",
    "%(%s*(%d+%.?%d*)%s*,%s*(%d+%.?%d*)%s*—%s*(%d+%.?%d*)%s*,%s*(%d+%.?%d*)%s*%)",
    "%(%s*(%d+%.?%d*)%s*,%s*(%d+%.?%d*)%s*[~%-]%s*(%d+%.?%d*)%s*,%s*(%d+%.?%d*)%s*%)",
  }
  for _, pat in ipairs(multiCoordPatterns) do
    out = string.gsub(out, pat, "(%1, %2) / (%3, %4)")
  end
  local result = {}
  local lastPos = 1
  while true do
    local s, e, xStr, yStr = string.find(out, "%((%d+%.?%d*)%s*,%s*(%d+%.?%d*)%)", lastPos)
    if not s then
      table.insert(result, string.sub(out, lastPos))
      break
    end
    local before = string.sub(out, lastPos, s - 1)
    local nx = tonumber(xStr)
    local ny = tonumber(yStr)
    if nx and ny and nx >= 1 and nx <= 99.9 and ny >= 1 and ny <= 99.9 then
      local contextStart = math.max(1, s - 60)
      local recentText = string.sub(out, contextStart, s - 1)
      local inferredZone, zEndRel = DetectZoneInPrefix(recentText, defaultZone)
      local replacedWithNpc = false
      if linkifyNpc and zEndRel then
        local zEndAbs = contextStart + zEndRel - 1
        if zEndAbs >= lastPos and zEndAbs < s then
          local npcSeg = string.sub(out, zEndAbs + 1, s - 1)
          local npcTrimmed = string.gsub(npcSeg, "^%s*(.-)%s*$", "%1")
          if npcTrimmed ~= "" and #npcTrimmed <= 48 and not HasNpcDelimiter(npcTrimmed) then
            local prefixBeforeNpc = string.sub(out, lastPos, zEndAbs)
            local npcLink = FormatNpcMapLink(inferredZone, npcTrimmed, nx, ny, { omitZone = true })
            table.insert(result, prefixBeforeNpc)
            table.insert(result, " " .. npcLink)
            replacedWithNpc = true
          end
        end
      end
      if not replacedWithNpc then
        table.insert(result, before)
        local link = FormatCoordLink(inferredZone, defaultLabel or inferredZone, nx, ny, false)
        table.insert(result, (link ~= "") and link or string.sub(out, s, e))
      end
    else
      table.insert(result, before)
      table.insert(result, string.sub(out, s, e))
    end
    lastPos = e + 1
  end
  return LinkifyRemainingCoordPairs(table.concat(result, ""), defaultZone, defaultLabel)
end

local questMetaById = {}
local questMetaByKey = {}

local function GetQuestMetaKey(qid, faction, navCtx)
  if not qid then return nil end
  if navCtx and navCtx ~= "" then
    return tostring(qid) .. ":" .. tostring(faction or "both") .. ":" .. tostring(navCtx)
  end
  if faction == "alliance" or faction == "horde" then
    return tostring(qid) .. ":" .. faction
  end
  return nil
end

local function LookupQuestMeta(qid, fKey)
  if qid and fKey and fKey ~= "" then
    local directKey = tostring(qid) .. ":" .. tostring(fKey)
    if questMetaByKey[directKey] then
      return questMetaByKey[directKey]
    end
  end
  return qid and questMetaById[qid] or nil
end

local function RegisterQuestMeta(q, fallbackLevel, fallbackZone)
  if type(q) ~= "table" then return end
  local qid = tonumber(q.id or q.questId)
  if not qid or qid <= 0 then return end
  local hasNavCtx = (q._navCtx ~= nil and q._navCtx ~= "")
  local metaKey = GetQuestMetaKey(qid, q.faction, q._navCtx)
  local prev = (metaKey and questMetaByKey[metaKey]) or (not hasNavCtx and questMetaById[qid]) or {}
  local resolvedZone = (q.zone and q.zone ~= "") and q.zone or (q.place and q.place ~= "" and q.place) or fallbackZone or prev.zone or ""
  local sameZone = (not prev.zone or prev.zone == "" or resolvedZone == prev.zone)
  local qx = tonumber(q.x)
  local qy = tonumber(q.y)
  local entry = {
    id = qid,
    faction = q.faction or prev.faction,
    name = (q.name and q.name ~= "") and q.name or prev.name or ("任务 #" .. qid),
    level = tonumber(q.level or q.minLevel or fallbackLevel) or prev.level or state.level or 1,
    npc = (q.npc and q.npc ~= "") and q.npc or prev.npc or "",
    zone = resolvedZone,
    place = (q.place and q.place ~= "") and q.place or prev.place or "",
    x = qx or (sameZone and prev.x or nil),
    y = qy or (sameZone and prev.y or nil),
    dungeon = (q.dungeon and q.dungeon ~= "") and q.dungeon or prev.dungeon or "",
    teaches = (q.teaches and q.teaches ~= "") and q.teaches or prev.teaches or "",
    steps = q.steps or prev.steps,
  }
  if not hasNavCtx then
    questMetaById[qid] = entry
  end
  if metaKey then
    questMetaByKey[metaKey] = entry
  end
  if C_QuestLog and C_QuestLog.RequestLoadQuestByID then
    pcall(C_QuestLog.RequestLoadQuestByID, qid)
  end
end

local function IsQuestCompletedById(qid)
  local id = tonumber(qid)
  if not id or id <= 0 then return false end
  if C_QuestLog and C_QuestLog.IsQuestFlaggedCompleted then
    local ok, res = pcall(C_QuestLog.IsQuestFlaggedCompleted, id)
    if ok then return res == true end
  end
  if IsQuestFlaggedCompleted then
    local ok, res = pcall(IsQuestFlaggedCompleted, id)
    if ok then return res == true end
  end
  return false
end

local function GetPlayerProfessions()
  local profs = {}
  if GetProfessions and GetProfessionInfo then
    local ok, p1, p2 = pcall(GetProfessions)
    if ok then
      for _, idx in pairs({ p1, p2 }) do
        if idx then
          local ok2, name = pcall(GetProfessionInfo, idx)
          if ok2 and name and name ~= "" then
            profs[name] = true
          end
        end
      end
    end
  end
  if GetNumSkillLines and GetSkillLineInfo then
    local ok, num = pcall(GetNumSkillLines)
    if ok and num and num > 0 then
      for i = 1, num do
        local ok2, skillName, isHeader = pcall(GetSkillLineInfo, i)
        if ok2 and not isHeader and skillName and skillName ~= "" then
          profs[skillName] = true
        end
      end
    end
  end
  return profs
end

local function HasPlayerProfession(profs, cnName, enName)
  if not profs then return false end
  if cnName and profs[cnName] then return true end
  if enName and profs[enName] then return true end
  return false
end

-- ============================================================================
-- 骑术提醒过滤：角色已学会骑术后，不再提示「攒钱/学骑术」
-- ============================================================================

-- 各版本骑术法术 ID（初级/中级/高级/专家/大师）
local RIDING_SPELL_IDS = { 33388, 33391, 34090, 34091, 90265 }

local function IsSpellKnownById(spellID)
  if IsPlayerSpell then
    local ok, known = pcall(IsPlayerSpell, spellID)
    if ok and known then return true end
  end
  if IsSpellKnown then
    local ok, known = pcall(IsSpellKnown, spellID)
    if ok and known then return true end
  end
  if C_SpellBook and C_SpellBook.IsSpellKnown then
    local ok, known = pcall(C_SpellBook.IsSpellKnown, spellID)
    if ok and known then return true end
  end
  if C_Spell and C_Spell.IsSpellKnown then
    local ok, known = pcall(C_Spell.IsSpellKnown, spellID)
    if ok and known then return true end
  end
  return false
end

local function HasRidingSkillLine()
  if not (GetNumSkillLines and GetSkillLineInfo) then return false end
  local ok, num = pcall(GetNumSkillLines)
  if not ok or type(num) ~= "number" then return false end
  for i = 1, num do
    local okLine, name, isHeader, _, rank = pcall(GetSkillLineInfo, i)
    if okLine and not isHeader and type(name) == "string" and name ~= "" then
      if string.find(name, "骑术", 1, true) or string.find(string.lower(name), "riding", 1, true) then
        local rankNum = tonumber(rank)
        -- rank 为 nil（部分客户端不返回）或大于 0 时视为已学会
        if rank == nil or (rankNum and rankNum > 0) then return true end
      end
    end
  end
  return false
end

local function HasRidingSkill()
  for _, id in ipairs(RIDING_SPELL_IDS) do
    if IsSpellKnownById(id) then return true end
  end
  return HasRidingSkillLine()
end

-- 职业坐骑：圣骑士军马/战马、术士地狱战马/恐惧战马（含无限服自定义法术）
local PALADIN_WARHORSE_SPELL_IDS = { 13819, 34769, 1279399, 73629 }
local PALADIN_CHARGER_SPELL_IDS = { 23214, 34767, 1296534, 73630 }
local WARLOCK_FELSTEED_SPELL_IDS = { 5784 }
local WARLOCK_DREADSTEED_SPELL_IDS = { 23161 }

-- 无限服：联盟圣骑士 40 级军马任务《高贵之书》；60 级战马任务《审判与救赎》
local PALADIN_WARHORSE_QUEST_ID = 1661
local PALADIN_CHARGER_QUEST_ID = 7647

local function AnySpellKnown(spellIDs)
  for _, id in ipairs(spellIDs) do
    if IsSpellKnownById(id) then return true end
  end
  return false
end

local function BuildMilestoneFilter()
  local warhorse = AnySpellKnown(PALADIN_WARHORSE_SPELL_IDS)
    or IsQuestCompletedById(PALADIN_WARHORSE_QUEST_ID)
  local charger = AnySpellKnown(PALADIN_CHARGER_SPELL_IDS)
    or IsQuestCompletedById(PALADIN_CHARGER_QUEST_ID)
  local felsteed = AnySpellKnown(WARLOCK_FELSTEED_SPELL_IDS)
  local dreadsteed = AnySpellKnown(WARLOCK_DREADSTEED_SPELL_IDS)

  return {
    riding = HasRidingSkill(),
    -- 已学会战马/恐惧战马时，低阶军马/地狱战马提醒也一并视为完成
    warhorse = warhorse or charger,
    charger = charger,
    felsteed = felsteed or dreadsteed,
    dreadsteed = dreadsteed,
  }
end

-- 只匹配「学骑术」类提醒
local RIDING_REMINDER_MARKERS = { "骑术", "riding" }

local function IsRidingReminderText(text)
  if type(text) ~= "string" or text == "" then return false end
  local lower = string.lower(text)
  for _, marker in ipairs(RIDING_REMINDER_MARKERS) do
    if string.find(lower, marker, 1, true) then return true end
  end
  return false
end

-- 职业坐骑提醒：对应坐骑/任务完成后同样隐藏
local function IsClassMountReminderText(text, filter)
  local lower = string.lower(text)
  if filter.warhorse and (string.find(lower, "军马", 1, true) or string.find(lower, "warhorse", 1, true) or string.find(lower, "elekk", 1, true)) then
    return true
  end
  if filter.charger and (string.find(lower, "召唤战马", 1, true) or string.find(lower, "战马任务", 1, true) or string.find(lower, "charger", 1, true)) then
    return true
  end
  if filter.felsteed and (string.find(lower, "地狱战马", 1, true) or string.find(lower, "felsteed", 1, true)) then
    return true
  end
  if filter.dreadsteed and (string.find(lower, "恐惧战马", 1, true) or string.find(lower, "dreadsteed", 1, true)) then
    return true
  end
  if (filter.warhorse or filter.charger or filter.felsteed or filter.dreadsteed)
    and (string.find(lower, "职业坐骑", 1, true) or string.find(lower, "class mount", 1, true)) then
    return true
  end
  return false
end

local function ShouldSkipMilestone(milestone, filter)
  if not filter or not milestone then return false end
  local text = milestone.text
  if type(text) ~= "string" or text == "" then return false end
  if filter.riding and IsRidingReminderText(text) then return true end
  return IsClassMountReminderText(text, filter)
end

local function ShouldSkipClassRun(classRun, filter)
  if not filter or not classRun then return false end
  local text = (classRun.teaches or "") .. " " .. (classRun.name or "")
  return IsClassMountReminderText(text, filter)
end

local function HasGatheringProfession(profs)
  return HasPlayerProfession(profs, "采矿", "Mining")
    or HasPlayerProfession(profs, "草药学", "Herbalism")
    or HasPlayerProfession(profs, "剥皮", "Skinning")
end

local function BuildLegacyRecommendationLines(lvl, profs, compact)
  local hasGather = HasGatheringProfession(profs)
  local hasDualHerbMine = HasPlayerProfession(profs, "采矿", "Mining") and HasPlayerProfession(profs, "草药学", "Herbalism")
  local isMax = (lvl or 1) >= 60

  local planTitle, steps
  if isMax then
    planTitle = "满级综合（充裕 9 · 专业 5 · 冒险 2）"
    steps = {
      { fromPt = 1, toPt = 9, tree = "充裕", text = "外交官 + 材料节省，再补恒久 / 美食家" },
      { fromPt = 10, toPt = 14, tree = "专业", text = "加班加点 + 专研 / 讨价还价" },
      { fromPt = 15, toPt = 16, tree = "冒险", text = "常客（飞行加速）" },
    }
  elseif hasGather then
    planTitle = "练级+采集（冒险 10 · 专业 4 · 充裕 2）"
    steps = {
      { fromPt = 1, toPt = 10, tree = "冒险", text = "充分休息 / 冒险刺激 / 常客（续航与赶路）" },
      { fromPt = 11, toPt = 14, tree = "专业", text = hasDualHerbMine and "加班加点 + 专研（采矿/草药双收）" or "加班加点 + 专研 / 讨价还价" },
      { fromPt = 15, toPt = 16, tree = "充裕", text = "材料节省 + 恒久" },
    }
  else
    planTitle = "纯练级通用（冒险 11 · 充裕 5）"
    steps = {
      { fromPt = 1, toPt = 11, tree = "冒险", text = "充分休息 / 冒险刺激 / 常客（续航与赶路）" },
      { fromPt = 12, toPt = 16, tree = "充裕", text = "材料节省 + 恒久，再补外交官" },
    }
  end

  if compact then
    local seqParts = {}
    for _, st in ipairs(steps) do
      table.insert(seqParts, string.format("%s %d–%d", st.tree, st.fromPt, st.toPt))
    end
    return {
      string.format("推荐方案:|r |cffffd100%s|r", planTitle),
      "|cff99e6ff加点顺序:|r " .. table.concat(seqParts, " -> ") .. "  |cffaaaaaa(逐阶明细见「专业&无限特色」页)|r",
    }
  end

  -- 详表只保留一套信息：方案标题 + 点数区间 + 关键节点，不再重复描述整棵树
  local lines = {
    string.format("|cff00ff96>> 当前角色推荐方案 (Lv.%d):|r |cffffd100%s|r", lvl or 1, planTitle),
    "|cffffd100★ 加点顺序:|r",
  }
  for _, st in ipairs(steps) do
    table.insert(lines, string.format(
      "  |cff00ff00第 %d–%d 点|r  |cffffd100[%s]|r %s",
      st.fromPt, st.toPt, st.tree, st.text
    ))
  end
  return lines
end

local function IsQuestActiveById(qid)
  local id = tonumber(qid)
  if not id or id <= 0 then return false end
  if C_QuestLog and C_QuestLog.IsOnQuest then
    local ok, res = pcall(C_QuestLog.IsOnQuest, id)
    if ok and res == true then return true end
  end
  if C_QuestLog and C_QuestLog.GetLogIndexForQuestID then
    local ok, idx = pcall(C_QuestLog.GetLogIndexForQuestID, id)
    if ok and idx and idx > 0 then return true end
  end
  if GetNumQuestLogEntries and GetQuestLogTitle then
    local numEntries = GetNumQuestLogEntries() or 0
    for i = 1, numEntries do
      local _, _, _, isHeader, _, _, _, questID = GetQuestLogTitle(i)
      if not isHeader and questID == id then
        return true
      end
    end
  end
  return false
end

local questieNpcCache = {}
local questieObjectCache = {}
local function ResolveSingleQuestieEntity(entityId, db, cache)
  entityId = tonumber(entityId)
  if not entityId or entityId <= 0 or not db then return nil end
  if cache[entityId] ~= nil then
    return cache[entityId] or nil
  end
  local name = db.name and db.name(entityId) or ""
  local spawns = db.spawns and db.spawns(entityId)
  local prefZoneId = db.zoneID and db.zoneID(entityId)
  local areaId, x, y = nil, nil, nil
  if type(spawns) == "table" then
    if prefZoneId and type(spawns[prefZoneId]) == "table" and type(spawns[prefZoneId][1]) == "table" then
      areaId = prefZoneId
      x = spawns[prefZoneId][1][1]
      y = spawns[prefZoneId][1][2]
    else
      for aid, pts in pairs(spawns) do
        if type(pts) == "table" and type(pts[1]) == "table" then
          areaId = aid
          x = pts[1][1]
          y = pts[1][2]
          break
        end
      end
    end
  end
  if not areaId and type(prefZoneId) == "number" and prefZoneId > 0 then
    areaId = prefZoneId
  end
  local zoneName = ""
  if areaId and C_Map and C_Map.GetAreaInfo then
    local ok, z = pcall(C_Map.GetAreaInfo, areaId)
    if ok and type(z) == "string" then zoneName = z end
  end
  if name == "" and not x and not areaId then
    cache[entityId] = false
    return nil
  end
  local res = { npc = name, zone = zoneName, areaId = areaId, spawns = spawns, x = x, y = y }
  cache[entityId] = res
  return res
end

local function ResolveQuestieEntity(entityIds, db, cache, preferredAreaIds)
  if type(entityIds) ~= "table" or not db then return nil end
  local fallback = nil
  for _, eid in ipairs(entityIds) do
    local res = ResolveSingleQuestieEntity(eid, db, cache)
    if res then
      if not fallback or (not fallback.areaId and res.areaId) then
        fallback = res
      end
      if type(preferredAreaIds) == "table" then
        if res.areaId and preferredAreaIds[res.areaId] then
          return res
        end
        if type(res.spawns) == "table" then
          for aid, pts in pairs(res.spawns) do
            if preferredAreaIds[aid] and type(pts) == "table" and type(pts[1]) == "table" then
              local zName = res.zone
              if C_Map and C_Map.GetAreaInfo then
                local ok, z = pcall(C_Map.GetAreaInfo, aid)
                if ok and type(z) == "string" then zName = z end
              end
              return { npc = res.npc, zone = zName, areaId = aid, spawns = res.spawns, x = pts[1][1], y = pts[1][2] }
            end
          end
        end
      end
    end
  end
  return fallback
end

local function ResolveQuestieNpc(npcIds, preferredAreaIds)
  return ResolveQuestieEntity(npcIds, _G.NpcDB, questieNpcCache, preferredAreaIds)
end

local function ResolveQuestieObject(objectIds, preferredAreaIds)
  return ResolveQuestieEntity(objectIds, _G.ObjectDB, questieObjectCache, preferredAreaIds)
end

local questieQuestInfoCache = {}
local function GetQuestieQuestInfo(qid, fallbackObj)
  qid = tonumber(qid)
  if not qid or qid <= 0 or not _G.QuestDB then return fallbackObj end
  local raw = questieQuestInfoCache[qid]
  if raw == nil then
    local qName = _G.QuestDB.name and _G.QuestDB.name(qid)
    if not qName or qName == "" then
      questieQuestInfoCache[qid] = false
      raw = false
    else
      local qLevel = _G.QuestDB.questLevel and _G.QuestDB.questLevel(qid)
      local qMinLevel = _G.QuestDB.requiredLevel and _G.QuestDB.requiredLevel(qid)
      local started = _G.QuestDB.startedBy and _G.QuestDB.startedBy(qid)
      local finished = _G.QuestDB.finishedBy and _G.QuestDB.finishedBy(qid)
      local startInfo = ResolveQuestieNpc(started and started[1]) or ResolveQuestieObject(started and started[2])
      if not startInfo and type(started and started[3]) == "table" and tonumber(started[3][1]) then
        local itemId = tonumber(started[3][1])
        local itemName = (_G.ItemDB and _G.ItemDB.name and _G.ItemDB.name(itemId)) or (GetItemInfo and GetItemInfo(itemId))
        startInfo = { npc = nil, startItemId = itemId, startItemName = itemName, zone = "", x = nil, y = nil }
      end
      local endInfo = ResolveQuestieNpc(finished and finished[1]) or ResolveQuestieObject(finished and finished[2])
      local preS = _G.QuestDB.preQuestSingle and _G.QuestDB.preQuestSingle(qid)
      local preG = _G.QuestDB.preQuestGroup and _G.QuestDB.preQuestGroup(qid)
      local nextQ = _G.QuestDB.nextQuestInChain and _G.QuestDB.nextQuestInChain(qid)
      local sFlags = _G.QuestDB.specialFlags and _G.QuestDB.specialFlags(qid)
      local repeatable = (type(sFlags) == "number" and bit and bit.band and bit.band(sFlags, 1) ~= 0) or false
      raw = {
        id = qid,
        name = qName,
        level = (type(qLevel) == "number" and qLevel > 0) and qLevel or nil,
        minLevel = (type(qMinLevel) == "number" and qMinLevel > 0) and qMinLevel or nil,
        npc = (startInfo and startInfo.npc ~= "") and startInfo.npc or nil,
        startItemId = startInfo and startInfo.startItemId or nil,
        startItemName = startInfo and startInfo.startItemName or nil,
        zone = (startInfo and startInfo.zone ~= "") and startInfo.zone or nil,
        x = startInfo and startInfo.x or nil,
        y = startInfo and startInfo.y or nil,
        endNpc = (endInfo and endInfo.npc ~= "") and endInfo.npc or nil,
        endZone = (endInfo and endInfo.zone ~= "") and endInfo.zone or nil,
        endX = endInfo and endInfo.x or nil,
        endY = endInfo and endInfo.y or nil,
        preSingle = preS,
        preGroup = preG,
        nextQuest = (type(nextQ) == "number" and nextQ > 0) and nextQ or nil,
        repeatable = repeatable,
      }
      questieQuestInfoCache[qid] = raw
    end
  end
  if raw == false then return fallbackObj end
  if not fallbackObj then return raw end
  local fbHasLoc = (fallbackObj.x ~= nil and fallbackObj.y ~= nil) or (fallbackObj.npc and fallbackObj.npc ~= "")
  local rawHasLoc = (raw.x ~= nil and raw.y ~= nil) or (raw.npc and raw.npc ~= "") or (raw.startItemId ~= nil)
  local useFbLoc = fbHasLoc or (not rawHasLoc)
  return {
    id = raw.id,
    name = raw.name,
    level = raw.level or fallbackObj.level,
    minLevel = raw.minLevel or fallbackObj.minLevel,
    npc = useFbLoc and (fallbackObj.npc or "") or (raw.npc or ""),
    startItemId = (not useFbLoc) and raw.startItemId or fallbackObj.startItemId,
    startItemName = (not useFbLoc) and raw.startItemName or fallbackObj.startItemName,
    zone = useFbLoc and (fallbackObj.zone or "") or (raw.zone or ""),
    x = useFbLoc and fallbackObj.x or raw.x,
    y = useFbLoc and fallbackObj.y or raw.y,
    endNpc = raw.endNpc or fallbackObj.endNpc,
    endZone = raw.endZone or fallbackObj.endZone,
    endX = raw.endX or fallbackObj.endX,
    endY = raw.endY or fallbackObj.endY,
    preSingle = raw.preSingle,
    preGroup = raw.preGroup,
    nextQuest = raw.nextQuest,
    repeatable = raw.repeatable,
  }
end

local function ResolveQuestChainFromQuestieDB(q)
  if type(q) ~= "table" or q._qdbResolved then return q end
  q._qdbResolved = true
  local mainId = tonumber(q.id or q.questId)
  if not mainId or mainId <= 0 or not _G.QuestDB then return q end
  local mainInfo = GetQuestieQuestInfo(mainId, q)
  if not mainInfo or not mainInfo.name or mainInfo.name == "" then return q end

  q.name = mainInfo.name
  if mainInfo.level then q.level = mainInfo.level end
  if mainInfo.minLevel then q.minLevel = mainInfo.minLevel end
  q.repeatable = mainInfo.repeatable or nil

  local steps = {}
  local visited = {}
  local function makeStep(sid, info, preId, reqAll)
    local st = {
      id = sid,
      name = info.name,
      level = info.level or q.level,
      npc = info.npc or "",
      startItemId = info.startItemId,
      startItemName = info.startItemName,
      zone = info.zone or "",
      place = "",
      x = info.x,
      y = info.y,
      repeatable = info.repeatable or nil,
      preId = preId,
      reqAll = reqAll,
    }
    if info.endNpc and info.endNpc ~= "" and (info.endNpc ~= st.npc or info.endZone ~= st.zone or info.endX ~= st.x or info.endY ~= st.y) then
      st.endNpc = info.endNpc
      st.endZone = info.endZone
      st.endX = info.endX
      st.endY = info.endY
    end
    return st
  end

  local function collectPre(qid, depth)
    if depth >= 12 or visited[qid] then return end
    visited[qid] = true
    local info = GetQuestieQuestInfo(qid)
    if not info then return end
    local preG = {}
    if type(info.preGroup) == "table" then
      for _, pid in ipairs(info.preGroup) do
        local npid = tonumber(pid)
        if npid and npid ~= 0 then table.insert(preG, npid) end
      end
    end
    local preS = {}
    if type(info.preSingle) == "table" then
      for _, pid in ipairs(info.preSingle) do
        local npid = tonumber(pid)
        if npid and npid ~= 0 then table.insert(preS, npid) end
      end
    end
    local reqAll, singlePre = nil, nil
    if #preG > 1 then
      reqAll = preG
      for _, pid in ipairs(preG) do
        collectPre(math.abs(pid), depth + 1)
      end
    elseif #preG == 1 then
      singlePre = math.abs(preG[1])
      collectPre(singlePre, depth + 1)
    elseif #preS == 1 then
      singlePre = math.abs(preS[1])
      collectPre(singlePre, depth + 1)
    end
    table.insert(steps, makeStep(qid, info, singlePre, reqAll))
  end

  collectPre(mainId, 0)
  local selfIdx = #steps
  local curId = mainId
  local fwdDepth = 0
  while fwdDepth < 8 do
    local cInfo = GetQuestieQuestInfo(curId)
    local nxt = cInfo and tonumber(cInfo.nextQuest)
    if not nxt or nxt <= 0 or visited[nxt] then break end
    local nInfo = GetQuestieQuestInfo(nxt)
    if not nInfo or not nInfo.name then break end
    visited[nxt] = true
    table.insert(steps, makeStep(nxt, nInfo, curId, nil))
    curId = nxt
    fwdDepth = fwdDepth + 1
  end

  if #steps > 1 then
    q.steps = steps
    q.stepCount = #steps
    q.hasPrereq = (selfIdx > 1)
    local firstSt = steps[1]
    if q.hasPrereq and firstSt then
      local firstInfo = GetQuestieQuestInfo(firstSt.id)
      if firstInfo and firstInfo.minLevel then q.minLevel = firstInfo.minLevel end
      if firstSt.startItemId and (not firstSt.npc or firstSt.npc == "") then
        q.startItemId = firstSt.startItemId
        q.startItemName = firstSt.startItemName
        q.npc = ""
        q.x = nil
        q.y = nil
        q.zone = firstSt.zone ~= "" and firstSt.zone or q.zone
      else
        q.npc = firstSt.npc ~= "" and firstSt.npc or q.npc
        if firstSt.npc and firstSt.npc ~= "" then
          q.startItemId = nil
          q.startItemName = nil
        end
        q.zone = firstSt.zone ~= "" and firstSt.zone or q.zone
        q.x = firstSt.x or q.x
        q.y = firstSt.y or q.y
      end
    else
      q.npc = mainInfo.npc ~= "" and mainInfo.npc or q.npc
      q.startItemId = mainInfo.startItemId or q.startItemId
      q.startItemName = mainInfo.startItemName or q.startItemName
      q.zone = mainInfo.zone ~= "" and mainInfo.zone or q.zone
      q.x = mainInfo.x or q.x
      q.y = mainInfo.y or q.y
      q.endNpc = mainInfo.endNpc
      q.endZone = mainInfo.endZone
      q.endX = mainInfo.endX
      q.endY = mainInfo.endY
    end
  else
    q.stepCount = 1
    q.hasPrereq = false
    q.npc = mainInfo.npc ~= "" and mainInfo.npc or q.npc
    q.startItemId = mainInfo.startItemId or q.startItemId
    q.startItemName = mainInfo.startItemName or q.startItemName
    q.zone = mainInfo.zone ~= "" and mainInfo.zone or q.zone
    q.x = mainInfo.x or q.x
    q.y = mainInfo.y or q.y
    if mainInfo.endNpc and mainInfo.endNpc ~= "" and (mainInfo.endNpc ~= q.npc or mainInfo.endZone ~= q.zone or mainInfo.endX ~= q.x or mainInfo.endY ~= q.y) then
      q.endNpc = mainInfo.endNpc
      q.endZone = mainInfo.endZone
      q.endX = mainInfo.endX
      q.endY = mainInfo.endY
    end
  end
  return q
end

local function DedupeQuestieQuests(quests)
  local list = {}
  for _, q in ipairs(quests or {}) do
    ResolveQuestChainFromQuestieDB(q)
    table.insert(list, q)
  end
  local function classesCover(holder, target)
    local hCls = type(holder) == "table" and holder.classes or nil
    if type(hCls) ~= "table" or #hCls == 0 then
      return true
    end
    local tCls = type(target) == "table" and target.classes or nil
    if type(tCls) ~= "table" or #tCls == 0 then
      return false
    end
    local hSet = {}
    for _, c in ipairs(hCls) do hSet[c] = true end
    for _, c in ipairs(tCls) do
      if not hSet[c] then return false end
    end
    return true
  end
  local function sameStepDeps(s1, s2)
    if not s1 or not s2 then return s1 == s2 end
    if s1.preId ~= s2.preId then return false end
    local r1, r2 = s1.reqAll, s2.reqAll
    if type(r1) ~= "table" and type(r2) ~= "table" then return true end
    if type(r1) ~= "table" or type(r2) ~= "table" or #r1 ~= #r2 then return false end
    for idx = 1, #r1 do
      if r1[idx] ~= r2[idx] then return false end
    end
    return true
  end
  local function stepPickupCovers(hStep, tStep, hFallbackZone, tFallbackZone)
    if type(tStep) ~= "table" then return true end
    local tHasNpc = (tStep.npc and tStep.npc ~= "")
    local tHasPlace = (tStep.place and tStep.place ~= "")
    local tHasCoords = (tStep.x ~= nil and tStep.y ~= nil)
    local tz = (tStep.zone and tStep.zone ~= "") and tStep.zone or (tFallbackZone or "")
    if not tHasNpc and not tHasPlace and not tHasCoords and tz == "" then return true end
    if type(hStep) ~= "table" then return false end
    if tHasNpc and (hStep.npc or "") ~= tStep.npc then
      return false
    end
    if tHasPlace and (hStep.place or "") ~= tStep.place then
      return false
    end
    local hz = (hStep.zone and hStep.zone ~= "") and hStep.zone or (hFallbackZone or "")
    if tz ~= "" and hz ~= tz then
      return false
    end
    if tHasCoords then
      if hStep.x == nil or hStep.y == nil then
        return false
      end
      if hStep.x ~= tStep.x or hStep.y ~= tStep.y then
        return false
      end
    end
    return true
  end
  local function stepTurninCovers(hStep, tStep, hFallbackZone, tFallbackZone)
    if type(tStep) ~= "table" then return true end
    local tPickupZone = (tStep.zone and tStep.zone ~= "") and tStep.zone or (tFallbackZone or "")
    local tEndZone = (tStep.endZone and tStep.endZone ~= "") and tStep.endZone or tPickupZone
    local tHasEnd = (tStep.endNpc and tStep.endNpc ~= "") and (tStep.endNpc ~= tStep.npc or tEndZone ~= tPickupZone or tStep.endX ~= tStep.x or tStep.endY ~= tStep.y)
    if not tHasEnd then return true end
    if type(hStep) ~= "table" then return false end
    local hPickupZone = (hStep.zone and hStep.zone ~= "") and hStep.zone or (hFallbackZone or "")
    local hEndZone = (hStep.endZone and hStep.endZone ~= "") and hStep.endZone or hPickupZone
    local hHasEnd = (hStep.endNpc and hStep.endNpc ~= "") and (hStep.endNpc ~= hStep.npc or hEndZone ~= hPickupZone or hStep.endX ~= hStep.x or hStep.endY ~= hStep.y)
    if not hHasEnd then return false end
    if hStep.endNpc ~= tStep.endNpc then return false end
    if tEndZone ~= "" and hEndZone ~= tEndZone then return false end
    if tStep.endX ~= nil and tStep.endY ~= nil then
      if hStep.endX ~= tStep.endX or hStep.endY ~= tStep.endY then return false end
    end
    return true
  end
  local function navCovers(holder, target, targetOffset)
    local hFallbackZone = holder.zone or ""
    local tFallbackZone = target.zone or ""
    if type(holder.steps) == "table" and type(target.steps) == "table" then
      local off = targetOffset or 0
      for k = 1, #holder.steps do
        local hs = holder.steps[k]
        local ts = target.steps[off + k]
        if (not stepPickupCovers(hs, ts, hFallbackZone, tFallbackZone)) or (not stepTurninCovers(hs, ts, hFallbackZone, tFallbackZone)) then
          return false
        end
      end
      return true
    end
    local hs = (type(holder.steps) == "table" and holder.steps[#holder.steps]) or holder
    local ts = (type(target.steps) == "table" and target.steps[#target.steps]) or target
    return stepPickupCovers(hs, ts, hFallbackZone, tFallbackZone) and stepTurninCovers(hs, ts, hFallbackZone, tFallbackZone)
  end
  local function areOmittedStepsBreadcrumbs(ids, offset, qSteps)
    if not (_G.QuestDB and _G.QuestDB.breadcrumbs) then return false end
    local omittedSet = {}
    for k = 1, offset do
      if IsQuestActiveById(ids[k]) then return false end
      omittedSet[ids[k]] = true
      local prevId = ids[k]
      local nextId = ids[k + 1]
      local bcs = nextId and _G.QuestDB.breadcrumbs(nextId) or nil
      local found = false
      if type(bcs) == "table" then
        for _, bcId in ipairs(bcs) do
          if tonumber(bcId) == prevId then
            found = true
            break
          end
        end
      end
      if not found then return false end
    end
    if type(qSteps) == "table" then
      for k = offset + 1, #qSteps do
        local st = qSteps[k]
        if st then
          if type(st.reqAll) == "table" then
            for _, rid in ipairs(st.reqAll) do
              if omittedSet[tonumber(rid)] then return false end
            end
          end
          local sid = tonumber(st.id)
          local qInfo = sid and GetQuestieQuestInfo(sid) or nil
          if qInfo then
            if type(qInfo.preSingle) == "table" then
              for _, pid in ipairs(qInfo.preSingle) do
                if omittedSet[tonumber(pid)] then return false end
              end
            end
            if type(qInfo.preGroup) == "table" then
              for _, pid in ipairs(qInfo.preGroup) do
                if omittedSet[tonumber(pid)] then return false end
              end
            end
          end
        end
      end
    end
    return true
  end
  local function extractIds(entry)
    local ids = {}
    if type(entry.steps) == "table" and #entry.steps > 0 then
      for _, st in ipairs(entry.steps) do
        local sid = tonumber(st and st.id)
        if not sid or sid <= 0 then
          return ids, true
        end
        table.insert(ids, sid)
      end
      return ids, false
    end
    local qid = tonumber(entry.id or entry.questId)
    if not qid or qid <= 0 then
      return ids, true
    end
    table.insert(ids, qid)
    return ids, false
  end
  local out = {}
  for i, q in ipairs(list) do
    local ids, qInvalid = extractIds(q)
    local redundant = false
    if not qInvalid then
      for j, other in ipairs(list) do
        local factionCovers = (other.faction == q.faction or other.faction == "both")
        if i ~= j and factionCovers and classesCover(other, q) then
          local oIds, oInvalid = extractIds(other)
          if not oInvalid then
            if #oIds < #ids then
              local oFirstRep
              if type(other.steps) == "table" and other.steps[1] then
                oFirstRep = other.steps[1].repeatable
              else
                oFirstRep = other.repeatable
              end
              if not oFirstRep then
                local offset = #ids - #oIds
                local match = true
                local sameSteps = (type(other.steps) == "table" and type(q.steps) == "table")
                for k = 1, #oIds do
                  if oIds[k] ~= ids[offset + k] then
                    match = false
                    break
                  end
                  if sameSteps then
                    local os, qs = other.steps[k], q.steps[offset + k]
                    if k == 1 then
                      local oPre = os and tonumber(os.preId)
                      local qPre = qs and tonumber(qs.preId)
                      local preOk = (oPre == qPre) or (oPre == nil and qPre == ids[offset])
                      local r1, r2 = os and os.reqAll, qs and qs.reqAll
                      local reqOk = (type(r1) ~= "table" and type(r2) ~= "table")
                      if not reqOk and type(r1) == "table" and type(r2) == "table" and #r1 == #r2 then
                        reqOk = true
                        for idx = 1, #r1 do
                          if r1[idx] ~= r2[idx] then reqOk = false break end
                        end
                      end
                      if not preOk or not reqOk then match = false break end
                    elseif not sameStepDeps(os, qs) then
                      match = false
                      break
                    end
                  end
                end
                if match and areOmittedStepsBreadcrumbs(ids, offset, q.steps) and navCovers(other, q, offset) then redundant = true break end
              end
            elseif #oIds == #ids and #ids > 0 then
              local match = true
              local sameSteps = (type(other.steps) == "table" and type(q.steps) == "table")
              for k = 1, #oIds do
                if oIds[k] ~= ids[k] or (sameSteps and not sameStepDeps(other.steps[k], q.steps[k])) then
                  match = false
                  break
                end
              end
              local qMin = tonumber(q.minLevel) or 0
              local oMin = tonumber(other.minLevel) or 0
              local minLevelCovers = (oMin == qMin) or (oMin > 0 and (qMin <= 0 or oMin < qMin))
              if match and minLevelCovers and navCovers(other, q, 0) then
                local sameClassScope = classesCover(q, other)
                local strictlyBetterNav = not navCovers(q, other, 0)
                local strictlyBetterMinLevel = (oMin > 0 and (qMin <= 0 or oMin < qMin))
                if strictlyBetterNav or strictlyBetterMinLevel or (not sameClassScope) or (other.faction == "both" and q.faction ~= "both") or (other.faction == q.faction and j < i) then
                  redundant = true
                  break
                end
              end
            end
          end
        end
      end
    end
    if not redundant then
      table.insert(out, q)
    end
  end
  return out
end

local function IsQuestCompleted(q)
  if type(q) ~= "table" then return false end
  ResolveQuestChainFromQuestieDB(q)
  if type(q.steps) == "table" and #q.steps > 0 then
    local lastStep = q.steps[#q.steps]
    local lastStepId = tonumber(lastStep and lastStep.id)
    if not lastStepId or lastStepId <= 0 then
      return false
    end
    if IsQuestCompletedById(lastStepId) then
      return true
    end
    -- 若最后一步为可重复任务（如“再次使用超级清洁器”），只要前面最近一个非重复步骤已完成且当前未接取该重复任务，即视为任务线已完成
    if lastStep.repeatable then
      if IsQuestActiveById(lastStepId) then
        return false
      end
      for i = #q.steps - 1, 1, -1 do
        local st = q.steps[i]
        if st and not st.repeatable then
          local sid = tonumber(st.id)
          if sid and sid > 0 then
            return IsQuestCompletedById(sid)
          end
          break
        end
      end
    end
    return false
  end
  return IsQuestCompletedById(q.id or q.questId)
end

-- 统计任务链树中从起点开始连续已完成的前置步骤数，用于默认折叠已完成的前置任务
local function CountLeadingCompletedChainSteps(entries)
  local count = 0
  for _, ent in ipairs(entries or {}) do
    local sid = tonumber(ent and ent.id)
    if not sid or sid <= 0 then break end
    if IsQuestCompletedById(sid) and not IsQuestActiveById(sid) then
      count = count + 1
    else
      break
    end
  end
  return count
end

local function GetQuestChainFoldKey(q, ctxZone)
  local qid = tonumber(q and (q.id or q.questId))
  if not qid or qid <= 0 then return nil end
  local origin = q and q._originId and (":" .. tostring(q._originId)) or ""
  local z = (ctxZone and ctxZone ~= "") and ctxZone or (q and q._navCtx)
  if z and z ~= "" then
    return string.format("%d:%s:%s%s", qid, tostring(q.faction or ""), z, origin)
  end
  return string.format("%d:%s%s", qid, tostring(q.faction or ""), origin)
end

local function GetQuestStepFoldKey(sid, faction, ctxZone)
  local stepId = tonumber(sid)
  if not stepId or stepId <= 0 then return nil end
  if ctxZone and ctxZone ~= "" then
    return string.format("step:%d:%s:%s", stepId, tostring(faction or ""), ctxZone)
  end
  return string.format("step:%d:%s", stepId, tostring(faction or ""))
end

local function GetSharedPrefixFoldKey(sid, faction, ctxZone)
  local stepId = tonumber(sid)
  if not stepId or stepId <= 0 then return nil end
  if ctxZone and ctxZone ~= "" then
    return string.format("prefix:%d:%s:%s", stepId, tostring(faction or ""), ctxZone)
  end
  return string.format("prefix:%d:%s", stepId, tostring(faction or ""))
end

local function IsQuestChainFoldExpanded(foldKey)
  return foldKey ~= nil and state.expandedChains and state.expandedChains[foldKey] == true
end

local function FormatStepTreeIndent(baseIndent, depth)
  if depth <= 0 then return baseIndent end
  return baseIndent .. string.rep("  ", depth - 1) .. "|cff99e6ff└> |r"
end

-- 折叠前置后按仍可见的依赖重新计算树形层级，避免隐藏父级后出现悬空缩进
local function RecomputeVisibleStepDepths(orderedEntries, firstVisibleIdx, hasPrereqMeta, depthById)
  if firstVisibleIdx > #orderedEntries then return {} end
  local visibleById = {}
  for i = firstVisibleIdx, #orderedEntries do
    visibleById[orderedEntries[i].id] = true
  end
  local baseDepth = depthById[orderedEntries[firstVisibleIdx].id] or 0
  local depths = {}
  for i = firstVisibleIdx, #orderedEntries do
    local ent = orderedEntries[i]
    local d = 0
    if hasPrereqMeta then
      local st = ent.step or {}
      local maxParentDepth = -1
      local parentIds = {}
      if type(st.reqAll) == "table" then
        for _, pid in ipairs(st.reqAll) do
          local npid = tonumber(pid)
          local absPid = npid and math.abs(npid) or nil
          if absPid and absPid > 0 and visibleById[absPid] then table.insert(parentIds, absPid) end
        end
      end
      if #parentIds == 0 then
        local npid = tonumber(st.preId)
        local absPid = npid and math.abs(npid) or nil
        if absPid and absPid > 0 and visibleById[absPid] then table.insert(parentIds, absPid) end
      end
      for _, pid in ipairs(parentIds) do
        local pd = depths[pid]
        if pd and pd > maxParentDepth then maxParentDepth = pd end
      end
      d = maxParentDepth + 1
    else
      d = (depthById[ent.id] or 0) - baseDepth
      if d < 0 then d = 0 end
    end
    depths[ent.id] = d
  end
  return depths
end

local function IsQuestLineStarted(q)
  if type(q) ~= "table" then return false end
  ResolveQuestChainFromQuestieDB(q)
  if type(q.steps) == "table" and #q.steps > 0 then
    for _, st in ipairs(q.steps) do
      local sid = tonumber(st and st.id)
      if sid and sid > 0 then
        if IsQuestActiveById(sid) or IsQuestCompletedById(sid) then
          return true
        end
      end
    end
    return false
  end
  local qid = tonumber(q.id or q.questId)
  if qid and qid > 0 then
    return IsQuestActiveById(qid) or IsQuestCompletedById(qid)
  end
  return false
end

local function MatchesQuestClass(q, classKey)
  if type(q) ~= "table" or type(q.classes) ~= "table" or #q.classes == 0 then
    return true
  end
  local targetClass = classKey or state.classKey
  for _, ck in ipairs(q.classes) do
    if ck == targetClass then
      return true
    end
  end
  return false
end

local function IsDungeonAllQuestsCompleted(d, faction, classKey)
  if type(d) ~= "table" or type(d.quests) ~= "table" or #d.quests == 0 then
    return false
  end
  local f = faction or state.faction or "alliance"
  local total = 0
  for _, q in ipairs(d.quests) do
    local qFactionOk = (not q.faction or q.faction == "" or q.faction == "both" or q.faction == f)
    if qFactionOk and MatchesQuestClass(q, classKey) then
      total = total + 1
      if not IsQuestCompleted(q) then
        return false
      end
    end
  end
  return total > 0
end

local function FormatQuestLink(q, fallbackLevel, fallbackZone, suppressDoneTag, completedOverride)
  if type(q) ~= "table" then
    return "|cffffd100[" .. tostring(q or "未知任务") .. "]|r"
  end
  RegisterQuestMeta(q, fallbackLevel, fallbackZone)
  local qid = tonumber(q.id or q.questId)
  local qName = (q.name and q.name ~= "") and q.name or (qid and ("任务 #" .. qid) or "未知任务")
  local qLevel = tonumber(q.level or q.minLevel or fallbackLevel) or state.level or 1
  if qid and qid > 0 then
    local completed = completedOverride
    if completed == nil then completed = IsQuestCompletedById(qid) end
    local active = (not completed) and IsQuestActiveById(qid)
    local color = completed and "|cff888888" or (active and "|cff00ff00" or "|cffffff00")
    if q._navCtx and q._navCtx ~= "" then
      return string.format("%s|Hwowfquest:%d:%d:%s:%s|h[%s]|h|r", color, qid, qLevel, tostring(q.faction or "both"), q._navCtx, qName)
    end
    if q.faction == "alliance" or q.faction == "horde" then
      return string.format("%s|Hwowfquest:%d:%d:%s|h[%s]|h|r", color, qid, qLevel, q.faction, qName)
    end
    return string.format("%s|Hquest:%d:%d|h[%s]|h|r", color, qid, qLevel, qName)
  end
  local color = (completedOverride == true) and "|cff888888" or "|cffffd100"
  return string.format("%s[%s]|r", color, qName)
end

local CLASS_NAMES_ZH = {
  WARRIOR = "战士",
  PALADIN = "圣骑士",
  HUNTER = "猎人",
  ROGUE = "潜行者",
  PRIEST = "牧师",
  SHAMAN = "萨满",
  MAGE = "法师",
  WARLOCK = "术士",
  DRUID = "德鲁伊",
}

local function FormatQuestClassTag(q)
  if type(q) ~= "table" or type(q.classes) ~= "table" or #q.classes == 0 then
    return ""
  end
  local names = {}
  for _, ck in ipairs(q.classes) do
    table.insert(names, CLASS_NAMES_ZH[ck] or ck)
  end
  return "|cffc79c6e[" .. table.concat(names, "/") .. "]|r "
end

-- 生成任务链展示；foldCompletedPrefix 为 true 时默认折叠开头连续已完成的前置步骤（可点击展开/收起）
local function FormatQuestWithSteps(q, fallbackLevel, fallbackZone, treeIndent, foldCompletedPrefix, foldKeyOverride)
  if type(q) == "table" then ResolveQuestChainFromQuestieDB(q) end
  if type(q) ~= "table" or type(q.steps) ~= "table" or #q.steps <= 1 then
    return FormatQuestLink(q, fallbackLevel, fallbackZone), nil
  end
  local chainDone = IsQuestCompleted(q)
  local primary = FormatQuestLink(q, fallbackLevel, fallbackZone, nil, chainDone)
  local primaryId = tonumber(q.id or q.questId)
  local parentZone = (q.zone and q.zone ~= "") and q.zone or (fallbackZone or "")
  local primaryIdx = nil
  local hasReqAll = false
  local stepById = {}
  local lastStepId = nil
  for idx, st in ipairs(q.steps) do
    local sid = tonumber(st.id)
    if sid and sid > 0 then
      lastStepId = sid
      if sid == primaryId then
        primaryIdx = idx
      end
      if type(st.reqAll) == "table" and #st.reqAll > 1 then
        hasReqAll = true
      end
    end
  end

  local orderedLinks = {}
  local chainLinks = {}
  for idx, st in ipairs(q.steps) do
    local sid = tonumber(st.id)
    if sid and sid > 0 then
      local isPrimary = (sid == primaryId)
      local stZone = (st.zone and st.zone ~= "") and st.zone or parentZone
      local sameZoneAsPrimary = (not st.zone or st.zone == "") or (not q.zone or q.zone == "") or (st.zone == q.zone)
      local stepObj = {
        id = sid,
        faction = q.faction,
        _navCtx = q._navCtx,
        name = st.name or q.name,
        level = st.level or q.level or q.minLevel or fallbackLevel,
        npc = (st.npc and st.npc ~= "") and st.npc or (isPrimary and q.npc or ""),
        zone = stZone,
        place = (st.place and st.place ~= "") and st.place or (isPrimary and q.place or ""),
        x = st.x or (isPrimary and sameZoneAsPrimary and q.x or nil),
        y = st.y or (isPrimary and sameZoneAsPrimary and q.y or nil),
      }
      local link = FormatQuestLink(stepObj, fallbackLevel, stZone)
      local coloredLink = isPrimary and link or ("|cff99e6ff" .. link .. "|r")
      stepById[sid] = { step = st, link = coloredLink, isPrimary = isPrimary }
      table.insert(orderedLinks, coloredLink)
      if isPrimary then
        local hasStepCoords = (st.x ~= nil and st.y ~= nil)
        local hasStepZone = (st.zone ~= nil and st.zone ~= "")
        local hasStepInfo = (st.npc and st.npc ~= "") or (st.place and st.place ~= "") or hasStepZone
        if hasStepCoords or hasStepInfo then
          local effectiveParentZone = (q.zone and q.zone ~= "") and q.zone or parentZone
          local primaryZone = hasStepZone and st.zone or effectiveParentZone
          local zoneChanged = hasStepZone and (effectiveParentZone ~= "") and (st.zone ~= effectiveParentZone)
          RegisterQuestMeta({
            id = sid,
            faction = q.faction,
            name = st.name or q.name,
            level = st.level or q.level or q.minLevel or fallbackLevel,
            npc = (st.npc and st.npc ~= "") and st.npc or q.npc,
            zone = primaryZone,
            place = (st.place and st.place ~= "") and st.place or q.place,
            x = hasStepCoords and st.x or (not zoneChanged and q.x or nil),
            y = hasStepCoords and st.y or (not zoneChanged and q.y or nil),
          }, fallbackLevel, primaryZone)
        end
      else
        table.insert(chainLinks, link)
      end
    end
  end

  -- 逐步缩进树形展示：每步单独一行，同级缩进表示并行/分支，向内缩进表示解锁后续，仅显示可悬停/点击的 NPC 名
  local baseIndent = treeIndent or "    "
  local stepEntries = {}
  local hasAnyPrereqMeta = false
  for idx, st in ipairs(q.steps) do
    local sid = tonumber(st.id)
    if sid and sid > 0 and stepById[sid] then
      local stZone = (st.zone and st.zone ~= "") and st.zone or parentZone
      local isPrimary = (sid == primaryId)
      local canFallbackCoords = isPrimary and (not st.npc or st.npc == "" or st.npc == q.npc) and (not st.zone or st.zone == "" or st.zone == q.zone)
      local hasStepCoords = (st.x ~= nil and st.y ~= nil)
      local effSt = {
        id = sid,
        npc = (st.npc and st.npc ~= "") and st.npc or ((isPrimary and not st.startItemId) and q.npc or ""),
        startItemId = st.startItemId,
        startItemName = st.startItemName,
        zone = stZone,
        x = hasStepCoords and st.x or (canFallbackCoords and q.x or nil),
        y = hasStepCoords and st.y or (canFallbackCoords and q.y or nil),
        endNpc = st.endNpc,
        endZone = st.endZone,
        endX = st.endX,
        endY = st.endY,
      }
      if tonumber(st.preId) or (type(st.reqAll) == "table" and #st.reqAll > 0) then
        hasAnyPrereqMeta = true
      end
      table.insert(stepEntries, {
        id = sid,
        step = st,
        link = stepById[sid].link,
        npcInfo = FormatStepNpcInfo(effSt, stZone),
        idx = idx,
      })
    end
  end

  if #stepEntries > 1 then
    local depthById = {}
    local orderedEntries = {}
    if hasAnyPrereqMeta then
      local emitted = {}
      local visiting = {}
      local function emitStep(sid)
        if not sid or not stepById[sid] then return 0 end
        if emitted[sid] then return depthById[sid] or 0 end
        if visiting[sid] then return 0 end
        visiting[sid] = true
        local st = stepById[sid].step
        local maxParentDepth = -1
        if type(st.reqAll) == "table" and #st.reqAll > 1 then
          for _, pid in ipairs(st.reqAll) do
            local npid = tonumber(pid)
            local absPid = npid and math.abs(npid) or nil
            if absPid and absPid > 0 and stepById[absPid] then
              local pd = emitStep(absPid)
              if pd > maxParentDepth then maxParentDepth = pd end
            end
          end
        else
          local npid = tonumber(st.preId)
          local absPid = npid and math.abs(npid) or nil
          if absPid and absPid > 0 and stepById[absPid] then
            maxParentDepth = emitStep(absPid)
          end
        end
        visiting[sid] = nil
        local d = maxParentDepth + 1
        depthById[sid] = d
        emitted[sid] = true
        for _, ent in ipairs(stepEntries) do
          if ent.id == sid then
            table.insert(orderedEntries, ent)
            break
          end
        end
        return d
      end
      if lastStepId then
        emitStep(lastStepId)
      end
      if #orderedEntries ~= #stepEntries then
        orderedEntries = {}
        depthById = {}
        for i, ent in ipairs(stepEntries) do
          depthById[ent.id] = i - 1
          table.insert(orderedEntries, ent)
        end
      end
    else
      for i, ent in ipairs(stepEntries) do
        depthById[ent.id] = i - 1
        table.insert(orderedEntries, ent)
      end
    end

    -- 默认折叠任务链开头连续已完成的前置步骤，仅保留一行可点击的摘要
    local foldCount = 0
    local foldKey = nil
    local isFolded = false
    if foldCompletedPrefix then
      foldCount = CountLeadingCompletedChainSteps(orderedEntries)
      if foldCount > 0 then
        foldKey = foldKeyOverride or GetQuestChainFoldKey(q)
        if not foldKey then
          foldCount = 0
        else
          isFolded = not IsQuestChainFoldExpanded(foldKey)
        end
      end
    end

    local firstVisibleIdx = 1
    local visibleDepths = nil
    if foldCount > 0 and isFolded then
      firstVisibleIdx = foldCount + 1
      visibleDepths = RecomputeVisibleStepDepths(orderedEntries, firstVisibleIdx, hasAnyPrereqMeta, depthById)
    end

    local treeLines = {}
    if foldCount > 0 then
      local foldText
      if isFolded then
        foldText = string.format("|cff888888|Hwowfchain:%s|h[+]|h|r 已完成前 %d 步", foldKey, foldCount)
      else
        foldText = string.format("|cff00ffcc|Hwowfchain:%s|h[-]|h|r 已完成前 %d 步", foldKey, foldCount)
      end
      table.insert(treeLines, baseIndent .. foldText)
    end
    for i, ent in ipairs(orderedEntries) do
      if i >= firstVisibleIdx then
        local d = visibleDepths and (visibleDepths[ent.id] or 0) or (depthById[ent.id] or 0)
        local indent = FormatStepTreeIndent(baseIndent, d)
        local npcPart = (ent.npcInfo ~= "") and ("  " .. ent.npcInfo) or ""
        table.insert(treeLines, indent .. ent.link .. npcPart)
      end
    end
    if #treeLines > 0 then
      return primary, table.concat(treeLines, "\n")
    end
  end

  -- 若主任务前面存在前置步骤（primaryIdx > 1），按“前置1 -> 前置2 -> 主任务 -> 后续”正序展示
  if primaryIdx and primaryIdx > 1 and #orderedLinks > 1 then
    return table.concat(orderedLinks, " |cff99e6ff->|r "), nil
  end
  if #chainLinks > 0 then
    return primary .. " |cff99e6ff-> " .. table.concat(chainLinks, " -> ") .. "|r", nil
  end
  return primary, nil
end

local function GroupQuestsBySharedPrefix(quests)
  local groups = {}
  local used = {}
  for i, q in ipairs(quests or {}) do
    if not used[i] then
      local hasSteps = (type(q.steps) == "table" and #q.steps >= 2)
      local matchedIdx = nil
      local minPrefix = nil
      if hasSteps then
        local cTag1 = FormatQuestClassTag(q)
        for j = i + 1, #quests do
          local q2 = quests[j]
          if (not used[j]) and type(q2.steps) == "table" and #q2.steps >= 2 and q2.faction == q.faction and FormatQuestClassTag(q2) == cTag1 then
            local k = 0
            local maxK = math.min(#q.steps - 1, #q2.steps - 1)
            while k < maxK do
              local id1 = tonumber(q.steps[k + 1].id)
              local id2 = tonumber(q2.steps[k + 1].id)
              if id1 and id1 > 0 and id2 and id2 > 0 and id1 == id2 then
                k = k + 1
              else
                break
              end
            end
            local function hasSuffixReqAll(steps, startIdx)
              for idx = startIdx, #steps do
                local st = steps[idx]
                if type(st.reqAll) == "table" and #st.reqAll > 1 then
                  return true
                end
              end
              return false
            end
            if k >= 1 and (not hasSuffixReqAll(q.steps, k + 1)) and (not hasSuffixReqAll(q2.steps, k + 1)) then
              if not matchedIdx then
                matchedIdx = { i, j }
                minPrefix = k
              else
                table.insert(matchedIdx, j)
                if k < minPrefix then minPrefix = k end
              end
            end
          end
        end
      end
      if matchedIdx and #matchedIdx >= 2 and minPrefix and minPrefix >= 1 then
        local grp = {}
        for _, idx in ipairs(matchedIdx) do
          used[idx] = true
          table.insert(grp, quests[idx])
        end
        table.insert(groups, { quests = grp, prefixLen = minPrefix })
      else
        used[i] = true
        table.insert(groups, { quests = { q }, prefixLen = 0 })
      end
    end
  end
  return groups
end

local function FormatSharedPrefixGroup(grp, fallbackLevel, fallbackZone, baseIndent, foldCompletedPrefix, foldZoneCtx)
  local quests = grp.quests
  local k = grp.prefixLen
  local q1 = quests[1]
  local prefixSteps = {}
  for idx = 1, k do
    table.insert(prefixSteps, q1.steps[idx])
  end
  local lastPre = prefixSteps[k]
  local q1Zone = (q1.zone and q1.zone ~= "") and q1.zone or fallbackZone
  local preZone = (lastPre.zone and lastPre.zone ~= "") and lastPre.zone or q1Zone
  local outLines = {}
  local maxPrefixDepth = 0
  local prefixHasVisibleStep = false

  if #prefixSteps == 1 then
    local st = prefixSteps[1]
    local sid = tonumber(st.id)
    local stepObj = {
      id = sid,
      faction = q1.faction,
      _navCtx = q1._navCtx,
      name = st.name or q1.name,
      level = st.level or q1.level or q1.minLevel or fallbackLevel,
      npc = (st.npc and st.npc ~= "") and st.npc or q1.npc,
      zone = preZone,
      place = (st.place and st.place ~= "") and st.place or q1.place,
      x = (st.x ~= nil) and st.x or q1.x,
      y = (st.y ~= nil) and st.y or q1.y,
      endNpc = st.endNpc,
      endZone = st.endZone,
      endX = st.endX,
      endY = st.endY,
    }
    local link = FormatQuestLink(stepObj, fallbackLevel, preZone, false)
    local npcPart = FormatStepNpcInfo(stepObj, preZone)
    local stepFoldKey = nil
    if foldCompletedPrefix and sid and IsQuestCompletedById(sid) and not IsQuestActiveById(sid) then
      stepFoldKey = GetQuestStepFoldKey(sid, q1.faction, foldZoneCtx)
    end
    if stepFoldKey and not IsQuestChainFoldExpanded(stepFoldKey) then
      table.insert(outLines, baseIndent .. string.format("|cff888888|Hwowfchain:%s|h[+]|h|r 已完成前置", stepFoldKey))
    else
      if stepFoldKey then
        table.insert(outLines, baseIndent .. string.format("|cff00ffcc|Hwowfchain:%s|h[-]|h|r 已完成前置", stepFoldKey))
      end
      table.insert(outLines, baseIndent .. link .. ((npcPart ~= "") and ("  " .. npcPart) or ""))
      prefixHasVisibleStep = true
    end
    maxPrefixDepth = 0
  else
    local prefixQuest = {
      _qdbResolved = true,
      id = lastPre.id,
      name = lastPre.name,
      faction = q1.faction,
      _navCtx = q1._navCtx,
      level = lastPre.level or q1.level,
      minLevel = q1.minLevel or fallbackLevel,
      npc = (lastPre.npc and lastPre.npc ~= "") and lastPre.npc or q1.npc,
      zone = preZone,
      place = (lastPre.place and lastPre.place ~= "") and lastPre.place or q1.place,
      x = (lastPre.x ~= nil) and lastPre.x or q1.x,
      y = (lastPre.y ~= nil) and lastPre.y or q1.y,
      steps = prefixSteps,
    }
    local prefixFoldKey = GetSharedPrefixFoldKey(lastPre.id, q1.faction, foldZoneCtx)
    local _, prefixTree = FormatQuestWithSteps(prefixQuest, q1.minLevel or fallbackLevel, q1Zone, baseIndent, foldCompletedPrefix, prefixFoldKey)
    if prefixTree and prefixTree ~= "" then
      local prefixVisibleLines = 0
      for line in string.gmatch(prefixTree, "[^\n]+") do
        table.insert(outLines, line)
        if not string.find(line, "|Hwowfchain:", 1, true) then
          prefixVisibleLines = prefixVisibleLines + 1
        end
        local leading = string.match(line, "^(%s*)") or ""
        local relDepth = math.floor(math.max(0, #leading - #baseIndent) / 2)
        if string.find(line, "└>", 1, true) then
          relDepth = relDepth + 1
        end
        if relDepth > maxPrefixDepth then maxPrefixDepth = relDepth end
      end
      prefixHasVisibleStep = prefixVisibleLines > 0
    end
  end

  local branchBaseDepth = prefixHasVisibleStep and (maxPrefixDepth + 1) or 0
  for _, bq in ipairs(quests) do
    local bDone = IsQuestCompleted(bq)
    local bZone = (bq.zone and bq.zone ~= "") and bq.zone or fallbackZone
    local bPrimaryId = tonumber(bq.id or bq.questId)
    local suffixEntries = {}
    for si = k + 1, #bq.steps do
      local st = bq.steps[si]
      local sid = tonumber(st.id)
      if sid and sid > 0 then
        local stZone = (st.zone and st.zone ~= "") and st.zone or bZone
        local isPrimary = (sid == bPrimaryId)
        local stepObj = {
          id = sid,
          faction = bq.faction,
          _navCtx = bq._navCtx,
          name = st.name or bq.name,
          level = st.level or bq.level or bq.minLevel or fallbackLevel,
          npc = (st.npc and st.npc ~= "") and st.npc or (isPrimary and bq.npc or ""),
          zone = stZone,
          place = (st.place and st.place ~= "") and st.place or (isPrimary and bq.place or ""),
          x = st.x or (isPrimary and bq.x or nil),
          y = st.y or (isPrimary and bq.y or nil),
          endNpc = st.endNpc,
          endZone = st.endZone,
          endX = st.endX,
          endY = st.endY,
        }
        local link = FormatQuestLink(stepObj, fallbackLevel, stZone, bDone)
        local coloredLink = isPrimary and link or ("|cff99e6ff" .. link .. "|r")
        local npcPart = FormatStepNpcInfo(stepObj, stZone)
        table.insert(suffixEntries, { id = sid, step = st, link = coloredLink, npcInfo = npcPart })
      end
    end

    -- 共享前缀之后，每一条分支自身的开头连续已完成步骤也默认折叠
    local branchFoldCount = foldCompletedPrefix and CountLeadingCompletedChainSteps(suffixEntries) or 0
    local branchFoldKey = nil
    local branchFolded = false
    if branchFoldCount > 0 then
      branchFoldKey = GetQuestChainFoldKey(bq, foldZoneCtx)
      branchFolded = branchFoldKey ~= nil and not IsQuestChainFoldExpanded(branchFoldKey)
    end
    local startIdx = branchFolded and (branchFoldCount + 1) or 1
    if branchFoldCount > 0 and branchFoldKey then
      local marker
      if branchFolded then
        marker = string.format("|cff888888|Hwowfchain:%s|h[+]|h|r 已完成前 %d 步", branchFoldKey, branchFoldCount)
      else
        marker = string.format("|cff00ffcc|Hwowfchain:%s|h[-]|h|r 已完成前 %d 步", branchFoldKey, branchFoldCount)
      end
      table.insert(outLines, FormatStepTreeIndent(baseIndent, branchBaseDepth) .. marker)
    end
    for idx = startIdx, #suffixEntries do
      local ent = suffixEntries[idx]
      local d = branchBaseDepth + (idx - startIdx)
      table.insert(outLines, FormatStepTreeIndent(baseIndent, d) .. ent.link .. ((ent.npcInfo ~= "") and ("  " .. ent.npcInfo) or ""))
    end
  end
  return "", table.concat(outLines, "\n")
end

local function GetDungeonByIdOrName(id, name)
  for _, d in ipairs(Data.dungeons or {}) do
    if (id and d.id == id) or (name and d.name == name) then
      return d
    end
  end
  return nil
end

local copyDialog
local function ShowCopyMacroDialog(macroTitle, macroCode)
  if not copyDialog then
    local template = BackdropTemplateMixin and "BackdropTemplate" or nil
    copyDialog = CreateFrame("Frame", "WoWFCopyMacroDialog", UIParent, template)
    copyDialog:SetSize(420, 210)
    copyDialog:SetPoint("CENTER")
    copyDialog:SetFrameStrata("DIALOG")
    copyDialog:EnableMouse(true)
    copyDialog:SetMovable(true)
    copyDialog:RegisterForDrag("LeftButton")
    copyDialog:SetScript("OnDragStart", copyDialog.StartMoving)
    copyDialog:SetScript("OnDragStop", copyDialog.StopMovingOrSizing)
    if copyDialog.SetBackdrop then
      copyDialog:SetBackdrop({
        bgFile = "Interface\\Buttons\\WHITE8x8",
        edgeFile = "Interface\\Tooltips\\UI-Tooltip-Border",
        tile = true, tileSize = 16, edgeSize = 14,
        insets = { left = 3, right = 3, top = 3, bottom = 3 },
      })
      copyDialog:SetBackdropColor(0.06, 0.08, 0.11, 0.97)
      copyDialog:SetBackdropBorderColor(0.0, 0.85, 0.7, 0.9)
    end

    copyDialog.title = copyDialog:CreateFontString(nil, "OVERLAY", "GameFontNormalLarge")
    copyDialog.title:SetPoint("TOPLEFT", 14, -12)

    local hint = copyDialog:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
    hint:SetPoint("TOPLEFT", 14, -34)
    hint:SetText("|cff99e6ff按 Ctrl+C 复制已选中的文本：|r")

    local editBg = CreateFrame("Frame", nil, copyDialog, template)
    editBg:SetPoint("TOPLEFT", 14, -54)
    editBg:SetPoint("BOTTOMRIGHT", -14, 44)
    if editBg.SetBackdrop then
      editBg:SetBackdrop({
        bgFile = "Interface\\Buttons\\WHITE8x8",
        edgeFile = "Interface\\Tooltips\\UI-Tooltip-Border",
        tile = true, tileSize = 8, edgeSize = 10,
        insets = { left = 2, right = 2, top = 2, bottom = 2 },
      })
      editBg:SetBackdropColor(0.02, 0.03, 0.04, 0.95)
      editBg:SetBackdropBorderColor(0.3, 0.4, 0.5, 0.8)
    end

    local eb = CreateFrame("EditBox", nil, editBg)
    eb:SetMultiLine(true)
    eb:SetMaxLetters(1024)
    eb:SetFontObject(ChatFontNormal)
    eb:SetPoint("TOPLEFT", 8, -8)
    eb:SetPoint("BOTTOMRIGHT", -8, 8)
    eb:SetAutoFocus(true)
    eb:SetScript("OnEscapePressed", function() copyDialog:Hide() end)
    copyDialog.editBox = eb

    local closeBtn = CreateFrame("Button", nil, copyDialog, "UIPanelButtonTemplate")
    closeBtn:SetSize(90, 24)
    closeBtn:SetPoint("BOTTOMRIGHT", -14, 12)
    closeBtn:SetText("关闭")
    closeBtn:SetScript("OnClick", function() copyDialog:Hide() end)
  end

  copyDialog.title:SetText("|cff00ffcc宏命令:|r " .. (macroTitle or ""))
  copyDialog.editBox:SetText(macroCode or "")
  copyDialog:Show()
  copyDialog.editBox:HighlightText()
  copyDialog.editBox:SetFocus()
end

local function CreateOrUpdateGameMacro(macroTitle, macroCode)
  if InCombatLockdown and InCombatLockdown() then
    DEFAULT_CHAT_FRAME:AddMessage("|cffff4444[巫妖王的无限百科]|r 战斗中无法直接创建宏，已为您打开复制窗口！")
    ShowCopyMacroDialog(macroTitle, macroCode)
    return
  end

  local shortName = string.sub(macroTitle or "WoWF宏", 1, 15)
  if CreateMacro and GetMacroIndexByName then
    local existingIdx = GetMacroIndexByName(shortName)
    if existingIdx and existingIdx > 0 then
      if EditMacro then
        EditMacro(existingIdx, shortName, "INV_Misc_QuestionMark", macroCode, 1, 1)
        DEFAULT_CHAT_FRAME:AddMessage("|cff00ffcc[巫妖王的无限百科]|r 已更新现有宏: |cffffd100[" .. shortName .. "]|r (输入 /macro 查看)")
        return
      end
    else
      local numGlobal, numChar = 0, 0
      if GetNumMacros then
        numGlobal, numChar = GetNumMacros()
      end
      local perChar = (numChar and numChar < 18) and 1 or nil
      local ok, idx = pcall(CreateMacro, shortName, "INV_Misc_QuestionMark", macroCode, perChar)
      if ok and idx then
        DEFAULT_CHAT_FRAME:AddMessage("|cff00ffcc[巫妖王的无限百科]|r 已一键创建游戏内宏: |cffffd100[" .. shortName .. "]|r (输入 /macro 拖到技能栏即可使用)")
        return
      end
    end
  end

  ShowCopyMacroDialog(macroTitle, macroCode)
end

-- ============================================================================
-- 3. 数据智能匹配查询引擎
-- ============================================================================

local function GetCurrentRoute()
  local routes = Data.routes or {}
  if routes[state.routeId] then
    return routes[state.routeId]
  end
  if routes["human"] then
    return routes["human"]
  end
  local _, fallbackRoute = next(routes)
  return fallbackRoute
end

local function GetCurrentClassData()
  local classes = Data.classes or {}
  return classes[state.classKey] or classes["WARRIOR"]
end

local function GetCurrentSpecData()
  local cls = GetCurrentClassData()
  if not cls or not cls.specs then return nil end
  return cls.specs[state.specIndex] or cls.specs[1]
end

local function GetMatchedBand(route, level)
  if not route or not route.bands then return nil end
  for _, b in ipairs(route.bands) do
    if level >= (b.from or 1) and level <= (b.to or 60) then
      return b
    end
  end
  return route.bands[#route.bands]
end

local function GetMatchedPhase(spec, level)
  if not spec or not spec.phases then return nil end
  for _, p in ipairs(spec.phases) do
    if level >= (p.from or 1) and level <= (p.to or 60) then
      return p
    end
  end
  return spec.phases[#spec.phases]
end

local function GetMatchedDungeonTip(spec, level)
  if not spec or not spec.dungeonTips then return nil end
  for _, d in ipairs(spec.dungeonTips) do
    if level >= (d.from or 1) and level <= (d.to or 60) then
      return d
    end
  end
  return nil
end

local function GetMatchedTalentStep(spec, level)
  if not spec or not spec.steps then return nil end
  for _, s in ipairs(spec.steps) do
    if s.level == level then
      return s
    end
  end
  return nil
end

local function GetMatchedDungeons(level, includeCompleted)
  local list = {}
  for _, d in ipairs(Data.dungeons or {}) do
    if level >= (d.minLevel - 3) and level <= (d.maxLevel + 3) then
      if includeCompleted or not IsDungeonAllQuestsCompleted(d, state.faction) then
        table.insert(list, d)
      end
    end
  end
  return list
end

local function GetBandTrainer(band, classKey, faction)
  if not band then return nil end
  local ck = classKey or state.classKey or "WARRIOR"
  if band.trainersByClass and band.trainersByClass[ck] and band.trainersByClass[ck].name ~= "" then
    return band.trainersByClass[ck]
  end
  -- 1. 先在当前种族路线的同一区域 (band.zone) 相邻阶段中查找（离开 1-5 新手谷后优先匹配城镇训练师）
  local curRoute = GetCurrentRoute()
  if curRoute and curRoute.bands then
    local bestTrainer = nil
    local bestDist = 999
    local refLvl = state.level or band.from or 1
    for _, ob in ipairs(curRoute.bands) do
      if ob.zone == band.zone and ob.trainersByClass and ob.trainersByClass[ck] and ob.trainersByClass[ck].name ~= "" then
        local mid = ((ob.from or 1) + (ob.to or 60)) / 2
        local dist = math.abs(mid - refLvl)
        if (band.from or 1) >= 5 and (ob.to or 60) <= 5 then
          dist = dist + 20
        end
        if dist < bestDist then
          bestDist = dist
          bestTrainer = ob.trainersByClass[ck]
        end
      end
    end
    if bestTrainer then
      return bestTrainer
    end
  end
  -- 2. 若当前种族默认未收录该职业训练师，从同阵营其他种族相同区域阶段中查找该职业训练师
  local targetFaction = faction or state.faction or "alliance"
  for _, rObj in pairs(Data.routes or {}) do
    if rObj and rObj.faction == targetFaction and rObj.bands then
      for _, ob in ipairs(rObj.bands) do
        if ob.zone == band.zone and ob.trainersByClass and ob.trainersByClass[ck] and ob.trainersByClass[ck].name ~= "" then
          return ob.trainersByClass[ck]
        end
      end
    end
  end
  if band.trainer and band.trainer.name ~= "" then
    if ck == "WARRIOR" or string.find(band.trainer.title or "", "全职业", 1, true) then
      return band.trainer
    end
  end
  return nil
end

local function GetBandQuests(band, classKey)
  if not band then return {} end
  local ck = classKey or state.classKey or "WARRIOR"
  if band.questsByClass and band.questsByClass[ck] and #band.questsByClass[ck] > 0 then
    return band.questsByClass[ck]
  end
  return band.quests or {}
end

local function GetCurrentClassRuns(route, cls, faction)
  local r = route or GetCurrentRoute()
  local c = cls or GetCurrentClassData()
  local ck = state.classKey or "WARRIOR"
  local f = faction or state.faction or "alliance"

  if r and r.classRunsByClass and r.classRunsByClass[ck] and #r.classRunsByClass[ck] > 0 then
    return r.classRunsByClass[ck]
  end
  local fallback = {}
  local anyFactionFallback = {}
  if c and c.classRuns then
    for _, cr in ipairs(c.classRuns) do
      if cr.faction == f or cr.faction == "both" then
        if not cr.raceId or cr.raceId == state.routeId then
          table.insert(fallback, cr)
        end
        table.insert(anyFactionFallback, cr)
      end
    end
  end
  if #fallback > 0 then
    return fallback
  end
  return anyFactionFallback
end

local function GetBandTimelineSteps(route, fromLvl, toLvl)
  local r = route or GetCurrentRoute()
  if not r or not r.timelineSteps then return {} end
  local steps = {}
  for _, st in ipairs(r.timelineSteps) do
    local lv = st.level or 1
    if lv >= (fromLvl or 1) and lv <= (toLvl or 60) then
      table.insert(steps, st)
    end
  end
  return steps
end

-- 汇总本阶段全部适龄区域（主区域 + altZones），统一去重，供区域块与概览行共用
local function CollectBandZoneNames(band)
  if not band then return {} end
  local names, seen = {}, {}
  if band.zone and band.zone ~= "" then
    seen[band.zone] = true
    table.insert(names, band.zone)
  end
  for _, az in ipairs(band.altZones or {}) do
    if az.zone and az.zone ~= "" and not seen[az.zone] then
      seen[az.zone] = true
      table.insert(names, az.zone)
    end
  end
  return names
end

-- 区域块：每行一个适龄区域（区域名 + 营地链接 + 等级区间 + 备注）
local function FormatBandZonesBlock(band, headerLabel)
  if not band then return nil end
  if not band.altZones or #band.altZones == 0 then
    return nil
  end
  local function zoneLine(zoneName, hubName, hubX, hubY, from, to, note)
    local hasCoord = (hubX and hubY) and true or false
    local label = (hubName and hubName ~= "") and hubName or ""
    -- 营地名与区域名相同时不再重复输出营地名，但坐标仍然可用：把可点击链接挂到区域名本身，
    -- 这样精简后不会丢掉「点区域名定位」的能力（否则只剩一段不可点的彩色文字）。
    local sameAsZone = (label == (zoneName or ""))
    local zoneLink = hasCoord
      and FormatNpcMapLink(zoneName, zoneName or "", hubX, hubY, { omitZone = true })
      or ("|cff00ffcc" .. (zoneName or "") .. "|r")
    local hubPart = ""
    if label ~= "" and not sameAsZone then
      hubPart = (hasCoord
        and FormatNpcMapLink(zoneName, label, hubX, hubY, { omitZone = true })
        or ("|cff00ffcc" .. label .. "|r")) .. " "
    end
    local noteAnchor = (label ~= "" and not sameAsZone) and label or (zoneName or "")
    local noteStr = (note and note ~= "") and (" — " .. LinkifyInlineCoords(note, zoneName or "", noteAnchor)) or ""
    return string.format("  · %s (%sLv.%d-%d)%s", zoneLink, hubPart, from or 1, to or 60, noteStr)
  end
  local zoneLines = {
    zoneLine(band.zone, (band.hub and band.hub.name) or "", band.hub and band.hub.x, band.hub and band.hub.y,
      band.from, band.to, nil)
  }
  for _, az in ipairs(band.altZones or {}) do
    table.insert(zoneLines, zoneLine(az.zone, az.hub, az.x, az.y,
      az.from or band.from, az.to or band.to, az.note))
  end
  return string.format("|cffffd100%s:|r\n%s", headerLabel or "适龄练级区域 (可自由切换/穿插)", table.concat(zoneLines, "\n"))
end

local ROUTE_RACE_BIT = {
  ["human"] = 1,
  ["orc"] = 2,
  ["dwarf"] = 4,
  ["night-elf"] = 8,
  ["undead"] = 16,
  ["tauren"] = 32,
  ["gnome"] = 64,
  ["troll"] = 128,
  ["skyborne-alliance"] = 4294967296,
  ["skyborne-horde"] = 8589934592,
}

local function MatchesQuestRace(q)
  local mask = tonumber(q and q.r)
  if not mask or mask <= 0 then return true end
  local raceBit = ROUTE_RACE_BIT[state.routeId]
  if not raceBit then return true end
  return math.floor(mask / raceBit) % 2 == 1
end

local zoneQuestObjPool = {}
local function GetZoneQuestPool(zoneName)
  local cleanName = tostring(zoneName or ""):gsub("%s*%([^)]*%)%s*$", "")
  if cleanName == "" or not Data.zoneQuests then return nil end
  if zoneQuestObjPool[cleanName] then return zoneQuestObjPool[cleanName] end
  local rawList = Data.zoneQuests[cleanName]
  if type(rawList) ~= "table" then return nil end
  local pool = {}
  for _, raw in ipairs(rawList) do
    local fStr = (raw.f == "a" and "alliance") or (raw.f == "h" and "horde") or "both"
    table.insert(pool, {
      id = raw.id,
      faction = fStr,
      r = raw.r,
      min = raw.min or 1,
      lv = raw.lv or 1,
      maxLv = raw.maxLv or raw.lv or 1,
      minLevel = raw.min or 1,
      level = raw.lv or 1,
    })
  end
  zoneQuestObjPool[cleanName] = pool
  return pool
end

local function IsQuestEligibleForZoneChain(qid)
  local id = tonumber(qid)
  if not id or id <= 0 or not _G.QuestDB then return true end
  local reqCls = _G.QuestDB.requiredClasses and _G.QuestDB.requiredClasses(id)
  if type(reqCls) == "number" and reqCls > 0 then return false end
  local reqSkill = _G.QuestDB.requiredSkill and _G.QuestDB.requiredSkill(id)
  if type(reqSkill) == "table" and tonumber(reqSkill[1]) and tonumber(reqSkill[1]) > 0 then return false end
  local reqSpec = _G.QuestDB.requiredSpecialization and _G.QuestDB.requiredSpecialization(id)
  if type(reqSpec) == "number" and reqSpec > 0 then return false end
  local reqRanks = _G.QuestDB.requiredRanks and _G.QuestDB.requiredRanks(id)
  if type(reqRanks) == "table" and #reqRanks > 0 then return false end
  local sFlags = _G.QuestDB.specialFlags and _G.QuestDB.specialFlags(id)
  if type(sFlags) == "number" and bit and bit.band and bit.band(sFlags, 1) ~= 0 then return false end
  local reqRaces = _G.QuestDB.requiredRaces and _G.QuestDB.requiredRaces(id)
  if type(reqRaces) == "number" and reqRaces > 0 then
    if not MatchesQuestRace({ r = reqRaces }) then return false end
  end
  return true
end

local function IsGroupPrereqItemSatisfied(pid)
  local numPid = tonumber(pid)
  if not numPid or numPid == 0 then return true end
  local absId = math.abs(numPid)
  if IsQuestCompletedById(absId) then return true end
  if numPid > 0 and _G.QuestDB and _G.QuestDB.exclusiveTo then
    local ex = _G.QuestDB.exclusiveTo(absId)
    if type(ex) == "table" then
      for _, eid in ipairs(ex) do
        if IsQuestCompletedById(eid) then return true end
      end
    end
  end
  return false
end

local function IsZoneStepUnlocked(st)
  if not st or not st.id then return false end
  local sid = tonumber(st.id)
  if IsQuestActiveById(sid) then return true end
  if _G.QuestDB and _G.QuestDB.disabledByQuest then
    local disQid = _G.QuestDB.disabledByQuest(sid)
    if type(disQid) == "number" and disQid > 0 and IsQuestActiveById(disQid) then
      return false
    end
  end
  if _G.QuestDB and _G.QuestDB.parentQuest then
    local parentId = _G.QuestDB.parentQuest(sid)
    if type(parentId) == "number" and parentId > 0 and not IsQuestActiveById(parentId) then
      return false
    end
  end
  if _G.QuestDB and _G.QuestDB.nextQuestInChain then
    local nextQ = _G.QuestDB.nextQuestInChain(sid)
    if type(nextQ) == "number" and nextQ > 0 and (IsQuestCompletedById(nextQ) or IsQuestActiveById(nextQ)) then
      return false
    end
  end
  if _G.QuestDB and _G.QuestDB.breadcrumbForQuestId then
    local targetQid = _G.QuestDB.breadcrumbForQuestId(sid)
    if type(targetQid) == "number" and targetQid > 0 and (IsQuestCompletedById(targetQid) or IsQuestActiveById(targetQid)) then
      return false
    end
  end
  if _G.QuestDB and _G.QuestDB.breadcrumbs then
    local bcs = _G.QuestDB.breadcrumbs(sid)
    if type(bcs) == "table" then
      for _, bcId in ipairs(bcs) do
        if IsQuestActiveById(bcId) then
          return false
        end
      end
    end
  end
  if _G.QuestDB and _G.QuestDB.availableUntilCompleted then
    local closingQid = _G.QuestDB.availableUntilCompleted(sid)
    if type(closingQid) == "number" and closingQid > 0 and IsQuestCompletedById(closingQid) then
      return false
    end
  end
  if _G.QuestDB and _G.QuestDB.exclusiveTo then
    local ex = _G.QuestDB.exclusiveTo(sid)
    if type(ex) == "table" then
      for _, eid in ipairs(ex) do
        if IsQuestCompletedById(eid) or IsQuestActiveById(eid) then
          return false
        end
      end
    end
  end
  if _G.QuestDB then
    local function getRepStanding(fid)
      if GetFactionInfoByID then
        local ok, _, _, _, _, _, barValue = pcall(GetFactionInfoByID, fid)
        if ok and type(barValue) == "number" then return barValue end
      elseif C_Reputation and C_Reputation.GetFactionDataByID then
        local ok, data = pcall(C_Reputation.GetFactionDataByID, fid)
        if ok and type(data) == "table" and type(data.currentStanding) == "number" then
          return data.currentStanding
        end
      end
      return nil
    end
    local reqMinRep = _G.QuestDB.requiredMinRep and _G.QuestDB.requiredMinRep(sid)
    if type(reqMinRep) == "table" and tonumber(reqMinRep[1]) and tonumber(reqMinRep[2]) then
      local barValue = getRepStanding(tonumber(reqMinRep[1]))
      if type(barValue) ~= "number" or barValue < tonumber(reqMinRep[2]) then
        return false
      end
    end
    local reqMaxRep = _G.QuestDB.requiredMaxRep and _G.QuestDB.requiredMaxRep(sid)
    if type(reqMaxRep) == "table" and tonumber(reqMaxRep[1]) and tonumber(reqMaxRep[2]) then
      local barValue = getRepStanding(tonumber(reqMaxRep[1]))
      if type(barValue) ~= "number" or barValue >= tonumber(reqMaxRep[2]) then
        return false
      end
    end
  end
  if _G.QuestDB and _G.QuestDB.startedBy then
    local started = _G.QuestDB.startedBy(sid)
    local getItemCount = GetItemCount or (C_Item and C_Item.GetItemCount)
    if type(started) == "table"
      and (type(started[1]) ~= "table" or #started[1] == 0)
      and (type(started[2]) ~= "table" or #started[2] == 0)
      and type(started[3]) == "table" and #started[3] > 0
      and getItemCount then
      local hasStarterItem = false
      for _, itemId in ipairs(started[3]) do
        local ok, cnt = pcall(getItemCount, tonumber(itemId))
        if ok and type(cnt) == "number" and cnt > 0 then
          hasStarterItem = true
          break
        end
      end
      if not hasStarterItem then
        return false
      end
    end
  end
  if _G.QuestDB then
    local preG = _G.QuestDB.preQuestGroup and _G.QuestDB.preQuestGroup(sid)
    if type(preG) == "table" and #preG > 0 then
      for _, pid in ipairs(preG) do
        if not IsGroupPrereqItemSatisfied(pid) then return false end
      end
    end
    local preS = _G.QuestDB.preQuestSingle and _G.QuestDB.preQuestSingle(sid)
    if type(preS) == "table" and #preS > 0 then
      local anyDone = false
      for _, pid in ipairs(preS) do
        if IsQuestCompletedById(pid) then
          anyDone = true
          break
        end
      end
      if not anyDone then return false end
    end
    local startWith = _G.QuestDB.availableStartingWith and _G.QuestDB.availableStartingWith(sid)
    if type(startWith) == "number" and startWith > 0
      and not (IsQuestActiveById(startWith) or IsQuestCompletedById(startWith)) then
      return false
    end
    return true
  end
  if type(st.reqAll) == "table" and #st.reqAll > 0 then
    for _, pid in ipairs(st.reqAll) do
      if not IsGroupPrereqItemSatisfied(pid) then return false end
    end
  elseif st.preId then
    if not IsQuestCompletedById(st.preId) then return false end
  end
  return true
end

local function CloneZoneQuestCandidate(q)
  local copy = {}
  for k, v in pairs(q) do
    if k ~= "steps" then copy[k] = v end
  end
  copy._originId = tonumber(q.id or q.questId)
  if type(q.steps) == "table" and #q.steps > 0 then
    local ineligibleIds = {}
    local blockingIneligibleIds = {}
    for _, st in ipairs(q.steps) do
      local sid = tonumber(st and st.id)
      if not sid or not IsQuestEligibleForZoneChain(sid) then
        if sid then
          ineligibleIds[sid] = true
          if not IsQuestCompletedById(sid) then
            blockingIneligibleIds[sid] = true
          end
        end
      end
    end
    -- 仅沿未完成的不可接前置传播阻塞标记；已完成的不展示前置不再阻断后续步骤
    local changed = true
    while changed do
      changed = false
      for _, st in ipairs(q.steps) do
        local sid = tonumber(st and st.id)
        if sid and not ineligibleIds[sid] then
          local blocked = false
          if st.preId and blockingIneligibleIds[tonumber(st.preId)] and not IsGroupPrereqItemSatisfied(st.preId) then
            blocked = true
          elseif type(st.reqAll) == "table" then
            for _, pid in ipairs(st.reqAll) do
              local absPid = math.abs(tonumber(pid) or 0)
              if blockingIneligibleIds[absPid] and not IsGroupPrereqItemSatisfied(pid) then
                blocked = true
                break
              end
            end
          end
          if blocked then
            ineligibleIds[sid] = true
            if not IsQuestCompletedById(sid) then
              blockingIneligibleIds[sid] = true
            end
            changed = true
          end
        end
      end
    end
    local kept = {}
    for _, st in ipairs(q.steps) do
      local sid = tonumber(st and st.id)
      if sid and not ineligibleIds[sid] then
        table.insert(kept, st)
      end
    end
    copy.steps = kept
    copy.stepCount = #kept
    if #kept == 0 then
      copy._zoneIneligible = true
    elseif #kept < #q.steps then
      local lastKept = kept[#kept]
      if lastKept then
        copy.id = lastKept.id
        copy.name = lastKept.name or copy.name
        copy.level = lastKept.level or copy.level
        copy.minLevel = lastKept.minLevel or copy.minLevel
        copy.npc = lastKept.npc
        copy.zone = lastKept.zone
        copy.place = lastKept.place
        copy.x = lastKept.x
        copy.y = lastKept.y
      end
    end
  elseif not IsQuestEligibleForZoneChain(q.id) then
    copy._zoneIneligible = true
  end
  return copy
end

-- 判断任务名是否包含非 ASCII 字符（中文/韩文/俄文等本地化名称）。
-- 中文客户端里，客户端已不存在的任务只能回落到 QuestieDB 的英文名，
-- 这类记录往往是原版任务与无限服替换任务并存造成的重复项（如 1203 / 81570「加尔的剑」）。
local function QuestNameHasLocalizedText(name)
  if type(name) ~= "string" or name == "" then return false end
  for i = 1, #name do
    if string.byte(name, i) >= 128 then return true end
  end
  return false
end

-- 区域任务链去重：同一任务在 QuestieDB 中可能同时存在互斥的原版与无限服替换版。
-- 仅当两条记录发布者、任务等级、区域完全一致，且只有一条能取到本地化名称时，
-- 才丢弃无法本地化的那一条，避免误伤真正的互斥分支（如二选一任务）。
local function PruneExclusiveDuplicateCandidates(candidates)
  if type(candidates) ~= "table" or #candidates == 0 then return candidates end
  local locale = (GetLocale and GetLocale()) or ""
  if type(locale) ~= "string" or not string.find(string.lower(locale), "zh", 1, true) then
    return candidates
  end
  if not _G.QuestDB or not _G.QuestDB.exclusiveTo then return candidates end
  local byId = {}
  for _, cand in ipairs(candidates) do
    local cid = tonumber(cand.id or cand.questId)
    if cid then byId[cid] = cand end
  end
  if next(byId) == nil then return candidates end

  local drop = {}
  for cid in pairs(byId) do
    if not drop[cid] then
      local ex = _G.QuestDB.exclusiveTo(cid)
      if type(ex) == "table" then
        for _, rawEid in ipairs(ex) do
          local eid = tonumber(rawEid)
          if eid and byId[eid] and not drop[eid] then
            local infoA = GetQuestieQuestInfo(cid)
            local infoB = GetQuestieQuestInfo(eid)
            if infoA and infoB then
              local locA = QuestNameHasLocalizedText(infoA.name)
              local locB = QuestNameHasLocalizedText(infoB.name)
              if locA ~= locB
                and type(infoA.level) == "number" and type(infoB.level) == "number"
                and type(infoA.minLevel) == "number" and type(infoB.minLevel) == "number"
                and (infoA.npc or "") ~= "" and (infoA.npc or "") == (infoB.npc or "")
                and infoA.level == infoB.level
                and infoA.minLevel == infoB.minLevel
                and (infoA.zone or "") ~= "" and (infoA.zone or "") == (infoB.zone or "") then
                if locA then drop[eid] = true else drop[cid] = true end
                break
              end
            end
          end
        end
      end
    end
  end
  if next(drop) == nil then return candidates end

  local kept = {}
  for _, cand in ipairs(candidates) do
    local cid = tonumber(cand.id or cand.questId)
    if not (cid and drop[cid]) then table.insert(kept, cand) end
  end
  return kept
end

local function GetZoneSuitableQuestChains(zoneName, lvl)
  local pool = GetZoneQuestPool(zoneName)
  if not pool or #pool == 0 then return {} end
  local minOkLv = math.max(1, (lvl or 1) - 7)
  local maxOkLv = (lvl or 1) + 5
  local candidates = {}

  local bundledQdbVer = Data.meta and Data.meta.questieDbVersion
  local clientQdbVer = (GetAddOnMetadata and GetAddOnMetadata("QuestieDB", "Version"))
    or (C_AddOns and C_AddOns.GetAddOnMetadata and C_AddOns.GetAddOnMetadata("QuestieDB", "Version"))
  local sameQuestieDbVersion = (type(bundledQdbVer) == "string" and bundledQdbVer ~= "" and clientQdbVer == bundledQdbVer)
  local iterPool = pool
  if not sameQuestieDbVersion then
    local cleanZoneKey = tostring(zoneName or ""):gsub("%s*%([^)]*%)%s*$", "")
    local coveredPool = Data.zoneCoveredIds and Data.zoneCoveredIds[cleanZoneKey]
    if type(coveredPool) == "table" and #coveredPool > 0 then
      iterPool = {}
      for _, q in ipairs(pool) do table.insert(iterPool, q) end
      for _, cid in ipairs(coveredPool) do table.insert(iterPool, { id = cid }) end
    end
  end

  for _, q in ipairs(iterPool) do
    local preFilterOk = false
    if GetQuestieQuestInfo(q.id) ~= nil then
      if sameQuestieDbVersion then
        local factionOk = (q.faction == "both" or q.faction == state.faction)
        preFilterOk = factionOk and MatchesQuestRace(q) and q.min <= lvl and q.maxLv >= minOkLv
      else
        local liveRaces = _G.QuestDB and _G.QuestDB.requiredRaces and _G.QuestDB.requiredRaces(q.id)
        preFilterOk = (type(liveRaces) ~= "number" or liveRaces <= 0 or MatchesQuestRace({ r = liveRaces }))
      end
    end
    if preFilterOk then
      ResolveQuestChainFromQuestieDB(q)
      local cand = CloneZoneQuestCandidate(q)

      if not cand._zoneIneligible then
        local cleanZone = tostring(zoneName or ""):gsub("%s*%([^)]*%)%s*$", "")
        local areaSet = {}
        local areaList = Data.zoneAreaIds and Data.zoneAreaIds[cleanZone]
        if type(areaList) == "table" then
          for _, aid in ipairs(areaList) do areaSet[aid] = true end
        end
        local matchedStep = nil
        local matchedStarter = nil
        local acceptLv = nil
        local function checkStepInZone(stObj, curMin, curLv)
          if type(curMin) ~= "number" or type(curLv) ~= "number" or curMin > lvl or curLv < minOkLv or curLv > maxOkLv then
            return false
          end
          local mId = tonumber(stObj and stObj.id)
          if mId and not IsQuestActiveById(mId) and _G.QuestDB and _G.QuestDB.requiredMaxLevel then
            local maxReqLv = _G.QuestDB.requiredMaxLevel(mId)
            if type(maxReqLv) == "number" and maxReqLv > 0 and lvl > maxReqLv then
              return false
            end
          end
          local started = mId and _G.QuestDB and _G.QuestDB.startedBy and _G.QuestDB.startedBy(mId)
          local npcStarter = started and ResolveQuestieNpc(started[1], areaSet) or nil
          local objStarter = started and ResolveQuestieObject(started[2], areaSet) or nil
          local npcInZone = npcStarter and npcStarter.areaId and areaSet[npcStarter.areaId]
          local objInZone = objStarter and objStarter.areaId and areaSet[objStarter.areaId]
          local zoneStarter = (npcInZone and npcStarter) or (objInZone and objStarter) or npcStarter or objStarter
          local starterInZone = npcInZone or objInZone
          local hasAnyStarterArea = (npcStarter and npcStarter.areaId ~= nil) or (objStarter and objStarter.areaId ~= nil)
          local inThisZone = starterInZone or (not hasAnyStarterArea)
          if not inThisZone then
            return false
          end
          matchedStep = stObj
          if starterInZone and zoneStarter then
            local validCoords = type(zoneStarter.x) == "number" and type(zoneStarter.y) == "number" and zoneStarter.x >= 0 and zoneStarter.y >= 0
            matchedStarter = {
              npc = zoneStarter.npc,
              zone = cleanZone,
              areaId = zoneStarter.areaId,
              x = validCoords and zoneStarter.x or nil,
              y = validCoords and zoneStarter.y or nil,
            }
          elseif not hasAnyStarterArea and started and type(started[3]) == "table" and #started[3] > 0 then
            local getItemCount = GetItemCount or (C_Item and C_Item.GetItemCount)
            local pickedItemId = nil
            if getItemCount then
              for _, itemId in ipairs(started[3]) do
                local ok, cnt = pcall(getItemCount, tonumber(itemId))
                if ok and type(cnt) == "number" and cnt > 0 then
                  pickedItemId = tonumber(itemId)
                  break
                end
              end
            end
            if pickedItemId then
              local itemName = (_G.ItemDB and _G.ItemDB.name and _G.ItemDB.name(pickedItemId)) or (GetItemInfo and GetItemInfo(pickedItemId)) or ("物品 #" .. pickedItemId)
              matchedStarter = {
                npc = "[物品] " .. itemName,
                zone = cleanZone,
                areaId = nil,
                x = nil,
                y = nil,
              }
            else
              matchedStarter = nil
            end
          else
            matchedStarter = nil
          end
          acceptLv = curMin
          return true
        end

        if type(cand.steps) == "table" and #cand.steps > 0 then
          for _, st in ipairs(cand.steps) do
            local sid = tonumber(st and st.id)
            if sid and sid > 0 and not IsQuestCompletedById(sid) and IsZoneStepUnlocked(st) then
              local stInfo = GetQuestieQuestInfo(sid)
              local curMin = (stInfo and stInfo.minLevel) or st.level or cand.min
              local curLv = (stInfo and stInfo.level) or st.level or cand.lv
              if checkStepInZone(st, curMin, curLv) then
                break
              end
            end
          end
        elseif not IsQuestCompleted(cand) then
          if IsZoneStepUnlocked({ id = cand.id }) then
            local curMin = cand.minLevel or cand.min
            local curLv = cand.level or cand.lv
            checkStepInZone(cand, curMin, curLv)
          end
        end

        if matchedStep then
          if matchedStarter then
            local msNpc = matchedStarter.npc or ""
            local msZone = (matchedStarter.zone and matchedStarter.zone ~= "") and matchedStarter.zone or cleanZone
            if type(cand.steps) == "table" and #cand.steps > 0 then
              local newSteps = {}
              for _, st in ipairs(cand.steps) do
                if st == matchedStep then
                  local stCopy = {}
                  for k, v in pairs(st) do stCopy[k] = v end
                  if msNpc ~= "" then stCopy.npc = msNpc end
                  stCopy.zone = msZone
                  stCopy.x = matchedStarter.x
                  stCopy.y = matchedStarter.y
                  matchedStep = stCopy
                  table.insert(newSteps, stCopy)
                else
                  table.insert(newSteps, st)
                end
              end
              cand.steps = newSteps
            end
            if cand == matchedStep or (tonumber(cand.id) == tonumber(matchedStep.id)) then
              if msNpc ~= "" then cand.npc = msNpc end
              cand.zone = msZone
              cand.x = matchedStarter.x
              cand.y = matchedStarter.y
            end
          end
          local chainNavCtx = cleanZone .. "#" .. tostring(cand.id or cand.questId or (#candidates + 1))
          cand._matchedStarter = matchedStarter
          cand._matchedStep = matchedStep
          cand._acceptLv = acceptLv
          cand._navCtx = chainNavCtx
          if type(cand.steps) == "table" and #cand.steps > 0 then
            local ctxSteps = {}
            for _, st in ipairs(cand.steps) do
              local stCopy = {}
              for k, v in pairs(st) do stCopy[k] = v end
              stCopy._navCtx = chainNavCtx
              stCopy.faction = stCopy.faction or cand.faction
              table.insert(ctxSteps, stCopy)
            end
            cand.steps = ctxSteps
            if matchedStep then
              for _, st in ipairs(ctxSteps) do
                if tonumber(st.id) == tonumber(matchedStep.id) then
                  cand._matchedStep = st
                  break
                end
              end
            end
          end
          table.insert(candidates, cand)
        end
      end
    end
  end

  if #candidates == 0 then return {} end
  candidates = PruneExclusiveDuplicateCandidates(candidates)
  if #candidates == 0 then return {} end
  local exactUnique = {}
  local seenSeq = {}
  for _, q in ipairs(candidates) do
    local parts = {}
    if type(q.steps) == "table" and #q.steps > 0 then
      for _, st in ipairs(q.steps) do
        table.insert(parts, tostring(st.id or ""))
      end
    else
      table.insert(parts, tostring(q.id or q.questId or ""))
    end
    local seqKey = table.concat(parts, ":")
    if not seenSeq[seqKey] then
      seenSeq[seqKey] = true
      table.insert(exactUnique, q)
    end
  end
  return GroupQuestsBySharedPrefix(exactUnique)
end

local function CollectBandZoneInfos(band, lvl)
  local out = {}
  local seen = {}
  local function addZone(zName, hubName, hubZone, fromLv, toLv, x, y, note)
    local clean = tostring(zName or ""):gsub("%s*%([^)]*%)%s*$", "")
    if clean == "" or seen[clean] then return end
    seen[clean] = true
    table.insert(out, {
      zone = clean,
      hub = hubName or "",
      hubZone = (hubZone and hubZone ~= "") and hubZone or clean,
      from = fromLv or band.from or 1,
      to = toLv or band.to or 60,
      x = x,
      y = y,
      note = note,
    })
  end
  addZone(band.zone, band.hub and band.hub.name, band.hub and band.hub.zone, band.from, band.to, band.hub and band.hub.x, band.hub and band.hub.y, nil)
  if type(band.altZones) == "table" then
    for _, az in ipairs(band.altZones) do
      local azFrom = az.from or band.from or 1
      local azTo = az.to or band.to or 60
      if not lvl or (azFrom <= lvl and lvl <= azTo) then
        addZone(az.zone, az.hub, az.zone, azFrom, azTo, az.x, az.y, az.note)
      end
    end
  end
  return out
end

local function MatchesSearch(text)
  if not state.searchQuery or state.searchQuery == "" then
    return true
  end
  if not text then return false end
  return string.find(string.lower(text), string.lower(state.searchQuery), 1, true) ~= nil
end

-- ============================================================================
-- 4. 主窗口与交互卡片 UI 系统
-- ============================================================================

local mainFrame
local contentChild
local scrollFrame
local tabButtons = {}
local cardPool = {}
local RefreshUI

local function OnCardHyperlinkEnter(self, link)
  if not link or link == "" then return end
  local linkType, payload = string.match(link, "^([^:]+):(.*)$")
  if not linkType then return end

  GameTooltip:SetOwner(self, "ANCHOR_CURSOR")
  if linkType == "wowfmap" then
    local mapID, xStr, yStr, zone, label = string.match(payload or "", "^(%d+):([^:]+):([^:]+):([^:]*):(.*)$")
    local nx = tonumber(xStr)
    local ny = tonumber(yStr)
    GameTooltip:ClearLines()
    GameTooltip:AddLine(string.format("|cff00ffcc[地图定位]|r %s", (label and label ~= "" and label ~= "-") and label or (zone or "目标点")))
    if zone and zone ~= "" and zone ~= "-" then
      GameTooltip:AddLine(string.format("区域: |cffffd100%s|r", zone))
    end
    if nx and ny then
      GameTooltip:AddLine(string.format("坐标: |cff00ff00%.1f, %.1f|r", nx, ny))
    end
    GameTooltip:AddLine(" ")
    GameTooltip:AddLine("|cff00ff00左键点击:|r 记录到世界地图并标点")
    GameTooltip:AddLine("|cff00ff00右键点击:|r 发送地图链接到聊天框")
    GameTooltip:AddLine("|cff00ff00Shift+左键:|r 发送地图链接到聊天框")
    GameTooltip:Show()
  elseif linkType == "quest" or linkType == "wowfquest" then
    local qidStr, lvlStr, fKey = string.match(payload or "", "^(%d+):?(%d*):?(.*)$")
    local qid = tonumber(qidStr)
    local qLevel = tonumber(lvlStr) or 1
    local stdLink = qid and string.format("quest:%d:%d", qid, qLevel) or link
    local ok = pcall(GameTooltip.SetHyperlink, GameTooltip, stdLink)
    local meta = LookupQuestMeta(qid, fKey)
    if not ok then
      GameTooltip:ClearLines()
      GameTooltip:AddLine((meta and meta.name) or ("任务 #" .. tostring(qid or "")), 1, 0.82, 0)
    end
    if qid and IsQuestCompletedById(qid) then
      GameTooltip:AddLine("已经完成", 0.1, 1.0, 0.1)
    end
    if meta then
      GameTooltip:AddLine(" ")
      if meta.dungeon and meta.dungeon ~= "" then
        GameTooltip:AddLine("关联副本: |cffff8000" .. meta.dungeon .. "|r")
      end
      if meta.npc and meta.npc ~= "" then
        GameTooltip:AddLine("接取NPC: |cff00ffcc" .. meta.npc .. "|r")
      end
      if meta.zone and meta.zone ~= "" then
        local loc = (meta.place and meta.place ~= "" and meta.place ~= meta.zone) and (meta.zone .. " · " .. meta.place) or meta.zone
        GameTooltip:AddLine("接取地点: |cffffffff" .. loc .. "|r")
      end
      if meta.x and meta.y then
        GameTooltip:AddLine(string.format("接取坐标: |cff00ff00%.1f, %.1f|r", meta.x, meta.y))
      end
    end
    GameTooltip:AddLine(" ")
    GameTooltip:AddLine("|cff00ff00左键 / Shift+左键:|r 发送任务链接到聊天框")
    if meta and meta.x and meta.y then
      GameTooltip:AddLine("|cff00ff00右键点击:|r 记录接取地点到世界地图")
    end
    GameTooltip:Show()
  elseif linkType == "wowfnpc" then
    local zone, label = string.match(payload or "", "^([^:]*):(.*)$")
    GameTooltip:ClearLines()
    GameTooltip:AddLine(string.format("|cff00ffcc[NPC 位置]|r %s", (label and label ~= "" and label ~= "-") and label or "目标 NPC"))
    if zone and zone ~= "" and zone ~= "-" then
      GameTooltip:AddLine(string.format("区域: |cffffd100%s|r", zone))
    end
    GameTooltip:AddLine("|cffaaaaaa暂无精确坐标（点击可打开对应区域地图）|r")
    GameTooltip:AddLine(" ")
    GameTooltip:AddLine("|cff00ff00左键点击:|r 打开世界地图定位区域")
    GameTooltip:AddLine("|cff00ff00Shift+左键:|r 发送 NPC 位置到聊天框")
    GameTooltip:Show()
  elseif linkType == "item" then
    local itemID = tonumber(string.match(payload or "", "^(%d+)"))
    local liveLink = itemID and ResolveLiveItemLink(itemID, nil) or nil
    local ok = pcall(GameTooltip.SetHyperlink, GameTooltip, liveLink or link)
    if not ok then
      GameTooltip:ClearLines()
      if itemID and GameTooltip.SetItemByID then
        ok = pcall(GameTooltip.SetItemByID, GameTooltip, itemID)
      end
      if not ok then
        GameTooltip:AddLine(itemID and ("物品 #" .. tostring(itemID)) or "物品信息加载中…", 1, 1, 1)
      end
    end
    GameTooltip:AddLine(" ")
    GameTooltip:AddLine("|cff00ff00左键:|r 查看物品详情  |cff00ff00Shift+左键:|r 发送到聊天框")
    GameTooltip:Show()
  elseif linkType == "wowfchain" then
    GameTooltip:ClearLines()
    GameTooltip:AddLine("|cff00ffcc[任务链显示]|r")
    GameTooltip:AddLine("已完成的前置任务已自动折叠")
    GameTooltip:AddLine("|cff00ff00点击 [+] 展开 · 点击 [-] 收起|r")
    GameTooltip:Show()
  else
    pcall(GameTooltip.SetHyperlink, GameTooltip, link)
    GameTooltip:Show()
  end
end

local function OnCardHyperlinkLeave()
  GameTooltip:Hide()
end

local function OnCardHyperlinkClick(self, link, text, button)
  if not link or link == "" then return end
  local linkType, payload = string.match(link, "^([^:]+):(.*)$")
  if not linkType then return end

  if linkType == "wowfmap" then
    local mapID, xStr, yStr, zone, label = string.match(payload or "", "^(%d+):([^:]+):([^:]+):([^:]*):(.*)$")
    local nx = tonumber(xStr)
    local ny = tonumber(yStr)
    local mid = tonumber(mapID)
    local zText = (zone and zone ~= "-") and zone or ""
    local lText = (label and label ~= "-") and label or zText
    local wantChat = (button == "RightButton") or (IsShiftKeyDown and IsShiftKeyDown())
    if wantChat and nx and ny then
      local wmLink = BuildChatWorldMapLink(mid, nx, ny, zText, lText)
      if wmLink ~= "" then
        InsertLinkToChat(wmLink)
      end
    else
      OpenMapAndSetWaypoint(zText, lText, nx, ny, mid)
    end
  elseif linkType == "quest" or linkType == "wowfquest" then
    local qidStr, lvlStr, fKey = string.match(payload or "", "^(%d+):?(%d*):?(.*)$")
    local qid = tonumber(qidStr)
    local qLevel = tonumber(lvlStr) or 1
    local meta = LookupQuestMeta(qid, fKey)
    if button == "RightButton" and meta and meta.x and meta.y then
      OpenMapAndSetWaypoint(meta.zone ~= "" and meta.zone or meta.place, meta.npc ~= "" and meta.npc or meta.name, meta.x, meta.y)
      return
    end
    local chatLink = (GetQuestLink and qid) and GetQuestLink(qid) or nil
    if not chatLink or chatLink == "" then
      if linkType == "quest" and text and string.find(text, "|Hquest:", 1, true) then
        chatLink = text
      else
        local qName = (meta and meta.name) or ("任务 #" .. tostring(qid or ""))
        chatLink = string.format("|cffffff00|Hquest:%d:%d|h[%s]|h|r", qid or 0, qLevel, qName)
      end
    end
    InsertLinkToChat(chatLink)
  elseif linkType == "wowfnpc" then
    local zone, label = string.match(payload or "", "^([^:]*):(.*)$")
    local zText = (zone and zone ~= "-") and zone or ""
    local lText = (label and label ~= "-") and label or zText
    if IsShiftKeyDown and IsShiftKeyDown() then
      local msg = (zText ~= "" and lText ~= "" and zText ~= lText)
        and string.format("[%s - %s]", zText, lText)
        or string.format("[%s]", lText ~= "" and lText or zText)
      InsertLinkToChat(msg)
    else
      OpenMapAndSetWaypoint(zText, lText, nil, nil, ResolveUiMapID(zText, lText))
    end
  elseif linkType == "item" then
    local itemID = tonumber(string.match(payload or "", "^(%d+)"))
    local chatLink = ResolveLiveItemLink(itemID, (text and text ~= "") and text or link)
    if (IsModifiedClick and IsModifiedClick("CHATLINK")) or (IsShiftKeyDown and IsShiftKeyDown()) then
      InsertLinkToChat(chatLink)
    elseif HandleModifiedItemClick and IsModifiedClick and IsModifiedClick("DRESSUP") then
      pcall(HandleModifiedItemClick, chatLink)
    elseif SetItemRef then
      pcall(SetItemRef, link, chatLink, button, self)
    end
  elseif linkType == "wowfchain" then
    local foldKey = (payload and payload ~= "") and payload or nil
    if foldKey then
      state.expandedChains = state.expandedChains or {}
      if state.expandedChains[foldKey] then
        state.expandedChains[foldKey] = nil
      else
        state.expandedChains[foldKey] = true
      end
      RefreshUI(true)
    end
  else
    if (IsModifiedClick and IsModifiedClick("CHATLINK")) or (IsShiftKeyDown and IsShiftKeyDown()) then
      InsertLinkToChat((text and text ~= "") and text or link)
    elseif SetItemRef then
      pcall(SetItemRef, link, text, button, self)
    end
  end
end

local function EnableFontStringHyperlinks(fs)
  if not fs then return end
  if fs.SetHyperlinksEnabled then
    pcall(fs.SetHyperlinksEnabled, fs, true)
  elseif fs.EnableHyperlinks then
    pcall(fs.EnableHyperlinks, fs)
  end
end

local function AcquireCard(index)
  if not cardPool[index] then
    local template = BackdropTemplateMixin and "BackdropTemplate" or nil
    local card = CreateFrame("Frame", nil, contentChild, template)
    if card.SetBackdrop then
      card:SetBackdrop({
        bgFile = "Interface\\Buttons\\WHITE8x8",
        edgeFile = "Interface\\Tooltips\\UI-Tooltip-Border",
        tile = true, tileSize = 16, edgeSize = 12,
        insets = { left = 3, right = 3, top = 3, bottom = 3 },
      })
    end

    card:EnableMouse(true)
    if card.SetHyperlinksEnabled then
      pcall(card.SetHyperlinksEnabled, card, true)
    end
    card:SetScript("OnHyperlinkEnter", OnCardHyperlinkEnter)
    card:SetScript("OnHyperlinkLeave", OnCardHyperlinkLeave)
    card:SetScript("OnHyperlinkClick", OnCardHyperlinkClick)
    card:SetScript("OnMouseWheel", function(_, delta)
      if scrollFrame and scrollFrame.GetScript then
        local fn = scrollFrame:GetScript("OnMouseWheel")
        if fn then
          fn(scrollFrame, delta)
        else
          local cur = scrollFrame:GetVerticalScroll() or 0
          local maxS = scrollFrame:GetVerticalScrollRange() or 0
          local nextS = math.max(0, math.min(maxS, cur - delta * 36))
          scrollFrame:SetVerticalScroll(nextS)
        end
      end
    end)

    card.title = card:CreateFontString(nil, "OVERLAY", "GameFontNormalLarge")
    card.title:SetPoint("TOPLEFT", 12, -10)
    card.title:SetPoint("TOPRIGHT", -140, -10)
    card.title:SetJustifyH("LEFT")
    card.title:SetWordWrap(true)
    EnableFontStringHyperlinks(card.title)

    card.badge = card:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
    card.badge:SetPoint("TOPRIGHT", -12, -12)
    card.badge:SetJustifyH("RIGHT")

    card.body = card:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
    card.body:SetPoint("TOPLEFT", card.title, "BOTTOMLEFT", 0, -6)
    card.body:SetPoint("RIGHT", card, "RIGHT", -12, 0)
    card.body:SetJustifyH("LEFT")
    card.body:SetSpacing(3)
    card.body:SetWordWrap(true)
    EnableFontStringHyperlinks(card.body)

    card.actionBtn = CreateFrame("Button", nil, card, "UIPanelButtonTemplate")
    card.actionBtn:SetSize(128, 22)
    card.actionBtn:SetPoint("TOPRIGHT", -10, -8)
    card.actionBtn:Hide()

    cardPool[index] = card
  end
  local c = cardPool[index]
  c:Show()
  c.actionBtn:Hide()
  c.badge:SetText("")
  return c
end

local arbToolbar
local repFilterBar

local function HideUnusedCards(fromIndex)
  for i = fromIndex, #cardPool do
    cardPool[i]:Hide()
  end
  if arbToolbar and state.activeTab ~= 8 then
    arbToolbar:Hide()
  end
  if repFilterBar and state.activeTab ~= 9 then
    repFilterBar:Hide()
  end
end

local function LayoutCard(card, yOffset, titleText, bodyText, borderColor, bgColor, badgeText, actionLabel, actionCallback)
  local width = (contentChild:GetWidth() or 720) - 16
  if width < 500 then width = 710 end
  card:SetWidth(width)
  card:ClearAllPoints()
  card:SetPoint("TOPLEFT", contentChild, "TOPLEFT", 8, -yOffset)

  if card.SetBackdrop then
    local bg = bgColor or { 0.08, 0.10, 0.14, 0.92 }
    local br = borderColor or { 0.25, 0.35, 0.45, 0.85 }
    card:SetBackdropColor(bg[1], bg[2], bg[3], bg[4])
    card:SetBackdropBorderColor(br[1], br[2], br[3], br[4])
  end

  local titleRightPad = 120
  if actionLabel and actionCallback then
    card.actionBtn:SetText(actionLabel)
    local btnW = math.max(120, math.ceil((card.actionBtn:GetTextWidth() or 100) + 28))
    card.actionBtn:SetSize(btnW, 22)
    card.actionBtn:SetScript("OnClick", actionCallback)
    card.actionBtn:Show()
    card.badge:SetText("")
    titleRightPad = btnW + 20
  else
    card.actionBtn:Hide()
    card.badge:SetText(badgeText or "")
    if badgeText and badgeText ~= "" then
      titleRightPad = math.max(120, math.ceil((card.badge:GetStringWidth() or 80) + 24))
    end
  end

  card.title:ClearAllPoints()
  card.title:SetPoint("TOPLEFT", card, "TOPLEFT", 12, -10)
  card.title:SetPoint("TOPRIGHT", card, "TOPRIGHT", -titleRightPad, -10)
  card.title:SetWidth(width - titleRightPad - 12)
  card.title:SetText(titleText or "")

  card.body:SetWidth(width - 24)
  card.body:SetText(bodyText or "")

  local titleH = math.max(18, card.title:GetStringHeight() or 18)
  local bodyH = (bodyText and bodyText ~= "") and (card.body:GetStringHeight() or 20) or 0
  local totalH = titleH + bodyH + (bodyH > 0 and 26 or 20)
  if totalH < 42 then totalH = 42 end
  card:SetHeight(totalH)

  return yOffset + totalH + 8
end

-- ============================================================================
-- 5. 核心标签页共享渲染工具 (CardList / Band / ClassRun / QuestGroup / Filter)
-- ============================================================================

local function PickZone(obj, fb1, fb2, fb3)
  if type(obj) == "table" and obj.zone and obj.zone ~= "" then
    return obj.zone
  end
  if fb1 and fb1 ~= "" then return fb1 end
  if fb2 and fb2 ~= "" then return fb2 end
  if fb3 and fb3 ~= "" then return fb3 end
  return ""
end

local function FactionTag(f, bracketed)
  if f == "horde" then
    return bracketed and "|cffff5555[部落]|r" or "|cffff5555部落|r"
  elseif f == "alliance" then
    return bracketed and "|cff44aaff[联盟]|r" or "|cff44aaff联盟|r"
  end
  return bracketed and "|cff00ffcc[通用]|r" or "|cffffd100双阵营|r"
end

local CARD_THEMES = {
  header    = { border = { 0.0, 0.85, 0.7, 0.95 },  bg = { 0.05, 0.14, 0.16, 0.95 } },
  route     = { border = { 0.9, 0.75, 0.2, 0.9 },   bg = { 0.11, 0.10, 0.06, 0.92 } },
  routeCur  = { border = { 0.1, 0.95, 0.4, 0.95 },  bg = { 0.06, 0.16, 0.10, 0.95 } },
  routeIdle = { border = { 0.25, 0.35, 0.45, 0.85 }, bg = { 0.08, 0.10, 0.14, 0.92 } },
  zone      = { border = { 0.0, 0.75, 0.65, 0.90 }, bg = { 0.05, 0.12, 0.14, 0.93 } },
  talent    = { border = { 0.35, 0.65, 0.95, 0.9 }, bg = { 0.07, 0.11, 0.17, 0.92 } },
  legacy    = { border = { 0.0, 0.85, 0.7, 0.9 },   bg = { 0.05, 0.12, 0.14, 0.92 } },
  combat    = { border = { 0.3, 0.75, 0.95, 0.9 },  bg = { 0.06, 0.10, 0.15, 0.92 } },
  combatCur = { border = { 0.1, 0.9, 0.5, 0.95 },   bg = { 0.06, 0.15, 0.12, 0.95 } },
  combatSub = { border = { 0.25, 0.45, 0.65, 0.85 }, bg = { 0.07, 0.10, 0.14, 0.92 } },
  milestone = { border = { 0.2, 0.8, 0.5, 0.85 },   bg = { 0.06, 0.12, 0.09, 0.92 } },
  dungeon   = { border = { 0.95, 0.5, 0.15, 0.85 }, bg = { 0.12, 0.08, 0.05, 0.92 } },
  dunNew    = { border = { 0.0, 0.85, 0.7, 0.9 },   bg = { 0.05, 0.13, 0.14, 0.94 } },
  dunMatch  = { border = { 0.2, 0.85, 0.4, 0.9 },   bg = { 0.08, 0.10, 0.14, 0.92 } },
  macroNew  = { border = { 0.0, 0.85, 0.7, 0.9 },   bg = { 0.07, 0.09, 0.13, 0.94 } },
  macro     = { border = { 0.3, 0.45, 0.6, 0.85 },  bg = { 0.07, 0.09, 0.13, 0.94 } },
  command   = { border = { 0.2, 0.55, 0.8, 0.85 },  bg = { 0.06, 0.09, 0.14, 0.94 } },
  cmdHeader = { border = { 0.0, 0.75, 0.95, 0.9 },  bg = { 0.05, 0.10, 0.16, 0.92 } },
  arbGood   = { border = { 0.2, 0.85, 0.45, 0.9 },  bg = { 0.05, 0.12, 0.08, 0.92 } },
  arbBad    = { border = { 0.8, 0.3, 0.3, 0.9 },    bg = { 0.14, 0.06, 0.06, 0.94 } },
  profRec   = { border = { 0.1, 0.9, 0.5, 0.95 },   bg = { 0.05, 0.15, 0.10, 0.94 } },
  prof      = { border = { 0.25, 0.55, 0.45, 0.85 }, bg = { 0.06, 0.11, 0.10, 0.92 } },
  news      = { border = { 0.9, 0.6, 0.2, 0.9 },    bg = { 0.12, 0.09, 0.05, 0.94 } },
  info      = { border = { 0.3, 0.35, 0.45, 0.85 }, bg = { 0.08, 0.10, 0.14, 0.92 } },
}

local function CreateCardList(startY)
  local list = { idx = 1, y = startY or 6 }
  function list:Add(opts)
    local card = AcquireCard(self.idx)
    self.idx = self.idx + 1
    local theme = (type(opts.theme) == "table") and opts.theme or (CARD_THEMES[opts.theme] or CARD_THEMES.info)
    local act = opts.action
    self.y = LayoutCard(
      card, self.y,
      opts.title,
      opts.body,
      opts.borderColor or theme.border,
      opts.bgColor or theme.bg,
      opts.badge,
      act and act.label or opts.actionLabel,
      act and act.fn or opts.actionFn
    )
    return self.y
  end
  function list:Finish(minHeight)
    HideUnusedCards(self.idx)
    contentChild:SetHeight(math.max(self.y + 20, minHeight or 480))
  end
  return list
end

local function FilterToggle(stateKey, modes)
  local cur = state[stateKey]
  local curIdx = 1
  for i, m in ipairs(modes) do
    if m.value == cur then
      curIdx = i
      break
    end
  end
  local curMode = modes[curIdx]
  local nextMode = modes[(curIdx % #modes) + 1]
  return {
    value = curMode.value,
    label = curMode.btnLabel or nextMode.enterLabel or "",
    desc = curMode.desc or "",
    action = {
      label = curMode.btnLabel or nextMode.enterLabel or "",
      fn = function()
        state[stateKey] = nextMode.value
        RefreshUI()
      end,
    },
  }
end

local function FormatClassRunLine(cr, opts)
  opts = opts or {}
  local firstStep = cr.steps and cr.steps[1]
  local stepZone = PickZone(firstStep, opts.fallbackZone)
  local npcText = firstStep and FormatStepNpcInfo(firstStep, stepZone) or ""
  local npcInfo = (npcText ~= "") and (" — " .. (opts.npcPrefix or "") .. npcText) or ""
  local teachStr = (cr.teaches and cr.teaches ~= "") and ((opts.teachArrow or " -> 学会 ") .. "|cff71d5ff[" .. cr.teaches .. "]|r") or ""
  local crLink, crTree = FormatQuestWithSteps(cr, cr.level, stepZone, opts.indent or "      ", opts.foldCompleted)
  local tag = opts.tag or string.format("|cff00ffcc[Lv.%d %s·%s专属任务链]|r", cr.level or 1, opts.routeName or "", opts.clsName or "")
  -- 只有在调用方确实会把 crTree 渲染出来时，表头才压缩：
  -- 否则「任务名 + 第一步 NPC」会和树的首行一模一样，看起来像任务被列了两遍。
  if crTree and crTree ~= "" and opts.treeRendered ~= false then
    local stepCount = (type(cr.steps) == "table") and #cr.steps or 0
    return string.format("%s%s |cff8899aa· 任务链 %d 步|r%s", opts.prefix or "", tag, stepCount, teachStr), crTree
  end
  -- 摘要模式（不展开树）时用「第一步任务」作链接，与同一行给出的起始 NPC 保持一致；
  -- 任务链名称（通常等于末步奖励任务）只在步数标注里体现。
  if firstStep and opts.summaryStepLink then
    local firstLink = FormatQuestLink(firstStep, cr.level, stepZone)
    local stepCount = (type(cr.steps) == "table") and #cr.steps or 0
    local chainTag = (stepCount > 1) and string.format(" |cff8899aa· 任务链 %d 步|r", stepCount) or ""
    return string.format("%s%s %s%s%s%s", opts.prefix or "", tag, firstLink, chainTag, teachStr, npcInfo), nil
  end
  return string.format("%s%s %s%s%s", opts.prefix or "", tag, crLink, teachStr, npcInfo), crTree
end

local function RenderQuestGroups(lines, groups, opts)
  opts = opts or {}
  local qCount = 0
  local maxQuests = opts.maxQuests
  local indent = opts.indent or "      "
  local linePrefix = opts.prefix or "  - "
  local insideLabel = opts.insideLabel or "(副本内接取)"
  for _, grp in ipairs(groups or {}) do
    if maxQuests and qCount >= maxQuests then break end
    qCount = qCount + #grp.quests
    local q = grp.quests[1]
    local matched = opts.useMatched and (q._matchedStarter or q._matchedStep or q) or q
    local qZone = PickZone(matched, PickZone(q, opts.fallbackZone))
    local acceptLv = q._acceptLv or q.minLevel or q.min or opts.fallbackLevel or 1
    local acceptTag = (not IsQuestLineStarted(q)) and string.format(" (可接 Lv.%d)", acceptLv) or ""
    local npcInfo = FormatStepNpcInfo(matched, qZone)
    if q.inside and not ((matched.npc and matched.npc ~= "") or (matched.x and matched.y)) then
      npcInfo = (npcInfo ~= "") and (npcInfo .. " " .. insideLabel) or insideLabel
    end
    local npcSuffix = (npcInfo ~= "") and (" — " .. npcInfo) or ""
    local fTag = opts.showFaction and (q.faction == "horde" and "|cffff5555[部落]|r " or (q.faction == "alliance" and "|cff44aaff[联盟]|r " or "")) or ""
    local cTag = opts.showClass and FormatQuestClassTag(q) or ""
    if #grp.quests > 1 and grp.prefixLen >= 1 then
      local headerPrefix, treeBody = FormatSharedPrefixGroup(grp, opts.fallbackLevel, qZone, indent, opts.foldCompleted ~= false, opts.foldZone)
      local branchTag = string.format("[共%d条分支任务链]", #grp.quests)
      table.insert(lines, string.format("%s%s%s%s%s%s%s", linePrefix, fTag, cTag, headerPrefix, branchTag, acceptTag, npcSuffix))
      table.insert(lines, treeBody)
    else
      local chainTag = (q.stepCount and q.stepCount > 1) and string.format(q.hasPrereq and " [共%d步·含前置]" or (" [共%d步" .. (opts.singleChainWord or "") .. "]"), q.stepCount) or ""
      local foldKey = opts.foldZone and GetQuestChainFoldKey(q, opts.foldZone) or nil
      local qLink, qTree = FormatQuestWithSteps(q, q.minLevel or q.level or opts.fallbackLevel, qZone, indent, opts.foldCompleted ~= false, foldKey)
      table.insert(lines, string.format("%s%s%s%s%s%s%s", linePrefix, fTag, cTag, qLink, acceptTag, chainTag, npcSuffix))
      if qTree then table.insert(lines, qTree) end
    end
  end
  return qCount
end

local function BuildBandLines(band, opts)
  opts = opts or {}
  local lvl = opts.level or state.level
  local cls = opts.cls
  local spec = opts.spec
  local recProfs = (spec and spec.recommendedProfs) or ""
  local lines = {}

  local hubName = (band.hub and band.hub.name ~= "") and band.hub.name or band.zone
  local hubText = (hubName and hubName ~= "") and hubName or "主营地"
  local hubLink = (band.hub and band.hub.x and band.hub.y and hubText ~= "")
    and FormatNpcMapLink(band.zone, hubText, band.hub.x, band.hub.y, { omitZone = true })
    or ("|cff00ffcc" .. hubText .. "|r")
  local zonesBlock
  if opts.compactZones then
    -- 非当前阶段只需一行区域概览；完整营地/等级/备注留给当前阶段卡，避免多张卡重复同一批区域
    local names = CollectBandZoneNames(band)
    if #names > 0 then
      -- 相邻阶段区域高度重叠，只列「本阶段新增」的区域，其余用数量带过
      local shownZones = opts.shownZones
      local listed = names
      local carried = 0
      if shownZones then
        listed = {}
        for _, z in ipairs(names) do
          if shownZones[z] then
            carried = carried + 1
          else
            table.insert(listed, z)
            shownZones[z] = true
          end
        end
        if #listed == 0 then
          -- 全是延续区域：不再重复列名
          zonesBlock = string.format("|cffffd100适龄区域:|r |cff8899aa沿用上阶段的 %d 个区域|r", carried)
        end
      end
      if not zonesBlock then
        zonesBlock = string.format("|cffffd100适龄区域:|r |cff00ffcc%s|r", table.concat(listed, " / "))
        if carried > 0 then
          zonesBlock = zonesBlock .. string.format("  |cff8899aa(另含上阶段 %d 区域)|r", carried)
        end
      end
    end
  else
    zonesBlock = FormatBandZonesBlock(band, opts.zonesHeader or "本阶段适龄练级区域 (平级推荐，可自由切换)")
  end
  if zonesBlock then
    table.insert(lines, zonesBlock)
  elseif opts.isSmartMatch then
    table.insert(lines, string.format("|cffffd100当前练级区域:|r |cff00ffcc%s|r   ·   |cffffd100核心营地/城镇:|r %s", band.zone or "未知", hubLink))
  else
    table.insert(lines, string.format("|cffffd100驻扎营地/城镇:|r %s", hubLink))
  end

  if not zonesBlock and band.hubs and #band.hubs > 1 then
    local subHubs = {}
    for _, h in ipairs(band.hubs) do
      local hName = h.name or ""
      local hLink = (h.x and h.y and hName ~= "")
        and FormatNpcMapLink(band.zone, hName, h.x, h.y, { omitZone = true })
        or ((hName ~= "") and ("|cff00ffcc" .. hName .. "|r") or "")
      local activeMark = (opts.markActiveHub and lvl >= (h.from or 1) and lvl <= (h.to or 60)) and "|cff00ff00★|r" or ""
      table.insert(subHubs, string.format("%s%s[Lv.%d-%d]", activeMark, hLink, h.from or band.from, h.to or band.to))
    end
    table.insert(lines, (opts.subHubLabel or "|cff99e6ff分阶段据点:|r ") .. table.concat(subHubs, " -> "))
  end

  if band.flights and #band.flights > 0 then
    local fList = {}
    for _, fl in ipairs(band.flights) do
      local flZone = PickZone(fl, band.zone)
      local flLink = FormatNpcMapLink(flZone, (fl.name and fl.name ~= "") and fl.name or "飞行管理员", fl.x, fl.y, { place = fl.place, omitZone = true })
      table.insert(fList, flLink)
    end
    table.insert(lines, "|cff99e6ff[飞行点] 解锁鸟点:|r " .. table.concat(fList, opts.flightSep or " · "))
  end

  local matchedTrainer = GetBandTrainer(band, state.classKey, state.faction)
  if matchedTrainer and matchedTrainer.name ~= "" then
    local tZone = PickZone(matchedTrainer, matchedTrainer.place, band.zone)
    local tLink = FormatNpcMapLink(tZone, matchedTrainer.name, matchedTrainer.x, matchedTrainer.y, { place = matchedTrainer.place or band.zone })
    table.insert(lines, string.format("|cff71d5ff%s训练师:|r %s (%s)", cls and cls.name or "职业", tLink, matchedTrainer.title or "职业训练师"))
  end

  local matchedQuests = GetBandQuests(band, state.classKey)
  if matchedQuests and #matchedQuests > 0 then
    local qLines = opts.groupBandQuests and {} or lines
    for _, q in ipairs(matchedQuests) do
      if not (opts.skipCompletedQuests and IsQuestCompleted(q)) then
        local qZone = PickZone(q, q.place, band.zone)
        local qTag = (q.kind == "class")
          and (opts.groupBandQuests and "|cff00ffcc[★职业专属]|r " or string.format("|cff00ffcc[★%s职业任务]|r ", cls and cls.name or ""))
          or (opts.groupBandQuests and "|cffffd100[关键任务]|r " or "|cffffd100[区域关键任务]|r ")
        local qLink, qTree = FormatQuestWithSteps(q, q.level or band.from, qZone, opts.questIndent or "    ", opts.foldQuestSteps)
        qZone = PickZone(q, q.place, band.zone)
        local npcInfo = FormatStepNpcInfo(q, qZone)
        local npcSuffix = (npcInfo ~= "") and (" — " .. npcInfo) or ""
        table.insert(qLines, string.format("%s%s%s (Lv.%d)%s", opts.questPrefix or "", qTag, qLink, q.level or band.from, npcSuffix))
        if qTree then table.insert(qLines, qTree) end
      end
    end
    if opts.groupBandQuests and #qLines > 0 then
      table.insert(lines, "|cff00ffcc本阶段关键/职业任务:|r\n" .. table.concat(qLines, "\n"))
    end
  end

  -- 注意：职业任务链与专精要点不在阶段卡里渲染 —— 它们统一由「升级路线」页顶部的
  -- 「核心职业任务与专精里程碑」卡展示，否则同一批职业任务会在同一页出现两遍。

  if band.professions and #band.professions > 0 then
    local pList = {}
    for _, p in ipairs(band.professions) do
      local pZone = PickZone(p, band.zone)
      local pLink = FormatNpcMapLink(pZone, (p.trainer and p.trainer ~= "") and p.trainer or (p.name .. "训练师"), p.x, p.y, { place = p.place, omitZone = true })
      local isRec = (recProfs ~= "" and string.find(recProfs, p.name or "", 1, true) ~= nil)
      local recMark = isRec and "|cff00ff00★推荐|r" or ""
      table.insert(pList, string.format("|cff00ff96[%s%s]|r %s", p.name, recMark, pLink))
    end
    table.insert(lines, (opts.profLabel or "|cff00ff96顺路学专业:|r ") .. table.concat(pList, opts.profSep or " · "))
  end

  return lines
end

local function RenderTabSmartMatch()
  local list = CreateCardList(6)
  local lvl = state.level
  local route = GetCurrentRoute()
  local cls = GetCurrentClassData()
  local spec = GetCurrentSpecData()
  local recProfs = (spec and spec.recommendedProfs) or ""

  -- 1. 角色智能匹配总览卡
  local band = GetMatchedBand(route, lvl)
  local phase = GetMatchedPhase(spec, lvl)
  local talentStep = GetMatchedTalentStep(spec, lvl)
  local matchedDungeons = GetMatchedDungeons(lvl)
  local matchedClassRuns = GetCurrentClassRuns(route, cls, state.faction)

  local overviewLines = {}
  local zoneTag = (state.zone and state.zone ~= "") and ("  ·  |cff00ff96当前所在:|r " .. state.zone) or ""
  table.insert(overviewLines, string.format(
    "|cff00ffcc阵营:|r %s%s",
    FactionTag(state.faction),
    zoneTag
  ))
  if recProfs ~= "" then
    table.insert(overviewLines, "|cff00ff96专精推荐专业:|r " .. recProfs)
  end
  table.insert(overviewLines, "|cff99e6ff交互提示:|r |cff00ffcc青色 NPC/地点/定位链接|r 左键标点到地图、右键发聊天；|cffffff00黄色任务链接|r 左键发聊天、右键标点；|cff1eff00物品链接|r 悬停看完整提示，Shift+左键发聊天。")
  local playerProfs = GetPlayerProfessions()
  if lvl >= 14 and lvl < 60 and not IsQuestCompletedById(79975) then
    if HasPlayerProfession(playerProfs, "制皮", "Leatherworking") then
      table.insert(overviewLines, "|cffffd100★ 经验加速提醒:|r 14级起记得完成【舒适的睡袋】常驻 |cff00ff00+8% 经验|r，并利用制皮【营地帐篷】攒双倍经验！")
    else
      table.insert(overviewLines, "|cffffd100★ 经验加速提醒:|r 14级起记得完成【舒适的睡袋】四步任务常驻 |cff00ff00+8% 经验|r（详情见「专业&无限特色」页）！")
    end
  end

  list:Add({
    title = string.format("|cff00ffcc>> Lv.%d %s·%s·%s 智能匹配仪表盘|r", lvl, route and route.name or "", cls and cls.name or "", spec and spec.name or ""),
    body = table.concat(overviewLines, "\n"),
    theme = "header",
    badge = "|cff00ffcc内置数据快照|r",
  })

  -- 2. 当前等级推荐区域与营地导航摘要（完整阶段与区域任务链见「升级路线」页）
  if band then
    local bandLines = {}
    local hubName = (band.hub and band.hub.name ~= "") and band.hub.name or band.zone
    local hubText = (hubName and hubName ~= "") and hubName or "未知"
    local hubLink = (band.hub and band.hub.x and band.hub.y)
      and FormatNpcMapLink(band.zone, hubText, band.hub.x, band.hub.y, { omitZone = true })
      or ("|cff00ffcc" .. hubText .. "|r")
    -- 仪表盘只给一行区域概览；完整营地/等级/备注在「升级路线」页展开，避免同一份区域清单在两页各铺一遍
    local zoneNames = CollectBandZoneNames(band)
    if #zoneNames > 0 then
      table.insert(bandLines, string.format("|cffffd100适龄练级区域:|r |cff00ffcc%s|r", table.concat(zoneNames, " / ")))
    else
      table.insert(bandLines, string.format("|cffffd100当前练级区域:|r |cff00ffcc%s|r  ·  |cffffd100核心据点:|r %s", band.zone or "未知", hubLink))
    end
    table.insert(bandLines, string.format("|cffffd100当前营地/据点:|r %s", hubLink))
    local matchedTrainer = GetBandTrainer(band, state.classKey, state.faction)
    if matchedTrainer and matchedTrainer.name ~= "" then
      local tZone = PickZone(matchedTrainer, matchedTrainer.place, band.zone)
      local tLink = FormatNpcMapLink(tZone, matchedTrainer.name, matchedTrainer.x, matchedTrainer.y, { place = matchedTrainer.place or band.zone })
      table.insert(bandLines, string.format("|cff71d5ff%s训练师:|r %s", cls and cls.name or "职业", tLink))
    end
    local bandQuests = GetBandQuests(band, state.classKey)
    if bandQuests and #bandQuests > 0 then
      table.insert(bandLines, string.format("|cff00ffcc本阶段关键/职业任务:|r 共 %d 条（完整任务链与区域指引请点击右上角查看详情）", #bandQuests))
    end

    list:Add({
      -- 区域名在正文首行已给出，标题只保留等级区间
      title = string.format("|cffffd100[路线] 当前角色升级导航 (Lv.%d-%d)|r", band.from, band.to),
      body = table.concat(bandLines, "\n"),
      theme = "route",
      action = {
        label = "查看路线详情 ->",
        fn = function() state.activeTab = 2; RefreshUI() end,
      },
    })
  end

  -- 3. 当前等级天赋加点指引 (Lv.10-60)
  if spec then
    local tLines = {}
    if lvl < 10 then
      table.insert(tLines, string.format("当前 |cffffd100Lv.%d|r 尚未解锁天赋树（10 级解锁第 1 点天赋）。", lvl))
      if spec.steps and spec.steps[1] then
        local firstStep = spec.steps[1]
        table.insert(tLines, string.format("Lv.10 首点推荐: |cffffd100[%s] %s (%d/%d)|r", firstStep.tree, firstStep.name, firstStep.rank, firstStep.max))
      end
    else
      if talentStep then
        table.insert(tLines, string.format(">> |cff00ff00Lv.%d 本级必点天赋:|r |cffffd100[%s] %s (第 %d/%d 点)|r", lvl, talentStep.tree, talentStep.name, talentStep.rank, talentStep.max))
      end
      local nextPreview = {}
      for nextLvl = lvl + 1, math.min(60, lvl + 3) do
        local ns = GetMatchedTalentStep(spec, nextLvl)
        if ns then
          table.insert(nextPreview, string.format("Lv.%d: [%s] %s (%d/%d)", nextLvl, ns.tree, ns.name, ns.rank, ns.max))
        end
      end
      if #nextPreview > 0 then
        table.insert(tLines, "|cff99e6ff后续预告:|r " .. table.concat(nextPreview, "  ->  "))
      end
    end

    list:Add({
      title = string.format("|cffffd100★ Lv.%d 天赋加点指引 (%s·%s)|r", lvl, cls and cls.name or "", spec.name),
      body = table.concat(tLines, "\n"),
      theme = "talent",
      action = {
        label = "查看完整10-60表 ->",
        fn = function() state.talentFilter = "ALL"; state.activeTab = 3; RefreshUI() end,
      },
    })
  end

  -- 3.5 传承天赋加点推荐 (单角色上限 16 点)
  do
    local legacyCompactLines = BuildLegacyRecommendationLines(lvl, playerProfs, true)
    list:Add({
      title = string.format("|cff00ffcc★ Lv.%d 传承天赋加点推荐 (单角色上限 16 点)|r", lvl),
      body = table.concat(legacyCompactLines, "\n"),
      theme = "legacy",
      action = {
        label = "查看1-16点详表 ->",
        fn = function() state.activeTab = 6; RefreshUI() end,
      },
    })
  end

  -- 4. 当前等级专精输出循环摘要
  if phase then
    local rotLines = {
      "|cff00ff96【常驻保持】|r " .. (phase.keep or "无"),
      "|cffffa500【起手技能】|r " .. (phase.open or "普通攻击"),
      "|cff71d5ff【核心优先级】|r " .. (phase.cycle or "普通攻击"),
    }
    list:Add({
      title = string.format("|cff71d5ff[战斗] 当前等级输出手法与循环 (Lv.%d-%d)|r", phase.from, phase.to),
      body = table.concat(rotLines, "\n"),
      theme = "combat",
      action = {
        label = "查看战斗详情 ->",
        fn = function() state.activeTab = 3; RefreshUI() end,
      },
    })
  end

  -- 5. 当前等级种族+职业专属任务链与关键里程碑摘要
  local milestoneLines = {}
  local milestoneFilter = BuildMilestoneFilter()
  if spec and spec.musts then
    for _, m in ipairs(spec.musts) do
      local mLvl = m.level or 1
      if mLvl >= lvl - 2 and mLvl <= lvl + 10 and #milestoneLines < 3 and not ShouldSkipMilestone(m, milestoneFilter) then
        local tag = (mLvl == lvl) and "|cff00ff00[当前必做]|r " or string.format("|cffffd100[Lv.%d 要点]|r ", mLvl)
        table.insert(milestoneLines, "  - " .. tag .. LinkifyInlineCoords(m.text or "", band and band.zone or "", spec.name or "要点"))
      end
    end
  end
  for _, cr in ipairs(matchedClassRuns) do
    local crTo = cr.to or cr.level or 60
    if not ShouldSkipClassRun(cr, milestoneFilter) and lvl >= (cr.level - 4) and crTo >= lvl - 2 and #milestoneLines < 5 then
      local crLine = FormatClassRunLine(cr, {
        prefix = "  - ",
        routeName = route and route.name or "",
        clsName = cls and cls.name or "",
        fallbackZone = band and band.zone or "",
        npcPrefix = "起始: ",
        teachArrow = " -> 奖励技能: ",
        indent = "      ",
        treeRendered = false, -- 智能匹配页只放一行摘要，完整树在「升级路线」页
        summaryStepLink = true, -- 摘要行链接用「第一步任务」，与同一行的起始 NPC 对应
      })
      table.insert(milestoneLines, crLine)
    end
  end
  if #milestoneLines > 0 then
    list:Add({
      title = string.format("|cff00ff96★ 当前阶段 %s·%s 关键里程碑与专属职业任务|r", route and route.name or "", cls and cls.name or ""),
      body = table.concat(milestoneLines, "\n"),
      theme = "milestone",
      action = {
        label = "查看全部任务 ->",
        fn = function() state.activeTab = 2; RefreshUI() end,
      },
    })
  end

  -- 6. 当前等级推荐地下城摘要（详细任务树见「地下城百科」页）
  if #matchedDungeons > 0 then
    local dLines = {}
    for _, d in ipairs(matchedDungeons) do
      local newTag = d.isNew and " |cff00ffcc[★无限服新增]|r" or ""
      local entLink = (d.entranceX and d.entranceY)
        and FormatNpcMapLink(d.entranceZone or d.zone, "副本入口", d.entranceX, d.entranceY, { omitZone = true }) or ""
      local zoneText = LinkifyInlineCoords(d.zone or "", d.entranceZone or d.zone or "", d.name)
      local pendingCount = 0
      for _, q in ipairs(DedupeQuestieQuests(d.quests or {})) do
        if (q.faction == "both" or q.faction == state.faction) and MatchesQuestClass(q) and (not IsQuestCompleted(q)) then
          pendingCount = pendingCount + 1
        end
      end
      table.insert(dLines, string.format(
        "|cffff8000[%s]|r (Lv.%d-%d · 推荐 %d 级 · %s%s) — 未完成任务 |cffffd100%d|r 个%s",
        d.name, d.minLevel, d.maxLevel, d.visit or d.minLevel, zoneText, (entLink ~= "") and (" " .. entLink) or "", pendingCount, newTag
      ))
    end
    list:Add({
      title = string.format("|cffff8000[副本] 适合当前等级 (Lv.%d) 的地下城 (%d个)|r", lvl, #matchedDungeons),
      body = table.concat(dLines, "\n"),
      theme = "dungeon",
      action = {
        label = "查看副本任务 ->",
        fn = function() state.dungeonFilter = "MATCH"; state.activeTab = 5; RefreshUI() end,
      },
    })
  end

  list:Finish()
end

-- ============================================================================
-- 声望公共格式化与查询工具（供半人马阵营卡与声望页签共用）
-- ============================================================================
local RepUI = {
  TIERS = {
    { 42000, "崇拜" },
    { 21000, "崇敬" },
    { 9000, "尊敬" },
    { 3000, "友善" },
    { 0, "中立" },
    { -3000, "冷淡" },
    { -6000, "敌对" },
    { -42000, "仇恨" },
  },
  NEXT_TIERS = { 3000, 9000, 21000, 42000 },
}

function RepUI.Label(value)
  for _, tier in ipairs(RepUI.TIERS) do
    if value >= tier[1] then return tier[2] end
  end
  return "仇恨"
end

function RepUI.Color(value)
  if value >= 9000 then return "|cff00ff00" end
  if value >= 3000 then return "|cff66ff66" end
  if value >= 0 then return "|cffffd100" end
  if value >= -6000 then return "|cffff8800" end
  return "|cffff5555"
end

function RepUI.FormatNumber(value)
  local n = math.floor(tonumber(value) or 0)
  local sign = (n < 0) and "-" or ""
  local digits = tostring(math.abs(n))
  local out = string.reverse(digits)
  out = string.gsub(out, "(%d%d%d)", "%1,")
  out = string.reverse(out)
  out = string.gsub(out, "^,", "")
  return sign .. out
end

-- 与既有 IsZoneStepUnlocked 使用同一套取声望方式：GetFactionInfoByID 的第 6 个返回值为当前声望值
function RepUI.GetStanding(factionId)
  local fid = tonumber(factionId)
  if not fid then return nil end
  if GetFactionInfoByID then
    local ok, _, _, _, _, _, barValue = pcall(GetFactionInfoByID, fid)
    if ok and type(barValue) == "number" then return barValue end
  end
  if C_Reputation and C_Reputation.GetFactionDataByID then
    local ok, data = pcall(C_Reputation.GetFactionDataByID, fid)
    if ok and type(data) == "table" and type(data.currentStanding) == "number" then
      return data.currentStanding
    end
  end
  return nil
end

function RepUI.NextTierHint(value)
  for _, threshold in ipairs(RepUI.NEXT_TIERS) do
    if value < threshold then
      return string.format(
        "%s %s（还差 %s）",
        RepUI.Label(threshold),
        RepUI.FormatNumber(threshold),
        RepUI.FormatNumber(threshold - value)
      )
    end
  end
  return nil
end

-- ============================================================================
-- 凄凉之地 · 半人马阵营任务卡（吉尔吉斯 / 玛格拉姆二选一）
-- 数据来自 Data.factionQuests；运行时读取 92/93 两族声望，只展开玩家倾向的一方，
-- 未达门槛的阶段只留一行「还差多少」，已完成步骤折叠成计数。
-- ============================================================================
local function RenderCentaurFactionCard(list, level, targetDef)
  local CENTAUR_FACTION_GELKIS = 92
  local CENTAUR_FACTION_MAGRAM = 93
  local CENTAUR_PROFESSION_EN = {
    ["附魔"] = "Enchanting",
    ["裁缝"] = "Tailoring",
    ["制皮"] = "Leatherworking",
    ["炼金术"] = "Alchemy",
    ["工程学"] = "Engineering",
    ["锻造"] = "Blacksmithing",
  }

  -- 渲染一个阶段的任务；返回 已显示/已完成/未达门槛/专业不符 四项计数
  local function RenderCentaurQuestStage(lines, quests, opts)
    local shown, completed, locked, professionHidden = 0, 0, 0, 0
    for _, q in ipairs(quests or {}) do
      local factionOk = (not q.faction) or (q.faction == "both") or (q.faction == opts.faction)
      if factionOk then
        local professionOk = true
        if q.profession then
          professionOk = HasPlayerProfession(opts.profs, q.profession, CENTAUR_PROFESSION_EN[q.profession])
        end
        if not professionOk then
          professionHidden = professionHidden + 1
        else
          local isDone = IsQuestCompletedById(q.id)
          local gateOk = true
          if opts.minRep and opts.standing < opts.minRep then gateOk = false end
          if q.minRep and opts.standing < q.minRep then gateOk = false end
          if q.neutralOnly and opts.standing < 0 then gateOk = false end
          if isDone and not q.repeatable then
            completed = completed + 1
          elseif not gateOk and not q.showWhenLocked then
            locked = locked + 1
          else
            local info = GetQuestieQuestInfo(q.id)
            local questObj = {
              id = q.id,
              name = q.name,
              level = q.level or (info and info.level) or opts.level,
              faction = "both",
              zone = (info and info.zone) or "凄凉之地",
              npc = info and info.npc or nil,
              x = info and info.x or nil,
              y = info and info.y or nil,
            }
            -- 可重复任务交过一次不应置灰，继续用黄色提示还能再交
            local link = FormatQuestLink(questObj, opts.level, "凄凉之地", nil, q.repeatable and false or nil)
            local parts = { link }
            local tags = {}
            if q.repeatable then table.insert(tags, "|cffff8800[可重复]|r") end
            if q.items and #q.items > 0 then table.insert(tags, "|cff00aaff[交物品]|r") end
            if q.profession then table.insert(tags, string.format("|cffc79c6e[%s]|r", q.profession)) end
            if q.elite then table.insert(tags, "|cffff5555[精英]|r") end
            if not gateOk and q.showWhenLocked and q.minRep then
              table.insert(tags, string.format(
                "|cff8899aa[需%s %s 后交付]|r",
                RepUI.Label(q.minRep),
                RepUI.FormatNumber(q.minRep)
              ))
            end
            if #tags > 0 then table.insert(parts, table.concat(tags, "")) end
            if q.rep then
              table.insert(parts, string.format("|cff00ff00+%s|r", RepUI.FormatNumber(q.rep)))
            end
            if q.otherRep then
              table.insert(parts, string.format("|cffff5555对方 %s|r", RepUI.FormatNumber(q.otherRep)))
            end
            if q.items and #q.items > 0 then
              local itemTexts = {}
              for _, item in ipairs(q.items) do
                table.insert(itemTexts, string.format("%d×%s", item.count or 1, FormatItemLink(item.id, item.name)))
              end
              table.insert(parts, "交 " .. table.concat(itemTexts, "、"))
            end
            if q.note and q.note ~= "" then
              table.insert(parts, "|cff99aabb" .. q.note .. "|r")
            end
            table.insert(lines, "  · " .. table.concat(parts, "  "))
            shown = shown + 1
          end
        end
      end
    end
    return shown, completed, locked, professionHidden
  end

  local lvl = tonumber(level) or state.level or 1
  local def = targetDef
  if type(def) ~= "table" then
    local defs = Data and Data.factionQuests
    if type(defs) ~= "table" or #defs == 0 then return 0 end
    def = defs[1]
  end
  if type(def) ~= "table" then return 0 end

  local gelkis = RepUI.GetStanding(CENTAUR_FACTION_GELKIS)
  local magram = RepUI.GetStanding(CENTAUR_FACTION_MAGRAM)
  local hasRep = (type(gelkis) == "number") or (type(magram) == "number")
  gelkis = tonumber(gelkis) or 0
  magram = tonumber(magram) or 0

  local gelkisStarted = IsQuestCompletedById(1368) or IsQuestCompletedById(1382)
    or IsQuestActiveById(1368) or IsQuestActiveById(1382)
  local magramStarted = IsQuestCompletedById(1367) or IsQuestCompletedById(1385)
    or IsQuestActiveById(1367) or IsQuestActiveById(1385)
  -- 声望优先决定倾向；任务接取/完成记录只在双方声望完全相等时作为辅助信息。
  -- 双方都是 0（未选边）时不折叠任何一方，并列提示先选边。
  local mainFactionId
  if gelkis ~= magram then
    mainFactionId = (gelkis > magram) and CENTAUR_FACTION_GELKIS or CENTAUR_FACTION_MAGRAM
  elseif gelkisStarted and not magramStarted then
    mainFactionId = CENTAUR_FACTION_GELKIS
  elseif magramStarted and not gelkisStarted then
    mainFactionId = CENTAUR_FACTION_MAGRAM
  end
  local committed = mainFactionId ~= nil and (gelkis ~= 0 or magram ~= 0)

  -- 搜索：把任务/物品名一并纳入，避免搜索「图腾」「破碎之泪」时卡片被漏掉
  local searchBlob = (def.zone or "") .. " " .. (def.title or "") .. " " .. (def.summary or "")
  for _, q in ipairs(def.shared or {}) do
    searchBlob = searchBlob .. " " .. (q.name or "")
    for _, item in ipairs(q.items or {}) do searchBlob = searchBlob .. " " .. (item.name or "") end
  end
  for _, group in ipairs(def.groups or {}) do
    searchBlob = searchBlob .. " " .. (group.name or "") .. " " .. (group.where or "")
    for _, section in ipairs({ "entry", "friendly", "honored", "repeatable" }) do
      for _, q in ipairs(group[section] or {}) do
        searchBlob = searchBlob .. " " .. (q.name or "")
        for _, item in ipairs(q.items or {}) do searchBlob = searchBlob .. " " .. (item.name or "") end
      end
    end
  end
  if not MatchesSearch(searchBlob) then return 0 end

  local profs = GetPlayerProfessions()
  local lines = { def.summary or "" }
  local function repText(label, value)
    return string.format(
      "%s%s|r %s (%s)",
      RepUI.Color(value),
      label,
      RepUI.Label(value),
      RepUI.FormatNumber(value)
    )
  end
  table.insert(lines, "|cff99e6ff你的声望:|r " .. repText("吉尔吉斯", gelkis) .. "   ·   " .. repText("玛格拉姆", magram))
  if not hasRep then
    table.insert(lines, "|cff99aabb无法读取两族声望，以下按中立展示；请确认客户端 GetFactionInfoByID 可用。|r")
  end

  local function findGroup(factionId)
    for _, group in ipairs(def.groups or {}) do
      if tonumber(group.factionId) == factionId then return group end
    end
    return nil
  end
  local function standingOf(factionId)
    return (factionId == CENTAUR_FACTION_GELKIS) and gelkis or magram
  end

  local sharedLines = {}
  local sharedShown, sharedDone, sharedLocked, sharedProf = RenderCentaurQuestStage(sharedLines, def.shared, {
    standing = gelkis,
    faction = state.faction,
    profs = profs,
    level = lvl,
  })
  if sharedShown > 0 or sharedDone > 0 then
    table.insert(lines, "")
    table.insert(lines, "|cff00ffcc[公共任务]|r |cff8899aa两族通用，先做雕刻图腾解锁「收买友谊」|r")
    if sharedDone > 0 then
      table.insert(lines, string.format("  |cff888888✓ 已完成 %d 步|r", sharedDone))
    end
    for _, line in ipairs(sharedLines) do table.insert(lines, line) end
    if sharedLocked > 0 then
      table.insert(lines, "  |cff8899aa部分任务需先把对应部族声望恢复到中立|r")
    end
    if sharedProf > 0 then
      table.insert(lines, string.format("  |cff8899aa另有 %d 个任务需对应专业|r", sharedProf))
    end
  end

  local function renderGroup(group)
    local factionId = tonumber(group.factionId)
    local standing = standingOf(factionId)
    table.insert(lines, "")
    local header = string.format("|cff00ffcc[%s]|r", group.name or "")
    if group.where and group.where ~= "" then
      header = header .. " |cff8899aa" .. group.where .. "|r"
    end
    table.insert(lines, header)
    local nextHint = RepUI.NextTierHint(standing)
    if nextHint then
      table.insert(lines, "  |cff8899aa下一门槛: " .. nextHint .. "|r")
    end
    local totalCompleted = 0
    for _, stage in ipairs({ "entry", "friendly", "honored" }) do
      for _, q in ipairs(group[stage] or {}) do
        if IsQuestCompletedById(q.id) and not q.repeatable then
          totalCompleted = totalCompleted + 1
        end
      end
    end
    if totalCompleted > 0 then
      table.insert(lines, string.format("  |cff888888✓ 已完成 %d 步|r", totalCompleted))
    end

    local stages = {
      { key = "entry", label = "入门 · 起步任务", minRep = nil },
      { key = "friendly", label = "友善阶段", minRep = 3000 },
      { key = "honored", label = "尊敬阶段", minRep = 9000 },
    }
    for _, stage in ipairs(stages) do
      local quests = group[stage.key]
      if type(quests) == "table" and #quests > 0 then
        if stage.minRep and standing < stage.minRep then
          table.insert(lines, string.format(
            "  |cff8899aa[%s] 未解锁：需 %s %s，当前 %s，还差 %s|r",
            stage.label,
            RepUI.Label(stage.minRep),
            RepUI.FormatNumber(stage.minRep),
            RepUI.FormatNumber(standing),
            RepUI.FormatNumber(stage.minRep - standing)
          ))
        else
          local stageLines = {}
          local shown, _, locked, professionHidden = RenderCentaurQuestStage(stageLines, quests, {
            standing = standing,
            faction = state.faction,
            profs = profs,
            level = lvl,
            minRep = stage.minRep,
          })
          if shown > 0 or professionHidden > 0 then
            table.insert(lines, string.format("  |cff00ffcc[%s]|r", stage.label))
            for _, line in ipairs(stageLines) do table.insert(lines, line) end
            if professionHidden > 0 then
              table.insert(lines, string.format("  |cff8899aa另有 %d 个专业配方任务需对应专业|r", professionHidden))
            end
            if locked > 0 then
              table.insert(lines, string.format("  |cff8899aa另有 %d 个任务需相应声望|r", locked))
            end
          end
        end
      end
    end

    local repQuests = group.repeatable
    if type(repQuests) == "table" and #repQuests > 0 then
      if standing >= 42000 then
        table.insert(lines, "  |cffff8800[可重复]|r |cff888888已崇拜，无需再交图腾|r")
      else
        local repLines = {}
        local shown = RenderCentaurQuestStage(repLines, repQuests, {
          standing = standing,
          faction = state.faction,
          profs = profs,
          level = lvl,
          minRep = nil,
        })
        if shown > 0 then
          table.insert(lines, "  |cffff8800[可重复]|r")
          for _, line in ipairs(repLines) do table.insert(lines, line) end
          local requires = repQuests[1].requires or {}
          if #requires > 0 then
            local unlocked = false
            for _, reqId in ipairs(requires) do
              if IsQuestCompletedById(reqId) then
                unlocked = true
                break
              end
            end
            if not unlocked then
              table.insert(lines, string.format(
                "  |cffff8800↳ 需先完成「收买友谊：%s」|r",
                group.name or ""
              ))
            end
          end
        end
      end
    end
  end

  if committed then
    local mainGroup = findGroup(mainFactionId)
    local otherGroup = findGroup(mainFactionId == CENTAUR_FACTION_GELKIS and CENTAUR_FACTION_MAGRAM or CENTAUR_FACTION_GELKIS)
    if mainGroup then
      table.insert(lines, string.format(
        "|cff99e6ff当前倾向:|r %s|cff8899aa（已选边；另一端任务已折叠）|r",
        mainGroup.name or ""
      ))
      renderGroup(mainGroup)
      if otherGroup then
        local otherStanding = standingOf(tonumber(otherGroup.factionId))
        table.insert(lines, string.format(
          "|cff8899aa%s：%s (%s) · 已折叠（与当前选择冲突，做其任务会清空%s声望）|r",
          otherGroup.name or "",
          RepUI.Label(otherStanding),
          RepUI.FormatNumber(otherStanding),
          mainGroup.name or ""
        ))
      end
    end
  else
    table.insert(lines, "|cffff8800尚未选边：两族初始中立，做任意一族的任务都会大幅降低另一族声望；先选定一边再投入。|r")
    for _, group in ipairs(def.groups or {}) do renderGroup(group) end
  end

  list:Add({
    title = string.format(
      "|cff00ffcc[声望] %s|r |cffffd100(Lv.%d-%d)|r",
      (def.title and def.title ~= "") and def.title or "凄凉之地 · 半人马阵营",
      def.minLevel or 30,
      def.maxLevel or 45
    ),
    body = table.concat(lines, "\n"),
    theme = "zone",
    badge = "按声望过滤",
  })
  return 1
end

local function RenderTabRoutes()
  local list = CreateCardList(6)
  local lvl = state.level
  local route = GetCurrentRoute()
  local cls = GetCurrentClassData()
  local spec = GetCurrentSpecData()
  if not route or not route.bands then
    list:Finish()
    return
  end

  local recProfs = (spec and spec.recommendedProfs) or ""
  local matchedClassRuns = GetCurrentClassRuns(route, cls, state.faction)
  local phase = GetMatchedPhase(spec, lvl)
  local isMatchMode = (state.routeFilter == "MATCH") and (not state.searchQuery or state.searchQuery == "")
  local toggle = FilterToggle("routeFilter", {
    {
      value = "MATCH",
      btnLabel = "查看 1-60 全程",
      desc = string.format("已按您的角色自动聚焦 |cffffd100Lv.%d|r 当前阶段及后续衔接路线（点击右上角按钮可展开 1–60 全部 %d 个阶段）", lvl, #route.bands),
    },
    {
      value = "ALL",
      btnLabel = "仅看当前匹配",
      desc = string.format("当前显示 1–60 级完整全部 %d 个阶段（点击右上角按钮可聚焦回当前角色等级阶段）", #route.bands),
    },
  })

  -- 标题里已写明「路线 · 职业(专精) · 当前等级」，正文不再重复同一串身份信息
  local headerLines = {
    string.format(
      "|cff99e6ff阵营:|r %s%s",
      FactionTag(route.faction),
      (state.zone and state.zone ~= "") and ("  ·  |cff00ff96当前区域:|r " .. state.zone) or ""
    ),
    toggle.desc,
  }
  if recProfs ~= "" then
    table.insert(headerLines, "|cff00ff96专精推荐练级专业:|r " .. recProfs .. "   |cffaaaaaa(路线中带 ★ 标记的专业训练师可顺路学习)|r")
  end

  list:Add({
    title = string.format("|cff00ffcc[路线] %s · %s (%s) 专属升级路线 (当前 Lv.%d)|r", route.name, cls and cls.name or "", spec and spec.name or "", lvl),
    body = table.concat(headerLines, "\n"),
    theme = "header",
    action = toggle.action,
  })

  -- 角色专属职业任务链与当前阶段手法/专精里程碑摘要卡
  -- 这里也承载「后续阶段才会出现的职业任务」：该窗口必须与下方阶段卡的展示范围
  -- （当前等级起 16 级内）保持一致，否则这些任务会从整页消失。
  local LOOKAHEAD = 16
  local charGuideLines = {}
  local milestoneFilter = BuildMilestoneFilter()
  if phase then
    table.insert(charGuideLines, string.format(
      "|cff71d5ff[战斗] 当前等级 (%s·Lv.%d-%d) 练级手法:|r 常驻 %s  |  起手 %s  |  循环 %s",
      spec and spec.name or "", phase.from or 1, phase.to or 60, phase.keep or "无", phase.open or "平砍", phase.cycle or "平砍"
    ))
  end
  if #matchedClassRuns > 0 then
    for _, cr in ipairs(matchedClassRuns) do
      local crTo = cr.to or cr.level or 60
      if not ShouldSkipClassRun(cr, milestoneFilter) and (not isMatchMode or (cr.level <= lvl + LOOKAHEAD and crTo >= lvl - 2)) then
        local activeTag = (lvl >= cr.level and lvl <= crTo + 2) and "|cff00ff00★[当前可做]|r " or ""
        local crLine, crTree = FormatClassRunLine(cr, {
          prefix = "  - " .. activeTag,
          tag = string.format("|cff00ffcc[Lv.%d %s·%s职业任务]|r", cr.level, route.name, cls and cls.name or ""),
          npcPrefix = "起始: ",
          indent = "      ",
        })
        table.insert(charGuideLines, crLine)
        if crTree then table.insert(charGuideLines, crTree) end
      end
    end
  end
  if spec and spec.musts then
    for _, m in ipairs(spec.musts) do
      local mLvl = m.level or 1
      if (not isMatchMode or (mLvl >= lvl - 2 and mLvl <= lvl + LOOKAHEAD)) and not ShouldSkipMilestone(m, milestoneFilter) then
        local activeTag = (mLvl == lvl) and "|cff00ff00★[本级必做]|r " or ""
        table.insert(charGuideLines, string.format("  - %s|cffffd100[Lv.%d %s要点]|r %s", activeTag, mLvl, spec.name or "专精", LinkifyInlineCoords(m.text or "", "", spec.name or "要点")))
      end
    end
  end
  if #charGuideLines > 0 then
    list:Add({
      -- 上一张卡已经写明「路线 · 职业(专精)」，这里只说明本卡内容，不再重复同一串身份信息
      title = "|cff00ff96★ 核心职业任务与专精里程碑|r",
      body = table.concat(charGuideLines, "\n"),
      theme = "milestone",
      badge = "角色专属匹配",
    })
  end

  -- 整理要渲染的阶段列表：在 MATCH 模式下将当前等级所在阶段置顶，并展示后续衔接阶段（过滤已过时的低级阶段）
  local orderedBands = {}
  if isMatchMode then
    local currentBands = {}
    local upcomingBands = {}
    for idx, b in ipairs(route.bands) do
      if lvl >= b.from and lvl <= b.to then
        table.insert(currentBands, { idx = idx, band = b })
      elseif b.from > lvl and b.from <= lvl + LOOKAHEAD then
        table.insert(upcomingBands, { idx = idx, band = b })
      end
    end
    for _, item in ipairs(currentBands) do table.insert(orderedBands, item) end
    for _, item in ipairs(upcomingBands) do table.insert(orderedBands, item) end
    if #orderedBands == 0 then
      for idx, b in ipairs(route.bands) do
        table.insert(orderedBands, { idx = idx, band = b })
      end
    end
  else
    for idx, b in ipairs(route.bands) do
      table.insert(orderedBands, { idx = idx, band = b })
    end
  end

  local shownZoneCards = 0
  local shownZoneNames = {}
  -- 跨阶段去重：同一任务（如「尖啸者的灵魂」同时挂在多个副本名下）只在本页展示一次
  local shownQuestKeys = {}
  -- 这些集合提到循环外：同一航线/同一副本/同一主城备战跨阶段只出现一次，避免逐阶段复读
  local pageSeenDungeon = {}
  local pageSeenCity = {}
  local pageSeenTravel = {}
  -- 区域名也跨阶段去重：只有「本阶段新出现的区域」才在卡片里逐个列出
  local pageSeenZones = {}
  -- 当前阶段卡会完整列出它覆盖的区域，先记为已出现，后续阶段只补新增区域
  for _, item in ipairs(orderedBands) do
    local cb = item.band
    if lvl >= cb.from and lvl <= cb.to then
      for _, z in ipairs(CollectBandZoneNames(cb)) do
        pageSeenZones[z] = true
      end
    end
  end
  for _, entry in ipairs(orderedBands) do
    local b = entry.band
    local stepIdx = entry.idx
    local isCurrent = (lvl >= b.from and lvl <= b.to)
    local hubName = (b.hub and b.hub.name ~= "") and b.hub.name or b.zone
    local matchedTrainer = GetBandTrainer(b, state.classKey, state.faction)
    local searchBlob = (b.zone or "") .. " " .. (hubName or "") .. " " .. ((matchedTrainer and matchedTrainer.name) or "")
    if b.altZones then
      for _, az in ipairs(b.altZones) do
        searchBlob = searchBlob .. " " .. (az.zone or "") .. " " .. (az.hub or "")
      end
    end

    if MatchesSearch(searchBlob) then
      -- 职业任务链与专精要点统一由上方「核心职业任务与专精里程碑」卡展示，
      -- 这里不再重复渲染，避免同一批职业任务在路线页出现两遍。
      local lines = BuildBandLines(b, {
        level = lvl,
        cls = cls,
        spec = spec,
        isMatchMode = isMatchMode,
        skipCompletedQuests = isMatchMode,
        foldQuestSteps = true,
        questIndent = "    ",
        compactZones = not isCurrent,
        shownZones = pageSeenZones,
      })

      -- 穿插本阶段主城副本任务备战、跨区交通航线与推荐进本节点 (timelineSteps)
      local tlSteps = GetBandTimelineSteps(route, b.from, b.to)
      local VIA_LABELS = {
        tram = "矿道地铁",
        boat = "跨海轮船",
        zeppelin = "飞艇航线",
        flight = "飞行航线",
        walk = "陆路转场",
      }
      for _, tl in ipairs(tlSteps) do
        if tl.kind == "city" and tl.city and tl.quests and #tl.quests > 0 then
          local cKey = tl.city .. ":" .. tostring(tl.level)
          if not pageSeenCity[cKey] then
            pageSeenCity[cKey] = true
            local qNames = {}
            for _, cq in ipairs(tl.quests) do
              local cqZone = PickZone(cq, tl.city)
              local cqLink = FormatQuestLink(cq, tl.level or b.from, cqZone)
              local npcInfo = FormatStepNpcInfo(cq, cqZone)
              local npcPart = (npcInfo ~= "") and (" · " .. npcInfo) or ""
              local qKey = tostring(cq.id or cq.name)
              if not shownQuestKeys[qKey] then
                shownQuestKeys[qKey] = true
                table.insert(qNames, string.format("%s (%s%s)", cqLink, cq.dungeon or "", npcPart))
              end
            end
            if #qNames > 0 then
              table.insert(lines, string.format("|cffffa500[主城备战] [Lv.%d %s 副本任务]|r %s", tl.level or b.from, tl.city, table.concat(qNames, " / ")))
            end
          end
        elseif tl.kind == "dungeon" and tl.name and not pageSeenDungeon[tl.name] then
          pageSeenDungeon[tl.name] = true
          local dObj = GetDungeonByIdOrName(tl.dungeonId, tl.name)
          local dEnt = (dObj and dObj.entranceX and dObj.entranceY)
            and FormatNpcMapLink(dObj.entranceZone or dObj.zone, "副本入口", dObj.entranceX, dObj.entranceY, { omitZone = true }) or ""
          table.insert(lines, string.format("|cffff8000[推荐进本] [Lv.%d %s]|r 适龄 Lv.%d-%d (%s%s)", tl.level or b.from, tl.name, tl.minLevel or b.from, tl.maxLevel or b.to, tl.zone or "", dEnt))
        elseif tl.kind == "travel" and (tl.from ~= "" or tl.to ~= "") then
          -- 同一段航线（含反向）只保留第一次出现，跨阶段往返不重复列
          local f, t = tl.from or "", tl.to or ""
          if f > t then f, t = t, f end
          local tKey = f .. "->" .. t .. ":" .. (tl.via or "")
          if not pageSeenTravel[tKey] then
            pageSeenTravel[tKey] = true
            local viaText = VIA_LABELS[tl.via or "walk"] or (tl.via or "转场")
            local destText = (tl.place and tl.place ~= "" and tl.place ~= tl.to) and (tl.to .. "·" .. tl.place) or (tl.to or "")
            local flText = (tl.flightNpc and tl.flightNpc ~= "")
              and (" — 顺路开鸟点: " .. FormatNpcMapLink(tl.flightZone or tl.to, tl.flightNpc, tl.flightX, tl.flightY))
              or ""
            table.insert(lines, string.format("|cff99e6ff[跨区交通] [Lv.%d %s]|r %s -> |cff00ffcc%s|r%s", tl.level or b.from, viaText, tl.from or "起点", destText, flText))
          end
        end
      end

      if b.dungeonQuests and #b.dungeonQuests > 0 then
        for _, dq in ipairs(b.dungeonQuests) do
          local qKey = tostring(dq.id or dq.name)
          if not shownQuestKeys[qKey] then
            shownQuestKeys[qKey] = true
            local dqZone = PickZone(dq, dq.place, b.zone)
            local dqLink = FormatQuestLink(dq, dq.level or b.from, dqZone)
            local npcInfo = FormatStepNpcInfo(dq, dqZone)
            local npcSuffix = (npcInfo ~= "") and (" — " .. npcInfo) or ""
            table.insert(lines, string.format("|cffff8000[本区副本任务 · %s]|r %s%s", dq.dungeon, dqLink, npcSuffix))
          end
        end
      end

      local titlePrefix = isCurrent and "|cff00ff00▶ [当前角色所在阶段]|r " or string.format("|cff8899aa[第%d步]|r ", stepIdx)
      list:Add({
        -- 区域清单交给正文（当前阶段给详细营地，其余阶段给一行），标题只留阶段与等级区间
        title = string.format("%s|cffffd100Lv.%d – %d|r", titlePrefix, b.from, b.to),
        body = table.concat(lines, "\n"),
        theme = isCurrent and "routeCur" or "routeIdle",
        -- 等级区间已在标题里，角标改为区域数量，避免同一行信息重复两遍
        badge = string.format("%d 个适龄区域", #CollectBandZoneNames(b)),
        action = (b.hub and b.hub.x) and {
          label = "标记营地到地图",
          fn = function() SetWaypointOrPrint(b.zone, b.hub.name, b.hub.x, b.hub.y) end,
        } or nil,
      })
    end

    -- 为当前等级所在阶段的多个适龄区域分别展示任务链形式的适合可接任务（已全部完成过滤，部分完成自动折叠前置）
    if isCurrent and shownZoneCards < 6 then
      for _, zInfo in ipairs(CollectBandZoneInfos(b, lvl)) do
        if shownZoneCards >= 6 then break end
        if zInfo.from <= lvl and lvl <= zInfo.to and not shownZoneNames[zInfo.zone] then
          local groups = GetZoneSuitableQuestChains(zInfo.zone, lvl)
          if #groups > 0 then
            local zoneSearchBlob = (zInfo.zone or "") .. " " .. (zInfo.hub or "") .. " " .. (zInfo.note or "")
            for _, grp in ipairs(groups) do
              for _, gq in ipairs(grp.quests or {}) do
                zoneSearchBlob = zoneSearchBlob .. " " .. (gq.name or "")
                if type(gq.steps) == "table" then
                  for _, st in ipairs(gq.steps) do
                    zoneSearchBlob = zoneSearchBlob .. " " .. (st.name or "")
                  end
                end
              end
            end
            if MatchesSearch(zoneSearchBlob) then
              shownZoneNames[zInfo.zone] = true
              shownZoneCards = shownZoneCards + 1
              local zLines = {}
              if zInfo.note and zInfo.note ~= "" then
                table.insert(zLines, "|cff99e6ff区域指引:|r " .. LinkifyInlineCoords(zInfo.note, zInfo.zone, (zInfo.hub ~= "" and zInfo.hub or zInfo.zone)))
              end
              RenderQuestGroups(zLines, groups, {
                useMatched = true,
                fallbackLevel = zInfo.from,
                fallbackZone = zInfo.zone,
                foldZone = zInfo.zone,
                singleChainWord = "任务链",
              })
              local hubPart = (zInfo.hub and zInfo.hub ~= "") and (" · " .. zInfo.hub) or ""
              list:Add({
                title = string.format("|cff00ffcc▶ [区域任务链] %s|r%s  |cffffd100(Lv.%d-%d)|r", zInfo.zone, hubPart, zInfo.from, zInfo.to),
                body = table.concat(zLines, "\n"),
                theme = "zone",
                badge = string.format("可接 %d 条任务链", #groups),
                action = (zInfo.x and zInfo.y) and {
                  label = "标记营地到地图",
                  fn = function()
                    SetWaypointOrPrint(zInfo.hubZone, (zInfo.hub ~= "" and zInfo.hub or zInfo.zone), zInfo.x, zInfo.y)
                  end,
                } or nil,
              })
            end
          end
        end
      end
    end
  end

  list:Finish()
end

local function RenderTabClassAndTalents()
  local list = CreateCardList(6)
  local lvl = state.level
  local route = GetCurrentRoute()
  local cls = GetCurrentClassData()
  local spec = GetCurrentSpecData()
  if not cls or not spec then
    list:Finish()
    return
  end

  local isMatchMode = (state.talentFilter == "MATCH") and (not state.searchQuery or state.searchQuery == "")
  local toggle = FilterToggle("talentFilter", {
    {
      value = "MATCH",
      btnLabel = "查看 1-60 全程",
      desc = string.format("已自动过滤 |cffffd100Lv.%d|r 以下已过时的循环阶段、已点天赋及低级职业任务（点击右上角按钮可展开 1–60 全部）", lvl),
    },
    {
      value = "ALL",
      btnLabel = "仅看当前匹配",
      desc = "当前显示 1–60 级完整循环阶段、逐级天赋加点表与全部职业任务链（点击右上角按钮可聚焦当前等级）",
    },
  })

  list:Add({
    title = string.format("|cff00ffcc[职业] %s · %s 战斗循环、天赋与职业任务 (当前 Lv.%d)|r", cls.name, spec.name, lvl),
    body = toggle.desc,
    theme = "header",
    action = toggle.action,
  })

  -- 1. 专精循环各阶段
  -- 匹配模式下：当前阶段展开完整循环，后续阶段不再各自占一张大卡（内容高度重复），
  -- 合并为一张「后续循环变化」卡，只列出相对上一阶段发生变化的部分。
  local phases = spec.phases or {}
  local currentPhase, futurePhases = nil, {}
  for _, p in ipairs(phases) do
    if lvl >= (p.from or 1) and lvl <= (p.to or 60) then
      currentPhase = p
    elseif (p.from or 1) > lvl then
      table.insert(futurePhases, p)
    end
  end

  local function PhaseLines(p, includeNote)
    local lines = {
      "|cff00ff96【常驻保持】|r " .. (p.keep or "无"),
      "|cffffa500【起手技能】|r " .. (p.open or "无"),
      "|cff71d5ff【核心循环】|r " .. (p.cycle or "无"),
    }
    if includeNote and p.note and p.note ~= "" then
      table.insert(lines, "\n" .. LinkifyInlineCoords(p.note, "", spec.name or "要点"))
    end
    return lines
  end

  local function AddPhaseCard(p, isCurrent)
    list:Add({
      title = string.format("%s|cff71d5ff[战斗] %s·%s 野外循环 (Lv.%d - %d)|r", isCurrent and "|cff00ff00▶ [当前阶段]|r " or "", cls.name, spec.name, p.from, p.to),
      body = table.concat(PhaseLines(p, true), "\n"),
      theme = isCurrent and "combatCur" or "combatSub",
      -- 标题已带 Lv 区间，角标只标阶段身份
      badge = isCurrent and "当前循环" or "后续阶段",
    })
  end

  -- 取「相对上一阶段新增」的说明句子，避免同一段循环说明在每个阶段复述
  local function NewSentences(prevNote, curNote, maxCount)
    if not curNote or curNote == "" then return {}, false end
    local out, truncated = {}, false
    local startAt = 1
    while startAt <= #curNote do
      local p = string.find(curNote, "。", startAt, true)
      local sentence = string.sub(curNote, startAt, (p and (p + 2)) or #curNote)
      sentence = string.gsub(sentence, "^%s+", "")
      if sentence ~= "" and (not prevNote or not string.find(prevNote, sentence, 1, true)) then
        if maxCount and #out >= maxCount then
          truncated = true
          break
        end
        table.insert(out, sentence)
      end
      if not p then break end
      startAt = p + 3 -- 「。」占 3 字节
    end
    return out, truncated
  end

  if isMatchMode then
    if currentPhase and MatchesSearch((currentPhase.keep or "") .. " " .. (currentPhase.open or "") .. " " .. (currentPhase.cycle or "") .. " " .. (currentPhase.note or "")) then
      AddPhaseCard(currentPhase, true)
    end
    if #futurePhases > 0 then
      local fLines = {}
      local prev = currentPhase
      for _, p in ipairs(futurePhases) do
        local changes = {}
        -- 没有「上一阶段」时（当前等级低于所有阶段）就完整列出三项基础信息
        if not prev or (p.keep or "") ~= (prev.keep or "") then
          table.insert(changes, string.format("|cff00ff96常驻|r %s", p.keep or "无"))
        end
        if not prev or (p.open or "") ~= (prev.open or "") then
          table.insert(changes, string.format("|cffffa500起手|r %s", p.open or "无"))
        end
        if not prev or (p.cycle or "") ~= (prev.cycle or "") then
          table.insert(changes, string.format("|cff71d5ff循环|r %s", p.cycle or "无"))
        end
        local newNotes, notesTruncated = NewSentences(prev and prev.note or nil, p.note, 2)
        local line = string.format("|cffffd100Lv.%d-%d|r ", p.from or 1, p.to or 60)
        if #changes > 0 then
          line = line .. table.concat(changes, "  ")
        else
          line = line .. "|cff8899aa循环不变|r"
        end
        if #newNotes > 0 then
          local noteText = table.concat(newNotes, "")
          if notesTruncated then noteText = noteText .. "…" end
          line = line .. "  |cffaaaabb" .. LinkifyInlineCoords(noteText, "", spec.name or "要点") .. "|r"
        end
        table.insert(fLines, line)
        prev = p
      end
      if #fLines > 0 then
        list:Add({
          title = string.format("|cffffd100★ %s·%s 后续循环阶段变化|r", cls.name, spec.name),
          body = "|cff99e6ff仅列出相对上一阶段有变化的技能与新增说明，完整循环路径可点上角按钮查看全程。|r\n\n" .. table.concat(fLines, "\n"),
          theme = "combatSub",
          badge = string.format("%d 个后续阶段", #futurePhases),
        })
      end
    end
  else
    for _, p in ipairs(phases) do
      local isCurrent = (lvl >= (p.from or 1) and lvl <= (p.to or 60))
      local textBlob = (p.keep or "") .. " " .. (p.open or "") .. " " .. (p.cycle or "") .. " " .. (p.note or "")
      if MatchesSearch(textBlob) then
        AddPhaseCard(p, isCurrent)
      end
    end
  end

  -- 2. 10-60 级逐级天赋加点表
  if spec.steps and #spec.steps > 0 then
    local stepLines = {}
    for _, s in ipairs(spec.steps) do
      if not isMatchMode or (s.level or 1) >= lvl then
        local mark = (s.level == lvl) and "|cff00ff00★ [当前等级]|r " or (s.level < lvl and "|cff888888[已点]|r " or "   ")
        table.insert(stepLines, string.format("%s|cffffd100Lv.%2d:|r [%s] |cff00ffcc%s|r (%d/%d)", mark, s.level, s.tree, s.name, s.rank, s.max))
      end
    end
    if #stepLines > 0 then
      local titleStr = isMatchMode
        and string.format("|cffffd100★ %s·%s Lv.%d–60 后续天赋加点顺序 (剩余 %d 点)|r", cls.name, spec.name, math.max(10, lvl), #stepLines)
        or string.format("|cffffd100★ %s·%s 10–60 级逐级天赋加点顺序 (共 %d 点)|r", cls.name, spec.name, #spec.steps)
      list:Add({
        title = titleStr,
        body = table.concat(stepLines, "\n"),
        theme = "route",
        badge = isMatchMode and string.format("Lv.%d-60", math.max(10, lvl)) or "Lv.10-60 完整路径",
      })
    end
  end

  -- 3. 职业专属任务链（优先展示当前种族专属职业任务链）
  local matchedRuns = GetCurrentClassRuns(route, cls, state.faction)
  local runsToRender = (#matchedRuns > 0) and matchedRuns or (cls.classRuns or {})
  if #runsToRender > 0 then
    local crLines = {}
    for _, cr in ipairs(runsToRender) do
      local crTo = cr.to or cr.level or 60
      if not isMatchMode or crTo >= lvl - 2 then
        local fTag = FactionTag(cr.faction, true)
        local rTag = (cr.raceName and cr.raceName ~= "") and ("|cff99e6ff[" .. cr.raceName .. "]|r ") or ""
        local teachTag = (cr.teaches and cr.teaches ~= "") and (" -> 学会 |cff71d5ff[" .. cr.teaches .. "]|r") or ""
        local stepCount = (type(cr.steps) == "table") and #cr.steps or 0
        -- 标题写成「任务链 N 步」而不是再放一个与末步同名的任务链接，避免同一任务在卡内出现两次
        local chainName = (cr.name and cr.name ~= "") and tostring(cr.name) or "职业任务链"
        local chainLabel = stepCount > 1
          and string.format("|cffffd100%s|r |cff8899aa任务链 %d 步|r", chainName, stepCount)
          or FormatQuestLink(cr, cr.level, (cr.steps and cr.steps[1] and cr.steps[1].zone) or "", nil, IsQuestCompleted(cr))
        table.insert(crLines, string.format("%s %sLv.%d %s%s", fTag, rTag, cr.level, chainLabel, teachTag))
        for idx, st in ipairs(cr.steps or {}) do
          local stZone = PickZone(st, st.place)
          local stLink = FormatQuestLink(st, cr.level, stZone)
          local npcInfo = FormatStepNpcInfo(st, stZone)
          local npcSuffix = (npcInfo ~= "") and (" — " .. npcInfo) or ""
          table.insert(crLines, string.format("    %d. %s%s", idx, stLink, npcSuffix))
        end
      end
    end
    if #crLines > 0 then
      list:Add({
        title = string.format("|cff00ffcc[任务链] %s·%s 职业任务链与坐标指引|r", cls.name, spec and spec.name or ""),
        body = table.concat(crLines, "\n"),
        theme = "legacy",
      })
    end
  end

  list:Finish()
end

local function RenderTabMacros()
  local list = CreateCardList(6)
  local cls = GetCurrentClassData()
  local rawMacros = (cls and cls.macros) or {}

  -- 按需求等级从低到高整理宏列表（浅拷贝，避免改动原始数据）：
  -- 等级相同时按标题排序，保证展示顺序稳定；无等级视为 1 级。
  local macros = {}
  for _, m in ipairs(rawMacros) do
    macros[#macros + 1] = m
  end
  table.sort(macros, function(a, b)
    local la = tonumber(a and a.level) or 1
    local lb = tonumber(b and b.level) or 1
    if la ~= lb then return la < lb end
    return tostring(a and a.title or "") < tostring(b and b.title or "")
  end)

  list:Add({
    title = string.format("|cff00ffcc[宏库] %s 实用一键宏命令库 (共 %d 个)|r", cls and cls.name or "", #macros),
    body = "内置精选职业宏库。游戏内点击每个宏卡片右上角的 |cff00ff00[一键写入宏]|r 按钮，即可直接将该宏创建到您的游戏角色宏槽位中（输入 |cffffd100/macro|r 即可拖入技能栏）；战斗中点击会弹出 Ctrl+C 复制窗口。网页版无法写入游戏宏槽位，请直接复制宏代码。",
    theme = "header",
    badge = "支持一键生成",
  })

  for _, m in ipairs(macros) do
    if MatchesSearch((m.title or "") .. " " .. (m.desc or "") .. " " .. (m.code or "")) then
      local newBadge = m.isForeverNew and " |cff00ffcc[★无限服专属]|r" or ""
      local lvlColor = (state.level >= (m.level or 1)) and "|cff00ff00" or "|cffff8800"
      local bodyLines = {
        "|cff99e6ff说明:|r " .. (m.desc or ""),
        "\n|cffffd100宏代码:|r\n|cffaaffaa" .. (m.code or "") .. "|r",
      }
      list:Add({
        title = string.format("%sLv.%d|r  ·  |cffffd100%s|r%s", lvlColor, m.level or 1, m.title or "宏", newBadge),
        body = table.concat(bodyLines, "\n"),
        theme = m.isForeverNew and "macroNew" or "macro",
        action = {
          label = "一键写入宏",
          fn = function() CreateOrUpdateGameMacro(m.title, m.code) end,
        },
      })
    end
  end

  list:Finish()
end

-- 无限服速查：只收录无限服客户端专属 CVar、本百科页签直达与配套插件入口，支持搜索与一键复制
local function RenderTabCommands()
  local list = CreateCardList(6)

  list:Add({
    title = "|cff00ffcc[无限服速查] 客户端 CVar 与百科 / 配套插件命令|r",
    body = "只收录在《魔兽世界：无限服》里真正用得上的命令：无限服客户端专属画面/导航设置、本百科页签直达，以及本站精选配套插件的入口。每条都可点击右上角 |cff00ff00[复制命令]|r 后粘贴到聊天框回车执行。|cffff8800注意：/console 属于客户端设置，请在非战斗中执行；改动前可先用 /dump GetCVar(\"变量名\") 记录原值。|r",
    theme = "cmdHeader",
    badge = "共 " .. tostring(#COMMON_COMMANDS) .. " 条",
  })

  for _, c in ipairs(COMMON_COMMANDS) do
    if MatchesSearch((c.title or "") .. " " .. (c.category or "") .. " " .. (c.code or "") .. " " .. (c.desc or "") .. " " .. (c.note or "")) then
      local bodyLines = {
        "|cff99e6ff分类:|r " .. (c.category or "其他"),
        "|cff99e6ff说明:|r " .. (c.desc or ""),
        "\n|cffffd100命令:|r\n|cffaaffaa" .. (c.code or "") .. "|r",
        "\n|cff888888注意:|r |cffbbbbbb" .. (c.note or "") .. "|r",
      }
      list:Add({
        title = "|cff00ccff" .. (c.title or "命令") .. "|r",
        body = table.concat(bodyLines, "\n"),
        theme = "command",
        action = {
          label = "复制命令",
          fn = function() ShowCopyMacroDialog(c.title or "命令", c.code or "") end,
        },
      })
    end
  end

  list:Finish()
end

local function RenderTabDungeons()
  local list = CreateCardList(6)
  local allDungeons = Data.dungeons or {}
  local newDungeonNames = {}
  for _, d in ipairs(allDungeons) do
    if d.isNew then
      table.insert(newDungeonNames, d.name)
    end
  end
  local newCount = #newDungeonNames
  local toggle = FilterToggle("dungeonFilter", {
    { value = "MATCH", btnLabel = "看无限服新本", desc = string.format("当前筛选: 适合 Lv.%d 的地下城", state.level) },
    { value = "NEW", btnLabel = "显示全部副本", desc = string.format("当前筛选: ★ 无限服新增地下城与团本 (%d个)", newCount) },
    { value = "ALL", btnLabel = "看当前等级", desc = string.format("当前筛选: 全部 %d 个地下城与团本", #allDungeons) },
  })

  list:Add({
    title = "|cffff8000[副本] 艾泽拉斯地下城与无限服新副本百科 (" .. toggle.desc .. ")|r",
    body = string.format(
      "包含共 |cffffd100%d|r 个地下城与团本（含《魔兽世界：无限服》|cff00ffcc%d 个新增副本|r：%s）及必接副本任务与入口位置。点击 |cff00ffcc青色地点链接|r 可记录到世界地图（右键发送到聊天框），点击 |cffffff00黄色任务|r 发送任务链接到聊天框（右键标记任务地点）。",
      #allDungeons,
      newCount,
      #newDungeonNames > 0 and table.concat(newDungeonNames, "、") or "暂无"
    ),
    theme = { border = { 0.95, 0.55, 0.15, 0.9 }, bg = { 0.13, 0.08, 0.05, 0.92 } },
    action = toggle.action,
  })

  local shownCount = 0
  local levelMatchedCount = 0
  local hiddenCompletedCount = 0
  -- 副本分区之间常有共享任务（血色军械库/大教堂都挂「以圣光之名」），首个分区展开，其余只引用
  local shownQuestDungeon = {}
  for _, d in ipairs(Data.dungeons or {}) do
    local passFilter = true
    local allDone = IsDungeonAllQuestsCompleted(d, state.faction)
    if state.dungeonFilter == "MATCH" then
      local levelOk = (state.level >= (d.minLevel - 3) and state.level <= (d.maxLevel + 3))
      if levelOk then
        levelMatchedCount = levelMatchedCount + 1
        if allDone then
          hiddenCompletedCount = hiddenCompletedCount + 1
        end
      end
      passFilter = levelOk and (not allDone)
    elseif state.dungeonFilter == "NEW" then
      passFilter = d.isNew and true or false
    end

    if passFilter and MatchesSearch((d.name or "") .. " " .. (d.zone or "") .. " " .. (d.summary or "")) then
      shownCount = shownCount + 1
      local lines = {}
      local zoneText = LinkifyInlineCoords(d.zone or "", d.entranceZone or d.zone or "", d.name)
      if d.entranceX and d.entranceY then
        -- 区域名已出现在标题里，这里只给「入口」按钮本身，避免同一区域名连说两遍
        local entLink = FormatNpcMapLink(d.entranceZone or d.zone, "入口", d.entranceX, d.entranceY, { omitZone = true })
        table.insert(lines, string.format("|cff00ffcc副本入口位置:|r %s", (entLink ~= "") and entLink or zoneText))
      end
      if d.summary and d.summary ~= "" then
        -- 自动生成的简介常以「区域名 (Lv.x-y级) 」开头，与卡片标题重复，这里剥掉该前缀
        local summary = d.summary
        local z = d.zone or ""
        if z ~= "" then
          local stripped = string.match(summary, "^" .. z:gsub("([%^%$%(%)%%%.%[%]%*%+%-%?])", "%%%1") .. "%s*%b()%s*(.*)$")
          if stripped and stripped ~= "" then summary = stripped end
        end
        -- 旧版打包的 Data.lua 兜底简介仍是「经典地下城。」，升级前的缓存也要一并过滤
        local isGenericSummary = summary == "原有地下城。" or summary == "原有地下城"
          or summary == "经典地下城。" or summary == "经典地下城"
        if summary ~= "" and not isGenericSummary then
          table.insert(lines, "|cff99e6ff简介:|r " .. LinkifyInlineCoords(summary, d.entranceZone or d.zone or "", d.name))
        end
      end
      if d.bosses and #d.bosses > 0 then
        table.insert(lines, "|cffff8000主要首领:|r " .. table.concat(d.bosses, "  ·  "))
      end
      if d.quests and #d.quests > 0 then
        local filteredQuests = {}
        local sharedQuests = {}
        local otherFactionOrClassCount = 0
        for _, q in ipairs(DedupeQuestieQuests(d.quests)) do
          if not IsQuestCompleted(q) then
            local qFactionOk = (not q.faction or q.faction == "" or q.faction == "both" or q.faction == state.faction)
            if state.dungeonFilter ~= "MATCH" or (qFactionOk and MatchesQuestClass(q)) then
              -- 同一任务常同时挂在多个副本分区（如血色军械库/大教堂共享任务），
              -- 后续分区只做引用提示，不再整条重复展开
              local qKey = tostring(q.id or q.name)
              local firstDungeon = shownQuestDungeon[qKey]
              if firstDungeon and firstDungeon ~= d.name then
                table.insert(sharedQuests, string.format("%s（见 %s）", FormatQuestLink(q, d.minLevel, d.entranceZone or d.zone or ""), firstDungeon))
              else
                shownQuestDungeon[qKey] = d.name
                table.insert(filteredQuests, q)
              end
            else
              otherFactionOrClassCount = otherFactionOrClassCount + 1
            end
          end
        end
        if #filteredQuests > 0 then
          table.insert(lines, "|cffffd100必接副本任务 (" .. #filteredQuests .. "个):|r")
          RenderQuestGroups(lines, GroupQuestsBySharedPrefix(filteredQuests), {
            fallbackLevel = d.minLevel,
            fallbackZone = d.entranceZone or d.zone or "",
            showFaction = true,
            showClass = (state.dungeonFilter ~= "MATCH"),
            insideLabel = "(副本内触发)",
            singleChainWord = "任务链",
          })
        end
        if #sharedQuests > 0 then
          table.insert(lines, string.format("|cffffd100共享任务 (%d个):|r %s", #sharedQuests, table.concat(sharedQuests, " / ")))
        end
        if #filteredQuests == 0 and #sharedQuests == 0 and otherFactionOrClassCount > 0 then
          table.insert(lines, string.format("|cffffd100必接副本任务:|r |cff99aabb当前角色阵营/职业暂无未完成专属任务（另有 %d 个其他阵营或职业任务，切换上方「显示全部副本」可查看）|r", otherFactionOrClassCount))
        end
      end

      local isLevelMatch = (state.level >= d.minLevel and state.level <= d.maxLevel)
      local newBadge = d.isNew and " |cff00ffcc[★无限服新增]|r" or ""
      local matchBadge = isLevelMatch and " |cff00ff00[当前适龄]|r" or ""
      local doneBadge = allDone and " |cff00ff00[任务已全部完成]|r" or ""

      list:Add({
        title = string.format("|cffff8000%s|r  |cffffd100(Lv.%d-%d · 推荐 %d 级)|r  —  %s%s%s%s", d.name, d.minLevel, d.maxLevel, d.visit or d.minLevel, LinkifyInlineCoords(d.zone or "", d.entranceZone or d.zone or "", d.name), newBadge, matchBadge, doneBadge),
        body = table.concat(lines, "\n"),
        theme = d.isNew and "dunNew" or (isLevelMatch and "dunMatch" or "info"),
        -- 等级区间已写在标题里，角标改为类型标识，避免同一串 Lv 信息出现两遍
        badge = d.isNew and "无限服新副本" or "原有副本",
      })
    end
  end

  if shownCount == 0 and state.dungeonFilter == "MATCH" then
    local emptyTitle, emptyBody
    if levelMatchedCount == 0 then
      emptyTitle = "|cffffd100[提示] 当前等级暂无适龄地下城|r"
      emptyBody = string.format("Lv.%d 暂无适龄地下城，可点击上方「看无限服新本」或「显示全部副本」查看全部地下城详情。", state.level)
    elseif hiddenCompletedCount == levelMatchedCount then
      emptyTitle = "|cff00ff00[提示] 当前等级适龄副本任务已全部完成|r"
      emptyBody = string.format("Lv.%d 适龄地下城的任务已全部完成并默认隐藏。可点击上方「看无限服新本」或「显示全部副本」查看全部地下城详情。", state.level)
    else
      emptyTitle = "|cffffd100[提示] 未找到符合搜索条件的适龄副本|r"
      emptyBody = string.format("当前搜索条件下没有匹配的未完成 Lv.%d 适龄副本，请清空或调整搜索关键词。", state.level)
    end
    list:Add({ title = emptyTitle, body = emptyBody, theme = "milestone" })
  end

  list:Finish()
end

-- ============================================================================
-- 制造套利页：EasyAuction 行情 + 角色专业等级 + 中间产物递归折算 + 分解套利
-- ============================================================================

local CRAFT_DIFFICULTY_LABEL = {
  optimal = "|cffffd100最佳(必涨点)|r",
  medium = "|cff88ff88中等|r",
  easy = "|cff99ccff简单|r",
  trivial = "|cff999999已灰(不涨点)|r",
  unknown = "|cff999999档位未知|r",
}

local function FormatMoney(copper)
  local value = math.floor(tonumber(copper) or 0)
  local sign = value < 0 and "-" or ""
  value = math.abs(value)
  local gold = math.floor(value / 10000)
  local silver = math.floor((value % 10000) / 100)
  local rest = value % 100
  if gold > 0 then return string.format("%s%d金%d银%d铜", sign, gold, silver, rest) end
  if silver > 0 then return string.format("%s%d银%d铜", sign, silver, rest) end
  return string.format("%s%d铜", sign, rest)
end

local function CraftSignColor(value)
  return (tonumber(value) or 0) >= 0 and "|cff44ff88" or "|cffff5555"
end

---在售数量展示：少于 100 件标红提示异常价格风险；nil 表示没有完整扫描快照
local function SupplyText(supply)
  if supply == nil then return "|cffffd100未知(无完整快照)|r" end
  if supply < 100 then return string.format("|cffff5555%d 件(偏少)|r", supply) end
  return string.format("|cff44ff88%d 件|r", supply)
end

---售价口径说明：优先 min，回退 rivalMin / market 时如实标注
local function PriceSourceText(source)
  if source == "min" or source == nil then return "观测到的最低价 min" end
  if source == "rivalMin" then return "对手最低价 rivalMin（min 缺失）" end
  if source == "market" then return "行情估计 market（min/rivalMin 缺失）" end
  return "行情接口报价"
end

local function AttachTooltip(widget, title, bodyOrFn)
  widget:SetScript("OnEnter", function(self)
    if not GameTooltip then return end
    GameTooltip:SetOwner(self, "ANCHOR_BOTTOM")
    GameTooltip:ClearLines()
    GameTooltip:AddLine(title, 1, 0.82, 0)
    local body = (type(bodyOrFn) == "function") and bodyOrFn() or bodyOrFn
    if body and body ~= "" then
      GameTooltip:AddLine(body, 0.85, 0.9, 0.95, true)
    end
    GameTooltip:Show()
  end)
  widget:SetScript("OnLeave", function()
    if GameTooltip then GameTooltip:Hide() end
  end)
end

local dropdownMenu
local OpenControlDropdown

local function LayoutArbToolbar(yOffset, opts)
  local width = (contentChild:GetWidth() or 720) - 16
  if width < 500 then width = 710 end
  if not arbToolbar then
    local template = BackdropTemplateMixin and "BackdropTemplate" or nil
    arbToolbar = CreateFrame("Frame", nil, contentChild, template)
    arbToolbar:SetHeight(34)
    if arbToolbar.SetBackdrop then
      arbToolbar:SetBackdrop({
        bgFile = "Interface\\Buttons\\WHITE8x8",
        edgeFile = "Interface\\Tooltips\\UI-Tooltip-Border",
        tile = true, tileSize = 8, edgeSize = 10,
        insets = { left = 2, right = 2, top = 2, bottom = 2 },
      })
      arbToolbar:SetBackdropColor(0.06, 0.09, 0.14, 0.94)
      arbToolbar:SetBackdropBorderColor(0.2, 0.55, 0.8, 0.85)
    end
    arbToolbar.btns = {}
  end

  local items = opts.buttons or {}
  local count = #items
  if count == 0 then
    arbToolbar:Hide()
    return yOffset
  end

  arbToolbar:SetWidth(width)
  arbToolbar:ClearAllPoints()
  arbToolbar:SetPoint("TOPLEFT", contentChild, "TOPLEFT", 8, -yOffset)
  arbToolbar:Show()

  for i = 1, count do
    if not arbToolbar.btns[i] then
      local btn = CreateFrame("Button", nil, arbToolbar, "UIPanelButtonTemplate")
      btn:SetHeight(22)
      arbToolbar.btns[i] = btn
    end
  end
  for i = count + 1, #arbToolbar.btns do
    arbToolbar.btns[i]:Hide()
  end

  local gap = 6
  local btnW = math.floor((width - 16 - gap * math.max(0, count - 1)) / count)
  for i, item in ipairs(items) do
    local btn = arbToolbar.btns[i]
    btn:SetWidth(btnW)
    btn:ClearAllPoints()
    if i == 1 then
      btn:SetPoint("LEFT", arbToolbar, "LEFT", 8, 0)
    else
      btn:SetPoint("LEFT", arbToolbar.btns[i - 1], "RIGHT", gap, 0)
    end
    btn:SetText(item.label)
    btn:SetScript("OnClick", item.fn)
    AttachTooltip(btn, item.tipTitle, item.tipBody)
    btn:Show()
  end

  return yOffset + 34 + 8
end

local function IsCraftProfessionSelected(key)
  return type(state.craftProfession) == "table" and state.craftProfession[key] == true
end

local function ToggleCraftProfession(key)
  if type(key) ~= "string" or key == "" then return end
  local nextSet = {}
  if type(state.craftProfession) == "table" then
    for k, enabled in pairs(state.craftProfession) do
      if enabled then nextSet[k] = true end
    end
  end
  if nextSet[key] then
    nextSet[key] = nil
  else
    nextSet[key] = true
  end
  state.craftProfession = (next(nextSet) ~= nil) and nextSet or nil
end

local function FormatCraftProfessionFilter(arb, professions)
  if type(state.craftProfession) ~= "table" or next(state.craftProfession) == nil then
    return "专业: 全部", "全部专业"
  end
  local names, seen = {}, {}
  for _, stats in ipairs(professions or {}) do
    if state.craftProfession[stats.key] then
      seen[stats.key] = true
      table.insert(names, (arb and arb.ProfessionNames and arb.ProfessionNames[stats.key]) or stats.name or stats.key)
    end
  end
  local extra = {}
  for k, enabled in pairs(state.craftProfession) do
    if enabled and not seen[k] then
      table.insert(extra, k)
    end
  end
  table.sort(extra)
  for _, k in ipairs(extra) do
    table.insert(names, (arb and arb.ProfessionNames and arb.ProfessionNames[k]) or k)
  end
  if #names == 0 then
    return "专业: 全部", "全部专业"
  elseif #names == 1 then
    return "专业: " .. names[1], names[1]
  else
    return string.format("专业: %d项", #names), table.concat(names, "、")
  end
end

-- ============================================================================
-- 声望页：魔兽无限新增的 16 个第三方声望与凄凉之地半人马阵营
-- 数据来自 Data.reputationGuides 与 Data.factionQuests。
-- 支持「全部 / 单选 / 多选」过滤，按角色阵营/等级/声望/完成状态过滤，跨阵营按任务 ID 去重。
-- ============================================================================
local function LayoutRepFilterBar(yOffset, opts)
  local items = opts and opts.items or {}
  local count = #items
  if count == 0 then
    if repFilterBar then repFilterBar:Hide() end
    return yOffset
  end

  local width = (contentChild:GetWidth() or 720) - 16
  if width < 500 then width = 710 end
  if not repFilterBar then
    local template = BackdropTemplateMixin and "BackdropTemplate" or nil
    repFilterBar = CreateFrame("Frame", nil, contentChild, template)
    if repFilterBar.SetBackdrop then
      repFilterBar:SetBackdrop({
        bgFile = "Interface\\Buttons\\WHITE8x8",
        edgeFile = "Interface\\Tooltips\\UI-Tooltip-Border",
        tile = true, tileSize = 8, edgeSize = 10,
        insets = { left = 2, right = 2, top = 2, bottom = 2 },
      })
      repFilterBar:SetBackdropColor(0.06, 0.09, 0.14, 0.94)
      repFilterBar:SetBackdropBorderColor(0.2, 0.55, 0.8, 0.85)
    end
    repFilterBar.allBtn = CreateFrame("Button", nil, repFilterBar, "UIPanelButtonTemplate")
    repFilterBar.allBtn:SetHeight(22)
    repFilterBar.modeBtn = CreateFrame("Button", nil, repFilterBar, "UIPanelButtonTemplate")
    repFilterBar.modeBtn:SetHeight(22)
    repFilterBar.btns = {}
  end

  local hasFilter = opts and opts.hasFilter == true
  local isSingle = opts and opts.mode == "single"
  local selected = (opts and opts.selected) or {}
  local gapX, gapY = 6, 4
  local btnH = 22
  local ctrlW = math.floor((width - 16 - gapX) / 2)

  repFilterBar.allBtn:SetWidth(ctrlW)
  repFilterBar.allBtn:ClearAllPoints()
  repFilterBar.allBtn:SetPoint("TOPLEFT", repFilterBar, "TOPLEFT", 8, -6)
  if not hasFilter then
    repFilterBar.allBtn:SetText("|cff00ffcc✓ 全部声望|r")
    repFilterBar.allBtn:LockHighlight()
  else
    repFilterBar.allBtn:SetText("全部声望（清空筛选）")
    repFilterBar.allBtn:UnlockHighlight()
  end
  repFilterBar.allBtn:SetScript("OnClick", function()
    state.repFilter = nil
    RefreshUI()
  end)
  AttachTooltip(
    repFilterBar.allBtn,
    "显示全部声望",
    "清除已选筛选条件，展示当前阵营可用的全部声望总览与任务详情。"
  )

  repFilterBar.modeBtn:SetWidth(ctrlW)
  repFilterBar.modeBtn:ClearAllPoints()
  repFilterBar.modeBtn:SetPoint("TOPLEFT", repFilterBar, "TOPLEFT", 8 + ctrlW + gapX, -6)
  repFilterBar.modeBtn:SetText(isSingle and "筛选模式: 单选" or "筛选模式: 多选")
  repFilterBar.modeBtn:UnlockHighlight()
  repFilterBar.modeBtn:SetScript("OnClick", function()
    if state.repFilterMode == "single" then
      state.repFilterMode = "multi"
    else
      state.repFilterMode = "single"
      local keepKey = nil
      for _, item in ipairs(items) do
        if selected[item.key] then
          keepKey = item.key
          break
        end
      end
      state.repFilter = keepKey and { [keepKey] = true } or nil
    end
    RefreshUI()
  end)
  AttachTooltip(
    repFilterBar.modeBtn,
    "切换单选 / 多选",
    isSingle
      and "当前为单选模式：点击下方声望只看该声望，再次点击已选项可恢复全部。点击此按钮切换为多选模式。"
      or "当前为多选模式：可勾选多个声望同时查看。点击此按钮切换为单选模式。"
  )

  local cols = 4
  local btnW = math.floor((width - 16 - gapX * (cols - 1)) / cols)
  for i, item in ipairs(items) do
    local btn = repFilterBar.btns[i]
    if not btn then
      btn = CreateFrame("Button", nil, repFilterBar, "UIPanelButtonTemplate")
      repFilterBar.btns[i] = btn
    end
    local col = (i - 1) % cols
    local row = math.floor((i - 1) / cols)
    local x = 8 + col * (btnW + gapX)
    local y = -34 - row * (btnH + gapY)
    btn:SetSize(btnW, btnH)
    btn:ClearAllPoints()
    btn:SetPoint("TOPLEFT", repFilterBar, "TOPLEFT", x, y)

    local isSelected = selected[item.key] == true
    if isSelected then
      btn:SetText("|cff00ffcc✓ " .. item.label .. "|r")
      btn:LockHighlight()
    elseif hasFilter then
      btn:SetText("|cffaaaaaa" .. item.label .. "|r")
      btn:UnlockHighlight()
    else
      btn:SetText(item.label)
      btn:UnlockHighlight()
    end

    local itemKey = item.key
    btn:SetScript("OnClick", function()
      if state.repFilterMode == "single" then
        local onlyThis = isSelected
        if onlyThis then
          for k, enabled in pairs(selected) do
            if enabled and k ~= itemKey then
              onlyThis = false
              break
            end
          end
        end
        if onlyThis then
          state.repFilter = nil
        else
          state.repFilter = { [itemKey] = true }
        end
      else
        local nextSet = {}
        for k, enabled in pairs(selected) do
          if enabled then nextSet[k] = true end
        end
        if nextSet[itemKey] then
          nextSet[itemKey] = nil
        else
          nextSet[itemKey] = true
        end
        state.repFilter = (next(nextSet) ~= nil) and nextSet or nil
      end
      RefreshUI()
    end)
    AttachTooltip(btn, item.fullName or item.label, item.tipBody)
    btn:Show()
  end
  for i = count + 1, #repFilterBar.btns do
    repFilterBar.btns[i]:Hide()
  end

  local rows = math.ceil(count / cols)
  local totalH = 34 + rows * btnH + math.max(0, rows - 1) * gapY + 8
  repFilterBar:SetSize(width, totalH)
  repFilterBar:ClearAllPoints()
  repFilterBar:SetPoint("TOPLEFT", contentChild, "TOPLEFT", 8, -yOffset)
  repFilterBar:Show()
  return yOffset + totalH + 8
end

local function RenderTabReputations()
  local list = CreateCardList(6)
  local lvl = state.level
  local guides = Data and Data.reputationGuides
  local factions = (guides and type(guides.factions) == "table") and guides.factions or {}
  local factionQuests = (Data and type(Data.factionQuests) == "table") and Data.factionQuests or {}
  if #factions == 0 and #factionQuests == 0 then
    if repFilterBar then repFilterBar:Hide() end
    list:Add({
      title = "|cff00ffcc[声望] 无限服新增第三方声望|r",
      body = "|cffff8800声望数据尚未打包：请更新 WoWF 插件或等待下一次数据同步。|r",
      theme = "info",
    })
    list:Finish()
    return
  end

  local SIDE_TAG = {
    alliance = "|cff44aaff[联盟]|r ",
    horde = "|cffff5555[部落]|r ",
    both = "|cffcccccc[中立]|r ",
  }
  -- 国服 1.60 的新阵营任务在 QuestieDB 中没有 requiredMinRep/MaxRep（已核对 478 条），
  -- 声望门槛主要体现在任务链顺序与当前阵营声望；这里仅对确有门槛字段的任务做兜底过滤。
  local function QuestRepOk(qid)
    if not _G.QuestDB then return true end
    local function Check(reqFn, isMin)
      local req = reqFn and reqFn(qid)
      if type(req) ~= "table" then return true end
      local fid, need = tonumber(req[1]), tonumber(req[2])
      if not fid or not need then return true end
      local value = RepUI.GetStanding(fid)
      if type(value) ~= "number" then return true end
      if isMin then return value >= need end
      return value < need
    end
    if not Check(_G.QuestDB.requiredMinRep, true) then return false end
    if not Check(_G.QuestDB.requiredMaxRep, false) then return false end
    return true
  end

  local factionNameById = {}
  local factionSideById = {}
  for _, f in ipairs(factions) do
    factionNameById[tonumber(f.id)] = f.name
    factionSideById[tonumber(f.id)] = f.side or "both"
  end
  local shownQuestIds = {}
  local shownQuestFaction = {}

  local function FactionAvailable(f)
    local side = f and f.side
    return (not side) or side == "both" or side == state.faction
  end

  -- 构建当前阵营可用的声望筛选项（16 个第三方声望 + 凄凉之地半人马）
  local filterItems = {}
  local itemByKey = {}
  for _, f in ipairs(factions) do
    if FactionAvailable(f) then
      local key = tostring(f.id)
      local side = f.side or "both"
      local value = RepUI.GetStanding(f.id)
      local standingText = type(value) == "number"
        and string.format("%s%s (%s)|r", RepUI.Color(value), RepUI.Label(value), RepUI.FormatNumber(value))
        or "|cff888888未追踪|r"
      local standingPlain = type(value) == "number"
        and string.format("%s (%s)", RepUI.Label(value), RepUI.FormatNumber(value))
        or "未追踪"
      local item = {
        key = key,
        label = f.name or key,
        fullName = f.name or key,
        summaryLine = string.format("%s%s %s", SIDE_TAG[side] or "", f.name or "", standingText),
        tipBody = string.format("当前声望：%s\n点击筛选/取消该声望。", standingPlain),
      }
      table.insert(filterItems, item)
      itemByKey[key] = item
    end
  end
  for _, def in ipairs(factionQuests) do
    if type(def) == "table" and FactionAvailable(def) then
      local key = tostring((def.id and def.id ~= "") and def.id or "desolace-centaur")
      local fullTitle = (def.title and def.title ~= "") and def.title or "凄凉之地 · 半人马阵营"
      local shortLabel = (key == "desolace-centaur" or string.find(fullTitle, "半人马", 1, true))
        and "凄凉之地·半人马"
        or fullTitle
      local groupParts, plainParts = {}, {}
      for _, grp in ipairs(def.groups or {}) do
        local gVal = RepUI.GetStanding(grp.factionId)
        local gName = grp.name or tostring(grp.factionId or "")
        if type(gVal) == "number" then
          table.insert(groupParts, string.format("%s %s%s (%s)|r", gName, RepUI.Color(gVal), RepUI.Label(gVal), RepUI.FormatNumber(gVal)))
          table.insert(plainParts, string.format("%s %s (%s)", gName, RepUI.Label(gVal), RepUI.FormatNumber(gVal)))
        else
          table.insert(groupParts, string.format("%s |cff888888未追踪|r", gName))
          table.insert(plainParts, string.format("%s 未追踪", gName))
        end
      end
      local standingText = (#groupParts > 0) and table.concat(groupParts, " / ") or "|cff888888未追踪|r"
      local standingPlain = (#plainParts > 0) and table.concat(plainParts, " / ") or "未追踪"
      local item = {
        key = key,
        label = shortLabel,
        fullName = fullTitle,
        summaryLine = string.format("%s%s %s", SIDE_TAG[def.side or "both"] or "", fullTitle, standingText),
        tipBody = string.format("当前声望：%s\n点击筛选/取消该声望。", standingPlain),
      }
      table.insert(filterItems, item)
      itemByKey[key] = item
    end
  end

  local filterMode = (state.repFilterMode == "single") and "single" or "multi"
  local effectiveSelected = {}
  local selectedNames = {}
  local selectedCount = 0
  if type(state.repFilter) == "table" then
    for _, item in ipairs(filterItems) do
      if state.repFilter[item.key] then
        effectiveSelected[item.key] = true
        table.insert(selectedNames, item.label)
        selectedCount = selectedCount + 1
      end
    end
  end
  if filterMode == "single" and selectedCount > 1 then
    for _, item in ipairs(filterItems) do
      if effectiveSelected[item.key] then
        effectiveSelected = { [item.key] = true }
        selectedNames = { item.label }
        selectedCount = 1
        state.repFilter = { [item.key] = true }
        break
      end
    end
  end
  local hasActiveFilter = (selectedCount > 0)

  -- 顶部总览：未筛选时展示全部阵营总览，已筛选时紧凑展示已选声望以便详情卡紧贴展示
  local modeText = (filterMode == "single") and "单选" or "多选"
  local filterDesc = hasActiveFilter
    and string.format("已选 %d 项：%s", selectedCount, table.concat(selectedNames, "、"))
    or string.format("全部（%d 个可用声望）", #filterItems)
  local summaryLines = {
    string.format("|cff99e6ff当前筛选:|r %s  ·  |cff99e6ff模式:|r %s", filterDesc, modeText),
  }
  if hasActiveFilter then
    for _, item in ipairs(filterItems) do
      if effectiveSelected[item.key] then
        table.insert(summaryLines, item.summaryLine)
      end
    end
  else
    table.insert(summaryLines, "|cff99e6ff《魔兽世界：无限》第三方与半人马声望总览|r：蓝色为联盟声望、红色为部落声望、灰色为中立；对立阵营详情会自动隐藏。")
    for _, f in ipairs(factions) do
      local key = tostring(f.id)
      if itemByKey[key] then
        table.insert(summaryLines, itemByKey[key].summaryLine)
      else
        local side = f.side or "both"
        table.insert(summaryLines, string.format("%s%s |cff888888不可用（对立阵营）|r", SIDE_TAG[side] or "", f.name or ""))
      end
    end
    for _, def in ipairs(factionQuests) do
      if type(def) == "table" then
        local key = tostring((def.id and def.id ~= "") and def.id or "desolace-centaur")
        if itemByKey[key] then
          table.insert(summaryLines, itemByKey[key].summaryLine)
        end
      end
    end
  end
  if not _G.QuestDB then
    table.insert(summaryLines, "|cffff8800QuestieDB 未加载：任务声望门槛无法读取，本页只按阵营声望与等级过滤。|r")
  end

  local function AppendQuest(lines, q, factionName)
    local info = GetQuestieQuestInfo(q.id)
    local qLevel = (tonumber(q.level) and tonumber(q.level) > 0) and tonumber(q.level) or (info and info.level) or lvl
    local qObj = {
      id = q.id,
      name = q.name,
      level = qLevel,
      faction = "both",
      zone = (q.zone and q.zone ~= "" and q.zone) or (info and info.zone) or "",
      npc = info and info.npc or nil,
      x = info and info.x or nil,
      y = info and info.y or nil,
    }
    local link = FormatQuestLink(qObj, qLevel, qObj.zone, nil, q.repeatable and false or nil)
    local parts = { link }
    local tags = {}
    if q.kind == "writ" then table.insert(tags, "|cffc79c6e[工匠文书]|r") end
    if q.repeatable then table.insert(tags, "|cffff8800[可重复]|r") end
    if q.items and #q.items > 0 then table.insert(tags, "|cff00aaff[交物品]|r") end
    if #tags > 0 then table.insert(parts, table.concat(tags, "")) end
    if q.rep and tonumber(q.rep) ~= 0 then
      table.insert(parts, string.format("|cff00ff00+%s|r", RepUI.FormatNumber(q.rep)))
    end
    if type(q.otherRep) == "table" and #q.otherRep > 0 then
      local others = {}
      for _, other in ipairs(q.otherRep) do
        local otherName = factionNameById[tonumber(other.id)]
        local otherSide = factionSideById[tonumber(other.id)]
        if otherName and ((not otherSide) or otherSide == "both" or otherSide == state.faction) then
          local n = tonumber(other.n) or 0
          table.insert(others, string.format("%s%s %s%s|r", n >= 0 and "|cff66ff66" or "|cffff5555", otherName, n >= 0 and "+" or "", RepUI.FormatNumber(n)))
        end
      end
      if #others > 0 then table.insert(parts, "另 " .. table.concat(others, "、")) end
    end
    if q.items and #q.items > 0 then
      local itemTexts = {}
      for _, item in ipairs(q.items) do
        table.insert(itemTexts, string.format("%d×%s", item.count or 1, FormatItemLink(item.id, item.name)))
      end
      table.insert(parts, "交 " .. table.concat(itemTexts, "、"))
    end
    if q.zone and q.zone ~= "" then
      table.insert(parts, "|cff8899aa(" .. q.zone .. ")|r")
    end
    table.insert(lines, "  · " .. table.concat(parts, "  "))
    shownQuestIds[q.id] = true
    shownQuestFaction[q.id] = factionName or ""
  end

  local function BuildGroups(eligible)
    if #eligible == 0 then
      return { { quests = {} } }
    end
    local writs, rest = {}, {}
    for _, q in ipairs(eligible) do
      if q.kind == "writ" then table.insert(writs, q) else table.insert(rest, q) end
    end
    local groups = {}
    if #writs > 0 then
      local byRep, keys = {}, {}
      for _, q in ipairs(writs) do
        local rep = tonumber(q.rep) or 0
        if not byRep[rep] then
          byRep[rep] = {}
          table.insert(keys, rep)
        end
        table.insert(byRep[rep], q)
      end
      table.sort(keys)
      for _, rep in ipairs(keys) do
        local repQuests = byRep[rep]
        local chunks = {}
        if #repQuests > 25 then
          for idx = 1, #repQuests, 25 do
            local chunk = {}
            for j = idx, math.min(idx + 24, #repQuests) do table.insert(chunk, repQuests[j]) end
            table.insert(chunks, chunk)
          end
        else
          table.insert(chunks, repQuests)
        end
        for chunkIdx, chunk in ipairs(chunks) do
          local suffix = string.format(" · 工匠文书 +%s", RepUI.FormatNumber(rep))
          if #chunks > 1 then suffix = suffix .. string.format(" (%d/%d)", chunkIdx, #chunks) end
          table.insert(groups, { quests = chunk, titleSuffix = suffix })
        end
      end
    end
    if #rest > 0 then
      if #rest > 25 then
        local bands = {
          { 1, 5 }, { 6, 10 }, { 11, 15 }, { 16, 20 }, { 21, 25 }, { 26, 30 },
          { 31, 35 }, { 36, 40 }, { 41, 45 }, { 46, 50 }, { 51, 55 }, { 56, 60 },
        }
        for _, band in ipairs(bands) do
          local bandQuests = {}
          for _, q in ipairs(rest) do
            local qLv = tonumber(q.level) or 0
            if qLv >= band[1] and qLv <= band[2] then table.insert(bandQuests, q) end
          end
          if #bandQuests > 0 then
            local chunks = {}
            if #bandQuests > 25 then
              for idx = 1, #bandQuests, 25 do
                local chunk = {}
                for j = idx, math.min(idx + 24, #bandQuests) do table.insert(chunk, bandQuests[j]) end
                table.insert(chunks, chunk)
              end
            else
              table.insert(chunks, bandQuests)
            end
            for chunkIdx, chunk in ipairs(chunks) do
              local suffix = string.format(" · %sLv.%d-%d", (#writs > 0) and "其他任务 " or "", band[1], band[2])
              if #chunks > 1 then suffix = suffix .. string.format(" (%d/%d)", chunkIdx, #chunks) end
              table.insert(groups, { quests = chunk, titleSuffix = suffix })
            end
          end
        end
        -- 等级为 0 / 缺失 / 超过 60 的任务不在常规区间内，单独成卡，避免被漏掉
        local extraQuests = {}
        for _, q in ipairs(rest) do
          local qLv = tonumber(q.level) or 0
          if qLv < 1 or qLv > 60 then table.insert(extraQuests, q) end
        end
        if #extraQuests > 0 then
          local chunks = {}
          for idx = 1, #extraQuests, 25 do
            local chunk = {}
            for j = idx, math.min(idx + 24, #extraQuests) do table.insert(chunk, extraQuests[j]) end
            table.insert(chunks, chunk)
          end
          for chunkIdx, chunk in ipairs(chunks) do
            local suffix = " · 其他等级"
            if #chunks > 1 then suffix = suffix .. string.format(" (%d/%d)", chunkIdx, #chunks) end
            table.insert(groups, { quests = chunk, titleSuffix = suffix })
          end
        end
      else
        table.insert(groups, {
          quests = rest,
          titleSuffix = (#writs > 0) and " · 其他声望任务" or nil,
        })
      end
    end
    if #groups == 0 then return { { quests = eligible } } end
    return groups
  end

  list:Add({
    title = "|cff00ffcc[声望] 魔兽无限 · 新增第三方声望与半人马阵营|r",
    body = table.concat(summaryLines, "\n"),
    theme = "header",
    badge = hasActiveFilter
      and string.format("已选 %d/%d", selectedCount, #filterItems)
      or string.format("%d 个阵营", #factions + #factionQuests),
  })

  list.y = LayoutRepFilterBar(list.y, {
    items = filterItems,
    selected = effectiveSelected,
    hasFilter = hasActiveFilter,
    mode = filterMode,
  })

  local detailCount = 0
  for _, faction in ipairs(factions) do
    local key = tostring(faction.id)
    if FactionAvailable(faction) and (not hasActiveFilter or effectiveSelected[key]) then
      local factionBlob = (faction.name or "") .. " " .. (faction.summary or "")
      for _, source in ipairs(faction.sources or {}) do factionBlob = factionBlob .. " " .. source end
      for _, q in ipairs(faction.quests or {}) do
        factionBlob = factionBlob .. " " .. (q.name or "")
        for _, item in ipairs(q.items or {}) do factionBlob = factionBlob .. " " .. (item.name or "") end
      end
      if MatchesSearch(factionBlob) then
        local eligible = {}
        local sharedFactions = {}
        local completedCount, higherCount, repLockedCount = 0, 0, 0
        for _, q in ipairs(faction.quests or {}) do
          local sideOk = (not q.side) or q.side == "both" or q.side == state.faction
          if sideOk then
            if IsQuestCompletedById(q.id) and not q.repeatable then
              completedCount = completedCount + 1
            elseif (tonumber(q.minLevel) or 1) > lvl then
              higherCount = higherCount + 1
            elseif not QuestRepOk(q.id) then
              repLockedCount = repLockedCount + 1
            elseif shownQuestIds[q.id] then
              local owner = shownQuestFaction[q.id] or "其他阵营"
              sharedFactions[owner] = (sharedFactions[owner] or 0) + 1
            else
              table.insert(eligible, q)
            end
          end
        end

        local value = RepUI.GetStanding(faction.id)
        local standingText = type(value) == "number"
          and string.format("%s%s (%s)|r", RepUI.Color(value), RepUI.Label(value), RepUI.FormatNumber(value))
          or "|cff888888未追踪|r"
        local nextHint = type(value) == "number" and RepUI.NextTierHint(value) or nil
        local groups = BuildGroups(eligible)
        local side = faction.side or "both"
        local baseTitle = string.format(
          "|cff00ffcc[声望] %s%s|r",
          (side ~= "both" and (SIDE_TAG[side] or "")) or "",
          faction.name or ""
        )

        for groupIdx, group in ipairs(groups) do
          local lines = {}
          if groupIdx == 1 then
            local standingLine = "|cff99e6ff你的声望:|r " .. standingText
            if nextHint then standingLine = standingLine .. "   |cff8899aa下一门槛: " .. nextHint .. "|r" end
            table.insert(lines, standingLine)
            if type(value) == "number" and value >= (tonumber(faction.max) or 42999) then
              table.insert(lines, "|cff00ff00已满声望。|r")
            end
            if faction.summary and faction.summary ~= "" then table.insert(lines, faction.summary) end
            if type(faction.sources) == "table" and #faction.sources > 0 then
              table.insert(lines, "|cffffd100声望来源:|r")
              for _, source in ipairs(faction.sources) do table.insert(lines, "  · " .. source) end
            end
            if type(faction.rewards) == "table" and #faction.rewards > 0 then
              local rewardParts = {}
              for _, rewardGroup in ipairs(faction.rewards) do
                local names = {}
                for _, item in ipairs(rewardGroup.items or {}) do
                  table.insert(names, FormatItemLink(item.id, item.name))
                end
                if #names > 0 then
                  local suffix = (tonumber(rewardGroup.total) and rewardGroup.total > #names)
                    and string.format(" 等%d件", rewardGroup.total) or ""
                  table.insert(rewardParts, string.format("%s %s%s", rewardGroup.standing, table.concat(names, "、"), suffix))
                end
              end
              if #rewardParts > 0 then
                table.insert(lines, "|cffffd100可换:|r " .. table.concat(rewardParts, "  |  "))
              end
            end
            if completedCount > 0 then
              table.insert(lines, string.format("|cff888888✓ 已完成 %d 条声望任务（已折叠）|r", completedCount))
            end
          else
            table.insert(lines, "|cff8899aa（接上）|r")
          end

          if #group.quests == 0 then
            table.insert(lines, "|cff8899aa暂无可接任务；按上方来源提升声望。|r")
          else
            for _, q in ipairs(group.quests) do AppendQuest(lines, q, faction.name) end
          end

          if groupIdx == #groups then
            if higherCount > 0 then
              table.insert(lines, string.format("|cff8899aa另有 %d 条任务需更高等级（Lv.%d+）|r", higherCount, lvl + 1))
            end
            if repLockedCount > 0 then
              table.insert(lines, string.format("|cff8899aa另有 %d 条任务需更高声望|r", repLockedCount))
            end
            local sharedNames = {}
            for name in pairs(sharedFactions) do table.insert(sharedNames, name) end
            if #sharedNames > 0 then
              table.sort(sharedNames)
              local parts = {}
              for _, name in ipairs(sharedNames) do
                table.insert(parts, string.format("「%s」%d 条", name, sharedFactions[name]))
              end
              table.insert(lines, "|cff8899aa另有 " .. table.concat(parts, "、") .. " 任务同时提升本阵营声望（已列在对应阵营卡）|r")
            end
          end

          local titleSuffix = group.titleSuffix or ""
          local badge = type(value) == "number" and RepUI.Label(value) or "未追踪"
          if group.titleSuffix then badge = badge .. group.titleSuffix end
          list:Add({
            title = baseTitle .. titleSuffix,
            body = table.concat(lines, "\n"),
            theme = "zone",
            badge = badge,
          })
          detailCount = detailCount + 1
        end
      end
    end
  end

  for _, def in ipairs(factionQuests) do
    if type(def) == "table" and FactionAvailable(def) then
      local key = tostring((def.id and def.id ~= "") and def.id or "desolace-centaur")
      if not hasActiveFilter or effectiveSelected[key] then
        detailCount = detailCount + RenderCentaurFactionCard(list, lvl, def)
      end
    end
  end

  if detailCount == 0 then
    list:Add({
      title = "|cffffd100[声望] 当前筛选/搜索无匹配结果|r",
      body = "请点击上方「全部声望（清空筛选）」或清空顶部搜索框后重试。",
      theme = "info",
    })
  end

  list:Finish()
end

local function RenderTabCraftArb()
  local list = CreateCardList(6)
  local arb = WoWF_CraftArb
  local mode = state.craftMode == "de" and "de" or "sell"
  local sortKey = state.craftSort == "roi" and "roi" or "profit"
  local onlyProfitable = state.craftOnlyProfit ~= false

  if not arb then
    list:Add({
      title = "|cffff5555[制造套利] 引擎未加载|r",
      body = "未检测到 WoWF_CraftArb，请确认 CraftArb.lua 已在 WoWF.toc 中且加载顺序位于 WoWF.lua 之前。",
      theme = "arbBad",
    })
    list:Finish()
    return
  end

  local source = state.craftSource == "vendor" and "vendor"
    or (state.craftSource == "both" and "both" or "craft")
  local rows, meta = arb.Analyse({
    mode = mode,
    source = source,
    preferVendor = state.craftPreferVendor == true,
    minSupply = state.craftMinSupply == true and 100 or nil,
    profession = state.craftProfession,
    onlyProfitable = onlyProfitable,
    onlySkillUp = state.craftOnlySkillUp == true,
    crossOwner = state.craftCrossOwner ~= false,
    sort = sortKey,
    query = (state.searchQuery and state.searchQuery ~= "") and state.searchQuery or nil,
  })

  -- 1. 数据源与专业等级总览
  local infoLines = {}
  local stateText
  local providerName = meta.provider == "blackthornes" and "黑石交易技能" or "EasyAuction"
  if meta.state == "ready" then
    local snapshot = meta.market and tonumber(meta.market.updatedAt)
    local stamp = snapshot and snapshot > 0 and date("%m-%d %H:%M", snapshot) or nil
    stateText = stamp
      and string.format("|cff00ff00已连接 %s 行情|r（快照: %s）", providerName, tostring(stamp))
      or string.format("|cff00ff00已连接 %s 行情|r", providerName)
  elseif meta.state == "loading" then
    stateText = "|cffffd100已安装 EasyAuction / 黑石交易技能，但当前市场行情尚未初始化|r（扫描一次拍卖行或等待初始化完成）"
  else
    stateText = "|cffff5555未检测到 EasyAuction 或黑石交易技能行情|r，启用任一拍卖插件并扫描拍卖行后即可给出真实价格"
  end
  table.insert(infoLines, "|cff99e6ff行情数据:|r " .. stateText)

  local ownProfessions = meta.ownProfessions or {}
  if #ownProfessions > 0 then
    local parts = {}
    for _, profession in ipairs(ownProfessions) do
      table.insert(parts, string.format("%s |cffaaaaaa%d/%d|r", profession.name or profession.key, profession.level or 0, profession.max or 0))
    end
    table.insert(infoLines, "|cff99e6ff本角色专业等级:|r " .. table.concat(parts, "  ·  "))
  else
    table.insert(infoLines, "|cff99e6ff本角色专业等级:|r |cffffd100未检测到已学专业|r（打开专业窗口或学习专业后重试）")
  end

  local hasEnchanting = false
  for _, profession in ipairs(ownProfessions) do
    if profession.key == "enchanting" then hasEnchanting = true end
  end
  local recipeCount = 0
  local cache = WoWFDB.recipeCache
  if type(cache) == "table" then
    -- 配方缓存按角色键隔离，这里只统计当前角色
    local scoped = cache[meta.identity and meta.identity.key or ""]
    if type(scoped) == "table" then
      for _ in pairs(scoped) do recipeCount = recipeCount + 1 end
    end
  end
  table.insert(infoLines, string.format(
    "|cff99e6ff配方来源:|r 拍卖/专业库 |cffffd100%d|r 个角色  ·  本插件采集 |cffffd100%d|r 条%s",
    meta.players or 0,
    recipeCount,
    recipeCount == 0 and "（打开一次专业窗口即可自动补全）" or ""
  ))
  local sourceLabel = source == "vendor" and "|cff00ffcc商人购入→拍卖出售|r"
    or (source == "both" and "|cff99e6ff制作 + 商人|r" or "|cff99e6ff制作套利|r")
  table.insert(infoLines, string.format(
    "|cff99e6ff统计:|r 已分析 |cffffd100%d|r 条，当前筛选下 |cffffd100%d|r 条，其中 |cff44ff88盈利 %d|r 条  ·  当前模式: %s  ·  来源: %s%s",
    meta.total or 0,
    meta.shown or 0,
    meta.profitable or 0,
    mode == "de" and "|cffffd100分解套利|r" or "|cff99e6ff成品出售|r",
    sourceLabel,
    source ~= "craft" and string.format("  ·  已采集商人商品 |cffffd100%d|r 件", meta.vendorOffers or 0) or ""
  ))
  if mode == "de" and not hasEnchanting then
    table.insert(infoLines, "|cffff5555注意:|r 当前角色没有【附魔】，分解套利只代表「若能分解」的理论值，实际无法执行。")
  end
  local profBtnLabel, profSummaryText = FormatCraftProfessionFilter(arb, meta.professions)
  table.insert(infoLines, string.format("|cff99e6ff当前筛选:|r %s  ·  %s  ·  %s  ·  %s  ·  排序: %s  ·  材料价: %s  ·  在售: %s  ·  售价: %s",
    profSummaryText,
    onlyProfitable and "|cff44ff88只看盈利|r" or "|cffffd100含亏损|r",
    state.craftCrossOwner ~= false and "|cff99e6ff含小号自产|r" or "|cffaaaaaa仅本角色|r",
    state.craftOnlySkillUp == true and "|cffffd100只看涨点|r" or "|cffaaaaaa含不涨点|r",
    sortKey == "roi" and "ROI" or "单次净利润",
    state.craftPreferVendor == true and "|cff00ffcc含商人价|r" or "|cffaaaaaa仅拍卖行|r",
    state.craftMinSupply == true and "|cff00ffcc在售≥100|r" or "|cffaaaaaa不限|r",
    "|cff99e6ff优先最低价(min)|r"))

  list:Add({
    title = "|cff00ffcc[制造套利] 用拍卖行行情筛选「当前可制作且能盈利」的配方|r",
    body = table.concat(infoLines, "\n"),
    theme = "header",
    action = {
      label = mode == "de" and "切回成品出售" or "切到分解套利",
      fn = function()
        state.craftMode = (state.craftMode == "de") and "sell" or "de"
        RefreshUI()
      end,
    },
  })

  -- 2. 紧凑工具条（专业下拉 + 4 个筛选/排序开关 + Tooltip 口径说明）
  list.y = LayoutArbToolbar(list.y, {
    buttons = {
      {
        label = source == "vendor" and "来源: 商人→拍卖" or (source == "both" and "来源: 全部" or "来源: 制作"),
        fn = function()
          local nextSource = source == "craft" and "vendor" or (source == "vendor" and "both" or "craft")
          state.craftSource = nextSource
          RefreshUI()
        end,
        tipTitle = "套利来源（制作 / 商人→拍卖 / 全部）",
        tipBody = "制作：买材料做成成品卖拍卖行（可递归折算中间产物 / 分解套利）；"
          .. "商人→拍卖：把打开 NPC 商人窗口时采集到的「买入价」与拍卖行对手最低价对比，直接倒买倒卖；"
          .. "全部：两类结果合并排序。商人商品来自本插件自动采集，打开任意商人窗口即可记录。",
      },
      {
        label = profBtnLabel,
        fn = function(self)
          OpenControlDropdown(self, function()
            local items = {
              {
                text = "全部专业（清空筛选）",
                isNotRadio = true,
                checked = function()
                  return type(state.craftProfession) ~= "table" or next(state.craftProfession) == nil
                end,
                func = function()
                  state.craftProfession = nil
                  RefreshUI()
                end,
              },
            }
            local profs = meta.professions or {}
            if #profs == 0 then
              table.insert(items, {
                text = "暂无可用专业配方",
                disabled = true,
                notCheckable = true,
              })
            else
              for _, stats in ipairs(profs) do
                local key = stats.key
                local name = (arb.ProfessionNames and arb.ProfessionNames[key]) or stats.name or key
                table.insert(items, {
                  text = string.format("%s (%d/%d)", name, stats.profitable or 0, stats.total or 0),
                  isNotRadio = true,
                  keepShownOnClick = true,
                  checked = function()
                    return IsCraftProfessionSelected(key)
                  end,
                  func = function()
                    ToggleCraftProfession(key)
                    RefreshUI()
                    if UIDropDownMenu_Refresh and dropdownMenu then
                      UIDropDownMenu_Refresh(dropdownMenu, nil, 1)
                    end
                  end,
                })
              end
            end
            return items
          end, function()
            local profs = meta.professions or {}
            if #profs == 0 then
              state.craftProfession = nil
            else
              local curKey = type(state.craftProfession) == "table" and next(state.craftProfession) or nil
              local nextIdx = 1
              if curKey then
                for i, stats in ipairs(profs) do
                  if stats.key == curKey then
                    nextIdx = i + 1
                    break
                  end
                end
              end
              if nextIdx > #profs then
                state.craftProfession = nil
              else
                state.craftProfession = { [profs[nextIdx].key] = true }
              end
            end
            RefreshUI()
          end)
        end,
        tipTitle = "专业过滤（单选/多选）",
        tipBody = "点击打开专业下拉框：可勾选一个或多个专业同时查看，点击「全部专业」可清空筛选。",
      },
      {
        label = onlyProfitable and "仅盈利: 开" or "仅盈利: 关",
        fn = function()
          state.craftOnlyProfit = not onlyProfitable
          RefreshUI()
        end,
        tipTitle = "盈亏过滤",
        tipBody = "开启时仅展示净利润 > 0 的配方；关闭后可查看亏损明细（材料按拍卖行可购深度逐档计价，成品售价取对手最低价不含押金）。",
      },
      {
        label = state.craftCrossOwner ~= false and "中间产物: 含小号" or "中间产物: 仅本角",
        fn = function()
          state.craftCrossOwner = (state.craftCrossOwner == false)
          RefreshUI()
        end,
        tipTitle = "中间产物来源",
        tipBody = "「中间产物」指布卷、锭、皮等半成品：会自动比较「拍卖行直购」与「自己制作」哪个更便宜，链式展开到最底层原料。允许含小号时可借用同账号其他角色已学配方。",
      },
      {
        label = sortKey == "roi" and "排序: ROI" or "排序: 净利润",
        fn = function()
          state.craftSort = (state.craftSort == "roi") and "profit" or "roi"
          RefreshUI()
        end,
        tipTitle = "盈利排序口径",
        tipBody = "ROI = 净利润 ÷ 材料成本，适合小号资金周转；单次净利润适合大批量出货。",
      },
      {
        label = state.craftOnlySkillUp == true and "涨点: 只看涨点" or "涨点: 全部",
        fn = function()
          state.craftOnlySkillUp = state.craftOnlySkillUp ~= true
          RefreshUI()
        end,
        tipTitle = "技能涨点过滤",
        tipBody = "开启后隐藏已灰（不涨点）的配方，适合边冲专业等级边回本。",
      },
      {
        label = state.craftPreferVendor == true and "商人材料价: 开" or "商人材料价: 关",
        fn = function()
          state.craftPreferVendor = state.craftPreferVendor ~= true
          RefreshUI()
        end,
        tipTitle = "制作材料优先用 NPC 商人价",
        tipBody = "开启后，制作成本会优先采用已采集到的 NPC 商人售价（若低于拍卖行）；"
          .. "关闭则只按拍卖行行情计价。商人价通过打开对应商人窗口自动采集。",
      },
      {
        label = state.craftMinSupply == true and "在售过滤: ≥100" or "在售过滤: 关",
        fn = function()
          state.craftMinSupply = state.craftMinSupply ~= true
          RefreshUI()
        end,
        tipTitle = "拍卖行在售数量过滤（异常价格防护）",
        tipBody = "开启后过滤掉拍卖行在售数量少于 100 件的物品——挂单过少通常意味着个别人乱挂的异常价格。"
          .. "数量来自 EasyAuction 全量扫描（bookQuantity / GetDepth 总量）；没有完整快照时在售数量记为「未知」，不参与过滤。",
      },
    },
  })

  -- 3. 利润明细（最多 40 条，避免一次创建过多卡片）
  local shown = 0
  for _, row in ipairs(rows) do
    if shown >= 40 then break end
    shown = shown + 1
    if row.kind == "vendor" then
      local vendorLines = {}
      table.insert(vendorLines, string.format(
        "|cff99e6ff商人买入:|r %s / 件  ·  |cff99e6ff拍卖行卖出:|r %s / 件（%s）  ·  |cff99e6ff在售:|r %s",
        FormatMoney(row.vendorPrice), FormatMoney(row.price or 0), PriceSourceText(row.priceSource), SupplyText(row.listedSupply)))
      local availableStock, hasAnyInfinite, hasAnyStock = nil, false, false
      for _, source in ipairs(row.vendorSources or {}) do
        local s = tonumber(source.stock) or -1
        if s < 0 then hasAnyInfinite = true
        elseif s > 0 then
          hasAnyStock = true
          availableStock = (availableStock or 0) + s
        end
      end
      local stockText = hasAnyInfinite and "|cffffd100无限库存|r"
        or hasAnyStock and string.format("%d 件", availableStock)
        or "|cffff8800已售罄|r"
      table.insert(vendorLines, string.format(
        "|cff99e6ff商人:|r %s  ·  |cff99e6ff地点:|r %s  ·  |cff99e6ff库存:|r %s",
        row.vendorNPC or "未知", row.vendorZone or "未知", stockText))
      if row.vendorSources and #row.vendorSources > 1 then
        local srcParts = {}
        for _, s in ipairs(row.vendorSources) do
          table.insert(srcParts, string.format("%s(%s, %s/件)", s.npc or "?", s.zone or "?", FormatMoney(s.price)))
        end
        table.insert(vendorLines, "|cffffd100其他商人:|r " .. table.concat(srcParts, " · "))
      end
      if row.profit then
        table.insert(vendorLines, string.format(
          "|cff99e6ff拍卖手续费:|r %s  ·  净利润 %s%s|r  ·  ROI %s%.1f%%|r",
          FormatMoney(row.cut or 0), CraftSignColor(row.profit), FormatMoney(row.profit),
          CraftSignColor(row.roi), (row.roi or 0) * 100))
      else
        table.insert(vendorLines, "|cffff8800无法给出利润:|r " .. (row.reason or "缺少数据"))
      end
      if not row.price then
        table.insert(vendorLines, "|cffff8800提示:|r 该物品暂无拍卖行报价，不能算作可执行套利。")
      end
      local profitable = (row.profit or 0) > 0
      -- 售罄判定必须看全部来源：最低价来源售罄但其他商人有货时，仍可从有货来源采购。
      -- 从可用来源统一取价格 / 商人 / 地点 / 可购买数量，避免混用不同来源的数据。
      local buySource
      for _, source in ipairs(row.vendorSources or {}) do
        if not source.stock or source.stock ~= 0 then
          if not buySource or source.price < buySource.price then buySource = source end
        end
      end
      local vendorAction
      if buySource then
        local sourceQty = (buySource.stock and buySource.stock > 0) and buySource.stock or 0
        vendorAction = {
          label = sourceQty > 0 and "加入购物清单" or "加入购物清单(无限)",
          fn = function()
            local api = arb.Market()
            if not api or type(api.CreateShoppingList) ~= "function" or type(api.SetShoppingListItem) ~= "function" then
              DEFAULT_CHAT_FRAME:AddMessage("|cffff5555[WoWF 商人套利]|r 未检测到 EasyAuction 购物清单写入接口。")
              return
            end
            local qty = sourceQty > 0 and sourceQty or 1
            local ok, listID = pcall(api.CreateShoppingList, "WoWF 商人套利", true)
            if not ok or not listID then
              DEFAULT_CHAT_FRAME:AddMessage("|cffff5555[WoWF 商人套利]|r 创建购物清单失败。")
              return
            end
            local wroteOK, wrote = pcall(api.SetShoppingListItem, listID, row.outputID, qty, buySource.price, row.name)
            if not wroteOK or wrote == false then
              DEFAULT_CHAT_FRAME:AddMessage("|cffff5555[WoWF 商人套利]|r 写入购物清单失败（清单 ID: " .. tostring(listID) .. "）。")
              return
            end
            DEFAULT_CHAT_FRAME:AddMessage(string.format(
              "|cff00ffcc[WoWF 商人套利]|r 已把 %s ×%d 写入购物清单（清单 ID: %s），买入价 %s、到 %s 找 %s。",
              FormatItemLink(row.outputID, row.name), qty, tostring(listID), FormatMoney(buySource.price),
              buySource.zone or "?", buySource.npc or "?"))
          end,
        }
      end
      list:Add({
        title = string.format("%s  |cffffd100[商人→拍卖] %s|r", FormatItemLink(row.outputID, row.name), row.vendorNPC or "商人"),
        body = table.concat(vendorLines, "\n"),
        theme = profitable and "arbGood" or "arbBad",
        badge = row.profit and string.format("%s%s|r", CraftSignColor(row.profit), FormatMoney(row.profit)) or "无报价",
        action = vendorAction,
      })
    else
    local bodyLines = {}
    local costText
    if row.costTotal then
      costText = FormatMoney(row.costTotal)
      if row.stockShort then costText = costText .. "|cffff8800(含缺货估价)|r" end
    elseif row.partialCost then
      costText = "|cffff8800报价不完整|r"
    else
      costText = "|cffff8800成本未知|r"
    end
    table.insert(bodyLines, string.format(
      "|cff99e6ff单次制作:|r 产出 %s × |cffffd100%s|r  ·  材料成本 %s  ·  可制作 %s",
      FormatItemLink(row.outputID, row.name), string.format("%.1f", row.yield or 1),
      costText,
      row.craftable and "|cff00ff00是|r" or "|cffff5555否|r"
    ))

    local leafLines = {}
    for _, leaf in ipairs(row.leaves or {}) do
      local unitText = leaf.unit and FormatMoney(leaf.unit) or "|cffff8800无报价|r"
      table.insert(leafLines, string.format("    · %s ×%d  @ %s",
        FormatItemLink(leaf.itemID),
        math.ceil(leaf.quantity or 0), unitText))
    end
    local craftNotes = {}
    for _, craft in ipairs(row.craftLines or {}) do
      local saved = craft.saved
      table.insert(craftNotes, string.format("    · %s 用配方「%s」自产 ×%d 批%s%s",
        FormatItemLink(craft.itemID),
        (craft.recipe and craft.recipe.name) or "中间产物",
        math.max(1, craft.batches or 1),
        (saved and saved > 0) and string.format("（比直购省 %s）", FormatMoney(saved)) or "",
        craft.crossOwner and " |cffff8800[小号]|r" or ""))
    end
    if #leafLines > 0 then
      table.insert(bodyLines, "|cffffd100采购清单 (拍卖行):|r\n" .. table.concat(leafLines, "\n"))
    end
    if row.stockShort then
      table.insert(bodyLines, "|cffff8800注意:|r 部分材料在 EasyAuction 当前深度里库存不足，实际可能买不齐，单价按现有挂单估算。")
    end
    if #craftNotes > 0 then
      table.insert(bodyLines, "|cff88ff88自产中间产物:|r\n" .. table.concat(craftNotes, "\n"))
    end

    if row.disenchant then
      local parts = {}
      for _, part in ipairs(row.disenchant.parts) do
        table.insert(parts, string.format("%s×%.1f", FormatItemLink(part.itemID), part.quantity))
      end
      table.insert(bodyLines, string.format(
        "|cff99e6ff分解期望:|r %s%s|r%s",
        FormatMoney(row.disenchant.ev or 0),
        (#parts > 0) and ("（" .. table.concat(parts, " + ") .. "）") or "",
        row.disenchant.incomplete and " |cffff8800部分材料无报价，期望值仅为下界|r" or ""
      ))
    end
    table.insert(bodyLines, string.format("|cff99e6ff在售:|r %s", SupplyText(row.listedSupply)))
    if row.price then
      table.insert(bodyLines, string.format("|cff99e6ff拍卖行售价:|r %s|r / 件（%s）",
        FormatMoney(row.price), PriceSourceText(row.priceSource)))
    end
    if row.disenchantEV then
      local verdict
      if row.disenchantUnknown then
        verdict = "|cffff8800（分解报价不完整，暂无法判断）|r"
      elseif row.disenchantWins then
        verdict = "|cff44ff88（分解更赚，可切到「分解套利」看细节）|r"
      else
        verdict = "|cffaaaaaa（不如直接卖拍卖）|r"
      end
      table.insert(bodyLines, string.format("|cff99e6ff分解期望:|r %s|r / 件%s%s",
        FormatMoney(row.disenchantEV),
        row.disenchantIncomplete and "（下界）" or "",
        verdict))
    end

    if row.profit then
      table.insert(bodyLines, string.format(
        "|cff99e6ff拍卖手续费:|r %s  ·  净利润 %s%s|r  ·  ROI %s%.1f%%|r  ·  每件 %s%s|r",
        FormatMoney(row.cut or 0),
        CraftSignColor(row.profit), FormatMoney(row.profit),
        CraftSignColor(row.roi), (row.roi or 0) * 100,
        CraftSignColor(row.profitPerUnit), FormatMoney(row.profitPerUnit or 0)
      ))
    else
      table.insert(bodyLines, "|cffff8800无法给出利润:|r " .. (row.reason or "缺少数据"))
    end
    table.insert(bodyLines, string.format(
      "|cff99e6ff技能:|r %s  ·  角色 %s|r%s%s",
      CRAFT_DIFFICULTY_LABEL[row.skillUp] or CRAFT_DIFFICULTY_LABEL.unknown,
      row.ownerSource == "easyauction" and "EasyAuction 专业库"
        or (row.ownerSource == "blackthornes" and "黑石交易技能" or "本插件采集"),
      (row.skill and string.format(" · |cffffd100%d/%d|r", row.skill, row.skillMax or 0)) or "",
      row.ownCharacter and "" or " |cffff8800[同账号小号]|r"
    ))

    local profitable = (row.profit or 0) > 0
    list:Add({
      title = string.format("%s  |cffffd100[%s]|r", FormatItemLink(row.outputID, row.name), row.professionName or "专业"),
      body = table.concat(bodyLines, "\n"),
      theme = profitable and "arbGood" or "arbBad",
      badge = row.profit and string.format("%s%s|r", CraftSignColor(row.profit), FormatMoney(row.profit)) or "无报价",
      action = {
        label = "加入购物清单",
        fn = function()
          local ok, listIDOrReason, note = WoWF_CraftArb.AddToShoppingList(row, row.name or WoWF_CraftArb.ItemName(row.outputID))
          if ok then
            DEFAULT_CHAT_FRAME:AddMessage(string.format(
              "|cff00ffcc[WoWF 制造套利]|r 已把 %s 的材料写入购物清单（清单 ID: %s）%s",
              FormatItemLink(row.outputID, row.name), tostring(listIDOrReason),
              note and ("，" .. note) or ""))
          else
            DEFAULT_CHAT_FRAME:AddMessage(string.format(
              "|cffff5555[WoWF 制造套利]|r 写入购物清单失败: %s。", tostring(listIDOrReason)))
          end
        end,
      },
    })
    end
  end

  -- 5. 空状态
  if shown == 0 then
    local emptyLines = {}
    if source == "vendor" and (meta.vendorOffers or 0) == 0 then
      table.insert(emptyLines, "|cffffd100尚未采集到任何 NPC 商人商品。|r")
      table.insert(emptyLines, "1. 走到任意 NPC 商人（杂货商、专业供应商等）面前，打开商人窗口，本插件会自动记录其出售物品的买入价与库存；")
      table.insert(emptyLines, "2. 记录后切回「制造套利」页，把来源切到「商人→拍卖」即可查看可直接倒买倒卖的商品；")
      table.insert(emptyLines, "3. 若拍卖行插件尚未扫描，将只显示商人买入价、无法计算利润，并不会把无报价当作 0 成本。")
    elseif meta.total == 0 then
      table.insert(emptyLines, "|cffffd100还没有可用于分析的配方数据。|r")
      table.insert(emptyLines, "1. 安装并启用 EasyAuction 或黑石交易技能（Blackthornes_TS），进过拍卖行后其专业库会记录各角色已学配方；")
      table.insert(emptyLines, "2. 也可以打开一次游戏原生专业窗口（裁缝/锻造/附魔等），本页面会自动采集当前角色的配方；")
      table.insert(emptyLines, "3. 首次使用请让拍卖行插件扫描一次拍卖行，否则没有可比价的行情。")
    elseif meta.state ~= "ready" then
      table.insert(emptyLines, "|cffffd100行情尚未就绪，暂时无法算利润。|r")
      table.insert(emptyLines, "请启用 EasyAuction 或黑石交易技能并至少扫描一次拍卖行；随后本页会自动按新行情重算。")
    elseif onlyProfitable then
      table.insert(emptyLines, string.format(
        "|cffffd100当前没有可盈利的配方。|r已分析 %d 条、有报价 %d 条；可点击上方「显示全部配方」查看亏损明细，或检查行情快照是否过期。",
        meta.total or 0, meta.priced or 0))
    else
      table.insert(emptyLines, "当前筛选条件下没有配方，可清空搜索框或点击「显示全部专业」重试。")
    end
    list:Add({
      title = "|cffffd100[提示] 暂无可展示的套利结果|r",
      body = table.concat(emptyLines, "\n"),
      theme = "milestone",
    })
  end

  list:Finish()
end

local function RenderTabForeverAndNews()
  local list = CreateCardList(6)
  local cls = GetCurrentClassData()
  local spec = GetCurrentSpecData()
  local recProfs = (spec and spec.recommendedProfs) or ""
  local playerProfs = GetPlayerProfessions()
  local isMatchMode = (state.featureFilter == "MATCH") and (not state.searchQuery or state.searchQuery == "")
  local profCount = #(Data.professions or {})
  local toggle = FilterToggle("featureFilter", {
    {
      value = "MATCH",
      btnLabel = "查看全部特色与专业",
      desc = string.format("当前筛选: 匹配当前角色 (Lv.%d %s · %s)", state.level, cls and cls.name or state.classKey, spec and spec.name or "默认专精"),
    },
    {
      value = "ALL",
      btnLabel = "仅看当前角色匹配",
      desc = string.format("当前筛选: 全部无限服特色玩法与 %d 大专业", profCount),
    },
  })

  list:Add({
    title = "|cff00ffcc[特色&专业] 无限服专属玩法与 1-300 专业指南 (" .. toggle.desc .. ")|r",
    body = string.format("包含《魔兽世界：无限服》专属玩法（舒适睡袋、制皮营地帐篷、传承天赋加点推荐、遭劫的板条箱等）、%d 大专业 1-300 冲级指南与最新热修公告。默认仅显示适合当前等级/阵营/专业且未完成的特色玩法（已完成睡袋或非制皮帐篷将自动隐藏），以及当前专精推荐专业。", profCount),
    theme = "legacy",
    action = toggle.action,
  })

  -- 1. 无限服专属玩法攻略（露营、睡袋、传承天赋、物资箱等）
  for _, sys in ipairs(Data.foreverSystems or {}) do
    local levelMatch = (not isMatchMode) or (not sys.minLevel) or (state.level >= sys.minLevel)
    local sysMatch = true
    if isMatchMode then
      if sys.id == "sleeping-bag" and IsQuestCompletedById(79975) then
        sysMatch = false
      elseif sys.id == "camping-tents" and not HasPlayerProfession(playerProfs, "制皮", "Leatherworking") then
        sysMatch = false
      end
    end
    if levelMatch and sysMatch and MatchesSearch((sys.title or "") .. " " .. (sys.summary or "")) then
      local lines = { LinkifyInlineCoords(sys.summary or "", "", sys.title or "") }
      -- 传承树：先把「按角色等级的加点方案」放在最前，避免玩家先读三页分支说明
      if sys.id == "legacy-system" then
        local legacyRec = BuildLegacyRecommendationLines(state.level, playerProfs, false)
        table.insert(lines, "")
        for _, rLine in ipairs(legacyRec) do
          table.insert(lines, rLine)
        end
      end
      local firstCoord = nil
      local inlineBranches = (sys.id == "legacy-system")
      for _, st in ipairs(sys.steps or {}) do
        local stepTitle = st.title or ""
        local factionMatch = true
        if isMatchMode then
          if string.find(stepTitle, "^联盟：") and state.faction == "horde" then
            factionMatch = false
          elseif string.find(stepTitle, "^部落：") and state.faction == "alliance" then
            factionMatch = false
          end
        end
        if factionMatch then
          if inlineBranches then
            -- 三条传承树分支各压成一行：标题本身已说明该树用途，说明只取第一短句，
            -- 具体先点哪些节点由上面的「加点顺序」给出，避免同一段说明反复占行。
            local branchLine = "  " .. LinkifyInlineCoords(stepTitle, st.zone or "", stepTitle)
            local detail = st.detail or ""
            if detail ~= "" then
              -- 注意：不要用 Lua 的字符类匹配中文标点（按字节匹配会截断 UTF-8），
              -- 一律用 find(..., true) 取字节位置再 sub，边界都在标点之前所以安全。
              local firstClause = detail
              local cutPos = nil
              for _, sep in ipairs({ "。", "，", "；" }) do
                local p = string.find(detail, sep, 1, true)
                if p and (not cutPos or p < cutPos) then cutPos = p end
              end
              if cutPos and cutPos > 1 then
                firstClause = string.sub(detail, 1, cutPos - 1)
              end
              -- 首句仍偏长（旧数据是「提供A、B、C…」长枚举）时，按顿号累加，够了就省略
              if #firstClause > 90 then
                local pieces, acc, startAt = {}, 0, 1
                while true do
                  local p = string.find(detail, "、", startAt, true)
                  local piece = string.sub(detail, startAt, (p and (p - 1)) or #detail)
                  if piece == "" then break end
                  if #pieces > 0 and acc + #piece > 60 then break end
                  table.insert(pieces, piece)
                  acc = acc + #piece
                  if not p then break end
                  startAt = p + 3 -- 「、」在 UTF-8 里占 3 字节
                  if acc > 60 then break end
                end
                if #pieces > 0 then
                  firstClause = table.concat(pieces, "、") .. "…"
                end
              end
              if firstClause ~= "" then
                branchLine = branchLine .. "  |cffaabbcc" .. LinkifyInlineCoords(firstClause, st.zone or "", stepTitle) .. "|r"
              end
            end
            table.insert(lines, branchLine)
          else
            local stepLabel = (st.questName and st.questName ~= "") and st.questName or StripCoordsFromText(stepTitle)
            if stepLabel == "" then
              stepLabel = (st.zone and st.zone ~= "") and st.zone or "起点"
            end
            if st.coord and not firstCoord then
              firstCoord = { zone = st.zone, title = stepLabel, x = st.coord.x, y = st.coord.y }
            end
            local titleText = LinkifyInlineCoords(stepTitle, st.zone or "", stepLabel)
            if not string.find(titleText, "|Hwowfmap:", 1, true) and not string.find(titleText, "|Hwowfnpc:", 1, true) then
              if st.coord then
                titleText = titleText .. FormatCoordLink(st.zone or "", stepLabel, st.coord.x, st.coord.y)
              end
              if st.altCoord then
                titleText = titleText .. " / " .. FormatCoordLink(st.altCoord.zone or "", st.altCoord.label or stepLabel, st.altCoord.x, st.altCoord.y, false)
              end
            elseif st.altCoord then
              local altX = string.format("%.1f", tonumber(st.altCoord.x) or 0)
              if not string.find(stepTitle, altX, 1, true) then
                titleText = titleText .. " / " .. FormatCoordLink(st.altCoord.zone or "", st.altCoord.label or stepLabel, st.altCoord.x, st.altCoord.y, false)
              end
            end
            local stepHeader = "|cffffd100" .. titleText .. "|r"
            if st.questId and st.questName then
              local qObj = {
                id = st.questId,
                name = st.questName,
                level = st.questLevel or 14,
                zone = st.zone or "",
                x = st.coord and st.coord.x or nil,
                y = st.coord and st.coord.y or nil,
              }
              stepHeader = stepHeader .. "  " .. FormatQuestLink(qObj, st.questLevel or 14, st.zone or "")
            end
            local stepDetail = LinkifyInlineCoords(st.detail or "", st.zone or "", stepLabel)
            table.insert(lines, string.format("\n%s\n%s", stepHeader, stepDetail))
          end
        end
      end

      list:Add({
        title = "|cff00ffcc" .. LinkifyInlineCoords(sys.title or "", "", sys.title or "") .. "|r",
        body = table.concat(lines, "\n"),
        theme = "legacy",
        badge = sys.category or "无限服特色",
        action = firstCoord and {
          label = "标记起点到地图",
          fn = function() SetWaypointOrPrint(firstCoord.zone, firstCoord.title, firstCoord.x, firstCoord.y) end,
        } or nil,
      })
    end
  end

  -- 2. 12 大专业 1-300 冲级与无限服特色指南 (内置数据)
  if Data.professions and #Data.professions > 0 then
    for _, prof in ipairs(Data.professions) do
      local isRec = (recProfs ~= "" and string.find(recProfs, prof.name or "", 1, true) ~= nil)
      local passProfFilter = (not isMatchMode) or (recProfs == "") or isRec or (prof.type == "secondary")
      local searchText = (prof.name or "") .. " " .. (prof.brackets or "") .. " " .. (prof.foreverNote or "")
      if passProfFilter and MatchesSearch(searchText) then
        local pLines = {}
        if prof.pairs and #prof.pairs > 0 then
          table.insert(pLines, "|cff00ff96最佳搭配专业:|r " .. table.concat(prof.pairs, " / "))
        end
        if prof.makes and #prof.makes > 0 then
          table.insert(pLines, "|cffffd100核心产出:|r " .. table.concat(prof.makes, " · "))
        end
        if prof.brackets and prof.brackets ~= "" then
          table.insert(pLines, "|cff71d5ff1–300 冲级路线:|r " .. prof.brackets)
        end
        if prof.trainers and prof.trainers ~= "" then
          table.insert(pLines, "|cffffa500关键训练师与突破:|r " .. LinkifyInlineCoords(prof.trainers, "", (prof.name or "") .. "训练师", { linkifyNpc = true }))
        end
        if prof.foreverNote and prof.foreverNote ~= "" then
          table.insert(pLines, "|cff00ffcc★ 无限服指南:|r " .. LinkifyInlineCoords(prof.foreverNote, "", prof.name or ""))
        end

        local typeLabel = prof.type == "gathering" and "采集专业" or (prof.type == "secondary" and "生活副业" or "制造专业")
        local recTag = isRec and " |cff00ff00[★当前专精推荐]|r" or ""
        list:Add({
          title = string.format("|cff00ff96[专业] %s (1-300)|r%s", prof.name or prof.id, recTag),
          body = table.concat(pLines, "\n"),
          theme = isRec and "profRec" or "prof",
          badge = typeLabel,
        })
      end
    end
  end

  -- 3. 最新热修公告 (内置快照)
  local newsLines = {}
  for _, n in ipairs(Data.news or {}) do
    table.insert(newsLines, string.format("- |cffffd100[%s] %s|r\n  %s", n.date or "", n.title or "", LinkifyInlineCoords(n.summary or "", "", n.title or "公告")))
  end
  if #newsLines > 0 then
    local meta = Data.meta or {}
    list:Add({
      title = string.format("|cffffa500[公告] 无限服最新热修与官方公告 (数据版本: %s)|r", meta.updatedAt or "最新"),
      body = table.concat(newsLines, "\n\n"),
      theme = "news",
      badge = meta.dbVersion and (string.format("DB v%s", meta.dbVersion)) or "内置快照",
    })
  end

  list:Finish()
end

-- ============================================================================
-- 6. 标签页注册表、主窗口构建与顶部状态控制栏
-- ============================================================================

local TAB_DEFS = {
  { id = 1, label = "智能匹配",     render = RenderTabSmartMatch,      slash = { "", "home", "smart" }, searchable = false },
  { id = 2, label = "升级路线",     render = RenderTabRoutes,          slash = { "route", "level" }, onSlash = function() state.routeFilter = "MATCH" end, searchable = true },
  { id = 3, label = "职业与天赋",   render = RenderTabClassAndTalents, slash = { "class", "talent" }, onSlash = function() state.talentFilter = "MATCH" end, searchable = true },
  { id = 4, label = "一键宏库",     render = RenderTabMacros,          slash = { "macro", "macros" }, searchable = true },
  { id = 5, label = "地下城百科",   render = RenderTabDungeons,        slash = { "dungeon", "dungeons" }, searchable = true },
  { id = 6, label = "专业&无限特色", render = RenderTabForeverAndNews, slash = { "news", "forever", "prof", "professions" }, onSlash = function() state.featureFilter = "MATCH" end, searchable = true },
  { id = 9, label = "声望",         render = RenderTabReputations,     slash = { "rep", "reputation", "factions" }, searchable = true },
  { id = 7, label = "无限服速查",     render = RenderTabCommands,        slash = { "cmd", "commands", "console", "quick" }, searchable = true },
  { id = 8, label = "制造套利",     render = RenderTabCraftArb,        slash = { "arb", "craft", "crafting", "profit", "auction" }, searchable = true },
}
local TAB_BY_ID = {}
local SLASH_TO_TAB = {}
for _, def in ipairs(TAB_DEFS) do
  TAB_BY_ID[def.id] = def
  for _, alias in ipairs(def.slash or {}) do
    SLASH_TO_TAB[alias] = def
  end
end

local headerControls = {}
local refreshTimerPending = false
local pendingPreserveScroll = nil

local function ScheduleRefresh(preserveScroll, delay)
  if not mainFrame or not mainFrame:IsShown() then return end
  if preserveScroll == false then
    pendingPreserveScroll = false
  elseif preserveScroll == true and pendingPreserveScroll == nil then
    pendingPreserveScroll = true
  end
  if refreshTimerPending then return end
  if C_Timer and C_Timer.After then
    refreshTimerPending = true
    C_Timer.After(delay or 0.2, function()
      refreshTimerPending = false
      local ps = (pendingPreserveScroll == true)
      pendingPreserveScroll = nil
      RefreshUI(ps)
    end)
  else
    local ps = (pendingPreserveScroll == true)
    pendingPreserveScroll = nil
    RefreshUI(ps)
  end
end

local function ResetToCharacter(followState)
  if followState ~= nil then
    state.autoFollow = followState and true or false
  else
    state.autoFollow = true
  end
  if state.autoFollow then
    state.routeFilter = "MATCH"
    state.talentFilter = "MATCH"
    state.dungeonFilter = "MATCH"
    state.featureFilter = "MATCH"
    SyncPlayerCharacter()
  end
  RefreshUI()
end

RefreshUI = function(preserveScroll)
  if not mainFrame or not mainFrame:IsShown() then return end
  if state.autoFollow then
    SyncPlayerCharacter()
  end

  local cls = GetCurrentClassData()
  local spec = GetCurrentSpecData()
  local route = GetCurrentRoute()

  if headerControls.levelBtn then
    headerControls.levelBtn:SetText(string.format("Lv.%d", state.level))
  end
  if headerControls.classBtn then
    headerControls.classBtn:SetText("职业: " .. (cls and cls.name or state.classKey))
  end
  if headerControls.specBtn then
    headerControls.specBtn:SetText("专精: " .. (spec and spec.name or "默认"))
  end
  if headerControls.routeBtn then
    headerControls.routeBtn:SetText("路线: " .. (route and route.name or state.routeId))
  end
  if headerControls.followBtn then
    headerControls.followBtn:SetText(state.autoFollow and "|cff00ffcc跟随角色: 开|r" or "|cffffa500跟随角色: 关|r")
  end

  local tabDef = TAB_BY_ID[state.activeTab] or TAB_DEFS[1]
  if headerControls.searchBox then
    local canSearch = (tabDef.searchable ~= false)
    headerControls.searchBox:EnableMouse(canSearch)
    headerControls.searchBox:SetAlpha(canSearch and 1.0 or 0.45)
    if not canSearch then
      headerControls.searchBox:ClearFocus()
    end
    if headerControls.searchPlaceholder then
      local txt = headerControls.searchBox:GetText() or ""
      headerControls.searchPlaceholder:SetText(canSearch and "搜索当前页…" or "本页不支持搜索")
      headerControls.searchPlaceholder:SetShown(txt == "")
    end
  end

  for tabId, btn in pairs(tabButtons) do
    if tabId == state.activeTab then
      btn:LockHighlight()
    else
      btn:UnlockHighlight()
    end
  end

  local savedScroll = (preserveScroll and scrollFrame) and (scrollFrame:GetVerticalScroll() or 0) or 0

  tabDef.render()

  if scrollFrame then
    if preserveScroll then
      local maxScroll = math.max(0, ((contentChild and contentChild:GetHeight()) or 0) - (scrollFrame:GetHeight() or 0))
      scrollFrame:SetVerticalScroll(math.max(0, math.min(savedScroll, maxScroll)))
    else
      scrollFrame:SetVerticalScroll(0)
    end
  end
  SavePersistedState()
end

OpenControlDropdown = function(anchorBtn, buildItemsFn, fallbackFn)
  if UIDropDownMenu_Initialize and UIDropDownMenu_CreateInfo and UIDropDownMenu_AddButton and ToggleDropDownMenu then
    if not dropdownMenu then
      dropdownMenu = CreateFrame("Frame", "WoWFControlDropDown", UIParent, "UIDropDownMenuTemplate")
    end
    UIDropDownMenu_Initialize(dropdownMenu, function(_, level)
      for _, item in ipairs(buildItemsFn() or {}) do
        local info = UIDropDownMenu_CreateInfo()
        info.text = item.text
        if type(item.checked) == "function" then
          info.checked = item.checked
        else
          info.checked = item.checked and true or false
        end
        info.func = item.func
        if item.keepShownOnClick ~= nil then info.keepShownOnClick = item.keepShownOnClick end
        if item.isNotRadio ~= nil then info.isNotRadio = item.isNotRadio end
        if item.notCheckable ~= nil then info.notCheckable = item.notCheckable end
        if item.isTitle ~= nil then info.isTitle = item.isTitle end
        if item.disabled ~= nil then info.disabled = item.disabled end
        UIDropDownMenu_AddButton(info, level)
      end
    end, "MENU")
    ToggleDropDownMenu(1, nil, dropdownMenu, anchorBtn, 0, 0)
  elseif fallbackFn then
    fallbackFn()
  end
end

local function CreateMainWindow()
  if mainFrame then return mainFrame end

  local template = BackdropTemplateMixin and "BackdropTemplate" or nil
  mainFrame = CreateFrame("Frame", "WoWFMainFrame", UIParent, template)
  mainFrame:SetSize(800, 560)
  mainFrame:SetPoint("CENTER")
  mainFrame:SetFrameStrata("MEDIUM")
  if mainFrame.SetToplevel then
    mainFrame:SetToplevel(true)
  end
  mainFrame:EnableMouse(true)
  mainFrame:SetMovable(true)
  mainFrame:RegisterForDrag("LeftButton")
  mainFrame:SetScript("OnDragStart", mainFrame.StartMoving)
  mainFrame:SetScript("OnDragStop", mainFrame.StopMovingOrSizing)
  mainFrame:Hide()

  if mainFrame.SetBackdrop then
    mainFrame:SetBackdrop({
      bgFile = "Interface\\Buttons\\WHITE8x8",
      edgeFile = "Interface\\Tooltips\\UI-Tooltip-Border",
      tile = true, tileSize = 16, edgeSize = 16,
      insets = { left = 4, right = 4, top = 4, bottom = 4 },
    })
    mainFrame:SetBackdropColor(0.04, 0.06, 0.09, 0.96)
    mainFrame:SetBackdropBorderColor(0.0, 0.80, 0.68, 0.95)
  end

  tinsert(UISpecialFrames, "WoWFMainFrame")

  -- 标题栏
  local titleText = mainFrame:CreateFontString(nil, "OVERLAY", "GameFontNormalLarge")
  titleText:SetPoint("TOPLEFT", 16, -14)
  titleText:SetText("|cff00ffcc巫妖王的无限百科|r  |cffffd100魔兽世界：无限服 游戏内智能百科|r")

  local closeBtn = CreateFrame("Button", nil, mainFrame, "UIPanelCloseButton")
  closeBtn:SetPoint("TOPRIGHT", -4, -4)

  -- 控制栏 (智能跟随 + 等级微调 + 职业/专精/路线切换 + 搜索框)
  local ctrlBar = CreateFrame("Frame", nil, mainFrame, template)
  ctrlBar:SetPoint("TOPLEFT", 12, -40)
  ctrlBar:SetPoint("TOPRIGHT", -12, -40)
  ctrlBar:SetHeight(36)
  if ctrlBar.SetBackdrop then
    ctrlBar:SetBackdrop({
      bgFile = "Interface\\Buttons\\WHITE8x8",
      edgeFile = "Interface\\Tooltips\\UI-Tooltip-Border",
      tile = true, tileSize = 8, edgeSize = 10,
      insets = { left = 2, right = 2, top = 2, bottom = 2 },
    })
    ctrlBar:SetBackdropColor(0.08, 0.11, 0.16, 0.95)
    ctrlBar:SetBackdropBorderColor(0.2, 0.35, 0.45, 0.8)
  end

  -- 单一「跟随角色」开关：显式文本状态，点击切换跟随/重新同步当前角色
  local followBtn = CreateFrame("Button", nil, ctrlBar, "UIPanelButtonTemplate")
  followBtn:SetSize(104, 22)
  followBtn:SetPoint("LEFT", 8, 0)
  followBtn:SetText("|cff00ffcc跟随角色: 开|r")
  followBtn:SetScript("OnClick", function()
    ResetToCharacter(not state.autoFollow)
  end)
  AttachTooltip(followBtn, "跟随当前角色", function()
    return state.autoFollow
      and "当前已开启自动跟随：等级、职业、专精与路线会自动同步实时角色；点击可暂停自动跟随。"
      or "当前处于手动预览模式；点击可重新对齐当前角色并重置各页筛选为 MATCH。"
  end)
  headerControls.followBtn = followBtn

  -- 等级 -1 / Lv.X / +1
  local lvlMinusBtn = CreateFrame("Button", nil, ctrlBar, "UIPanelButtonTemplate")
  lvlMinusBtn:SetSize(24, 22)
  lvlMinusBtn:SetPoint("LEFT", followBtn, "RIGHT", 6, 0)
  lvlMinusBtn:SetText("-")
  lvlMinusBtn:SetScript("OnClick", function()
    state.autoFollow = false
    state.level = math.max(1, state.level - 1)
    RefreshUI()
  end)
  AttachTooltip(lvlMinusBtn, "等级 -1", "手动降低预览等级（会自动暂停跟随角色）。")

  local levelBtn = CreateFrame("Button", nil, ctrlBar, "UIPanelButtonTemplate")
  levelBtn:SetSize(54, 22)
  levelBtn:SetPoint("LEFT", lvlMinusBtn, "RIGHT", 2, 0)
  levelBtn:SetScript("OnClick", function(_, button)
    state.autoFollow = false
    if button == "RightButton" then
      state.level = math.max(1, state.level - 5)
    else
      state.level = math.min(60, state.level + 5)
    end
    RefreshUI()
  end)
  levelBtn:RegisterForClicks("LeftButtonUp", "RightButtonUp")
  AttachTooltip(levelBtn, "快速调整等级", "左键点击 +5 级  ·  右键点击 -5 级（自动暂停跟随角色）。")
  headerControls.levelBtn = levelBtn

  local lvlPlusBtn = CreateFrame("Button", nil, ctrlBar, "UIPanelButtonTemplate")
  lvlPlusBtn:SetSize(24, 22)
  lvlPlusBtn:SetPoint("LEFT", levelBtn, "RIGHT", 2, 0)
  lvlPlusBtn:SetText("+")
  lvlPlusBtn:SetScript("OnClick", function()
    state.autoFollow = false
    state.level = math.min(60, state.level + 1)
    RefreshUI()
  end)
  AttachTooltip(lvlPlusBtn, "等级 +1", "手动提高预览等级（会自动暂停跟随角色）。")

  -- 职业下拉选择按钮
  local classBtn = CreateFrame("Button", nil, ctrlBar, "UIPanelButtonTemplate")
  classBtn:SetSize(100, 22)
  classBtn:SetPoint("LEFT", lvlPlusBtn, "RIGHT", 6, 0)
  classBtn:SetScript("OnClick", function(self)
    OpenControlDropdown(self, function()
      local items = {}
      local classes = Data.classes or {}
      for _, k in ipairs(CLASS_ORDER) do
        local c = classes[k]
        if c then
          table.insert(items, {
            text = c.name or k,
            checked = (state.classKey == k),
            func = function()
              state.autoFollow = false
              state.classKey = k
              state.specIndex = 1
              RefreshUI()
            end,
          })
        end
      end
      return items
    end, function()
      state.autoFollow = false
      local idx = 1
      for i, k in ipairs(CLASS_ORDER) do
        if k == state.classKey then idx = i; break end
      end
      state.classKey = CLASS_ORDER[(idx % #CLASS_ORDER) + 1]
      state.specIndex = 1
      RefreshUI()
    end)
  end)
  AttachTooltip(classBtn, "选择职业", "点击打开职业下拉菜单，切换后会自动暂停跟随角色。")
  headerControls.classBtn = classBtn

  -- 专精下拉选择按钮
  local specBtn = CreateFrame("Button", nil, ctrlBar, "UIPanelButtonTemplate")
  specBtn:SetSize(100, 22)
  specBtn:SetPoint("LEFT", classBtn, "RIGHT", 6, 0)
  specBtn:SetScript("OnClick", function(self)
    OpenControlDropdown(self, function()
      local items = {}
      local cls = GetCurrentClassData()
      for idx, sp in ipairs((cls and cls.specs) or {}) do
        table.insert(items, {
          text = sp.name or ("专精 " .. idx),
          checked = (state.specIndex == idx),
          func = function()
            state.autoFollow = false
            state.specIndex = idx
            RefreshUI()
          end,
        })
      end
      return items
    end, function()
      state.autoFollow = false
      local cls = GetCurrentClassData()
      local count = (cls and cls.specs and #cls.specs) or 1
      if count > 0 then
        state.specIndex = (state.specIndex % count) + 1
      end
      RefreshUI()
    end)
  end)
  AttachTooltip(specBtn, "选择专精", "点击打开当前职业的专精下拉菜单。")
  headerControls.specBtn = specBtn

  -- 种族路线下拉选择按钮
  local routeBtn = CreateFrame("Button", nil, ctrlBar, "UIPanelButtonTemplate")
  routeBtn:SetSize(124, 22)
  routeBtn:SetPoint("LEFT", specBtn, "RIGHT", 6, 0)
  routeBtn:SetScript("OnClick", function(self)
    OpenControlDropdown(self, function()
      local items = {}
      local routes = Data.routes or {}
      for _, rId in ipairs(ROUTE_ORDER) do
        local r = routes[rId]
        if r then
          table.insert(items, {
            text = string.format("%s (%s)", r.name or rId, FactionTag(r.faction)),
            checked = (state.routeId == rId),
            func = function()
              state.autoFollow = false
              state.routeId = rId
              if r.faction then state.faction = r.faction end
              RefreshUI()
            end,
          })
        end
      end
      return items
    end, function()
      state.autoFollow = false
      local idx = 1
      for i, r in ipairs(ROUTE_ORDER) do
        if r == state.routeId then idx = i; break end
      end
      state.routeId = ROUTE_ORDER[(idx % #ROUTE_ORDER) + 1]
      local route = GetCurrentRoute()
      if route and route.faction then state.faction = route.faction end
      RefreshUI()
    end)
  end)
  AttachTooltip(routeBtn, "选择种族升级路线", "点击打开种族路线下拉菜单（会同步切换对应阵营）。")
  headerControls.routeBtn = routeBtn

  -- 搜索输入框（含占位提示，仅在支持搜索的标签页启用）
  local searchBox = CreateFrame("EditBox", nil, ctrlBar, "InputBoxTemplate")
  searchBox:SetSize(128, 20)
  searchBox:SetPoint("RIGHT", ctrlBar, "RIGHT", -10, 0)
  searchBox:SetAutoFocus(false)
  searchBox:SetTextInsets(6, 6, 0, 0)
  local searchPlaceholder = searchBox:CreateFontString(nil, "ARTWORK", "GameFontDisableSmall")
  searchPlaceholder:SetPoint("LEFT", 8, 0)
  searchPlaceholder:SetText("搜索当前页…")
  headerControls.searchBox = searchBox
  headerControls.searchPlaceholder = searchPlaceholder
  searchBox:SetScript("OnTextChanged", function(self)
    local txt = self:GetText() or ""
    state.searchQuery = txt
    searchPlaceholder:SetShown(txt == "")
    ScheduleRefresh(false, 0.2)
  end)
  searchBox:SetScript("OnEscapePressed", function(self)
    self:SetText("")
    self:ClearFocus()
  end)
  AttachTooltip(searchBox, "关键词搜索", "对当前标签页内容进行关键词过滤（按 Esc 清空；「智能匹配」总览页不支持搜索）。")

  -- 功能标签栏（由 TAB_DEFS 统一驱动）
  local tabX = 12
  for i, def in ipairs(TAB_DEFS) do
    local btn = CreateFrame("Button", nil, mainFrame, "UIPanelButtonTemplate")
    btn:SetText(def.label)
    local textWidth = btn:GetTextWidth()
    if not textWidth or textWidth <= 0 then
      textWidth = #def.label * 14
    end
    local width = math.max(74, math.ceil(textWidth + 20))
    btn:SetSize(width, 26)
    btn:SetPoint("TOPLEFT", tabX, -82)
    btn:SetScript("OnClick", function()
      state.activeTab = def.id
      RefreshUI()
    end)
    tabButtons[def.id] = btn
    tabX = tabX + width + 4
  end

  -- 滚动内容区域
  scrollFrame = CreateFrame("ScrollFrame", "WoWFMainScrollFrame", mainFrame, "UIPanelScrollFrameTemplate")
  scrollFrame:SetPoint("TOPLEFT", 12, -114)
  scrollFrame:SetPoint("BOTTOMRIGHT", -32, 12)

  contentChild = CreateFrame("Frame", nil, scrollFrame)
  contentChild:SetSize(740, 500)
  if contentChild.SetHyperlinksEnabled then
    pcall(contentChild.SetHyperlinksEnabled, contentChild, true)
  end
  scrollFrame:SetScrollChild(contentChild)

  return mainFrame
end

local function ToggleMainWindow(forceTab)
  CreateMainWindow()
  if forceTab then
    state.activeTab = forceTab
    SyncPlayerCharacter()
    mainFrame:Show()
    RefreshUI()
    return
  end
  if mainFrame:IsShown() then
    mainFrame:Hide()
  else
    SyncPlayerCharacter()
    mainFrame:Show()
    RefreshUI()
  end
end

-- ============================================================================
-- 7. 小地图悬浮按钮与实时智能提示框
-- ============================================================================

local minimapBtn
local function UpdateMinimapButtonPosition()
  if not minimapBtn or not Minimap then return end
  local angle = math.rad(WoWFDB.minimapPos or 215)
  local x = math.cos(angle) * 80
  local y = math.sin(angle) * 80
  minimapBtn:ClearAllPoints()
  minimapBtn:SetPoint("CENTER", Minimap, "CENTER", x, y)
end

local function CreateMinimapButton()
  if minimapBtn or not Minimap then return end

  minimapBtn = CreateFrame("Button", "WoWFMinimapButton", Minimap)
  minimapBtn:SetSize(32, 32)
  minimapBtn:SetFrameStrata("MEDIUM")
  minimapBtn:SetFrameLevel(8)
  minimapBtn:RegisterForClicks("LeftButtonUp", "RightButtonUp")
  minimapBtn:RegisterForDrag("LeftButton")
  minimapBtn:SetHighlightTexture("Interface\\Minimap\\UI-Minimap-ZoomButton-Highlight")

  local icon = minimapBtn:CreateTexture(nil, "BACKGROUND")
  icon:SetSize(20, 20)
  icon:SetPoint("CENTER", 0, 0)
  icon:SetTexture("Interface\\Icons\\INV_Misc_Book_11")

  local border = minimapBtn:CreateTexture(nil, "OVERLAY")
  border:SetSize(52, 52)
  border:SetPoint("TOPLEFT", 0, 0)
  border:SetTexture("Interface\\Minimap\\MiniMap-TrackingBorder")

  minimapBtn:SetScript("OnDragStart", function(self)
    self:SetScript("OnUpdate", function()
      local mx, my = Minimap:GetCenter()
      local cx, cy = GetCursorPosition()
      local scale = Minimap:GetEffectiveScale() or 1
      cx, cy = cx / scale, cy / scale
      WoWFDB.minimapPos = math.deg(math.atan2(cy - my, cx - mx))
      UpdateMinimapButtonPosition()
    end)
  end)

  minimapBtn:SetScript("OnDragStop", function(self)
    self:SetScript("OnUpdate", nil)
  end)

  minimapBtn:SetScript("OnClick", function(_, button)
    if button == "RightButton" then
      state.autoFollow = true
      ToggleMainWindow(1)
    else
      ToggleMainWindow()
    end
  end)

  minimapBtn:SetScript("OnEnter", function(self)
    SyncPlayerCharacter()
    local route = GetCurrentRoute()
    local spec = GetCurrentSpecData()
    local band = GetMatchedBand(route, state.level)
    local step = GetMatchedTalentStep(spec, state.level)

    GameTooltip:SetOwner(self, "ANCHOR_LEFT")
    GameTooltip:AddLine("|cff00ffcc巫妖王的无限百科|r |cffffd100(无限服百科)|r")
    local zoneList = {}
    local seenZones = {}
    if band and band.zone and band.zone ~= "" then
      seenZones[band.zone] = true
      table.insert(zoneList, band.zone)
    end
    if band and band.altZones then
      local altAdded = 0
      for _, az in ipairs(band.altZones) do
        if az.zone and az.zone ~= "" and not seenZones[az.zone] then
          seenZones[az.zone] = true
          table.insert(zoneList, az.zone)
          altAdded = altAdded + 1
          if altAdded >= 3 then break end
        end
      end
    end
    local zoneText = (#zoneList > 0) and table.concat(zoneList, " / ") or "未知"
    GameTooltip:AddLine(string.format("当前角色: |cffffffffLv.%d|r  ·  适龄区域: |cff00ffcc%s|r", state.level, zoneText))
    if band and band.hub and band.hub.name ~= "" then
      GameTooltip:AddLine(string.format("参考据点: |cffffd100%s|r", band.hub.name))
    end
    if step then
      GameTooltip:AddLine(string.format("本级天赋: |cffffd100[%s] %s (%d/%d)|r", step.tree, step.name, step.rank, step.max))
    end
    GameTooltip:AddLine(" ")
    GameTooltip:AddLine("|cff00ff00左键点击:|r 打开/关闭百科主窗口")
    GameTooltip:AddLine("|cff00ff00右键点击:|r 打开主窗口并切换到[智能匹配]")
    GameTooltip:AddLine("|cffaaaaaa按住左键拖拽可移动小地图图标位置|r")
    GameTooltip:Show()
  end)

  minimapBtn:SetScript("OnLeave", function()
    GameTooltip:Hide()
  end)

  UpdateMinimapButtonPosition()
end

-- ============================================================================
-- 8. 事件监听与斜杠命令 (/wowf, /wowfio)
-- ============================================================================

local eventFrame = CreateFrame("Frame")
eventFrame:RegisterEvent("PLAYER_LOGIN")
eventFrame:RegisterEvent("PLAYER_ENTERING_WORLD")
eventFrame:RegisterEvent("PLAYER_LEVEL_UP")
eventFrame:RegisterEvent("ZONE_CHANGED_NEW_AREA")
eventFrame:RegisterEvent("UPDATE_FACTION")
pcall(eventFrame.RegisterEvent, eventFrame, "BAG_UPDATE_DELAYED")
for _, questEv in ipairs({ "QUEST_TURNED_IN", "QUEST_ACCEPTED", "QUEST_REMOVED", "QUEST_LOG_UPDATE" }) do
  pcall(eventFrame.RegisterEvent, eventFrame, questEv)
end
-- 学会骑术后立即刷新「当前必做」里的骑术提醒
for _, spellEv in ipairs({ "SPELLS_CHANGED", "LEARNED_SPELL_IN_TAB" }) do
  pcall(eventFrame.RegisterEvent, eventFrame, spellEv)
end
for _, talentEv in ipairs({ "TRAIT_CONFIG_UPDATED", "PLAYER_TALENT_UPDATE", "ACTIVE_TALENT_GROUP_CHANGED", "CHARACTER_POINTS_CHANGED", "SKILL_LINES_CHANGED" }) do
  pcall(eventFrame.RegisterEvent, eventFrame, talentEv)
end
-- 制造套利：专业窗口打开时自动补全本插件的配方缓存，物品异步加载完成时重绘套利页
for _, craftEv in ipairs({ "TRADE_SKILL_SHOW", "TRADE_SKILL_LIST_UPDATE", "TRADE_SKILL_CLOSE", "AUCTION_HOUSE_SHOW", "AUCTION_HOUSE_CLOSED", "GET_ITEM_INFO_RECEIVED", "ITEM_DATA_LOAD_RESULT" }) do
  pcall(eventFrame.RegisterEvent, eventFrame, craftEv)
end
-- 商人套利：打开 NPC 商人窗口时自动采集其出售商品与买入价
for _, vendorEv in ipairs({ "MERCHANT_SHOW", "MERCHANT_UPDATE" }) do
  pcall(eventFrame.RegisterEvent, eventFrame, vendorEv)
end
pcall(eventFrame.RegisterEvent, eventFrame, "GET_ITEM_INFO_RECEIVED")

local hasPrintedWelcome = false

eventFrame:SetScript("OnEvent", function(_, event, arg1, arg2)
  if event == "PLAYER_LOGIN" or event == "PLAYER_ENTERING_WORLD" then
    LoadPersistedState()
    CreateMinimapButton()
    SyncPlayerCharacter()
    RefreshUI()
    if event == "PLAYER_ENTERING_WORLD" and not hasPrintedWelcome then
      hasPrintedWelcome = true
      local route = GetCurrentRoute()
      local cls = GetCurrentClassData()
      local spec = GetCurrentSpecData()
      DEFAULT_CHAT_FRAME:AddMessage(string.format(
        "|cff00ffcc[巫妖王的无限百科]|r 已加载 |cffffd100内置百科数据库|r并自动匹配当前角色: |cffffd100Lv.%d %s·%s (%s)|r！输入 |cffffd100/wowf|r 或点击小地图图标查看。",
        state.level,
        route and route.name or "",
        cls and cls.name or "",
        spec and spec.name or ""
      ))
    end
  elseif event == "PLAYER_LEVEL_UP" then
    local newLevel = tonumber(arg1) or ((UnitLevel and UnitLevel("player")) or state.level)
    SyncPlayerCharacter(newLevel)
    local spec = GetCurrentSpecData()
    local route = GetCurrentRoute()
    local step = GetMatchedTalentStep(spec, newLevel)
    local band = GetMatchedBand(route, newLevel)
    local msgParts = { string.format("恭喜升至 |cffffd100Lv.%d|r！", newLevel) }
    if step then
      table.insert(msgParts, string.format("推荐天赋: |cff00ffcc[%s] %s (%d/%d)|r", step.tree, step.name, step.rank, step.max))
    end
    if band then
      table.insert(msgParts, string.format("推荐练级区: |cffffd100%s (%s)|r", band.zone or "", (band.hub and band.hub.name) or ""))
    end
    DEFAULT_CHAT_FRAME:AddMessage("|cff00ffcc[巫妖王的无限百科]|r " .. table.concat(msgParts, " · ") .. " (输入 /wowf 查看详情)")
    RefreshUI()
  elseif event == "UPDATE_FACTION" or event == "BAG_UPDATE_DELAYED" then
    local refreshReputation = (event == "UPDATE_FACTION" and state.activeTab == 9)
    if mainFrame and mainFrame:IsShown() and (state.activeTab == 1 or state.activeTab == 2 or refreshReputation) then
      ScheduleRefresh(true, 0.2)
    end
  elseif event == "TRADE_SKILL_SHOW" or event == "TRADE_SKILL_LIST_UPDATE" then
    -- 打开专业窗口时顺带补全配方缓存（离线也能给出成本，不必依赖 EasyAuction 采集）
    local ok, count = pcall(function() return WoWF_CraftArb and WoWF_CraftArb.Harvest() end)
    if ok and count and count > 0 then
      WoWFDB.craftHarvestCount = count
      if mainFrame and mainFrame:IsShown() and state.activeTab == 8 then
        ScheduleRefresh(true, 0.2)
      end
    end
  elseif event == "TRADE_SKILL_CLOSE" then
    if mainFrame and mainFrame:IsShown() and state.activeTab == 8 then
      ScheduleRefresh(true, 0.2)
    end
  elseif event == "MERCHANT_SHOW" or event == "MERCHANT_UPDATE" then
    if WoWF_CraftArb and WoWF_CraftArb.HarvestVendor then
      local ok, count = pcall(WoWF_CraftArb.HarvestVendor)
      if ok and count and count > 0 and mainFrame and mainFrame:IsShown() and state.activeTab == 8 then
        ScheduleRefresh(true, 0.2)
      end
    end
  elseif event == "AUCTION_HOUSE_SHOW" or event == "AUCTION_HOUSE_CLOSED" then
    -- 行情快照只在拍卖行内更新：回到「制造套利」页时重新计算一次
    if WoWF_CraftArb then WoWF_CraftArb.Reset() end
    if mainFrame and mainFrame:IsShown() and state.activeTab == 8 then
      ScheduleRefresh(true, 0.2)
    end
  elseif event == "GET_ITEM_INFO_RECEIVED" or event == "ITEM_DATA_LOAD_RESULT" then
    if arg2 == true then
      local itemID = tonumber(arg1)
      if itemID and WoWF_CraftArb and WoWF_CraftArb.HasPendingItem and WoWF_CraftArb.HasPendingItem(itemID) then
        if WoWF_CraftArb.Reset then WoWF_CraftArb.Reset() end
      end
      if mainFrame and mainFrame:IsShown() then
        ScheduleRefresh(true, 0.25)
      end
    end
  elseif event == "QUEST_TURNED_IN" or event == "QUEST_ACCEPTED" or event == "QUEST_REMOVED" or event == "QUEST_LOG_UPDATE" or event == "SKILL_LINES_CHANGED" or event == "SPELLS_CHANGED" or event == "LEARNED_SPELL_IN_TAB" then
    if mainFrame and mainFrame:IsShown() then
      ScheduleRefresh(true, 0.2)
    end
  else
    if mainFrame and mainFrame:IsShown() then
      SyncPlayerCharacter()
      ScheduleRefresh(false, 0.2)
    end
  end
end)

SLASH_WOWF1 = "/wowf"
SLASH_WOWF2 = "/wowfio"
SlashCmdList["WOWF"] = function(msg)
  local cmd = string.lower(string.gsub(msg or "", "^%s*(.-)%s*$", "%1"))
  if cmd == "help" or cmd == "?" then
    DEFAULT_CHAT_FRAME:AddMessage("|cff00ffcc[巫妖王的无限百科]|r 可用斜杠子命令:")
    DEFAULT_CHAT_FRAME:AddMessage("  |cffffd100/wowf|r — 打开智能匹配仪表盘")
    DEFAULT_CHAT_FRAME:AddMessage("  |cffffd100/wowf route|r — 升级路线   |cffffd100/wowf class|r — 职业与天赋   |cffffd100/wowf macro|r — 一键宏库")
    DEFAULT_CHAT_FRAME:AddMessage("  |cffffd100/wowf dungeon|r — 地下城百科   |cffffd100/wowf news|r — 专业&无限特色   |cffffd100/wowf rep|r — 声望   |cffffd100/wowf cmd|r — 无限服速查   |cffffd100/wowf arb|r — 制造套利")
    return
  end
  local def = SLASH_TO_TAB[cmd] or TAB_DEFS[1]
  if def.onSlash then def.onSlash() end
  ToggleMainWindow(def.id)
end
