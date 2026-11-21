import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import JSZip from 'jszip';

const DEFAULT_DEPLOY_ID = 'deploy-fd0c249c-1794727615234';
const WOWF_ADDON_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../addons/WoWF');

function readWoWFLuaFile(filename) {
  return fs.readFileSync(path.join(WOWF_ADDON_DIR, filename), 'utf8').replace(/\r\n|\r/g, '\n');
}

function getGitHeadOid() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

function getAutoWowfVersion() {
  try {
    const raw = execFileSync(
      'git',
      ['rev-list', '--count', 'HEAD', '--', 'scripts/locales/wowf.js', 'addons/WoWF'],
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
    category: '账号成长线',
    minLevel: 1,
    title: '★ 传承天赋（单角色上限 16 点）',
    summary: '《魔兽世界：无限》新增的账号级成长线，独立于职业天赋树：职业首次达到 25/45/60 级、非采集类主专业达到熟练度或完成探索挑战均可获得传承点数（账号累计上限 65 点，15/25/40/55 点有里程碑奖励）；单角色最多分配 16 点，1 级小号即享全部加成。',
    steps: [
      {
        step: 1,
        zone: '传承天赋 · 冒险分支',
        title: '[冒险] 冒险分支 · 练级首选',
        detail: '休息经验、战后恢复、鸟点加速与露营冷却缩减，练级期收益最高。',
      },
      {
        step: 2,
        zone: '传承天赋 · 专业分支',
        title: '[专业] 专业分支 · 双采优先',
        detail: '矿物草药双追踪、读条加速、采集暴击与制造技能点加成。',
      },
      {
        step: 3,
        zone: '传承天赋 · 充裕分支',
        title: '[充裕] 充裕分支 · 声望与金币',
        detail: '声望/金币掉落提升、邮件即时到达与里程碑外观奖励。',
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
    trainers: '初级/中级：主城炼金师（幽暗城医生马什 (50.9, 74.6) / 铁炉堡塔莉·贝里菲兹 (66.6, 55.7) / 荆棘谷藏宝海湾杰辛·充 (28.0, 78.0)）| 高级(125+)：幽暗城赫伯特·哈尔希医生 (47.8, 73.3) / 铁炉堡塔莉·贝里菲兹 (66.6, 55.7) | 大师(200+)：菲拉斯羽月要塞凯尔希·风语者 (32.6, 43.8) / 悲伤沼泽罗格瓦 (48.5, 55.9)',
    foreverNote: '无限服练级药剂与抗性药水需求极高，275 级可转化奥金锭稳定赚取金币。',
  },
  {
    id: 'blacksmithing',
    name: '锻造',
    type: 'crafting',
    pairs: ['采矿'],
    makes: ['板甲和锁甲', '近战武器', '磨刀石和平衡石', '装备强化与盾刺'],
    brackets: '1-75 劣质磨刀石/铜质链甲 → 75-125 粗制磨刀石/青铜护腿 → 125-200 重磨刀石/绿铁护腕/金鳞护腕 → 200-250 秘银套/致密磨刀石 → 250-300 瑟银护甲与帝国板甲',
    trainers: '初级/中级：各主城熔炉区均有（暴风城 / 铁炉堡 / 幽暗城 / 奥格瑞玛）| 高级(125+)：铁炉堡本古斯·深炉 (52.5, 41.5) / 奥格瑞玛萨鲁·钢怒 (82.3, 23.0) | 大师(200+)：藏宝海湾布里克·基克拉夫 (29.0, 75.6)',
    foreverNote: '无限服物资箱经常需要绿铁/秘银锻造件，磨刀石可显著提升物理职业野外效率。',
  },
  {
    id: 'enchanting',
    name: '附魔',
    type: 'crafting',
    pairs: ['裁缝'],
    makes: ['武器和护甲永久附魔', '初级/次级魔法杖', '分解绿装获取魔尘与精华'],
    brackets: '1-75 附魔护腕-初级生命/初级魔法杖 → 75-135 初级耐力/次级魔法杖 → 135-200 附魔护腕-耐力/力量 → 200-250 附魔披风-强效防御 → 250-300 十字军/强效属性',
    trainers: '初级/中级：主城附魔训练师（暴风城卢坎·科德尔 (52.9, 74.5) / 幽暗城莱文妮娅·克罗 (62.5, 61.8)）| 高级(125+)：艾尔文森林基塔·火风 (64.9, 70.7) / 石爪山脉赫加斯 (49.2, 57.2) | 大师(200+)：奥达曼副本内安诺拉（入口：荒芜之地 (44.6, 12.1)）',
    foreverNote: '5 级做出的【初级魔法杖】（DPS 11.3）与 13 级【次级魔法杖】是牧师、法师、术士前期的最强神器！',
  },
  {
    id: 'engineering',
    name: '工程学',
    type: 'crafting',
    pairs: ['采矿'],
    makes: ['炸弹和手雷', '工程护目镜', '靶假人与起搏器', '无限服实用装置与坐骑'],
    brackets: '1-75 劣质火药/一把螺栓/弧光扳手 → 75-150 粗制炸药/青铜管/活动假人 → 150-200 铁皮手雷/发条式同步陀螺仪 → 200-260 实心炸药/秘银外壳 → 260-300 瑟银零件/奥术炸弹',
    trainers: '初级/中级：主城工程区（铁炉堡斯普林格·菲兹吉尔 (68.5, 43.5) / 奥格瑞玛罗克希克 (76.2, 25.2)）| 高级(125+)：铁炉堡斯普林格·菲兹吉尔 (68.5, 43.5) / 奥格瑞玛罗克希克 (76.2, 25.2) | 大师(200+)：加基森巴兹克·布拉斯温 (52.3, 27.7)',
    foreverNote: '铁皮手雷提供珍贵的远程范围昏迷控制，高级假人在单刷精英任务和无限服新副本救场中极为强力。',
  },
  {
    id: 'leatherworking',
    name: '制皮',
    type: 'crafting',
    pairs: ['剥皮'],
    makes: ['皮甲和锁甲', '护甲片', '箭袋和弹药袋', '★无限服专属：营地帐篷'],
    brackets: '1-75 轻皮护甲片/雕花皮靴 → 75-150 中皮护甲片/黑皮战靴 → 150-205 重皮/野人护肩 → 205-250 厚皮/夜色头带 → 250-300 硬甲皮护腕/邪恶皮甲',
    trainers: '初级/中级：各主城制皮师均可（暴风城 / 铁炉堡 / 幽暗城 / 奥格瑞玛）| 高级(125+)：达纳苏斯泰洛尼斯 (64.4, 21.5) / 雷霆崖乌娜 (41.5, 42.6) | 大师(200+)：辛特兰德拉克·石拳 (13.4, 43.5) / 菲拉斯哈拉纳·铁皮 (74.4, 43.1)',
    foreverNote: '★无限服核心生活专业：制皮师可制作一次性【营地帐篷】，在野外篝火旁支起帐篷可让附近所有玩家极速恢复至 150% 双倍休息经验！',
  },
  {
    id: 'tailoring',
    name: '裁缝',
    type: 'crafting',
    pairs: ['附魔'],
    makes: ['布甲装备', '6至16格背包', '用于附魔分解的绿装', '月布与法术强度套装'],
    brackets: '1-75 亚麻布卷/强化亚麻斗篷 → 75-125 毛料卷/灰布护肩 → 125-205 丝绸卷/碧蓝丝质头巾/深红丝质外衣 → 205-250 魔纹布卷/黑色魔纹套 → 250-300 符文布卷/符文布包',
    trainers: '初级/中级：主城裁缝店（暴风城乔吉奥·波利罗 (53.1, 81.3) / 幽暗城约瑟夫·格里高利 (70.8, 30.7)）| 高级(125+)：暴风城乔吉奥·波利罗 (53.1, 81.3) / 幽暗城约瑟夫·格里高利 (70.8, 30.7) | 大师(200+)：塔伦米尔达瑞尔·斯塔克 (63.8, 20.8) / 塞拉摩提莫西·沃辛顿 (66.2, 51.8)',
    foreverNote: '无需采集专业即可靠人形怪掉落布匹冲级，制作的背包与物资箱紧俏布甲在无限服拍卖行常年畅销。',
  },
  {
    id: 'herbalism',
    name: '草药学',
    type: 'gathering',
    pairs: ['炼金术'],
    makes: ['炼金术全阶段草药', '无限服物资箱所需草药', '拍卖行高价值合剂原料'],
    brackets: '1-70 宁神花/银叶草/地根草 → 70-150 魔皇草/石南草/跌打草 → 150-230 皇血草/枯叶草/金棘草 → 230-300 太阳草/阿尔萨斯之泪/梦叶草/黑莲花',
    trainers: '各大主城及新手镇草药学训练师均可直接传授至大师级 (1-300)：艾尔文森林草药师波莫里 (40.0, 48.4) / 幽暗城玛莎·阿利斯塔 (54.0, 49.5) / 铁炉堡雷纳·石枝 (55.9, 59.1) / 奥格瑞玛简迪 (55.6, 39.5) / 雷霆崖科明·冬蹄 (50.0, 40.4) / 达纳苏斯菲罗德伦·月语者 (48.0, 68.0)',
    foreverNote: '搭配 GatherMate2 采集助手可在地图标记无限服新增区域（泽风岛、河林）的密集草药刷新点。',
  },
  {
    id: 'mining',
    name: '采矿',
    type: 'gathering',
    pairs: ['锻造', '工程学'],
    makes: ['铜/锡/铁/秘银/瑟银矿石与锭', '奥术水晶与宝石原石'],
    brackets: '1-65 铜矿 → 65-125 锡矿/银矿(熔炼青铜) → 125-175 铁矿/金矿 → 175-245 秘银矿/真银矿 → 245-300 瑟银矿/富瑟银矿',
    trainers: '各大主城及城镇采矿训练师均可直接传授至大师级 (1-300)：暴风城格尔曼·石手 (59.3, 37.8) / 铁炉堡吉奥弗拉姆·博尔德托 (50.0, 26.3) / 幽暗城布罗姆·基利安 (56.0, 37.5) / 奥格瑞玛马卡鲁 (73.1, 26.1) / 雷霆崖布雷克·石蹄 (34.4, 57.9) / 达纳苏斯（无采矿训练师，请前往阵营主城）',
    foreverNote: '前中期熔炼银锭、金锭即可跨过枯燥采集段；无限服新增副本【挖掘场：湿地】内含有丰富矿脉。',
  },
  {
    id: 'skinning',
    name: '剥皮',
    type: 'gathering',
    pairs: ['制皮'],
    makes: ['轻皮/中皮/重皮/厚皮/硬甲皮', '毛皮与龙鳞'],
    brackets: '1-75 新手区野兽(1-15级) → 75-150 贫瘠之地/洛克莫丹/赤脊山(15-30级) → 150-225 荆棘谷/河林/凄凉之地(30-45级) → 225-300 塔纳利斯/安戈洛环形山(45-60级)',
    trainers: '各大主城制皮店旁的剥皮训练师均可直接传授至大师级 (1-300)：暴风城玛丽斯·格兰杰 (72.1, 62.2) / 铁炉堡巴尔苏斯·石剥 (39.9, 32.5) / 幽暗城基连·哈吉 (70.2, 59.2) / 奥格瑞玛图瓦德 (63.4, 45.4) / 雷霆崖穆兰塔 (44.4, 43.1) / 达纳苏斯埃拉德里尔 (64.1, 22.3)，记得购买【剥皮小刀】放在背包内。',
    foreverNote: '练级途中零成本顺手剥皮，直接卖店即可稳定攒齐 40 级小马金币，或供制皮制作无限服帐篷。',
  },
  {
    id: 'cooking',
    name: '烹饪',
    type: 'secondary',
    pairs: ['钓鱼'],
    makes: ['耐力与精神属性食物', '★无限服特色：提供经验值加成的料理', '营火料理'],
    brackets: '1-50 香料面包/烤野猪肉 → 50-130 烟熏熊肉/美味煎蛋卷 → 130-225 烤奇美拉肉片/烤狮肉/巨型煎蛋卷 → 225-300 嫩狼肉排/夜鳞鱼汤/沙漠肉丸子',
    trainers: '初级/中级：各主城旅店与烹饪师均可（暴风城斯蒂芬·赖巴克 (78.2, 53.1) / 奥格瑞玛扎姆加 (57.4, 54.0) / 铁炉堡达里尔·里克努森 (60.1, 36.4)）| 高级(125+)：灰谷阿斯特兰纳哈尔扬·橡心 (34.9, 50.9) / 凄凉之地乌兰 (26.2, 69.7) 购买《中级烹饪教材》（暴风城肯多·卡邦卡 (77.5, 52.7) 处可购高级食谱）| 大师(225+)：加基森迪尔格·快切 (52.6, 28.1) 完成烹饪任务',
    foreverNote: '无限服新增提供经验值加成与额外主属性的特色食谱，配合钓鱼可完全零成本冲满 300。',
  },
  {
    id: 'first-aid',
    name: '急救',
    type: 'secondary',
    pairs: [],
    makes: ['亚麻/毛料/丝质/魔纹/符文布绷带', '抗毒药剂'],
    brackets: '1-80 亚麻绷带/厚亚麻绷带 → 80-150 绒线绷带/厚绒线绷带 → 150-210 丝质绷带/厚丝质绷带 → 210-260 魔纹绷带/厚魔纹绷带 → 260-300 符文布绷带/厚符文布绷带',
    trainers: '初级/中级：各主城急救师均可（暴风城夏娜·富勒 (53.0, 44.7) / 幽暗城玛丽·埃德拉斯 (73.2, 55.1) / 铁炉堡妮萨·火石 (55.1, 58.3)）| 高级(150+)：阿拉希高地德尼布·沃克 (27.0, 58.8) / 费伍德森林巴莱 (34.8, 53.2) 购买《高级急救教材》| 大师(225+)：尘泥沼泽塞拉摩古斯塔夫·范豪森医生 (67.8, 49.0) / 阿拉希高地落锤镇格雷戈里·维克多医生 (73.4, 36.9) 完成救死扶伤任务',
    foreverNote: '战士、潜行者、猎人、术士等全职业必满副业，战斗间隙 8 秒回满生命值大幅减少坐地板时间。',
  },
  {
    id: 'fishing',
    name: '钓鱼',
    type: 'secondary',
    pairs: ['烹饪'],
    makes: ['黑口鱼/火鳞鳝鱼/石鳞鳗（炼金原料）', '夜鳞鲷鱼/斑点黄尾鱼（高级烹饪）', '水中漂浮残骸宝箱'],
    brackets: '1-75 主城及新手村水域 → 75-150 贫瘠之地绿洲/洛克莫丹 → 150-225 荆棘谷/河林/凄凉之地 → 225-300 菲拉斯/塔纳利斯热砂港/艾萨拉',
    trainers: '初级/中级：主城钓鱼师（暴风城阿诺德·莱兰 (55.0, 69.7) / 铁炉堡格林纳·石须 (48.1, 6.9) / 奥格瑞玛卢马克 (69.8, 29.2) / 雷霆崖卡·米斯特鲁纳 (56.1, 46.4)）| 高级(125+)：藏宝海湾老人海明威 (27.4, 77.2) 购买《中级钓鱼教材：鲈鱼与你》| 大师(225+)：尘泥沼泽纳特·帕格 (58.6, 60.1) 完成钓鱼大师任务',
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
      const seenZoneEntries = new Set();
      const picked = [];
      for (const item of scored) {
        const key = `${item.az.zone}:${item.az.from}:${item.az.to}:${item.az.hub || ''}`;
        if (seenZoneEntries.has(key)) continue;
        seenZoneEntries.add(key);
        picked.push({
          zone: item.az.zone,
          hub: item.az.hub,
          from: item.az.from,
          to: item.az.to,
          x: item.az.x,
          y: item.az.y,
          note: item.az.note,
        });
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

async function fetchWithRetry(url, init, retries = 2, timeoutMs = 12000) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const attemptSignal = init?.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)])
        : AbortSignal.timeout(timeoutMs);
      const res = await fetch(url, { ...init, signal: attemptSignal });
      if (res.ok || (res.status !== 502 && res.status !== 503 && res.status !== 429 && res.status !== 504)) {
        return res;
      }
      await res.body?.cancel().catch(() => {});
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
      if (init?.signal?.aborted) throw err;
    }
    if (attempt < retries) {
      await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  if (lastErr) throw lastErr;
  throw new Error(`Fetch failed for ${url}`);
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
    const res = await fetchWithRetry(url, {
      headers: { ...getHeaders(url), 'Accept-Language': 'zh-CN,zh;q=0.9' },
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
  if (major === 6) {
    readLen();
    return decodeCborValue(buf, state);
  }
  if (major === 7) {
    if (info === 20) return false;
    if (info === 21) return true;
    if (info === 22) return null;
    if (info === 23) return undefined;
    if (info === 25) {
      const half = buf.readUInt16BE(state.offset);
      state.offset += 2;
      const sign = half >> 15 ? -1 : 1;
      const exp = (half >> 10) & 0x1f;
      const mant = half & 0x3ff;
      if (exp === 0) return sign * Math.pow(2, -14) * (mant / 1024);
      if (exp === 31) return mant ? NaN : sign * Infinity;
      return sign * Math.pow(2, exp - 15) * (1 + mant / 1024);
    }
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
async function loadQuestiePrereqs(cacheDir, zipFilename = 'questie-db-forever.zip', zipBuffer = null) {
  const dbMap = new Map();
  let parseErrors = 0;
  try {
    let buf = zipBuffer;
    if (!buf) {
      const zipPath = path.join(cacheDir, zipFilename);
      if (!fs.existsSync(zipPath)) return dbMap;
      buf = fs.readFileSync(zipPath);
    }
    const zip = await JSZip.loadAsync(buf);
    const tocFile = zip.file('QuestieDB/QuestieDB_Forever.toc') || zip.file('QuestieDB/QuestieDB_Camelot.toc');
    if (!tocFile) return dbMap;
    const toc = await tocFile.async('string');
    const verMatch = toc.match(/^## Version:\s*(.+)$/m);
    if (verMatch) dbMap._questieDbVersion = verMatch[1].trim();
    const getOrCreate = qid => {
      let entry = dbMap.get(qid);
      if (!entry) {
        entry = {
          preSingle: null,
          preGroup: null,
          breadcrumbs: null,
          repeatable: false,
          name: '',
          level: 0,
          minLevel: 0,
          races: 0,
          classes: 0,
          zoneOrSort: 0,
          requiredSkill: null,
          nextQuest: 0,
          starterNpcIds: null,
          starterObjIds: null,
          starterAreas: null,
        };
        dbMap.set(qid, entry);
      }
      return entry;
    };
    const npcAreas = new Map();
    const objAreas = new Map();
    const addAreas = (map, eid, aids) => {
      let set = map.get(eid);
      if (!set) {
        set = new Set();
        map.set(eid, set);
      }
      for (const aid of aids) {
        const n = Number(aid);
        if (n > 0) set.add(n);
      }
    };
    const extractSpawnAreas = val => {
      if (Array.isArray(val)) {
        const aids = [];
        for (let idx = 0; idx < val.length; idx++) {
          if (val[idx] != null) aids.push(idx + 1);
        }
        return aids;
      }
      if (val && typeof val === 'object') {
        return Object.keys(val);
      }
      return [];
    };
    const seenTableRecords = new Set();
    const expectedTableChecks = [];
    const maskByEntity = new Map();
    const isValidTableField = (kind, field, val) => {
      if (!val || typeof val !== 'object') return false;
      if (kind === 'Npc' && field === '7') return true;
      if (kind === 'Object' && field === '4') return true;
      if (kind === 'Quest') {
        if (field === '2') {
          const slots = Array.isArray(val) ? [val[0], val[1], val[2]] : [val[1], val[2], val[3]];
          return slots.every(s => s == null || typeof s === 'object');
        }
        if (field === '12' || field === '13' || field === '28' || field === '35') {
          return Array.isArray(val);
        }
        if (field === '18') return typeof val === 'object';
      }
      return true;
    };
    const processDecodedRecord = (kind, entityId, field, rawBase64) => {
      try {
        const val = decodeCborValue(Buffer.from(rawBase64, 'base64'));
        if (field === 'S' && (!val || typeof val !== 'object' || Buffer.isBuffer(val))) {
          parseErrors++;
          return;
        }
        if (field !== 'S') {
          if (!isValidTableField(kind, field, val)) {
            parseErrors++;
            return;
          }
          seenTableRecords.add(`${kind}:${entityId}:${field}`);
        } else if (typeof val.p === 'number' && Number.isSafeInteger(val.p) && val.p >= 0) {
          const mask = BigInt(val.p);
          expectedTableChecks.push({ kind, entityId, mask });
          maskByEntity.set(`${kind}:${entityId}`, mask);
        }
        if (kind === 'Npc') {
          if (field === '7' && val && typeof val === 'object') {
            addAreas(npcAreas, entityId, extractSpawnAreas(val));
          } else if (field === 'S' && typeof val[9] === 'number' && val[9] > 0) {
            addAreas(npcAreas, entityId, [val[9]]);
          }
          return;
        }
        if (kind === 'Object') {
          if (field === '4' && val && typeof val === 'object') {
            addAreas(objAreas, entityId, extractSpawnAreas(val));
          } else if (field === 'S' && typeof val[5] === 'number' && val[5] > 0) {
            addAreas(objAreas, entityId, [val[5]]);
          }
          return;
        }
        const qid = entityId;
        if (field === '2' && Array.isArray(val)) {
          const entry = getOrCreate(qid);
          if (Array.isArray(val[0]) && val[0].length > 0) entry.starterNpcIds = val[0].map(Number).filter(Boolean);
          if (Array.isArray(val[1]) && val[1].length > 0) entry.starterObjIds = val[1].map(Number).filter(Boolean);
        } else if (field === '13' && Array.isArray(val) && val.length > 0) {
          getOrCreate(qid).preSingle = val.map(Number).filter(Boolean);
        } else if (field === '12' && Array.isArray(val) && val.length > 0) {
          getOrCreate(qid).preGroup = val.map(Number).filter(Boolean);
        } else if (field === '18' && val != null) {
          getOrCreate(qid).requiredSkill = val;
        } else if (field === '35' && Array.isArray(val) && val.length > 0) {
          getOrCreate(qid).requiredSkill = val;
        } else if (field === '28' && Array.isArray(val) && val.length > 0) {
          getOrCreate(qid).breadcrumbs = val.map(Number).filter(Boolean);
        } else if (field === 'S' && val && typeof val === 'object') {
          if (val[6] != null && (typeof val[6] !== 'number' || !Number.isSafeInteger(val[6]) || val[6] < 0)) {
            parseErrors++;
            return;
          }
          const entry = getOrCreate(qid);
          if (typeof val[1] === 'string') entry.name = val[1];
          if (typeof val[4] === 'number') entry.minLevel = val[4];
          if (typeof val[5] === 'number') entry.level = val[5];
          if (typeof val[6] === 'number') entry.races = val[6];
          if (typeof val[7] === 'number') entry.classes = val[7];
          if (typeof val[17] === 'number') entry.zoneOrSort = val[17];
          if (typeof val[22] === 'number') entry.nextQuest = val[22];
          if (Number(val[24]) & 1) entry.repeatable = true;
          if ((typeof val[31] === 'number' && val[31] > 0) || (Array.isArray(val[35]) && val[35].length > 0)) {
            entry.requiredSkill = val[31] || val[35];
          }
        }
      } catch {
        parseErrors++;
      }
    };

    const sharded = new Map();
    for (const line of toc.split(/\r?\n/)) {
      const m = line.match(/^## X-(Quest|Npc|Object)-(\d+)-(2|4|7|12|13|18|28|35|S)(?:-(\d+))?:\s*(.+)$/);
      if (!m) continue;
      const kind = m[1];
      const entityId = Number(m[2]);
      const field = m[3];
      const shardIdx = m[4] ? Number(m[4]) : 0;
      const raw = m[5].trim();
      if (!raw) continue;
      const recKey = `${kind}:${entityId}:${field}`;
      if (shardIdx > 0) {
        let s = sharded.get(recKey);
        if (!s) {
          s = { kind, entityId, field, expected: 0, base: '', chunks: [] };
          sharded.set(recKey, s);
        }
        s.chunks[shardIdx] = raw;
        continue;
      }
      if (raw.startsWith('~')) {
        const sm = raw.match(/^~(\d+)~$/);
        if (!sm || Number(sm[1]) <= 0) {
          parseErrors++;
          continue;
        }
        let s = sharded.get(recKey);
        if (!s) {
          s = { kind, entityId, field, expected: Number(sm[1]), chunks: [] };
          sharded.set(recKey, s);
        } else {
          s.expected = Number(sm[1]);
        }
        continue;
      }
      processDecodedRecord(kind, entityId, field, raw);
    }
    for (const s of sharded.values()) {
      const parts = [];
      let missing = s.expected <= 0;
      for (let i = 1; i <= s.expected; i++) {
        if (!s.chunks[i]) {
          missing = true;
          break;
        }
        parts.push(s.chunks[i]);
      }
      if (missing || parts.length === 0) {
        parseErrors++;
        continue;
      }
      processDecodedRecord(s.kind, s.entityId, s.field, parts.join(''));
    }
    const tableFieldsByKind = { Npc: [7], Object: [4], Quest: [2, 12, 13, 18, 28, 35] };
    for (const chk of expectedTableChecks) {
      const fields = tableFieldsByKind[chk.kind];
      if (!fields) continue;
      for (const f of fields) {
        if ((chk.mask >> BigInt(f - 1)) & 1n) {
          if (!seenTableRecords.has(`${chk.kind}:${chk.entityId}:${f}`)) {
            parseErrors++;
          }
        }
      }
    }
    for (const recKey of seenTableRecords) {
      const [kind, eid, fieldStr] = recKey.split(':');
      const mask = maskByEntity.get(`${kind}:${eid}`);
      if (mask === undefined || !((mask >> BigInt(Number(fieldStr) - 1)) & 1n)) {
        parseErrors++;
      }
    }
    dbMap._parseErrors = parseErrors;
    for (const entry of dbMap.values()) {
      const areas = new Set();
      for (const nid of entry.starterNpcIds || []) {
        const s = npcAreas.get(nid);
        if (s) for (const aid of s) areas.add(aid);
      }
      for (const oid of entry.starterObjIds || []) {
        const s = objAreas.get(oid);
        if (s) for (const aid of s) areas.add(aid);
      }
      if (areas.size > 0) {
        entry.starterAreas = areas;
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

const ZONE_NAME_TO_AREA_IDS = {
  艾尔文森林: [12, 9, 6170, 16510],
  丹莫罗: [1, 132, 131, 133, 135, 801, 6176, 6457],
  泰达希尔: [141, 188],
  西部荒野: [40],
  洛克莫丹: [38, 146],
  黑海岸: [148, 442],
  赤脊山: [44],
  湿地: [11, 16876],
  灰谷: [331],
  暮色森林: [10],
  石爪山脉: [406],
  希尔斯布莱德丘陵: [267],
  奥特兰克山脉: [36],
  凄凉之地: [405],
  荆棘谷: [33, 5287, 5339],
  千针石林: [400],
  阿拉希高地: [45],
  尘泥沼泽: [15],
  河林: [16591, 16820],
  荒芜之地: [3],
  悲伤沼泽: [8],
  辛特兰: [47],
  菲拉斯: [357],
  塔纳利斯: [440],
  灼热峡谷: [51],
  艾萨拉: [16],
  费伍德森林: [361],
  安戈洛环形山: [490],
  诅咒之地: [4],
  燃烧平原: [46],
  西瘟疫之地: [28],
  东瘟疫之地: [139],
  冬泉谷: [618],
  希利苏斯: [1377],
  海加尔山: [616],
  杜隆塔尔: [14, 363],
  提瑞斯法林地: [85, 154, 6454],
  莫高雷: [215, 220],
  贫瘠之地: [17, 392],
  银松森林: [130],
  泽风岛: [16593],
  逆风小径: [41],
  月光林地: [493],
  吉尔尼斯: [16756, 16757, 17065],
};

function buildZoneQuestsIndex(questiePrereqs) {
  if (!questiePrereqs || questiePrereqs.size === 0) return {};
  const ALLIANCE_MASK = 1n | 4n | 8n | 64n | 4294967296n;
  const HORDE_MASK = 2n | 16n | 32n | 128n | 8589934592n;
  const FULL_ALLIANCE_MASK = 4294967373n;
  const FULL_HORDE_MASK = 8589934770n;

  const getFactionCode = races => {
    if (!races) return 'b';
    const r = BigInt(races);
    const hasA = (r & ALLIANCE_MASK) !== 0n;
    const hasH = (r & HORDE_MASK) !== 0n;
    if (hasA && !hasH) return 'a';
    if (hasH && !hasA) return 'h';
    return 'b';
  };

  const out = {};
  for (const [zoneName, areaIds] of Object.entries(ZONE_NAME_TO_AREA_IDS)) {
    const areaSet = new Set(areaIds);
    const list = [];
    for (const [qid, info] of questiePrereqs.entries()) {
      const matchesZoneOrSort = areaSet.has(info.zoneOrSort);
      let matchesStarterArea = false;
      if (!matchesZoneOrSort && info.starterAreas) {
        for (const aid of info.starterAreas) {
          if (areaSet.has(aid)) {
            matchesStarterArea = true;
            break;
          }
        }
      }
      if ((matchesZoneOrSort || matchesStarterArea) && !info.repeatable && !info.classes && !info.requiredSkill) {
        list.push([qid, info]);
      }
    }
    if (list.length === 0) continue;

    const PLAYABLE_RACE_MASK = ALLIANCE_MASK | HORDE_MASK;
    const effectiveRaces = races => {
      if (!races || races === 0) return PLAYABLE_RACE_MASK;
      return BigInt(races) & PLAYABLE_RACE_MASK;
    };
    const racesCoveredBy = (preRaces, childRaces) => {
      return (effectiveRaces(preRaces) & ~effectiveRaces(childRaces)) === 0n;
    };

    const idSet = new Set(list.map(([qid]) => qid));
    const covered = new Set();
    for (const [qid, info] of list) {
      const canCover = pid => {
        if (!idSet.has(pid)) return false;
        const p = questiePrereqs.get(pid);
        if (!p) return false;
        return racesCoveredBy(p.races, info.races);
      };
      if (Array.isArray(info.preSingle) && info.preSingle.length === 1 && canCover(info.preSingle[0])) {
        covered.add(info.preSingle[0]);
      }
      if (Array.isArray(info.preGroup)) {
        for (const pid of info.preGroup) {
          if (canCover(pid)) covered.add(pid);
        }
      }
      if (info.nextQuest && idSet.has(info.nextQuest)) {
        const nq = questiePrereqs.get(info.nextQuest);
        const nqHasRecoverableBackLink =
          nq &&
          ((Array.isArray(nq.preSingle) && nq.preSingle.length === 1 && nq.preSingle[0] === qid) ||
            (Array.isArray(nq.preGroup) && nq.preGroup.includes(qid)));
        if (nqHasRecoverableBackLink && racesCoveredBy(info.races, nq.races)) {
          covered.add(qid);
        }
      }
    }

    // 按适用种族校验每个区域起点的可接任务在运行时回溯深度 (depth < 12) 内是否可达；
    // 使用与 Lua ResolveQuestChainFromQuestieDB 一致的 per-root visited 规则，避免长分支提前占位导致短路径被跳过
    const reachableByRace = new Map();
    const markRootReachable = (rootId, rootRaces) => {
      const rootVisited = new Set();
      const dfs = (curId, depth, pathRaces) => {
        if (depth >= 12 || rootVisited.has(curId)) return;
        rootVisited.add(curId);
        const cur = questiePrereqs.get(curId);
        const eff = cur ? pathRaces & effectiveRaces(cur.races) : pathRaces;
        if (eff !== 0n) {
          reachableByRace.set(curId, (reachableByRace.get(curId) || 0n) | eff);
        }
        if (!cur) return;
        const preIds =
          Array.isArray(cur.preGroup) && cur.preGroup.length > 0
            ? cur.preGroup
            : Array.isArray(cur.preSingle) && cur.preSingle.length === 1
              ? [cur.preSingle[0]]
              : [];
        for (const pid of preIds) {
          if (pid) dfs(pid, depth + 1, eff);
        }
      };
      dfs(rootId, 0, rootRaces);
    };
    for (const [qid, info] of list) {
      if (!covered.has(qid)) {
        markRootReachable(qid, effectiveRaces(info.races));
      }
    }
    for (const [qid, info] of list) {
      if (covered.has(qid)) {
        const needed = effectiveRaces(info.races);
        const reached = reachableByRace.get(qid) || 0n;
        if ((needed & ~reached) !== 0n) {
          covered.delete(qid);
          markRootReachable(qid, needed);
        }
      }
    }

    const entries = [];
    const coveredIds = [];
    for (const [qid, info] of list) {
      if (covered.has(qid)) {
        coveredIds.push(qid);
        continue;
      }
      const f = getFactionCode(info.races);

      // 沿前置链回溯起点等级与整条链最高等级，避免长链后半段等级过高导致前半段在低级时被过滤
      let rootMin = info.minLevel || info.level || 1;
      let rootLv = info.level || info.minLevel || 1;
      let maxLv = info.level || info.minLevel || 1;
      const bestDepth = new Map();
      const walkBack = (curId, depth) => {
        if (depth >= 12) return;
        const prevDepth = bestDepth.get(curId);
        if (prevDepth !== undefined && prevDepth <= depth) return;
        bestDepth.set(curId, depth);
        const cur = questiePrereqs.get(curId);
        if (!cur) return;
        const curMin = cur.minLevel || cur.level || 1;
        const curLv = cur.level || cur.minLevel || 1;
        if (curMin < rootMin) rootMin = curMin;
        if (curLv < rootLv) rootLv = curLv;
        if (curLv > maxLv) maxLv = curLv;
        const preIds =
          Array.isArray(cur.preGroup) && cur.preGroup.length > 0
            ? cur.preGroup.map(pid => Math.abs(Number(pid) || 0)).filter(Boolean)
            : Array.isArray(cur.preSingle) && cur.preSingle.length > 0
              ? cur.preSingle.map(pid => Math.abs(Number(pid) || 0)).filter(Boolean)
              : [];
        for (const pid of preIds) {
          if (!pid) continue;
          walkBack(pid, depth + 1);
        }
      };
      walkBack(qid, 0);

      const entry = {
        id: qid,
        f,
        min: rootMin,
        lv: rootLv,
        maxLv,
      };
      if (info.races > 0) {
        const rBig = BigInt(info.races);
        if (rBig !== FULL_ALLIANCE_MASK && rBig !== FULL_HORDE_MASK) {
          entry.r = info.races;
        }
      }
      entries.push(entry);
    }

    entries.sort((a, b) => a.min - b.min || a.lv - b.lv || a.id - b.id);
    if (entries.length > 0) {
      out[zoneName] = entries;
      if (coveredIds.length > 0) {
        if (!out._coveredByZone) {
          Object.defineProperty(out, '_coveredByZone', { value: {}, enumerable: false });
        }
        out._coveredByZone[zoneName] = coveredIds;
      }
    }
  }
  return out;
}

export function isValidZoneQuestsData(zoneQuests, zoneAreaIds) {
  if (!zoneQuests || typeof zoneQuests !== 'object' || !zoneAreaIds || typeof zoneAreaIds !== 'object') {
    return false;
  }
  const zones = Object.keys(zoneQuests);
  if (zones.length < 30) return false;
  return zones.every(
    z =>
      Array.isArray(zoneQuests[z]) &&
      zoneQuests[z].length > 0 &&
      zoneQuests[z].every(e => e && typeof e === 'object' && Number.isInteger(e.id) && e.id > 0) &&
      Array.isArray(zoneAreaIds[z]) &&
      zoneAreaIds[z].length > 0 &&
      zoneAreaIds[z].every(a => Number.isInteger(a) && a > 0)
  );
}

export async function hasValidZoneQuestsBuffer(zipBuffer) {
  try {
    if (!zipBuffer || zipBuffer.length === 0) return false;
    const prereqs = await loadQuestiePrereqs('', 'questie-db-forever.zip', zipBuffer);
    if (!prereqs || prereqs.size === 0 || (prereqs._parseErrors || 0) > 0) return false;
    const index = buildZoneQuestsIndex(prereqs);
    return isValidZoneQuestsData(index, ZONE_NAME_TO_AREA_IDS);
  } catch {
    return false;
  }
}

export async function hasValidZoneQuestsIndex(cacheDir, zipFilename = 'questie-db-forever.zip') {
  try {
    const prereqs = await loadQuestiePrereqs(cacheDir, zipFilename);
    if (!prereqs || prereqs.size === 0 || (prereqs._parseErrors || 0) > 0) return false;
    const index = buildZoneQuestsIndex(prereqs);
    return isValidZoneQuestsData(index, ZONE_NAME_TO_AREA_IDS);
  } catch {
    return false;
  }
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
  if ((questiePrereqs._parseErrors || 0) === 0) {
    const builtZoneQuests = buildZoneQuestsIndex(questiePrereqs);
    if (Object.keys(builtZoneQuests).length >= 30) {
      dataset.zoneQuests = builtZoneQuests;
      dataset.zoneAreaIds = ZONE_NAME_TO_AREA_IDS;
      if (builtZoneQuests._coveredByZone) {
        dataset.zoneCoveredIds = builtZoneQuests._coveredByZone;
      }
      if (questiePrereqs._questieDbVersion && dataset.meta) {
        dataset.meta.questieDbVersion = questiePrereqs._questieDbVersion;
      }
    }
  }
  return dataset;
}

const BUILTIN_DUNGEON_QUEST_SUPPLEMENTS = {
  'wailing-caverns': [
    { id: 914, name: '变异皮革', level: 22, minLevel: 15, faction: 'both', npc: '纳尔帕克', zone: '贫瘠之地', x: 45.8, y: 35.8 },
    { id: 1487, name: '清除变异者', level: 21, minLevel: 15, faction: 'both', npc: '厄布鲁', zone: '贫瘠之地', x: 45.8, y: 35.8 },
    { id: 6981, name: '发光的碎片', level: 25, minLevel: 18, faction: 'both', inside: true, zone: '哀嚎洞穴' },
  ],
  'razorfen-kraul': [
    { id: 1101, name: '卡尔加·刺肋', level: 34, minLevel: 29, faction: 'alliance', npc: '法芬德尔', zone: '菲拉斯', x: 89.6, y: 46.6 },
    { id: 1144, name: '进口商威利克斯', level: 30, minLevel: 22, faction: 'both', inside: true, npc: '进口商威利克斯', zone: '剃刀沼泽' },
    { id: 1221, name: '蓝叶薯', level: 26, minLevel: 20, faction: 'both', npc: '麦伯克·米希瑞克斯', zone: '贫瘠之地', x: 62.4, y: 37.6 },
  ],
  'scarlet-monastery-library': [
    { id: 1050, name: '泰坦神话', level: 38, minLevel: 28, faction: 'alliance', npc: '图书馆员麦伊·苍尘', zone: '铁炉堡', x: 74.6, y: 12.6 },
  ],
  'scarlet-monastery-armory': [
    { id: 1053, name: '以圣光之名', level: 40, minLevel: 34, faction: 'alliance', npc: '虔诚的莱雷恩', zone: '希尔斯布莱德丘陵', x: 51.5, y: 58.2 },
  ],
  'scarlet-monastery-cathedral': [
    { id: 1053, name: '以圣光之名', level: 40, minLevel: 34, faction: 'alliance', npc: '虔诚的莱雷恩', zone: '希尔斯布莱德丘陵', x: 51.5, y: 58.2 },
  ],
  'razorfen-downs': [
    { id: 3636, name: '带来光明', level: 42, minLevel: 35, faction: 'alliance', npc: '大主教本尼迪塔斯', zone: '暴风城', x: 39.6, y: 27.4 },
    { id: 3341, name: '寒冰之王', level: 42, minLevel: 37, faction: 'both', inside: true, zone: '剃刀高地' },
  ],
};

const DUNGEON_ID_TO_QUESTIE_AREA_IDS = {
  'hall-of-thanes': [16919],
  'ragefire-chasm': [2437],
  'ruins-of-lordaeron': [16611],
  deadmines: [1581, 10029],
  'wailing-caverns': [718],
  'shadowfang-keep': [209, 10014, 10015, 10016, 10017, 10018, 10019],
  'blackfathom-deeps': [719, 10020, 10021],
  stockade: [717],
  'excavation-site': [16732],
  dalaran: [16544],
  'razorfen-kraul': [491, 1717],
  gnomeregan: [721, 133, 10030, 10031, 10032],
  'scarlet-monastery-graveyard': [796, 6109, 6386, 10008, 10009, 10010],
  'scarlet-monastery-library': [796, 6109, 6386, 10008, 10009, 10010],
  'scarlet-monastery-armory': [796, 6109, 6386, 10008, 10009, 10010],
  'scarlet-monastery-cathedral': [796, 6109, 6386, 10008, 10009, 10010],
  'razorfen-downs': [722],
  uldaman: [1337, 1517, 10033],
  'zul-farrak': [1176, 978],
  maraudon: [2100, 10000],
  'sunken-temple': [1477, 1417],
  'blackrock-depths': [1584, 1585],
  'lower-blackrock-spire': [1583, 10003, 10004, 10005, 10006, 10007],
  'upper-blackrock-spire': [1583, 10003, 10004, 10005, 10006, 10007],
  'dire-maul-east': [2557, 10026, 10027],
  'dire-maul-west': [2557, 10023, 10024, 10025],
  'dire-maul-north': [2557, 10022],
  scholomance: [2057, 10011, 10012, 10013],
  'stratholme-main-gate': [2017],
  'stratholme-service-gate': [2017],
};

function questieRacesToFaction(races) {
  if (!races) return 'both';
  const ALLIANCE_MASK = 1n | 4n | 8n | 64n | 4294967296n;
  const HORDE_MASK = 2n | 16n | 32n | 128n | 8589934592n;
  const r = BigInt(races);
  const hasA = (r & ALLIANCE_MASK) !== 0n;
  const hasH = (r & HORDE_MASK) !== 0n;
  if (hasA && !hasH) return 'alliance';
  if (hasH && !hasA) return 'horde';
  return 'both';
}

/**
 * 完全基于本地 QuestieDB（questie-db-forever.zip）补全所有副本的双阵营任务、阵营标记与任务链，
 * 不再依赖 wowf.io 网页抓取。
 */
function enrichDungeonsWithQuestieDB(dungeonMap, questiePrereqs) {
  const allIds = [...dungeonMap.keys()];
  applyDungeonQuestFallbackSupplements(dungeonMap, allIds);
  if (!questiePrereqs || questiePrereqs.size === 0) return;

  // 先建立“已被任意副本收录的 Questie 任务 ID”集合，避免血色/厄运/黑石等多区副本互相重复塞入已知任务
  const assignedQuestIds = new Set();
  for (const dungeon of dungeonMap.values()) {
    for (const q of dungeon.quests || []) {
      const qid = Number(q?.id);
      if (qid) assignedQuestIds.add(qid);
    }
  }

  for (const [dId, dungeon] of dungeonMap.entries()) {
    dungeon.quests = Array.isArray(dungeon.quests) ? dungeon.quests : [];
    // 1. 用 QuestieDB 权威字段（阵营位掩码、等级、最低等级）校准已有任务
    for (let i = 0; i < dungeon.quests.length; i++) {
      const q = dungeon.quests[i];
      const qid = Number(q?.id);
      if (!qid) continue;
      const info = questiePrereqs.get(qid);
      if (!info) continue;
      const qFaction = questieRacesToFaction(info.races);
      dungeon.quests[i] = {
        ...q,
        faction: qFaction,
        level: info.level || q.level || dungeon.minLevel,
        minLevel: info.minLevel || q.minLevel || dungeon.minLevel,
      };
    }

    // 2. 补充 QuestieDB 中属于该副本 AreaID 但尚未收录的非重复任务
    const areaIds = DUNGEON_ID_TO_QUESTIE_AREA_IDS[dId];
    if (!areaIds || areaIds.length === 0) continue;
    const areaSet = new Set(areaIds);
    for (const [qid, info] of questiePrereqs.entries()) {
      if (!areaSet.has(info.zoneOrSort) || info.repeatable || assignedQuestIds.has(qid)) continue;
      assignedQuestIds.add(qid);
      dungeon.quests.push({
        id: qid,
        name: info.name || `任务 #${qid}`,
        level: info.level || dungeon.minLevel,
        minLevel: info.minLevel || dungeon.minLevel,
        faction: questieRacesToFaction(info.races),
        npc: '',
        zone: dungeon.entranceZone || dungeon.zone || '',
        place: '',
      });
    }
  }
}

function applyDungeonQuestFallbackSupplements(dungeonMap, targetIds) {
  for (const dId of targetIds) {
    const supps = BUILTIN_DUNGEON_QUEST_SUPPLEMENTS[dId];
    const dungeon = dungeonMap.get(dId);
    if (!supps || !dungeon) continue;
    dungeon.quests = Array.isArray(dungeon.quests) ? dungeon.quests : [];
    for (const sq of supps) {
      const idx = dungeon.quests.findIndex(q => Number(q?.id) === sq.id);
      if (idx >= 0) {
        if (sq.faction === 'both' && dungeon.quests[idx].faction !== 'both') {
          dungeon.quests[idx] = { ...dungeon.quests[idx], faction: 'both' };
        }
      } else {
        dungeon.quests.push({ ...sq });
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
async function buildWoWFDataset(cacheDir, getHeaders, questieSource = null) {
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
        // 内置指南的 trainers/brackets/foreverNote 是人工校对的坐标版，始终优先于旧缓存里的纯文字版
        const curated = PROFESSION_GUIDES_META.find(p => p.id === cp.id) || {};
        professionsMap.set(cp.id, {
          ...prev,
          ...cp,
          ...(curated.trainers ? { trainers: curated.trainers } : {}),
          ...(curated.brackets ? { brackets: curated.brackets } : {}),
          ...(curated.foreverNote ? { foreverNote: curated.foreverNote } : {}),
        });
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

  const useSnapshotOnly = Boolean(
    questieSource && typeof questieSource === 'object' && !Buffer.isBuffer(questieSource) && questieSource.useSnapshotOnly
  );
  const prevalidatedSnapshot =
    useSnapshotOnly && questieSource && typeof questieSource === 'object' ? questieSource.snapshot || null : null;
  const questieDbBuf = Buffer.isBuffer(questieSource)
    ? questieSource
    : questieSource && typeof questieSource === 'object'
      ? questieSource.questieDbBuf || null
      : null;
  const livePrereqs = useSnapshotOnly
    ? null
    : await loadQuestiePrereqs(cacheDir, 'questie-db-forever.zip', questieDbBuf);

  // 如果路由接口离线导致没有抓到实时路由数据，加载已有完整缓存并用 QuestieDB 补全所有副本任务
  if (liveFetchCount === 0 && cachedDataset) {
    console.log(`[WoWF] Offline mode detected, loading cached dataset from ${cacheFile}`);
    const offlineDungeonMap = new Map(
      (Array.isArray(cachedDataset.dungeons) ? cachedDataset.dungeons : [])
        .filter(d => d && d.id != null)
        .map(d => [d.id, { ...d, quests: Array.isArray(d.quests) ? [...d.quests] : [] }])
    );
    enrichDungeonsWithQuestieDB(offlineDungeonMap, livePrereqs);
    const enrichedDungeons = [...offlineDungeonMap.values()].sort(
      (a, b) => a.minLevel - b.minLevel || a.visit - b.visit
    );
    const cachedDbVersion = cachedDataset.meta?.dbVersion || '2026.11.15';
    return annotateDatasetPrereqs({
      ...cachedDataset,
      dungeons: enrichedDungeons.length > 0 ? enrichedDungeons : cachedDataset.dungeons,
      meta: {
        ...cachedDataset.meta,
        version: `${WOWF_VERSION} + DB v${cachedDbVersion}`,
      },
      professions: professionsList,
      foreverSystems: FOREVER_SYSTEMS_DATA,
    }, livePrereqs);
  }

  // 4. 基于本地 QuestieDB（questie-db-forever.zip）补全全阵营副本任务，不再依赖 wowf.io 网页抓取
  enrichDungeonsWithQuestieDB(dungeonMap, livePrereqs);

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
  if (useSnapshotOnly && prevalidatedSnapshot) {
    dataset.zoneQuests = prevalidatedSnapshot.zoneQuests;
    dataset.zoneAreaIds = prevalidatedSnapshot.zoneAreaIds;
    if (prevalidatedSnapshot.zoneCoveredIds) {
      dataset.zoneCoveredIds = prevalidatedSnapshot.zoneCoveredIds;
    }
    if (prevalidatedSnapshot.questieDbVersion) {
      dataset.meta.questieDbVersion = prevalidatedSnapshot.questieDbVersion;
    }
  } else if (!useSnapshotOnly) {
    annotateDatasetPrereqs(dataset, livePrereqs);
  }
  if (!isValidZoneQuestsData(dataset.zoneQuests, dataset.zoneAreaIds) && cachedDataset?.zoneQuests && cachedDataset?.zoneAreaIds) {
    dataset.zoneQuests = cachedDataset.zoneQuests;
    dataset.zoneAreaIds = cachedDataset.zoneAreaIds;
    if (cachedDataset.zoneCoveredIds) {
      dataset.zoneCoveredIds = cachedDataset.zoneCoveredIds;
    }
    if (cachedDataset.meta?.questieDbVersion) {
      dataset.meta.questieDbVersion = cachedDataset.meta.questieDbVersion;
    }
  }

  // 仅当本次抓取完整（或尚无本地缓存快照）时才写入缓存文件，防止局部网络波动覆盖完整缓存
  const hasCompleteRoutes = Object.keys(routesData).length >= RACE_ROUTES.length;
  const hasCompleteClasses = CLASS_CONFIGS.every(c => Array.isArray(classesData[c.key]?.specs) && classesData[c.key].specs.length > 0);
  const hasZoneQuests = isValidZoneQuestsData(dataset.zoneQuests, dataset.zoneAreaIds);
  if ((!hasPartialFailure && hasCompleteRoutes && hasCompleteClasses && hasZoneQuests) || !cachedDataset) {
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
function generateWoWFToc(version, updatedAt, dataset) {
  const dungeons = Array.isArray(dataset?.dungeons) ? dataset.dungeons : [];
  const totalDungeons = dungeons.length;
  const newDungeons = dungeons.filter(d => d?.isNew).length;
  return `## Interface: 16001
## Title: 巫妖王的无限百科
## Title-zhCN: |cff00ffcc[巫妖王的无限百科]|r 无限服动态指南
## OptionalDeps: Questie, QuestieDB
## Notes: In-game smart companion for wowf.io on WoW Forever (16001). Dynamically matches leveling routes, new dungeons, class rotations, talent builds, and macros to your character's level and class.
## Notes-zhCN: 同步 wowf.io 最新数据的《魔兽世界：无限服》专属游戏内动态百科！根据当前角色等级、职业、专精、种族与阵营自动匹配：1-60升级路线与坐标导航、专精输出循环、10-60逐级天赋加点、一键创建职业宏、${totalDungeons}大副本（含${newDungeons}个无限服新本）必接任务与掉落、露营睡袋/传承天赋/物资箱攻略与最新热修公告，并用 EasyAuction / 黑石交易技能行情筛选当前可制作且能盈利的配方（含中间产物自产与附魔分解套利）。(数据同步: ${updatedAt})
## OptionalDeps: EasyAuction
## Author: lich.tech & wowf.io
## Version: ${version}
## Dependencies: QuestieDB
## SavedVariables: WoWFDB
## X-Website: https://wowf.io/zh
## X-Category: Guide

Data.lua
CraftArb.lua
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
 * 构建并打包 巫妖王的无限百科 插件压缩包 (public/addons/wowf.zip)
 * @param {string} outputDir
 * @param {string} cacheDir
 * @param {(url: string) => Record<string, string>} getHeaders
 * @returns {Promise<{ zip: JSZip, outPath: string, version: string, source: string }>}
 */
export async function buildWoWFAddon(outputDir, cacheDir, getHeaders, questieDbBuf = null) {
  const headSnapshot = getGitHeadOid();
  const craftLuaContent = readWoWFLuaFile('CraftArb.lua');
  const coreLuaContent = readWoWFLuaFile('WoWF.lua');

  console.log('Synchronizing live data from https://wowf.io/zh for 巫妖王的无限百科...');
  const dataset = await buildWoWFDataset(cacheDir, getHeaders, questieDbBuf);
  if (headSnapshot && getGitHeadOid() !== headSnapshot) {
    throw new Error('[WoWF] 异步抓取期间仓库 HEAD 发生变化，请重新执行打包以保证源码与版本号一致。');
  }
  if (!isValidZoneQuestsData(dataset.zoneQuests, dataset.zoneAreaIds)) {
    throw new Error('[WoWF] 缺少完整的区域任务链索引 (zoneQuests/zoneAreaIds)，请确认 .cache/upstream-addons/questie-db-forever.zip 可读。');
  }
  enrichRoutesWithAltZones(dataset.routes);
  normalizeWowfDatasetText(dataset);
  const fullVersion = dataset.meta.version || `${WOWF_VERSION} + DB v2026.11.15`;

  const zip = new JSZip();
  const tocContent = generateWoWFToc(fullVersion, dataset.meta.updatedAt, dataset);
  const dataLuaContent = generateWoWFDataLua(dataset);

  zip.file('WoWF/WoWF.toc', tocContent);
  zip.file('WoWF/Data.lua', dataLuaContent);
  zip.file('WoWF/CraftArb.lua', craftLuaContent);
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
