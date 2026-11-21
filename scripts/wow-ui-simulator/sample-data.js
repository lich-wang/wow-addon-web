export const SAMPLE_WOWF_DATA_LUA = `
WoWF_Data = {
  meta = {
    version = "2026.11.21-sim",
    updatedAt = "2026-11-21",
    deployId = "simulator-builtin",
  },
  dungeons = {
    {
      id = "ragefire-chasm",
      name = "怒焰裂谷",
      zone = "奥格瑞玛",
      entranceZone = "奥格瑞玛",
      entranceX = 52.8,
      entranceY = 49.0,
      minLevel = 13,
      maxLevel = 18,
      visit = 15,
      isNew = false,
      summary = "位于奥格瑞玛暗影裂口深处的初级地下城，适合部落玩家 13-18 级刷本升级。",
      bosses = { "奥格弗拉什", "饥饿者塔拉加曼", "祈求者耶戈什", "巴扎兰" },
      quests = {
        { id = 5722, name = "寻找背包", level = 15, minLevel = 12, faction = "horde", npc = "拉尔·火刃", zone = "雷霆崖", x = 70.4, y = 29.6 },
        { id = 5723, name = "试探敌人", level = 15, minLevel = 12, faction = "horde", npc = "拉尔·火刃", zone = "雷霆崖", x = 70.4, y = 29.6 },
        { id = 5728, name = "隐藏的敌人", level = 16, minLevel = 12, faction = "horde", npc = "萨尔", zone = "奥格瑞玛", x = 31.8, y = 37.8 },
        { id = 5761, name = "毁灭之力", level = 16, minLevel = 13, faction = "horde", npc = "尼尔鲁·火刃", zone = "奥格瑞玛", x = 49.5, y = 50.6 },
      },
    },
    {
      id = "deadmines",
      name = "死亡矿井",
      zone = "西部荒野",
      entranceZone = "西部荒野",
      entranceX = 42.5,
      entranceY = 71.7,
      minLevel = 17,
      maxLevel = 24,
      visit = 19,
      isNew = false,
      summary = "艾德温·范克里夫与迪菲亚兄弟会的秘密造船厂，联盟前期必打副本。",
      bosses = { "拉克佐", "斯尼德的伐木机", "基尔尼格", "重拳先生", "曲奇", "艾德温·范克里夫" },
      quests = {
        { id = 166, name = "迪菲亚兄弟会", level = 22, minLevel = 14, faction = "alliance", npc = "格里安·斯托曼", zone = "西部荒野", x = 56.3, y = 47.5 },
        { id = 2040, name = "地下突袭", level = 20, minLevel = 15, faction = "alliance", npc = "沉默的舒尼", zone = "暴风城", x = 55.5, y = 12.6 },
        { id = 167, name = "我的兄弟...", level = 20, minLevel = 15, faction = "alliance", npc = "维尔德·蓟草", zone = "暴风城", x = 65.4, y = 21.2 },
        { id = 214, name = "红色丝质面罩", level = 19, minLevel = 14, faction = "alliance", npc = "卫兵队长玛尔斯", zone = "西部荒野", x = 56.3, y = 47.5 },
      },
    },
    {
      id = "shadowfang-keep",
      name = "影牙城堡",
      zone = "银松森林",
      entranceZone = "银松森林",
      entranceX = 44.8,
      entranceY = 67.8,
      minLevel = 22,
      maxLevel = 30,
      visit = 24,
      isNew = false,
      summary = "阿鲁高盘踞的狼人城堡，掉落大量优质蓝装与法系/敏捷武器。",
      bosses = { "屠夫拉佐克劳", "席瓦莱恩男爵", "指挥官斯普林瓦尔", "盲眼守卫奥杜", "吞噬者芬鲁斯", "狼王南杜斯", "大法师阿鲁高" },
      quests = {
        { id = 1013, name = "巫妖的法典", level = 25, minLevel = 18, faction = "horde", npc = "药剂师伦弗雷", zone = "幽暗城", x = 48.8, y = 69.2 },
        { id = 1014, name = "阿鲁高的愚行", level = 27, minLevel = 20, faction = "horde", npc = "达拉尔·道恩维沃尔", zone = "银松森林", x = 44.2, y = 39.8 },
        { id = 1740, name = "索兰鲁克宝珠", level = 25, minLevel = 20, faction = "both", classes = { "WARLOCK" }, npc = "多兰·克雷格", zone = "贫瘠之地", x = 49.2, y = 57.1 },
      },
    },
    {
      id = "scarlet-monastery",
      name = "血色修道院",
      zone = "提瑞斯法林地",
      entranceZone = "提瑞斯法林地",
      entranceX = 84.9,
      entranceY = 32.9,
      minLevel = 28,
      maxLevel = 42,
      visit = 34,
      isNew = false,
      summary = "分为墓地、图书馆、军械库、大教堂四区，升级效率极高的黄金副本。",
      bosses = { "审讯员韦沙斯", "驯犬者洛克希", "奥法师杜安", "赫洛德", "大检察官怀特迈恩" },
      quests = {
        { id = 1053, name = "以圣光之名", level = 40, minLevel = 33, faction = "alliance", npc = "虔诚的莱雷恩", zone = "南海镇", x = 51.5, y = 58.2 },
        { id = 1048, name = "深入血色修道院", level = 42, minLevel = 33, faction = "horde", npc = "瓦里玛萨斯", zone = "幽暗城", x = 56.2, y = 92.2 },
        { id = 1951, name = "圣光之愿", level = 38, minLevel = 30, faction = "both", npc = "拉比恩·萨图纳", zone = "凄凉之地", x = 55.2, y = 56.2 },
      },
    },
    {
      id = "forever-infinity-spire",
      name = "无限尖塔（无限服新本）",
      zone = "暴风城 / 奥格瑞玛传送门",
      entranceZone = "暴风城",
      entranceX = 50.0,
      entranceY = 50.0,
      minLevel = 20,
      maxLevel = 80,
      visit = 25,
      isNew = true,
      summary = "《魔兽世界：无限服》专属动态难度地下城，掉落无限徽章与专属传家宝升级材料。",
      bosses = { "时空守卫者", "无限织法者", "终焉回响" },
      quests = {
        { id = 99001, name = "无限试炼：初探尖塔", level = 25, minLevel = 20, faction = "both", npc = "无限特使", zone = "暴风城", x = 50.2, y = 50.4 },
        { id = 99002, name = "时空碎片的秘密", level = 25, minLevel = 20, faction = "both", inside = true },
      },
    },
  },
  routes = {
    {
      key = "human",
      name = "人类 (艾尔文 -> 西部荒野 -> 暮色森林)",
      faction = "alliance",
      bands = {
        {
          from = 1, to = 12, zone = "艾尔文森林",
          hub = { name = "闪金镇", x = 42.1, y = 65.9 },
          quests = {
            { id = 62, name = "法戈第矿洞", level = 7, place = "闪金镇", npc = "治安官杜汉", x = 42.1, y = 65.9 },
          },
        },
        {
          from = 13, to = 22, zone = "西部荒野",
          hub = { name = "哨兵岭", x = 56.3, y = 47.5 },
          quests = {
            { id = 166, name = "迪菲亚兄弟会", level = 22, place = "哨兵岭", npc = "格里安·斯托曼", x = 56.3, y = 47.5 },
          },
          dungeonQuests = {
            { id = 166, name = "迪菲亚兄弟会", dungeon = "死亡矿井", place = "哨兵岭", npc = "格里安·斯托曼", x = 56.3, y = 47.5 },
          },
        },
        {
          from = 23, to = 32, zone = "暮色森林 / 湿地",
          hub = { name = "夜色镇", x = 73.6, y = 46.1 },
          quests = {
            { id = 173, name = "森林里的狼人", level = 24, place = "夜色镇", npc = "指挥官阿尔泰娅", x = 73.6, y = 45.9 },
          },
        },
      },
    },
    {
      key = "orc",
      name = "兽人 / 巨魔 (杜隆塔尔 -> 贫瘠之地)",
      faction = "horde",
      bands = {
        { from = 1, to = 12, zone = "杜隆塔尔", hub = { name = "剃刀岭", x = 52.0, y = 43.5 }, quests = {} },
        { from = 13, to = 28, zone = "贫瘠之地", hub = { name = "十字路口", x = 51.9, y = 30.3 }, quests = {} },
      },
    },
  },
  classes = {
    MAGE = {
      name = "法师",
      specs = {
        {
          key = "frost",
          name = "冰霜专精",
          role = "远程输出 / AOE 练级",
          recommendedProfs = "裁缝 + 附魔 / 采矿 + 工程学",
          rotation = "寒冰箭 -> 冰霜新星 -> 冰枪术 / 暴风雪群体减速",
          dungeonTips = {
            { min = 15, max = 30, text = "副本中善用变羊术控场，注意法力值与喝水节奏。" },
          },
          musts = {
            { level = 20, text = "20级学习暴风雪后可开启双目标/小波次 AOE 刷怪。" },
          },
        },
      },
    },
  },
  macros = {
    { name = "智能寒冰箭", category = "法师", body = "#showtooltip 寒冰箭\\n/cast [harm,nodead] 寒冰箭", desc = "选中敌对存活目标施放寒冰箭。" },
  },
  professions = {
    { name = "采矿 + 工程学", category = "PvE / PvP 推荐", summary = "工程学提供手雷、火箭靴与传送器，副本与野外均极强。" },
  },
}
`;
