/**
 * Mapzeroth (Forever) 100% 深度精校简体中文本地化补丁
 */

export const MAPZEROTH_ZHCN_STRINGS = {
  // 节点类型后缀与模板
  NODE_KIND_DOCK: "%s码头",
  NODE_KIND_ZEPPELIN: "%s飞艇塔楼",
  NODE_KIND_TRAM: "%s矿道地铁入口",
  NODE_KIND_PORTAL: "%s传送门",
  NODE_KIND_TELEPORT: "%s传送点",
  NODE_KIND_BORDER: "%s / %s交界处",
  NODE_KIND_INN: "%s旅店",
  NODE_KIND_BANK: "%s银行",
  NODE_KIND_AUCTION: "%s拍卖行",
  NODE_KIND_BATTLEMASTER: "%s战场军官",
  NODE_KIND_STABLE: "%s兽栏管理员",
  NODE_KIND_ENTRANCE: "%s入口",
  NODE_KIND_LEYLINE: "%s魔力线",
  NODE_KIND_CONVERGENCE: "%s元素汇聚点",
  NODE_KIND_FLIGHTMASTER: "%s飞行管理员",
  NODE_KIND_SETTLEMENT: "%s",
  NODE_KIND_TRAINER: "%s%s训练师",
  TRAINER_WEAPON: "武器大师",
  TRAINER_RIDING: "骑术",
  TRAINER_PET: "猎人宠物",
  TRAINER_DEMON: "术士恶魔",

  // 路线导航指引
  STEP_WALK: "步行前往【%s】",
  STEP_TAXI: "乘坐飞行管理员飞往【%s】",
  STEP_TAXI_VIA: "飞往【%s】（途经%s）",
  STEP_SHIP: "乘坐轮船前往【%s】",
  STEP_ZEPPELIN: "乘坐飞艇前往【%s】",
  STEP_TRAM: "乘坐矿道地铁前往【%s】",
  STEP_PORTAL: "点击传送门【%s】",
  STEP_TELEPORT: "传送至【%s】",
  STEP_HEARTHSTONE: "使用炉石返回【%s】",
  STEP_OTHER: "前往【%s】",
  STEP_PHASESWITCH: "与希多尔米对话：切换至过去的【%s】",
  STEP_CAST: "施放【%s】",
  STEP_EQUIP_ITEM: "装备【%s】",
  STEP_PORTAL_TO: "通过传送门前往【%s】",
  STEP_USE_ITEM: "使用物品【%s】",
  STEP_CAST_TO: "施放【%s】，前往【%s】",
  STEP_USE_ITEM_TO: "使用【%s】，前往【%s】",

  // 时间格式
  TIME_SECONDS: "%d秒",
  TIME_MINUTES: "%d分%02d秒",
  TIME_HOURS: "%d小时%02d分",
  TIME_ABOUT: "约%s",

  // 飞行点提示
  HINT_UNFOUND: "你尚未探索/解锁飞行点【%s】。解锁后，此路线可节省%s。",
  HINT_UNKNOWN: "请打开任意飞行管理员的窗口，以便Mapzeroth同步你已解锁的飞行网络。当前飞行预计可节省%s。",
  HINT_ASSUMED: "此路线计划飞往【%s】。Mapzeroth目前无法确认你是否已点亮该飞行点，请与飞行管理员对话同步。",
  HINT_ONLY_FLIGHT_UNFOUND: "前往目的地的唯一快捷方式是飞往你尚未解锁的【%s】。",
  HINT_ONLY_FLIGHT_UNKNOWN: "前往目的地的唯一途径是飞行，请先与任意飞行管理员对话以读取已解锁航线。",

  // 搜索面板
  SEARCH_HINT: "去哪里？(输入城镇/NPC/副本)",
  SEARCH_EMPTY: "输入城镇、主城、飞行管理员、旅店、训练师、地下城或任意地点名称。",
  NO_RESULTS: "未找到匹配的目的地。",
  ROUTE_BACK: "返回",
  ROUTE_ONE_WAY: "单程",
  ROUTE_ROUND_TRIP: "往返",
  ROUTE_START: "出发导航",
  PANEL_POPOUT: "弹出窗口",
  PANEL_DOCK: "靠边停靠",
  ROUTE_TOTAL: "预计总耗时：%s",
  ROUTE_ROUND_TOTAL: "去程 %s，回程 %s（总计 %s）",
  ROUTE_BACK_HEADING: "随后返回出发地",
  ROUTE_TOUR_TOTAL: "%d 个途经点：共 %s",
  ROUTE_STOP_HEADING: "%d. %s",
  ROUTE_TOUR_DROPPED: "无法连通路径：%s",
  ROUTE_PLANNING: "正在计算最优交通换乘路线...",
  ROUTE_STOP_UNNAMED: "途经站点 %d",
  PLACE_START: "当前出发地",
  PLACE_CAMP: "你的野外营地",
  PLACE_CAMP_IN: "你在【%s】的营地",
  ROUTE_ALREADY: "你已经身处目的地！",
  ROUTE_NONE: "未找到可行路径（请确认当前区域是否有道路或交通连通）。",
  NOWHERE: "Mapzeroth 暂时无法获取你的世界坐标（不支持副本内定位）。",

  // 选项与设置
  OPT_TAX: "过图载入时间缓冲",
  OPT_TAX_DESC: "Mapzeroth 计算总时间时，为每次跨地图载入画面（传送门、炉石、地铁等）预估的加载秒数。",
  OPT_MAX_COOLDOWN: "最大冷却时间过滤",
  OPT_MAX_COOLDOWN_DESC: "冷却时间长于此设定值的技能和玩具/物品将不会被纳入路线规划。",
  OPT_SCALE: "界面缩放",
  OPT_SCALE_DESC: "地图侧边栏面板与导航旅程悬浮窗的缩放比例。",
  OPT_THEME: "界面视觉主题",
  OPT_THEME_DESC: "控制面板与导航窗口的皮肤风格外观。",
  OPT_SECONDS: "%d秒",
  OPT_HOURS: "%d小时",
  OPT_HOURS_PLUS: "%d+小时",
  OPT_PERCENT: "%d%%",

  // 步进导航 HUD
  NAV_STEP_OF: "第 %d 步 / 共 %d 步",
  NAV_STOP: "结束导航",
  NAV_CLOSE: "关闭",
  NAV_ARRIVED: "🎉 已顺利到达目的地！",
  NAV_LEFT: "剩余预计耗时：%s",
  NAV_DISTANCE: "%d码",
  NAV_ITEM_READY_IN: "%d秒后冷却完毕",

  // 地图路线显示
  OPT_ON: "开",
  OPT_OFF: "关",
  OPT_ROUTE_MAP: "在世界地图上绘制路线",
  OPT_ROUTE_MAP_DESC: "在全屏世界地图上绘制交通线路：点线代表步行、虚线代表公服飞行、实线代表轮船/飞艇，并标注换乘序号。",
  OPT_ROUTE_MINIMAP: "在小地图上绘制导航线",
  OPT_ROUTE_MINIMAP_DESC: "在小地图雷达中实时显示当前段行进线路引导。",
  OPT_MINIMAP_UNAVAILABLE: "当前游戏客户端的小地图接口暂不支持直接绘制路线图层。",
  OPT_HIDE_MINIMAP: "隐藏小地图快捷图标",
  OPT_HIDE_MINIMAP_DESC: "从小地图边框隐藏 Mapzeroth 按钮（仍可随时输入 /mapzeroth 或 /mz 打开）。",
  OPT_PICKS_TITLE: "推荐快捷目的地",
  OPT_PICKS_DESC: "在搜索面板顶部直接展示常用的快捷地点与最近的训练师。",
  OPT_ASSUME_FLIGHTS: "默认假设所有飞行点均已开通",
  OPT_ASSUME_FLIGHTS_DESC: "开启时将视同已掌握全部飞行航线进行规划；关闭时仅使用角色实际对话解锁过的飞行点。",
  OPT_STEP_MARKERS: "路线步骤标记样式",
  OPT_STEP_MARKERS_DESC: "路线面板每一步左侧显示的标记风格：交通方式图标或彩色色块。",
  OPT_MARKERS_ICON: "图标",
  OPT_MARKERS_CHIP: "彩色条",
  ROUTE_MORE_ABOVE: "上方还有 %d 个换乘步骤",
  ROUTE_MORE_BELOW: "下方还有 %d 个换乘步骤",
  SECTION_DUNGEONS: "地下城",
  SECTION_EXPANSION: "资料片 %d",
  SECTION_OLDER: "经典旧世内容",
  SECTION_RAIDS: "团队副本",
  SUB_MIN_LEVEL: "%d 级以上",
  SUB_LEVEL_RANGE: "%d-%d 级",
  KIND_dungeon: "地下城",
  KIND_raid: "团队副本",
  NODE_PORTAL_ZONE: "%s传送门",

  // 分组与类型
  GROUP_place: "主城与城镇",
  KIND_city: "主城",
  KIND_town: "城镇",
  GROUP_flight: "飞行管理员",
  GROUP_transport: "公共交通 (船/飞艇/地铁)",
  GROUP_instance: "地下城与团队副本",
  GROUP_inn: "旅店与炉石绑定点",
  GROUP_bank: "银行",
  GROUP_auction: "拍卖行",
  GROUP_battlemaster: "战场军官",
  GROUP_stable: "兽栏管理员",
  GROUP_trainer: "职业与技能训练师",
  GROUP_entrance: "区域与主城入口",
  GROUP_leyline: "魔力线",
  GROUP_convergence: "元素汇聚点",
  GROUP_other: "其它地点",

  // 命令行与小地图提示
  CMD_HELP: "Mapzeroth 指令：输入 /mapzeroth 或 /mz 显示/隐藏窗口，输入 /mapzeroth settings 打开设置。",
  MINIMAP_TIP_TOGGLE: "左键点击：打开/关闭导航窗口",
  MINIMAP_TIP_SETTINGS: "右键点击：打开插件设置",
  MINIMAP_TIP_DRAG: "拖动：移动小地图图标位置",
  CMD_NO_SETTINGS: "Mapzeroth：当前场景下无法调出游戏内置设置窗口。",

  // 无限服天裔 (Skyborne) 共享特性
  OPT_SHARE: "共享魔网线与汇聚点发现",
  OPT_SHARE_DESC: "（仅限天裔角色）将通过种族特质探测到的魔网线与元素汇聚点坐标广播给同位面安装了对应插件的玩家，并接收他们的共享位置。",
  OPT_SHARE_SLLCM_TITLE: "共享魔网线发现（已由 SLLCM 托管）",
  OPT_DETECT: "在小地图上自动检测节点",
  OPT_DETECT_DESC: "仅在开启共享时生效：无需鼠标指向即可自动识别雷达中的魔网线并共享。",
  OPT_DETECT_SLLCM_TITLE: "在小地图上检测节点（已由 SLLCM 托管）",
  TIP_TOUR_TOMTOM: "按耗时最短的最佳换乘顺序依次拜访所有的 TomTom 路径点。",
  TIP_TOUR_PASTE: "粘贴 /way 坐标列表，Mapzeroth 会自动规划最优游历路线。",

  // -------------------------------------------------------------------------
  // 无限服专属站点、码头与交通节点中文名称 (覆盖 enUS)
  // -------------------------------------------------------------------------
  // 卡利姆多
  NODE_DOCK_AUBERDINE_MENETHIL: "奥伯丁码头 (开往米奈希尔港)",
  NODE_DOCK_AUBERDINE_RUTTHERAN: "奥伯丁码头 (开往鲁瑟兰村)",
  NODE_DOCK_AUBERDINE_STORMWIND: "奥伯丁码头 (开往暴风城)",
  NODE_DOCK_FEATHERMOON: "羽月要塞码头",
  NODE_DOCK_FORGOTTENCOAST: "被遗忘的海岸码头",
  NODE_DOCK_RATCHET: "棘齿城码头",
  NODE_DOCK_RUTTHERAN: "鲁瑟兰村码头",
  NODE_DOCK_SKYWATCHER: "天穹守望者高地飞艇码头",
  NODE_DOCK_STEAMWHEEDLE: "热砂港码头",
  NODE_DOCK_THERAMORE: "塞拉摩岛码头",
  NODE_MANKRIKS_WIFE: "曼科里克的妻子 (遗骸)",
  NODE_PORTAL_DARNASSUS_RUTTHERAN: "传送门：通往鲁瑟兰村",
  NODE_PORTAL_RUTTHERAN_DARNASSUS: "传送门：通往达纳苏斯",
  NODE_TELEPORT_MOONGLADE: "月光林地传送着陆点",
  NODE_ZEPPELIN_ORGRIMMAR_GROMGOL: "奥格瑞玛飞艇塔楼 (开往格罗姆高)",
  NODE_ZEPPELIN_ORGRIMMAR_TIRISFAL: "奥格瑞玛飞艇塔楼 (开往幽暗城)",

  // 东部王国
  NODE_DOCK_BOOTYBAY: "藏宝海湾码头",
  NODE_DOCK_DALARAN: "达拉然飞艇码头",
  NODE_DOCK_MENETHIL: "米奈希尔港 (开往南海镇)",
  NODE_DOCK_MENETHIL_THERAMORE: "米奈希尔港 (开往塞拉摩)",
  NODE_DOCK_POWDERFUSE: "引信港码头",
  NODE_DOCK_SOUTHSHORE: "南海镇码头",
  NODE_DOCK_STORMWIND: "暴风城港口码头",
  NODE_ENTRANCE_SW_WIZARDS_SANCTUM_OUTER: "法师圣所外部门口",
  NODE_ENTRANCE_SW_WIZARDS_SANCTUM_INNER: "法师圣所",
  NODE_PORTAL_DALARAN_STORMWIND: "天裔传送门：达纳苏斯/暴风城",
  NODE_PORTAL_STORMWIND_DALARAN: "天裔传送门：前往达拉然",
  NODE_TAXI_POWDERFUSE: "引信港，河间林地",
  NODE_TRAM_IRONFORGE: "矿道地铁入口 (铁炉堡开拓者大厅)",
  NODE_UNDERCITY_ELEVATOR_TOP_1: "幽暗城升降梯 (上层入口1)",
  NODE_UNDERCITY_ELEVATOR_TOP_2: "幽暗城升降梯 (上层入口2)",
  NODE_UNDERCITY_ELEVATOR_TOP_3: "幽暗城升降梯 (上层入口3)",
  NODE_UNDERCITY_ELEVATOR_BOTTOM_1: "幽暗城升降梯 (下层出口1)",
  NODE_UNDERCITY_ELEVATOR_BOTTOM_2: "幽暗城升降梯 (下层出口2)",
  NODE_UNDERCITY_ELEVATOR_BOTTOM_3: "幽暗城升降梯 (下层出口3)",
  NODE_TRAM_STORMWIND: "矿道地铁入口 (暴风城矮人区)",
  NODE_ZEPPELIN_GROMGOL_ORGRIMMAR: "格罗姆高飞艇塔楼 (开往奥格瑞玛)",
  NODE_ZEPPELIN_GROMGOL_TIRISFAL: "格罗姆高飞艇塔楼 (开往幽暗城)",
  NODE_ZEPPELIN_TIRISFAL_ORGRIMMAR: "提瑞斯法飞艇塔楼 (开往奥格瑞玛)",
  NODE_ZEPPELIN_TIRISFAL_GROMGOL: "提瑞斯法飞艇塔楼 (开往格罗姆高)",

  // 塞弗拉斯岛 (Zephras Isle)
  NODE_DOCK_ZEPHRAS_ALLIANCE: "塞弗拉斯岛飞艇码头 (开往达拉然)",

  // 城镇与村落名称
  TOWN_BLOODHOOF_VILLAGE: "血蹄村",
  TOWN_BRILL: "布瑞尔",
  CITY_DARNASSUS: "达纳苏斯",
  TOWN_DOLANAAR: "多兰纳尔",
  TOWN_KHARANOS: "卡拉诺斯",
  TOWN_LAKESHIRE: "湖畔镇",
  TOWN_LIGHTS_HOPE_CHAPEL: "圣光之愿礼拜堂",
  TOWN_RAZOR_HILL: "剃刀岭",

  // 副本与地下城入口
  NODE_INSTANCE_CITY_OF_DALARAN: "达拉然城",
  NODE_INSTANCE_EXCAVATION_SITE_WETLANDS: "湿地挖掘场",
  NODE_INSTANCE_RUINS_OF_LORDAERON: "洛丹伦废墟",
  NODE_INSTANCE_THE_HALL_OF_THANES: "领主之厅",
};

