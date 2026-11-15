import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const DEFAULT_DEPLOY_ID = 'deploy-fd0c249c-1794727615234';
const WOWF_VERSION = 'v1.0.0';

const CLASS_CONFIGS = [
  { key: 'WARRIOR', slug: 'warrior', name: '战士', color: 'c79c6e', allianceRace: 'human', hordeRace: 'orc' },
  { key: 'PALADIN', slug: 'paladin', name: '圣骑士', color: 'f58cba', allianceRace: 'human', hordeRace: null },
  { key: 'HUNTER', slug: 'hunter', name: '猎人', color: 'abd473', allianceRace: 'dwarf', hordeRace: 'orc' },
  { key: 'ROGUE', slug: 'rogue', name: '潜行者', color: 'fff569', allianceRace: 'human', hordeRace: 'undead' },
  { key: 'PRIEST', slug: 'priest', name: '牧师', color: 'ffffff', allianceRace: 'human', hordeRace: 'undead' },
  { key: 'SHAMAN', slug: 'shaman', name: '萨满祭司', color: '0070de', allianceRace: null, hordeRace: 'orc' },
  { key: 'MAGE', slug: 'mage', name: '法师', color: '69ccf0', allianceRace: 'human', hordeRace: 'undead' },
  { key: 'WARLOCK', slug: 'warlock', name: '术士', color: '9482c9', allianceRace: 'human', hordeRace: 'undead' },
  { key: 'DRUID', slug: 'druid', name: '德鲁伊', color: 'ff7d0a', allianceRace: 'nightelf', hordeRace: 'tauren' },
];

const RACE_ROUTES = [
  { id: 'human', apiRaces: ['human'], name: '人类', faction: 'alliance', sampleClass: 'warrior', wowRaceKeys: ['Human'] },
  { id: 'dwarf', apiRaces: ['dwarf'], name: '矮人', faction: 'alliance', sampleClass: 'warrior', wowRaceKeys: ['Dwarf'] },
  { id: 'night-elf', apiRaces: ['nightelf', 'night_elf', 'night-elf'], name: '暗夜精灵', faction: 'alliance', sampleClass: 'warrior', wowRaceKeys: ['NightElf'] },
  { id: 'gnome', apiRaces: ['gnome'], name: '侏儒', faction: 'alliance', sampleClass: 'warrior', wowRaceKeys: ['Gnome'] },
  { id: 'skyborne-alliance', apiRaces: ['skyborne', 'highelf', 'skyborne_alliance'], name: '天裔 (联盟)', faction: 'alliance', sampleClass: 'warrior', wowRaceKeys: ['Skyborne', 'HighElf'] },
  { id: 'orc', apiRaces: ['orc'], name: '兽人', faction: 'horde', sampleClass: 'warrior', wowRaceKeys: ['Orc'] },
  { id: 'undead', apiRaces: ['undead', 'scourge'], name: '亡灵', faction: 'horde', sampleClass: 'warrior', wowRaceKeys: ['Scourge', 'Undead'] },
  { id: 'tauren', apiRaces: ['tauren'], name: '牛头人', faction: 'horde', sampleClass: 'warrior', wowRaceKeys: ['Tauren'] },
  { id: 'troll', apiRaces: ['troll'], name: '巨魔', faction: 'horde', sampleClass: 'warrior', wowRaceKeys: ['Troll'] },
  { id: 'skyborne-horde', apiRaces: ['skyborne', 'windshaper', 'skyborne_horde'], name: '天裔 (部落)', faction: 'horde', sampleClass: 'warrior', wowRaceKeys: ['Skyborne', 'Windshaper'] },
];

const FOREVER_NEW_DUNGEON_IDS = new Set([
  'hall-of-thanes',
  'ruins-of-lordaeron',
  'excavation-site',
  'dalaran',
  'drowned-city',
  'kroldok-stronghold',
  'alcaz-prison',
  'blackmaw-hold',
  'shapers-terrace',
  'the-deep-caverns',
  'mount-hyjal',
]);

const PROF_NAMES_ZH = {
  alchemy: '炼金术',
  blacksmithing: '锻造',
  cooking: '烹饪',
  enchanting: '附魔',
  engineering: '工程学',
  'first-aid': '急救',
  fishing: '钓鱼',
  herbalism: '草药学',
  leatherworking: '制皮',
  mining: '采矿',
  skinning: '剥皮',
  tailoring: '裁缝',
};

const FALLBACK_MACROS = {
  WARRIOR: [
    {
      title: '冲锋 / 拦截一键宏',
      level: 4,
      isForeverNew: false,
      desc: '非战斗状态自动切战斗姿态冲锋，战斗中自动切狂暴姿态拦截，省键位必装。',
      code: '#showtooltip\n/cast [nocombat,stance:1] 冲锋; [nocombat] 战斗姿态; [combat,stance:3] 拦截; [combat] 狂暴姿态',
    },
    {
      title: '练级一键宏（乘胜追击 → 压制）',
      level: 20,
      isForeverNew: true,
      desc: '无限服专属：优先施放 20 级新技能【乘胜追击】回血打伤害，不可用时自动衔接【压制】并开启自动攻击。',
      code: '#showtooltip\n/startattack\n/cast 乘胜追击\n/cast 压制',
    },
    {
      title: '穿刺打击并保持攻击',
      level: 25,
      isForeverNew: true,
      desc: '无限服武器战新天赋【穿刺打击】专用宏，自动开启近战攻击并释放穿刺打击。',
      code: '#showtooltip 穿刺打击\n/startattack\n/cast 穿刺打击',
    },
    {
      title: '压制（自动切战斗姿态）',
      level: 12,
      isForeverNew: false,
      desc: '目标闪避或血之气息触发时，若不在战斗姿态则自动切换至战斗姿态并立即打出压制。',
      code: '#showtooltip 压制\n/cast [nostance:1] 战斗姿态\n/cast 压制',
    },
    {
      title: '狂暴姿态拳击打断宏',
      level: 38,
      isForeverNew: false,
      desc: '一键切换狂暴姿态并施放【拳击】打断施法，副本与精英怪救场必备。',
      code: '#showtooltip 拳击\n/cast [nostance:3] 狂暴姿态\n/cast 拳击',
    },
    {
      title: '防御姿态剑盾嘲讽保命宏',
      level: 10,
      isForeverNew: false,
      desc: '怪物OT打治疗时，一键切防御姿态并对鼠标指向或当前目标施放嘲讽。',
      code: '#showtooltip 嘲讽\n/cast [nostance:2] 防御姿态\n/cast [@mouseover,harm,nodead][] 嘲讽',
    },
  ],
  PALADIN: [
    {
      title: '十字军打击 + 自动攻击宏',
      level: 1,
      isForeverNew: true,
      desc: '无限服圣骑士核心输出宏，施放十字军打击同时确保开启自动攻击，不断平砍回蓝与圣印触发。',
      code: '#showtooltip 十字军打击\n/startattack\n/cast 十字军打击',
    },
    {
      title: '鼠标指向圣光闪现 / 圣光术',
      level: 1,
      isForeverNew: false,
      desc: '无需切换当前攻击目标即可对鼠标悬停的队友施放治疗，按住 Shift 施放圣光术。',
      code: '#showtooltip\n/cast [mod:shift,@mouseover,help,nodead][mod:shift] 圣光术; [@mouseover,help,nodead][] 圣光闪现',
    },
    {
      title: '鼠标指向清洁术 / 自由之手',
      level: 18,
      isForeverNew: false,
      desc: '快速驱散队友身上的中毒、疾病与魔法效果，按住 Shift 施放自由祝福。',
      code: '#showtooltip\n/cast [mod:shift,@mouseover,help,nodead][mod:shift] 自由祝福; [@mouseover,help,nodead][] 清洁术',
    },
    {
      title: '圣盾术一键自保 + 绷带宏',
      level: 6,
      isForeverNew: false,
      desc: '危急时刻开启无敌（圣盾术/圣佑术），再次按下可对自己使用圣光术急救。',
      code: '#showtooltip 圣盾术\n/stopcasting\n/cast 圣盾术',
    },
  ],
  HUNTER: [
    {
      title: '猎人印记 + 宠物攻击起手宏',
      level: 10,
      isForeverNew: false,
      desc: '练级神技：给目标挂上猎人印记的同时命令宠物冲锋上前建立仇恨，并自动开启自动射击。',
      code: '#showtooltip 猎人印记\n/cast 猎人印记\n/petattack\n/cast !自动射击',
    },
    {
      title: '远近战自适应切换宏（猛禽 + 猫鼬 / 奥术射击）',
      level: 4,
      isForeverNew: false,
      desc: '远程距离施放奥术射击并保持自动射击，怪贴身时自动打猛禽一击与摔绊风筝。',
      code: '#showtooltip\n/cast 奥术射击\n/cast 猛禽一击\n/cast 摔绊',
    },
    {
      title: '假死脱战 + 冰冻陷阱一键宏',
      level: 30,
      isForeverNew: false,
      desc: '停止攻击、命令宠物被动跟随，立刻假死脱战并铺下冰冻陷阱控制敌人。',
      code: '#showtooltip 冰冻陷阱\n/stopattack\n/petfollow\n/cast 假死\n/cast 冰冻陷阱',
    },
    {
      title: '宠物治疗 / 复活 / 召唤三合一宏',
      level: 12,
      isForeverNew: false,
      desc: '宠物存活时施放治疗宠物，宠物死亡时复活宠物，宠物不在身边时召唤宠物。',
      code: '#showtooltip\n/cast [@pet,dead] 复活宠物; [nopet] 召唤宠物; 治疗宠物',
    },
  ],
  ROGUE: [
    {
      title: '潜行闷棍 + 自动搜索钱包宏',
      level: 10,
      isForeverNew: false,
      desc: '潜行状态下自动选中面前最近的敌人施放闷棍并顺手搜索口袋，人形怪额外收益翻倍。',
      code: '#showtooltip 闷棍\n/cleartarget\n/targetenemy [noharm][dead]\n/cast 搜索\n/cast 闷棍',
    },
    {
      title: '起手偷袭 / 邪恶攻击整合宏',
      level: 1,
      isForeverNew: false,
      desc: '潜行时施放偷袭（或伏击）并顺手搜索口袋，非潜行时施放邪恶攻击并自动开启平砍。',
      code: '#showtooltip\n/cast [stealth] 搜索\n/cast [stealth] 偷袭; 邪恶攻击\n/startattack [nostealth]',
    },
    {
      title: '剑刃乱舞 + 闪避爆发宏',
      level: 30,
      isForeverNew: false,
      desc: '面对复数敌人或副本小怪群时，一键开启剑刃乱舞并保持近战自动攻击。',
      code: '#showtooltip 剑刃乱舞\n/startattack\n/cast 剑刃乱舞',
    },
    {
      title: '脚踢打断停止施法宏',
      level: 12,
      isForeverNew: false,
      desc: '对当前目标或鼠标指向目标立即施放脚踢打断危险读条。',
      code: '#showtooltip 脚踢\n/cast [@mouseover,harm,nodead][] 脚踢',
    },
  ],
  PRIEST: [
    {
      title: '防打断魔杖射击开关宏',
      level: 5,
      isForeverNew: false,
      desc: '牧师练级第一神宏！避免连按导致取消魔杖射击，触发精神分流回蓝。',
      code: '#showtooltip 射击\n/cast !射击',
    },
    {
      title: '鼠标指向真言术：盾 / 恢复',
      level: 6,
      isForeverNew: false,
      desc: '对鼠标指向友方或自己瞬发套盾，按住 Shift 施放恢复，野外与副本保护队友必备。',
      code: '#showtooltip\n/cast [mod:shift,@mouseover,help,nodead][mod:shift,@player] 恢复; [@mouseover,help,nodead][@player] 真言术：盾',
    },
    {
      title: '鼠标指向快速治疗 / 强效治疗术',
      level: 20,
      isForeverNew: false,
      desc: '无需切目标对鼠标悬停框体施放快速治疗，按住 Shift 施放强效治疗术。',
      code: '#showtooltip\n/cast [mod:shift,@mouseover,help,nodead][mod:shift] 强效治疗术; [@mouseover,help,nodead][] 快速治疗',
    },
    {
      title: '暗言术：痛（自动切回暗影形态）',
      level: 40,
      isForeverNew: false,
      desc: '暗牧练级与输出专用，对鼠标指向或当前目标挂痛。',
      code: '#showtooltip 暗言术：痛\n/cast [@mouseover,harm,nodead][] 暗言术：痛',
    },
  ],
  SHAMAN: [
    {
      title: '风暴打击 + 自动攻击宏',
      level: 40,
      isForeverNew: false,
      desc: '增强萨核心宏：施放风暴打击的同时强制开启自动攻击，最大化风怒武器触发。',
      code: '#showtooltip 风暴打击\n/startattack\n/cast 风暴打击',
    },
    {
      title: '地震术 1 级打断宏',
      level: 4,
      isForeverNew: false,
      desc: '停止当前读条并对鼠标指向或当前目标施放 1 级地震术省蓝瞬发打断施法。',
      code: '#showtooltip 地震术\n/stopcasting\n/cast [@mouseover,harm,nodead][] 地震术(等级 1)',
    },
    {
      title: '鼠标指向治疗波 / 次级治疗波 / 治疗链',
      level: 1,
      isForeverNew: false,
      desc: '默认对鼠标指向施放次级治疗波，按住 Shift 施放治疗链，按住 Alt 施放治疗波。',
      code: '#showtooltip\n/cast [mod:shift,@mouseover,help,nodead][mod:shift] 治疗链; [mod:alt,@mouseover,help,nodead][mod:alt] 治疗波; [@mouseover,help,nodead][] 次级治疗波',
    },
    {
      title: '无限服图腾快速召回 / 重插辅助宏',
      level: 10,
      isForeverNew: true,
      desc: '无限服专精改动适配：快速施放大地之力图腾，按住 Shift 施放石爪图腾吸引仇恨。',
      code: '#showtooltip\n/cast [mod:shift] 石爪图腾; 大地之力图腾',
    },
  ],
  MAGE: [
    {
      title: '寒冰屏障（冰箱）秒进秒出宏',
      level: 30,
      isForeverNew: false,
      desc: '第一下立即打断读条进入冰箱解控保命，再按一下立即取消冰箱继续移动输出。',
      code: '#showtooltip 寒冰屏障\n/stopcasting\n/cancelaura 寒冰屏障\n/cast 寒冰屏障',
    },
    {
      title: '焦点 / 鼠标指向变形术（变羊）宏',
      level: 8,
      isForeverNew: false,
      desc: '优先对鼠标悬停目标施放变形术而不丢失当前集火目标，副本控场必备。',
      code: '#showtooltip 变形术\n/cast [@mouseover,harm,nodead][] 变形术',
    },
    {
      title: '法术反制（立即打断当前读条）',
      level: 24,
      isForeverNew: false,
      desc: '立即停止自身读条并对鼠标指向或当前目标施放法术反制，零延迟断条。',
      code: '#showtooltip 法术反制\n/stopcasting\n/cast [@mouseover,harm,nodead][] 法术反制',
    },
    {
      title: '防打断暴风雪 AOE 宏',
      level: 20,
      isForeverNew: false,
      desc: '带感叹号的暴风雪宏，连续点击时不会取消地面施法光圈，A 怪更稳。',
      code: '#showtooltip 暴风雪\n/cast !暴风雪',
    },
  ],
  WARLOCK: [
    {
      title: '痛苦诅咒 + 宠物攻击起手宏',
      level: 8,
      isForeverNew: false,
      desc: '给怪挂上痛苦诅咒的同时命令虚空行者/恶魔卫士上前拉怪，练级最顺手起手式。',
      code: '#showtooltip 痛苦诅咒\n/petattack\n/cast 痛苦诅咒',
    },
    {
      title: '防打断吸取生命 / 吸取灵魂宏',
      level: 14,
      isForeverNew: false,
      desc: '通道技能保护宏（nochanneling）：引导未结束前重复按键不会浪费法力打断引导；按 Shift 施放 1 级吸取灵魂拿碎片。',
      code: '#showtooltip\n/cast [mod:shift,nochanneling] 吸取灵魂(等级 1); [nochanneling] 吸取生命',
    },
    {
      title: '防打断魔杖射击宏',
      level: 5,
      isForeverNew: false,
      desc: '挂完 DOT 后切换魔杖平射，避免连按取消射击。',
      code: '#showtooltip 射击\n/cast !射击',
    },
    {
      title: '鼠标指向恐惧术控场宏',
      level: 8,
      isForeverNew: false,
      desc: '对鼠标指向敌人或当前目标施放恐惧术，多目标作战时无需切换主目标。',
      code: '#showtooltip 恐惧术\n/cast [@mouseover,harm,nodead][] 恐惧术',
    },
  ],
  DRUID: [
    {
      title: '全形态自适应变形脱困宏（猎豹 / 巨熊 / 旅行）',
      level: 20,
      isForeverNew: false,
      desc: '一键解减速定身！室内或战斗中切换猎豹形态，按住 Shift 切巨熊形态，水下自动切水生形态。',
      code: '#showtooltip\n/cancelform [noform:3]\n/cast [swimming] 水生形态; [mod:shift] 巨熊形态; 猎豹形态',
    },
    {
      title: '猫德潜行突袭 / 爪击起手宏',
      level: 20,
      isForeverNew: false,
      desc: '猎豹潜行状态下施放毁灭/突袭，非潜行状态下施放爪击并自动开启近战攻击。',
      code: '#showtooltip\n/cast [stealth] 突袭; 爪击\n/startattack [nostealth]',
    },
    {
      title: '熊德重殴 + 挥击泄怒拉怪宏',
      level: 14,
      isForeverNew: false,
      desc: '无限服熊坦拉怪核心宏：同时绑定重殴与挥击并开启自动攻击，群拉仇恨稳固。',
      code: '#showtooltip 挥击\n/startattack\n/cast 重殴\n/cast 挥击',
    },
    {
      title: '任意形态一键起身自愈宏（回春 + 治疗之触）',
      level: 4,
      isForeverNew: false,
      desc: '在熊/猫形态下点击自动取消变形并对自己或鼠标指向友方施放回春术，按 Shift 施放治疗之触。',
      code: '#showtooltip\n/cancelform\n/cast [mod:shift,@mouseover,help,nodead][mod:shift,@player] 治疗之触; [@mouseover,help,nodead][@player] 回春术',
    },
  ],
};

