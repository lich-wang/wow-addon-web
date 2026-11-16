import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import JSZip from 'jszip';

function getAutoVersion() {
  try {
    const raw = execFileSync(
      'git',
      ['rev-list', '--count', 'HEAD', '--', 'scripts/locales/foreverTransit.js'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
    const count = Number.parseInt(raw, 10);
    if (Number.isFinite(count) && count >= 0) {
      return `v1.0.${count + 1}`;
    }
  } catch {
    // 非 Git 环境下回退默认版本号
  }
  return 'v1.0.1';
}

const VERSION = getAutoVersion();

const TOC_CONTENT = `## Interface: 16001
## Title: ForeverTransit
## Title-zhCN: |cff00ccff[地图]|r 无限航线图 (船只与飞艇)
## Notes: Displays boat, zeppelin, and tram routes on the World Map for WoW Forever, automatically filtered by faction.
## Notes-zhCN: 专为《魔兽世界：无限服》打造的船只、飞艇与矿道地铁大地图航线插件，支持跨大陆连线、出港方向指引与自动按阵营过滤。
## Author: lich.tech
## Version: ${VERSION}
## SavedVariables: ForeverTransitDB
## Category: Map

Data.lua
ForeverTransit.lua
`;

const DATA_LUA = `-- ForeverTransit Data.lua
-- 《魔兽世界：无限服 (WoW Forever)》船只、飞艇与矿道地铁航线数据
-- 坐标与站点数据校验自 Forever 实机采集记录

ForeverTransit_Nodes = {
    -- 东部王国
    DOCK_STORMWIND = {
        id = "DOCK_STORMWIND",
        name = "暴风城港口",
        shortName = "暴风城",
        zoneName = "暴风城",
        kind = "ship",
        faction = "Alliance",
        mapID = 1453,
        x = 0.2255,
        y = 0.5613,
    },
    DOCK_MENETHIL = {
        id = "DOCK_MENETHIL",
        name = "米奈希尔港 (北码头)",
        shortName = "米奈希尔",
        zoneName = "湿地",
        kind = "ship",
        faction = "Alliance",
        mapID = 1437,
        x = 0.0464,
        y = 0.5716,
    },
    DOCK_MENETHIL_THERAMORE = {
        id = "DOCK_MENETHIL_THERAMORE",
        name = "米奈希尔港 (南码头)",
        shortName = "米奈希尔",
        zoneName = "湿地",
        kind = "ship",
        faction = "Alliance",
        mapID = 1437,
        x = 0.0509,
        y = 0.6351,
    },
    DOCK_SOUTHSHORE = {
        id = "DOCK_SOUTHSHORE",
        name = "南海镇码头",
        shortName = "南海镇",
        zoneName = "希尔斯布莱德丘陵",
        kind = "ship",
        faction = "Alliance",
        mapID = 1424,
        x = 0.5053,
        y = 0.6975,
    },
    DOCK_DALARAN = {
        id = "DOCK_DALARAN",
        name = "达拉然飞艇/船码头",
        shortName = "达拉然",
        zoneName = "奥特兰克山脉",
        kind = "ship",
        faction = "Alliance",
        mapID = 1416,
        x = 0.1262,
        y = 0.5203,
    },
    DOCK_BOOTYBAY = {
        id = "DOCK_BOOTYBAY",
        name = "藏宝海湾码头",
        shortName = "藏宝海湾",
        zoneName = "荆棘谷",
        kind = "ship",
        faction = "Neutral",
        mapID = 1434,
        x = 0.3908,
        y = 0.6673,
    },
    DOCK_POWDERFUSE = {
        id = "DOCK_POWDERFUSE",
        name = "引信港码头",
        shortName = "引信港",
        zoneName = "河间林地",
        kind = "ship",
        faction = "Neutral",
        mapID = 2548,
        x = 0.8031,
        y = 0.5439,
    },
    ZEPPELIN_TIRISFAL_ORGRIMMAR = {
        id = "ZEPPELIN_TIRISFAL_ORGRIMMAR",
        name = "提瑞斯法飞艇塔 (奥格瑞玛线)",
        shortName = "幽暗城",
        zoneName = "提瑞斯法林地",
        kind = "zeppelin",
        faction = "Horde",
        mapID = 1420,
        x = 0.6070,
        y = 0.5880,
    },
    ZEPPELIN_TIRISFAL_GROMGOL = {
        id = "ZEPPELIN_TIRISFAL_GROMGOL",
        name = "提瑞斯法飞艇塔 (格罗姆高线)",
        shortName = "幽暗城",
        zoneName = "提瑞斯法林地",
        kind = "zeppelin",
        faction = "Horde",
        mapID = 1420,
        x = 0.6190,
        y = 0.5910,
    },
    ZEPPELIN_GROMGOL_ORGRIMMAR = {
        id = "ZEPPELIN_GROMGOL_ORGRIMMAR",
        name = "格罗姆高飞艇塔 (奥格瑞玛线)",
        shortName = "格罗姆高",
        zoneName = "荆棘谷",
        kind = "zeppelin",
        faction = "Horde",
        mapID = 1434,
        x = 0.3130,
        y = 0.3010,
    },
    ZEPPELIN_GROMGOL_TIRISFAL = {
        id = "ZEPPELIN_GROMGOL_TIRISFAL",
        name = "格罗姆高飞艇塔 (幽暗城线)",
        shortName = "格罗姆高",
        zoneName = "荆棘谷",
        kind = "zeppelin",
        faction = "Horde",
        mapID = 1434,
        x = 0.3160,
        y = 0.2920,
    },
    TRAM_STORMWIND = {
        id = "TRAM_STORMWIND",
        name = "矿道地铁入口 (暴风城)",
        shortName = "暴风城地铁",
        zoneName = "暴风城",
        kind = "tram",
        faction = "Alliance",
        mapID = 1453,
        x = 0.6903,
        y = 0.3110,
    },
    TRAM_IRONFORGE = {
        id = "TRAM_IRONFORGE",
        name = "矿道地铁入口 (铁炉堡)",
        shortName = "铁炉堡地铁",
        zoneName = "铁炉堡",
        kind = "tram",
        faction = "Alliance",
        mapID = 1455,
        x = 0.7641,
        y = 0.5123,
    },

    -- 卡利姆多
    DOCK_AUBERDINE_STORMWIND = {
        id = "DOCK_AUBERDINE_STORMWIND",
        name = "奥伯丁码头 (暴风城线)",
        shortName = "奥伯丁",
        zoneName = "黑海岸",
        kind = "ship",
        faction = "Alliance",
        mapID = 1439,
        x = 0.3077,
        y = 0.4101,
    },
    DOCK_AUBERDINE_RUTTHERAN = {
        id = "DOCK_AUBERDINE_RUTTHERAN",
        name = "奥伯丁码头 (鲁瑟兰村线)",
        shortName = "奥伯丁",
        zoneName = "黑海岸",
        kind = "ship",
        faction = "Alliance",
        mapID = 1439,
        x = 0.3318,
        y = 0.4013,
    },
    DOCK_AUBERDINE_MENETHIL = {
        id = "DOCK_AUBERDINE_MENETHIL",
        name = "奥伯丁码头 (米奈希尔/南海镇环线)",
        shortName = "奥伯丁",
        zoneName = "黑海岸",
        kind = "ship",
        faction = "Alliance",
        mapID = 1439,
        x = 0.3237,
        y = 0.4381,
    },
    DOCK_RUTTHERAN = {
        id = "DOCK_RUTTHERAN",
        name = "鲁瑟兰村码头",
        shortName = "鲁瑟兰村",
        zoneName = "泰达希尔",
        kind = "ship",
        faction = "Alliance",
        mapID = 1438,
        x = 0.5488,
        y = 0.9671,
    },
    DOCK_THERAMORE = {
        id = "DOCK_THERAMORE",
        name = "塞拉摩岛码头",
        shortName = "塞拉摩",
        zoneName = "尘泥沼泽",
        kind = "ship",
        faction = "Alliance",
        mapID = 1445,
        x = 0.7150,
        y = 0.5635,
    },
    DOCK_FEATHERMOON = {
        id = "DOCK_FEATHERMOON",
        name = "羽月要塞码头",
        shortName = "羽月要塞",
        zoneName = "菲拉斯",
        kind = "ship",
        faction = "Alliance",
        mapID = 1444,
        x = 0.2780,
        y = 0.3171,
    },
    DOCK_FORGOTTENCOAST = {
        id = "DOCK_FORGOTTENCOAST",
        name = "被遗忘的海岸码头",
        shortName = "被遗忘的海岸",
        zoneName = "菲拉斯",
        kind = "ship",
        faction = "Alliance",
        mapID = 1444,
        x = 0.3542,
        y = 0.5040,
    },
    DOCK_RATCHET = {
        id = "DOCK_RATCHET",
        name = "棘齿城码头",
        shortName = "棘齿城",
        zoneName = "贫瘠之地",
        kind = "ship",
        faction = "Neutral",
        mapID = 1413,
        x = 0.6446,
        y = 0.5083,
    },
    DOCK_STEAMWHEEDLE = {
        id = "DOCK_STEAMWHEEDLE",
        name = "热砂港码头",
        shortName = "热砂港",
        zoneName = "塔纳利斯",
        kind = "ship",
        faction = "Neutral",
        mapID = 1446,
        x = 0.6836,
        y = 0.2302,
    },
    ZEPPELIN_ORGRIMMAR_GROMGOL = {
        id = "ZEPPELIN_ORGRIMMAR_GROMGOL",
        name = "奥格瑞玛飞艇塔 (格罗姆高线)",
        shortName = "奥格瑞玛",
        zoneName = "杜隆塔尔",
        kind = "zeppelin",
        faction = "Horde",
        mapID = 1411,
        x = 0.5070,
        y = 0.1280,
    },
    ZEPPELIN_ORGRIMMAR_TIRISFAL = {
        id = "ZEPPELIN_ORGRIMMAR_TIRISFAL",
        name = "奥格瑞玛飞艇塔 (幽暗城线)",
        shortName = "奥格瑞玛",
        zoneName = "杜隆塔尔",
        kind = "zeppelin",
        faction = "Horde",
        mapID = 1411,
        x = 0.5080,
        y = 0.1370,
    },
    DOCK_SKYWATCHER = {
        id = "DOCK_SKYWATCHER",
        name = "天穹守望者高地码头",
        shortName = "天穹守望者高地",
        zoneName = "莫高雷",
        kind = "ship",
        faction = "Horde",
        mapID = 1412,
        x = 0.3430,
        y = 0.2576,
    },

    -- 塞弗拉斯岛 (无限服天裔新手岛)
    DOCK_VALANAAR = {
        id = "DOCK_VALANAAR",
        name = "瓦拉纳尔港",
        shortName = "塞弗拉斯岛",
        zoneName = "塞弗拉斯岛",
        kind = "ship",
        faction = "Horde",
        mapID = 2521,
        x = 0.5791,
        y = 0.8078,
    },
    DOCK_ZEPHRAS_ALLIANCE = {
        id = "DOCK_ZEPHRAS_ALLIANCE",
        name = "塞弗拉斯岛联盟码头",
        shortName = "塞弗拉斯岛",
        zoneName = "塞弗拉斯岛",
        kind = "ship",
        faction = "Alliance",
        mapID = 2521,
        x = 0.6581,
        y = 0.8341,
    },
}

ForeverTransit_Routes = {
    -- 联盟船只
    {
        from = "DOCK_STORMWIND",
        to = "DOCK_AUBERDINE_STORMWIND",
        kind = "ship",
        faction = "Alliance",
        ride = 55,
        dock = 60,
        note = "无限服新增跨海航线",
    },
    -- 奥伯丁 -> 米奈希尔港 -> 南海镇 -> 奥伯丁 (无限服单向三站环线)
    {
        from = "DOCK_AUBERDINE_MENETHIL",
        to = "DOCK_MENETHIL",
        kind = "ship",
        faction = "Alliance",
        oneway = true,
        ride = 65,
        dock = 60,
        note = "无限服单向环线 (第1段: 奥伯丁 -> 米奈希尔 -> 南海镇)",
    },
    {
        from = "DOCK_MENETHIL",
        to = "DOCK_SOUTHSHORE",
        kind = "ship",
        faction = "Alliance",
        oneway = true,
        ride = 135,
        dock = 60,
        note = "无限服单向环线 (第2段: 米奈希尔 -> 南海镇 -> 奥伯丁)",
    },
    {
        from = "DOCK_SOUTHSHORE",
        to = "DOCK_AUBERDINE_MENETHIL",
        kind = "ship",
        faction = "Alliance",
        oneway = true,
        ride = 75,
        dock = 60,
        note = "无限服单向环线 (第3段: 南海镇 -> 奥伯丁 -> 米奈希尔)",
    },
    {
        from = "DOCK_MENETHIL_THERAMORE",
        to = "DOCK_THERAMORE",
        kind = "ship",
        faction = "Alliance",
        ride = 155,
        dock = 60,
    },
    {
        from = "DOCK_AUBERDINE_RUTTHERAN",
        to = "DOCK_RUTTHERAN",
        kind = "ship",
        faction = "Alliance",
        ride = 65,
        dock = 60,
    },
    {
        from = "DOCK_FEATHERMOON",
        to = "DOCK_FORGOTTENCOAST",
        kind = "ship",
        faction = "Alliance",
        ride = 60,
        dock = 30,
    },
    {
        from = "DOCK_ZEPHRAS_ALLIANCE",
        to = "DOCK_DALARAN",
        kind = "ship",
        faction = "Alliance",
        ride = 115,
        dock = 60,
        note = "无限服天裔新手岛航线",
    },

    -- 联盟矿道地铁
    {
        from = "TRAM_STORMWIND",
        to = "TRAM_IRONFORGE",
        kind = "tram",
        faction = "Alliance",
        ride = 70,
        dock = 20,
        note = "暴风城矮人区 <-> 铁炉堡工匠区",
    },

    -- 部落飞艇与船只
    {
        from = "ZEPPELIN_ORGRIMMAR_TIRISFAL",
        to = "ZEPPELIN_TIRISFAL_ORGRIMMAR",
        kind = "zeppelin",
        faction = "Horde",
        ride = 120,
        dock = 60,
    },
    {
        from = "ZEPPELIN_ORGRIMMAR_GROMGOL",
        to = "ZEPPELIN_GROMGOL_ORGRIMMAR",
        kind = "zeppelin",
        faction = "Horde",
        ride = 95,
        dock = 60,
    },
    {
        from = "ZEPPELIN_TIRISFAL_GROMGOL",
        to = "ZEPPELIN_GROMGOL_TIRISFAL",
        kind = "zeppelin",
        faction = "Horde",
        ride = 90,
        dock = 60,
    },
    {
        from = "DOCK_VALANAAR",
        to = "DOCK_SKYWATCHER",
        kind = "ship",
        faction = "Horde",
        ride = 140,
        dock = 30,
        note = "无限服天裔新手岛航线",
    },

    -- 中立船只 (联盟/部落通用)
    {
        from = "DOCK_BOOTYBAY",
        to = "DOCK_RATCHET",
        kind = "ship",
        faction = "Neutral",
        ride = 95,
        dock = 60,
        note = "热砂港财团中立航线 (双阵营通用)",
    },
    {
        from = "DOCK_STEAMWHEEDLE",
        to = "DOCK_POWDERFUSE",
        kind = "ship",
        faction = "Neutral",
        ride = 69,
        dock = 60,
        note = "无限服新增中立航线 (双阵营通用)",
    },
}
`;

const CORE_LUA = `-- ForeverTransit.lua
-- 在世界地图 (WorldMapFrame) 上绘制无限服船只、飞艇与矿道地铁航线，默认按角色阵营自动过滤

local ADDON_NAME = ...

local DEFAULTS = {
    enabled = true,
    filterMode = "auto", -- "auto" | "all"
    showNeutral = true,
    showTram = true,
    showLabels = true,
}

local COLORS = {
    Alliance = { r = 0.24, g = 0.64, b = 1.00, hex = "3da3ff", label = "联盟" },
    Horde    = { r = 1.00, g = 0.30, b = 0.24, hex = "ff4d3d", label = "部落" },
    Neutral  = { r = 0.22, g = 0.86, b = 0.56, hex = "38db8f", label = "中立" },
    Tram     = { r = 0.68, g = 0.56, b = 1.00, hex = "ad8fff", label = "地铁" },
}

local KIND_LABELS = {
    ship = "船只",
    zeppelin = "飞艇",
    tram = "矿道地铁",
}

local db
local overlayFrame
local controlButton
local linePool = {}
local lineUsed = 0
local pinPool = {}
local pinUsed = 0
local labelPool = {}
local labelUsed = 0
local hooked = false

local function InitDB()
    ForeverTransitDB = ForeverTransitDB or {}
    db = ForeverTransitDB
    for k, v in pairs(DEFAULTS) do
        if db[k] == nil then
            db[k] = v
        end
    end
end

local function GetPlayerFaction()
    local faction = UnitFactionGroup("player")
    if faction == "Alliance" or faction == "Horde" then
        return faction
    end
    return nil
end

local function ShouldShowRoute(route)
    if not db or not db.enabled then
        return false
    end
    if route.kind == "tram" and not db.showTram then
        return false
    end
    if route.faction == "Neutral" then
        return db.showNeutral
    end
    if db.filterMode == "all" then
        return true
    end
    local playerFaction = GetPlayerFaction()
    if not playerFaction then
        return true
    end
    return route.faction == playerFaction
end

local function GetRouteStyleColor(route)
    if route.kind == "tram" then
        return COLORS.Tram
    end
    return COLORS[route.faction] or COLORS.Neutral
end

local function GetNodeStyleColor(node)
    if node.kind == "tram" then
        return COLORS.Tram
    end
    return COLORS[node.faction] or COLORS.Neutral
end

local function ProjectPoint(node, targetMapID)
    if not node or not targetMapID then
        return nil
    end
    if node.mapID == targetMapID then
        return node.x, node.y
    end
    if not (C_Map and C_Map.GetWorldPosFromMapPos and C_Map.GetMapPosFromWorldPos and CreateVector2D) then
        return nil
    end
    local ok1, continent, worldPos = pcall(C_Map.GetWorldPosFromMapPos, node.mapID, CreateVector2D(node.x, node.y))
    if not (ok1 and continent and worldPos) then
        return nil
    end
    local ok2, _, mapPos = pcall(C_Map.GetMapPosFromWorldPos, continent, worldPos, targetMapID)
    if not (ok2 and mapPos) then
        return nil
    end
    local px, py = mapPos:GetXY()
    if not px or not py or px < 0 or px > 1 or py < 0 or py > 1 then
        return nil
    end
    return px, py
end

local function GetCanvasScale()
    if WorldMapFrame and WorldMapFrame.GetCanvasScale then
        local s = WorldMapFrame:GetCanvasScale()
        if s and s > 0 then
            return s
        end
    end
    return 1
end

local function GetMapScaleFactor(mapID)
    if C_Map and C_Map.GetMapInfo then
        local info = C_Map.GetMapInfo(mapID)
        if info and info.mapType then
            if info.mapType <= 1 then
                return 0.78
            elseif info.mapType == 2 then
                return 0.88
            end
        end
    end
    return 1.0
end

local function AcquireLine()
    lineUsed = lineUsed + 1
    local line = linePool[lineUsed]
    if not line then
        line = overlayFrame:CreateLine(nil, "OVERLAY")
        linePool[lineUsed] = line
    end
    line:Show()
    return line
end

local function AcquireLabel()
    labelUsed = labelUsed + 1
    local pill = labelPool[labelUsed]
    if not pill then
        pill = CreateFrame("Frame", nil, overlayFrame)
        pill:SetFrameLevel((overlayFrame:GetFrameLevel() or 1) + 5)

        local bg = pill:CreateTexture(nil, "BACKGROUND")
        bg:SetAllPoints()
        bg:SetColorTexture(0.04, 0.06, 0.10, 0.86)
        pill.bg = bg

        local accent = pill:CreateTexture(nil, "ARTWORK")
        accent:SetWidth(2)
        accent:SetPoint("TOPLEFT", pill, "TOPLEFT", 0, 0)
        accent:SetPoint("BOTTOMLEFT", pill, "BOTTOMLEFT", 0, 0)
        pill.accent = accent

        local fs = pill:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
        fs:SetPoint("LEFT", pill, "LEFT", 5, 0)
        fs:SetShadowOffset(1, -1)
        fs:SetShadowColor(0, 0, 0, 1)
        pill.text = fs

        labelPool[labelUsed] = pill
    end
    pill:Show()
    return pill
end

local function ShowPinTooltip(self)
    if not self.node then
        return
    end
    local node = self.node
    local color = GetNodeStyleColor(node)
    local factionLabel = (COLORS[node.faction] and COLORS[node.faction].label) or "中立"
    local kindLabel = KIND_LABELS[node.kind] or "交通站点"

    GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
    GameTooltip:ClearLines()
    GameTooltip:AddLine(string.format("|cff%s%s|r", color.hex, node.name), 1, 1, 1)
    GameTooltip:AddLine(string.format("%s · %s · %s (%.1f, %.1f)", node.zoneName, factionLabel, kindLabel, node.x * 100, node.y * 100), 0.78, 0.82, 0.88)

    if self.connections and #self.connections > 0 then
        GameTooltip:AddLine(" ")
        GameTooltip:AddLine("可用航线：", 1, 0.82, 0)
        for _, conn in ipairs(self.connections) do
            local arrow = conn.oneway and (conn.outgoing and "[单向出发]" or "[单向到达]") or "[往返]"
            local timeText = conn.ride and string.format(" · 航程约 %d 秒", conn.ride) or ""
            GameTooltip:AddLine(string.format("  %s |cffffffff%s|r (%s)%s", arrow, conn.peer.shortName, conn.peer.zoneName, timeText), 0.85, 0.92, 1)
            if conn.note then
                GameTooltip:AddLine("    " .. conn.note, 0.65, 0.70, 0.78, true)
            end
        end
    end

    GameTooltip:Show()
end

local function AcquirePin()
    pinUsed = pinUsed + 1
    local pin = pinPool[pinUsed]
    if not pin then
        pin = CreateFrame("Button", nil, overlayFrame)
        pin:EnableMouse(true)

        local border = pin:CreateTexture(nil, "BACKGROUND")
        border:SetAllPoints()
        border:SetTexture("Interface\\\\CHARACTERFRAME\\\\TempPortraitAlphaMask")
        border:SetVertexColor(0.05, 0.06, 0.09, 0.95)
        pin.border = border

        local fill = pin:CreateTexture(nil, "ARTWORK")
        fill:SetPoint("TOPLEFT", 2, -2)
        fill:SetPoint("BOTTOMRIGHT", -2, 2)
        fill:SetTexture("Interface\\\\CHARACTERFRAME\\\\TempPortraitAlphaMask")
        pin.fill = fill

        local core = pin:CreateTexture(nil, "OVERLAY")
        core:SetPoint("CENTER")
        core:SetTexture("Interface\\\\CHARACTERFRAME\\\\TempPortraitAlphaMask")
        core:SetVertexColor(1, 1, 1, 0.9)
        pin.core = core

        pin:SetScript("OnEnter", ShowPinTooltip)
        pin:SetScript("OnLeave", function() GameTooltip:Hide() end)
        pinPool[pinUsed] = pin
    end
    pin:Show()
    return pin
end

local function DrawSegment(x1, y1, x2, y2, thickness, r, g, b, a)
    local casing = AcquireLine()
    casing:SetThickness(thickness + 2.4)
    casing:SetColorTexture(0.04, 0.05, 0.08, 0.72)
    casing:SetStartPoint("TOPLEFT", overlayFrame, x1, y1)
    casing:SetEndPoint("TOPLEFT", overlayFrame, x2, y2)

    local line = AcquireLine()
    line:SetThickness(thickness)
    line:SetColorTexture(r, g, b, a)
    line:SetStartPoint("TOPLEFT", overlayFrame, x1, y1)
    line:SetEndPoint("TOPLEFT", overlayFrame, x2, y2)
end

local function DrawDashedRoute(x1, y1, x2, y2, thickness, color, oneway, invScale)
    local dx = x2 - x1
    local dy = y2 - y1
    local dist = math.sqrt(dx * dx + dy * dy)
    if dist < 4 then
        return
    end

    local dashLen = 11 * invScale
    local gapLen = 7 * invScale
    local step = dashLen + gapLen
    local ux = dx / dist
    local uy = dy / dist

    local pos = 0
    while pos < dist do
        local segEnd = math.min(pos + dashLen, dist)
        DrawSegment(
            x1 + ux * pos,
            y1 + uy * pos,
            x1 + ux * segEnd,
            y1 + uy * segEnd,
            thickness,
            color.r,
            color.g,
            color.b,
            0.92
        )
        pos = pos + step
    end

    if oneway and dist > 26 * invScale then
        -- 在航线 55% 处绘制单向箭头，标明航行方向
        local tipX = x1 + dx * 0.55
        local tipY = y1 + dy * 0.55
        local arrowLen = 9 * invScale
        local angle = math.atan2(dy, dx)
        local wing1 = angle + math.rad(148)
        local wing2 = angle - math.rad(148)
        DrawSegment(tipX, tipY, tipX + math.cos(wing1) * arrowLen, tipY + math.sin(wing1) * arrowLen, thickness, color.r, color.g, color.b, 0.98)
        DrawSegment(tipX, tipY, tipX + math.cos(wing2) * arrowLen, tipY + math.sin(wing2) * arrowLen, thickness, color.r, color.g, color.b, 0.98)
    end
end

local function HideUnused()
    for i = lineUsed + 1, #linePool do
        linePool[i]:Hide()
    end
    for i = pinUsed + 1, #pinPool do
        pinPool[i]:Hide()
    end
    for i = labelUsed + 1, #labelPool do
        labelPool[i]:Hide()
    end
end

local function EnsureOverlay()
    if overlayFrame then
        return overlayFrame
    end
    if not (WorldMapFrame and WorldMapFrame.GetCanvas) then
        return nil
    end
    local canvas = WorldMapFrame:GetCanvas()
    if not canvas then
        return nil
    end
    overlayFrame = CreateFrame("Frame", "ForeverTransitMapOverlay", canvas)
    overlayFrame:SetAllPoints(canvas)
    overlayFrame:SetFrameLevel((canvas:GetFrameLevel() or 1) + 35)
    return overlayFrame
end

local function UpdateControlButtonText()
    if not controlButton then
        return
    end
    if not db or not db.enabled then
        controlButton:SetText("航线: 关")
        return
    end
    if db.filterMode == "all" then
        controlButton:SetText("航线: 全部")
    else
        local pf = GetPlayerFaction()
        local tag = (pf == "Alliance" and "联盟") or (pf == "Horde" and "部落") or "自动"
        controlButton:SetText("航线: " .. tag)
    end
end

local function EnsureControlButton()
    if controlButton or not WorldMapFrame then
        return
    end
    local parent = WorldMapFrame.BorderFrame or WorldMapFrame
    controlButton = CreateFrame("Button", "ForeverTransitToggleButton", parent, "UIPanelButtonTemplate")
    controlButton:SetSize(88, 22)
    controlButton:SetPoint("TOPRIGHT", parent, "TOPRIGHT", -56, -4)
    controlButton:SetFrameLevel((parent:GetFrameLevel() or 1) + 10)
    controlButton:RegisterForClicks("LeftButtonUp", "RightButtonUp")

    controlButton:SetScript("OnClick", function(_, button)
        if button == "RightButton" then
            db.showLabels = not db.showLabels
            ForeverTransit_Redraw()
            return
        end
        if not db.enabled then
            db.enabled = true
            db.filterMode = "auto"
        elseif db.filterMode == "auto" then
            db.filterMode = "all"
        else
            db.enabled = false
        end
        UpdateControlButtonText()
        ForeverTransit_Redraw()
    end)

    controlButton:SetScript("OnEnter", function(self)
        GameTooltip:SetOwner(self, "ANCHOR_BOTTOMLEFT")
        GameTooltip:ClearLines()
        GameTooltip:AddLine("ForeverTransit 无限航线图", 0, 0.8, 1)
        GameTooltip:AddLine("左键点击：切换 [本阵营自动] / [全部阵营] / [关闭]", 0.9, 0.9, 0.9)
        GameTooltip:AddLine("右键点击：显示/隐藏地图站点文字", 0.9, 0.9, 0.9)
        GameTooltip:AddLine(" ")
        GameTooltip:AddLine("图例：", 1, 0.82, 0)
        GameTooltip:AddLine("  |cff3da3ff[联盟]|r 船只    |cffff4d3d[部落]|r 飞艇/船只", 1, 1, 1)
        GameTooltip:AddLine("  |cff38db8f[中立]|r 船只    |cffad8fff[地铁]|r 矿道地铁", 1, 1, 1)
        GameTooltip:Show()
    end)
    controlButton:SetScript("OnLeave", function() GameTooltip:Hide() end)

    UpdateControlButtonText()
end

function ForeverTransit_Redraw()
    lineUsed = 0
    pinUsed = 0
    labelUsed = 0

    local overlay = EnsureOverlay()
    if not overlay then
        return
    end
    if not (WorldMapFrame and WorldMapFrame:IsShown() and db and db.enabled) then
        HideUnused()
        return
    end

    local mapID = WorldMapFrame.GetMapID and WorldMapFrame:GetMapID()
    if not mapID then
        HideUnused()
        return
    end

    local width = overlay:GetWidth()
    local height = overlay:GetHeight()
    if not width or width <= 0 or not height or height <= 0 then
        HideUnused()
        return
    end

    local invScale = 1 / GetCanvasScale()
    local mapFactor = GetMapScaleFactor(mapID)
    local thickness = math.max(1.8, 2.6 * mapFactor * invScale)
    local pinSize = math.max(9, 13 * mapFactor * invScale)

    -- 收集当前可见站点及其关联航线
    local visibleNodes = {}
    local function ensureVisibleNode(node)
        local entry = visibleNodes[node.id]
        if entry then
            return entry
        end
        local px, py = ProjectPoint(node, mapID)
        if not px then
            return nil
        end
        entry = {
            node = node,
            x = px * width,
            y = -py * height,
            connections = {},
            outboundLabels = {},
        }
        visibleNodes[node.id] = entry
        return entry
    end

    for _, route in ipairs(ForeverTransit_Routes) do
        if ShouldShowRoute(route) then
            local fromNode = ForeverTransit_Nodes[route.from]
            local toNode = ForeverTransit_Nodes[route.to]
            if fromNode and toNode then
                local fromEntry = ensureVisibleNode(fromNode)
                local toEntry = ensureVisibleNode(toNode)
                local color = GetRouteStyleColor(route)

                if fromEntry then
                    table.insert(fromEntry.connections, {
                        peer = toNode,
                        oneway = route.oneway,
                        outgoing = true,
                        ride = route.ride,
                        note = route.note,
                    })
                    if not toEntry then
                        table.insert(fromEntry.outboundLabels, "往" .. toNode.shortName)
                    end
                end

                if toEntry then
                    table.insert(toEntry.connections, {
                        peer = fromNode,
                        oneway = route.oneway,
                        outgoing = false,
                        ride = route.ride,
                        note = route.note,
                    })
                    if not fromEntry then
                        local prefix = route.oneway and "自" or "往"
                        table.insert(toEntry.outboundLabels, prefix .. fromNode.shortName)
                    end
                end

                if fromEntry and toEntry then
                    DrawDashedRoute(fromEntry.x, fromEntry.y, toEntry.x, toEntry.y, thickness, color, route.oneway, invScale)
                end
            end
        end
    end

    -- 按屏幕坐标排序，确保多码头标签按固定顺序防重叠排布
    local sortedNodes = {}
    for _, entry in pairs(visibleNodes) do
        table.insert(sortedNodes, entry)
    end
    table.sort(sortedNodes, function(a, b)
        if math.abs(a.y - b.y) > 1 then
            return a.y > b.y
        end
        return a.x < b.x
    end)

    local placedBoxes = {}
    local function overlapsAny(left, top, w, h)
        local right = left + w
        local bottom = top - h
        if left < 4 or right > width - 4 or top > -4 or bottom < -height + 4 then
            return true
        end
        local pad = 2 * invScale
        for _, box in ipairs(placedBoxes) do
            if not (right + pad <= box.left or left - pad >= box.right or bottom - pad >= box.top or top + pad <= box.bottom) then
                return true
            end
        end
        return false
    end

    -- 绘制站点标记与防重叠文字标签
    for _, entry in ipairs(sortedNodes) do
        local pin = AcquirePin()
        pin:SetFrameLevel((overlay:GetFrameLevel() or 1) + 10)
        pin:SetSize(pinSize, pinSize)
        pin:ClearAllPoints()
        pin:SetPoint("CENTER", overlay, "TOPLEFT", entry.x, entry.y)
        pin.node = entry.node
        pin.connections = entry.connections

        local color = GetNodeStyleColor(entry.node)
        pin.fill:SetVertexColor(color.r, color.g, color.b, 1)
        local coreSize = math.max(3, pinSize * 0.34)
        pin.core:SetSize(coreSize, coreSize)

        if db.showLabels then
            local labelText
            if #entry.outboundLabels > 0 then
                labelText = table.concat(entry.outboundLabels, "/")
            elseif mapFactor >= 0.95 then
                labelText = entry.node.shortName
            end
            if labelText then
                local pill = AcquireLabel()
                pill.text:SetText(labelText)
                pill.text:SetTextColor(0.96, 0.98, 1.0, 1.0)
                pill.accent:SetColorTexture(color.r, color.g, color.b, 1)

                local rawW = math.max(24, (pill.text:GetStringWidth() or 20) + 10)
                local rawH = math.max(14, (pill.text:GetStringHeight() or 10) + 5)
                pill:SetSize(rawW, rawH)
                pill:SetScale(invScale)

                local w = rawW * invScale
                local h = rawH * invScale
                local gap = pinSize * 0.55 + 3 * invScale
                local candidates = {
                    { entry.x + gap, entry.y + h * 0.5 },
                    { entry.x + gap, entry.y + h * 1.65 },
                    { entry.x + gap, entry.y - h * 0.65 },
                    { entry.x - gap - w, entry.y + h * 0.5 },
                    { entry.x - gap - w, entry.y + h * 1.65 },
                    { entry.x - gap - w, entry.y - h * 0.65 },
                    { entry.x + gap, entry.y + h * 2.8 },
                    { entry.x + gap, entry.y - h * 1.8 },
                }

                local bestX, bestY = candidates[1][1], candidates[1][2]
                for _, pos in ipairs(candidates) do
                    if not overlapsAny(pos[1], pos[2], w, h) then
                        bestX, bestY = pos[1], pos[2]
                        break
                    end
                end

                pill:ClearAllPoints()
                pill:SetPoint("TOPLEFT", overlay, "TOPLEFT", bestX / invScale, bestY / invScale)
                table.insert(placedBoxes, {
                    left = bestX,
                    right = bestX + w,
                    top = bestY,
                    bottom = bestY - h,
                })
            end
        end
    end

    HideUnused()
end

local function SetupHooks()
    if hooked or not WorldMapFrame then
        return
    end
    hooked = true
    EnsureControlButton()

    if WorldMapFrame.HookScript then
        WorldMapFrame:HookScript("OnShow", function()
            UpdateControlButtonText()
            ForeverTransit_Redraw()
        end)
    end
    for _, method in ipairs({ "OnMapChanged", "OnCanvasScaleChanged" }) do
        if WorldMapFrame[method] then
            hooksecurefunc(WorldMapFrame, method, ForeverTransit_Redraw)
        end
    end
end

SLASH_FOREVERTRANSIT1 = "/ft"
SLASH_FOREVERTRANSIT2 = "/transit"
SlashCmdList["FOREVERTRANSIT"] = function(msg)
    local cmd = (msg or ""):lower():match("^%s*(.-)%s*$")
    if cmd == "auto" then
        db.enabled = true
        db.filterMode = "auto"
        print("|cff00ccff[ForeverTransit]|r 已切换为：按当前阵营自动过滤")
    elseif cmd == "all" then
        db.enabled = true
        db.filterMode = "all"
        print("|cff00ccff[ForeverTransit]|r 已切换为：显示全部阵营航线")
    elseif cmd == "labels" then
        db.showLabels = not db.showLabels
        print("|cff00ccff[ForeverTransit]|r 地图站点文字已" .. (db.showLabels and "开启" or "关闭"))
    elseif cmd == "tram" then
        db.showTram = not db.showTram
        print("|cff00ccff[ForeverTransit]|r 矿道地铁显示已" .. (db.showTram and "开启" or "关闭"))
    elseif cmd == "off" then
        db.enabled = false
        print("|cff00ccff[ForeverTransit]|r 航线显示已关闭")
    elseif cmd == "on" then
        db.enabled = true
        print("|cff00ccff[ForeverTransit]|r 航线显示已开启")
    elseif cmd == "status" or cmd == "help" then
        local pf = GetPlayerFaction() or "未知"
        print("|cff00ccff[ForeverTransit]|r 状态: " .. (db.enabled and "开启" or "关闭") .. " | 过滤: " .. db.filterMode .. " | 当前阵营: " .. pf)
        print("  命令: /ft [auto|all|on|off|labels|tram|status]")
    else
        db.enabled = not db.enabled
        print("|cff00ccff[ForeverTransit]|r 航线显示已" .. (db.enabled and "开启" or "关闭"))
    end
    UpdateControlButtonText()
    ForeverTransit_Redraw()
end

local eventFrame = CreateFrame("Frame")
eventFrame:RegisterEvent("ADDON_LOADED")
eventFrame:RegisterEvent("PLAYER_ENTERING_WORLD")
eventFrame:SetScript("OnEvent", function(_, event, arg1)
    if event == "ADDON_LOADED" and arg1 == ADDON_NAME then
        InitDB()
        SetupHooks()
    elseif event == "PLAYER_ENTERING_WORLD" then
        SetupHooks()
        UpdateControlButtonText()
        ForeverTransit_Redraw()
    end
end)
`;

export async function buildForeverTransitAddon(outputDir) {
  const zip = new JSZip();
  zip.file('ForeverTransit/ForeverTransit.toc', TOC_CONTENT);
  zip.file('ForeverTransit/Data.lua', DATA_LUA);
  zip.file('ForeverTransit/ForeverTransit.lua', CORE_LUA);

  const outPath = path.join(outputDir, 'forever-transit.zip');
  const buf = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
  fs.writeFileSync(outPath, buf);
  console.log(`[✓] forever-transit.zip generated (${(buf.length / 1024).toFixed(1)} KB, ${VERSION})`);
  return { zip, version: VERSION, source: 'builtin://forever-transit' };
}
