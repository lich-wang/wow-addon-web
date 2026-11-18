import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import JSZip from 'jszip';

const DEFAULT_DEPLOY_ID = 'deploy-fd0c249c-1794727615234';

function getAutoWowfVersion() {
  try {
    const raw = execFileSync(
      'git',
      ['rev-list', '--count', 'HEAD', '--', 'scripts/locales/wowf.js'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
    const count = Number.parseInt(raw, 10);
    if (Number.isFinite(count) && count > 0) {
      return `v1.2.${count}`;
    }
  } catch {
    // 非 Git 环境下回退到默认版本号
  }
  return 'v1.2.1';
}

const WOWF_VERSION = getAutoWowfVersion();

const CLASS_CONFIGS = [
  { key: 'WARRIOR', slug: 'warrior', name: '战士', color: 'c79c6e', allianceRace: 'human', hordeRace: 'orc' },
  { key: 'PALADIN', slug: 'paladin', name: '圣骑士', color: 'f58cba', allianceRace: 'human', hordeRace: 'undead' },
  { key: 'HUNTER', slug: 'hunter', name: '猎人', color: 'abd473', allianceRace: 'dwarf', hordeRace: 'orc' },
  { key: 'ROGUE', slug: 'rogue', name: '潜行者', color: 'fff569', allianceRace: 'human', hordeRace: 'undead' },
  { key: 'PRIEST', slug: 'priest', name: '牧师', color: 'ffffff', allianceRace: 'human', hordeRace: 'undead' },
  { key: 'SHAMAN', slug: 'shaman', name: '萨满祭司', color: '0070de', allianceRace: 'dwarf', hordeRace: 'orc' },
  { key: 'MAGE', slug: 'mage', name: '法师', color: '69ccf0', allianceRace: 'human', hordeRace: 'undead' },
  { key: 'WARLOCK', slug: 'warlock', name: '术士', color: '9482c9', allianceRace: 'human', hordeRace: 'undead' },
  { key: 'DRUID', slug: 'druid', name: '德鲁伊', color: 'ff7d0a', allianceRace: 'nightelf', hordeRace: 'tauren' },
];

const CLASS_SLUG_TO_KEY = Object.fromEntries(CLASS_CONFIGS.map(c => [c.slug, c.key]));

const RACE_ROUTES = [
  {
    id: 'human',
    apiRaces: ['human'],
    name: '人类',
    faction: 'alliance',
    sampleClass: 'warrior',
    classes: ['warrior', 'paladin', 'hunter', 'rogue', 'priest', 'mage', 'warlock'],
    wowRaceKeys: ['Human'],
  },
  {
    id: 'dwarf',
    apiRaces: ['dwarf'],
    name: '矮人',
    faction: 'alliance',
    sampleClass: 'warrior',
    classes: ['warrior', 'paladin', 'hunter', 'rogue', 'priest', 'shaman'],
    wowRaceKeys: ['Dwarf'],
  },
  {
    id: 'night-elf',
    apiRaces: ['nightelf', 'night_elf', 'night-elf'],
    name: '暗夜精灵',
    faction: 'alliance',
    sampleClass: 'warrior',
    classes: ['warrior', 'hunter', 'rogue', 'priest', 'druid'],
    wowRaceKeys: ['NightElf'],
  },
  {
    id: 'gnome',
    apiRaces: ['gnome'],
    name: '侏儒',
    faction: 'alliance',
    sampleClass: 'warrior',
    classes: ['warrior', 'rogue', 'priest', 'mage', 'warlock'],
    wowRaceKeys: ['Gnome'],
  },
  {
    id: 'skyborne-alliance',
    apiRaces: ['skyborne', 'highelf', 'skyborne_alliance'],
    name: '天裔 (联盟)',
    faction: 'alliance',
    sampleClass: 'warrior',
    classes: ['warrior', 'hunter', 'rogue', 'druid', 'mage'],
    wowRaceKeys: ['Skyborne', 'HighElf'],
  },
  {
    id: 'orc',
    apiRaces: ['orc'],
    name: '兽人',
    faction: 'horde',
    sampleClass: 'warrior',
    classes: ['warrior', 'hunter', 'rogue', 'shaman', 'mage', 'warlock'],
    wowRaceKeys: ['Orc'],
  },
  {
    id: 'undead',
    apiRaces: ['undead', 'scourge'],
    name: '亡灵',
    faction: 'horde',
    sampleClass: 'warrior',
    classes: ['warrior', 'paladin', 'rogue', 'priest', 'mage', 'warlock'],
    wowRaceKeys: ['Scourge', 'Undead'],
  },
  {
    id: 'tauren',
    apiRaces: ['tauren'],
    name: '牛头人',
    faction: 'horde',
    sampleClass: 'warrior',
    classes: ['warrior', 'hunter', 'shaman', 'druid'],
    wowRaceKeys: ['Tauren'],
  },
  {
    id: 'troll',
    apiRaces: ['troll'],
    name: '巨魔',
    faction: 'horde',
    sampleClass: 'warrior',
    classes: ['warrior', 'hunter', 'rogue', 'priest', 'shaman', 'mage', 'warlock'],
    wowRaceKeys: ['Troll'],
  },
  {
    id: 'skyborne-horde',
    apiRaces: ['skyborne', 'windshaper', 'skyborne_horde'],
    name: '天裔 (部落)',
    faction: 'horde',
    sampleClass: 'warrior',
    classes: ['warrior', 'hunter', 'rogue', 'druid', 'shaman'],
    wowRaceKeys: ['Skyborne', 'Windshaper'],
  },
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

const DUNGEON_ENTRANCE_COORDS = {
  'hall-of-thanes': { zone: '铁炉堡', x: 28.2, y: 47.7 },
  'ragefire-chasm': { zone: '奥格瑞玛', x: 51.5, y: 49.7 },
  'ruins-of-lordaeron': { zone: '提瑞斯法林地', x: 65.0, y: 70.0 },
  deadmines: { zone: '西部荒野', x: 42.5, y: 71.7 },
  'wailing-caverns': { zone: '贫瘠之地', x: 46.0, y: 36.4 },
  'shadowfang-keep': { zone: '银松森林', x: 44.8, y: 67.8 },
  'blackfathom-deeps': { zone: '灰谷', x: 14.1, y: 13.1 },
  stockade: { zone: '暴风城', x: 50.4, y: 66.4 },
  'excavation-site': { zone: '湿地', x: 47.8, y: 56.3 },
  dalaran: { zone: '奥特兰克山脉', x: 15.0, y: 61.2 },
  'razorfen-kraul': { zone: '贫瘠之地', x: 41.8, y: 89.4 },
  gnomeregan: { zone: '丹莫罗', x: 24.4, y: 39.8 },
  'scarlet-monastery-graveyard': { zone: '提瑞斯法林地', x: 85.2, y: 32.1 },
  'scarlet-monastery-library': { zone: '提瑞斯法林地', x: 85.2, y: 32.1 },
  'drowned-city': { zone: '荆棘谷', x: 21.5, y: 27.7 },
  'scarlet-monastery-armory': { zone: '提瑞斯法林地', x: 85.2, y: 32.1 },
  'razorfen-downs': { zone: '贫瘠之地', x: 49.1, y: 93.4 },
  'scarlet-monastery-cathedral': { zone: '提瑞斯法林地', x: 85.2, y: 32.1 },
  'kroldok-stronghold': { zone: '河林', x: 48.6, y: 26.3 },
  uldaman: { zone: '荒芜之地', x: 44.6, y: 12.1 },
  'zul-farrak': { zone: '塔纳利斯', x: 38.7, y: 20.0 },
  'alcaz-prison': { zone: '尘泥沼泽', x: 76.0, y: 17.5 },
  maraudon: { zone: '凄凉之地', x: 29.1, y: 62.5 },
  'sunken-temple': { zone: '悲伤沼泽', x: 69.5, y: 52.5 },
  'blackmaw-hold': { zone: '艾萨拉', x: 38.5, y: 32.0 },
  'dire-maul-east': { zone: '菲拉斯', x: 64.8, y: 30.2 },
  'blackrock-depths': { zone: '灼热峡谷', x: 45.6, y: 89.4 },
  'lower-blackrock-spire': { zone: '燃烧平原', x: 33.0, y: 25.2 },
  'shapers-terrace': { zone: '安戈洛环形山', x: 50.5, y: 7.8 },
  'dire-maul-west': { zone: '菲拉斯', x: 60.3, y: 30.2 },
  scholomance: { zone: '西瘟疫之地', x: 68.9, y: 72.8 },
  'dire-maul-north': { zone: '菲拉斯', x: 62.5, y: 24.9 },
  'stratholme-main-gate': { zone: '东瘟疫之地', x: 27.1, y: 10.7 },
  'stratholme-service-gate': { zone: '东瘟疫之地', x: 43.5, y: 19.4 },
  'the-deep-caverns': { zone: '灼热峡谷', x: 45.6, y: 89.4 },
  'mount-hyjal': { zone: '海加尔山', x: 68.6, y: 44.1 },
  'upper-blackrock-spire': { zone: '燃烧平原', x: 33.0, y: 25.2 },
};

const FOREVER_SYSTEMS_DATA = [
  {
    id: 'sleeping-bag',
    category: '露营与睡袋',
    minLevel: 14,
    title: '★ 舒适的睡袋（+8% 经验值常驻 Buff）与学生口粮四步任务链',
    summary: '无限服 14 级必做第一神器！跑完 4 步不仅送大量【学生口粮】（使用立刻恢复双倍休息经验池），最终奖励【舒适的睡袋】（睡满 3 分钟获得 +8% 经验值加成，持续 2 小时，死亡不消失）！',
    steps: [
      {
        step: 1,
        questId: 79191,
        questName: '摸石过河 (一)',
        questLevel: 14,
        zone: '西部荒野',
        coord: { x: 37.6, y: 50.7 },
        altCoord: { zone: '贫瘠之地', x: 49.1, y: 56.3 },
        title: '第一步：西部荒野焦痕残骸 (37.6, 50.7) / 或贫瘠之地 (49.1, 56.3)',
        detail: '联盟推荐从西部荒野 (37.6, 50.7) 农场旁烧毁的帐篷残骸接取；部落推荐从贫瘠之地 (49.1, 56.3) 接取，随后将两处残骸全部互动交接。',
      },
      {
        step: 2,
        questId: 79192,
        questName: '摸石过河 (二)',
        questLevel: 14,
        zone: '贫瘠之地',
        coord: { x: 49.1, y: 56.3 },
        title: '第二步：前往南贫瘠之地烧毁的马车 (49.1, 56.3)',
        detail: '在十字路口往南沿大路走到陶祖拉营地北侧的焦黑树旁，点击箱子完成交互，获得第一批【学生口粮】。',
      },
      {
        step: 3,
        questId: 79980,
        questName: '紧急攀爬',
        questLevel: 14,
        zone: '石爪山脉',
        coord: { x: 39.7, y: 50.0 },
        altCoord: { zone: '石爪山脉', x: 50.8, y: 52.7 },
        title: '第三步：石爪山脉营地小径与被遗弃的背包 (39.7, 50.0 → 50.8, 52.7)',
        detail: '从贫瘠之地进入石爪山脉，在 (39.7, 50.0) 接取下一步，随后前往 (50.8, 52.7) 乱风崖附近的巨石堆上点击背包。',
      },
      {
        step: 4,
        questId: 79975,
        questName: '鹰之拳',
        questLevel: 14,
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
    title: '★ 制皮营地帐篷与副本掉落四大营地器械蓝图',
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
    minLevel: 1,
    title: '★ 经典旧世专长（传承点数 Legacy 天赋树 · 单角色上限 16 点）',
    summary: '账号下每个职业首次达到 25、45、60 级及非采集类主专业达到对应熟练度/完成探索挑战均可解锁【经典旧世点数】（账号累计上限 65 点，并设 15、25、40、55 点累计奖励里程碑；单角色同时最多可分配 16 点），所有小号 1 级即可享受全套加成！',
    steps: [
      {
        step: 1,
        zone: '经典旧世树 · 冒险分支',
        title: '[冒险] 冒险树（练级首选推荐优先点满）',
        detail: '提供休息经验加成、战斗后恢复、高度警戒、露营设施冷却缩减、绷带虚弱时间减免、天赋点解锁以及飞行路径加速。',
      },
      {
        step: 2,
        zone: '经典旧世树 · 专业分支',
        title: '[专业] 专业树（双采与制造业神技）',
        detail: '解锁【同时开启矿物与草药双追踪】、采集与制造读条加速、采集额外暴击产出以及制造技能点数额外加成。',
      },
      {
        step: 3,
        zone: '经典旧世树 · 充裕分支',
        title: '[充裕] 充裕树（声望、金币与背包减负）',
        detail: '提供阵营声望获取加成、任务金币与怪物掉落银币提升、邮寄瞬间到达以及里程碑专属战袍与传家宝级外观奖励。',
      },
    ],
  },
  {
    id: 'supply-crates',
    category: '物资与声望',
    minLevel: 10,
    title: '★ 遭劫的板条箱（艾泽拉斯贸易局 / 杜隆塔尔补给后勤部）',
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
 * 从任务对象中提取真实魔兽世界任务 ID (questId)
 * 优先取与当前步骤名对应的 href (/quests/ID)，其次取数值 id 或首个子步骤 id
 * @param {object | undefined} q
 * @returns {number | null}
 */
function extractQuestId(q) {
  if (!q || typeof q !== 'object') return null;
  const hrefMatch = String(q.href || '').match(/\/quests\/(\d+)/);
  if (hrefMatch) return Number(hrefMatch[1]);
  if (typeof q.id === 'number' && q.id > 0) return q.id;
  if (Array.isArray(q.steps) && q.steps[0]) {
    return extractQuestId(q.steps[0]);
  }
  return null;
}

/**
 * 将 wowf.io API 的富文本片段数组转换为魔兽世界原生颜色转义与超链接字符串
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
      const rawName = seg.name || (seg.tip && seg.tip.name) || '';
      if (!rawName) continue;
      const name = WOWF_EN_TO_ZH[rawName] || rawName;
      if (seg.kind === 'spell') {
        out += `|cff71d5ff[${name}]|r`;
      } else if (seg.kind === 'talent') {
        out += `|cffffd100[${name}]|r`;
      } else if (seg.kind === 'item') {
        const q = seg.quality || 2;
        const qColor = q === 4 ? 'a335ee' : q === 3 ? '0070dd' : q === 2 ? '1eff00' : 'ffffff';
        if (seg.itemId) {
          out += `|cff${qColor}|Hitem:${seg.itemId}:0:0:0:0:0:0:0|h[${name}]|h|r`;
        } else {
          out += `|cff${qColor}[${name}]|r`;
        }
      } else if (seg.kind === 'quest') {
        const qid = extractQuestId(seg);
        out += qid ? `|cffffff00|Hquest:${qid}:1|h[${name}]|h|r` : `|cffffff00[${name}]|r`;
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
 * 精简并转换阶段内的关键任务/职业起始任务
 */
function transformBandQuests(quests, fallbackLevel, defaultZone = '') {
  if (!Array.isArray(quests)) return [];
  return quests.slice(0, 8).map(q => {
    const g = Array.isArray(q.givers) && q.givers[0] ? q.givers[0] : null;
    const id = extractQuestId(q);
    const steps =
      Array.isArray(q.steps) && q.steps.length > 1
        ? q.steps.map(st => {
            const sg = Array.isArray(st.givers) && st.givers[0] ? st.givers[0] : null;
            const stId = extractQuestId(st);
            return {
              id: stId,
              name: st.name || q.name || '',
              level: st.level || st.minLevel || q.level || fallbackLevel || 1,
              npc: sg?.name || '',
              zone: sg?.zone || (stId !== id || sg?.at?.x != null ? defaultZone : '') || '',
              place: sg?.place || '',
              x: sg?.at?.x ?? null,
              y: sg?.at?.y ?? null,
            };
          })
        : undefined;
    return {
      id,
      name: q.name || '',
      level: q.level || q.minLevel || fallbackLevel || 1,
      minLevel: q.minLevel || fallbackLevel || 1,
      kind: q.kind || 'quest',
      npc: g?.name || '',
      zone: g?.zone || defaultZone || '',
      place: g?.place || g?.zone || '',
      x: g?.at?.x ?? null,
      y: g?.at?.y ?? null,
      stepCount: Array.isArray(q.steps) ? q.steps.length : 1,
      steps,
    };
  });
}

/**
 * 精简并转换单个升级阶段 band
 */
function transformBand(b, classKey = 'WARRIOR') {
  const hub = b.hub
    ? {
        name: b.hub.name || '',
        zone: b.hub.zone || b.zone || '',
        x: b.hub.at?.x ?? null,
        y: b.hub.at?.y ?? null,
      }
    : null;

  const hubs = Array.isArray(b.hubs)
    ? b.hubs.slice(0, 6).map(h => ({
        from: h.from || b.from || 1,
        to: h.to || b.to || 60,
        name: h.name || '',
        x: h.at?.x ?? null,
        y: h.at?.y ?? null,
      }))
    : [];

  const flights = Array.isArray(b.flights)
    ? b.flights.slice(0, 4).map(f => ({
        name: f.name || '',
        zone: f.zone || b.zone || '',
        place: f.place || f.zone || '',
        x: f.at?.x ?? null,
        y: f.at?.y ?? null,
      }))
    : [];

  const trainer = b.trainer
    ? {
        name: b.trainer.name || '',
        title: b.trainer.title || '职业训练师',
        zone: b.trainer.zone || b.zone || '',
        place: b.trainer.place || b.trainer.zone || '',
        x: b.trainer.at?.x ?? null,
        y: b.trainer.at?.y ?? null,
      }
    : null;

  const trainersByClass = {};
  if (trainer && classKey) {
    trainersByClass[classKey] = trainer;
  }

  const allQuests = transformBandQuests(b.quests, b.from || 1, b.zone || '');
  const quests = allQuests.filter(q => q.kind !== 'class');
  const questsByClass = {};
  if (allQuests.length > 0 && classKey) {
    questsByClass[classKey] = allQuests;
  }

  const professions = Array.isArray(b.professions)
    ? b.professions.slice(0, 6).map(p => {
        const firstTrainer = Array.isArray(p.trainers) && p.trainers[0] ? p.trainers[0] : null;
        return {
          id: p.id || '',
          name: PROF_NAMES_ZH[p.id] || p.id || '专业',
          trainer: firstTrainer?.name || '',
          zone: firstTrainer?.zone || b.zone || '',
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
          id: extractQuestId(dq),
          dungeon: dq.dungeon || '',
          name: dq.name || '',
          level: dq.level || dq.minLevel || b.from,
          minLevel: dq.minLevel || b.from,
          npc: g?.name || '',
          zone: g?.zone || b.zone || '',
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
    hubs,
    flights,
    trainer,
    trainersByClass,
    quests,
    questsByClass,
    professions,
    dungeonQuests,
  };
}

/**
 * 同等级区间平行/备选练级区域目录（解决单图任务不足以支撑整个等级段的问题）
 */
const ALT_ZONE_CATALOG = {
  alliance: [
    { zone: '艾尔文森林', hub: '闪金镇', from: 5, to: 11, x: 42.4, y: 66.0, note: '人类经典起始区，迪菲亚/霍格任务线' },
    { zone: '丹莫罗', hub: '卡拉诺斯', from: 5, to: 11, x: 46.3, y: 51.7, note: '矮人/侏儒起始区，任务紧凑' },
    { zone: '泰达希尔', hub: '多兰纳尔', from: 5, to: 11, x: 55.9, y: 58.2, note: '暗夜精灵起始区，自然与熊怪任务' },
    { zone: '西部荒野', hub: '哨兵岭', from: 12, to: 19, x: 55.9, y: 48.7, note: '迪菲亚兄弟会主线，直通死亡矿井(Lv.15-20)' },
    { zone: '洛克莫丹', hub: '塞尔萨玛', from: 12, to: 19, x: 35.1, y: 48.1, note: '莫格罗什要塞与矮人狩猎任务密集' },
    { zone: '黑海岸', hub: '奥伯丁', from: 11, to: 20, x: 36.3, y: 45.6, note: '海岸线一条龙，任务数量极多可轻松升到20级' },
    { zone: '赤脊山', hub: '湖畔镇', from: 16, to: 25, x: 23.9, y: 47.0, note: '黑石兽人主线与湖畔镇精英任务' },
    { zone: '湿地', hub: '米奈希尔港', from: 20, to: 28, x: 9.5, y: 59.7, note: '港口/黑铁矮人任务，衔接新本【挖掘场：湿地】' },
    { zone: '灰谷', hub: '阿斯特兰纳', from: 19, to: 28, x: 34.4, y: 48.0, note: '卡利姆多主力练级区，衔接黑暗深渊(Lv.20-27)' },
    { zone: '暮色森林', hub: '夜色镇', from: 21, to: 31, x: 75.2, y: 46.8, note: '摩拉迪姆、斯塔文与藏尸者经典长任务链' },
    { zone: '石爪山脉', hub: '石爪峰', from: 20, to: 27, x: 36.4, y: 7.2, note: '风剪废墟与焦炭谷补给任务' },
    { zone: '希尔斯布莱德丘陵', hub: '南海镇', from: 24, to: 32, x: 49.3, y: 52.3, note: '南海镇渔人/辛迪加任务，海龟肉与通缉令' },
    { zone: '凄凉之地', hub: '尼耶尔前哨站', from: 32, to: 37, x: 66.5, y: 10.7, note: '半人马声望、科多兽墓地与玛拉顿前置' },
    { zone: '荆棘谷', hub: '反抗军营地', from: 30, to: 38, x: 38.2, y: 4.0, note: '北部奈辛瓦里狩猎+反抗军营地，30-38必刷' },
    { zone: '千针石林', hub: '沙漠赛道', from: 30, to: 37, x: 78.8, y: 77.1, note: '闪光平原赛车场一圈十余个任务，经验极集中' },
    { zone: '阿拉希高地', hub: '避难谷地', from: 30, to: 39, x: 45.7, y: 46.1, note: '激流堡与高地元素/迅猛龙任务，顺路开鸟点' },
    { zone: '尘泥沼泽', hub: '塞拉摩', from: 35, to: 42, x: 67.5, y: 51.3, note: '35级起可接大量港口与沼泽任务，经验丰厚' },
    { zone: '河林', hub: '克罗多克要塞', from: 32, to: 45, x: 48.6, y: 26.3, note: '无限服新大区，任务密集且含40-45五人本' },
    { zone: '荒芜之地', hub: '埃格蒙德的营地', from: 38, to: 41, x: 51.3, y: 73.3, note: '奥达曼前置、土元素与龙类任务' },
    { zone: '荆棘谷', hub: '藏宝海湾', from: 38, to: 46, x: 27.4, y: 76.7, note: '海盗、血帆、风险投资公司与狩猎大师后续' },
    { zone: '悲伤沼泽', hub: '斯通纳德周边', from: 36, to: 43, x: 46.1, y: 54.8, note: '流放者与沉没的神庙前置任务' },
    { zone: '辛特兰', hub: '鹰巢山', from: 42, to: 48, x: 11.1, y: 46.0, note: '狮鹫、巨魔与绿龙神庙前置任务' },
    { zone: '菲拉斯', hub: '羽月要塞', from: 42, to: 49, x: 30.2, y: 43.2, note: '雪人、娜迦、戈杜尼食人魔与厄运之槌外围' },
    { zone: '塔纳利斯', hub: '加基森', from: 43, to: 51, x: 51.7, y: 27.4, note: '热砂港海盗、祖尔法拉克副本任务与沙漠虫巢' },
    { zone: '灼热峡谷', hub: '瑟银哨塔', from: 46, to: 53, x: 37.9, y: 30.9, note: '黑铁矮人与瑟银兄弟会任务链，顺接黑石深渊' },
    { zone: '艾萨拉', hub: '塔伦迪斯营地', from: 47, to: 54, x: 11.9, y: 77.6, note: '娜迦、血精灵与海达克西斯公爵声望' },
    { zone: '费伍德森林', hub: '翡翠圣地', from: 48, to: 55, x: 51.5, y: 82.2, note: '木喉要塞声望、腐化元素与恶魔清剿' },
    { zone: '安戈洛环形山', hub: '马绍尔营地', from: 50, to: 55, x: 44.3, y: 8.3, note: '一圈接满20+任务，效率极高的50级圣地' },
    { zone: '诅咒之地', hub: '守望堡', from: 49, to: 56, x: 65.5, y: 24.4, note: '野生野兽属性Buff任务与黑暗之门外围' },
    { zone: '燃烧平原', hub: '摩根的岗哨', from: 53, to: 60, x: 84.3, y: 68.3, note: '黑石山双本(黑石塔/黑石深渊)前置与黑龙门任务' },
    { zone: '西瘟疫之地', hub: '寒风营地', from: 54, to: 60, x: 42.9, y: 83.8, note: '瘟疫锅、通灵学院前置与弗丁任务线' },
    { zone: '东瘟疫之地', hub: '圣光之愿礼拜堂', from: 55, to: 60, x: 71.5, y: 49.2, note: '银色黎明声望、爱与家庭、斯坦索姆前置' },
    { zone: '冬泉谷', hub: '永望镇', from: 54, to: 60, x: 61.3, y: 38.6, note: '霜刃豹、熊怪、蓝龙与55+高收益任务' },
    { zone: '希利苏斯', hub: '塞纳里奥要塞', from: 55, to: 60, x: 51.2, y: 38.2, note: '塞纳里奥议会声望与暮光营地任务' },
    { zone: '海加尔山', hub: '海加尔山', from: 55, to: 60, x: 68.6, y: 44.1, note: '无限服开放的高阶练级区与20人团本【海加尔峰】' },
  ],
  horde: [
    { zone: '杜隆塔尔', hub: '剃刀岭', from: 5, to: 11, x: 51.6, y: 43.4, note: '兽人/巨魔起始区，怒焰裂谷前置' },
    { zone: '提瑞斯法林地', hub: '布瑞尔', from: 5, to: 11, x: 60.0, y: 51.6, note: '亡灵起始区，血色修道院方向' },
    { zone: '莫高雷', hub: '血蹄村', from: 5, to: 11, x: 46.9, y: 63.2, note: '牛头人起始区，草原狩猎任务' },
    { zone: '贫瘠之地', hub: '十字路口', from: 12, to: 22, x: 51.8, y: 30.9, note: '部落核心大地图，任务极多且直通哀嚎洞穴' },
    { zone: '银松森林', hub: '瑟伯切尔', from: 12, to: 20, x: 43.2, y: 40.9, note: '影牙城堡前置与被遗忘者任务线' },
    { zone: '石爪山脉', hub: '烈日石居', from: 15, to: 26, x: 45.1, y: 59.8, note: '紧邻贫瘠之地，焦炭谷与伐木场任务密集' },
    { zone: '贫瘠之地', hub: '陶拉祖营地', from: 18, to: 25, x: 44.4, y: 59.2, note: '贫瘠之地南部野猪人/雷霆蜥蜴，直通剃刀沼泽' },
    { zone: '灰谷', hub: '佐拉姆加前哨站', from: 19, to: 26, x: 12.2, y: 33.8, note: '海岸线娜迦与黑暗深渊副本任务' },
    { zone: '灰谷', hub: '碎木岗哨', from: 24, to: 30, x: 73.2, y: 61.6, note: '碎木岗哨伐木场与萨特清剿' },
    { zone: '希尔斯布莱德丘陵', hub: '塔伦米尔', from: 22, to: 31, x: 62.1, y: 19.9, note: '东部王国部落主力，奥特兰克雪人与血色前置' },
    { zone: '千针石林', hub: '乱风岗', from: 25, to: 32, x: 45.1, y: 49.1, note: '部落专属风巢/半人马任务，直通闪光平原' },
    { zone: '千针石林', hub: '沙漠赛道', from: 30, to: 37, x: 78.8, y: 77.1, note: '闪光平原赛车场一圈十余个任务，经验极集中' },
    { zone: '荆棘谷', hub: '格罗姆高营地', from: 31, to: 40, x: 32.5, y: 29.4, note: '格罗姆高+奈辛瓦里狩猎，任务密度全服最高' },
    { zone: '阿拉希高地', hub: '落锤镇', from: 30, to: 39, x: 73.0, y: 32.7, note: '激流堡、枯须巨魔与高地要素任务' },
    { zone: '凄凉之地', hub: '葬影村', from: 32, to: 38, x: 21.6, y: 74.1, note: '半人马声望、科多兽与玛拉顿前置' },
    { zone: '尘泥沼泽', hub: '蕨墙村', from: 35, to: 42, x: 35.6, y: 31.9, note: '35级起可接蕨墙村大量沼泽与龙类任务' },
    { zone: '河林', hub: '克罗多克要塞', from: 32, to: 45, x: 48.6, y: 26.3, note: '无限服新大区，任务密集且含40-45五人本' },
    { zone: '荒芜之地', hub: '卡加斯', from: 38, to: 42, x: 5.1, y: 46.8, note: '奥达曼前置、卡加斯大量任务与石元素' },
    { zone: '悲伤沼泽', hub: '斯通纳德', from: 36, to: 43, x: 46.1, y: 54.8, note: '斯通纳德部落营地+沉没的神庙前置' },
    { zone: '荆棘谷', hub: '藏宝海湾', from: 38, to: 46, x: 27.4, y: 76.7, note: '藏宝海湾全套高经验任务与风险投资公司' },
    { zone: '辛特兰', hub: '恶齿村', from: 42, to: 49, x: 81.7, y: 81.8, note: '恶齿村部落营地、巨魔与辛萨罗精英任务' },
    { zone: '菲拉斯', hub: '莫沙彻营地', from: 44, to: 50, x: 75.1, y: 43.1, note: '戈杜尼食人魔、雪人与厄运之槌外围' },
    { zone: '塔纳利斯', hub: '加基森', from: 44, to: 52, x: 51.6, y: 25.4, note: '热砂港海盗、祖尔法拉克副本任务与沙漠虫巢' },
    { zone: '灼热峡谷', hub: '瑟银哨塔', from: 46, to: 53, x: 37.9, y: 30.9, note: '黑铁矮人与瑟银兄弟会任务链，顺接黑石深渊' },
    { zone: '艾萨拉', hub: '瓦罗莫克', from: 47, to: 54, x: 22.0, y: 49.6, note: '娜迦、血精灵与海达克西斯公爵声望' },
    { zone: '费伍德森林', hub: '血毒河', from: 48, to: 55, x: 34.4, y: 54.0, note: '木喉要塞声望、腐化元素与恶魔清剿' },
    { zone: '安戈洛环形山', hub: '马绍尔营地', from: 50, to: 55, x: 44.3, y: 8.3, note: '一圈接满20+任务，效率极高的50级圣地' },
    { zone: '燃烧平原', hub: '烈焰峰', from: 53, to: 60, x: 65.7, y: 24.2, note: '黑石山双本(黑石塔/黑石深渊)前置与黑龙门任务' },
    { zone: '提瑞斯法林地', hub: '亡灵壁垒', from: 54, to: 59, x: 83.2, y: 69.2, note: '瘟疫锅、通灵学院前置与弗丁任务线' },
    { zone: '东瘟疫之地', hub: '圣光之愿礼拜堂', from: 55, to: 60, x: 70.5, y: 47.6, note: '银色黎明声望、爱与家庭、斯坦索姆前置' },
    { zone: '冬泉谷', hub: '永望镇', from: 54, to: 60, x: 61.3, y: 38.6, note: '霜刃豹、熊怪、蓝龙与55+高收益任务' },
    { zone: '希利苏斯', hub: '塞纳里奥要塞', from: 55, to: 60, x: 51.2, y: 38.2, note: '塞纳里奥议会声望与暮光营地任务' },
    { zone: '海加尔山', hub: '海加尔山', from: 55, to: 60, x: 68.6, y: 44.1, note: '无限服开放的高阶练级区与20人团本【海加尔峰】' },
  ],
};

/**
 * 为所有路线的每个等级阶段自动补全同级备选/平行练级区域 (altZones)
 */
function enrichRoutesWithAltZones(routesData) {
  if (!routesData || typeof routesData !== 'object') return;
  for (const route of Object.values(routesData)) {
    if (!route || !Array.isArray(route.bands)) continue;
    const faction = route.faction === 'horde' ? 'horde' : 'alliance';
    const catalog = ALT_ZONE_CATALOG[faction] || [];
    for (const band of route.bands) {
      const bFrom = Number(band.from) || 1;
      const bTo = Number(band.to) || bFrom;
      if (bTo <= 5) {
        band.altZones = [];
        continue;
      }
      const primaryZone = String(band.zone || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
      const scored = [];
      for (const az of catalog) {
        if (az.zone === primaryZone) continue;
        const overlapStart = Math.max(bFrom, az.from);
        const overlapEnd = Math.min(bTo, az.to);
        const overlap = overlapEnd - overlapStart + 1;
        if (overlap < 2 && !(bFrom === bTo && az.from <= bFrom && az.to >= bTo)) continue;
        scored.push({ az, overlap });
      }
      scored.sort((a, b) => b.overlap - a.overlap || a.az.from - b.az.from);
      const seenZones = new Set();
      const picked = [];
      for (const item of scored) {
        if (seenZones.has(item.az.zone)) continue;
        seenZones.add(item.az.zone);
        picked.push({
          zone: item.az.zone,
          hub: item.az.hub,
          from: item.az.from,
          to: item.az.to,
          x: item.az.x,
          y: item.az.y,
          note: item.az.note,
        });
        if (picked.length >= 5) break;
      }
      band.altZones = picked;
    }
  }
}

/**
 * 补全上游 API 未翻译的英文 NPC、飞行管理员、副本任务与 40 级骑术文案
 */
const WOWF_EN_TO_ZH = {
  // 飞行管理员
  Daelyshia: '达莉希亚',
  Baldruc: '巴尔德鲁克',
  'Bera Stonehammer': '贝拉·石锤',
  'Bibilfaz Featherwhistle': '比比法兹·羽哨',
  Bragok: '布拉高克',
  Brakkar: '布拉卡',
  'Bulkrek Ragefist': '布尔克雷克·怒拳',
  'Caylais Moonfeather': '凯莱斯·月羽',
  Devrak: '德弗拉克',
  'Fyldren Moonfeather': '菲尔德伦·月羽',
  Georgia: '乔治亚',
  Gryfe: '格莱夫',
  Jarrodenus: '加罗迪努斯',
  'Khaelyn Steelwing': '凯琳·钢翼',
  'Michael Garrett': '迈克尔·加勒特',
  Nyse: '奈斯',
  'Omusa Thunderhorn': '欧姆萨·雷角',
  Shardi: '沙尔迪',
  Shyn: '希恩',
  Thalon: '萨隆',
  Thyssiana: '赛希亚娜',
  Vahgruk: '瓦格鲁克',
  Vesprystus: '维斯普里斯图斯',
  Vhulgra: '乌尔格拉',
  // 任务名与指引文本
  'A Bit of Wet Work': '涉水行动',
  'A Little Payback': '小小的报复',
  'A Lost Memento': '失落的纪念品',
  'A Token of Vengeance': '复仇的信物',
  "An'she's Radiance": '安瑟之光',
  'Ancient Equine Spirit': '远古圣马之魂',
  'Battered Dwarven Skeleton': '残破的矮人骷髅',
  'Blackmaw Pouches': '黑喉皮袋',
  'Blood Red Bandanas': '血红面罩',
  'Brazier of Everfount': '永泉火盆',
  'Brazier of the Dormant Flame': '沉睡之焰火盆',
  'Call of Air': '空气的召唤',
  'Call of Fire': '火焰的召唤',
  'Crumpled Map': '揉皱的地图',
  'Crystalline Elements': '晶化元素',
  'Curios of Curiosity': '奇珍异宝',
  'Elemental Aid': '元素之助',
  'Enter the Alcaz Prison and find Commander Folkar.': '进入奥卡兹监狱并找到指挥官福尔卡。',
  'Eye of Mugg': '穆格之眼',
  'Eyes on the Sky': '仰望苍穹',
  'Fragment of the Firelands': '火焰之地碎片',
  'Get to the Roots of It': '追根溯源',
  'Heed My Call': '响应我的召唤',
  'Key Ingredients': '关键原料',
  "Krol'dok Moulding": '克罗多克模具',
  'Lingering Essence': '残留精华',
  'More Valuable Than Gold': '比黄金更珍贵',
  'No Orc Left Behind': '不抛弃任何兽人',
  'Our Man in Theramore': '我们在塞拉摩的线人',
  'Return to Sully McCleary in Dustwallow Marsh.': '返回尘泥沼泽向萨利·麦克莱里复命。',
  'Right Place, Wrong Time': '时运不济',
  "Rizzle's Unguarded Plans": '里兹尔的计划书',
  'Rot and Regret': '腐朽与悔恨',
  'Somber News': '沉重的消息',
  'Storm, Earth, and Fire': '风暴、大地与火焰',
  "Talvash's Scrying Bowl": '塔尔瓦什的占卜之碗',
  'Taming the Beast': '驯服野兽',
  'The Discs of Norgannon': '诺甘农圆盘',
  'The Elite of the Elite': '精锐中的精锐',
  'The Man in the Iron Chains': '铁链中的男子',
  'The Missing Kor\'kron': '失踪的库卡隆',
  'The Return of the King?': '王者归来？',
  'The Secret Prison': '秘密监狱',
  "The Tempest's Weapons": '风暴武器',
  'Tome of Twilight': '暮光魔典',
  'Training the Beast': '训练野兽',
  'Twilight Mementos': '暮光纪念物',
  'Use the note provided by Mason Connery to find his hidden treasure.': '利用梅森·康纳利提供的字条寻找他藏匿的宝藏。',
  'Watch Yer Back': '小心背后',
  'With Wind Beneath Your Wings': '乘风破浪',
  Woodwyrd: '林灵秘语',
  "Zum'rah's Head": '祖姆拉的头颅',
  // NPC 与任务物品名
  'Agent Kearnen': '特工凯尔南',
  'Alba Fairmoon': '阿尔芭·明月',
  'Alphonse Dumas': '阿尔方斯·杜马斯',
  Andruk: '安德鲁克',
  'Ashe Amberhall': '艾什·安伯霍尔',
  'Astarii Starseeker': '阿斯塔莉·逐星',
  'Braldir Ashmantle': '布拉尔迪尔·灰袍',
  'Brother Joshua': '约书亚修士',
  'Commander Demar Brant': '指挥官德马尔·布兰特',
  "Da'grosh": '达格罗什',
  'Daphne Stilwell': '达芙妮·斯蒂尔维尔',
  'Dargh Trueaim': '达尔格·准星',
  'Doan Karhan': '杜安·卡汉',
  'Doc Mixilpixil': '米克希尔皮克希尔医生',
  'Earthseer Farsen': '大地先知法尔森',
  Ekkal: '艾卡尔',
  'Father Lankester': '兰克斯特神父',
  'Gazin Tenorm': '加津·特诺姆',
  'Gimrizz Shadowcog': '吉姆里兹·影轮',
  'Godrick Farsan': '戈德里克·法尔桑',
  'Gorzeeki Wildeyes': '戈尔泽基·狂眼',
  'Henze Faulk': '亨泽·福克',
  'High Priest Rohan': '高阶祭司罗汉',
  'Image of Archmage Modera': '大法师莫德拉的影像',
  Impsy: '小鬼伊姆普西',
  'Jannos Lighthoof': '詹诺斯·光蹄',
  'Jasper Fel': '贾斯珀·菲尔',
  'John Turner': '约翰·特纳',
  'Jorah Annison': '乔拉·安尼森',
  'Jordan Stilwell': '乔丹·斯蒂尔维尔',
  Kurgul: '库尔古尔',
  'Lago Blackwrench': '拉戈·黑扳手',
  'Magus Wordeen Voidglare': '魔导师沃丁·虚视',
  'Mason Connery': '梅森·康纳利',
  "Mazu'kon": '玛祖康',
  "Mor'zul Bloodbringer": '莫苏尔·血使',
  'Muiredon Battleforge': '穆雷顿·战炉',
  'Narm Faulk': '纳尔姆·福克',
  'Niby the Almighty': '全能的尼比',
  'Onin MacHammar': '奥宁·麦哈默',
  'Sergeant Ulka': '乌尔卡中士',
  'Spackle Thornberry': '斯帕克·荆棘',
  'Stephanie Turner': '斯蒂芬妮·特纳',
  'Strahad Farsan': '斯特拉哈德·法尔桑',
  'Sully McCleary': '萨利·麦克莱里',
  'Sutara Plainstalker': '苏塔拉·平原行者',
  'Takar the Seer': '先知塔卡尔',
  'Toldren Deepiron': '托德伦·深铁',
  "Un'Thuwa": '温图瓦',
  'Veyric Thunderhame': '维里克·雷锤',
  'Wilma Ranthal': '威尔玛·兰萨尔',
  Zayus: '扎尤斯',
};

const WOWF_SKIP_NORMALIZE_KEYS = new Set([
  'id',
  'slug',
  'deployId',
  'site',
  'url',
  'key',
  'color',
  'faction',
  'kind',
  'via',
  'wowRaceKeys',
  'version',
  'dbVersion',
  'updatedAt',
  'spellId',
  'icon',
  'race',
]);

function normalizeWowfString(str) {
  if (typeof str !== 'string') return str;
  if (WOWF_EN_TO_ZH[str]) return WOWF_EN_TO_ZH[str];
  if (str.includes('20金币') && str.includes('坐骑')) {
    return '提前攒好100金币学习初级骑术，本种族坐骑会免费赠送。';
  }
  return str.replace(/\[([A-Za-z0-9\s':,\-.!?()/]+)\]/g, (full, inner) => {
    const zh = WOWF_EN_TO_ZH[inner];
    return zh ? `[${zh}]` : full;
  });
}

function normalizeWowfDatasetText(dataset) {
  if (!dataset || typeof dataset !== 'object') return;
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        if (typeof node[i] === 'string') {
          node[i] = normalizeWowfString(node[i]);
        } else {
          walk(node[i]);
        }
      }
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      if (WOWF_SKIP_NORMALIZE_KEYS.has(k)) continue;
      if (typeof v === 'string') {
        node[k] = normalizeWowfString(v);
      } else {
        walk(v);
      }
    }
  };
  walk(dataset.routes);
  walk(dataset.dungeons);
  walk(dataset.classes);
}

/**
 * 精简并转换路线时间轴步骤 (主城副本任务备战、推荐进本等级、关键跨区交通与航线)
 */
function transformTimelineSteps(timeline, dungeons) {
  if (!Array.isArray(timeline)) return [];
  const steps = [];
  let lastLevel = 1;
  for (const t of timeline) {
    if (!t || typeof t !== 'object') continue;
    if (typeof t.level === 'number') lastLevel = t.level;
    else if (typeof t.from === 'number') lastLevel = t.from;

    if (t.kind === 'city' && Array.isArray(t.quests) && t.quests.length > 0) {
      const quests = t.quests.slice(0, 6).map(q => {
        const g = Array.isArray(q.givers) && q.givers[0] ? q.givers[0] : null;
        return {
          id: extractQuestId(q),
          dungeon: q.dungeon || '',
          name: q.name || '',
          level: q.level || q.minLevel || lastLevel,
          minLevel: q.minLevel || lastLevel,
          npc: g?.name || '',
          zone: g?.zone || t.city || '',
          place: g?.place || g?.zone || t.city || '',
          x: g?.at?.x ?? null,
          y: g?.at?.y ?? null,
        };
      });
      steps.push({
        kind: 'city',
        level: t.level || lastLevel,
        city: t.city || '',
        quests,
        flightNpc: t.flight?.name || '',
        flightZone: t.flight?.zone || t.city || '',
        flightX: t.flight?.at?.x ?? null,
        flightY: t.flight?.at?.y ?? null,
      });
    } else if (t.kind === 'dungeon' && typeof t.dungeon === 'number' && Array.isArray(dungeons) && dungeons[t.dungeon]) {
      const dg = dungeons[t.dungeon];
      const minLvl = Array.isArray(dg.level) ? dg.level[0] : 13;
      const maxLvl = Array.isArray(dg.level) ? dg.level[1] : minLvl + 3;
      const ent = DUNGEON_ENTRANCE_COORDS[dg.id];
      steps.push({
        kind: 'dungeon',
        level: dg.visit || lastLevel || minLvl,
        id: dg.id || '',
        name: dg.name || '',
        minLevel: minLvl,
        maxLevel: maxLvl,
        zone: dg.entrance?.zone || dg.zone || '',
        entranceZone: ent?.zone || dg.entrance?.zone || dg.zone || '',
        entranceX: ent?.x ?? null,
        entranceY: ent?.y ?? null,
      });
    } else if (
      t.kind === 'travel' &&
      (t.via === 'tram' || t.via === 'boat' || t.via === 'zeppelin' || (Array.isArray(t.flights) && t.flights.length > 0))
    ) {
      const fl = Array.isArray(t.flights) && t.flights[0] ? t.flights[0] : null;
      steps.push({
        kind: 'travel',
        level: t.level || lastLevel,
        via: t.via || 'walk',
        from: t.from || '',
        to: t.to || '',
        place: t.place || '',
        flightNpc: fl?.name || '',
        flightZone: fl?.zone || fl?.place || t.to || '',
        flightPlace: fl?.place || '',
        flightX: fl?.at?.x ?? null,
        flightY: fl?.at?.y ?? null,
      });
    }
  }
  return steps;
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
function transformClassRuns(classRuns, factionLabel, raceId = '', raceName = '') {
  if (!Array.isArray(classRuns)) return [];
  return classRuns.map(cr => {
    const steps = Array.isArray(cr.steps)
      ? cr.steps.map(st => {
          const g = Array.isArray(st.givers) && st.givers[0] ? st.givers[0] : null;
          return {
            id: extractQuestId(st),
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
      id: extractQuestId(cr),
      faction: factionLabel,
      raceId: raceId || undefined,
      raceName: raceName || undefined,
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
  const ent = DUNGEON_ENTRANCE_COORDS[d.id];

  const incomingQuests = Array.isArray(d.quests)
    ? d.quests.map(q => {
        const g = Array.isArray(q.givers) && q.givers[0] ? q.givers[0] : null;
        const lastStep = Array.isArray(q.steps) && q.steps.length > 0 ? q.steps[q.steps.length - 1] : null;
        const explicitSide =
          q.side === 'alliance' || q.side === 'horde'
            ? q.side
            : g?.side === 'alliance' || g?.side === 'horde'
              ? g.side
              : null;
        return {
          id: extractQuestId(q),
          name: q.name || '',
          level: q.level || q.minLevel || minLevel,
          minLevel: q.minLevel || minLevel,
          inside: Boolean(q.inside),
          faction: explicitSide || faction || 'both',
          npc: g?.name || '',
          zone: g?.zone || q.zone || ent?.zone || zone,
          place: g?.place || '',
          x: g?.at?.x ?? null,
          y: g?.at?.y ?? null,
          stepCount: Array.isArray(q.steps) ? q.steps.length : 1,
          steps:
            Array.isArray(q.steps) && q.steps.length > 1
              ? q.steps.map(st => {
                  const sg = Array.isArray(st?.givers) && st.givers[0] ? st.givers[0] : null;
                  return {
                    id: typeof st === 'number' ? st : extractQuestId(st),
                    name: st?.name || q.name || '',
                    level: st?.level || st?.minLevel || q.level || q.minLevel || minLevel,
                    npc: sg?.name || g?.name || '',
                    zone: sg?.zone || g?.zone || q.zone || ent?.zone || zone,
                    place: sg?.place || g?.place || '',
                    x: sg?.at?.x ?? null,
                    y: sg?.at?.y ?? null,
                  };
                })
              : undefined,
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
      entranceZone: ent?.zone || zone,
      entranceX: ent?.x ?? null,
      entranceY: ent?.y ?? null,
      isNew,
      bosses: newMeta?.bosses || [],
      summary: newMeta?.summary || `${zone} (${minLevel}-${maxLevel}级) 经典地下城。`,
      quests: incomingQuests,
    });
  } else {
    existing.minLevel = minLevel;
    existing.maxLevel = maxLevel;
    if (d.visit) existing.visit = d.visit;
    if (ent) {
      existing.entranceZone = ent.zone;
      existing.entranceX = ent.x;
      existing.entranceY = ent.y;
    }
    const questIndexByKey = new Map(existing.quests.map((q, idx) => [`${q.name}:${q.npc}`, idx]));
    for (const q of incomingQuests) {
      const key = `${q.name}:${q.npc}`;
      let idx = questIndexByKey.get(key);
      if (idx !== undefined) {
        const prevQuest = existing.quests[idx];
        if (q.id && prevQuest?.id && q.id !== prevQuest.id) {
          const sameIdIdx = existing.quests.findIndex(item => item.id === q.id);
          if (sameIdIdx >= 0) {
            idx = sameIdIdx;
          } else {
            existing.quests.push(q);
            continue;
          }
        }
        const targetPrev = existing.quests[idx];
        const mergedFaction =
          targetPrev?.faction === 'both' ||
          q.faction === 'both' ||
          (targetPrev?.faction && q.faction && targetPrev.faction !== q.faction)
            ? 'both'
            : q.faction || targetPrev?.faction || 'both';
        existing.quests[idx] = {
          ...q,
          id: q.id || targetPrev?.id || null,
          steps: (Array.isArray(q.steps) && q.steps.length > 1) ? q.steps : targetPrev?.steps,
          faction: mergedFaction,
        };
      } else {
        questIndexByKey.set(key, existing.quests.length);
        existing.quests.push(q);
      }
    }
  }
}

/**
 * 提取 Next.js App Router 页面中的 __next_f 序列化文本块
 */
function extractNextFText(html) {
  const chunks = [];
  const re = /self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      chunks.push(JSON.parse('"' + m[1] + '"'));
    } catch {
      // 忽略异常转义片段
    }
  }
  return chunks.join('');
}

/**
 * 从指定下标开始提取括号平衡的 JSON 对象或数组字符串
 */
function extractBalancedJson(str, startIdx) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = startIdx; i < str.length; i++) {
    const c = str[i];
    if (inStr) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\') {
        esc = true;
        continue;
      }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === '{' || c === '[') {
      depth++;
    } else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) return str.slice(startIdx, i + 1);
    }
  }
  return null;
}

/**
 * 通用并发执行器
 */
async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return results;
}

function normalizeWowfFaction(f) {
  if (f === 'a' || f === 'alliance') return 'alliance';
  if (f === 'h' || f === 'horde') return 'horde';
  return 'both';
}

function parseQuestSideData(sideObj) {
  if (!sideObj || typeof sideObj !== 'object') return null;
  const stages = Array.isArray(sideObj.stages) ? sideObj.stages : [];
  const findStagePlace = key => {
    const stg = stages.find(s => s?.key === key);
    if (!stg || !Array.isArray(stg.blocks)) return null;
    for (const blk of stg.blocks) {
      if (Array.isArray(blk?.places) && blk.places[0]) {
        return blk.places[0];
      }
    }
    return null;
  };
  const startPlace = findStagePlace('start');
  const endPlace = findStagePlace('end');
  const flow = Array.isArray(sideObj.flow)
    ? sideObj.flow
        .filter(st => st && st.id && st.name)
        .map(st => ({
          id: Number(st.id),
          name: st.name,
          level: st.lv || st.rl || 1,
          minLevel: st.rl || st.lv || 1,
          faction: normalizeWowfFaction(st.f),
          self: Boolean(st.self),
        }))
    : [];
  return {
    npc: startPlace?.name || '',
    zone: startPlace?.zone || '',
    x: startPlace?.at?.x ?? null,
    y: startPlace?.at?.y ?? null,
    endNpc: endPlace?.name || '',
    endZone: endPlace?.zone || '',
    endX: endPlace?.at?.x ?? null,
    endY: endPlace?.at?.y ?? null,
    inside: Boolean(startPlace?.instance),
    objective: sideObj.objective || '',
    flow,
  };
}

/**
 * 抓取单个任务的详细信息（阵营、职业限定、起始/交付 NPC 与坐标、完整前置/后续任务链）
 */
async function fetchQuestDetail(questId, questCache, getHeaders) {
  const key = String(questId);
  if (questCache[key] && questCache[key].v === 3) {
    return questCache[key];
  }
  try {
    const url = `https://wowf.io/zh/quests/${questId}`;
    const res = await fetch(url, {
      headers: { ...getHeaders(url), 'Accept-Language': 'zh-CN,zh;q=0.9' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return questCache[key] || null;
    const html = await res.text();
    const full = extractNextFText(html);
    const idx = full.indexOf('"quest":{');
    if (idx < 0) return questCache[key] || null;
    const jsonStr = extractBalancedJson(full, idx + 8);
    if (!jsonStr) return questCache[key] || null;
    const q = JSON.parse(jsonStr);

    let classes;
    const clsMatch = full.slice(Math.max(0, idx - 900), idx).match(/"classes":(\[[^\]]*\])/);
    if (clsMatch) {
      try {
        const arr = JSON.parse(clsMatch[1]);
        const mapped = arr.map(s => CLASS_SLUG_TO_KEY[String(s).toLowerCase()]).filter(Boolean);
        if (mapped.length > 0) classes = mapped;
      } catch {
        // 忽略无效职业数组
      }
    }

    const sides = {};
    if (q.sides?.one) {
      sides.one = parseQuestSideData(q.sides.one);
    } else {
      if (q.sides?.alliance) sides.alliance = parseQuestSideData(q.sides.alliance);
      if (q.sides?.horde) sides.horde = parseQuestSideData(q.sides.horde);
    }

    const detail = {
      v: 3,
      id: Number(q.id || questId),
      name: q.name || '',
      faction: normalizeWowfFaction(q.f),
      level: q.lv || q.rl || 1,
      minLevel: q.rl || q.lv || 1,
      zone: q.zone || '',
      ...(classes ? { classes } : {}),
      sides,
    };
    questCache[key] = detail;
    return detail;
  } catch {
    return questCache[key] || null;
  }
}

/**
 * 极简 CBOR 解码器（用于解析 QuestieDB_Forever.toc 中的 Base64+CBOR 任务前置元数据）
 */
function decodeCborValue(buf, state = { offset: 0 }) {
  if (state.offset >= buf.length) return null;
  const b = buf[state.offset++];
  const major = b >> 5;
  const info = b & 0x1f;
  const readLen = () => {
    if (info < 24) return info;
    if (info === 24) return buf[state.offset++];
    if (info === 25) {
      const v = buf.readUInt16BE(state.offset);
      state.offset += 2;
      return v;
    }
    if (info === 26) {
      const v = buf.readUInt32BE(state.offset);
      state.offset += 4;
      return v;
    }
    if (info === 27) {
      const v = Number(buf.readBigUInt64BE(state.offset));
      state.offset += 8;
      return v;
    }
    return 0;
  };
  if (major === 0) return readLen();
  if (major === 1) return -1 - readLen();
  if (major === 2) {
    const len = readLen();
    const out = buf.slice(state.offset, state.offset + len);
    state.offset += len;
    return out;
  }
  if (major === 3) {
    const len = readLen();
    const out = buf.toString('utf8', state.offset, state.offset + len);
    state.offset += len;
    return out;
  }
  if (major === 4) {
    const len = readLen();
    const arr = [];
    for (let i = 0; i < len; i++) arr.push(decodeCborValue(buf, state));
    return arr;
  }
  if (major === 5) {
    const len = readLen();
    const obj = {};
    for (let i = 0; i < len; i++) {
      const k = decodeCborValue(buf, state);
      obj[k] = decodeCborValue(buf, state);
    }
    return obj;
  }
  if (major === 7) {
    if (info === 20) return false;
    if (info === 21) return true;
    if (info === 22) return null;
    if (info === 26) {
      const v = buf.readFloatBE(state.offset);
      state.offset += 4;
      return v;
    }
    if (info === 27) {
      const v = buf.readDoubleBE(state.offset);
      state.offset += 8;
      return v;
    }
  }
  return null;
}

/**
 * 从本地缓存的 questie-db-forever.zip 读取无限服官方 QuestieDB 的任务前置关系 (preQuestSingle / preQuestGroup)
 * 用于补全 wowf.io 网页端遗漏的前置任务链
 */
async function loadQuestiePrereqs(cacheDir) {
  const dbMap = new Map();
  const zipPath = path.join(cacheDir, 'questie-db-forever.zip');
  if (!fs.existsSync(zipPath)) return dbMap;
  try {
    const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
    const tocFile = zip.file('QuestieDB/QuestieDB_Forever.toc') || zip.file('QuestieDB/QuestieDB_Camelot.toc');
    if (!tocFile) return dbMap;
    const toc = await tocFile.async('string');
    const getOrCreate = qid => {
      let entry = dbMap.get(qid);
      if (!entry) {
        entry = { preSingle: null, preGroup: null, breadcrumbs: null, repeatable: false, name: '', level: 0, minLevel: 0 };
        dbMap.set(qid, entry);
      }
      return entry;
    };
    for (const line of toc.split(/\r?\n/)) {
      const m = line.match(/^## X-Quest-(\d+)-(12|13|28|S):\s*(.+)$/);
      if (!m) continue;
      const qid = Number(m[1]);
      const field = m[2];
      const raw = m[3].trim();
      if (!raw || raw.startsWith('~')) continue;
      try {
        const val = decodeCborValue(Buffer.from(raw, 'base64'));
        if (field === '13' && Array.isArray(val) && val.length > 0) {
          getOrCreate(qid).preSingle = val.map(Number).filter(Boolean);
        } else if (field === '12' && Array.isArray(val) && val.length > 0) {
          getOrCreate(qid).preGroup = val.map(Number).filter(Boolean);
        } else if (field === '28' && Array.isArray(val) && val.length > 0) {
          getOrCreate(qid).breadcrumbs = val.map(Number).filter(Boolean);
        } else if (field === 'S' && val && typeof val === 'object') {
          const entry = getOrCreate(qid);
          if (typeof val[1] === 'string') entry.name = val[1];
          if (typeof val[4] === 'number') entry.minLevel = val[4];
          if (typeof val[5] === 'number') entry.level = val[5];
          if (Number(val[24]) & 1) entry.repeatable = true;
        }
      } catch {
        // 忽略单条损坏的 CBOR 记录
      }
    }
  } catch {
    // 无缓存或读取失败时静默降级
  }
  return dbMap;
}

/**
 * 基于 QuestieDB 向前追溯缺失的前置任务，返回补全后的任务链步骤列表
 * 若传入 questCache，则仅当所有新增前置步骤均已抓到详情时才使用补全流程，否则回退到 sideData.flow
 */
function buildEffectiveFlow(mainQuest, sideData, questiePrereqs, questCache = null) {
  const baseFlow = Array.isArray(sideData?.flow) ? [...sideData.flow] : [];
  if (!questiePrereqs || questiePrereqs.size === 0) return baseFlow;

  const sourceSteps =
    baseFlow.length > 0
      ? baseFlow
      : [
          {
            id: mainQuest.id,
            name: mainQuest.name,
            level: mainQuest.level || 1,
            minLevel: mainQuest.minLevel || mainQuest.level || 1,
            faction: mainQuest.faction || 'both',
            self: true,
          },
        ];

  // 过滤掉仅作为可选引导（breadcrumb）的前置步骤：无需前置即可直接接取的任务不展示前置链
  let workingSteps = sourceSteps;
  let cutIdx = 0;
  const selfIdx = workingSteps.findIndex(st => st?.self || st?.id === mainQuest.id);
  if (selfIdx > 0) {
    for (let j = selfIdx; j > 0; j--) {
      const curId = workingSteps[j]?.id;
      const prevId = workingSteps[j - 1]?.id;
      if (!curId || !prevId) break;
      const info = questiePrereqs.get(curId);
      if (!info) break;
      const bc = Array.isArray(info.breadcrumbs) ? info.breadcrumbs : [];
      const preS = Array.isArray(info.preSingle) ? info.preSingle : [];
      const preG = Array.isArray(info.preGroup) ? info.preGroup : [];
      if (bc.includes(prevId) && !preS.includes(prevId) && !preG.includes(prevId)) {
        if (preS.length === 0 && preG.length === 0) {
          cutIdx = j;
          break;
        }
      }
    }
    if (cutIdx > 0) {
      workingSteps = workingSteps.slice(cutIdx);
    }
  }

  const visited = new Set(workingSteps.map(st => st?.id).filter(Boolean));
  const addedSteps = [];
  const mergedFlow = [];

  const collectPrereqs = (questId, depth, outSteps) => {
    if (depth >= 12) return;
    const info = questiePrereqs.get(questId);
    if (!info) return;

    let directPreIds = [];
    if (Array.isArray(info.preSingle) && info.preSingle.length === 1) {
      directPreIds = [info.preSingle[0]];
    } else if (Array.isArray(info.preGroup) && info.preGroup.length > 0) {
      directPreIds = info.preGroup;
    }

    for (const preId of directPreIds) {
      if (!preId || visited.has(preId)) continue;
      visited.add(preId);
      collectPrereqs(preId, depth + 1, outSteps);
      const preInfo = questiePrereqs.get(preId);
      const stepObj = {
        id: preId,
        name: preInfo?.name || `Quest ${preId}`,
        level: preInfo?.level || mainQuest.level || 1,
        minLevel: preInfo?.minLevel || mainQuest.minLevel || 1,
        faction: mainQuest.faction || 'both',
        self: false,
      };
      outSteps.push(stepObj);
      addedSteps.push(stepObj);
    }
  };

  for (const st of workingSteps) {
    if (st?.id) {
      const missingBeforeStep = [];
      collectPrereqs(st.id, 0, missingBeforeStep);
      mergedFlow.push(...missingBeforeStep);
    }
    mergedFlow.push(st);
  }

  const fallbackFlow = cutIdx > 0 ? workingSteps : baseFlow;
  if (addedSteps.length === 0) return fallbackFlow;
  if (questCache && addedSteps.some(st => !questCache[String(st.id)]?.name)) {
    return fallbackFlow;
  }
  return mergedFlow;
}

/**
 * 为任务链步骤标注 QuestieDB 的前置依赖关系 (reqAll: 多前置全部完成, preId: 单前置)
 */
function annotateQuestStepsPrereqs(steps, questiePrereqs) {
  if (!Array.isArray(steps) || steps.length <= 1 || !questiePrereqs || questiePrereqs.size === 0) {
    return steps;
  }
  const stepIdSet = new Set(steps.map(s => Number(s?.id)).filter(id => id > 0));
  return steps.map(st => {
    if (!st || typeof st !== 'object') return st;
    const sid = Number(st.id);
    if (!sid) return st;
    const info = questiePrereqs.get(sid);
    if (!info) return st;
    const preG = Array.isArray(info.preGroup) ? info.preGroup.filter(id => id > 0 && stepIdSet.has(id)) : [];
    const preS = Array.isArray(info.preSingle) ? info.preSingle.filter(id => id > 0 && stepIdSet.has(id)) : [];
    const next = { ...st };
    delete next.reqAll;
    delete next.preId;
    if (preG.length > 1) {
      next.reqAll = preG;
    } else if (preS.length === 1) {
      next.preId = preS[0];
    } else if (preG.length === 1) {
      next.preId = preG[0];
    }
    return next;
  });
}

function annotateDatasetPrereqs(dataset, questiePrereqs) {
  if (!dataset || !questiePrereqs || questiePrereqs.size === 0) return dataset;
  const annotateQuestList = list => {
    for (const q of list || []) {
      if (Array.isArray(q?.steps) && q.steps.length > 1) {
        q.steps = annotateQuestStepsPrereqs(q.steps, questiePrereqs);
      }
    }
  };
  for (const d of dataset.dungeons || []) {
    annotateQuestList(d.quests);
  }
  for (const r of Object.values(dataset.routes || {})) {
    for (const b of r.bands || r.levelBands || []) {
      annotateQuestList(b.quests);
      for (const classQuests of Object.values(b.questsByClass || {})) {
        annotateQuestList(classQuests);
      }
    }
    for (const classRuns of Object.values(r.classRunsByClass || {})) {
      annotateQuestList(classRuns);
    }
  }
  for (const c of Object.values(dataset.classes || {})) {
    annotateQuestList(c.classRuns);
  }
  return dataset;
}

/**
 * 从 wowf.io/zh/dungeons/<id> 与 /zh/quests/<id> 补全所有副本的双阵营任务与前置任务链
 */
async function enrichDungeonsWithWebQuests(dungeonMap, cacheDir, getHeaders, cachedDungeons = []) {
  const questCacheFile = path.join(cacheDir, 'wowf-quests-cache.json');
  let questCache = {};
  if (fs.existsSync(questCacheFile)) {
    try {
      questCache = JSON.parse(fs.readFileSync(questCacheFile, 'utf-8')) || {};
    } catch {
      questCache = {};
    }
  }

  const cachedDungeonMap = new Map(
    (Array.isArray(cachedDungeons) ? cachedDungeons : [])
      .filter(d => d && d.id != null)
      .map(d => [d.id, d])
  );
  // 提前加载无限服 QuestieDB 前置与可重复任务标记，确保任何缓存恢复路径都能完整判定
  const questiePrereqs = await loadQuestiePrereqs(cacheDir);
  const dedupeDungeonQuests = quests => {
    const list = Array.isArray(quests) ? quests : [];
    return list.filter((entry, idx) => {
      if (!entry) return false;
      const ids = entry.steps && entry.steps.length > 0 ? entry.steps.map(s => s.id) : [entry.id];
      return !list.some((other, oIdx) => {
        if (oIdx === idx || !other) return false;
        if (other.faction !== entry.faction && other.faction !== 'both') return false;
        const oIds = other.steps && other.steps.length > 0 ? other.steps.map(s => s.id) : [other.id];
        if (oIds.length >= ids.length) return false;
        const otherStartsRepeatable = (other.steps && other.steps[0]?.repeatable) || questiePrereqs?.get(oIds[0])?.repeatable;
        if (otherStartsRepeatable) return false;
        const offset = ids.length - oIds.length;
        return oIds.every((id, k) => id === ids[offset + k]);
      });
    });
  };

  const webBuiltDungeonIds = new Set();
  const restoreCachedQuestsForDungeon = dId => {
    const dungeon = dungeonMap.get(dId);
    const cachedDungeon = cachedDungeonMap.get(dId);
    if (!dungeon || !Array.isArray(cachedDungeon?.quests) || cachedDungeon.quests.length === 0) return;
    const questIdentityKey = q => `${q.id}:${q.faction || ''}`;
    const preferCurrent = webBuiltDungeonIds.has(dId);
    const primaryList = preferCurrent ? dungeon.quests || [] : cachedDungeon.quests;
    const fallbackList = preferCurrent ? cachedDungeon.quests : dungeon.quests || [];
    const merged = [...primaryList];
    const seenKeys = new Set(merged.filter(q => q?.id).map(questIdentityKey));
    for (const item of fallbackList) {
      if (!item) continue;
      if (item.id) {
        if (seenKeys.has(questIdentityKey(item))) continue;
        const inSteps = merged.some(
          mq =>
            (mq.faction === item.faction || mq.faction === 'both') &&
            Array.isArray(mq.steps) &&
            mq.steps.some(st => st.id === item.id)
        );
        if (!inSteps) {
          merged.push(item);
          seenKeys.add(questIdentityKey(item));
        }
      } else if (!merged.some(mq => mq.name === item.name && mq.faction === item.faction)) {
        merged.push(item);
      }
    }
    dungeon.quests = dedupeDungeonQuests(merged);
  };

  const dungeonIds = [...dungeonMap.keys()];
  const dungeonQuestIdsMap = new Map();
  const allMainQuestIds = new Set();
  const failedDungeonIds = new Set();
  let hasWebEnrichFailure = false;

  await runWithConcurrency(dungeonIds, 8, async dId => {
    try {
      const url = `https://wowf.io/zh/dungeons/${dId}`;
      const res = await fetch(url, {
        headers: { ...getHeaders(url), 'Accept-Language': 'zh-CN,zh;q=0.9' },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        failedDungeonIds.add(dId);
        hasWebEnrichFailure = true;
        return;
      }
      const html = await res.text();
      const full = extractNextFText(html);
      const qIdx = full.indexOf('"quests":[');
      const rqIdx = full.indexOf('"rewardQuests":[');
      const collected = [];
      const seen = new Set();
      for (const [labelIdx, offset] of [
        [qIdx, 9],
        [rqIdx, 15],
      ]) {
        if (labelIdx < 0) continue;
        const arrStr = extractBalancedJson(full, labelIdx + offset);
        if (!arrStr) continue;
        try {
          const arr = JSON.parse(arrStr);
          for (const item of arr) {
            const qid = Number(item?.id);
            if (qid && !seen.has(qid)) {
              seen.add(qid);
              collected.push(qid);
              allMainQuestIds.add(qid);
            }
          }
        } catch {
          failedDungeonIds.add(dId);
          hasWebEnrichFailure = true;
        }
      }
      if (collected.length > 0) {
        dungeonQuestIdsMap.set(dId, collected);
      }
    } catch {
      // 单副本抓取失败时记录状态并保留已有快照数据
      failedDungeonIds.add(dId);
      hasWebEnrichFailure = true;
    }
  });

  if (allMainQuestIds.size === 0) {
    if (dungeonIds.length > 0) {
      hasWebEnrichFailure = true;
      for (const dId of dungeonIds) {
        failedDungeonIds.add(dId);
        restoreCachedQuestsForDungeon(dId);
      }
    }
    return { hasWebEnrichFailure, failedDungeonIds: [...failedDungeonIds] };
  }

  // 第一轮：抓取所有副本主任务详情
  await runWithConcurrency([...allMainQuestIds], 12, async qid => {
    const detail = await fetchQuestDetail(qid, questCache, getHeaders);
    if (!detail) hasWebEnrichFailure = true;
  });

  // 第二轮：抓取前置/后续任务链步骤的详情以补全各步 NPC 与坐标
  const stepQuestIds = new Set();
  for (const qid of allMainQuestIds) {
    const q = questCache[String(qid)];
    if (!q?.sides) continue;
    for (const sideData of Object.values(q.sides)) {
      const effectiveFlow = buildEffectiveFlow(q, sideData, questiePrereqs);
      for (const st of effectiveFlow) {
        if (st?.id && questCache[String(st.id)]?.v !== 3) {
          stepQuestIds.add(st.id);
        }
      }
    }
  }
  if (stepQuestIds.size > 0) {
    await runWithConcurrency([...stepQuestIds], 12, async qid => {
      const detail = await fetchQuestDetail(qid, questCache, getHeaders);
      if (!detail) hasWebEnrichFailure = true;
    });
  }

  // 落盘任务详情缓存
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(questCacheFile, JSON.stringify(questCache), 'utf-8');
  } catch {
    // 忽略缓存写入异常
  }

  // 将完整任务与前置链合并回各副本
  for (const [dId, qids] of dungeonQuestIdsMap.entries()) {
    const dungeon = dungeonMap.get(dId);
    if (!dungeon) continue;

    const builtQuests = [];
    const seenQuestKey = new Set();

    const buildEntry = (q, sideData, factionOverride) => {
      const flow = buildEffectiveFlow(q, sideData, questiePrereqs, questCache);
      const selfIdx = flow.findIndex(st => st.self || st.id === q.id);
      const hasPrereq = selfIdx > 0;

      // 同一副本内仅对同一任务（同 ID + 同阵营）去重；
      // 同属一条 wowf.io 任务链（flow）的并行分支任务需保留，交由 QuestieDB 解析与前缀分组展示。
      const questKey = `${factionOverride}:${q.id}`;
      if (seenQuestKey.has(questKey)) return null;
      seenQuestKey.add(questKey);

      const steps =
        flow.length > 1
          ? flow.map(st => {
              const stDetail = questCache[String(st.id)];
              const stSide = stDetail?.sides?.[factionOverride] || stDetail?.sides?.one || null;
              const npc = stSide?.npc || '';
              const zone = stSide?.zone || stDetail?.zone || '';
              const x = stSide?.x ?? null;
              const y = stSide?.y ?? null;
              const endNpc = stSide?.endNpc || '';
              const endZone = stSide?.endZone || '';
              const endX = stSide?.endX ?? null;
              const endY = stSide?.endY ?? null;
              const hasDiffEnd =
                endNpc &&
                (endNpc !== npc || endZone !== zone || endX !== x || endY !== y);
              return {
                id: st.id,
                name: stDetail?.name || st.name,
                level: stDetail?.level || st.level || q.level,
                npc,
                zone,
                place: '',
                x,
                y,
                ...(hasDiffEnd ? { endNpc, endZone, endX, endY } : {}),
                ...(questiePrereqs.get(st.id)?.repeatable ? { repeatable: true } : {}),
              };
            })
          : undefined;

      // 有前置任务时，将入口坐标与 NPC 指向任务链第一步，方便玩家直接前往起始点接取
      const firstStep = steps && steps.length > 0 ? steps[0] : null;
      const startDetail = firstStep ? questCache[String(firstStep.id)] : null;
      const startSide = startDetail?.sides?.[factionOverride] || startDetail?.sides?.one || null;

      const topNpc = (hasPrereq && firstStep?.npc) || sideData?.npc || '';
      const topZone = (hasPrereq && firstStep?.zone) || sideData?.zone || q.zone || dungeon.entranceZone || dungeon.zone;
      const topX = hasPrereq ? (firstStep?.x ?? null) : (sideData?.x ?? null);
      const topY = hasPrereq ? (firstStep?.y ?? null) : (sideData?.y ?? null);
      const singleEndNpc = !steps ? (sideData?.endNpc || '') : '';
      const singleEndZone = !steps ? (sideData?.endZone || '') : '';
      const singleEndX = !steps ? (sideData?.endX ?? null) : null;
      const singleEndY = !steps ? (sideData?.endY ?? null) : null;
      const hasSingleDiffEnd =
        singleEndNpc &&
        (singleEndNpc !== topNpc || singleEndZone !== topZone || singleEndX !== topX || singleEndY !== topY);

      return {
        id: q.id,
        name: q.name,
        level: q.level || dungeon.minLevel,
        minLevel: (hasPrereq && startDetail?.minLevel) || q.minLevel || dungeon.minLevel,
        inside: hasPrereq ? Boolean(startSide?.inside) : Boolean(sideData?.inside),
        faction: factionOverride,
        ...(q.classes ? { classes: q.classes } : {}),
        npc: topNpc,
        zone: topZone,
        place: '',
        x: topX,
        y: topY,
        ...(hasSingleDiffEnd
          ? { endNpc: singleEndNpc, endZone: singleEndZone, endX: singleEndX, endY: singleEndY }
          : {}),
        finalObjective: sideData?.objective || '',
      };
    };

    for (const qid of qids) {
      const q = questCache[String(qid)];
      if (!q || !q.name) {
        failedDungeonIds.add(dId);
        continue;
      }
      if (q.sides?.one) {
        const entry = buildEntry(q, q.sides.one, q.faction);
        if (entry) builtQuests.push(entry);
      } else {
        if (q.sides?.alliance) {
          const entry = buildEntry(q, q.sides.alliance, 'alliance');
          if (entry) builtQuests.push(entry);
        }
        if (q.sides?.horde) {
          const entry = buildEntry(q, q.sides.horde, 'horde');
          if (entry) builtQuests.push(entry);
        }
      }
    }

    // 去重：若同一阵营下存在另一条任务链（如剥离了可选引导前置后）恰好是某条链的严格后缀，则保留更精简的那条
    const dedupedQuests = dedupeDungeonQuests(builtQuests);

    if (dedupedQuests.length > 0) {
      webBuiltDungeonIds.add(dId);
      // 保留原有数据中按 ID 未被网页覆盖的补充任务（基于去重前的 builtQuests 判定，避免被剥离的引导任务被旧数据回填）
      const seenKeys = new Set(builtQuests.filter(q => q?.id).map(q => `${q.id}:${q.faction || ''}`));
      for (const prev of dungeon.quests || []) {
        if (prev.id) {
          if (seenKeys.has(`${prev.id}:${prev.faction || ''}`)) continue;
          const inSteps = builtQuests.some(
            bq =>
              (bq.faction === prev.faction || bq.faction === 'both') &&
              Array.isArray(bq.steps) &&
              bq.steps.some(st => st.id === prev.id)
          );
          if (!inSteps) {
            dedupedQuests.push(prev);
          }
        } else if (!builtQuests.some(bq => bq.name === prev.name && (bq.faction === prev.faction || bq.faction === 'both'))) {
          dedupedQuests.push(prev);
        }
      }
      dungeon.quests = dedupeDungeonQuests(dedupedQuests);
    } else {
      restoreCachedQuestsForDungeon(dId);
    }
  }
  for (const dId of failedDungeonIds) {
    restoreCachedQuestsForDungeon(dId);
  }
  console.log(`[WoWF] Enriched ${dungeonQuestIdsMap.size} dungeons with ${Object.keys(questCache).length} web quests.`);
  return { hasWebEnrichFailure, failedDungeonIds: [...failedDungeonIds] };
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
    const ent = DUNGEON_ENTRANCE_COORDS[meta.id] || null;
    dungeonMap.set(meta.id, {
      id: meta.id,
      name: meta.name,
      minLevel: meta.level[0],
      maxLevel: meta.level[1],
      visit: meta.visit,
      zone: meta.zone,
      entranceZone: ent ? ent.zone : meta.zone,
      entranceX: ent ? ent.x : null,
      entranceY: ent ? ent.y : null,
      isNew: true,
      bosses: meta.bosses,
      summary: meta.summary,
      quests: [],
    });
  }

  let liveFetchCount = 0;
  let hasPartialFailure = false;
  let hasRouteFailure = false;
  const liveDungeonIds = new Set();
  const payloadCache = new Map();

  // 1. 抓取所有种族 × 职业组合升级路线 (bands + trainersByClass + questsByClass + classRunsByClass + timelineSteps + dungeons + professions)
  for (const route of RACE_ROUTES) {
    const isSkyborne = route.id === 'skyborne-alliance' || route.id === 'skyborne-horde';
    const routeClasses = Array.isArray(route.classes) && route.classes.length > 0 ? route.classes : [route.sampleClass];
    let resolvedApiRace = null;
    let basePayload = null;
    let lastErr = null;
    const baseClassKey = CLASS_SLUG_TO_KEY[route.sampleClass] || 'WARRIOR';

    for (const candidateRace of route.apiRaces || [route.id]) {
      try {
        basePayload = await fetchLevelUpPayload(route.sampleClass, candidateRace, route.faction, deployId, getHeaders);
        resolvedApiRace = candidateRace;
        payloadCache.set(`${route.id}:${route.sampleClass}`, basePayload);
        payloadCache.set(`${candidateRace}:${route.sampleClass}:${route.faction}`, basePayload);
        break;
      } catch (err) {
        lastErr = err;
      }
    }

    if (!basePayload) {
      const cachedRoute = cachedDataset?.routes?.[route.id];

      // 非天裔常规路线若请求失败，优先复用已有缓存并标记局部失败
      if (!isSkyborne && Array.isArray(cachedRoute?.bands) && cachedRoute.bands.length > 0) {
        hasPartialFailure = true;
        hasRouteFailure = true;
        routesData[route.id] = cachedRoute;
        continue;
      }

      if (isSkyborne) {
        const baseKey = route.faction === 'horde' ? 'orc' : 'human';
        const druidSourceKey = route.faction === 'horde' ? 'tauren' : 'night-elf';
        const liveBaseRoute = routesData[baseKey];
        const baseRoute = liveBaseRoute || cachedDataset?.routes?.[baseKey];
        const druidRoute = routesData[druidSourceKey] || cachedDataset?.routes?.[druidSourceKey];
        if (!liveBaseRoute) {
          hasPartialFailure = true;
          hasRouteFailure = true;
        }
        const tailBands = Array.isArray(baseRoute?.bands)
          ? baseRoute.bands
              .filter(b => (b.to ?? b.from ?? 0) >= 12)
              .map(b => {
                const cloned = {
                  ...b,
                  from: (b.from ?? 1) < 12 ? 12 : b.from,
                  trainersByClass: { ...(b.trainersByClass || {}) },
                  questsByClass: { ...(b.questsByClass || {}) },
                };
                if (!cloned.trainersByClass.DRUID && Array.isArray(druidRoute?.bands)) {
                  const db = druidRoute.bands.find(x => x.zone === b.zone) || druidRoute.bands.find(x => Math.abs((x.from || 1) - (b.from || 1)) <= 4);
                  if (db?.trainersByClass?.DRUID) {
                    cloned.trainersByClass.DRUID = db.trainersByClass.DRUID;
                  }
                }
                return cloned;
              })
          : [];
        if (tailBands.length > 0) {
          const zephrasTrainersByClass = {};
          for (const cSlug of routeClasses) {
            const cKey = CLASS_SLUG_TO_KEY[cSlug];
            const clsCfg = CLASS_CONFIGS.find(c => c.key === cKey);
            if (cKey) {
              zephrasTrainersByClass[cKey] = {
                name: `天裔${clsCfg?.name || '职业'}导师`,
                title: `${clsCfg?.name || '全职业'}训练师`,
                place: '泽风岛主营地 (天裔前哨)',
                x: 49.2,
                y: 51.4,
              };
            }
          }
          const mergedClassRunsByClass = { ...(baseRoute?.classRunsByClass || {}) };
          if (druidRoute?.classRunsByClass?.DRUID) {
            mergedClassRunsByClass.DRUID = druidRoute.classRunsByClass.DRUID;
          }
          routesData[route.id] = {
            id: route.id,
            name: route.name,
            faction: route.faction,
            wowRaceKeys: route.wowRaceKeys,
            synthesized: true,
            classRunsByClass: mergedClassRunsByClass,
            timelineSteps: Array.isArray(baseRoute?.timelineSteps)
              ? baseRoute.timelineSteps.filter(t => (t.level || 1) >= 12)
              : [],
            bands: [
              {
                from: 1,
                to: 12,
                zone: '泽风岛 (Zephras Isle)',
                hub: { name: '泽风庇护所 / 天裔前哨', zone: '泽风岛', x: 48.5, y: 52.0 },
                hubs: [
                  { from: 1, to: 6, name: '天裔登陆点', x: 51.0, y: 62.0 },
                  { from: 6, to: 12, name: '泽风庇护所 / 天裔前哨', x: 48.5, y: 52.0 },
                ],
                flights: [
                  { name: '泽风岛航线管理员', place: '泽风庇护所', x: 48.8, y: 51.8 },
                ],
                trainer: { name: '天裔导师', title: '全职业训练师', place: '泽风岛主营地', x: 49.2, y: 51.4 },
                trainersByClass: zephrasTrainersByClass,
                quests: [],
                questsByClass: {},
                professions: [
                  { id: 'first-aid', name: '急救', trainer: '天裔医师', place: '泽风岛', x: 48.0, y: 53.0 },
                ],
                dungeonQuests: [],
              },
              ...tailBands,
            ],
          };
        } else if (cachedRoute) {
          hasPartialFailure = true;
          hasRouteFailure = true;
          routesData[route.id] = cachedRoute;
        }
        continue;
      }

      hasPartialFailure = true;
      hasRouteFailure = true;
      console.warn(`[WoWF] Route fetch failed for ${route.id}: ${lastErr?.message}`);
      continue;
    }

    liveFetchCount++;
    const bands = Array.isArray(basePayload.bands)
      ? basePayload.bands.map(b => transformBand(b, baseClassKey))
      : [];
    const classRunsByClass = {
      [baseClassKey]: transformClassRuns(basePayload.classRuns, route.faction, route.id, route.name),
    };
    const timelineSteps = transformTimelineSteps(basePayload.timeline, basePayload.dungeons);

    // 并发拉取该种族支持的其他职业路线，提取各职业专属训练师 (trainersByClass)、职业起始任务 (questsByClass) 与种族专属职业任务链 (classRunsByClass)
    const otherClasses = routeClasses.filter(c => c !== route.sampleClass);
    const cachedRoute = cachedDataset?.routes?.[route.id];
    const results = await Promise.allSettled(
      otherClasses.map(async classSlug => {
        const p = await fetchLevelUpPayload(classSlug, resolvedApiRace, route.faction, deployId, getHeaders);
        payloadCache.set(`${route.id}:${classSlug}`, p);
        payloadCache.set(`${resolvedApiRace}:${classSlug}:${route.faction}`, p);
        return { classSlug, payload: p };
      })
    );

    for (let i = 0; i < otherClasses.length; i++) {
      const classSlug = otherClasses[i];
      const classKey = CLASS_SLUG_TO_KEY[classSlug];
      if (!classKey) continue;
      const res = results[i];
      if (res.status === 'fulfilled' && res.value?.payload) {
        liveFetchCount++;
        const cp = res.value.payload;
        classRunsByClass[classKey] = transformClassRuns(cp.classRuns, route.faction, route.id, route.name);
        if (Array.isArray(cp.bands)) {
          for (let bIdx = 0; bIdx < bands.length; bIdx++) {
            const targetBand = bands[bIdx];
            const cb =
              cp.bands.find(x => x.from === targetBand.from && x.to === targetBand.to && x.zone === targetBand.zone) ||
              cp.bands[bIdx];
            if (cb?.trainer?.name) {
              targetBand.trainersByClass[classKey] = {
                name: cb.trainer.name || '',
                title: cb.trainer.title || '职业训练师',
                place: cb.trainer.place || cb.trainer.zone || targetBand.zone || '',
                zone: cb.trainer.zone || targetBand.zone || '',
                x: cb.trainer.at?.x ?? null,
                y: cb.trainer.at?.y ?? null,
              };
            }
            const cQuests = transformBandQuests(cb?.quests, targetBand.from, targetBand.zone);
            if (cQuests.length > 0) {
              targetBand.questsByClass[classKey] = cQuests;
            }
          }
        }
      } else {
        hasPartialFailure = true;
        console.warn(`[WoWF] Route class fetch failed for ${route.id}/${classSlug}: ${res.reason?.message}`);
        if (cachedRoute?.classRunsByClass?.[classKey]) {
          classRunsByClass[classKey] = cachedRoute.classRunsByClass[classKey];
        }
        if (Array.isArray(cachedRoute?.bands)) {
          for (let bIdx = 0; bIdx < bands.length && bIdx < cachedRoute.bands.length; bIdx++) {
            const cachedBand = cachedRoute.bands[bIdx];
            if (cachedBand?.trainersByClass?.[classKey]) {
              bands[bIdx].trainersByClass[classKey] = cachedBand.trainersByClass[classKey];
            }
            if (cachedBand?.questsByClass?.[classKey]) {
              bands[bIdx].questsByClass[classKey] = cachedBand.questsByClass[classKey];
            }
          }
        }
      }
    }

    routesData[route.id] = {
      id: route.id,
      name: route.name,
      faction: route.faction,
      wowRaceKeys: route.wowRaceKeys,
      classRunsByClass,
      timelineSteps,
      bands,
    };

    if (Array.isArray(basePayload.dungeons)) {
      for (const d of basePayload.dungeons) {
        if (d?.id) liveDungeonIds.add(d.id);
        mergeDungeonIntoMap(dungeonMap, d, route.faction);
      }
    }
    if (Array.isArray(basePayload.professions)) {
      for (const p of basePayload.professions) {
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
    if (basePayload.items && typeof basePayload.items === 'object') {
      for (const [id, item] of Object.entries(basePayload.items)) {
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

  // 若天裔合成路线在 human/orc/night-elf/tauren 之前或之后生成，用已抓取的完整阵营路线补齐天裔全职业训练师与任务链
  for (const skyId of ['skyborne-alliance', 'skyborne-horde']) {
    const skyRoute = routesData[skyId];
    if (skyRoute && skyRoute.synthesized) {
      const baseKey = skyRoute.faction === 'horde' ? 'orc' : 'human';
      const druidSourceKey = skyRoute.faction === 'horde' ? 'tauren' : 'night-elf';
      const baseRoute = routesData[baseKey] || cachedDataset?.routes?.[baseKey];
      const druidRoute = routesData[druidSourceKey] || cachedDataset?.routes?.[druidSourceKey];
      if (baseRoute) {
        skyRoute.classRunsByClass = {
          ...(baseRoute.classRunsByClass || {}),
          ...(druidRoute?.classRunsByClass?.DRUID ? { DRUID: druidRoute.classRunsByClass.DRUID } : {}),
        };
        skyRoute.timelineSteps = Array.isArray(baseRoute.timelineSteps)
          ? baseRoute.timelineSteps.filter(t => (t.level || 1) >= 12)
          : [];
        if (Array.isArray(skyRoute.bands) && skyRoute.bands.length > 1 && Array.isArray(baseRoute.bands)) {
          const tailBands = baseRoute.bands
            .filter(b => (b.to ?? b.from ?? 0) >= 12)
            .map(b => {
              const cloned = {
                ...b,
                from: (b.from ?? 1) < 12 ? 12 : b.from,
                trainersByClass: { ...(b.trainersByClass || {}) },
                questsByClass: { ...(b.questsByClass || {}) },
              };
              if (!cloned.trainersByClass.DRUID && Array.isArray(druidRoute?.bands)) {
                const db = druidRoute.bands.find(x => x.zone === b.zone) || druidRoute.bands.find(x => Math.abs((x.from || 1) - (b.from || 1)) <= 4);
                if (db?.trainersByClass?.DRUID) {
                  cloned.trainersByClass.DRUID = db.trainersByClass.DRUID;
                }
              }
              return cloned;
            });
          skyRoute.bands = [skyRoute.bands[0], ...tailBands];
        }
      }
    }
  }

  // 当存在路线请求失败时，用本地缓存补齐缺失的地下城、副本任务（保留双阵营属性）与精选掉落；
  // 当所有路线请求均成功时，本轮实时阵营合并结果即为完整权威数据，不受旧缓存阵营干扰
  if (hasRouteFailure && Array.isArray(cachedDataset?.dungeons)) {
    for (const cd of cachedDataset.dungeons) {
      if (!cd?.id) continue;
      if (!dungeonMap.has(cd.id)) {
        dungeonMap.set(cd.id, { ...cd, quests: Array.isArray(cd.quests) ? [...cd.quests] : [] });
      } else {
        const existing = dungeonMap.get(cd.id);
        if (!liveDungeonIds.has(cd.id)) {
          if (cd.name) existing.name = cd.name;
          if (cd.minLevel != null) existing.minLevel = cd.minLevel;
          if (cd.maxLevel != null) existing.maxLevel = cd.maxLevel;
          if (cd.visit != null) existing.visit = cd.visit;
          if (cd.zone) existing.zone = cd.zone;
        }
        const questIndexByKey = new Map(existing.quests.map((q, idx) => [`${q.name}:${q.npc}`, idx]));
        for (const cq of cd.quests || []) {
          const key = `${cq.name}:${cq.npc}`;
          if (!questIndexByKey.has(key)) {
            questIndexByKey.set(key, existing.quests.length);
            existing.quests.push(cq);
          } else {
            const idx = questIndexByKey.get(key);
            const liveQuest = existing.quests[idx];
            if (
              cq.faction === 'both' ||
              (cq.faction && liveQuest?.faction && cq.faction !== liveQuest.faction)
            ) {
              existing.quests[idx] = { ...liveQuest, faction: 'both' };
            }
          }
        }
      }
    }
  }
  if (hasRouteFailure && Array.isArray(cachedDataset?.items)) {
    for (const ci of cachedDataset.items) {
      if (ci?.id && !notableItemsMap.has(String(ci.id)) && notableItemsMap.size < 180) {
        notableItemsMap.set(String(ci.id), ci);
      }
    }
  }

  // 2. 整理 9 大职业的专精循环、10-60 天赋加点、全种族专属职业任务与宏命令（优先复用上方已抓取的 payloadCache）
  for (const cls of CLASS_CONFIGS) {
    const cachedClass = cachedDataset?.classes?.[cls.key];
    let specs = [];
    const classRuns = [];
    const seenRunKeys = new Set();
    const appendClassRuns = list => {
      for (const cr of list || []) {
        const firstStep = Array.isArray(cr.steps) && cr.steps[0] ? cr.steps[0] : null;
        const dedupKey = `${cr.faction}:${cr.level}:${cr.name}:${firstStep?.zone || ''}:${firstStep?.npc || ''}`;
        if (!seenRunKeys.has(dedupKey)) {
          seenRunKeys.add(dedupKey);
          classRuns.push(cr);
        }
      }
    };

    const primaryFaction = cls.hordeRace && !cls.allianceRace ? 'horde' : (cls.key === 'DRUID' ? 'horde' : 'alliance');
    const primaryRace = primaryFaction === 'horde' ? cls.hordeRace : cls.allianceRace;
    const secondaryFaction = primaryFaction === 'alliance' ? 'horde' : 'alliance';
    const secondaryRace = secondaryFaction === 'horde' ? cls.hordeRace : cls.allianceRace;

    try {
      const cachedPrimary = payloadCache.get(`${primaryRace}:${cls.slug}:${primaryFaction}`);
      const primaryPayload =
        cachedPrimary || (await fetchLevelUpPayload(cls.slug, primaryRace, primaryFaction, deployId, getHeaders));
      if (!cachedPrimary) liveFetchCount++;
      specs = transformTalentBuilds(primaryPayload.talentBuilds);
      appendClassRuns(transformClassRuns(primaryPayload.classRuns, primaryFaction, primaryRace));

      if (secondaryRace) {
        try {
          const cachedSecondary = payloadCache.get(`${secondaryRace}:${cls.slug}:${secondaryFaction}`);
          const secondaryPayload =
            cachedSecondary ||
            (await fetchLevelUpPayload(cls.slug, secondaryRace, secondaryFaction, deployId, getHeaders));
          if (!cachedSecondary) liveFetchCount++;
          appendClassRuns(transformClassRuns(secondaryPayload.classRuns, secondaryFaction, secondaryRace));
        } catch (secErr) {
          hasPartialFailure = true;
          console.warn(`[WoWF] Secondary faction classRuns fetch failed for ${cls.key} (${secondaryFaction}): ${secErr.message}`);
          if (Array.isArray(cachedClass?.classRuns)) {
            appendClassRuns(cachedClass.classRuns.filter(cr => cr.faction === secondaryFaction));
          }
        }
      }

      // 将各路线中该职业的种族特有职业任务链一并去重收录
      for (const route of RACE_ROUTES) {
        const rRuns = routesData[route.id]?.classRunsByClass?.[cls.key];
        if (Array.isArray(rRuns)) {
          appendClassRuns(rRuns);
        }
      }
    } catch (err) {
      hasPartialFailure = true;
      console.warn(`[WoWF] Class fetch failed for ${cls.key}: ${err.message}`);
      if (Array.isArray(cachedClass?.specs) && cachedClass.specs.length > 0) {
        specs = cachedClass.specs;
      }
      if (Array.isArray(cachedClass?.classRuns) && cachedClass.classRuns.length > 0) {
        appendClassRuns(cachedClass.classRuns);
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
    const cachedDbVersion = cachedDataset.meta?.dbVersion || '2026.11.15';
    const offlinePrereqs = await loadQuestiePrereqs(cacheDir);
    return annotateDatasetPrereqs({
      ...cachedDataset,
      meta: {
        ...cachedDataset.meta,
        version: `${WOWF_VERSION} + DB v${cachedDbVersion}`,
      },
      professions: professionsList,
      foreverSystems: FOREVER_SYSTEMS_DATA,
    }, offlinePrereqs);
  }

  // 4. 从 wowf.io 副本与任务详情页补全全阵营副本任务与前置任务链
  const webEnrichResult = await enrichDungeonsWithWebQuests(
    dungeonMap,
    cacheDir,
    getHeaders,
    cachedDataset?.dungeons
  );
  if (webEnrichResult?.hasWebEnrichFailure) {
    hasPartialFailure = true;
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

  enrichRoutesWithAltZones(routesData);

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
  const livePrereqs = await loadQuestiePrereqs(cacheDir);
  annotateDatasetPrereqs(dataset, livePrereqs);

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
## Dependencies: QuestieDB
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

-- 无限服常用游戏命令/控制台变量速查表（仅收录在无限服客户端可用的命令）
-- 每条: { title, category, code, desc, note }
-- code 为可直接粘贴到聊天框执行的命令；note 标注无限服下的注意事项。
local COMMON_COMMANDS = {
  {
    title = "最大镜头距离",
    category = "画面 / 镜头",
    code = "/console cameraDistanceMaxZoomFactor 4",
    desc = "把镜头拉到最远（无限服上限约 50 码），视野更开阔，做任务与副本走位更舒服。",
    note = "无限服客户端使用 4（上限 50 码）；若该条无效，可改用下方旧版命令 cameraDistanceMax 50。",
  },
  {
    title = "旧版镜头距离上限 (1.12)",
    category = "画面 / 镜头",
    code = "/console cameraDistanceMax 50",
    desc = "旧版（7.0 以前）客户端直接设置镜头最远距离 50 码。",
    note = "无限服 1.12 客户端可用，作为上一条无效时的备用命令。",
  },
  {
    title = "物品/任务目标闪光高亮",
    category = "物品 / 拾取",
    code = "/console outlineModeShowLootEffectWhenDisabled 1",
    desc = "关闭轮廓模式时，用闪光特效标出地上的拾取物与可交互目标。",
    note = "无限服专属 CVar；需先关闭轮廓模式（/console outlineMode 0）才会生效。",
  },
  {
    title = "自动拾取",
    category = "物品 / 拾取",
    code = "/console autoLootDefault 1",
    desc = "默认开启自动拾取，拾取尸体不再逐个点选；按住 Shift 可临时关闭。",
    note = "无限服可用。",
  },
  {
    title = "关闭全屏泛光（提帧）",
    category = "画面 / 性能",
    code = "/console ffxGlow 0",
    desc = "关闭屏幕泛光特效，低配机器或团本掉帧时可明显提升帧数。",
    note = "无限服可用；想恢复改为 1。",
  },
  {
    title = "解除帧数上限",
    category = "画面 / 性能",
    code = "/console maxFPS 0",
    desc = "取消帧率硬性上限（0 = 使用软上限），也可设为 60 / 144 等固定值。",
    note = "无限服可用；0 表示不限制，设 60/144 可固定帧率。",
  },
  {
    title = "镜头平滑关闭",
    category = "画面 / 镜头",
    code = "/console cameraSmoothStyle 0",
    desc = "关闭镜头平滑跟随，旋转视角更跟手，PvP 与走位更精准。",
    note = "无限服可用。",
  },
  {
    title = "角色环境光（旧版）",
    category = "画面 / 镜头",
    code = "/console characterAmbient",
    desc = "切换角色模型的环境光照，让人物颜色更自然；再输入一次可切回。",
    note = "无限服 1.12/经典客户端可用；该命令不要带数值，直接输入即可切换。",
  },
  {
    title = "显示 Lua 报错",
    category = "调试 / 其他",
    code = "/console scriptErrors 1",
    desc = "开启 Lua 错误弹窗，排查插件报错与兼容性问题时必备。",
    note = "无限服可用；查完问题建议改回 0。",
  },
  {
    title = "重置界面设置",
    category = "调试 / 其他",
    code = "/console cvar_default",
    desc = "把所有界面控制台变量恢复为默认值，界面错乱时的终极自救。",
    note = "会重置所有 CVar 改动，包括上面这些设置；单独重置某项用 /console cvar_default 变量名。",
  },
  {
    title = "重载界面",
    category = "调试 / 其他",
    code = "/reload",
    desc = "重载游戏界面（等价于 /rl），安装或更新插件后使其生效。",
    note = "无限服通用斜杠命令。",
  },
  {
    title = "清理聊天窗口",
    category = "调试 / 其他",
    code = "/clearChat",
    desc = "清空当前聊天窗口的文字，刷屏或截屏前整理界面时使用。",
    note = "无限服通用斜杠命令。",
  },
  {
    title = "暂离 / 请勿打扰",
    category = "调试 / 其他",
    code = "/afk",
    desc = "标记自己为暂离（自动回复），再输入一次或移动即取消；/dnd 则为请勿打扰。",
    note = "无限服通用斜杠命令。",
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
}

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
              for _, st in ipairs(sp.steps or {}) do
                if st.name and purchasedByName[st.name] then
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
  "藏宝海湾", "加基森", "棘齿城", "塞拉摩", "闪金镇", "卡拉诺斯", "布瑞尔", "哨兵岭", "塞尔萨玛",
  "瑟伯切尔", "湖畔镇", "夜色镇", "米奈希尔港", "南海镇", "塔伦米尔", "避难谷地", "落锤镇",
  "格罗姆高营地", "卡加斯", "斯通纳德", "鹰巢山", "恶齿村", "瑟银哨塔", "守望堡", "十字路口",
}

local function ResolveUiMapID(zoneText, placeText)
  for _, raw in ipairs({ zoneText, placeText }) do
    if raw and raw ~= "" then
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
  if C_Map and C_Map.GetBestMapForUnit then
    local ok, playerMap = pcall(C_Map.GetBestMapForUnit, "player")
    if ok and playerMap and playerMap > 0 then
      return playerMap
    end
  end
  return 1429
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
  customMapPin.label:SetText(string.format("|cff00ffcc★ %s|r |cffffd100(%.1f, %.1f)|r", activePinState.label or "目标点", activePinState.x, activePinState.y))
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
    DEFAULT_CHAT_FRAME:AddMessage("|cff00ffcc[WoWF 无限百科]|r 目标位置: |cffffd100" .. displayZone .. " - " .. displayLabel .. "|r")
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

  -- 4. 在聊天框输出原生可点击的 |Hworldmap:...|h 坐标链接
  local scaledX = math.floor(numX * 100 + 0.5)
  local scaledY = math.floor(numY * 100 + 0.5)
  local worldMapLink = string.format("|cffffff00|Hworldmap:%d:%d:%d|h[%s · %s (%.1f, %.1f)]|h|r", mapID or 1429, scaledX, scaledY, displayZone, displayLabel, numX, numY)
  DEFAULT_CHAT_FRAME:AddMessage("|cff00ffcc[WoWF 无限百科]|r 已在世界地图标记坐标: " .. worldMapLink .. " |cffaaaaaa(Shift+点击坐标可直接发到聊天框)|r")
end

local function SetWaypointOrPrint(zone, name, x, y, explicitMapID)
  OpenMapAndSetWaypoint(zone, name, x, y, explicitMapID)
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

local function FormatCoordLink(zone, label, x, y, prefixSpace)
  local numX = tonumber(x)
  local numY = tonumber(y)
  if not numX or not numY then return "" end
  local mapID = ResolveUiMapID(zone, label)
  local safeZone = SanitizeLinkField((zone and zone ~= "") and zone or label)
  local safeLabel = SanitizeLinkField((label and label ~= "") and label or zone)
  local sp = (prefixSpace == false) and "" or " "
  return string.format(
    "%s|cff00ffcc|Hwowfmap:%d:%.1f:%.1f:%s:%s|h[%.1f, %.1f]|h|r",
    sp, mapID, numX, numY, safeZone, safeLabel, numX, numY
  )
end

local function FormatNpcMapLink(zone, npc, x, y)
  local zText = (zone and zone ~= "") and zone or ""
  local nText = (npc and npc ~= "") and npc or ""
  local displayName = (nText ~= "") and nText or ((zText ~= "") and zText or "坐标")
  local numX = tonumber(x)
  local numY = tonumber(y)
  local linkPart
  if numX and numY then
    local mapID = ResolveUiMapID(zText, nText)
    local safeZone = SanitizeLinkField((zText ~= "") and zText or nText)
    local safeLabel = SanitizeLinkField((nText ~= "") and nText or zText)
    linkPart = string.format(
      "|cff00ffcc|Hwowfmap:%d:%.1f:%.1f:%s:%s|h[%s]|h|r",
      mapID, numX, numY, safeZone, safeLabel, displayName
    )
  else
    linkPart = "|cff00ffcc" .. displayName .. "|r"
  end
  if zText ~= "" and nText ~= "" then
    return zText .. " " .. linkPart
  end
  return linkPart
end

local function FormatStepNpcInfo(st, fallbackZone)
  if type(st) ~= "table" then return "" end
  local stZone = (st.zone and st.zone ~= "") and st.zone or (fallbackZone or "")
  local hasStart = (st.npc and st.npc ~= "") or (st.x ~= nil and st.y ~= nil) or (stZone ~= "")
  local startStr = hasStart and FormatNpcMapLink(stZone, st.npc, st.x, st.y) or ""
  local endZone = (st.endZone and st.endZone ~= "") and st.endZone or stZone
  local hasEnd = st.endNpc and st.endNpc ~= "" and (st.endNpc ~= st.npc or endZone ~= stZone or st.endX ~= st.x or st.endY ~= st.y)
  if hasEnd then
    local endStr = FormatNpcMapLink(endZone, st.endNpc, st.endX, st.endY)
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
    local bestLen = 0
    for _, kw in ipairs(ORDERED_ZONE_KEYWORDS) do
      local pos = 1
      while true do
        local s, e = string.find(prefixText, kw, pos, true)
        if not s then break end
        if s > bestPos or (s == bestPos and #kw > bestLen) then
          bestPos = s
          bestLen = #kw
          bestKw = kw
        end
        pos = e + 1
      end
    end
    if bestKw then
      return bestKw
    end
  end
  return fallbackZone or ""
end

local function LinkifyInlineCoords(text, defaultZone, defaultLabel)
  if not text or text == "" then return "" end
  local out = tostring(text)
  -- 将中文全角括号内的坐标统一转为半角括号再替换为可点击地图链接
  out = string.gsub(out, "（(%d+%.?%d*)%s*[,，]%s*(%d+%.?%d*)）", "(%1, %2)")
  local result = {}
  local lastPos = 1
  while true do
    local s, e, xStr, yStr = string.find(out, "%((%d+%.?%d*)%s*,%s*(%d+%.?%d*)%)", lastPos)
    if not s then
      table.insert(result, string.sub(out, lastPos))
      break
    end
    local before = string.sub(out, lastPos, s - 1)
    table.insert(result, before)
    local nx = tonumber(xStr)
    local ny = tonumber(yStr)
    if nx and ny and nx >= 1 and nx <= 99.9 and ny >= 1 and ny <= 99.9 then
      local contextStart = math.max(1, s - 60)
      local recentText = string.sub(out, contextStart, s - 1)
      local inferredZone = DetectZoneInPrefix(recentText, defaultZone)
      table.insert(result, FormatCoordLink(inferredZone, defaultLabel or inferredZone, nx, ny, false))
    else
      table.insert(result, string.sub(out, s, e))
    end
    lastPos = e + 1
  end
  return table.concat(result, "")
end

local questMetaById = {}
local questMetaByKey = {}

local function GetQuestMetaKey(qid, faction)
  if qid and (faction == "alliance" or faction == "horde") then
    return tostring(qid) .. ":" .. faction
  end
  return nil
end

local function LookupQuestMeta(qid, faction)
  local key = GetQuestMetaKey(qid, faction)
  if key and questMetaByKey[key] then
    return questMetaByKey[key]
  end
  return qid and questMetaById[qid] or nil
end

local function RegisterQuestMeta(q, fallbackLevel, fallbackZone)
  if type(q) ~= "table" then return end
  local qid = tonumber(q.id or q.questId)
  if not qid or qid <= 0 then return end
  local metaKey = GetQuestMetaKey(qid, q.faction)
  local prev = (metaKey and questMetaByKey[metaKey]) or questMetaById[qid] or {}
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
  questMetaById[qid] = entry
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

local function HasGatheringProfession(profs)
  return HasPlayerProfession(profs, "采矿", "Mining")
    or HasPlayerProfession(profs, "草药学", "Herbalism")
    or HasPlayerProfession(profs, "剥皮", "Skinning")
end

local function BuildLegacyRecommendationLines(lvl, profs, compact)
  local hasGather = HasGatheringProfession(profs)
  local hasDualHerbMine = HasPlayerProfession(profs, "采矿", "Mining") and HasPlayerProfession(profs, "草药学", "Herbalism")
  local isMax = (lvl or 1) >= 60

  local planTitle, planDesc, steps
  if isMax then
    planTitle = "满级综合推荐 (充裕 9 点 + 专业 5 点 + 冒险 2 点)"
    planDesc = "60 级以声望外交、材料节省与双采/制造效率为核心，优先点出【充裕树】与【专业树】关键节点。"
    steps = {
      { fromPt = 1, toPt = 5, pts = "第 1–5 点", tree = "充裕", text = "外交官（声望加成）& 材料节省（冲声望与降低施法/消耗品开销必点）" },
      { fromPt = 6, toPt = 9, pts = "第 6–9 点", tree = "充裕", text = "恒久（食物/药水持续）& 美食家（降低日常与团本补给开销）" },
      { fromPt = 10, toPt = 14, pts = "第 10–14 点", tree = "专业", text = hasDualHerbMine and "加班加点（采集/制造技能提升）& 专研 / 讨价还价（已学双采高收益）" or "加班加点（专业技能提升）& 专研 / 讨价还价（提高制造效率与商人折扣）" },
      { fromPt = 15, toPt = 16, pts = "第 15–16 点", tree = "冒险", text = "常客（飞行加速）& 高度警戒 / 战地医疗（日常赶路与续航便利）" },
    }
  elseif hasGather then
    planTitle = "练级+采集推荐 (冒险 10 点 + 专业 4 点 + 充裕 2 点)"
    planDesc = "当前角色已学采集专业，推荐优先点出【冒险树】休息经验与续航节点，并搭配【专业树】提升采集与制造技能增长。"
    steps = {
      { fromPt = 1, toPt = 4, pts = "第 1–4 点", tree = "冒险", text = "充分休息（休息经验加成）& 冒险刺激（战斗后恢复，提升练级续航）" },
      { fromPt = 5, toPt = 7, pts = "第 5–7 点", tree = "冒险", text = "野外指南（露营设施冷却缩减）& 战地医疗（绷带虚弱时间减免）" },
      { fromPt = 8, toPt = 10, pts = "第 8–10 点", tree = "冒险", text = "常客（飞行加速）& 高度警戒 / 天赋点解锁（加快跨图赶路与战斗能力）" },
      { fromPt = 11, toPt = 14, pts = "第 11–14 点", tree = "专业", text = hasDualHerbMine and "加班加点 & 专研 / 讨价还价（提升采矿/草药技能点获取与商人折扣）" or "加班加点 & 专研 / 讨价还价（提升采集/制造技能点获取与商人折扣）" },
      { fromPt = 15, toPt = 16, pts = "第 15–16 点", tree = "充裕", text = "材料节省 & 恒久（减少技能材料与食物药水补给开销）" },
    }
  else
    planTitle = "纯练级通用推荐 (冒险 11 点 + 充裕 5 点)"
    planDesc = "练级期休息经验、战后恢复与飞行加速收益最高，推荐优先投入【冒险树】，剩余点数投入【充裕树】节省消耗并铺垫声望。"
    steps = {
      { fromPt = 1, toPt = 4, pts = "第 1–4 点", tree = "冒险", text = "充分休息（休息经验加成）& 冒险刺激（战斗后恢复，提升练级续航）" },
      { fromPt = 5, toPt = 7, pts = "第 5–7 点", tree = "冒险", text = "野外指南（露营设施冷却缩减）& 战地医疗（绷带虚弱时间减免）" },
      { fromPt = 8, toPt = 11, pts = "第 8–11 点", tree = "冒险", text = "常客（飞行加速）& 高度警戒 / 天赋点解锁（加快鸟点飞行并强化实战）" },
      { fromPt = 12, toPt = 14, pts = "第 12–14 点", tree = "充裕", text = "材料节省 & 恒久（降低技能/施法材料与补给开销）" },
      { fromPt = 15, toPt = 16, pts = "第 15–16 点", tree = "充裕", text = "外交官（声望获取加成，为满级声望提前铺垫）" },
    }
  end

  if compact then
    local merged = {}
    for _, st in ipairs(steps) do
      local last = merged[#merged]
      if last and last.tree == st.tree then
        last.toPt = st.toPt
      else
        table.insert(merged, { tree = st.tree, fromPt = st.fromPt, toPt = st.toPt })
      end
    end
    local seqParts = {}
    for _, m in ipairs(merged) do
      table.insert(seqParts, string.format("[%s] 第 %d–%d 点", m.tree, m.fromPt, m.toPt))
    end
    return {
      string.format(">> |cff00ff00当前推荐方案:|r |cffffd100%s|r", planTitle),
      "|cff99e6ff加点顺序:|r " .. table.concat(seqParts, " -> "),
      "|cffaaaaaa(详细 1–16 点逐阶分配方案见 [专业&无限特色] 页)|r",
    }
  end

  local lines = {
    string.format("|cff00ff96>> 当前角色推荐方案 (Lv.%d):|r |cffffd100%s|r", lvl or 1, planTitle),
    planDesc,
    "",
    "|cffffd100★ 1–16 点逐阶推荐加点顺序（单角色上限 16 点）:|r",
  }
  for _, st in ipairs(steps) do
    table.insert(lines, string.format("  |cff00ff00%s|r  |cffffd100[%s]|r %s", st.pts, st.tree, st.text))
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
local function ResolveQuestieNpc(npcIds)
  if type(npcIds) ~= "table" or not _G.NpcDB then return nil end
  local npcId = tonumber(npcIds[1])
  if not npcId or npcId <= 0 then return nil end
  if questieNpcCache[npcId] ~= nil then
    return questieNpcCache[npcId] or nil
  end
  local name = _G.NpcDB.name and _G.NpcDB.name(npcId) or ""
  local spawns = _G.NpcDB.spawns and _G.NpcDB.spawns(npcId)
  local prefZoneId = _G.NpcDB.zoneID and _G.NpcDB.zoneID(npcId)
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
  local zoneName = ""
  if areaId and C_Map and C_Map.GetAreaInfo then
    local ok, z = pcall(C_Map.GetAreaInfo, areaId)
    if ok and type(z) == "string" then zoneName = z end
  end
  if name == "" and not x then
    questieNpcCache[npcId] = false
    return nil
  end
  local res = { npc = name, zone = zoneName, x = x, y = y }
  questieNpcCache[npcId] = res
  return res
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
      local startInfo = ResolveQuestieNpc(started and started[1])
      local endInfo = ResolveQuestieNpc(finished and finished[1])
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
  return {
    id = raw.id,
    name = raw.name,
    level = raw.level or fallbackObj.level,
    minLevel = raw.minLevel or fallbackObj.minLevel,
    npc = raw.npc or fallbackObj.npc or "",
    zone = raw.zone or fallbackObj.zone or "",
    x = raw.x or fallbackObj.x,
    y = raw.y or fallbackObj.y,
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
        if npid and npid > 0 then table.insert(preG, npid) end
      end
    end
    local preS = {}
    if type(info.preSingle) == "table" then
      for _, pid in ipairs(info.preSingle) do
        local npid = tonumber(pid)
        if npid and npid > 0 then table.insert(preS, npid) end
      end
    end
    local reqAll, singlePre = nil, nil
    if #preG > 1 then
      reqAll = preG
      for _, pid in ipairs(preG) do
        collectPre(pid, depth + 1)
      end
    elseif #preG == 1 then
      singlePre = preG[1]
      collectPre(singlePre, depth + 1)
    elseif #preS == 1 then
      singlePre = preS[1]
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
      q.npc = firstSt.npc ~= "" and firstSt.npc or q.npc
      q.zone = firstSt.zone ~= "" and firstSt.zone or q.zone
      q.x = firstSt.x or q.x
      q.y = firstSt.y or q.y
    else
      q.npc = mainInfo.npc ~= "" and mainInfo.npc or q.npc
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
  local out = {}
  for i, q in ipairs(list) do
    local ids = {}
    if type(q.steps) == "table" and #q.steps > 0 then
      for _, st in ipairs(q.steps) do table.insert(ids, tonumber(st.id)) end
    else
      table.insert(ids, tonumber(q.id or q.questId))
    end
    local redundant = false
    for j, other in ipairs(list) do
      if i ~= j and (other.faction == q.faction or other.faction == "both") and classesCover(other, q) then
        local oIds = {}
        if type(other.steps) == "table" and #other.steps > 0 then
          for _, st in ipairs(other.steps) do table.insert(oIds, tonumber(st.id)) end
        else
          table.insert(oIds, tonumber(other.id or other.questId))
        end
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
            for k = 1, #oIds do
              if oIds[k] ~= ids[offset + k] then match = false break end
            end
            if match then redundant = true break end
          end
        elseif #oIds == #ids then
          local match = true
          local sameSteps = (type(other.steps) == "table" and type(q.steps) == "table")
          for k = 1, #oIds do
            if oIds[k] ~= ids[k] or (sameSteps and not sameStepDeps(other.steps[k], q.steps[k])) then
              match = false
              break
            end
          end
          if match then
            local sameClassScope = classesCover(q, other)
            if (not sameClassScope) or (other.faction == "both" and q.faction ~= "both") or (other.faction == q.faction and j < i) then
              redundant = true
              break
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

local function GetQuestChainFoldKey(q)
  local qid = tonumber(q and (q.id or q.questId))
  if not qid or qid <= 0 then return nil end
  return string.format("%d:%s", qid, tostring(q.faction or ""))
end

local function GetQuestStepFoldKey(sid, faction)
  local stepId = tonumber(sid)
  if not stepId or stepId <= 0 then return nil end
  return string.format("step:%d:%s", stepId, tostring(faction or ""))
end

local function GetSharedPrefixFoldKey(sid, faction)
  local stepId = tonumber(sid)
  if not stepId or stepId <= 0 then return nil end
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
          if npid and visibleById[npid] then table.insert(parentIds, npid) end
        end
      end
      if #parentIds == 0 then
        local npid = tonumber(st.preId)
        if npid and visibleById[npid] then table.insert(parentIds, npid) end
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
    if (q.faction == "both" or q.faction == f) and MatchesQuestClass(q, classKey) then
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
  local primary = FormatQuestLink(q, fallbackLevel, fallbackZone, chainDone)
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
      local stepObj = {
        id = sid,
        faction = q.faction,
        name = st.name or q.name,
        level = st.level or q.level or q.minLevel or fallbackLevel,
        npc = (st.npc and st.npc ~= "") and st.npc or (isPrimary and q.npc or ""),
        zone = stZone,
        place = (st.place and st.place ~= "") and st.place or (isPrimary and q.place or ""),
        x = st.x or (isPrimary and q.x or nil),
        y = st.y or (isPrimary and q.y or nil),
      }
      local link = FormatQuestLink(stepObj, fallbackLevel, stZone, chainDone)
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
        npc = (st.npc and st.npc ~= "") and st.npc or (isPrimary and q.npc or ""),
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
            if npid and stepById[npid] then
              local pd = emitStep(npid)
              if pd > maxParentDepth then maxParentDepth = pd end
            end
          end
        else
          local npid = tonumber(st.preId)
          if npid and stepById[npid] then
            maxParentDepth = emitStep(npid)
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

local function FormatSharedPrefixGroup(grp, fallbackLevel, fallbackZone, baseIndent, foldCompletedPrefix)
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
      stepFoldKey = GetQuestStepFoldKey(sid, q1.faction)
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
      level = lastPre.level or q1.level,
      minLevel = q1.minLevel or fallbackLevel,
      npc = (lastPre.npc and lastPre.npc ~= "") and lastPre.npc or q1.npc,
      zone = preZone,
      place = (lastPre.place and lastPre.place ~= "") and lastPre.place or q1.place,
      x = (lastPre.x ~= nil) and lastPre.x or q1.x,
      y = (lastPre.y ~= nil) and lastPre.y or q1.y,
      steps = prefixSteps,
    }
    local prefixFoldKey = GetSharedPrefixFoldKey(lastPre.id, q1.faction)
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
      branchFoldKey = GetQuestChainFoldKey(bq)
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

local function FormatBandZonesTitle(band)
  if not band then return "" end
  local hubName = (band.hub and band.hub.name ~= "") and band.hub.name or band.zone
  if not band.altZones or #band.altZones == 0 then
    return string.format("|cff00ffcc%s|r (%s)", band.zone or "", hubName or "")
  end
  local names = {}
  if band.zone and band.zone ~= "" then
    table.insert(names, band.zone)
  end
  for _, az in ipairs(band.altZones) do
    if az.zone and az.zone ~= "" then
      table.insert(names, az.zone)
    end
  end
  return string.format("|cff00ffcc%s|r", table.concat(names, " / "))
end

local function FormatBandZonesBlock(band, headerLabel)
  if not band or not band.altZones or #band.altZones == 0 then
    return nil
  end
  local hubName = (band.hub and band.hub.name ~= "") and band.hub.name or ""
  local hubCoord = (band.hub and band.hub.x and band.hub.y) and FormatCoordLink(band.zone, (hubName ~= "") and hubName or band.zone, band.hub.x, band.hub.y) or ""
  local hubPart = (hubName ~= "") and (hubName .. " ") or ""
  local zoneLines = {
    string.format(
      "  · |cff00ffcc%s|r (%sLv.%d-%d)%s",
      band.zone or "",
      hubPart,
      band.from or 1,
      band.to or 60,
      hubCoord
    )
  }
  for _, az in ipairs(band.altZones) do
    local ac = (az.x and az.y) and FormatCoordLink(az.zone, (az.hub and az.hub ~= "") and az.hub or az.zone, az.x, az.y) or ""
    local azHubPart = (az.hub and az.hub ~= "") and (az.hub .. " ") or ""
    local noteStr = (az.note and az.note ~= "") and (" — " .. az.note) or ""
    table.insert(zoneLines, string.format(
      "  · |cff00ffcc%s|r (%sLv.%d-%d)%s%s",
      az.zone or "",
      azHubPart,
      az.from or band.from or 1,
      az.to or band.to or 60,
      ac,
      noteStr
    ))
  end
  return string.format("|cffffd100%s:|r\n%s", headerLabel or "适龄练级区域 (可自由切换/穿插)", table.concat(zoneLines, "\n"))
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
    GameTooltip:AddLine(string.format("|cff00ffcc[坐标导航]|r %s", (label and label ~= "" and label ~= "-") and label or (zone or "目标点")))
    if zone and zone ~= "" and zone ~= "-" then
      GameTooltip:AddLine(string.format("区域: |cffffd100%s|r (MapID: %s)", zone, mapID or "?"))
    end
    if nx and ny then
      GameTooltip:AddLine(string.format("坐标: |cff00ff00%.1f, %.1f|r", nx, ny))
    end
    GameTooltip:AddLine(" ")
    GameTooltip:AddLine("|cff00ff00左键点击:|r 打开世界地图并标记坐标")
    GameTooltip:AddLine("|cff00ff00Shift+左键:|r 插入地图链接到聊天框")
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
        GameTooltip:AddLine(string.format("坐标: |cff00ff00%.1f, %.1f|r", meta.x, meta.y))
      end
    end
    GameTooltip:AddLine(" ")
    GameTooltip:AddLine("|cff00ff00左键 / Shift+左键:|r 发送任务链接到聊天框")
    if meta and meta.x and meta.y then
      GameTooltip:AddLine("|cff00ff00右键点击:|r 打开世界地图标记接取坐标")
    end
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
    if IsShiftKeyDown and IsShiftKeyDown() and nx and ny then
      local sx = math.floor(nx * 100 + 0.5)
      local sy = math.floor(ny * 100 + 0.5)
      local wmLink = string.format("|cffffff00|Hworldmap:%d:%d:%d|h[%s · %s (%.1f, %.1f)]|h|r", mid or 1429, sx, sy, zText ~= "" and zText or "地图", lText ~= "" and lText or "坐标", nx, ny)
      InsertLinkToChat(wmLink)
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

local function HideUnusedCards(fromIndex)
  for i = fromIndex, #cardPool do
    cardPool[i]:Hide()
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
-- 5. 六大核心标签页渲染器
-- ============================================================================

local function RenderTabSmartMatch()
  local cardIdx = 1
  local y = 6
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
    "|cff00ffcc当前匹配角色:|r |cffffd100Lv.%d %s · %s (%s)|r  ·  |cff99e6ff阵营路线:|r %s (%s)%s",
    lvl,
    route and route.name or state.routeId,
    cls and cls.name or state.classKey,
    spec and spec.name or "默认专精",
    route and route.name or state.routeId,
    state.faction == "horde" and "|cffff5555部落|r" or "|cff44aaff联盟|r",
    zoneTag
  ))
  if recProfs ~= "" then
    table.insert(overviewLines, "|cff00ff96专精推荐专业:|r " .. recProfs .. "   |cffaaaaaa(上方控制栏可自由切换等级、职业、专精与种族路线)|r")
  end
  table.insert(overviewLines, "|cff99e6ff交互提示:|r |cff00ffcc点击蓝绿坐标|r 直接打开世界地图标记点 (Shift+点击发到聊天)；|cffffff00点击黄色任务链接|r 直接插入聊天框发送 (右键标记接取点)。")
  local playerProfs = GetPlayerProfessions()
  if lvl >= 14 and lvl < 60 and not IsQuestCompletedById(79975) then
    if HasPlayerProfession(playerProfs, "制皮", "Leatherworking") then
      table.insert(overviewLines, "|cffffd100★ 无限服经验加速提醒:|r 14级起记得完成【舒适的睡袋】四步任务常驻 |cff00ff00+8% 经验值|r，并在野外利用制皮【营地帐篷】快速攒双倍经验！")
    else
      table.insert(overviewLines, "|cffffd100★ 无限服经验加速提醒:|r 14级起记得完成【舒适的睡袋】四步任务常驻 |cff00ff00+8% 经验值|r（详见证件/任务指引见[专业&无限特色]页）！")
    end
  end

  local c1 = AcquireCard(cardIdx); cardIdx = cardIdx + 1
  y = LayoutCard(
    c1, y,
    string.format("|cff00ffcc>> Lv.%d %s·%s·%s 智能匹配总览|r", lvl, route and route.name or "", cls and cls.name or "", spec and spec.name or ""),
    table.concat(overviewLines, "\n"),
    { 0.0, 0.85, 0.7, 0.95 },
    { 0.05, 0.14, 0.16, 0.95 },
    "|cff00ffccwowf.io 实时引擎|r"
  )

  -- 2. 当前等级推荐区域与营地导航（按当前种族+职业+专精精准匹配）
  if band then
    local bandLines = {}
    local hubName = (band.hub and band.hub.name ~= "") and band.hub.name or band.zone
    local coordStr = (band.hub and band.hub.x and band.hub.y) and FormatCoordLink(band.zone, hubName, band.hub.x, band.hub.y) or ""
    local zonesBlock = FormatBandZonesBlock(band, "当前适龄练级区域 (平级推荐，可自由切换)")
    if zonesBlock then
      table.insert(bandLines, zonesBlock)
    else
      table.insert(bandLines, string.format("|cffffd100当前练级区域:|r |cff00ffcc%s|r   ·   |cffffd100核心营地/城镇:|r %s%s", band.zone or "未知", hubName or "", coordStr))
    end

    if not zonesBlock and band.hubs and #band.hubs > 1 then
      local subHubs = {}
      for _, h in ipairs(band.hubs) do
        local hc = (h.x and h.y) and FormatCoordLink(band.zone, h.name, h.x, h.y) or ""
        local activeMark = (lvl >= (h.from or 1) and lvl <= (h.to or 60)) and "|cff00ff00★|r" or ""
        table.insert(subHubs, string.format("%s%s[Lv.%d-%d]%s", activeMark, h.name or "", h.from or band.from, h.to or band.to, hc))
      end
      table.insert(bandLines, "|cff99e6ff本区分阶段据点:|r " .. table.concat(subHubs, " -> "))
    end

    if band.flights and #band.flights > 0 then
      local fList = {}
      for _, fl in ipairs(band.flights) do
        local flZone = (fl.zone and fl.zone ~= "") and fl.zone or band.zone
        local fc = (fl.x and fl.y) and FormatCoordLink(flZone, (fl.place or "") .. " " .. (fl.name or "飞行点"), fl.x, fl.y) or ""
        table.insert(fList, string.format("%s %s%s", fl.place or "", fl.name or "", fc))
      end
      table.insert(bandLines, "|cff99e6ff[飞行点] 解锁鸟点:|r " .. table.concat(fList, "  /  "))
    end

    local matchedTrainer = GetBandTrainer(band, state.classKey, state.faction)
    if matchedTrainer and matchedTrainer.name ~= "" then
      local tZone = (matchedTrainer.zone and matchedTrainer.zone ~= "") and matchedTrainer.zone or (matchedTrainer.place or band.zone)
      local tCoord = (matchedTrainer.x and matchedTrainer.y) and FormatCoordLink(tZone, matchedTrainer.name, matchedTrainer.x, matchedTrainer.y) or ""
      table.insert(bandLines, string.format("|cff71d5ff%s训练师:|r |cffffd100%s|r (%s · %s)%s", cls and cls.name or "职业", matchedTrainer.name, matchedTrainer.title or "职业训练师", matchedTrainer.place or band.zone or "", tCoord))
    end

    local matchedQuests = GetBandQuests(band, state.classKey)
    if matchedQuests and #matchedQuests > 0 then
      local qLines = {}
      for _, q in ipairs(matchedQuests) do
        local qZone = (q.zone and q.zone ~= "") and q.zone or (q.place or band.zone)
        local qc = (q.x and q.y) and FormatCoordLink(qZone, (q.npc and q.npc ~= "") and q.npc or q.name, q.x, q.y) or ""
        local qTag = (q.kind == "class") and "|cff00ffcc[★职业专属]|r " or "|cffffd100[关键任务]|r "
        local qLink, qTree = FormatQuestWithSteps(q, q.level or band.from, qZone, "      ")
        table.insert(qLines, string.format("  - %s%s (Lv.%d) — %s %s%s", qTag, qLink, q.level or band.from, q.place or "", q.npc or "", qc))
        if qTree then table.insert(qLines, qTree) end
      end
      table.insert(bandLines, "|cff00ffcc本阶段关键/职业任务:|r\n" .. table.concat(qLines, "\n"))
    end

    if band.professions and #band.professions > 0 then
      local pList = {}
      for _, p in ipairs(band.professions) do
        local pZone = (p.zone and p.zone ~= "") and p.zone or band.zone
        local pLabel = (p.name or "") .. ((p.trainer and p.trainer ~= "") and (" " .. p.trainer) or "") .. ((p.place and p.place ~= "") and (" (" .. p.place .. ")") or "")
        local pc = (p.x and p.y) and FormatCoordLink(pZone, pLabel, p.x, p.y) or ""
        local isRec = (recProfs ~= "" and string.find(recProfs, p.name or "", 1, true) ~= nil)
        local recMark = isRec and "|cff00ff00★推荐|r" or ""
        table.insert(pList, string.format("|cff00ff96[%s%s]|r %s%s", p.name, recMark, p.trainer or "", pc))
      end
      table.insert(bandLines, "|cff00ff96本区专业训练师:|r " .. table.concat(pList, "  /  "))
    end

    if band.dungeonQuests and #band.dungeonQuests > 0 then
      local dqList = {}
      for _, dq in ipairs(band.dungeonQuests) do
        if not IsQuestCompleted(dq) then
          local dqZone = (dq.zone and dq.zone ~= "") and dq.zone or (dq.place or band.zone)
          local dqc = (dq.x and dq.y) and FormatCoordLink(dqZone, (dq.npc and dq.npc ~= "") and dq.npc or dq.name, dq.x, dq.y) or ""
          local dqLink = FormatQuestLink(dq, dq.level or lvl, dqZone)
          local acceptTag = (not IsQuestLineStarted(dq)) and string.format(" (可接 Lv.%d)", dq.level or lvl) or ""
          table.insert(dqList, string.format("  - |cffff8000[%s]|r %s%s — 接取: %s %s%s", dq.dungeon, dqLink, acceptTag, dq.place or "", dq.npc or "", dqc))
        end
      end
      if #dqList > 0 then
        table.insert(bandLines, "|cffffa500本阶段顺路必接副本任务:|r\n" .. table.concat(dqList, "\n"))
      end
    end

    local cBand = AcquireCard(cardIdx); cardIdx = cardIdx + 1
    y = LayoutCard(
      cBand, y,
      string.format("|cffffd100[路线] 当前角色升级导航 (Lv.%d-%d · |r%s|cffffd100 · %s)|r", band.from, band.to, FormatBandZonesTitle(band), route and route.name or ""),
      table.concat(bandLines, "\n"),
      { 0.9, 0.75, 0.2, 0.9 },
      { 0.11, 0.10, 0.06, 0.92 },
      string.format("Lv.%d-%d", band.from, band.to),
      (band.hub and band.hub.x) and "标记营地坐标" or nil,
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
        table.insert(tLines, string.format(">> |cff00ff00Lv.%d 本级必点天赋:|r |cffffd100[%s] %s (第 %d/%d 点)|r", lvl, talentStep.tree, talentStep.name, talentStep.rank, talentStep.max))
      end
      local nextPreview = {}
      for nextLvl = lvl + 1, math.min(60, lvl + 4) do
        local ns = GetMatchedTalentStep(spec, nextLvl)
        if ns then
          table.insert(nextPreview, string.format("Lv.%d: [%s] %s (%d/%d)", nextLvl, ns.tree, ns.name, ns.rank, ns.max))
        end
      end
      if #nextPreview > 0 then
        table.insert(tLines, "|cff99e6ff后续等级加点预告:|r " .. table.concat(nextPreview, "  ->  "))
      end
    end

    local cTalent = AcquireCard(cardIdx); cardIdx = cardIdx + 1
    y = LayoutCard(
      cTalent, y,
      string.format("|cffffd100★ Lv.%d 天赋加点指引 (%s·%s)|r", lvl, cls and cls.name or "", spec.name),
      table.concat(tLines, "\n"),
      { 0.35, 0.65, 0.95, 0.9 },
      { 0.07, 0.11, 0.17, 0.92 },
      "点击[职业与天赋]看完整10-60表"
    )
  end

  -- 3.5 经典旧世(传承)点数推荐 (单角色上限 16 点)
  do
    local legacyCompactLines = BuildLegacyRecommendationLines(lvl, playerProfs, true)
    local cLegacy = AcquireCard(cardIdx); cardIdx = cardIdx + 1
    y = LayoutCard(
      cLegacy, y,
      string.format("|cff00ffcc★ Lv.%d 传承点数(经典旧世树)加点推荐 (单角色上限 16 点)|r", lvl),
      table.concat(legacyCompactLines, "\n"),
      { 0.0, 0.85, 0.7, 0.9 },
      { 0.05, 0.12, 0.14, 0.92 },
      "点击[专业&无限特色]看1-16点详表"
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
      table.insert(rotLines, "\n|cffffd100【野外实战细节】|r\n" .. LinkifyInlineCoords(phase.note, band and band.zone or "", "实战点"))
    end
    local dTip = GetMatchedDungeonTip(spec, lvl)
    if dTip and dTip.text ~= "" then
      table.insert(rotLines, "\n|cffff8000【当前等级地下城战斗指南 (Lv." .. dTip.from .. "-" .. dTip.to .. ")】|r\n" .. LinkifyInlineCoords(dTip.text, band and band.zone or "", "副本点"))
    end

    local cRot = AcquireCard(cardIdx); cardIdx = cardIdx + 1
    y = LayoutCard(
      cRot, y,
      string.format("|cff71d5ff[战斗] 当前等级输出手法与循环 (Lv.%d-%d)|r", phase.from, phase.to),
      table.concat(rotLines, "\n"),
      { 0.3, 0.75, 0.95, 0.9 },
      { 0.06, 0.10, 0.15, 0.92 },
      string.format("Lv.%d-%d 阶段", phase.from, phase.to)
    )
  end

  -- 5. 当前等级种族+职业专属任务链与关键里程碑
  local milestoneLines = {}
  if spec and spec.musts then
    for _, m in ipairs(spec.musts) do
      local mLvl = m.level or 1
      if mLvl >= lvl - 2 and mLvl <= lvl + 10 then
        local tag = (mLvl == lvl) and "|cff00ff00[当前等级必做]|r " or string.format("|cffffd100[Lv.%d 专精要点]|r ", mLvl)
        table.insert(milestoneLines, "  - " .. tag .. LinkifyInlineCoords(m.text or "", band and band.zone or "", spec.name or "要点"))
      end
    end
  end
  for _, cr in ipairs(matchedClassRuns) do
    local crTo = cr.to or cr.level or 60
    if lvl >= (cr.level - 4) and crTo >= lvl - 2 then
      local teachStr = (cr.teaches and cr.teaches ~= "") and (" -> 奖励技能: |cff71d5ff[" .. cr.teaches .. "]|r") or ""
      local firstStep = cr.steps and cr.steps[1]
      local stepZone = (firstStep and firstStep.zone ~= "") and firstStep.zone or (band and band.zone or "")
      local sc = (firstStep and firstStep.x and firstStep.y) and FormatCoordLink(stepZone, firstStep.npc or cr.name, firstStep.x, firstStep.y) or ""
      local npcInfo = firstStep and string.format(" — 起始: %s %s |cff99e6ff%s|r%s", firstStep.zone or "", firstStep.place or "", firstStep.npc or "", sc) or ""
      local crLink, crTree = FormatQuestWithSteps(cr, cr.level, stepZone, "      ")
      table.insert(milestoneLines, string.format("  - |cff00ffcc[Lv.%d %s·%s专属任务链]|r %s%s%s", cr.level, route and route.name or "", cls and cls.name or "", crLink, teachStr, npcInfo))
      if crTree then table.insert(milestoneLines, crTree) end
    end
  end
  if #milestoneLines > 0 then
    local cMile = AcquireCard(cardIdx); cardIdx = cardIdx + 1
    y = LayoutCard(
      cMile, y,
      string.format("|cff00ff96★ 当前阶段 %s·%s 关键里程碑与专属职业任务|r", route and route.name or "", cls and cls.name or ""),
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
      local entCoord = (d.entranceX and d.entranceY) and FormatCoordLink(d.entranceZone or d.zone, d.name .. "入口", d.entranceX, d.entranceY) or ""
      table.insert(dLines, string.format(
        "|cffff8000[%s]|r (Lv.%d-%d · 推荐 %d 级进本 · %s%s)%s",
        d.name, d.minLevel, d.maxLevel, d.visit or d.minLevel, d.zone or "", entCoord, newTag
      ))
      local matchedDunQuests = {}
      for _, q in ipairs(DedupeQuestieQuests(d.quests or {})) do
        if (q.faction == "both" or q.faction == state.faction) and MatchesQuestClass(q) and (not IsQuestCompleted(q)) then
          table.insert(matchedDunQuests, q)
        end
      end
      local qCount = 0
      for _, grp in ipairs(GroupQuestsBySharedPrefix(matchedDunQuests)) do
        if qCount >= 8 then break end
        qCount = qCount + #grp.quests
        local q = grp.quests[1]
        local qZone = (q.zone and q.zone ~= "") and q.zone or (d.entranceZone or d.zone or "")
        local acceptTag = (not IsQuestLineStarted(q)) and string.format(" (可接 Lv.%d)", q.minLevel or d.minLevel) or ""
        local npcInfo = FormatStepNpcInfo(q, qZone)
        if npcInfo == "" and q.inside then npcInfo = "(副本内接取)" end
        local npcSuffix = (npcInfo ~= "") and (" — " .. npcInfo) or ""
        if #grp.quests > 1 and grp.prefixLen >= 1 then
          local headerPrefix, treeBody = FormatSharedPrefixGroup(grp, d.minLevel, qZone, "        ", true)
          local branchTag = string.format("[共%d条分支任务链]", #grp.quests)
          table.insert(dLines, string.format("    └ 任务: %s%s%s%s", headerPrefix, branchTag, acceptTag, npcSuffix))
          table.insert(dLines, treeBody)
        else
          local chainTag = (q.stepCount and q.stepCount > 1) and string.format(q.hasPrereq and " [共%d步·含前置]" or " [共%d步]", q.stepCount) or ""
          local qLink, qTree = FormatQuestWithSteps(q, q.minLevel or d.minLevel, qZone, "        ", true)
          table.insert(dLines, string.format("    └ 任务: %s%s%s%s", qLink, acceptTag, chainTag, npcSuffix))
          if qTree then table.insert(dLines, qTree) end
        end
      end
    end
    local cDun = AcquireCard(cardIdx); cardIdx = cardIdx + 1
    y = LayoutCard(
      cDun, y,
      string.format("|cffff8000[副本] 适合当前等级 (Lv.%d) 的地下城与任务 (%d个)|r", lvl, #matchedDungeons),
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
  local lvl = state.level
  local route = GetCurrentRoute()
  local cls = GetCurrentClassData()
  local spec = GetCurrentSpecData()
  if not route or not route.bands then
    HideUnusedCards(1)
    return
  end

  local recProfs = (spec and spec.recommendedProfs) or ""
  local matchedClassRuns = GetCurrentClassRuns(route, cls, state.faction)
  local phase = GetMatchedPhase(spec, lvl)
  local isMatchMode = (state.routeFilter == "MATCH") and (not state.searchQuery or state.searchQuery == "")
  local toggleBtnLabel = state.routeFilter == "MATCH" and "查看 1-60 全程" or "仅看当前匹配"
  local modeDesc = state.routeFilter == "MATCH"
    and string.format("已按您的角色自动聚焦 |cffffd100Lv.%d|r 当前阶段及后续衔接路线（点击右上角按钮可展开 1–60 全部 %d 个阶段）", lvl, #route.bands)
    or string.format("当前显示 1–60 级完整全部 %d 个阶段（点击右上角按钮可聚焦回当前角色等级阶段）", #route.bands)

  local headerLines = {
    string.format(
      "|cff00ffcc当前匹配角色:|r |cffffd100Lv.%d %s · %s (%s)|r  ·  |cff99e6ff阵营:|r %s%s",
      lvl,
      route.name or state.routeId,
      cls and cls.name or state.classKey,
      spec and spec.name or "默认专精",
      route.faction == "horde" and "|cffff5555部落|r" or "|cff44aaff联盟|r",
      (state.zone and state.zone ~= "") and ("  ·  |cff00ff96当前区域:|r " .. state.zone) or ""
    ),
    modeDesc,
  }
  if recProfs ~= "" then
    table.insert(headerLines, "|cff00ff96专精推荐练级专业:|r " .. recProfs .. "   |cffaaaaaa(路线中带 ★ 标记的专业训练师可顺路学习)|r")
  end

  local headerCard = AcquireCard(cardIdx); cardIdx = cardIdx + 1
  y = LayoutCard(
    headerCard, y,
    string.format("|cff00ffcc[路线] %s · %s (%s) 专属升级路线 (当前 Lv.%d)|r", route.name, cls and cls.name or "", spec and spec.name or "", lvl),
    table.concat(headerLines, "\n"),
    { 0.0, 0.85, 0.7, 0.95 },
    { 0.05, 0.14, 0.16, 0.95 },
    nil,
    toggleBtnLabel,
    function()
      if state.routeFilter == "MATCH" then
        state.routeFilter = "ALL"
      else
        state.routeFilter = "MATCH"
      end
      RefreshUI()
    end
  )

  -- 角色专属职业任务链与当前阶段手法/专精里程碑摘要卡
  local charGuideLines = {}
  if phase then
    table.insert(charGuideLines, string.format(
      "|cff71d5ff[战斗] 当前等级 (%s·Lv.%d-%d) 练级手法:|r 常驻 %s  |  起手 %s  |  循环 %s",
      spec and spec.name or "", phase.from or 1, phase.to or 60, phase.keep or "无", phase.open or "平砍", phase.cycle or "平砍"
    ))
  end
  if #matchedClassRuns > 0 then
    for _, cr in ipairs(matchedClassRuns) do
      local crTo = cr.to or cr.level or 60
      if not isMatchMode or (cr.level <= lvl + 15 and crTo >= lvl - 2) then
        local teachStr = (cr.teaches and cr.teaches ~= "") and (" -> 学会 |cff71d5ff[" .. cr.teaches .. "]|r") or ""
        local firstStep = cr.steps and cr.steps[1]
        local stepZone = (firstStep and firstStep.zone ~= "") and firstStep.zone or ""
        local sc = (firstStep and firstStep.x and firstStep.y) and FormatCoordLink(stepZone, firstStep.npc or cr.name, firstStep.x, firstStep.y) or ""
        local stepSummary = firstStep and string.format(" — 起始: %s %s |cff99e6ff%s|r%s", firstStep.zone or "", firstStep.place or "", firstStep.npc or "", sc) or ""
        local activeTag = (lvl >= cr.level and lvl <= crTo + 2) and "|cff00ff00★[当前可做]|r " or ""
        local crLink, crTree = FormatQuestWithSteps(cr, cr.level, stepZone, "      ")
        table.insert(charGuideLines, string.format("  - %s|cff00ffcc[Lv.%d %s·%s职业任务]|r %s%s%s", activeTag, cr.level, route.name, cls and cls.name or "", crLink, teachStr, stepSummary))
        if crTree then table.insert(charGuideLines, crTree) end
      end
    end
  end
  if spec and spec.musts then
    for _, m in ipairs(spec.musts) do
      local mLvl = m.level or 1
      if not isMatchMode or (mLvl >= lvl - 2 and mLvl <= lvl + 15) then
        local activeTag = (mLvl == lvl) and "|cff00ff00★[本级必做]|r " or ""
        table.insert(charGuideLines, string.format("  - %s|cffffd100[Lv.%d %s要点]|r %s", activeTag, mLvl, spec.name or "专精", LinkifyInlineCoords(m.text or "", "", spec.name or "要点")))
      end
    end
  end
  if #charGuideLines > 0 then
    local charCard = AcquireCard(cardIdx); cardIdx = cardIdx + 1
    y = LayoutCard(
      charCard, y,
      string.format("|cff00ff96★ %s · %s (%s) 升级路线核心职业任务与专精里程碑|r", route.name, cls and cls.name or "", spec and spec.name or ""),
      table.concat(charGuideLines, "\n"),
      { 0.2, 0.82, 0.52, 0.9 },
      { 0.06, 0.13, 0.10, 0.93 },
      "角色专属匹配"
    )
  end

  -- 整理要渲染的阶段列表：在 MATCH 模式下将当前等级所在阶段置顶，并展示后续衔接阶段（过滤已过时的低级阶段）
  local orderedBands = {}
  if isMatchMode then
    local currentBands = {}
    local upcomingBands = {}
    for idx, b in ipairs(route.bands) do
      if lvl >= b.from and lvl <= b.to then
        table.insert(currentBands, { idx = idx, band = b })
      elseif b.from > lvl and b.from <= lvl + 16 then
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

  for _, entry in ipairs(orderedBands) do
    local b = entry.band
    local stepIdx = entry.idx
    local isCurrent = (lvl >= b.from and lvl <= b.to)
    local hubName = (b.hub and b.hub.name ~= "") and b.hub.name or b.zone
    local coordText = (b.hub and b.hub.x and b.hub.y) and FormatCoordLink(b.zone, hubName, b.hub.x, b.hub.y) or ""
    local matchedTrainer = GetBandTrainer(b, state.classKey, state.faction)
    local matchedQuests = GetBandQuests(b, state.classKey)
    local searchBlob = (b.zone or "") .. " " .. (hubName or "") .. " " .. ((matchedTrainer and matchedTrainer.name) or "")
    if b.altZones then
      for _, az in ipairs(b.altZones) do
        searchBlob = searchBlob .. " " .. (az.zone or "") .. " " .. (az.hub or "")
      end
    end

    if MatchesSearch(searchBlob) then
      local lines = {}
      local zonesBlock = FormatBandZonesBlock(b, "本阶段适龄练级区域 (平级推荐，可自由切换)")
      if zonesBlock then
        table.insert(lines, zonesBlock)
      else
        table.insert(lines, string.format("|cffffd100驻扎营地/城镇:|r |cff00ffcc%s|r%s", hubName or "主营地", coordText))
      end

      if not zonesBlock and b.hubs and #b.hubs > 1 then
        local subHubs = {}
        for _, h in ipairs(b.hubs) do
          local hc = (h.x and h.y) and FormatCoordLink(b.zone, h.name, h.x, h.y) or ""
          table.insert(subHubs, string.format("%s[Lv.%d-%d]%s", h.name or "", h.from or b.from, h.to or b.to, hc))
        end
        table.insert(lines, "|cff99e6ff分阶段据点:|r " .. table.concat(subHubs, " -> "))
      end

      if b.flights and #b.flights > 0 then
        local flNames = {}
        for _, fl in ipairs(b.flights) do
          local flZone = (fl.zone and fl.zone ~= "") and fl.zone or b.zone
          local fc = (fl.x and fl.y) and FormatCoordLink(flZone, (fl.place or "") .. " " .. (fl.name or "飞行点"), fl.x, fl.y) or ""
          table.insert(flNames, string.format("%s %s%s", fl.place or "", fl.name or "", fc))
        end
        table.insert(lines, "|cff99e6ff[飞行点] 解锁鸟点:|r " .. table.concat(flNames, " · "))
      end

      if matchedTrainer and matchedTrainer.name ~= "" then
        local tZone = (matchedTrainer.zone and matchedTrainer.zone ~= "") and matchedTrainer.zone or (matchedTrainer.place or b.zone)
        local tc = (matchedTrainer.x and matchedTrainer.y) and FormatCoordLink(tZone, matchedTrainer.name, matchedTrainer.x, matchedTrainer.y) or ""
        table.insert(lines, string.format("|cff71d5ff%s训练师:|r |cffffd100%s|r (%s · %s)%s", cls and cls.name or "职业", matchedTrainer.name, matchedTrainer.title or "职业训练师", matchedTrainer.place or b.zone or "", tc))
      end

      if matchedQuests and #matchedQuests > 0 then
        for _, q in ipairs(matchedQuests) do
          local qZone = (q.zone and q.zone ~= "") and q.zone or (q.place or b.zone)
          local qc = (q.x and q.y) and FormatCoordLink(qZone, (q.npc and q.npc ~= "") and q.npc or q.name, q.x, q.y) or ""
          local qTag = (q.kind == "class") and string.format("|cff00ffcc[★%s职业任务]|r", cls and cls.name or "") or "|cffffd100[区域关键任务]|r"
          local qLink, qTree = FormatQuestWithSteps(q, q.level or b.from, qZone, "    ")
          table.insert(lines, string.format("%s %s (Lv.%d) — %s %s%s", qTag, qLink, q.level or b.from, q.place or "", q.npc or "", qc))
          if qTree then table.insert(lines, qTree) end
        end
      end

      -- 穿插属于本阶段等级区间的种族+职业专属任务链
      for _, cr in ipairs(matchedClassRuns) do
        local crTo = cr.to or cr.level or 60
        if cr.level >= b.from and cr.level <= b.to and (not isMatchMode or crTo >= lvl - 2) then
          local teachStr = (cr.teaches and cr.teaches ~= "") and (" -> 学会 |cff71d5ff[" .. cr.teaches .. "]|r") or ""
          local firstStep = cr.steps and cr.steps[1]
          local stepZone = (firstStep and firstStep.zone ~= "") and firstStep.zone or b.zone
          local sc = (firstStep and firstStep.x and firstStep.y) and FormatCoordLink(stepZone, firstStep.npc or cr.name, firstStep.x, firstStep.y) or ""
          local npcInfo = firstStep and string.format(" — %s %s |cff99e6ff%s|r%s", firstStep.zone or "", firstStep.place or "", firstStep.npc or "", sc) or ""
          local crLink, crTree = FormatQuestWithSteps(cr, cr.level, stepZone, "    ")
          table.insert(lines, string.format("|cff00ffcc[★Lv.%d %s专属职业任务链]|r %s%s%s", cr.level, cls and cls.name or "", crLink, teachStr, npcInfo))
          if crTree then table.insert(lines, crTree) end
        end
      end

      -- 穿插属于本阶段等级区间的专精关键里程碑
      if spec and spec.musts then
        for _, m in ipairs(spec.musts) do
          local mLvl = m.level or 1
          if mLvl >= b.from and mLvl <= b.to and (not isMatchMode or mLvl >= lvl - 2) then
            table.insert(lines, string.format("|cff00ff96[★Lv.%d %s专精要点]|r %s", mLvl, spec.name or "", LinkifyInlineCoords(m.text or "", b.zone, spec.name or "要点")))
          end
        end
      end

      if b.professions and #b.professions > 0 then
        local pNames = {}
        for _, p in ipairs(b.professions) do
          local isRec = (recProfs ~= "" and string.find(recProfs, p.name or "", 1, true) ~= nil)
          local recTag = isRec and "|cff00ff00★推荐|r" or ""
          local pZone = (p.zone and p.zone ~= "") and p.zone or b.zone
          local pLabel = (p.name or "") .. ((p.trainer and p.trainer ~= "") and (" " .. p.trainer) or "") .. ((p.place and p.place ~= "") and (" (" .. p.place .. ")") or "")
          local pc = (p.x and p.y) and FormatCoordLink(pZone, pLabel, p.x, p.y) or ""
          table.insert(pNames, string.format("|cff00ff96[%s%s]|r %s%s", p.name, recTag, p.trainer or "", pc))
        end
        table.insert(lines, "|cff00ff96顺路学专业:|r " .. table.concat(pNames, " · "))
      end

      -- 穿插本阶段主城副本任务备战、跨区交通航线与推荐进本节点 (timelineSteps)
      local tlSteps = GetBandTimelineSteps(route, b.from, b.to)
      local seenDungeonVisit = {}
      local seenCityVisit = {}
      local seenTravelVisit = {}
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
          if not seenCityVisit[cKey] then
            seenCityVisit[cKey] = true
            local qNames = {}
            for _, cq in ipairs(tl.quests) do
              local cqZone = (cq.zone and cq.zone ~= "") and cq.zone or tl.city
              local cqc = (cq.x and cq.y) and FormatCoordLink(cqZone, (cq.npc and cq.npc ~= "") and cq.npc or cq.name, cq.x, cq.y) or ""
              local cqLink = FormatQuestLink(cq, tl.level or b.from, cqZone)
              table.insert(qNames, string.format("%s (%s %s%s)", cqLink, cq.dungeon or "", cq.npc or "", cqc))
            end
            table.insert(lines, string.format("|cffffa500[主城备战] [Lv.%d %s 副本任务]|r %s", tl.level or b.from, tl.city, table.concat(qNames, " / ")))
          end
        elseif tl.kind == "dungeon" and tl.name and not seenDungeonVisit[tl.name] then
          seenDungeonVisit[tl.name] = true
          local dObj = GetDungeonByIdOrName(tl.dungeonId, tl.name)
          local dEnt = (dObj and dObj.entranceX and dObj.entranceY) and FormatCoordLink(dObj.entranceZone or dObj.zone, tl.name .. "入口", dObj.entranceX, dObj.entranceY) or ""
          table.insert(lines, string.format("|cffff8000[推荐进本] [Lv.%d %s]|r 适龄 Lv.%d-%d (%s%s)", tl.level or b.from, tl.name, tl.minLevel or b.from, tl.maxLevel or b.to, tl.zone or "", dEnt))
        elseif tl.kind == "travel" and (tl.from ~= "" or tl.to ~= "") then
          local tKey = tostring(tl.level) .. ":" .. (tl.from or "") .. "->" .. (tl.to or "") .. ":" .. (tl.via or "")
          if not seenTravelVisit[tKey] then
            seenTravelVisit[tKey] = true
            local viaText = VIA_LABELS[tl.via or "walk"] or (tl.via or "转场")
            local destText = (tl.place and tl.place ~= "" and tl.place ~= tl.to) and (tl.to .. "·" .. tl.place) or (tl.to or "")
            local flCoord = (tl.flightX and tl.flightY) and FormatCoordLink(tl.flightZone or tl.to, tl.flightNpc or "鸟点", tl.flightX, tl.flightY) or ""
            local flText = (tl.flightNpc and tl.flightNpc ~= "")
              and string.format(" — 顺路开鸟点: %s %s%s", tl.flightZone or "", tl.flightNpc, flCoord)
              or ""
            table.insert(lines, string.format("|cff99e6ff[跨区交通] [Lv.%d %s]|r %s -> |cff00ffcc%s|r%s", tl.level or b.from, viaText, tl.from or "起点", destText, flText))
          end
        end
      end

      if b.dungeonQuests and #b.dungeonQuests > 0 then
        for _, dq in ipairs(b.dungeonQuests) do
          local dqZone = (dq.zone and dq.zone ~= "") and dq.zone or (dq.place or b.zone)
          local dc = (dq.x and dq.y) and FormatCoordLink(dqZone, (dq.npc and dq.npc ~= "") and dq.npc or dq.name, dq.x, dq.y) or ""
          local dqLink = FormatQuestLink(dq, dq.level or b.from, dqZone)
          table.insert(lines, string.format("|cffff8000[本区副本任务 · %s]|r %s — %s %s%s", dq.dungeon, dqLink, dq.place or "", dq.npc or "", dc))
        end
      end

      local card = AcquireCard(cardIdx); cardIdx = cardIdx + 1
      local titlePrefix = isCurrent and "|cff00ff00▶ [当前角色所在阶段]|r " or string.format("|cff8899aa[第%d步]|r ", stepIdx)
      y = LayoutCard(
        card, y,
        string.format("%s|cffffd100Lv.%d – %d|r  ·  %s", titlePrefix, b.from, b.to, FormatBandZonesTitle(b)),
        table.concat(lines, "\n"),
        isCurrent and { 0.1, 0.95, 0.4, 0.95 } or { 0.25, 0.35, 0.45, 0.85 },
        isCurrent and { 0.06, 0.16, 0.10, 0.95 } or { 0.08, 0.10, 0.14, 0.92 },
        string.format("Lv.%d-%d", b.from, b.to),
        (b.hub and b.hub.x) and "标记营地坐标" or nil,
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
  local lvl = state.level
  local route = GetCurrentRoute()
  local cls = GetCurrentClassData()
  local spec = GetCurrentSpecData()
  if not cls or not spec then
    HideUnusedCards(1)
    return
  end

  local isMatchMode = (state.talentFilter == "MATCH") and (not state.searchQuery or state.searchQuery == "")
  local toggleBtnLabel = state.talentFilter == "MATCH" and "查看 1-60 全程" or "仅看当前匹配"
  local modeDesc = isMatchMode
    and string.format("已自动过滤 |cffffd100Lv.%d|r 以下已过时的循环阶段、已点天赋及低级职业任务（点击右上角按钮可展开 1–60 全部）", lvl)
    or "当前显示 1–60 级完整循环阶段、逐级天赋加点表与全部职业任务链（点击右上角按钮可聚焦当前等级）"

  local headerCard = AcquireCard(cardIdx); cardIdx = cardIdx + 1
  y = LayoutCard(
    headerCard, y,
    string.format("|cff00ffcc[职业] %s · %s 战斗循环、天赋与职业任务 (当前 Lv.%d)|r", cls.name, spec.name, lvl),
    modeDesc,
    { 0.0, 0.85, 0.7, 0.95 },
    { 0.05, 0.14, 0.16, 0.95 },
    nil,
    toggleBtnLabel,
    function()
      if state.talentFilter == "MATCH" then
        state.talentFilter = "ALL"
      else
        state.talentFilter = "MATCH"
      end
      RefreshUI()
    end
  )

  -- 1. 专精循环各阶段
  for _, p in ipairs(spec.phases or {}) do
    local isCurrent = (lvl >= p.from and lvl <= p.to)
    local passLevel = (not isMatchMode) or ((p.to or 60) >= lvl)
    local textBlob = (p.keep or "") .. " " .. (p.cycle or "") .. " " .. (p.note or "")
    if passLevel and MatchesSearch(textBlob) then
      local lines = {
        "|cff00ff96【常驻保持】|r " .. (p.keep or "无"),
        "|cffffa500【起手技能】|r " .. (p.open or "无"),
        "|cff71d5ff【核心循环】|r " .. (p.cycle or "无"),
      }
      if p.note and p.note ~= "" then
        table.insert(lines, "\n" .. LinkifyInlineCoords(p.note, "", spec.name or "要点"))
      end
      local card = AcquireCard(cardIdx); cardIdx = cardIdx + 1
      y = LayoutCard(
        card, y,
        string.format("%s|cff71d5ff[战斗] %s·%s 野外循环 (Lv.%d - %d)|r", isCurrent and "|cff00ff00▶ [当前阶段]|r " or "", cls.name, spec.name, p.from, p.to),
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
      if not isMatchMode or (s.level or 1) >= lvl then
        local mark = (s.level == lvl) and "|cff00ff00★ [当前等级]|r " or (s.level < lvl and "|cff888888[已点]|r " or "   ")
        table.insert(stepLines, string.format("%s|cffffd100Lv.%2d:|r [%s] |cff00ffcc%s|r (%d/%d)", mark, s.level, s.tree, s.name, s.rank, s.max))
      end
    end
    if #stepLines > 0 then
      local cSteps = AcquireCard(cardIdx); cardIdx = cardIdx + 1
      local titleStr = isMatchMode
        and string.format("|cffffd100★ %s·%s Lv.%d–60 后续天赋加点顺序 (剩余 %d 点)|r", cls.name, spec.name, math.max(10, lvl), #stepLines)
        or string.format("|cffffd100★ %s·%s 10–60 级逐级天赋加点顺序 (共 %d 点)|r", cls.name, spec.name, #spec.steps)
      y = LayoutCard(
        cSteps, y,
        titleStr,
        table.concat(stepLines, "\n"),
        { 0.9, 0.75, 0.2, 0.9 },
        { 0.11, 0.10, 0.06, 0.92 },
        isMatchMode and string.format("Lv.%d-60", math.max(10, lvl)) or "Lv.10-60 完整路径"
      )
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
        local fTag = cr.faction == "horde" and "|cffff5555[部落]|r" or (cr.faction == "alliance" and "|cff44aaff[联盟]|r" or "|cff00ffcc[通用]|r")
        local rTag = (cr.raceName and cr.raceName ~= "") and ("|cff99e6ff[" .. cr.raceName .. "]|r ") or ""
        local teachTag = (cr.teaches and cr.teaches ~= "") and (" -> 学会 |cff71d5ff[" .. cr.teaches .. "]|r") or ""
        local firstZone = (cr.steps and cr.steps[1] and cr.steps[1].zone) or ""
        local crLink = FormatQuestLink(cr, cr.level, firstZone, nil, IsQuestCompleted(cr))
        table.insert(crLines, string.format("%s %sLv.%d %s%s", fTag, rTag, cr.level, crLink, teachTag))
        for idx, st in ipairs(cr.steps or {}) do
          local stZone = (st.zone and st.zone ~= "") and st.zone or st.place
          local sc = (st.x and st.y) and FormatCoordLink(stZone, st.npc or st.name, st.x, st.y) or ""
          local stLink = FormatQuestLink(st, cr.level, stZone)
          table.insert(crLines, string.format("    %d. %s — %s %s |cff99e6ff%s|r%s", idx, stLink, st.zone or "", st.place or "", st.npc or "", sc))
        end
      end
    end
    if #crLines > 0 then
      local cRuns = AcquireCard(cardIdx); cardIdx = cardIdx + 1
      y = LayoutCard(
        cRuns, y,
        string.format("|cff00ffcc[任务链] %s · %s 专属职业任务链与坐标指引|r", route and route.name or "", cls.name),
        table.concat(crLines, "\n"),
        { 0.0, 0.8, 0.7, 0.9 },
        { 0.05, 0.12, 0.13, 0.92 }
      )
    end
  end

  HideUnusedCards(cardIdx)
  contentChild:SetHeight(math.max(y + 20, 480))
end

local function RenderTabMacros()
  local cardIdx = 1
  local y = 6
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

  local introCard = AcquireCard(cardIdx); cardIdx = cardIdx + 1
  y = LayoutCard(
    introCard, y,
    string.format("|cff00ffcc[宏库] %s 实用一键宏命令库 (共 %d 个)|r", cls and cls.name or "", #macros),
    "同步自 |cffffd100wowf.io/zh/macros|r。点击每个宏卡片右上角的 |cff00ff00[一键写入宏]|r 按钮，即可直接将该宏创建到您的游戏角色宏槽位中（输入 |cffffd100/macro|r 即可拖入技能栏）；战斗中点击将弹出 Ctrl+C 复制窗口。",
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
        "一键写入宏",
        function()
          CreateOrUpdateGameMacro(m.title, m.code)
        end
      )
    end
  end

  HideUnusedCards(cardIdx)
  contentChild:SetHeight(math.max(y + 20, 480))
end

-- 常用命令速查：分类整理 /console 控制台变量与斜杠命令，支持搜索与一键复制
local function RenderTabCommands()
  local cardIdx = 1
  local y = 6

  local introCard = AcquireCard(cardIdx); cardIdx = cardIdx + 1
  y = LayoutCard(
    introCard, y,
    "|cff00ffcc[常用命令] 魔兽世界通用命令 / 控制台变量速查|r",
    "面向《魔兽世界：无限服》整理、均可在无限服客户端使用的常用命令。每条命令都可点击右上角 |cff00ff00[复制命令]|r 按钮，或直接把命令粘贴到聊天框回车执行。|cffff8800注意：/console 属于客户端设置，请在非战斗中执行。|r",
    { 0.0, 0.75, 0.95, 0.9 },
    { 0.05, 0.10, 0.16, 0.92 },
    "共 " .. tostring(#COMMON_COMMANDS) .. " 条"
  )

  for _, c in ipairs(COMMON_COMMANDS) do
    if MatchesSearch((c.title or "") .. " " .. (c.category or "") .. " " .. (c.code or "") .. " " .. (c.desc or "") .. " " .. (c.note or "")) then
      local bodyLines = {
        "|cff99e6ff分类:|r " .. (c.category or "其他"),
        "|cff99e6ff说明:|r " .. (c.desc or ""),
        "\n|cffffd100命令:|r\n|cffaaffaa" .. (c.code or "") .. "|r",
        "\n|cff888888注意:|r |cffbbbbbb" .. (c.note or "") .. "|r",
      }
      local card = AcquireCard(cardIdx); cardIdx = cardIdx + 1
      y = LayoutCard(
        card, y,
        "|cff00ccff" .. (c.title or "命令") .. "|r",
        table.concat(bodyLines, "\n"),
        { 0.2, 0.55, 0.8, 0.85 },
        { 0.06, 0.09, 0.14, 0.94 },
        nil,
        "复制命令",
        function()
          ShowCopyMacroDialog(c.title or "命令", c.code or "")
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

  local nextModeLabel = state.dungeonFilter == "MATCH" and "看无限服新本" or (state.dungeonFilter == "NEW" and "显示全部副本" or "看当前等级")
  local modeTitle = state.dungeonFilter == "MATCH" and string.format("当前筛选: 适合 Lv.%d 的地下城", state.level)
    or (state.dungeonFilter == "NEW" and "当前筛选: ★ 无限服新增地下城与团本 (11个)" or "当前筛选: 全部地下城与团本")

  local filterCard = AcquireCard(cardIdx); cardIdx = cardIdx + 1
  y = LayoutCard(
    filterCard, y,
    "|cffff8000[副本] 艾泽拉斯地下城与无限服新副本百科 (" .. modeTitle .. ")|r",
    "包含《魔兽世界：无限服》全部 |cff00ffcc9 大全新五人副本|r（领主大厅、洛丹伦废墟、挖掘场：湿地、达拉然城、沉没之城、克罗多克要塞、奥卡兹监狱、黑喉要塞、塑造者之台）与新增团本（深穴、海加尔峰）及所有必接副本任务坐标。点击蓝色坐标可直接在世界地图标点，点击黄色任务链接可发送至聊天框。",
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

  local shownCount = 0
  local levelMatchedCount = 0
  local hiddenCompletedCount = 0
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
      if d.entranceX and d.entranceY then
        local entLink = FormatCoordLink(d.entranceZone or d.zone, d.name .. "副本入口", d.entranceX, d.entranceY)
        table.insert(lines, string.format("|cff00ffcc副本入口位置:|r %s%s", d.entranceZone or d.zone or "", entLink))
      end
      if d.summary and d.summary ~= "" then
        table.insert(lines, "|cff99e6ff简介:|r " .. LinkifyInlineCoords(d.summary, d.entranceZone or d.zone or "", d.name))
      end
      if d.bosses and #d.bosses > 0 then
        table.insert(lines, "|cffff8000主要首领:|r " .. table.concat(d.bosses, "  ·  "))
      end
      if d.quests and #d.quests > 0 then
        local filteredQuests = {}
        for _, q in ipairs(DedupeQuestieQuests(d.quests)) do
          if (not IsQuestCompleted(q)) and (state.dungeonFilter ~= "MATCH" or ((q.faction == "both" or q.faction == state.faction) and MatchesQuestClass(q))) then
            table.insert(filteredQuests, q)
          end
        end
        if #filteredQuests > 0 then
          table.insert(lines, "|cffffd100必接副本任务 (" .. #filteredQuests .. "个):|r")
          for _, grp in ipairs(GroupQuestsBySharedPrefix(filteredQuests)) do
            local q = grp.quests[1]
            local fTag = q.faction == "horde" and "|cffff5555[部落]|r " or (q.faction == "alliance" and "|cff44aaff[联盟]|r " or "")
            local cTag = state.dungeonFilter ~= "MATCH" and FormatQuestClassTag(q) or ""
            local qZone = (q.zone and q.zone ~= "") and q.zone or (d.entranceZone or d.zone or "")
            local acceptTag = (not IsQuestLineStarted(q)) and string.format(" (可接 Lv.%d)", q.minLevel or d.minLevel) or ""
            local npcInfo = FormatStepNpcInfo(q, qZone)
            if npcInfo == "" and q.inside then npcInfo = "(副本内触发)" end
            local npcSuffix = (npcInfo ~= "") and (" — " .. npcInfo) or ""
            if #grp.quests > 1 and grp.prefixLen >= 1 then
              local headerPrefix, treeBody = FormatSharedPrefixGroup(grp, d.minLevel, qZone, "      ", true)
              local branchTag = string.format("[共%d条分支任务链]", #grp.quests)
              table.insert(lines, string.format("  - %s%s%s%s%s%s", fTag, cTag, headerPrefix, branchTag, acceptTag, npcSuffix))
              table.insert(lines, treeBody)
            else
              local chainTag = (q.stepCount and q.stepCount > 1) and string.format(q.hasPrereq and " [共%d步·含前置]" or " [共%d步任务链]", q.stepCount) or ""
              local qLink, qTree = FormatQuestWithSteps(q, q.minLevel or d.minLevel, qZone, "      ", true)
              table.insert(lines, string.format("  - %s%s%s%s%s%s", fTag, cTag, qLink, acceptTag, chainTag, npcSuffix))
              if qTree then table.insert(lines, qTree) end
            end
          end
        end
      end

      local isLevelMatch = (state.level >= d.minLevel and state.level <= d.maxLevel)
      local newBadge = d.isNew and " |cff00ffcc[★无限服新增]|r" or ""
      local matchBadge = isLevelMatch and " |cff00ff00[当前适龄]|r" or ""
      local doneBadge = allDone and " |cff00ff00[任务已全部完成]|r" or ""

      local card = AcquireCard(cardIdx); cardIdx = cardIdx + 1
      y = LayoutCard(
        card, y,
        string.format("|cffff8000%s|r  |cffffd100(Lv.%d-%d · 推荐 %d 级)|r  —  %s%s%s%s", d.name, d.minLevel, d.maxLevel, d.visit or d.minLevel, d.zone or "", newBadge, matchBadge, doneBadge),
        table.concat(lines, "\n"),
        d.isNew and { 0.0, 0.85, 0.7, 0.9 } or (isLevelMatch and { 0.2, 0.85, 0.4, 0.9 } or { 0.3, 0.35, 0.45, 0.85 }),
        d.isNew and { 0.05, 0.13, 0.14, 0.94 } or { 0.08, 0.10, 0.14, 0.92 },
        string.format("Lv.%d-%d", d.minLevel, d.maxLevel)
      )
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
    local emptyCard = AcquireCard(cardIdx); cardIdx = cardIdx + 1
    y = LayoutCard(
      emptyCard, y,
      emptyTitle,
      emptyBody,
      { 0.2, 0.85, 0.4, 0.85 },
      { 0.06, 0.12, 0.09, 0.92 }
    )
  end

  HideUnusedCards(cardIdx)
  contentChild:SetHeight(math.max(y + 20, 480))
end

local function RenderTabForeverAndNews()
  local cardIdx = 1
  local y = 6
  local cls = GetCurrentClassData()
  local spec = GetCurrentSpecData()
  local recProfs = (spec and spec.recommendedProfs) or ""
  local playerProfs = GetPlayerProfessions()
  local isMatchMode = (state.featureFilter == "MATCH") and (not state.searchQuery or state.searchQuery == "")
  local toggleBtnLabel = state.featureFilter == "MATCH" and "查看全部特色与专业" or "仅看当前角色匹配"
  local modeDesc = state.featureFilter == "MATCH"
    and string.format("当前筛选: 匹配当前角色 (Lv.%d %s · %s)", state.level, cls and cls.name or state.classKey, spec and spec.name or "默认专精")
    or "当前筛选: 全部无限服特色玩法与 12 大专业"

  local filterCard = AcquireCard(cardIdx); cardIdx = cardIdx + 1
  y = LayoutCard(
    filterCard, y,
    "|cff00ffcc[特色&专业] 无限服专属玩法与 1-300 专业指南 (" .. modeDesc .. ")|r",
    "包含《魔兽世界：无限服》专属玩法（舒适睡袋、制皮营地帐篷、经典旧世传承点数推荐、遭劫的板条箱等）、12 大专业 1-300 冲级指南与最新热修公告。默认仅显示适合当前等级/阵营/专业且未完成的特色玩法（已完成睡袋或非制皮帐篷将自动隐藏），以及当前专精推荐专业。",
    { 0.0, 0.85, 0.7, 0.9 },
    { 0.05, 0.12, 0.14, 0.94 },
    nil,
    toggleBtnLabel,
    function()
      if state.featureFilter == "MATCH" then
        state.featureFilter = "ALL"
      else
        state.featureFilter = "MATCH"
      end
      RefreshUI()
    end
  )

  -- 1. 无限服专属玩法攻略（露营、睡袋、经典旧世之树、物资箱等）
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
      if sys.id == "legacy-system" then
        local legacyRec = BuildLegacyRecommendationLines(state.level, playerProfs, false)
        table.insert(lines, "")
        for _, rLine in ipairs(legacyRec) do
          table.insert(lines, rLine)
        end
      end
      local firstCoord = nil
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
          if st.coord and not firstCoord then
            firstCoord = { zone = st.zone, title = st.title, x = st.coord.x, y = st.coord.y }
          end
          local stepHeader = "|cffffd100" .. stepTitle .. "|r"
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
          if st.coord then
            stepHeader = stepHeader .. FormatCoordLink(st.zone or "", st.title or "", st.coord.x, st.coord.y)
          end
          if st.altCoord then
            stepHeader = stepHeader .. " / " .. FormatCoordLink(st.altCoord.zone or "", st.altCoord.label or st.title or "", st.altCoord.x, st.altCoord.y, false)
          end
          local stepDetail = LinkifyInlineCoords(st.detail or "", st.zone or "", st.title or "")
          table.insert(lines, string.format("\n%s\n%s", stepHeader, stepDetail))
        end
      end

      local card = AcquireCard(cardIdx); cardIdx = cardIdx + 1
      y = LayoutCard(
        card, y,
        "|cff00ffcc" .. (sys.title or "") .. "|r",
        table.concat(lines, "\n"),
        { 0.0, 0.85, 0.7, 0.9 },
        { 0.05, 0.12, 0.14, 0.94 },
        sys.category or "无限服特色",
        firstCoord and "标记起始坐标" or nil,
        firstCoord and function()
          SetWaypointOrPrint(firstCoord.zone, firstCoord.title, firstCoord.x, firstCoord.y)
        end or nil
      )
    end
  end

  -- 2. 12 大专业 1-300 冲级与无限服特色指南 (同步自 wowf.io/zh/professions)
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
          table.insert(pLines, "|cffffa500关键训练师与突破:|r " .. LinkifyInlineCoords(prof.trainers, "", (prof.name or "") .. "训练师"))
        end
        if prof.foreverNote and prof.foreverNote ~= "" then
          table.insert(pLines, "|cff00ffcc★ 无限服指南:|r " .. LinkifyInlineCoords(prof.foreverNote, "", prof.name or ""))
        end

        local typeLabel = prof.type == "gathering" and "采集专业" or (prof.type == "secondary" and "生活副业" or "制造专业")
        local recTag = isRec and " |cff00ff00[★当前专精推荐]|r" or ""
        local cProf = AcquireCard(cardIdx); cardIdx = cardIdx + 1
        y = LayoutCard(
          cProf, y,
          string.format("|cff00ff96[专业] %s (1-300)|r%s", prof.name or prof.id, recTag),
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
    table.insert(newsLines, string.format("- |cffffd100[%s] %s|r\n  %s", n.date or "", n.title or "", n.summary or ""))
  end
  if #newsLines > 0 then
    local meta = Data.meta or {}
    local cNews = AcquireCard(cardIdx); cardIdx = cardIdx + 1
    y = LayoutCard(
      cNews, y,
      string.format("|cffffa500[公告] wowf.io 无限服最新热修与官方公告 (数据版本: %s)|r", meta.updatedAt or "最新"),
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
  if headerControls.autoCheck then
    headerControls.autoCheck:SetChecked(state.autoFollow)
  end
  if headerControls.matchRoleBtn then
    headerControls.matchRoleBtn:SetText(state.autoFollow and "|cff00ffcc匹配角色|r" or "|cffffa500匹配角色|r")
  end

  for i, btn in ipairs(tabButtons) do
    if i == state.activeTab then
      btn:LockHighlight()
    else
      btn:UnlockHighlight()
    end
  end

  local savedScroll = (preserveScroll and scrollFrame) and (scrollFrame:GetVerticalScroll() or 0) or 0

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
  elseif state.activeTab == 7 then
    RenderTabCommands()
  else
    RenderTabForeverAndNews()
  end

  if scrollFrame then
    if preserveScroll then
      local maxScroll = math.max(0, ((contentChild and contentChild:GetHeight()) or 0) - (scrollFrame:GetHeight() or 0))
      scrollFrame:SetVerticalScroll(math.max(0, math.min(savedScroll, maxScroll)))
    else
      scrollFrame:SetVerticalScroll(0)
    end
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
  autoCheck:SetScript("OnClick", function(self)
    state.autoFollow = self:GetChecked() and true or false
    if state.autoFollow then
      state.routeFilter = "MATCH"
      state.talentFilter = "MATCH"
      state.dungeonFilter = "MATCH"
      state.featureFilter = "MATCH"
      SyncPlayerCharacter()
    end
    RefreshUI()
  end)
  headerControls.autoCheck = autoCheck

  -- 「匹配角色」按钮：一键恢复跟随当前角色（种族+职业+专精+等级）并聚焦当前等级路线
  local matchRoleBtn = CreateFrame("Button", nil, ctrlBar, "UIPanelButtonTemplate")
  matchRoleBtn:SetSize(88, 22)
  matchRoleBtn:SetPoint("LEFT", autoCheck, "RIGHT", 2, 0)
  matchRoleBtn:SetText("|cff00ffcc匹配角色|r")
  matchRoleBtn:SetScript("OnClick", function()
    state.autoFollow = true
    state.routeFilter = "MATCH"
    state.talentFilter = "MATCH"
    state.dungeonFilter = "MATCH"
    state.featureFilter = "MATCH"
    SyncPlayerCharacter()
    RefreshUI()
  end)
  headerControls.matchRoleBtn = matchRoleBtn

  -- 等级 -1 / Lv.X / +1
  local lvlMinusBtn = CreateFrame("Button", nil, ctrlBar, "UIPanelButtonTemplate")
  lvlMinusBtn:SetSize(26, 22)
  lvlMinusBtn:SetPoint("LEFT", matchRoleBtn, "RIGHT", 6, 0)
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

  -- 七大功能标签栏
  local TAB_DEFS = {
    { id = 1, label = "智能匹配" },
    { id = 2, label = "升级路线" },
    { id = 3, label = "职业与天赋" },
    { id = 4, label = "一键宏库" },
    { id = 5, label = "地下城百科" },
    { id = 6, label = "专业&无限特色" },
    { id = 7, label = "常用命令" },
  }

  for i, def in ipairs(TAB_DEFS) do
    local btn = CreateFrame("Button", nil, mainFrame, "UIPanelButtonTemplate")
    btn:SetSize(105, 26)
    btn:SetPoint("TOPLEFT", 12 + (i - 1) * 108, -82)
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
    GameTooltip:AddLine("|cff00ffccWoWF Companion|r |cffffd100(wowf.io 无限服百科)|r")
    local zoneList = {}
    if band and band.zone and band.zone ~= "" then
      table.insert(zoneList, band.zone)
    end
    if band and band.altZones then
      for i = 1, math.min(3, #band.altZones) do
        if band.altZones[i].zone and band.altZones[i].zone ~= "" then
          table.insert(zoneList, band.altZones[i].zone)
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
for _, questEv in ipairs({ "QUEST_TURNED_IN", "QUEST_ACCEPTED", "QUEST_REMOVED", "QUEST_LOG_UPDATE" }) do
  pcall(eventFrame.RegisterEvent, eventFrame, questEv)
end
for _, talentEv in ipairs({ "TRAIT_CONFIG_UPDATED", "PLAYER_TALENT_UPDATE", "ACTIVE_TALENT_GROUP_CHANGED", "CHARACTER_POINTS_CHANGED", "SKILL_LINES_CHANGED" }) do
  pcall(eventFrame.RegisterEvent, eventFrame, talentEv)
end

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
      local route = GetCurrentRoute()
      local cls = GetCurrentClassData()
      local spec = GetCurrentSpecData()
      DEFAULT_CHAT_FRAME:AddMessage(string.format(
        "|cff00ffcc[WoWF 无限百科]|r 已加载 |cffffd100wowf.io|r 动态数据库并自动匹配当前角色: |cffffd100Lv.%d %s·%s (%s)|r！输入 |cffffd100/wowf|r 或点击小地图图标查看。",
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
    DEFAULT_CHAT_FRAME:AddMessage("|cff00ffcc[WoWF 无限百科]|r " .. table.concat(msgParts, " · ") .. " (输入 /wowf 查看详情)")
    RefreshUI()
  elseif event == "QUEST_TURNED_IN" or event == "QUEST_ACCEPTED" or event == "QUEST_REMOVED" or event == "QUEST_LOG_UPDATE" or event == "SKILL_LINES_CHANGED" then
    SyncPlayerCharacter()
    RefreshUI(true)
  else
    SyncPlayerCharacter()
    RefreshUI()
  end
end)

SLASH_WOWF1 = "/wowf"
SLASH_WOWF2 = "/wowfio"
SlashCmdList["WOWF"] = function(msg)
  local cmd = string.lower(string.gsub(msg or "", "^%s*(.-)%s*$", "%1"))
  state.autoFollow = true
  SyncPlayerCharacter()
  if cmd == "macro" or cmd == "macros" then
    ToggleMainWindow(4)
  elseif cmd == "cmd" or cmd == "commands" or cmd == "console" then
    ToggleMainWindow(7)
  elseif cmd == "dungeon" or cmd == "dungeons" then
    ToggleMainWindow(5)
  elseif cmd == "route" or cmd == "level" then
    state.routeFilter = "MATCH"
    ToggleMainWindow(2)
  elseif cmd == "class" or cmd == "talent" then
    state.talentFilter = "MATCH"
    ToggleMainWindow(3)
  elseif cmd == "news" or cmd == "forever" or cmd == "prof" or cmd == "professions" then
    state.featureFilter = "MATCH"
    ToggleMainWindow(6)
  else
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
  enrichRoutesWithAltZones(dataset.routes);
  normalizeWowfDatasetText(dataset);
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