/**
 * 为 Mapzeroth 生成 100% 汉化版的 Locales/zhCN.lua 内容
 */
export function generateMapzerothZhCN() {
  const lines = [
    'local addonName, addon = ...',
    '',
    '-- Simplified Chinese (zhCN) - 100% 精校中文汉化',
    'addon:RegisterLocale("zhCN", {',
  ];

  for (const [key, val] of Object.entries(MAPZEROTH_ZHCN_STRINGS)) {
    const escaped = val.replace(/"/g, '\\"');
    lines.push(`    ${key.padEnd(25)} = "${escaped}",`);
  }

  lines.push('})');
  lines.push('');
  return lines.join('\n');
}

/**
 * 汉化与转换 Mapzeroth.toc 规范
 */
export function patchMapzerothToc(originalToc) {
  let toc = originalToc;

  // 统一 Interface 为 16001 (Forever 无限服原生接口版本)
  toc = toc.replace(/## Interface: .*/, '## Interface: 16001');

  // 替换 Title 与注入 Title-zhCN
  if (toc.includes('## Title-zhCN:')) {
    toc = toc.replace(/## Title-zhCN:.*/, '## Title-zhCN: |cff00ff00[地图]|r Mapzeroth (艾泽拉斯智能导航 GPS)');
  } else {
    toc = toc.replace(
      /## Title: .*/,
      '## Title: Mapzeroth\n## Title-zhCN: |cff00ff00[地图]|r Mapzeroth (艾泽拉斯智能导航 GPS)'
    );
  }

  // 替换 Notes 与注入 Notes-zhCN
  if (toc.includes('## Notes-zhCN:')) {
    toc = toc.replace(
      /## Notes-zhCN:.*/,
      '## Notes-zhCN: 专为无限服 (WoW Forever) 打造的艾泽拉斯公交换乘与智能 GPS 导航神器！综合规划轮船、飞艇、矿道地铁、飞行管理员与炉石的最快路线，提供步进式指引。'
    );
  } else {
    toc = toc.replace(
      /## Notes: .*/,
      '## Notes: Plans the quickest way anywhere in WoW Forever: flights, boats, portals, hearthstones and your own spells.\n## Notes-zhCN: 专为无限服 (WoW Forever) 打造的艾泽拉斯公交换乘与智能 GPS 导航神器！综合规划轮船、飞艇、矿道地铁、飞行管理员与炉石的最快路线，提供步进式指引。'
    );
  }

  // 替换 Version
  // 保留上游真实版本号，仅追加汉化版标识（不再手工写死版本号）
  toc = toc.replace(/## Version: *([^\r\n]*)/, (_, v) => {
    const upstream = v.replace(/\s*\(.*?\)\s*$/, '').trim();
    return `## Version: ${upstream && !upstream.includes('@') ? upstream : 'v1.0.0'} (Forever 全汉化版)`;
  });

  // 修复图标路径（打包后文件夹统一为 Mapzeroth）
  toc = toc
    .replace('Mapzeroth-Rebuild\\Media\\Logo', 'Mapzeroth\\Media\\Logo')
    .replace('Mapzeroth-Dev\\Media\\Logo', 'Mapzeroth\\Media\\Logo');

  // 确保 SavedVariables 正确
  if (!toc.includes('## SavedVariables:')) {
    toc = toc.replace(
      /## Version: .*/,
      '$&\n## SavedVariables: MapzerothRebuildDB'
    );
  }

  // 剔除 Modern 专属数据文件，精简体积
  const lines = toc.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('Data\\Modern\\')) return false;
    if (trimmed.startsWith('Data/Modern/')) return false;
    return true;
  });

  return lines.join('\n');
}