const FOREVER_NEW_DUNGEONS_META = [
  {
    id: 'hall-of-thanes',
    name: '领主大厅',
    level: [13, 16],
    visit: 14,
    zone: '铁炉堡地下 (旧铁炉堡)',
    isNew: true,
    bosses: ['索格伦·火须', '高阶祭司玛尔达', '杜根·挽锤'],
    summary: '无限服全新 13-16 级五人副本！位于铁炉堡王座厅下方旧铁炉堡底层，掉落前期极品双手锤【铁炉堡巨锤】及全系蓝装。',
  },
  {
    id: 'ruins-of-lordaeron',
    name: '洛丹伦废墟',
    level: [17, 20],
    visit: 18,
    zone: '提瑞斯法林地 (幽暗城上层西侧)',
    isNew: true,
    bosses: ['腐化守卫队长', '亡语者塞琳娜', '阿加曼德余孽领主'],
    summary: '无限服全新 17-20 级五人副本！位于洛丹伦王城废墟地下，衔接银松森林与希尔斯布莱德过渡阶段。',
  },
  {
    id: 'excavation-site',
    name: '挖掘场：湿地',
    level: [28, 31],
    visit: 29,
    zone: '湿地 (瑟根石 47.8, 56.3)',
    isNew: true,
    bosses: ['挖掘场监工', '深岩恐魔', '远古泰坦守卫'],
    summary: '无限服全新 28-31 级五人副本！赤脊山湖畔镇与米奈希尔港均可接取高额经验任务，填补 30 级前后副本空白。',
  },
  {
    id: 'dalaran',
    name: '达拉然城',
    level: [30, 33],
    visit: 31,
    zone: '奥特兰克山脉 (达拉然护罩)',
    isNew: true,
    bosses: ['奥术构造体', '紫罗兰叛徒', '大法师安东尼达斯残影'],
    summary: '无限服全新 30-33 级五人副本！深入奥特兰克山脉的达拉然紫罗兰城塞，法系与物理均有强力过渡蓝装。',
  },
  {
    id: 'drowned-city',
    name: '沉没之城',
    level: [35, 40],
    visit: 37,
    zone: '荆棘谷海岸',
    isNew: true,
    bosses: ['盐水先知船长', '深海巨怪', '娜迦海巫督军'],
    summary: '无限服全新 35-40 级五人副本！在藏宝海湾【克拉兹克 (26.9, 77.2)】处接取【可疑的盐水先知】等核心任务。',
  },
  {
    id: 'kroldok-stronghold',
    name: '克罗多克要塞',
    level: [40, 45],
    visit: 42,
    zone: '河林 (Riverglades)',
    isNew: true,
    bosses: ['食人魔督军', '暮光塑风者', '独眼巨人穆格'],
    summary: '无限服全新 40-45 级五人副本！位于新区域【河林】，拥有多达 7 个副本任务，是 40 级买完坐骑后的冲级圣地。',
  },
  {
    id: 'alcaz-prison',
    name: '奥卡兹监狱',
    level: [48, 53],
    visit: 50,
    zone: '尘泥沼泽 (奥卡兹岛)',
    isNew: true,
    bosses: ['纳迦典狱官', '迪菲亚重刑犯', '维维尔博士机械守卫'],
    summary: '无限服全新 48-53 级五人副本！暴风城军情七处【马迪亚斯·肖尔】与塞拉摩岛起始长线任务直通奥卡兹岛地牢。',
  },
  {
    id: 'blackmaw-hold',
    name: '黑喉要塞',
    level: [55, 60],
    visit: 57,
    zone: '艾萨拉 (木喉熊怪领地)',
    isNew: true,
    bosses: ['黑喉萨满长老', '腐化古树', '黑喉大酋长'],
    summary: '无限服全新 55-60 级满级前五人副本！位于艾萨拉，产出优质满级前团本预备装备与木喉声望。',
  },
  {
    id: 'shapers-terrace',
    name: '塑造者之台',
    level: [58, 60],
    visit: 59,
    zone: '安戈洛环形山北侧泰坦遗迹',
    isNew: true,
    bosses: ['远古塑形者', '泰坦矩阵卫士', '造物主阿扎达斯印记'],
    summary: '无限服全新 58-60 级顶级五人副本！泰坦主题秘境，掉落媲美黑上/通灵/斯坦索姆的毕业级蓝紫装备。',
  },
  {
    id: 'the-deep-caverns',
    name: '深穴 (10人团本)',
    level: [60, 60],
    visit: 60,
    zone: '黑石山 / 灼热峡谷深层',
    isNew: true,
    bosses: ['深岩领主', '熔火蛛后', '深穴主宰'],
    summary: '无限服专属 60 级 10 人入门团队副本！适合刚满级的小团体快速获取紫装过渡。',
  },
  {
    id: 'mount-hyjal',
    name: '海加尔峰 (20人团本)',
    level: [60, 60],
    visit: 60,
    zone: '海加尔山 (冬泉谷南侧)',
    isNew: true,
    bosses: ['腐化古树卫士', '梦魇巨龙先锋', '世界之树守护者'],
    summary: '无限服专属 60 级 20 人团队副本！探索开放后的海加尔山永恒之井圣地。',
  },
];

const FOREVER_SYSTEMS_DATA = [
  {
    id: 'sleeping-bag',
    category: '露营与睡袋',
    minLevel: 14,
    title: '🏕️ 舒适的睡袋（+8% 经验值常驻 Buff）与学生口粮四步任务链',
    summary: '无限服 14 级必做第一神器！跑完 4 步不仅送大量【学生口粮】（使用立刻恢复双倍休息经验池），最终奖励【舒适的睡袋】（睡满 3 分钟获得 +8% 经验值加成，持续 2 小时，死亡不消失）！',
    steps: [
      {
        step: 1,
        zone: '西部荒野',
        coord: { x: 37.6, y: 50.7 },
        title: '第一步：西部荒野焦痕残骸 (37.6, 50.7) / 或贫瘠之地 (49.1, 56.3)',
        detail: '联盟推荐从西部荒野 (37.6, 50.7) 农场旁烧毁的帐篷残骸接取；部落推荐从贫瘠之地 (49.1, 56.3) 接取，随后将两处残骸全部互动交接。',
      },
      {
        step: 2,
        zone: '贫瘠之地',
        coord: { x: 49.1, y: 56.3 },
        title: '第二步：前往南贫瘠之地烧毁的马车 (49.1, 56.3)',
        detail: '在十字路口往南沿大路走到陶祖拉营地北侧的焦黑树旁，点击箱子完成交互，获得第一批【学生口粮】。',
      },
      {
        step: 3,
        zone: '石爪山脉',
        coord: { x: 39.7, y: 50.0 },
        title: '第三步：石爪山脉营地小径与被遗弃的背包 (39.7, 50.0 → 50.8, 52.7)',
        detail: '从贫瘠之地进入石爪山脉，在 (39.7, 50.0) 接取下一步，随后前往 (50.8, 52.7) 乱风崖附近的巨石堆上点击背包。',
      },
      {
        step: 4,
        zone: '洛克莫丹',
        coord: { x: 49.5, y: 35.6 },
        title: '第四步：洛克莫丹巨石水坝雕像 (49.5, 35.6)',
        detail: '前往洛克莫丹北侧的巨石水坝中央雕像处交任务，正式入手【舒适的睡袋】与共计 8 份【学生口粮】！',
      },
    ],
  },
  {
    id: 'camping-tents',
    category: '露营与睡袋',
    minLevel: 1,
    title: '⛺ 制皮营地帐篷与副本掉落四大营地器械蓝图',
    summary: '无限服新增露营玩法：制皮专业 20 点即可在制皮训练师处学习制作【营地帐篷】；在野外架设帐篷可让附近所有玩家快速积攒双倍经验（休息状态）并大幅加速脱战回血回蓝！',
    steps: [
      {
        step: 1,
        zone: '全主城/制皮训练师',
        title: '营地帐篷 (制皮 20 点) & 营地折叠椅',
        detail: '消耗轻皮与粗线即可制作，不仅自己可用，站在其他玩家撑开的帐篷伞下同样享受快速恢复与双倍经验累积。',
      },
      {
        step: 2,
        zone: '五人地下城首领掉落',
        title: '四大地下城营地升级蓝图（磁石 / 岩石园 / 磨刀石架 / 便携铁砧）',
        detail: '无限服五人副本尾王有机率掉落营地蓝图：【营地磁石】（法系暴击/回蓝增益）、【营地岩石园】（全属性与精神增益）、【营地磨刀石】（近战与远程攻强增益）、【营地铁砧】（野外随时修理与锻造）。',
      },
    ],
  },
  {
    id: 'legacy-system',
    category: '经典旧世树',
    minLevel: 15,
    title: '🌳 经典旧世专长（Legacy 账号共享天赋树，最高 65 点）',
    summary: '账号下每个角色达到 15、25、40、55、60 级及完成探索挑战均可为全账号解锁【经典旧世点数】（单角色最多贡献 16 点，账号上限 65 点），所有小号 1 级即可享受全套加成！',
    steps: [
      {
        step: 1,
        zone: '经典旧世树 · 冒险分支',
        title: '🏃 冒险树（练级首选推荐优先点满）',
        detail: '提供野外道路移动速度提升、炉石冷却时间大幅缩短、灵魂医者虚弱时间减免、探索新地图经验奖励翻倍以及飞行路径速度提升。',
      },
      {
        step: 2,
        zone: '经典旧世树 · 专业分支',
        title: '⚒️ 专业树（双采与制造业神技）',
        detail: '解锁【同时开启矿物与草药双追踪】、采集与制造读条加速、采集额外暴击产出以及制造技能点数额外加成。',
      },
      {
        step: 3,
        zone: '经典旧世树 · 充裕分支',
        title: '💰 充裕树（声望、金币与背包减负）',
        detail: '提供阵营声望获取加成、任务金币与怪物掉落银币提升、邮寄瞬间到达以及里程碑专属战袍与传家宝级外观奖励。',
      },
    ],
  },
  {
    id: 'supply-crates',
    category: '物资与声望',
    minLevel: 10,
    title: '📦 遭劫的板条箱（艾泽拉斯贸易局 / 杜隆塔尔补给后勤部）',
    summary: '野外怪物与宝箱会掉落【遭劫的板条箱】，上交空箱或填满对应专业制造品上交可获得丰厚经验、银币与专属声望，解锁各职业强力制造图纸与扩容背包！',
    steps: [
      {
        step: 1,
        zone: '赤脊山 / 暴风城 / 铁炉堡 / 达纳苏斯',
        coord: { x: 26.5, y: 45.3 },
        title: '联盟：艾泽拉斯贸易局（主城拍卖行旁 & 赤脊山湖畔镇）',
        detail: '寻找后勤官员上交遭劫的板条箱。友善可购买 12 格补给包与各专业过渡绿色配方，尊敬可购买 16 格包与蓝色核心装备图纸。',
      },
      {
        step: 2,
        zone: '贫瘠之地 / 奥格瑞玛 / 幽暗城 / 雷霆崖',
        coord: { x: 51.5, y: 30.2 },
        title: '部落：杜隆塔尔补给后勤部（主城银行旁 & 贫瘠之地十字路口）',
        detail: '即使无法制造箱子要求的物品，直接上交未填满的原箱也能获得基础声望与经验，切勿丢弃！',
      },
    ],
  },
  {
    id: 'forever-zones-routes',
    category: '新种族与新区域',
    minLevel: 1,
    title: '⛵ 无限服新种族【天裔】、四大新地图与轮船飞艇新航线',
    summary: '无限服新增联盟【高阶会天裔】与部落【塑风者天裔】种族，开放泽风岛、河林、海加尔山、辛德拉等全新区域，并新增跨海轮船与飞艇航线。',
    steps: [
      {
        step: 1,
        zone: '泽风岛 (Zephras Isle)',
        title: 'Lv. 1–12：泽风岛（天裔新手区域）',
        detail: '拥有独立的 1-12 级任务线、全套职业与专业训练师，12 级后可通过海港轮船直达暴风城/米奈希尔港或奥格瑞玛/棘齿城。',
      },
      {
        step: 2,
        zone: '河林 (Riverglades)',
        coord: { x: 65.5, y: 81.5 },
        title: 'Lv. 30–45：河林（全新中后期练级大区 & 克罗多克要塞）',
        detail: '位于东部王国中部的全新广袤森林区域，包含刺毛丘陵、法霍德要塞等营地及 40-45 级新副本【克罗多克要塞】，彻底告别 35-45 级断档刷怪。',
      },
      {
        step: 3,
        zone: '海加尔山 & 辛德拉',
        title: 'Lv. 55–60：海加尔山与艾萨拉/冬泉谷高阶内容',
        detail: '开放海加尔山户外区域与 20 人团队副本【海加尔峰】，并在艾萨拉新增 55-60 级五人本【黑喉要塞】、安戈洛新增【塑造者之台】。',
      },
    ],
  },
];

const FALLBACK_NEWS = [
  {
    date: '2026-11-15',
    title: '根据玩家等级的地下城经验值调整（11月15日 UTC+8）',
    summary: '热修复放宽了队伍中有高等级玩家时地下城敌人经验值被清零的限制。现在只有当该玩家比敌人高出超过 12 级时经验值才会被清零。',
    href: 'https://wowf.io/zh/news/dungeon-xp-trivial-adjustment-nov-14',
  },
  {
    date: '2026-11-14',
    title: '魔兽世界：无限 热修复汇总（11月14日 UTC+8）',
    summary: '修复多处无限服新地下城（领主大厅、挖掘场、克罗多克要塞）任务物品掉落率与首领技能数值问题，优化营地帐篷休息经验结算。',
    href: 'https://wowf.io/zh/news',
  },
  {
    date: '2026-11-12',
    title: '暴雪回应“60级任务金币”：热修复为 48 级及以上的任务增加金币奖励',
    summary: '48 级及以上高等级区域任务与满级经验转化金币奖励大幅上调，缓解满级千金马与技能学习金币压力。',
    href: 'https://wowf.io/zh/news',
  },
  {
    date: '2026-11-11',
    title: '魔兽世界：无限 职业专精与天赋平衡性调整公告',
    summary: '强化圣骑士十字军打击、战士乘胜追击与穿刺打击、萨满图腾机制与德鲁伊野性战斗在练级与五人本中的表现。',
    href: 'https://wowf.io/zh/news',
  },
];

const PROFESSION_GUIDES_META = [
  {
    id: 'alchemy',
    name: '炼金术',
    type: 'crafting',
    pairs: ['草药学'],
    makes: ['治疗药水和法力药水', '属性药剂和合剂', '转化奥金与功能药水', '点金石'],
    brackets: '1-60 初级治疗药水 → 60-110 次级治疗药水 → 110-155 治疗药水 → 155-210 强效治疗药水 → 210-265 超强治疗药水 → 265-300 特效治疗药水/合剂',
    trainers: '初级/中级：各大主城炼金师 | 高级(125+)：铁炉堡苏雷·浆泡 / 幽暗城赫伯特·哈尔希医生 | 大师(200+)：羽月要塞凯尔希·杨斯 / 斯通纳德罗格瓦尔',
    foreverNote: '无限服练级药剂与抗性药水需求极高，275 级可转化奥金锭稳定赚取金币。',
  },
  {
    id: 'blacksmithing',
    name: '锻造',
    type: 'crafting',
    pairs: ['采矿'],
    makes: ['板甲和锁甲', '近战武器', '磨刀石和平衡石', '装备强化与盾刺'],
    brackets: '1-75 劣质磨刀石/铜质链甲 → 75-125 粗制磨刀石/青铜护腿 → 125-200 重磨刀石/绿铁护腕/金鳞护腕 → 200-250 秘银套/致密磨刀石 → 250-300 瑟银护甲与帝国板甲',
    trainers: '初级/中级：主城熔炉区 | 高级(125+)：铁炉堡本古斯·深炉 / 奥格瑞玛萨鲁·钢怒 | 大师(200+)：藏宝海湾布里克·基克拉夫',
    foreverNote: '无限服物资箱经常需要绿铁/秘银锻造件，磨刀石可显著提升物理职业野外效率。',
  },
  {
    id: 'enchanting',
    name: '附魔',
    type: 'crafting',
    pairs: ['裁缝'],
    makes: ['武器和护甲永久附魔', '初级/次级魔法杖', '分解绿装获取魔尘与精华'],
    brackets: '1-75 附魔护腕-初级生命/初级魔法杖 → 75-135 初级耐力/次级魔法杖 → 135-200 附魔护腕-耐力/力量 → 200-250 附魔披风-强效防御 → 250-300 十字军/强效属性',
    trainers: '初级/中级：主城附魔训练师 | 高级(125+)：艾尔文森林基塔·费温德 / 石爪山脉赫加斯 | 大师(200+)：奥达曼副本内安诺拉',
    foreverNote: '5 级做出的【初级魔法杖】（DPS 11.3）与 13 级【次级魔法杖】是牧师、法师、术士前期的最强神器！',
  },
  {
    id: 'engineering',
    name: '工程学',
    type: 'crafting',
    pairs: ['采矿'],
    makes: ['炸弹和手雷', '工程护目镜', '靶假人与起搏器', '无限服实用装置与坐骑'],
    brackets: '1-75 劣质火药/一把螺栓/弧光扳手 → 75-150 粗制炸药/青铜管/活动假人 → 150-200 铁皮手雷/发条式同步陀螺仪 → 200-260 实心炸药/秘银外壳 → 260-300 瑟银零件/奥术炸弹',
    trainers: '初级/中级：主城工程区 | 高级(125+)：铁炉堡斯普琳科 / 奥格瑞玛罗克希克 | 大师(200+)：加基森巴兹克·布拉斯温',
    foreverNote: '铁皮手雷提供珍贵的远程范围昏迷控制，高级假人在单刷精英任务和无限服新副本救场中极为强力。',
  },
  {
    id: 'leatherworking',
    name: '制皮',
    type: 'crafting',
    pairs: ['剥皮'],
    makes: ['皮甲和锁甲', '护甲片', '箭袋和弹药袋', '★无限服专属：营地帐篷'],
    brackets: '1-75 轻皮护甲片/雕花皮靴 → 75-150 中皮护甲片/黑皮战靴 → 150-205 重皮/野人护肩 → 205-250 厚皮/夜色头带 → 250-300 硬甲皮护腕/邪恶皮甲',
    trainers: '初级/中级：主城制皮师 | 高级(125+)：达纳苏斯塔尔丹 / 雷霆崖乌娜·小林 | 大师(200+)：鹰巢山彼得·加林 / 菲拉斯哈拉纳尔',
    foreverNote: '★无限服核心生活专业：制皮师可制作一次性【营地帐篷】，在野外篝火旁支起帐篷可让附近所有玩家极速恢复至 150% 双倍休息经验！',
  },
  {
    id: 'tailoring',
    name: '裁缝',
    type: 'crafting',
    pairs: ['附魔'],
    makes: ['布甲装备', '6至16格背包', '用于附魔分解的绿装', '月布与法术强度套装'],
    brackets: '1-75 亚麻布卷/强化亚麻斗篷 → 75-125 毛料卷/灰布护肩 → 125-205 丝绸卷/碧蓝丝质头巾/深红丝质外衣 → 205-250 魔纹布卷/黑色魔纹套 → 250-300 符文布卷/符文布包',
    trainers: '初级/中级：主城裁缝店 | 高级(125+)：暴风城乔吉奥·波利罗 / 幽暗城乔瑟夫·格里高利 | 大师(200+)：塔伦米尔达瑞尔·斯塔克 / 塞拉摩提莫斯·沃森特',
    foreverNote: '无需采集专业即可靠人形怪掉落布匹冲级，制作的背包与物资箱紧俏布甲在无限服拍卖行常年畅销。',
  },
  {
    id: 'herbalism',
    name: '草药学',
    type: 'gathering',
    pairs: ['炼金术'],
    makes: ['炼金术全阶段草药', '无限服物资箱所需草药', '拍卖行高价值合剂原料'],
    brackets: '1-70 宁神花/银叶草/地根草 → 70-150 魔皇草/石南草/跌打草 → 150-230 皇血草/枯叶草/金棘草 → 230-300 太阳草/阿尔萨斯之泪/梦叶草/黑莲花',
    trainers: '各大主城及新手镇草药学训练师均可直接传授至大师级 (1-300)',
    foreverNote: '搭配 GatherMate2 采集助手可在地图标记无限服新增区域（泽风岛、河林）的密集草药刷新点。',
  },
  {
    id: 'mining',
    name: '采矿',
    type: 'gathering',
    pairs: ['锻造', '工程学'],
    makes: ['铜/锡/铁/秘银/瑟银矿石与锭', '奥术水晶与宝石原石'],
    brackets: '1-65 铜矿 → 65-125 锡矿/银矿(熔炼青铜) → 125-175 铁矿/金矿 → 175-245 秘银矿/真银矿 → 245-300 瑟银矿/富瑟银矿',
    trainers: '各大主城及城镇采矿训练师均可直接传授至大师级 (1-300)',
    foreverNote: '前中期熔炼银锭、金锭即可跨过枯燥采集段；无限服新增副本【挖掘场：湿地】内含有丰富矿脉。',
  },
  {
    id: 'skinning',
    name: '剥皮',
    type: 'gathering',
    pairs: ['制皮'],
    makes: ['轻皮/中皮/重皮/厚皮/硬甲皮', '毛皮与龙鳞'],
    brackets: '1-75 新手区野兽(1-15级) → 75-150 贫瘠之地/洛克莫丹/赤脊山(15-30级) → 150-225 荆棘谷/河林/凄凉之地(30-45级) → 225-300 塔纳利斯/安戈洛环形山(45-60级)',
    trainers: '各大主城制皮店旁的剥皮训练师均可直接传授至大师级 (1-300)，记得购买【剥皮小刀】放在背包内。',
    foreverNote: '练级途中零成本顺手剥皮，直接卖店即可稳定攒齐 40 级小马金币，或供制皮制作无限服帐篷。',
  },
  {
    id: 'cooking',
    name: '烹饪',
    type: 'secondary',
    pairs: ['钓鱼'],
    makes: ['耐力与精神属性食物', '★无限服特色：提供经验值加成的料理', '营火料理'],
    brackets: '1-50 香料面包/烤野猪肉 → 50-130 烟熏熊肉/美味煎蛋卷 → 130-225 烤奇美拉肉片/烤狮肉/巨型煎蛋卷 → 225-300 嫩狼肉排/夜鳞鱼汤/沙漠肉丸子',
    trainers: '初级/中级：主城旅店与烹饪师 | 高级(125+)：灰谷/凄凉之地购买《中级烹饪教材》 | 大师(225+)：加基森迪尔格·超肉完成烹饪任务',
    foreverNote: '无限服新增提供经验值加成与额外主属性的特色食谱，配合钓鱼可完全零成本冲满 300。',
  },
  {
    id: 'first-aid',
    name: '急救',
    type: 'secondary',
    pairs: [],
    makes: ['亚麻/毛料/丝质/魔纹/符文布绷带', '抗毒药剂'],
    brackets: '1-80 亚麻绷带/厚亚麻绷带 → 80-150 绒线绷带/厚绒线绷带 → 150-210 丝质绷带/厚丝质绷带 → 210-260 魔纹绷带/厚魔纹绷带 → 260-300 符文布绷带/厚符文布绷带',
    trainers: '初级/中级：主城急救师 | 高级(150+)：激流堡丹eb·沃克 / 尘泥沼泽巴莱·洛克维购买《高级急救教材》 | 大师(225+)：塞拉摩古斯塔夫医生 / 落锤镇格里高利医生完成救死扶伤任务',
    foreverNote: '战士、潜行者、猎人、术士等全职业必满副业，战斗间隙 8 秒回满生命值大幅减少坐地板时间。',
  },
  {
    id: 'fishing',
    name: '钓鱼',
    type: 'secondary',
    pairs: ['烹饪'],
    makes: ['黑口鱼/火鳞鳝鱼/石鳞鳗（炼金原料）', '夜鳞鲷鱼/斑点黄尾鱼（高级烹饪）', '水中漂浮残骸宝箱'],
    brackets: '1-75 主城及新手村水域 → 75-150 贫瘠之地绿洲/洛克莫丹 → 150-225 荆棘谷/河林/凄凉之地 → 225-300 菲拉斯/塔纳利斯热砂港/艾萨拉',
    trainers: '初级/中级：主城钓鱼师 | 高级(125+)：藏宝海湾老人海明威购买《中级钓鱼教材：鲈鱼与你》 | 大师(225+)：尘泥沼泽纳特·帕格完成钓鱼大师任务',
    foreverNote: '无限服河林（Riverwood）与海岸线鱼群收益极高，钓出的箱子可开出高级布匹、药水与蓝绿装备。',
  },
];


/**
 * 将 wowf.io API 的富文本片段数组转换为魔兽世界原生颜色转义字符串
 * @param {Array<string | object> | string | undefined} segments
 * @returns {string}
 */
function formatRichSegments(segments) {
  if (!segments) return '';
  if (typeof segments === 'string') return segments.trim();
  if (!Array.isArray(segments)) return '';

  let out = '';
  for (const seg of segments) {
    if (typeof seg === 'string') {
      out += seg;
    } else if (seg && typeof seg === 'object') {
      const name = seg.name || (seg.tip && seg.tip.name) || '';
      if (!name) continue;
      if (seg.kind === 'spell') {
        out += `|cff71d5ff[${name}]|r`;
      } else if (seg.kind === 'talent') {
        out += `|cffffd100[${name}]|r`;
      } else if (seg.kind === 'item') {
        const q = seg.quality || 2;
        const qColor = q === 4 ? 'a335ee' : q === 3 ? '0070dd' : q === 2 ? '1eff00' : 'ffffff';
        out += `|cff${qColor}[${name}]|r`;
      } else if (seg.kind === 'dungeon') {
        out += `|cffff8000[${name}]|r`;
      } else if (seg.kind === 'prof') {
        out += `|cff00ff96[${name}]|r`;
      } else {
        out += `|cffffd100[${name}]|r`;
      }
    }
  }
  return out.replace(/\s+\n/g, '\n').trim();
}

/**
 * 提取技能列表名称串
 * @param {Array<object> | undefined} list
 * @returns {string}
 */
function formatSkillList(list) {
  if (!Array.isArray(list) || list.length === 0) return '无';
  return list
    .map(item => {
      const name = item?.name || item?.tip?.name;
      if (!name) return null;
      return item.kind === 'talent' ? `|cffffd100[${name}]|r` : `|cff71d5ff[${name}]|r`;
    })
    .filter(Boolean)
    .join(' → ');
}

/**
 * 动态探测 wowf.io 当前线上部署版本号 (deployId)
 * @param {(url: string) => Record<string, string>} getHeaders
 * @returns {Promise<string>}
 */