/**
 * 针对 Mapzeroth 解压 ZIP 包注入深度中文汉化与结构适配
 */
export async function patchMapzeroth(zip) {
  // 1. 处理 TOC 文件（上游 main 分支先后使用过 Mapzeroth.toc / Mapzeroth-Rebuild.toc / Mapzeroth-Dev.toc）
  const tocCandidates = ['Mapzeroth/Mapzeroth.toc', 'Mapzeroth/Mapzeroth-Rebuild.toc', 'Mapzeroth/Mapzeroth-Dev.toc'];
  const tocPath = tocCandidates.find((p) => zip.file(p));
  if (tocPath) {
    const tocText = await zip.file(tocPath).async('string');
    const patchedToc = patchMapzerothToc(tocText);
    zip.file('Mapzeroth/Mapzeroth.toc', patchedToc);
    // WoW 只加载与文件夹同名的 TOC，移除其它变体避免混淆
    for (const p of tocCandidates) {
      if (p !== 'Mapzeroth/Mapzeroth.toc' && zip.file(p)) {
        zip.remove(p);
      }
    }
  } else {
    console.warn('[Warn] Mapzeroth upstream TOC not found, the bundled addon may fail to load.');
  }

  // 2. 注入精校的 Locales/zhCN.lua
  const zhCNContent = generateMapzerothZhCN();
  zip.file('Mapzeroth/Locales/zhCN.lua', zhCNContent);

  // 3. 同时提供 zhTW 兼容映射（繁体客户端也能显示中文）
  zip.file('Mapzeroth/Locales/zhTW.lua', zhCNContent.replace('addon:RegisterLocale("zhCN"', 'addon:RegisterLocale("zhTW"'));

  // 4. 清理开发冗余目录（如果有）
  for (const filename of Object.keys(zip.files)) {
    if (
      filename.startsWith('Mapzeroth/Data/Modern/') ||
      filename.startsWith('Mapzeroth/Data\\Modern\\') ||
      filename.startsWith('Mapzeroth/tools/') ||
      filename.startsWith('Mapzeroth/tests/')
    ) {
      zip.remove(filename);
    }
  }
}