async function discoverDeployId(getHeaders) {
  try {
    const res = await fetch('https://wowf.io/zh/level-up', {
      headers: { ...getHeaders('https://wowf.io/zh/level-up'), 'Accept-Language': 'zh-CN,zh;q=0.9' },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const html = await res.text();
      const directMatch = html.match(/deploy-[a-zA-Z0-9]+-\d+/);
      if (directMatch) {
        return directMatch[0];
      }
      // 扫描引用的 chunk 脚本
      const scriptUrls = [...html.matchAll(/src="(https:\/\/assets\.wowf\.io\/_next\/static\/chunks\/[^"]+\.js)"/g)]
        .map(m => m[1])
        .slice(0, 8);
      for (const scriptUrl of scriptUrls) {
        try {
          const jsRes = await fetch(scriptUrl, {
            headers: getHeaders(scriptUrl),
            signal: AbortSignal.timeout(8000),
          });
          if (!jsRes.ok) continue;
          const jsText = await jsRes.text();
          const m = jsText.match(/deploy-[a-zA-Z0-9]+-\d+/);
          if (m) return m[0];
        } catch {
          // ignore single chunk error
        }
      }
    }
  } catch (err) {
    console.warn(`[WoWF] Failed to auto-discover deployId (${err.message}), using default ${DEFAULT_DEPLOY_ID}`);
  }
  return DEFAULT_DEPLOY_ID;
}

/**
 * 请求 wowf.io /api/level-up 接口
 * @param {string} classSlug
 * @param {string} raceSlug
 * @param {string} faction
 * @param {string} deployId
 * @param {(url: string) => Record<string, string>} getHeaders
 */
async function fetchLevelUpPayload(classSlug, raceSlug, faction, deployId, getHeaders) {
  const url = `https://wowf.io/api/level-up?l=zh&c=${encodeURIComponent(classSlug)}&r=${encodeURIComponent(raceSlug)}&f=${encodeURIComponent(faction)}&v=${encodeURIComponent(deployId)}`;
  const res = await fetch(url, {
    headers: { ...getHeaders(url), Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return await res.json();
}

/**
 * 精简并转换单个升级阶段 band
 */
function transformBand(b) {
  const hub = b.hub
    ? {
        name: b.hub.name || '',
        zone: b.hub.zone || b.zone || '',
        x: b.hub.at?.x ?? null,
        y: b.hub.at?.y ?? null,
      }
    : null;

  const trainer = b.trainer
    ? {
        name: b.trainer.name || '',
        title: b.trainer.title || '职业训练师',
        place: b.trainer.place || b.trainer.zone || '',
        x: b.trainer.at?.x ?? null,
        y: b.trainer.at?.y ?? null,
      }
    : null;

  const professions = Array.isArray(b.professions)
    ? b.professions.slice(0, 6).map(p => {
        const firstTrainer = Array.isArray(p.trainers) && p.trainers[0] ? p.trainers[0] : null;
        return {
          id: p.id || '',
          name: PROF_NAMES_ZH[p.id] || p.id || '专业',
          trainer: firstTrainer?.name || '',
          place: firstTrainer?.place || firstTrainer?.zone || '',
          x: firstTrainer?.at?.x ?? null,
          y: firstTrainer?.at?.y ?? null,
        };
      })
    : [];

  const dungeonQuests = Array.isArray(b.dungeonQuests)
    ? b.dungeonQuests.slice(0, 8).map(dq => {
        const g = Array.isArray(dq.givers) && dq.givers[0] ? dq.givers[0] : null;
        return {
          dungeon: dq.dungeon || '',
          name: dq.name || '',
          level: dq.level || dq.minLevel || b.from,
          minLevel: dq.minLevel || b.from,
          npc: g?.name || '',
          place: g?.place || g?.zone || '',
          x: g?.at?.x ?? null,
          y: g?.at?.y ?? null,
        };
      })
    : [];

  return {
    from: b.from || 1,
    to: b.to || b.from || 60,
    zone: b.zone || (hub ? hub.zone : ''),
    hub,
    trainer,
    professions,
    dungeonQuests,
  };
}

/**
 * 精简并转换职业天赋与专精循环数据
 */
function transformTalentBuilds(talentBuildsObj) {
  if (!talentBuildsObj || typeof talentBuildsObj !== 'object') return [];
  const keys = Object.keys(talentBuildsObj).sort((a, b) => Number(a) - Number(b));
  const specs = [];

  for (const k of keys) {
    const tb = talentBuildsObj[k];
    if (!tb || typeof tb !== 'object') continue;

    const recommendedProfs = Array.isArray(tb.recommended)
      ? tb.recommended.map(id => PROF_NAMES_ZH[id] || id).join(' + ')
      : '';

    const phases = Array.isArray(tb.phases)
      ? tb.phases.map(p => ({
          from: p.from || 1,
          to: p.to || 60,
          keep: formatSkillList(p.keep),
          open: formatSkillList(p.open),
          cycle: formatSkillList(p.cycle),
          note: formatRichSegments(p.note),
        }))
      : [];

    const dungeonTips = Array.isArray(tb.dungeon)
      ? tb.dungeon.map(d => ({
          from: d.from || 13,
          to: d.to || 60,
          text: formatRichSegments(d.text),
        }))
      : [];

    const steps = Array.isArray(tb.steps)
      ? tb.steps.map(s => ({
          level: s.level || 10,
          name: s.name || '',
          tree: s.tree || '',
          rank: s.rank || 1,
          max: s.max || 1,
        }))
      : [];

    const musts = Array.isArray(tb.musts)
      ? tb.musts.map(m => ({
          level: m.level || 1,
          text: formatRichSegments(m.text),
        }))
      : [];

    const skills = [];
    if (Array.isArray(tb.tips?.skills)) {
      for (const sk of tb.tips.skills.slice(0, 18)) {
        const firstRank = Array.isArray(sk.ranks) && sk.ranks[0] ? sk.ranks[0] : null;
        if (!firstRank?.tip?.name) continue;
        const rankLevels = sk.ranks.map(r => r.level).filter(Boolean).join('/');
        skills.push({
          name: firstRank.tip.name,
          firstLevel: firstRank.level || 1,
          rankLevels: rankLevels || String(firstRank.level || 1),
          meta: Array.isArray(firstRank.tip.meta) ? firstRank.tip.meta.join(' · ') : '',
          desc: firstRank.tip.desc || '',
        });
      }
    }

    specs.push({
      index: Number(k) + 1,
      name: tb.name || `专精 ${Number(k) + 1}`,
      specKey: tb.spec || '',
      recommendedProfs,
      phases,
      dungeonTips,
      steps,
      musts,
      skills,
    });
  }

  return specs;
}

/**
 * 精简并转换职业专属任务链 classRuns
 */
function transformClassRuns(classRuns, factionLabel) {
  if (!Array.isArray(classRuns)) return [];
  return classRuns.map(cr => {
    const steps = Array.isArray(cr.steps)
      ? cr.steps.map(st => {
          const g = Array.isArray(st.givers) && st.givers[0] ? st.givers[0] : null;
          return {
            name: st.name || '',
            level: st.level || st.minLevel || cr.level || 1,
            npc: g?.name || '',
            zone: g?.zone || '',
            place: g?.place || '',
            x: g?.at?.x ?? null,
            y: g?.at?.y ?? null,
          };
        })
      : [];
    return {
      faction: factionLabel,
      level: cr.level || 1,
      to: cr.to || cr.level || 60,
      name: cr.name || '职业任务',
      teaches: cr.teaches?.name || '',
      steps,
    };
  });
}

/**
 * 合并并去重地下城列表与任务
 */
function mergeDungeonIntoMap(dungeonMap, d, faction) {
  if (!d || !d.id) return;
  const existing = dungeonMap.get(d.id);
  const minLevel = Array.isArray(d.level) ? d.level[0] : 13;
  const maxLevel = Array.isArray(d.level) ? d.level[1] : minLevel + 3;
  const zone = d.entrance?.zone || d.zone || '';
  const isNew = FOREVER_NEW_DUNGEON_IDS.has(d.id);

  const incomingQuests = Array.isArray(d.quests)
    ? d.quests.map(q => {
        const g = Array.isArray(q.givers) && q.givers[0] ? q.givers[0] : null;
        const lastStep = Array.isArray(q.steps) && q.steps.length > 0 ? q.steps[q.steps.length - 1] : null;
        return {
          name: q.name || '',
          level: q.level || q.minLevel || minLevel,
          minLevel: q.minLevel || minLevel,
          inside: Boolean(q.inside),
          faction: g?.side && g.side !== 'both' ? g.side : faction || 'both',
          npc: g?.name || '',
          zone: g?.zone || q.zone || zone,
          place: g?.place || '',
          x: g?.at?.x ?? null,
          y: g?.at?.y ?? null,
          stepCount: Array.isArray(q.steps) ? q.steps.length : 1,
          finalObjective: lastStep?.objective || '',
        };
      })
    : [];

  if (!existing) {
    const newMeta = FOREVER_NEW_DUNGEONS_META.find(m => m.id === d.id);
    dungeonMap.set(d.id, {
      id: d.id,
      name: d.name || newMeta?.name || d.id,
      minLevel,
      maxLevel,
      visit: d.visit || Math.round((minLevel + maxLevel) / 2),
      zone: newMeta?.zone || zone,
      isNew,
      bosses: newMeta?.bosses || [],
      summary: newMeta?.summary || `${zone} (${minLevel}-${maxLevel}级) 经典地下城。`,
      quests: incomingQuests,
    });
  } else {
    existing.minLevel = minLevel;
    existing.maxLevel = maxLevel;
    if (d.visit) existing.visit = d.visit;
    const questIndexByKey = new Map(existing.quests.map((q, idx) => [`${q.name}:${q.npc}`, idx]));
    for (const q of incomingQuests) {
      const key = `${q.name}:${q.npc}`;
      if (questIndexByKey.has(key)) {
        existing.quests[questIndexByKey.get(key)] = q;
      } else {
        questIndexByKey.set(key, existing.quests.length);
        existing.quests.push(q);
      }
    }
  }
}

/**
 * 动态抓取 wowf.io/zh/news 最新热修与公告
 */
async function fetchLiveNews(getHeaders) {
  try {
    const url = 'https://wowf.io/zh/news';
    const res = await fetch(url, {
      headers: { ...getHeaders(url), 'Accept-Language': 'zh-CN,zh;q=0.9' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const articles = [];
    const linkRegex = /<a[^>]+href="(\/zh\/news\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null && articles.length < 8) {
      const href = `https://wowf.io${match[1]}`;
      const rawText = match[2]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
      if (!rawText || rawText.length < 10) continue;

      const dateMatch = rawText.match(/(\d{4}年\d{1,2}月\d{1,2}日(?:\s*\d{1,2}:\d{2})?)/);
      const date = dateMatch ? dateMatch[1] : '最新公告';
      const cleaned = rawText
        .replace(/^Blizzard\s*公告\s*/i, '')
        .replace(dateMatch ? dateMatch[0] : '', '')
        .replace(/UTC\+8/g, '')
        .trim();
      const parts = cleaned.split(/\s{2,}|\s*\|\s*/);
      const title = parts[0] ? parts[0].slice(0, 60) : cleaned.slice(0, 50);
      const summary = cleaned.length > title.length ? cleaned.slice(title.length).trim() : cleaned;
      if (title && !articles.some(a => a.title === title)) {
        articles.push({ date, title, summary: summary || title, href });
      }
    }
    if (articles.length > 0) return articles;
  } catch (err) {
    console.warn(`[WoWF] News fetch fallback (${err.message})`);
  }
  return FALLBACK_NEWS;
}

/**
 * 动态抓取 wowf.io/zh/macros/{class} 页面上的职业宏并与内置精选宏库合并
 */
async function fetchLiveClassMacros(classSlug, classKey, getHeaders) {
  const baseMacros = FALLBACK_MACROS[classKey] || [];
  try {
    const url = `https://wowf.io/zh/macros/${classSlug}`;
    const res = await fetch(url, {
      headers: { ...getHeaders(url), 'Accept-Language': 'zh-CN,zh;q=0.9' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return baseMacros;
    const html = await res.text();
    // 匹配页面中的 #showtooltip 宏代码块
    const scraped = [];
    const cardRegex = /<h[23][^>]*>([^<]+)<\/h[23]>[\s\S]{0,800}?(#showtooltip[\s\S]{1,400}?)(?:<\/pre>|<\/code>|<\/div>)/gi;
    let m;
    while ((m = cardRegex.exec(html)) !== null && scraped.length < 8) {
      const title = m[1].replace(/<[^>]+>/g, '').trim();
      const code = m[2]
        .replace(/<[^>]+>/g, '')
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .trim();
      if (title && code.includes('/')) {
        scraped.push({
          title,
          level: 1,
          isForeverNew: code.includes('乘胜追击') || code.includes('穿刺打击') || code.includes('十字军打击'),
          desc: `来自 wowf.io/zh/macros/${classSlug} 的实用职业宏。`,
          code,
        });
      }
    }
    if (scraped.length > 0) {
      const merged = [...baseMacros];
      for (const s of scraped) {
        if (!merged.some(b => b.title === s.title)) {
          merged.push(s);
        }
      }
      return merged;
    }
  } catch {
    // use fallback macros
  }
  return baseMacros;
}

/**
 * 将 JavaScript 值安全序列化为格式化的 Lua 字面量
 * @param {any} val
 * @param {number} indent
 * @returns {string}
 */
function toLuaValue(val, indent = 0) {
  const pad = '  '.repeat(indent);
  const nextPad = '  '.repeat(indent + 1);

  if (val === null || val === undefined) {
    return 'nil';
  }
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false';
  }
  if (typeof val === 'number') {
    return Number.isFinite(val) ? String(val) : '0';
  }
  if (typeof val === 'string') {
    const escaped = val
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\r/g, '')
      .replace(/\n/g, '\\n');
    return `"${escaped}"`;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return '{}';
    const items = val.map(item => `${nextPad}${toLuaValue(item, indent + 1)}`);
    return `{\n${items.join(',\n')}\n${pad}}`;
  }
  if (typeof val === 'object') {
    const entries = Object.entries(val).filter(([, v]) => v !== undefined && v !== null);
    if (entries.length === 0) return '{}';
    const lines = entries.map(([k, v]) => {
      const isSimpleIdent = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k);
      const luaKey = isSimpleIdent ? k : `["${k.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
      return `${nextPad}${luaKey} = ${toLuaValue(v, indent + 1)}`;
    });
    return `{\n${lines.join(',\n')}\n${pad}}`;
  }
  return 'nil';
}

/**
 * 构建完整数据集：优先从 wowf.io 实时抓取并缓存，断网或局部请求失败时按粒度回退到已有缓存
 */
async function buildWoWFDataset(cacheDir, getHeaders) {
  const cacheFile = path.join(cacheDir, 'wowf-dataset.json');
  let cachedDataset = null;
  if (fs.existsSync(cacheFile)) {
    try {
      cachedDataset = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    } catch {
      cachedDataset = null;
    }
  }

  const deployId = await discoverDeployId(getHeaders);
  console.log(`[WoWF] Using wowf.io deployId: ${deployId}`);

  const classesData = {};
  const routesData = {};
  const dungeonMap = new Map();
  const notableItemsMap = new Map();
  const professionsMap = new Map();

  // 先预填 12 大专业冲级与无限服特色指南元数据
  for (const prof of PROFESSION_GUIDES_META) {
    professionsMap.set(prof.id, { ...prof });
  }
  if (Array.isArray(cachedDataset?.professions)) {
    for (const cp of cachedDataset.professions) {
      if (cp?.id) {
        const prev = professionsMap.get(cp.id) || {};
        professionsMap.set(cp.id, { ...prev, ...cp });
      }
    }
  }

  // 先预填 11 个无限服新增地下城与团本元数据，确保任何情况下都完整收录
  for (const meta of FOREVER_NEW_DUNGEONS_META) {
    dungeonMap.set(meta.id, {
      id: meta.id,
      name: meta.name,
      minLevel: meta.level[0],
      maxLevel: meta.level[1],
      visit: meta.visit,
      zone: meta.zone,
      isNew: true,
      bosses: meta.bosses,
      summary: meta.summary,
      quests: [],
    });
  }

  // 从已有缓存预载地下城与精选掉落，避免局部路线请求失败时丢失其它阵营副本任务或装备；
  // 后续实时请求返回的同名任务与装备会覆盖此处预载的旧缓存值
  if (Array.isArray(cachedDataset?.dungeons)) {
    for (const cd of cachedDataset.dungeons) {
      if (!cd?.id) continue;
      if (!dungeonMap.has(cd.id)) {
        dungeonMap.set(cd.id, { ...cd, quests: Array.isArray(cd.quests) ? [...cd.quests] : [] });
      } else {
        const existing = dungeonMap.get(cd.id);
        const questIndexByKey = new Map(existing.quests.map((q, idx) => [`${q.name}:${q.npc}`, idx]));
        for (const q of cd.quests || []) {
          const key = `${q.name}:${q.npc}`;
          if (!questIndexByKey.has(key)) {
            questIndexByKey.set(key, existing.quests.length);
            existing.quests.push(q);
          }
        }
      }
    }
  }
  if (Array.isArray(cachedDataset?.items)) {
    for (const ci of cachedDataset.items) {
      if (ci?.id && !notableItemsMap.has(String(ci.id)) && notableItemsMap.size < 180) {
        notableItemsMap.set(String(ci.id), ci);
      }
    }
  }

  let liveFetchCount = 0;
  let hasPartialFailure = false;

  // 1. 抓取 10 条种族升级路线 (bands + dungeons + professions)
  for (const route of RACE_ROUTES) {
    let payload = null;
    let lastErr = null;
    for (const candidateRace of route.apiRaces || [route.id]) {
      try {
        payload = await fetchLevelUpPayload(route.sampleClass, candidateRace, route.faction, deployId, getHeaders);
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (!payload) {
      hasPartialFailure = true;
      // 优先复用已有的天裔或其它种族路线缓存；仅当不存在天裔缓存时才基于阵营主干合成天裔路线
      if (Array.isArray(cachedDataset?.routes?.[route.id]?.bands) && cachedDataset.routes[route.id].bands.length > 0) {
        routesData[route.id] = cachedDataset.routes[route.id];
        continue;
      }
      if (route.id === 'skyborne-alliance' || route.id === 'skyborne-horde') {
        const baseKey = route.faction === 'horde' ? 'orc' : 'human';
        const baseRoute = routesData[baseKey] || cachedDataset?.routes?.[baseKey];
        const tailBands = Array.isArray(baseRoute?.bands)
          ? baseRoute.bands
              .filter(b => (b.to ?? b.from ?? 0) >= 12)
              .map(b => ((b.from ?? 1) < 12 ? { ...b, from: 12 } : b))
          : [];
        if (tailBands.length > 0) {
          routesData[route.id] = {
            id: route.id,
            name: route.name,
            faction: route.faction,
            wowRaceKeys: route.wowRaceKeys,
            bands: [
              {
                from: 1,
                to: 12,
                zone: '泽风岛 (Zephras Isle)',
                hub: { name: '泽风庇护所 / 天裔前哨', zone: '泽风岛', x: 48.5, y: 52.0 },
                trainer: { name: '天裔导师', title: '全职业训练师', place: '泽风岛主营地', x: 49.2, y: 51.4 },
                professions: [
                  { id: 'first-aid', name: '急救', trainer: '天裔医师', place: '泽风岛', x: 48.0, y: 53.0 },
                ],
                dungeonQuests: [],
              },
              ...tailBands,
            ],
          };
        }
        continue;
      }
      console.warn(`[WoWF] Route fetch failed for ${route.id}: ${lastErr?.message}`);
      continue;
    }
    liveFetchCount++;
    routesData[route.id] = {
      id: route.id,
      name: route.name,
      faction: route.faction,
      wowRaceKeys: route.wowRaceKeys,
      bands: Array.isArray(payload.bands) ? payload.bands.map(transformBand) : [],
    };
    if (Array.isArray(payload.dungeons)) {
      for (const d of payload.dungeons) {
        mergeDungeonIntoMap(dungeonMap, d, route.faction);
      }
    }
    if (Array.isArray(payload.professions)) {
      for (const p of payload.professions) {
        if (!p || !p.id) continue;
        const meta = professionsMap.get(p.id) || {};
        professionsMap.set(p.id, {
          id: p.id,
          name: p.name || meta.name || PROF_NAMES_ZH[p.id] || p.id,
          type: p.type || meta.type || 'crafting',
          pairs: Array.isArray(p.pairs) && p.pairs.length > 0 ? p.pairs : (meta.pairs || []),
          makes: Array.isArray(p.makes) && p.makes.length > 0 ? p.makes : (meta.makes || []),
          brackets: meta.brackets || '1–75 初级 → 75–150 中级 → 150–225 高级 → 225–300 大师级',
          trainers: meta.trainers || '各大主城及对应等级营地专业训练师',
          foreverNote: meta.foreverNote || '',
        });
      }
    }
    if (payload.items && typeof payload.items === 'object') {
      for (const [id, item] of Object.entries(payload.items)) {
        if (item && item.quality >= 3 && (notableItemsMap.has(id) || notableItemsMap.size < 180)) {
          notableItemsMap.set(id, {
            id: Number(id),
            name: item.name || '',
            quality: item.quality || 3,
            reqLevel: item.requiredLevel || 1,
            ilvl: item.itemLevel || 1,
            slot: item.slot || '',
            type: item.type || '',
            stats: Array.isArray(item.stats) ? item.stats.map(s => `${s.label}+${s.value}`).join(' ') : '',
            effect: Array.isArray(item.effects) && item.effects[0]?.text ? item.effects[0].text : '',
          });
        }
      }
    }
  }

  // 2. 抓取 9 大职业的专精循环、10-60 天赋加点、双阵营职业任务与宏命令
  for (const cls of CLASS_CONFIGS) {
    const cachedClass = cachedDataset?.classes?.[cls.key];
    let specs = [];
    const classRuns = [];
    const primaryFaction = cls.hordeRace && !cls.allianceRace ? 'horde' : (cls.key === 'DRUID' ? 'horde' : 'alliance');
    const primaryRace = primaryFaction === 'horde' ? cls.hordeRace : cls.allianceRace;
    const secondaryFaction = primaryFaction === 'alliance' ? 'horde' : 'alliance';
    const secondaryRace = secondaryFaction === 'horde' ? cls.hordeRace : cls.allianceRace;

    try {
      const primaryPayload = await fetchLevelUpPayload(cls.slug, primaryRace, primaryFaction, deployId, getHeaders);
      liveFetchCount++;
      specs = transformTalentBuilds(primaryPayload.talentBuilds);
      classRuns.push(...transformClassRuns(primaryPayload.classRuns, primaryFaction));

      // 如果该职业双阵营都有，额外拉取另一阵营的专属职业任务链
      if (secondaryRace) {
        try {
          const secondaryPayload = await fetchLevelUpPayload(cls.slug, secondaryRace, secondaryFaction, deployId, getHeaders);
          classRuns.push(...transformClassRuns(secondaryPayload.classRuns, secondaryFaction));
        } catch (secErr) {
          hasPartialFailure = true;
          console.warn(`[WoWF] Secondary faction classRuns fetch failed for ${cls.key} (${secondaryFaction}): ${secErr.message}`);
          if (Array.isArray(cachedClass?.classRuns)) {
            classRuns.push(...cachedClass.classRuns.filter(cr => cr.faction === secondaryFaction));
          }
        }
      }
    } catch (err) {
      hasPartialFailure = true;
      console.warn(`[WoWF] Class fetch failed for ${cls.key}: ${err.message}`);
      if (Array.isArray(cachedClass?.specs) && cachedClass.specs.length > 0) {
        specs = cachedClass.specs;
      }
      if (Array.isArray(cachedClass?.classRuns) && cachedClass.classRuns.length > 0) {
        classRuns.push(...cachedClass.classRuns);
      }
    }

    const macros = await fetchLiveClassMacros(cls.slug, cls.key, getHeaders);
    if (Array.isArray(cachedClass?.macros)) {
      for (const cm of cachedClass.macros) {
        if (cm?.title && !macros.some(m => m.title === cm.title)) {
          macros.push(cm);
        }
      }
    }

    classesData[cls.key] = {
      key: cls.key,
      slug: cls.slug,
      name: cls.name,
      color: cls.color,
      specs,
      classRuns,
      macros,
    };
  }

  // 3. 抓取最新热修新闻
  const news = await fetchLiveNews(getHeaders);

  const professionsList = [...professionsMap.values()];

  // 如果完全断网导致没有抓到实时路由数据，返回已有完整缓存并补齐新增的内置专业与无限服特色指南字段
  if (liveFetchCount === 0 && cachedDataset) {
    console.log(`[WoWF] Offline mode detected, loading cached dataset from ${cacheFile}`);
    return {
      ...cachedDataset,
      professions: professionsList,
      foreverSystems: cachedDataset.foreverSystems || FOREVER_SYSTEMS_DATA,
    };
  }

  const dungeonsList = [...dungeonMap.values()].sort((a, b) => a.minLevel - b.minLevel || a.visit - b.visit);
  const itemsList = [...notableItemsMap.values()].sort((a, b) => a.reqLevel - b.reqLevel);

  // 从最新热修公告提取日期作为动态数据库版本号 (如 2026.11.15)
  let dbVersion = '2026.11.15';
  if (Array.isArray(news) && news.length > 0) {
    const firstDate = news[0].date || '';
    const zhMatch = firstDate.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    const isoMatch = firstDate.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (zhMatch) {
      dbVersion = `${zhMatch[1]}.${Number(zhMatch[2])}.${Number(zhMatch[3])}`;
    } else if (isoMatch) {
      dbVersion = `${isoMatch[1]}.${Number(isoMatch[2])}.${Number(isoMatch[3])}`;
    }
  }

  const dataset = {
    meta: {
      site: 'https://wowf.io/zh',
      version: `${WOWF_VERSION} + DB v${dbVersion}`,
      dbVersion,
      deployId,
      updatedAt: dbVersion.replace(/\./g, '-'),
    },
    routes: routesData,
    classes: classesData,
    dungeons: dungeonsList,
    items: itemsList,
    professions: professionsList,
    foreverSystems: FOREVER_SYSTEMS_DATA,
    news,
  };

  // 仅当本次抓取完整（或尚无本地缓存快照）时才写入缓存文件，防止局部网络波动覆盖完整缓存
  const hasCompleteRoutes = Object.keys(routesData).length >= RACE_ROUTES.length;
  const hasCompleteClasses = CLASS_CONFIGS.every(c => Array.isArray(classesData[c.key]?.specs) && classesData[c.key].specs.length > 0);
  if ((!hasPartialFailure && hasCompleteRoutes && hasCompleteClasses) || !cachedDataset) {
    try {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify(dataset, null, 2), 'utf-8');
    } catch {
      // ignore cache write error
    }
  } else {
    console.warn('[WoWF] Partial fetch failure occurred; preserved existing cache snapshot and merged missing entries.');
  }

  return dataset;
}

/**
 * 生成 WoWF/WoWF.toc 文件内容（仅兼容无限服 Interface: 16001）
 */
function generateWoWFToc(version, updatedAt) {
  return `## Interface: 16001
## Title: WoWF Companion (wowf.io 无限服智能百科)
## Title-zhCN: |cff00ffcc[无限百科]|r WoWF Companion (wowf.io 动态指南)
## Notes: In-game smart companion for wowf.io on WoW Forever (16001). Dynamically matches leveling routes, new dungeons, class rotations, talent builds, and macros to your character's level and class.
## Notes-zhCN: 同步 wowf.io 最新数据的《魔兽世界：无限服》专属游戏内动态百科！根据当前角色等级、职业、专精、种族与阵营自动匹配：1-60升级路线与坐标导航、专精输出循环、10-60逐级天赋加点、一键创建职业宏、35大副本（含9大无限服新本）必接任务与掉落、露营睡袋/经典旧世树/物资箱攻略与最新热修公告。(数据同步: ${updatedAt})
## Author: lich.tech & wowf.io
## Version: ${version}
## SavedVariables: WoWFDB
## X-Website: https://wowf.io/zh
## X-Category: Guide

Data.lua
WoWF.lua
`;
}

/**
 * 生成 WoWF/Data.lua 文件内容
 */
function generateWoWFDataLua(dataset) {
  return `-- Auto-generated from https://wowf.io/zh (${dataset.meta.deployId} @ ${dataset.meta.updatedAt})
WoWF_Data = ${toLuaValue(dataset, 0)}
`;
}

/**
 * 生成 WoWF/WoWF.lua 核心游戏内界面与智能匹配逻辑
 */
function generateWoWFLua() {
  return String.raw`-- ============================================================================
-- WoWF Companion (wowf.io 无限服游戏内动态智能指南)
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

local state = {
  autoFollow = true,
  level = 1,
  classKey = "WARRIOR",
  specIndex = 1,
  routeId = "human",
  faction = "alliance",
  zone = "",
  activeTab = 1,
  dungeonFilter = "MATCH", -- "MATCH" | "NEW" | "ALL"
  searchQuery = "",
}

-- ============================================================================
-- 1. 角色状态自动探测与智能匹配
-- ============================================================================

local function ResolveRouteId(wowRaceFile, faction)
  local r = (wowRaceFile or ""):lower()
  if r == "human" then return "human" end
  if r == "dwarf" then return "dwarf" end
  if r == "nightelf" or r == "night-elf" then return "night-elf" end
  if r == "gnome" then return "gnome" end
  if r == "orc" then return "orc" end
  if r == "scourge" or r == "undead" then return "undead" end
  if r == "tauren" then return "tauren" end
  if r == "troll" then return "troll" end
  if r:find("skyborne") or r:find("highelf") or r:find("windshaper") then
    return faction == "horde" and "skyborne-horde" or "skyborne-alliance"
  end
  return faction == "horde" and "orc" or "human"
end

local function DetectActiveTalentSpec()
  if not GetNumTalentTabs or not GetTalentTabInfo then
    return 1
  end
  local numTabs = GetNumTalentTabs() or 0
  local bestTab = 1
  local maxPoints = -1
  for i = 1, numTabs do
    local name, _, pointsSpent = GetTalentTabInfo(i)
    local pts = tonumber(pointsSpent) or tonumber(name) or 0
    if pts > maxPoints then
      maxPoints = pts
      bestTab = i
    end
  end
  return bestTab
end

local function SyncPlayerCharacter(overrideLevel)
  local lvl = overrideLevel or (UnitLevel and UnitLevel("player")) or 1
  if lvl < 1 then lvl = 1 end
  if lvl > 60 then lvl = 60 end

  local classFile = "WARRIOR"
  if UnitClass then
    local _, cf = UnitClass("player")
    if cf and Data.classes and Data.classes[cf] then
      classFile = cf
    end
  end

  local engFaction = (UnitFactionGroup and UnitFactionGroup("player")) or "Alliance"
  local faction = (engFaction == "Horde") and "horde" or "alliance"

  local raceFile = "Human"
  if UnitRace then
    local _, rf = UnitRace("player")
    if rf then
      raceFile = rf
    end
  end
  local routeId = ResolveRouteId(raceFile, faction)

  state.zone = (GetRealZoneText and GetRealZoneText()) or ""

  if state.autoFollow then
    state.level = lvl
    state.classKey = classFile
    state.faction = faction
    state.routeId = routeId
    local detectedSpec = DetectActiveTalentSpec()
    local clsData = Data.classes and Data.classes[classFile]
    if clsData and clsData.specs and clsData.specs[detectedSpec] then
      state.specIndex = detectedSpec
    else
      state.specIndex = 1
    end
  end
end

-- ============================================================================
-- 2. 地图导航与一键创建宏工具函数
-- ============================================================================

local function SetWaypointOrPrint(zone, name, x, y)
  if not x or not y then
    DEFAULT_CHAT_FRAME:AddMessage("|cff00ffcc[WoWF 无限百科]|r 目标位置: |cffffd100" .. (zone or "") .. " - " .. (name or "") .. "|r")
    return
  end
  local coordText = string.format("%.1f, %.1f", x, y)
  DEFAULT_CHAT_FRAME:AddMessage(
    string.format("|cff00ffcc[WoWF 无限百科]|r 导航坐标: |cffffd100%s - %s (%s)|r", zone or "未知区域", name or "目标点", coordText)
  )
  -- 若安装了 TomTom，自动调用 TomTom 箭头
  if SlashCmdList and SlashCmdList["TOMTOM_WAY"] then
    SlashCmdList["TOMTOM_WAY"](string.format("%s %.1f %.1f %s", zone or "", x, y, name or "WoWF导航"))
  end
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
    hint:SetText("|cff99e6ff按 Ctrl+C 复制宏命令，或点击下方按钮直接写入角色宏槽位：|r")

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
    DEFAULT_CHAT_FRAME:AddMessage("|cffff4444[WoWF 无限百科]|r 战斗中无法直接创建宏，已为您打开复制窗口！")
    ShowCopyMacroDialog(macroTitle, macroCode)
    return
  end

  local shortName = string.sub(macroTitle or "WoWF宏", 1, 15)
  if CreateMacro and GetMacroIndexByName then
    local existingIdx = GetMacroIndexByName(shortName)
    if existingIdx and existingIdx > 0 then
      if EditMacro then
        EditMacro(existingIdx, shortName, "INV_Misc_QuestionMark", macroCode, 1, 1)
        DEFAULT_CHAT_FRAME:AddMessage("|cff00ffcc[WoWF 无限百科]|r 已更新现有宏: |cffffd100[" .. shortName .. "]|r (输入 /macro 查看)")
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
        DEFAULT_CHAT_FRAME:AddMessage("|cff00ffcc[WoWF 无限百科]|r 已一键创建游戏内宏: |cffffd100[" .. shortName .. "]|r (输入 /macro 拖到技能栏即可使用)")
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
  return spec.dungeonTips[#spec.dungeonTips]
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

local function GetMatchedDungeons(level)
  local list = {}
  for _, d in ipairs(Data.dungeons or {}) do
    if level >= (d.minLevel - 3) and level <= (d.maxLevel + 3) then
      table.insert(list, d)
    end
  end
  return list
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

    card.title = card:CreateFontString(nil, "OVERLAY", "GameFontNormalLarge")
    card.title:SetPoint("TOPLEFT", 12, -10)
    card.title:SetPoint("TOPRIGHT", -140, -10)
    card.title:SetJustifyH("LEFT")
    card.title:SetWordWrap(true)

    card.badge = card:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
    card.badge:SetPoint("TOPRIGHT", -12, -12)
    card.badge:SetJustifyH("RIGHT")

    card.body = card:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
    card.body:SetPoint("TOPLEFT", card.title, "BOTTOMLEFT", 0, -6)
    card.body:SetPoint("RIGHT", card, "RIGHT", -12, 0)
    card.body:SetJustifyH("LEFT")
    card.body:SetSpacing(3)
    card.body:SetWordWrap(true)

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

local function HideUnusedCards(fromIndex)
  for i = fromIndex, #cardPool do
    cardPool[i]:Hide()
  end
end

local function LayoutCard(card, yOffset, titleText, bodyText, borderColor, bgColor, badgeText, actionLabel, actionCallback)
  local width = (contentChild:GetWidth() or 700) - 16
  if width < 500 then width = 690 end
  card:SetWidth(width)
  card:ClearAllPoints()
  card:SetPoint("TOPLEFT", contentChild, "TOPLEFT", 8, -yOffset)

  if card.SetBackdrop then
    local bg = bgColor or { 0.08, 0.10, 0.14, 0.92 }
    local br = borderColor or { 0.25, 0.35, 0.45, 0.85 }
    card:SetBackdropColor(bg[1], bg[2], bg[3], bg[4])
    card:SetBackdropBorderColor(br[1], br[2], br[3], br[4])
  end

  card.title:SetWidth(width - (actionLabel and 150 or 120))
  card.title:SetText(titleText or "")

  if actionLabel and actionCallback then
    card.actionBtn:SetText(actionLabel)
    card.actionBtn:SetScript("OnClick", actionCallback)
    card.actionBtn:Show()
    card.badge:SetText("")
  else
    card.actionBtn:Hide()
    card.badge:SetText(badgeText or "")
  end

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
-- 5. 六大核心标签页渲染器
-- ============================================================================

local function RenderTabSmartMatch()
  local cardIdx = 1
  local y = 6
  local lvl = state.level
  local route = GetCurrentRoute()
  local cls = GetCurrentClassData()
  local spec = GetCurrentSpecData()

  -- 1. 角色智能匹配总览卡
  local band = GetMatchedBand(route, lvl)
  local phase = GetMatchedPhase(spec, lvl)
  local talentStep = GetMatchedTalentStep(spec, lvl)
  local matchedDungeons = GetMatchedDungeons(lvl)

  local overviewLines = {}
  table.insert(overviewLines, string.format(
    "|cff00ffcc当前匹配角色:|r |cffffd100Lv.%d %s (%s)|r  ·  |cff99e6ff升级路线:|r %s (%s)",
    lvl,
    cls and cls.name or state.classKey,
    spec and spec.name or "默认专精",
    route and route.name or state.routeId,
    state.faction == "horde" and "|cffff5555部落|r" or "|cff44aaff联盟|r"
  ))
  if spec and spec.recommendedProfs and spec.recommendedProfs ~= "" then
    table.insert(overviewLines, "|cff00ff96推荐搭配专业:|r " .. spec.recommendedProfs .. "   |cffaaaaaa(上方控制栏可自由切换等级、职业、专精与种族路线)|r")
  end
  if lvl >= 14 then
    table.insert(overviewLines, "|cffffd100★ 无限服经验加速提醒:|r 14级起记得完成【舒适的睡袋】四步任务常驻 |cff00ff00+8% 经验值|r，并在野外利用制皮【营地帐篷】快速攒双倍经验！")
  end

  local c1 = AcquireCard(cardIdx); cardIdx = cardIdx + 1
  y = LayoutCard(
    c1, y,
    string.format("|cff00ffcc🎯 Lv.%d %s·%s 智能匹配总览|r", lvl, cls and cls.name or "", spec and spec.name or ""),
    table.concat(overviewLines, "\n"),
    { 0.0, 0.85, 0.7, 0.95 },
    { 0.05, 0.14, 0.16, 0.95 },
    "|cff00ffccwowf.io 实时引擎|r"
  )

  -- 2. 当前等级推荐区域与营地导航
  if band then
    local bandLines = {}
    local hubName = (band.hub and band.hub.name ~= "") and band.hub.name or band.zone
    local coordStr = (band.hub and band.hub.x and band.hub.y) and string.format(" (%.1f, %.1f)", band.hub.x, band.hub.y) or ""
    table.insert(bandLines, string.format("|cffffd100主推练级区域:|r |cff00ffcc%s|r   ·   |cffffd100核心营地/城镇:|r %s%s", band.zone or "未知", hubName or "", coordStr))

    if band.trainer and band.trainer.name ~= "" then
      local tCoord = (band.trainer.x and band.trainer.y) and string.format(" (%.1f, %.1f)", band.trainer.x, band.trainer.y) or ""
      table.insert(bandLines, string.format("|cff71d5ff职业训练师:|r %s (%s · %s)%s", band.trainer.name, band.trainer.title or "", band.trainer.place or "", tCoord))
    end

    if band.professions and #band.professions > 0 then
      local pList = {}
      for _, p in ipairs(band.professions) do
        local pc = (p.x and p.y) and string.format("(%.1f,%.1f)", p.x, p.y) or ""
        table.insert(pList, string.format("|cff00ff96[%s]|r %s %s", p.name, p.trainer or "", pc))
      end
      table.insert(bandLines, "|cff00ff96本区专业训练师:|r " .. table.concat(pList, "  /  "))
    end

    if band.dungeonQuests and #band.dungeonQuests > 0 then
      local dqList = {}
      for _, dq in ipairs(band.dungeonQuests) do
        local dqc = (dq.x and dq.y) and string.format(" (%.1f,%.1f)", dq.x, dq.y) or ""
        table.insert(dqList, string.format("  • |cffff8000[%s]|r |cffffd100%s|r (Lv.%d) — 接取: %s %s%s", dq.dungeon, dq.name, dq.level or lvl, dq.place or "", dq.npc or "", dqc))
      end
      table.insert(bandLines, "|cffffa500本阶段顺路必接副本任务:|r\n" .. table.concat(dqList, "\n"))
    end

    local cBand = AcquireCard(cardIdx); cardIdx = cardIdx + 1
    y = LayoutCard(
      cBand, y,
      string.format("|cffffd100🗺️ 当前等级升级导航 (Lv.%d–%d · %s)|r", band.from, band.to, band.zone or ""),
      table.concat(bandLines, "\n"),
      { 0.9, 0.75, 0.2, 0.9 },
      { 0.11, 0.10, 0.06, 0.92 },
      string.format("Lv.%d-%d", band.from, band.to),
      (band.hub and band.hub.x) and "📍 标记营地坐标" or nil,
      (band.hub and band.hub.x) and function()
        SetWaypointOrPrint(band.zone, band.hub.name, band.hub.x, band.hub.y)
      end or nil
    )
  end

  -- 3. 当前等级天赋加点指引 (Lv.10-60)
  if spec then
    local tLines = {}
    if lvl < 10 then
      table.insert(tLines, string.format("当前 |cffffd100Lv.%d|r 尚未解锁天赋树（10 级解锁第 1 点天赋）。", lvl))
      if spec.steps and spec.steps[1] then
        local firstStep = spec.steps[1]
        table.insert(tLines, string.format("达到 |cff00ff00Lv.10|r 时首点推荐投入: |cffffd100[%s] %s (%d/%d)|r", firstStep.tree, firstStep.name, firstStep.rank, firstStep.max))
      end
    else
      if talentStep then
        table.insert(tLines, string.format("👉 |cff00ff00Lv.%d 本级必点天赋:|r |cffffd100[%s] %s (第 %d/%d 点)|r", lvl, talentStep.tree, talentStep.name, talentStep.rank, talentStep.max))
      end
      local nextPreview = {}
      for nextLvl = lvl + 1, math.min(60, lvl + 4) do
        local ns = GetMatchedTalentStep(spec, nextLvl)
        if ns then
          table.insert(nextPreview, string.format("Lv.%d: [%s] %s (%d/%d)", nextLvl, ns.tree, ns.name, ns.rank, ns.max))
        end
      end
      if #nextPreview > 0 then
        table.insert(tLines, "|cff99e6ff后续等级加点预告:|r " .. table.concat(nextPreview, "  →  "))
      end
    end

    local cTalent = AcquireCard(cardIdx); cardIdx = cardIdx + 1
    y = LayoutCard(
      cTalent, y,
      string.format("|cffffd100🌟 Lv.%d 天赋加点指引 (%s·%s)|r", lvl, cls and cls.name or "", spec.name),
      table.concat(tLines, "\n"),
      { 0.35, 0.65, 0.95, 0.9 },
      { 0.07, 0.11, 0.17, 0.92 },
      "点击[职业与天赋]看完整10-60表"
    )
  end

  -- 4. 当前等级专精输出循环与副本手法
  if phase then
    local rotLines = {
      "|cff00ff96【常驻保持】|r " .. (phase.keep or "无"),
      "|cffffa500【起手技能】|r " .. (phase.open or "普通攻击"),
      "|cff71d5ff【核心优先级】|r " .. (phase.cycle or "普通攻击"),
    }
    if phase.note and phase.note ~= "" then
      table.insert(rotLines, "\n|cffffd100【野外实战细节】|r\n" .. phase.note)
    end
    local dTip = GetMatchedDungeonTip(spec, lvl)
    if dTip and dTip.text ~= "" then
      table.insert(rotLines, "\n|cffff8000【当前等级地下城战斗指南 (Lv." .. dTip.from .. "-" .. dTip.to .. ")】|r\n" .. dTip.text)
    end

    local cRot = AcquireCard(cardIdx); cardIdx = cardIdx + 1
    y = LayoutCard(
      cRot, y,
      string.format("|cff71d5ff⚔️ 当前等级输出手法与循环 (Lv.%d–%d)|r", phase.from, phase.to),
      table.concat(rotLines, "\n"),
      { 0.3, 0.75, 0.95, 0.9 },
      { 0.06, 0.10, 0.15, 0.92 },
      string.format("Lv.%d-%d 阶段", phase.from, phase.to)
    )
  end

  -- 5. 当前等级职业任务与关键里程碑
  local milestoneLines = {}
  if spec and spec.musts then
    for _, m in ipairs(spec.musts) do
      if math.abs((m.level or 1) - lvl) <= 8 or (m.level <= lvl and m.level >= lvl - 10) then
        local tag = (m.level == lvl) and "|cff00ff00[当前等级必做]|r " or string.format("|cffffd100[Lv.%d 里程碑]|r ", m.level)
        table.insert(milestoneLines, "  • " .. tag .. (m.text or ""))
      end
    end
  end
  if cls and cls.classRuns then
    for _, cr in ipairs(cls.classRuns) do
      if (cr.faction == state.faction or cr.faction == "both") and lvl >= (cr.level - 4) and lvl <= (cr.to + 8) then
        local teachStr = (cr.teaches and cr.teaches ~= "") and (" → 奖励技能: |cff71d5ff[" .. cr.teaches .. "]|r") or ""
        local firstStep = cr.steps and cr.steps[1]
        local npcInfo = firstStep and string.format(" (起始: %s %s %s)", firstStep.zone or "", firstStep.place or "", firstStep.npc or "") or ""
        table.insert(milestoneLines, string.format("  • |cff00ffcc[Lv.%d 职业任务链]|r |cffffd100%s|r%s%s", cr.level, cr.name, teachStr, npcInfo))
      end
    end
  end
  if #milestoneLines > 0 then
    local cMile = AcquireCard(cardIdx); cardIdx = cardIdx + 1
    y = LayoutCard(
      cMile, y,
      "|cff00ff96📌 当前阶段关键里程碑与职业任务|r",
      table.concat(milestoneLines, "\n"),
      { 0.2, 0.8, 0.5, 0.85 },
      { 0.06, 0.12, 0.09, 0.92 }
    )
  end

  -- 6. 当前等级推荐地下城与必接任务
  if #matchedDungeons > 0 then
    local dLines = {}
    for _, d in ipairs(matchedDungeons) do
      local newTag = d.isNew and " |cff00ffcc[★无限服新增副本]|r" or ""
      table.insert(dLines, string.format(
        "🏰 |cffff8000%s|r (Lv.%d–%d · 推荐 %d 级进本 · %s)%s",
        d.name, d.minLevel, d.maxLevel, d.visit or d.minLevel, d.zone or "", newTag
      ))
      local qCount = 0
      for _, q in ipairs(d.quests or {}) do
        if q.faction == "both" or q.faction == state.faction then
          qCount = qCount + 1
          if qCount <= 5 then
            local qc = (q.x and q.y) and string.format(" (%.1f, %.1f)", q.x, q.y) or (q.inside and " (副本内接取)" or "")
            table.insert(dLines, string.format("    └ 任务: |cffffd100[%s]|r (可接 Lv.%d) — %s %s%s", q.name, q.minLevel or d.minLevel, q.zone or "", q.npc or "", qc))
          end
        end
      end
    end
    local cDun = AcquireCard(cardIdx); cardIdx = cardIdx + 1
    y = LayoutCard(
      cDun, y,
      string.format("|cffff8000🏰 适合当前等级 (Lv.%d) 的地下城与任务 (%d个)|r", lvl, #matchedDungeons),
      table.concat(dLines, "\n"),
      { 0.95, 0.55, 0.15, 0.9 },
      { 0.13, 0.08, 0.05, 0.92 }
    )
  end

  HideUnusedCards(cardIdx)
  contentChild:SetHeight(math.max(y + 20, 480))
end

local function RenderTabRoutes()
  local cardIdx = 1
  local y = 6
  local route = GetCurrentRoute()
  if not route or not route.bands then
    HideUnusedCards(1)
    return
  end

  local headerCard = AcquireCard(cardIdx); cardIdx = cardIdx + 1
  y = LayoutCard(
    headerCard, y,
    string.format("|cff00ffcc🗺️ %s (%s) 1–60 级完整升级路线图|r", route.name, route.faction == "horde" and "部落" or "联盟"),
    "以下路线同步自 |cffffd100wowf.io/zh/level-up|r。高亮卡片为您当前等级所在阶段，点击右侧按钮可在聊天框输出/标记导航坐标。",
    { 0.0, 0.8, 0.7, 0.9 },
    { 0.05, 0.13, 0.14, 0.92 },
    string.format("共 %d 个阶段", #route.bands)
  )

  for _, b in ipairs(route.bands) do
    local isCurrent = (state.level >= b.from and state.level <= b.to)
    local hubName = (b.hub and b.hub.name ~= "") and b.hub.name or b.zone
    local coordText = (b.hub and b.hub.x and b.hub.y) and string.format(" (%.1f, %.1f)", b.hub.x, b.hub.y) or ""
    local searchBlob = (b.zone or "") .. " " .. (hubName or "")

    if MatchesSearch(searchBlob) then
      local lines = {
        string.format("|cffffd100驻扎营地/城镇:|r |cff00ffcc%s|r%s", hubName or "主营地", coordText),
      }
      if b.trainer and b.trainer.name ~= "" then
        local tc = (b.trainer.x and b.trainer.y) and string.format(" (%.1f, %.1f)", b.trainer.x, b.trainer.y) or ""
        table.insert(lines, string.format("|cff71d5ff职业训练师:|r %s (%s)%s", b.trainer.name, b.trainer.place or b.zone or "", tc))
      end
      if b.professions and #b.professions > 0 then
        local pNames = {}
        for _, p in ipairs(b.professions) do
          table.insert(pNames, string.format("|cff00ff96[%s]|r %s", p.name, p.trainer or ""))
        end
        table.insert(lines, "|cff00ff96顺路学专业:|r " .. table.concat(pNames, " · "))
      end
      if b.dungeonQuests and #b.dungeonQuests > 0 then
        for _, dq in ipairs(b.dungeonQuests) do
          local dc = (dq.x and dq.y) and string.format(" (%.1f, %.1f)", dq.x, dq.y) or ""
          table.insert(lines, string.format("|cffff8000[副本任务 · %s]|r |cffffd100%s|r — %s %s%s", dq.dungeon, dq.name, dq.place or "", dq.npc or "", dc))
        end
      end

      local card = AcquireCard(cardIdx); cardIdx = cardIdx + 1
      local titlePrefix = isCurrent and "|cff00ff00▶ [当前等级阶段]|r " or ""
      y = LayoutCard(
        card, y,
        string.format("%s|cffffd100Lv.%d – %d|r  ·  |cff00ffcc%s|r (%s)", titlePrefix, b.from, b.to, b.zone or "", hubName or ""),
        table.concat(lines, "\n"),
        isCurrent and { 0.1, 0.95, 0.4, 0.95 } or { 0.25, 0.35, 0.45, 0.85 },
        isCurrent and { 0.06, 0.16, 0.10, 0.95 } or { 0.08, 0.10, 0.14, 0.92 },
        string.format("Lv.%d-%d", b.from, b.to),
        (b.hub and b.hub.x) and "📍 营地坐标" or nil,
        (b.hub and b.hub.x) and function()
          SetWaypointOrPrint(b.zone, b.hub.name, b.hub.x, b.hub.y)
        end or nil
      )
    end
  end

  HideUnusedCards(cardIdx)
  contentChild:SetHeight(math.max(y + 20, 480))
end

local function RenderTabClassAndTalents()
  local cardIdx = 1
  local y = 6
  local cls = GetCurrentClassData()
  local spec = GetCurrentSpecData()
  if not cls or not spec then
    HideUnusedCards(1)
    return
  end

  -- 1. 专精循环各阶段
  for _, p in ipairs(spec.phases or {}) do
    local isCurrent = (state.level >= p.from and state.level <= p.to)
    local textBlob = (p.keep or "") .. " " .. (p.cycle or "") .. " " .. (p.note or "")
    if MatchesSearch(textBlob) then
      local lines = {
        "|cff00ff96【常驻保持】|r " .. (p.keep or "无"),
        "|cffffa500【起手技能】|r " .. (p.open or "无"),
        "|cff71d5ff【核心循环】|r " .. (p.cycle or "无"),
      }
      if p.note and p.note ~= "" then
        table.insert(lines, "\n" .. p.note)
      end
      local card = AcquireCard(cardIdx); cardIdx = cardIdx + 1
      y = LayoutCard(
        card, y,
        string.format("%s|cff71d5ff⚔️ %s·%s 野外循环 (Lv.%d – %d)|r", isCurrent and "|cff00ff00▶ [当前阶段]|r " or "", cls.name, spec.name, p.from, p.to),
        table.concat(lines, "\n"),
        isCurrent and { 0.1, 0.9, 0.5, 0.95 } or { 0.25, 0.45, 0.65, 0.85 },
        isCurrent and { 0.06, 0.15, 0.12, 0.95 } or { 0.07, 0.10, 0.14, 0.92 },
        string.format("Lv.%d-%d", p.from, p.to)
      )
    end
  end

  -- 2. 10-60 级逐级天赋加点表
  if spec.steps and #spec.steps > 0 then
    local stepLines = {}
    for _, s in ipairs(spec.steps) do
      local mark = (s.level == state.level) and "|cff00ff00★ [当前等级]|r " or (s.level < state.level and "|cff888888[已点]|r " or "   ")
      table.insert(stepLines, string.format("%s|cffffd100Lv.%2d:|r [%s] |cff00ffcc%s|r (%d/%d)", mark, s.level, s.tree, s.name, s.rank, s.max))
    end
    local cSteps = AcquireCard(cardIdx); cardIdx = cardIdx + 1
    y = LayoutCard(
      cSteps, y,
      string.format("|cffffd100🌟 %s·%s 10–60 级逐级天赋加点顺序 (共 %d 点)|r", cls.name, spec.name, #spec.steps),
      table.concat(stepLines, "\n"),
      { 0.9, 0.75, 0.2, 0.9 },
      { 0.11, 0.10, 0.06, 0.92 },
      "Lv.10-60 完整路径"
    )
  end

  -- 3. 职业专属任务链
  if cls.classRuns and #cls.classRuns > 0 then
    local crLines = {}
    for _, cr in ipairs(cls.classRuns) do
      local fTag = cr.faction == "horde" and "|cffff5555[部落]|r" or (cr.faction == "alliance" and "|cff44aaff[联盟]|r" or "|cff00ffcc[通用]|r")
      local teachTag = (cr.teaches and cr.teaches ~= "") and (" → 学会 |cff71d5ff[" .. cr.teaches .. "]|r") or ""
      table.insert(crLines, string.format("%s |cffffd100Lv.%d %s|r%s", fTag, cr.level, cr.name, teachTag))
      for idx, st in ipairs(cr.steps or {}) do
        local sc = (st.x and st.y) and string.format(" (%.1f, %.1f)", st.x, st.y) or ""
        table.insert(crLines, string.format("    %d. %s — %s %s |cff99e6ff%s|r%s", idx, st.name, st.zone or "", st.place or "", st.npc or "", sc))
      end
    end
    local cRuns = AcquireCard(cardIdx); cardIdx = cardIdx + 1
    y = LayoutCard(
      cRuns, y,
      string.format("|cff00ffcc📜 %s 专属职业任务链与坐标指引|r", cls.name),
      table.concat(crLines, "\n"),
      { 0.0, 0.8, 0.7, 0.9 },
      { 0.05, 0.12, 0.13, 0.92 }
    )
  end

  HideUnusedCards(cardIdx)
  contentChild:SetHeight(math.max(y + 20, 480))
end

local function RenderTabMacros()
  local cardIdx = 1
  local y = 6
  local cls = GetCurrentClassData()
  local macros = (cls and cls.macros) or {}

  local introCard = AcquireCard(cardIdx); cardIdx = cardIdx + 1
  y = LayoutCard(
    introCard, y,
    string.format("|cff00ffcc📜 %s 实用一键宏命令库 (共 %d 个)|r", cls and cls.name or "", #macros),
    "同步自 |cffffd100wowf.io/zh/macros|r。点击每个宏卡片右上角的 |cff00ff00[⚡ 一键写入宏]|r 按钮，即可直接将该宏创建到您的游戏角色宏槽位中（输入 |cffffd100/macro|r 即可拖入技能栏）；战斗中点击将弹出 Ctrl+C 复制窗口。",
    { 0.0, 0.85, 0.7, 0.9 },
    { 0.05, 0.13, 0.15, 0.92 },
    "支持一键生成"
  )

  for _, m in ipairs(macros) do
    if MatchesSearch((m.title or "") .. " " .. (m.desc or "") .. " " .. (m.code or "")) then
      local newBadge = m.isForeverNew and " |cff00ffcc[★无限服专属]|r" or ""
      local lvlColor = (state.level >= (m.level or 1)) and "|cff00ff00" or "|cffff8800"
      local bodyLines = {
        "|cff99e6ff说明:|r " .. (m.desc or ""),
        "\n|cffffd100宏代码:|r\n|cffaaffaa" .. (m.code or "") .. "|r",
      }
      local card = AcquireCard(cardIdx); cardIdx = cardIdx + 1
      y = LayoutCard(
        card, y,
        string.format("%sLv.%d|r  ·  |cffffd100%s|r%s", lvlColor, m.level or 1, m.title or "宏", newBadge),
        table.concat(bodyLines, "\n"),
        m.isForeverNew and { 0.0, 0.85, 0.7, 0.9 } or { 0.3, 0.45, 0.6, 0.85 },
        { 0.07, 0.09, 0.13, 0.94 },
        nil,
        "⚡ 一键写入宏",
        function()
          CreateOrUpdateGameMacro(m.title, m.code)
        end
      )
    end
  end

  HideUnusedCards(cardIdx)
  contentChild:SetHeight(math.max(y + 20, 480))
end

local function RenderTabDungeons()
  local cardIdx = 1
  local y = 6

  local nextModeLabel = state.dungeonFilter == "MATCH" and "切换: 仅看无限服新本" or (state.dungeonFilter == "NEW" and "切换: 显示全部副本" or "切换: 仅看当前等级")
  local modeTitle = state.dungeonFilter == "MATCH" and string.format("当前筛选: 🎯 适合 Lv.%d 的地下城", state.level)
    or (state.dungeonFilter == "NEW" and "当前筛选: ✨ 无限服新增地下城与团本 (11个)" or "当前筛选: 📚 全部地下城与团本")

  local filterCard = AcquireCard(cardIdx); cardIdx = cardIdx + 1
  y = LayoutCard(
    filterCard, y,
    "|cffff8000🏰 艾泽拉斯地下城与无限服新副本百科 (" .. modeTitle .. ")|r",
    "包含《魔兽世界：无限服》全部 |cff00ffcc9 大全新五人副本|r（领主大厅、洛丹伦废墟、挖掘场：湿地、达拉然城、沉没之城、克罗多克要塞、奥卡兹监狱、黑喉要塞、塑造者之台）与新增团本（深穴、海加尔峰）及所有必接副本任务坐标。点击右上角按钮可切换筛选模式。",
    { 0.95, 0.55, 0.15, 0.9 },
    { 0.13, 0.08, 0.05, 0.92 },
    nil,
    nextModeLabel,
    function()
      if state.dungeonFilter == "MATCH" then
        state.dungeonFilter = "NEW"
      elseif state.dungeonFilter == "NEW" then
        state.dungeonFilter = "ALL"
      else
        state.dungeonFilter = "MATCH"
      end
      RefreshUI()
    end
  )

  for _, d in ipairs(Data.dungeons or {}) do
    local passFilter = true
    if state.dungeonFilter == "MATCH" then
      passFilter = (state.level >= (d.minLevel - 4) and state.level <= (d.maxLevel + 4))
    elseif state.dungeonFilter == "NEW" then
      passFilter = d.isNew and true or false
    end

    if passFilter and MatchesSearch((d.name or "") .. " " .. (d.zone or "") .. " " .. (d.summary or "")) then
      local lines = {}
      if d.summary and d.summary ~= "" then
        table.insert(lines, "|cff99e6ff简介:|r " .. d.summary)
      end
      if d.bosses and #d.bosses > 0 then
        table.insert(lines, "|cffff8000主要首领:|r " .. table.concat(d.bosses, "  ·  "))
      end
      if d.quests and #d.quests > 0 then
        table.insert(lines, "|cffffd100必接副本任务 (" .. #d.quests .. "个):|r")
        for _, q in ipairs(d.quests) do
          local fTag = q.faction == "horde" and "|cffff5555[部落]|r " or (q.faction == "alliance" and "|cff44aaff[联盟]|r " or "")
          local qc = (q.x and q.y) and string.format(" (%.1f, %.1f)", q.x, q.y) or (q.inside and " (副本内触发)" or "")
          local chainTag = (q.stepCount and q.stepCount > 1) and string.format(" [共%d步任务链]", q.stepCount) or ""
          table.insert(lines, string.format("  • %s|cffffd100[%s]|r (可接 Lv.%d)%s — %s %s |cff00ffcc%s|r%s", fTag, q.name, q.minLevel or d.minLevel, chainTag, q.zone or "", q.place or "", q.npc or "", qc))
        end
      end

      local isLevelMatch = (state.level >= d.minLevel and state.level <= d.maxLevel)
      local newBadge = d.isNew and " |cff00ffcc[★无限服新增]|r" or ""
      local matchBadge = isLevelMatch and " |cff00ff00[当前适龄]|r" or ""

      local card = AcquireCard(cardIdx); cardIdx = cardIdx + 1
      y = LayoutCard(
        card, y,
        string.format("|cffff8000%s|r  |cffffd100(Lv.%d–%d · 推荐 %d 级)|r  —  %s%s%s", d.name, d.minLevel, d.maxLevel, d.visit or d.minLevel, d.zone or "", newBadge, matchBadge),
        table.concat(lines, "\n"),
        d.isNew and { 0.0, 0.85, 0.7, 0.9 } or (isLevelMatch and { 0.2, 0.85, 0.4, 0.9 } or { 0.3, 0.35, 0.45, 0.85 }),
        d.isNew and { 0.05, 0.13, 0.14, 0.94 } or { 0.08, 0.10, 0.14, 0.92 },
        string.format("Lv.%d-%d", d.minLevel, d.maxLevel)
      )
    end
  end

  HideUnusedCards(cardIdx)
  contentChild:SetHeight(math.max(y + 20, 480))
end

local function RenderTabForeverAndNews()
  local cardIdx = 1
  local y = 6
  local spec = GetCurrentSpecData()
  local recProfs = (spec and spec.recommendedProfs) or ""

  -- 1. 无限服专属玩法攻略（露营、睡袋、经典旧世之树、物资箱等）
  for _, sys in ipairs(Data.foreverSystems or {}) do
    if MatchesSearch((sys.title or "") .. " " .. (sys.summary or "")) then
      local lines = { sys.summary or "" }
      local firstCoord = nil
      for _, st in ipairs(sys.steps or {}) do
        if st.coord and not firstCoord then
          firstCoord = { zone = st.zone, title = st.title, x = st.coord.x, y = st.coord.y }
        end
        table.insert(lines, string.format("\n|cffffd100%s|r\n%s", st.title or "", st.detail or ""))
      end

      local card = AcquireCard(cardIdx); cardIdx = cardIdx + 1
      y = LayoutCard(
        card, y,
        "|cff00ffcc" .. (sys.title or "") .. "|r",
        table.concat(lines, "\n"),
        { 0.0, 0.85, 0.7, 0.9 },
        { 0.05, 0.12, 0.14, 0.94 },
        sys.category or "无限服特色",
        firstCoord and "📍 发送起始坐标" or nil,
        firstCoord and function()
          SetWaypointOrPrint(firstCoord.zone, firstCoord.title, firstCoord.x, firstCoord.y)
        end or nil
      )
    end
  end

  -- 2. 12 大专业 1-300 冲级与无限服特色指南 (同步自 wowf.io/zh/professions)
  if Data.professions and #Data.professions > 0 then
    for _, prof in ipairs(Data.professions) do
      local searchText = (prof.name or "") .. " " .. (prof.brackets or "") .. " " .. (prof.foreverNote or "")
      if MatchesSearch(searchText) then
        local isRec = (recProfs ~= "" and string.find(recProfs, prof.name or "", 1, true) ~= nil)
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
          table.insert(pLines, "|cffffa500关键训练师与突破:|r " .. prof.trainers)
        end
        if prof.foreverNote and prof.foreverNote ~= "" then
          table.insert(pLines, "|cff00ffcc★ 无限服指南:|r " .. prof.foreverNote)
        end

        local typeLabel = prof.type == "gathering" and "采集专业" or (prof.type == "secondary" and "生活副业" or "制造专业")
        local recTag = isRec and " |cff00ff00[★当前专精推荐]|r" or ""
        local cProf = AcquireCard(cardIdx); cardIdx = cardIdx + 1
        y = LayoutCard(
          cProf, y,
          string.format("|cff00ff96🛠️ 专业指南：%s (1–300)|r%s", prof.name or prof.id, recTag),
          table.concat(pLines, "\n"),
          isRec and { 0.1, 0.9, 0.5, 0.95 } or { 0.25, 0.55, 0.45, 0.85 },
          isRec and { 0.05, 0.15, 0.10, 0.94 } or { 0.06, 0.11, 0.10, 0.92 },
          typeLabel
        )
      end
    end
  end

  -- 3. wowf.io 最新热修公告
  local newsLines = {}
  for _, n in ipairs(Data.news or {}) do
    table.insert(newsLines, string.format("• |cffffd100[%s] %s|r\n  %s", n.date or "", n.title or "", n.summary or ""))
  end
  if #newsLines > 0 then
    local meta = Data.meta or {}
    local cNews = AcquireCard(cardIdx); cardIdx = cardIdx + 1
    y = LayoutCard(
      cNews, y,
      string.format("|cffffa500📰 wowf.io 无限服最新热修与官方公告 (数据版本: %s)|r", meta.updatedAt or "最新"),
      table.concat(newsLines, "\n\n"),
      { 0.9, 0.6, 0.2, 0.9 },
      { 0.12, 0.09, 0.05, 0.94 },
      meta.deployId and string.sub(meta.deployId, 1, 15) or "wowf.io"
    )
  end

  HideUnusedCards(cardIdx)
  contentChild:SetHeight(math.max(y + 20, 480))
end

-- ============================================================================
-- 6. 主窗口构建与顶部状态控制栏
-- ============================================================================

local headerControls = {}

RefreshUI = function()
  if not mainFrame or not mainFrame:IsShown() then return end

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
  if headerControls.autoCheck then
    headerControls.autoCheck:SetChecked(state.autoFollow)
  end

  for i, btn in ipairs(tabButtons) do
    if i == state.activeTab then
      btn:LockHighlight()
    else
      btn:UnlockHighlight()
    end
  end

  if scrollFrame then
    scrollFrame:SetVerticalScroll(0)
  end

  if state.activeTab == 1 then
    RenderTabSmartMatch()
  elseif state.activeTab == 2 then
    RenderTabRoutes()
  elseif state.activeTab == 3 then
    RenderTabClassAndTalents()
  elseif state.activeTab == 4 then
    RenderTabMacros()
  elseif state.activeTab == 5 then
    RenderTabDungeons()
  else
    RenderTabForeverAndNews()
  end
end

local function CreateMainWindow()
  if mainFrame then return mainFrame end

  local template = BackdropTemplateMixin and "BackdropTemplate" or nil
  mainFrame = CreateFrame("Frame", "WoWFMainFrame", UIParent, template)
  mainFrame:SetSize(780, 560)
  mainFrame:SetPoint("CENTER")
  mainFrame:SetFrameStrata("HIGH")
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
  titleText:SetText("|cff00ffccWoWF Companion|r  |cffffd100魔兽世界：无限服 (wowf.io) 游戏内智能动态百科|r")

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

  local autoCheck = CreateFrame("CheckButton", nil, ctrlBar, "UICheckButtonTemplate")
  autoCheck:SetSize(24, 24)
  autoCheck:SetPoint("LEFT", 6, 0)
  autoCheck:SetChecked(state.autoFollow)
  local autoLabel = ctrlBar:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
  autoLabel:SetPoint("LEFT", autoCheck, "RIGHT", 2, 0)
  autoLabel:SetText("|cff00ffcc跟随当前角色|r")
  autoCheck:SetScript("OnClick", function(self)
    state.autoFollow = self:GetChecked() and true or false
    if state.autoFollow then
      SyncPlayerCharacter()
    end
    RefreshUI()
  end)
  headerControls.autoCheck = autoCheck

  -- 等级 -1 / Lv.X / +1
  local lvlMinusBtn = CreateFrame("Button", nil, ctrlBar, "UIPanelButtonTemplate")
  lvlMinusBtn:SetSize(26, 22)
  lvlMinusBtn:SetPoint("LEFT", autoLabel, "RIGHT", 10, 0)
  lvlMinusBtn:SetText("-")
  lvlMinusBtn:SetScript("OnClick", function()
    state.autoFollow = false
    state.level = math.max(1, state.level - 1)
    RefreshUI()
  end)

  local levelBtn = CreateFrame("Button", nil, ctrlBar, "UIPanelButtonTemplate")
  levelBtn:SetSize(56, 22)
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
  headerControls.levelBtn = levelBtn

  local lvlPlusBtn = CreateFrame("Button", nil, ctrlBar, "UIPanelButtonTemplate")
  lvlPlusBtn:SetSize(26, 22)
  lvlPlusBtn:SetPoint("LEFT", levelBtn, "RIGHT", 2, 0)
  lvlPlusBtn:SetText("+")
  lvlPlusBtn:SetScript("OnClick", function()
    state.autoFollow = false
    state.level = math.min(60, state.level + 1)
    RefreshUI()
  end)

  -- 职业切换按钮
  local classBtn = CreateFrame("Button", nil, ctrlBar, "UIPanelButtonTemplate")
  classBtn:SetSize(102, 22)
  classBtn:SetPoint("LEFT", lvlPlusBtn, "RIGHT", 8, 0)
  classBtn:SetScript("OnClick", function()
    state.autoFollow = false
    local idx = 1
    for i, k in ipairs(CLASS_ORDER) do
      if k == state.classKey then idx = i; break end
    end
    idx = (idx % #CLASS_ORDER) + 1
    state.classKey = CLASS_ORDER[idx]
    state.specIndex = 1
    RefreshUI()
  end)
  headerControls.classBtn = classBtn

  -- 专精切换按钮
  local specBtn = CreateFrame("Button", nil, ctrlBar, "UIPanelButtonTemplate")
  specBtn:SetSize(102, 22)
  specBtn:SetPoint("LEFT", classBtn, "RIGHT", 6, 0)
  specBtn:SetScript("OnClick", function()
    state.autoFollow = false
    local cls = GetCurrentClassData()
    local count = (cls and cls.specs and #cls.specs) or 1
    if count > 0 then
      state.specIndex = (state.specIndex % count) + 1
    end
    RefreshUI()
  end)
  headerControls.specBtn = specBtn

  -- 种族路线切换按钮
  local routeBtn = CreateFrame("Button", nil, ctrlBar, "UIPanelButtonTemplate")
  routeBtn:SetSize(124, 22)
  routeBtn:SetPoint("LEFT", specBtn, "RIGHT", 6, 0)
  routeBtn:SetScript("OnClick", function()
    state.autoFollow = false
    local idx = 1
    for i, r in ipairs(ROUTE_ORDER) do
      if r == state.routeId then idx = i; break end
    end
    idx = (idx % #ROUTE_ORDER) + 1
    state.routeId = ROUTE_ORDER[idx]
    local route = GetCurrentRoute()
    if route and route.faction then
      state.faction = route.faction
    end
    RefreshUI()
  end)
  headerControls.routeBtn = routeBtn

  -- 搜索输入框
  local searchBox = CreateFrame("EditBox", nil, ctrlBar, "InputBoxTemplate")
  searchBox:SetSize(128, 20)
  searchBox:SetPoint("RIGHT", ctrlBar, "RIGHT", -10, 0)
  searchBox:SetAutoFocus(false)
  searchBox:SetTextInsets(6, 6, 0, 0)
  searchBox:SetScript("OnTextChanged", function(self)
    state.searchQuery = self:GetText() or ""
    RefreshUI()
  end)
  searchBox:SetScript("OnEscapePressed", function(self)
    self:SetText("")
    self:ClearFocus()
  end)

  -- 六大功能标签栏
  local TAB_DEFS = {
    { id = 1, label = "🎯 智能匹配" },
    { id = 2, label = "🗺️ 升级路线" },
    { id = 3, label = "⚔️ 职业与天赋" },
    { id = 4, label = "📜 一键宏库" },
    { id = 5, label = "🏰 地下城百科" },
    { id = 6, label = "🌟 专业&无限特色" },
  }

  for i, def in ipairs(TAB_DEFS) do
    local btn = CreateFrame("Button", nil, mainFrame, "UIPanelButtonTemplate")
    btn:SetSize(122, 26)
    btn:SetPoint("TOPLEFT", 12 + (i - 1) * 126, -82)
    btn:SetText(def.label)
    btn:SetScript("OnClick", function()
      state.activeTab = def.id
      RefreshUI()
    end)
    tabButtons[i] = btn
  end

  -- 滚动内容区域
  scrollFrame = CreateFrame("ScrollFrame", "WoWFMainScrollFrame", mainFrame, "UIPanelScrollFrameTemplate")
  scrollFrame:SetPoint("TOPLEFT", 12, -114)
  scrollFrame:SetPoint("BOTTOMRIGHT", -32, 12)

  contentChild = CreateFrame("Frame", nil, scrollFrame)
  contentChild:SetSize(720, 500)
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
    GameTooltip:AddLine("|cff00ffccWoWF Companion|r |cffffd100(wowf.io 无限服百科)|r")
    GameTooltip:AddLine(string.format("当前角色: |cffffffffLv.%d|r  ·  推荐区域: |cff00ffcc%s|r", state.level, band and band.zone or "未知"))
    if band and band.hub and band.hub.name ~= "" then
      GameTooltip:AddLine(string.format("驻扎营地: |cffffd100%s|r", band.hub.name))
    end
    if step then
      GameTooltip:AddLine(string.format("本级天赋: |cffffd100[%s] %s (%d/%d)|r", step.tree, step.name, step.rank, step.max))
    end
    GameTooltip:AddLine(" ")
    GameTooltip:AddLine("|cff00ff00左键点击:|r 打开/关闭百科主窗口")
    GameTooltip:AddLine("|cff00ff00右键点击:|r 立即刷新当前角色智能匹配")
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

local hasPrintedWelcome = false

eventFrame:SetScript("OnEvent", function(_, event, arg1)
  if event == "PLAYER_LOGIN" then
    CreateMinimapButton()
    SyncPlayerCharacter()
    RefreshUI()
  elseif event == "PLAYER_ENTERING_WORLD" then
    CreateMinimapButton()
    SyncPlayerCharacter()
    RefreshUI()
    if not hasPrintedWelcome then
      hasPrintedWelcome = true
      DEFAULT_CHAT_FRAME:AddMessage("|cff00ffcc[WoWF 无限百科]|r 已加载 |cffffd100wowf.io|r 动态数据库！输入 |cffffd100/wowf|r 或点击小地图图标查看当前角色智能指南。")
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
    DEFAULT_CHAT_FRAME:AddMessage("|cff00ffcc[WoWF 无限百科]|r " .. table.concat(msgParts, " · ") .. " (输入 /wowf 查看详情)")
    RefreshUI()
  elseif event == "ZONE_CHANGED_NEW_AREA" then
    SyncPlayerCharacter()
    RefreshUI()
  end
end)

SLASH_WOWF1 = "/wowf"
SLASH_WOWF2 = "/wowfio"
SlashCmdList["WOWF"] = function(msg)
  local cmd = string.lower(string.gsub(msg or "", "^%s*(.-)%s*$", "%1"))
  if cmd == "macro" or cmd == "macros" then
    ToggleMainWindow(4)
  elseif cmd == "dungeon" or cmd == "dungeons" then
    ToggleMainWindow(5)
  elseif cmd == "route" or cmd == "level" then
    ToggleMainWindow(2)
  elseif cmd == "class" or cmd == "talent" then
    ToggleMainWindow(3)
  elseif cmd == "news" or cmd == "forever" or cmd == "prof" or cmd == "professions" then
    ToggleMainWindow(6)
  else
    state.autoFollow = true
    ToggleMainWindow(1)
  end
end
`;
}

/**
 * 构建并打包 WoWF Companion 插件压缩包 (public/addons/wowf.zip)
 * @param {string} outputDir
 * @param {string} cacheDir
 * @param {(url: string) => Record<string, string>} getHeaders
 * @returns {Promise<{ zip: JSZip, outPath: string, version: string, source: string }>}
 */
export async function buildWoWFAddon(outputDir, cacheDir, getHeaders) {
  console.log('Synchronizing live data from https://wowf.io/zh for WoWF Companion...');
  const dataset = await buildWoWFDataset(cacheDir, getHeaders);
  const fullVersion = dataset.meta.version || `${WOWF_VERSION} + DB v2026.11.15`;

  const zip = new JSZip();
  const tocContent = generateWoWFToc(fullVersion, dataset.meta.updatedAt);
  const dataLuaContent = generateWoWFDataLua(dataset);
  const coreLuaContent = generateWoWFLua();

  zip.file('WoWF/WoWF.toc', tocContent);
  zip.file('WoWF/Data.lua', dataLuaContent);
  zip.file('WoWF/WoWF.lua', coreLuaContent);

  const outPath = path.join(outputDir, 'wowf.zip');
  const outBuf = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
  fs.writeFileSync(outPath, outBuf);
  console.log(`[✓] wowf.zip generated (${(outBuf.length / 1024).toFixed(1)} KB, version: ${fullVersion}, deployId: ${dataset.meta.deployId})`);

  return {
    zip,
    outPath,
    version: fullVersion,
    source: `https://wowf.io/zh (${dataset.meta.deployId})`,
  };
}
