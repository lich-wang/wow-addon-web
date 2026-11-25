import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { WoWSimulatorRuntime } from './runtime.js';
import { SAMPLE_WOWF_DATA_LUA } from './sample-data.js';
import { stripWoWFormatting } from './text-measure.js';
import { generateHtmlReport } from './html-report.js';

// 坐标数值：兼容整点/多位小数、半角/全角逗号，用于校验可见文案中不得残留坐标
const COORD_TEXT_PATTERN = /\b\d{1,3}(?:\.\d+)?\s*[,，]\s*\d{1,3}(?:\.\d+)?\b/;

// 声望/金币等千位分组（3,000 / 9,000）不是坐标：先去掉分组逗号再检测，
// 避免把「还差 5,750」这类数值误判成裸坐标；`47, 56` 与 `47.8,56.3` 仍会命中。
const stripThousandSeparators = (text) => String(text ?? '').replace(/(\d)[,，](?=\d{3}(?!\d))/g, '$1');
const hasBareCoord = (text) => COORD_TEXT_PATTERN.test(stripThousandSeparators(text));

// 数据文件判定：兼容 Data.lua、Data/Data.lua 子目录以及 `Data.lua (source)` 合成文件名
const isDataLuaFile = (f) => /^data\.lua/i.test(path.basename(f.filename)) || /^data\.lua/i.test(f.filename);

function parseArgs(argv) {
  const opts = {
    addonDir: path.resolve('addons/WoWF'),
    wowDir: '',
    level: 25,
    classKey: 'MAGE',
    faction: 'Alliance',
    slash: ['/wowf', '/wowf route', '/wowf dungeon', '/wowf class', '/wowf macro', '/wowf news', '/wowf cmd', '/wowf arb'],
    html: path.resolve('.cache/wow-ui-sim-report.html'),
    assert: false,
    strictData: false,
  };
  let customSlash = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--addon-dir' && argv[i + 1]) opts.addonDir = path.resolve(argv[++i]);
    else if (a === '--wow-dir' && argv[i + 1]) opts.wowDir = path.resolve(argv[++i]);
    else if (a === '--level' && argv[i + 1]) opts.level = Number(argv[++i]) || 25;
    else if (a === '--class' && argv[i + 1]) opts.classKey = String(argv[++i]).toUpperCase();
    else if (a === '--faction' && argv[i + 1]) opts.faction = argv[++i];
    else if (a === '--slash' && argv[i + 1]) customSlash.push(argv[++i]);
    else if (a === '--html' && argv[i + 1]) opts.html = path.resolve(argv[++i]);
    else if (a === '--no-html') opts.html = '';
    else if (a === '--assert') opts.assert = true;
    else if (a === '--strict-data') opts.strictData = true;
  }
  if (customSlash.length > 0) opts.slash = customSlash;
  return opts;
}

function parseTocLuaOrder(tocContent) {
  const files = [];
  for (const rawLine of tocContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.toLowerCase().endsWith('.lua')) files.push(line.replace(/\\/g, '/'));
  }
  return files;
}

async function resolveAddonFiles(opts) {
  let targetDir = opts.addonDir;
  if (opts.wowDir) {
    const candidate = path.join(opts.wowDir, 'Interface', 'AddOns', 'WoWF');
    if (fs.existsSync(candidate)) targetDir = candidate;
  }

  const addonName = path.basename(targetDir);
  const files = [];
  const tocPath = fs.readdirSync(targetDir).find((f) => f.toLowerCase().endsWith('.toc'));

  if (tocPath) {
    const tocText = fs.readFileSync(path.join(targetDir, tocPath), 'utf8');
    for (const rel of parseTocLuaOrder(tocText)) {
      const full = path.join(targetDir, rel);
      if (!fs.existsSync(full)) {
        if (path.basename(rel).toLowerCase() === 'data.lua' && !opts.strictData) continue;
        throw new Error(`TOC 中声明的文件不存在：${rel}`);
      }
      files.push({ filename: rel, content: fs.readFileSync(full, 'utf8') });
    }
  } else {
    for (const f of fs.readdirSync(targetDir)) {
      if (f.toLowerCase().endsWith('.lua')) {
        files.push({ filename: f, content: fs.readFileSync(path.join(targetDir, f), 'utf8') });
      }
    }
  }

  // If loading repo addons/WoWF without Data.lua, check public/addons/wowf.zip or fallback to SAMPLE_WOWF_DATA_LUA
  const hasDataLua = files.some((f) => path.basename(f.filename).toLowerCase() === 'data.lua');
  if (!hasDataLua && addonName.toLowerCase() === 'wowf') {
    let dataLua = '';
    let source = '';
    const zipPath = path.resolve('public/addons/wowf.zip');
    if (fs.existsSync(zipPath)) {
      const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
      const entry = zip.file('WoWF/Data.lua');
      if (entry) {
        dataLua = await entry.async('string');
        source = 'public/addons/wowf.zip';
      }
    }
    if (!dataLua) {
      if (opts.strictData) {
        throw new Error(`--strict-data 模式下缺少真实的 WoWF/Data.lua（未在 ${zipPath} 中找到）`);
      }
      dataLua = SAMPLE_WOWF_DATA_LUA;
      source = '内置演示 Data.lua';
    }
    files.unshift({ filename: `Data.lua (${source})`, content: dataLua });
  }

  return { addonName, targetDir, files };
}

function isFrameTreeShown(frame, frames) {
  let cur = frame;
  while (cur) {
    if (!cur.shown) return false;
    cur = cur.parentId ? frames[cur.parentId] : null;
  }
  return true;
}

function summarizeCards(snapshot) {
  const cards = [];
  for (const f of Object.values(snapshot.frames)) {
    if (!isFrameTreeShown(f, snapshot.frames) || f.frameType !== 'Frame' || !f.backdrop) continue;
    if (f.name === 'WoWFMainFrame') continue;
    const texts = f.fontStrings
      .map((id) => snapshot.fontStrings[id])
      .filter((fs) => fs && fs.shown && fs.text)
      .map((fs) => stripWoWFormatting(fs.text));
    if (texts.length > 0) {
      cards.push({ title: texts[0], body: texts.slice(1).join('\n') });
    }
  }
  return cards;
}

// 职业任务链标签：旧版路线里程碑卡「Lv.N …·法师职业任务]」与阶段卡「★Lv.N 法师专属职业任务链]」。
// 现在链只在「职业与天赋」页展示，路线页不应再出现；解析器同时识别新版任务链卡片标题与步数格式，
// 避免只换一种展示格式就绕过回归。
const CHAIN_TAG_RE = /\[★?Lv\.(\d+) ([^\]\n]*?)(?:专属职业任务链|专属任务链|职业任务)\]/g;

// 新版「职业与天赋」页任务链卡片：标题含「职业任务链与坐标指引」，正文为「Lv.30–40 职业任务链 (5 步)」
const CLASS_CHAIN_CARD_TITLE = '职业任务链与坐标指引';
const CLASS_CHAIN_RANGE_RE = /Lv\.(\d+)[–-](\d+) 职业任务链 \((\d+) 步\)/g;

// 旧版路线页同一任务链在里程碑卡与阶段卡里的标签前缀不同（「天裔 (联盟)·法师」vs「法师」），
// 因此链身份用「等级 + 归一化职业名」：取标签最后一个「·」后的部分，忽略种族/路线前缀。
function normalizeChainOwner(label) {
  const parts = String(label || '').split('·');
  return parts[parts.length - 1].replace(/专属$/, '').trim();
}

function collectChainKeys(cards) {
  // key = 链身份，value = 出现过的卡片下标集合
  const chainKeys = new Map();
  const record = (key, idx) => {
    if (!chainKeys.has(key)) chainKeys.set(key, new Set());
    chainKeys.get(key).add(idx);
  };
  cards.forEach((c, idx) => {
    const title = String(c.title || '');
    const body = String(c.body || '');
    for (const m of body.matchAll(CHAIN_TAG_RE)) {
      record(`${m[1]}|${normalizeChainOwner(m[2])}`, idx);
    }
    if (title.includes(CLASS_CHAIN_CARD_TITLE)) {
      record(`card|${CLASS_CHAIN_CARD_TITLE}`, idx);
    }
    for (const m of body.matchAll(CLASS_CHAIN_RANGE_RE)) {
      record(`range|${m[1]}|${m[2]}`, idx);
    }
  });
  return chainKeys;
}

function analyzeRouteDedupe(cards) {
  const chainKeys = collectChainKeys(cards);
  return {
    chainKeys,
    dupChains: [...chainKeys.entries()].filter(([, set]) => set.size > 1),
    zoneBlockCards: cards.filter((c) => String(c.body || '').includes('本阶段适龄练级区域')),
  };
}

// 自检：确保「重复链 → 报错」「同等级但不同职业 → 不报错」两个方向都被覆盖
// 自检：千位分组（声望/金币）不应被当成裸坐标，坐标格式仍要能命中
function selfTestBareCoord() {
  const cases = [
    ['47, 56', true],
    ['47.8,56.3', true],
    ['47,56', true],
    ['还差 5,750', false],
    ['需友善 3,000 后交付', false],
    ['9,000', false],
    ['3,000,000', false],
  ];
  for (const [text, expected] of cases) {
    if (hasBareCoord(text) !== expected) {
      return `裸坐标检测自检失败：${text}（期望 ${expected ? '命中' : '不命中'}）`;
    }
  }
  return null;
}

// 自检：确保「重复链 → 判定重复」「同等级但不同职业 → 不误报」「新版卡片/步数格式 → 能识别」
function selfTestRouteDedupe() {
  const cases = [
    {
      name: '旧版同一任务链跨卡重复',
      cards: [{ body: '[Lv.20 人类·法师职业任务]' }, { body: '[★Lv.20 法师专属职业任务链]' }],
      expectDetected: true,
      expectDup: true,
    },
    {
      name: '同等级但不同职业的两条链',
      cards: [{ body: '[Lv.20 人类·法师职业任务]' }, { body: '[Lv.20 人类·战士职业任务]' }],
      expectDetected: true,
      expectDup: false,
    },
    {
      name: '新版职业任务链卡片出现在路线页',
      cards: [{ title: '[任务链] 法师·奥术 职业任务链与坐标指引', body: 'Lv.30–40 职业任务链 (5 步)' }],
      expectDetected: true,
      expectDup: false,
    },
    {
      name: '仅正文步数格式也能识别',
      cards: [{ title: 'Lv.30–40 升级路线阶段', body: 'Lv.35–40 职业任务链 (6 步)' }],
      expectDetected: true,
      expectDup: false,
    },
    {
      name: '普通职业关键任务不误报',
      cards: [{ title: 'Lv.30 阶段', body: '[★法师职业任务] [奥达曼的能量源]' }],
      expectDetected: false,
      expectDup: false,
    },
  ];
  for (const c of cases) {
    const result = analyzeRouteDedupe(c.cards);
    const detected = result.chainKeys.size > 0;
    const dup = result.dupChains.length > 0;
    if (detected !== c.expectDetected || dup !== c.expectDup) {
      return `去重自检失败：${c.name}（期望 detected=${c.expectDetected} / dup=${c.expectDup}，实际 detected=${detected} / dup=${dup}）`;
    }
  }
  return null;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { addonName, targetDir, files } = await resolveAddonFiles(opts);

  console.log(`[WoW UI Simulator] Addon: ${addonName} (${targetDir})`);
  console.log(`[WoW UI Simulator] Character: Lv.${opts.level} ${opts.faction} ${opts.classKey}`);
  console.log(`[WoW UI Simulator] Loading ${files.length} Lua files...`);

  const rt = new WoWSimulatorRuntime({
    level: opts.level,
    classKey: opts.classKey,
    faction: opts.faction,
  });
  rt.loadAddon(addonName, files);

  const captures = [];
  let assertionFailed = false;
  for (const cmd of opts.slash) {
    rt.runSlashCommand(cmd);
    const snap = rt.getSnapshot();
    captures.push({ label: cmd, snapshot: snap });
    const cards = summarizeCards(snap);
    console.log(`\n=== ${cmd} (Cards: ${cards.length}, Lua Errors: ${snap.luaErrors.length}) ===`);
    if (opts.assert && cards.length === 0) {
      console.error(`[Assert Failed] ${cmd} rendered 0 cards!`);
      assertionFailed = true;
    }
    // 坐标只允许存在于链接载荷与悬停 Tooltip 中；卡片标题/正文不得出现裸坐标数值
    if (opts.assert) {
      for (const c of cards) {
        const leaked = [c.title, c.body].find((t) => hasBareCoord(t));
        if (leaked) {
          console.error(`[Assert Failed] ${cmd} 仍渲染出裸坐标: ${String(leaked).slice(0, 160)}`);
          assertionFailed = true;
          break;
        }
      }
      for (const m of snap.chatMessages) {
        const plain = stripWoWFormatting(m.text);
        if (hasBareCoord(plain)) {
          console.error(`[Assert Failed] ${cmd} 聊天框仍输出裸坐标: ${plain.slice(0, 160)}`);
          assertionFailed = true;
          break;
        }
      }
    }
    if (opts.assert && cmd === '/wowf route') {
      // 职业任务链只在「职业与天赋」页展示：升级路线页不得再渲染同一批链。
      // 同时识别旧版「Lv.N …职业任务]」标签、新版「职业任务链与坐标指引」卡片标题
      // 与「Lv.30–40 职业任务链 (5 步)」步数格式，避免换一种展示方式就绕过回归。
      const { chainKeys, dupChains, zoneBlockCards } = analyzeRouteDedupe(cards);
      if (chainKeys.size > 0 || dupChains.length > 0) {
        console.error(
          `[Assert Failed] /wowf route 仍渲染职业任务链：${[...chainKeys.keys()].join('、')}（应只在「职业与天赋」页出现）`
        );
        assertionFailed = true;
      }
      // 阶段卡里也不能再出现「[★法师职业任务]」这类职业专属任务标签
      const classQuestTagCards = cards.filter((c) => /\[★[^\]]*职业任务\]/.test(c.body));
      if (classQuestTagCards.length > 0) {
        console.error(
          `[Assert Failed] /wowf route 阶段卡仍渲染职业专属任务：${classQuestTagCards.map((c) => c.title).join('、')}`
        );
        assertionFailed = true;
      }
      // 本阶段适龄练级区域详细清单只给当前阶段一张卡，避免每张阶段卡重复同一批区域
      if (zoneBlockCards.length > 1) {
        console.error(
          `[Assert Failed] /wowf route 「本阶段适龄练级区域」出现在 ${zoneBlockCards.length} 张卡片里（应仅当前阶段卡）`
        );
        assertionFailed = true;
      }
    }
    if (opts.assert && cmd === '/wowf dungeon') {
      const dungeonCards = cards.filter((c) => c.body.includes('副本入口位置'));
      if (dungeonCards.length === 0) {
        console.error('[Assert Failed] /wowf dungeon rendered 0 dungeon cards!');
        assertionFailed = true;
      }
      const withQuestSection = dungeonCards.filter((c) => c.body.includes('必接副本任务 ('));
      if (withQuestSection.length === 0) {
        console.error('[Assert Failed] /wowf dungeon rendered 0 cards with 必接副本任务!');
        assertionFailed = true;
      }
    }
    if (opts.assert && cmd === '/wowf news') {
      // 普通数据只要求公告卡片存在；坐标链接化由下方已知含坐标的 coordMockLua 回归专门验证
      if (!cards.some((c) => c.title.includes('公告'))) {
        console.error('[Assert Failed] /wowf news 未渲染出公告卡片（检查样例/真实 Data.news）!');
        assertionFailed = true;
      }
    }
    if (opts.assert && cmd === '/wowf cmd') {
      // 速查页必须真的渲染出命令卡片，且不得回退到通用斜杠命令或旧版 1.12 命令
      const withCommand = cards.filter((c) => c.body.includes('命令:'));
      if (withCommand.length === 0) {
        console.error('[Assert Failed] /wowf cmd 未渲染出任何命令卡片!');
        assertionFailed = true;
      }
      const banned = cards.find((c) => /\/afk|\/dnd|\/clearChat|旧版镜头|1\.12/.test(`${c.title}\n${c.body}`));
      if (banned) {
        console.error(`[Assert Failed] /wowf cmd 仍包含通用/旧版内容: ${banned.title.slice(0, 80)}`);
        assertionFailed = true;
      }
    }
    for (const c of cards.slice(0, 6)) {
      console.log(`  [Card] ${c.title.split('\n')[0]}`);
      const previewLines = c.body.split('\n').filter(Boolean).slice(0, 4);
      for (const l of previewLines) {
        console.log(`         ${l.slice(0, 100)}`);
      }
    }
  }

  const finalSnap = rt.getSnapshot();
  if (finalSnap.luaErrors.length > 0) {
    console.error('\n[Lua Errors Detected]');
    for (const e of finalSnap.luaErrors) {
      console.error(`  - [${e.source}] ${e.message}`);
    }
  } else {
    console.log('\n[✓] 0 Lua errors across all commands.');
  }

  if (opts.html) {
    fs.mkdirSync(path.dirname(opts.html), { recursive: true });
    fs.writeFileSync(opts.html, generateHtmlReport(captures), 'utf8');
    console.log(`[✓] Visual HTML report written to: ${opts.html}`);
  }

  rt.destroy();

  // Regression check: also verify Horde dungeon quests rendering
  if (opts.assert && addonName.toLowerCase() === 'wowf') {
    const hordeRt = new WoWSimulatorRuntime({
      level: opts.level,
      classKey: opts.classKey,
      raceKey: '兽人',
      faction: 'Horde',
    });
    hordeRt.loadAddon(addonName, files);
    hordeRt.runSlashCommand('/wowf dungeon');
    const hordeSnap = hordeRt.getSnapshot();
    const hordeCards = summarizeCards(hordeSnap).filter((c) => c.body.includes('副本入口位置'));
    const hordeWithQuests = hordeCards.filter((c) => c.body.includes('必接副本任务 ('));
    if (hordeSnap.luaErrors.length > 0 || hordeCards.length === 0 || hordeWithQuests.length === 0) {
      console.error(
        `[Assert Failed] Horde /wowf dungeon regression failed (errors=${hordeSnap.luaErrors.length}, cards=${hordeCards.length}, withQuests=${hordeWithQuests.length})`
      );
      assertionFailed = true;
    } else {
      console.log(`[✓] Horde regression check passed (${hordeWithQuests.length}/${hordeCards.length} dungeon cards with quests).`);
    }
    hordeRt.destroy();
  }

  // Sample-data dedupe regression: 用固定的样例角色验证「职业任务链只在「职业与天赋」页渲染」
  // 与「本阶段适龄练级区域只在当前阶段卡渲染一次」（内置演示数据含 classRunsByClass 与 altZones）。
  // 放在独立回归里，避免 --level / --faction 等自定义参数下（样例数据可能没有对应内容）误报。
  if (opts.assert && addonName.toLowerCase() === 'wowf') {
    const selfTestErr = selfTestRouteDedupe();
    if (selfTestErr) {
      console.error(`[Assert Failed] ${selfTestErr}`);
      assertionFailed = true;
    }
    const coordTestErr = selfTestBareCoord();
    if (coordTestErr) {
      console.error(`[Assert Failed] ${coordTestErr}`);
      assertionFailed = true;
    }
    const sampleFiles = [
      { filename: 'Data.lua (sample)', content: SAMPLE_WOWF_DATA_LUA },
      ...files.filter((f) => !isDataLuaFile(f)),
    ];
    const sampleCases = [
      { label: '人类/联盟/法师', level: 25, classKey: 'MAGE', raceKey: '人类', faction: 'Alliance' },
      { label: '兽人/部落/法师', level: 25, classKey: 'MAGE', raceKey: '兽人', faction: 'Horde' },
    ];
    let sampleFail = false;
    for (const c of sampleCases) {
      const srt = new WoWSimulatorRuntime({
        level: c.level,
        classKey: c.classKey,
        raceKey: c.raceKey,
        faction: c.faction,
      });
      srt.loadAddon(addonName, sampleFiles);
      srt.runSlashCommand('/wowf route');
      const snap = srt.getSnapshot();
      const cards = summarizeCards(snap);
      const { chainKeys, dupChains, zoneBlockCards } = analyzeRouteDedupe(cards);
      // 路线页不再渲染职业任务链；链只能在「职业与天赋」页出现
      srt.runSlashCommand('/wowf class');
      const classSnap = srt.getSnapshot();
      const classCards = summarizeCards(classSnap);
      const classChainCard = classCards.find((card) => card.title.includes('职业任务链与坐标指引'));
      if (
        snap.luaErrors.length > 0 ||
        classSnap.luaErrors.length > 0 ||
        chainKeys.size !== 0 ||
        dupChains.length > 0 ||
        zoneBlockCards.length !== 1 ||
        !classChainCard
      ) {
        sampleFail = true;
        console.error(
          `[Assert Failed] 样例去重回归 (${c.label}) failed (errors=${snap.luaErrors.length + classSnap.luaErrors.length}, routeChains=${chainKeys.size}, dup=${dupChains.length}, zoneBlocks=${zoneBlockCards.length}, classChainCard=${Boolean(classChainCard)})`
        );
      }
      srt.destroy();
    }
    if (sampleFail) assertionFailed = true;
    else console.log('[✓] 样例数据去重回归通过（职业任务链只在「职业与天赋」页、区域块只在当前阶段卡）。');
  }

  // Strict-data regression check: verify Lv.40 Alliance Mage sees Scarlet Monastery quests in real Data.lua
  if (opts.assert && opts.strictData && addonName.toLowerCase() === 'wowf') {
    const lv40Rt = new WoWSimulatorRuntime({
      level: 40,
      classKey: 'MAGE',
      raceKey: '人类',
      faction: 'Alliance',
    });
    lv40Rt.loadAddon(addonName, files);
    lv40Rt.runSlashCommand('/wowf dungeon');
    const lv40Snap = lv40Rt.getSnapshot();
    const smCards = summarizeCards(lv40Snap).filter((c) => c.title.includes('血色修道院'));
    const smWithQuests = smCards.filter((c) => c.body.includes('必接副本任务 ('));
    if (lv40Snap.luaErrors.length > 0 || smCards.length === 0 || smWithQuests.length === 0) {
      console.error(
        `[Assert Failed] Lv.40 Alliance Scarlet Monastery regression failed (errors=${lv40Snap.luaErrors.length}, smCards=${smCards.length}, smWithQuests=${smWithQuests.length})`
      );
      assertionFailed = true;
    } else {
      console.log(`[✓] Lv.40 Alliance Scarlet Monastery check passed (${smWithQuests.length}/${smCards.length} wings with quests).`);
    }
    lv40Rt.destroy();
  }

  // QuestieDB-only runtime test: verify WoWF.lua resolves quest names, NPCs, zones, and prereqs purely from _G.QuestDB / _G.NpcDB
  if (opts.assert && addonName.toLowerCase() === 'wowf') {
    const qdbRt = new WoWSimulatorRuntime({
      level: 40,
      classKey: 'MAGE',
      raceKey: '人类',
      faction: 'Alliance',
    });
    const questieMockLua = `
      NpcDB = {
        name = function(id)
          local t = { [3979] = "图书馆员麦伊·苍尘", [3980] = "虔诚的莱雷恩" }
          return t[id]
        end,
        zoneID = function(id)
          local t = { [3979] = 1537, [3980] = 267 }
          return t[id]
        end,
        spawns = function(id)
          local t = { [3979] = { [1537] = { { 74.6, 12.6 } } }, [3980] = { [267] = { { 51.5, 58.2 } } } }
          return t[id]
        end,
      }
      QuestDB = {
        name = function(id)
          local t = { [1050] = "泰坦神话", [1052] = "血色十字军之路", [1053] = "以圣光之名" }
          return t[id]
        end,
        questLevel = function(id)
          local t = { [1050] = 38, [1052] = 34, [1053] = 40 }
          return t[id]
        end,
        requiredLevel = function(id)
          local t = { [1050] = 28, [1052] = 34, [1053] = 34 }
          return t[id]
        end,
        startedBy = function(id)
          local t = { [1050] = { { 3979 } }, [1052] = { { 3980 } }, [1053] = { { 3980 } } }
          return t[id]
        end,
        finishedBy = function(id)
          local t = { [1050] = { { 3979 } }, [1052] = { { 3980 } }, [1053] = { { 3980 } } }
          return t[id]
        end,
        preQuestSingle = function(id)
          if id == 1053 then return { 1052 } end
          return nil
        end,
      }
      WoWF_Data = {
        meta = { version = "questiedb-only-test" },
        dungeons = {
          {
            id = "scarlet-monastery-library",
            name = "血色修道院图书馆",
            zone = "提瑞斯法林地",
            entranceZone = "提瑞斯法林地",
            entranceX = 85.2,
            entranceY = 32.1,
            minLevel = 34,
            maxLevel = 37,
            visit = 37,
            quests = {
              { id = 1050, faction = "alliance" },
              { id = 1053, faction = "alliance" },
            },
          },
        },
        routes = {},
        classes = { MAGE = { name = "法师", specs = { { key = "frost", name = "冰霜专精" } } } },
        macros = {},
        professions = {},
      }
    `;
    const coreFiles = files.filter((f) => !isDataLuaFile(f));
    qdbRt.loadAddon(addonName, [{ filename: 'QuestieDBMock.lua', content: questieMockLua }, ...coreFiles]);
    qdbRt.runSlashCommand('/wowf dungeon');
    const qdbSnap = qdbRt.getSnapshot();
    const smCard = summarizeCards(qdbSnap).find((c) => c.title.includes('血色修道院图书馆'));
    const hasQ1050 = smCard && smCard.body.includes('泰坦神话') && smCard.body.includes('图书馆员麦伊·苍尘');
    const hasQ1053 = smCard && smCard.body.includes('以圣光之名') && smCard.body.includes('血色十字军之路') && smCard.body.includes('虔诚的莱雷恩');
    if (qdbSnap.luaErrors.length > 0 || !hasQ1050 || !hasQ1053) {
      console.error(
        `[Assert Failed] QuestieDB-only runtime test failed (errors=${qdbSnap.luaErrors.length}, hasQ1050=${Boolean(hasQ1050)}, hasQ1053=${Boolean(hasQ1053)})`
      );
      assertionFailed = true;
    } else {
      console.log('[✓] QuestieDB-only runtime resolution test passed (1050 + 1053 chain resolved from QuestDB/NpcDB).');
    }
    qdbRt.destroy();
  }

  // Exclusive duplicate quest regression: 1203「加尔的剑」与无限服替换任务 81570「Jarl Needs a Blade」
  // 同时出现在尘泥沼泽区域任务链索引里，中文客户端只能取到 1203 的本地化名称，81570 会回落到英文名。
  if (opts.assert && addonName.toLowerCase() === 'wowf') {
    const dupRt = new WoWSimulatorRuntime({
      level: 40,
      classKey: 'MAGE',
      raceKey: '人类',
      faction: 'Alliance',
      zone: '尘泥沼泽',
      completedQuests: [1218],
    });
    const dupMockLua = `
      NpcDB = {
        name = function(id) local t = { [4792] = '"沼泽之眼"加尔' } return t[id] end,
        zoneID = function(id) local t = { [4792] = 15 } return t[id] end,
        spawns = function(id) local t = { [4792] = { [15] = { { 46.0, 60.0 } } } } return t[id] end,
      }
      QuestDB = {
        name = function(id)
          local t = { [1218] = "安抚香料", [1206] = "加尔和蜘蛛眼", [1203] = "加尔的剑", [81570] = "Jarl Needs a Blade" }
          return t[id]
        end,
        questLevel = function(id)
          local t = { [1218] = 35, [1206] = 35, [1203] = 35, [81570] = 35 }
          return t[id]
        end,
        requiredLevel = function(id)
          local t = { [1218] = 30, [1206] = 30, [1203] = 30, [81570] = 30 }
          return t[id]
        end,
        startedBy = function(id)
          local t = { [1218] = { { 4792 } }, [1206] = { { 4792 } }, [1203] = { { 4792 } }, [81570] = { { 4792 } } }
          return t[id]
        end,
        finishedBy = function(id) return { { 4792 } } end,
        preQuestSingle = function(id)
          local t = { [1206] = { 1218 }, [1203] = { 1206 } }
          return t[id]
        end,
        nextQuestInChain = function(id)
          local t = { [1218] = 1206, [1206] = 1203 }
          return t[id]
        end,
        exclusiveTo = function(id)
          local t = { [1203] = { 81570 }, [81570] = { 1203 } }
          return t[id]
        end,
      }
      WoWF_Data = {
        meta = { version = "exclusive-duplicate-test" },
        routes = {
          human = {
            name = "人类",
            faction = "alliance",
            bands = {
              { from = 35, to = 42, zone = "尘泥沼泽", hub = { name = "塞拉摩", x = 66.1, y = 51.5 }, quests = {} },
            },
          },
        },
        classes = { MAGE = { name = "法师", specs = { { key = "frost", name = "冰霜专精", recommendedProfs = "", phases = {}, musts = {} } } } },
        dungeons = {},
        macros = {},
        professions = {},
        zoneQuests = {
          ["尘泥沼泽"] = {
            { id = 1203, f = "b", min = 30, lv = 35, maxLv = 35 },
            { id = 81570, f = "b", min = 30, lv = 35, maxLv = 35 },
          },
        },
        zoneAreaIds = { ["尘泥沼泽"] = { 15 } },
      }
    `;
    const dupCoreFiles = files.filter((f) => !isDataLuaFile(f));
    dupRt.loadAddon(addonName, [{ filename: 'ExclusiveDuplicateMock.lua', content: dupMockLua }, ...dupCoreFiles]);
    dupRt.runSlashCommand('/wowf route');
    const dupSnap = dupRt.getSnapshot();
    const zoneCard = summarizeCards(dupSnap).find((c) => c.title.includes('区域任务链') && c.title.includes('尘泥沼泽'));
    const zoneBody = zoneCard ? zoneCard.body : '';
    const hasLocalizedChain = zoneBody.includes('[加尔的剑]') && zoneBody.includes('加尔和蜘蛛眼');
    const hasEnglishDuplicate = zoneBody.includes('Jarl Needs a Blade');
    if (dupSnap.luaErrors.length > 0 || !zoneCard || !hasLocalizedChain || hasEnglishDuplicate) {
      console.error(
        `[Assert Failed] Exclusive duplicate quest pruning failed (errors=${dupSnap.luaErrors.length}, card=${Boolean(zoneCard)}, chain=${hasLocalizedChain}, englishDup=${hasEnglishDuplicate})`
      );
      assertionFailed = true;
    } else {
      console.log('[✓] Exclusive duplicate quest pruning passed (1203「加尔的剑」kept, 81570 English duplicate hidden).');
    }
    dupRt.destroy();
  }

  // Coordinate link regression: mock data with普通坐标 / 箭头多坐标 / 全角括号 / 专业训练师 / 公告
  if (opts.assert && addonName.toLowerCase() === 'wowf') {
    const coordRt = new WoWSimulatorRuntime({
      level: 25,
      classKey: 'MAGE',
      raceKey: '人类',
      faction: 'Alliance',
    });
    const coordMockLua = `
      WoWF_Data = {
        meta = { version = "coord-link-test", updatedAt = "2026-01-01", deployId = "coord-test" },
        routes = {},
        classes = {
          MAGE = {
            name = "法师",
            specs = {
              { key = "frost", name = "冰霜专精", recommendedProfs = "", musts = {}, phases = {}, steps = {} },
            },
            classRuns = {},
            macros = {},
          },
        },
        dungeons = {},
        professions = {
          {
            id = "alchemy",
            name = "炼金",
            type = "crafting",
            brackets = "1-300",
            makes = {},
            pairs = {},
            trainers = "初级：暴风城训练师 (52.9, 74.5) / 幽暗城训练师 (62.5, 61.8)",
            foreverNote = "在藏宝海湾 (26.9, 77.2) 可购买配方。",
          },
        },
        foreverSystems = {
          {
            id = "sleeping-bag",
            category = "露营",
            minLevel = 14,
            title = "坐标测试：舒适的睡袋",
            summary = "在西部荒野 (37.6, 50.7) 接取任务。",
            steps = {
              {
                step = 1,
                questId = 79191,
                questName = "摸石过河 (一)",
                questLevel = 14,
                zone = "西部荒野",
                coord = { x = 37.6, y = 50.7 },
                altCoord = { zone = "贫瘠之地", x = 49.1, y = 56.3 },
                title = "第一步：西部荒野焦痕残骸 (37.6, 50.7) / 或贫瘠之地 (49.1, 56.3)",
                detail = "联盟从西部荒野 (37.6, 50.7) 接取；部落从贫瘠之地 (49.1, 56.3) 接取。",
              },
              {
                step = 2,
                zone = "石爪山脉",
                coord = { x = 39.7, y = 50.0 },
                altCoord = { zone = "石爪山脉", x = 50.8, y = 52.7 },
                title = "第二步：石爪山脉背包 (39.7, 50.0 → 50.8, 52.7)",
                detail = "先到 (39.7, 50.0) 接取，再前往 (50.8, 52.7) 点击背包；艾尔文森林（营地 47, 56）、艾尔文森林（47.8，56.3）与艾尔文森林（营地 47.85, 56.35）也要覆盖。艾尔文森林 (47.8, 56.3)，营地 48, 57 需要沿用区域上下文。艾尔文森林 |Hquest:123:1|h[西部荒野的人民]|h，营地 49, 58 不能误判。",
              },
            },
          },
        },
        news = {
          { date = "2026-01-01", title = "坐标测试公告", summary = "在藏宝海湾 (26.9, 77.2) 修复了若干问题。" },
        },
      }
    `;
    const coordCoreFiles = files.filter((f) => !isDataLuaFile(f));
    coordRt.loadAddon(addonName, [{ filename: 'CoordLinkMockData.lua', content: coordMockLua }, ...coordCoreFiles]);
    coordRt.runSlashCommand('/wowf news');
    const coordSnap = coordRt.getSnapshot();
    const coordCards = summarizeCards(coordSnap);
    const coordText = coordCards.map((c) => `${c.title}\n${c.body}`).join('\n');
    const coordRawText = Object.values(coordSnap.fontStrings).map((fs) => fs.text || '').join('\n');
    const coordNewsCard = coordCards.find((c) => c.title.includes('公告'));
    const coordNewsOk = Boolean(coordNewsCard) &&
      coordNewsCard.body.includes('藏宝海湾') &&
      coordNewsCard.body.includes('[定位]');
    // 链接后的 “营地 48, 57” 应沿用前文“艾尔文森林”的地图 ID(1429)，而不是回退到默认的石爪山脉(1442)
    const crossContextOk =
      coordRawText.includes('|Hwowfmap:1429:47.8:56.3') &&
      coordRawText.includes('|Hwowfmap:1429:48.0:57.0') &&
      coordRawText.includes('|Hwowfmap:1429:49.0:58.0');
    const passed =
      coordSnap.luaErrors.length === 0 &&
      coordCards.length > 0 &&
      !COORD_TEXT_PATTERN.test(coordText) &&
      coordText.includes('[定位]') &&
      coordText.includes('石爪山脉') &&
      coordText.includes('摸石过河') &&
      coordNewsOk &&
      crossContextOk;
    if (!passed) {
      console.error(
        `[Assert Failed] Coordinate link regression failed (errors=${coordSnap.luaErrors.length}, cards=${coordCards.length}, hasRaw=${COORD_TEXT_PATTERN.test(coordText)}, hasLink=${coordText.includes('[定位]')}, news=${coordNewsOk}, context=${crossContextOk})`
      );
      assertionFailed = true;
    } else {
      console.log('[✓] Coordinate link regression passed (raw coords hidden, [定位] links generated).');
    }
    coordRt.destroy();
  }

  // Riding reminder regression: 角色已学会骑术后隐藏「攒钱学骑术」提醒，
  // 但不得误伤圣骑士的「召唤军马」职业任务。
  if (opts.assert && addonName.toLowerCase() === 'wowf') {
    const ridingMockLua = `
      WoWF_Data = {
        meta = { version = "riding-filter-test" },
        routes = {
          human = {
            name = "人类",
            faction = "alliance",
            bands = {
              { from = 38, to = 42, zone = "尘泥沼泽", hub = { name = "塞拉摩", x = 66.1, y = 51.5 }, quests = {} },
              { from = 58, to = 60, zone = "西瘟疫之地", hub = { name = "冰风营地", x = 43.0, y = 84.0 }, quests = {} },
            },
            classRunsByClass = {},
          },
        },
        classes = {
          MAGE = {
            name = "法师",
            specs = {
              {
                key = "frost", name = "冰霜专精", recommendedProfs = "", phases = {}, steps = {},
                musts = {
                  { level = 40, text = "提前攒好100金币学习初级骑术，本种族坐骑会免费赠送。" },
                  { level = 40, text = "40级记得去训练师学习新技能。" },
                },
              },
            },
            classRuns = {}, macros = {},
          },
          PALADIN = {
            name = "圣骑士",
            specs = {
              {
                key = "holy", name = "神圣专精", recommendedProfs = "", phases = {}, steps = {},
                musts = {
                  { level = 40, text = "通过职业任务学会|cff71d5ff[召唤军马]|r。" },
                  { level = 40, text = "40级记得去训练师学习新技能。" },
                  { level = 60, text = "60级记得去训练师学习新技能。" },
                },
              },
            },
            classRuns = {
              {
                id = 7647, faction = "alliance", level = 60, to = 60,
                name = "审判和救赎", teaches = "召唤战马",
                steps = {
                  { id = 7647, name = "审判和救赎", level = 60, zone = "西瘟疫之地", npc = "格雷森·沙东布瑞克公爵", x = 48.4, y = 50.2 },
                },
              },
            },
            macros = {},
          },
          WARLOCK = {
            name = "术士",
            specs = {
              {
                key = "affliction", name = "痛苦", recommendedProfs = "", phases = {}, steps = {},
                musts = {
                  { level = 40, text = "通过职业任务学会|cff71d5ff[召唤地狱战马]|r。" },
                  { level = 40, text = "40级记得去训练师学习新技能。" },
                },
              },
            },
            classRuns = {}, macros = {},
          },
        },
        dungeons = {}, macros = {}, professions = {},
      }
    `;
    const ridingCoreFiles = files.filter((f) => !isDataLuaFile(f));
    const readRidingCards = (rt, command) => {
      rt.runSlashCommand(command);
      const snap = rt.getSnapshot();
      const cards = summarizeCards(snap);
      return {
        snap,
        text: cards.map((c) => `${c.title}\n${c.body}`).join('\n'),
      };
    };

    const ridingCases = [
      { label: '未学骑术', options: {}, expectRiding: true },
      { label: '已学骑术（法术 ID）', options: { knownSpells: [33388] }, expectRiding: false },
      {
        label: '已学骑术（技能行）',
        options: { skills: [{ name: '骑术', rank: 75, maxRank: 75 }] },
        expectRiding: false,
      },
    ];
    let ridingFail = false;
    for (const c of ridingCases) {
      const rt = new WoWSimulatorRuntime({
        level: 40,
        classKey: 'MAGE',
        raceKey: '人类',
        faction: 'Alliance',
        ...c.options,
      });
      rt.loadAddon(addonName, [
        { filename: 'RidingFilterMockData.lua', content: ridingMockLua },
        ...ridingCoreFiles,
      ]);
      const smart = readRidingCards(rt, '/wowf');
      const route = readRidingCards(rt, '/wowf route');
      const smartHasRiding = smart.text.includes('骑术');
      const routeHasRiding = route.text.includes('骑术');
      const keepsOtherMust = smart.text.includes('训练师学习新技能') && route.text.includes('训练师学习新技能');
      const errors = smart.snap.luaErrors.length + route.snap.luaErrors.length;
      if (
        errors > 0 ||
        smartHasRiding !== c.expectRiding ||
        routeHasRiding !== c.expectRiding ||
        !keepsOtherMust
      ) {
        ridingFail = true;
        console.error(
          `[Assert Failed] 骑术提醒过滤回归 (${c.label}) failed (errors=${errors}, smartRiding=${smartHasRiding}, routeRiding=${routeHasRiding}, keepsOther=${keepsOtherMust})`
        );
      }
      rt.destroy();
    }

    // 职业坐骑提醒：对应坐骑/任务完成后隐藏；未完成时保留
    const classMountCases = [
      {
        label: '圣骑士未完成军马任务',
        classKey: 'PALADIN',
        marker: '召唤军马',
        options: { knownSpells: [33388] },
        expectMount: true,
      },
      {
        label: '圣骑士已学召唤军马',
        classKey: 'PALADIN',
        marker: '召唤军马',
        options: { knownSpells: [33388, 13819] },
        expectMount: false,
      },
      {
        label: '圣骑士已完成军马任务',
        classKey: 'PALADIN',
        marker: '召唤军马',
        options: { knownSpells: [33388], completedQuests: [1661] },
        expectMount: false,
      },
      {
        label: '圣骑士已学召唤战马',
        classKey: 'PALADIN',
        marker: '召唤军马',
        options: { knownSpells: [33388, 23214] },
        expectMount: false,
      },
      {
        label: '术士已学地狱战马',
        classKey: 'WARLOCK',
        marker: '召唤地狱战马',
        options: { knownSpells: [5784] },
        expectMount: false,
      },
    ];
    for (const c of classMountCases) {
      const rt = new WoWSimulatorRuntime({
        level: c.level || 40,
        classKey: c.classKey,
        raceKey: '人类',
        faction: 'Alliance',
        ...c.options,
      });
      rt.loadAddon(addonName, [
        { filename: 'RidingFilterMockData.lua', content: ridingMockLua },
        ...ridingCoreFiles,
      ]);
      const smart = readRidingCards(rt, '/wowf');
      const route = readRidingCards(rt, '/wowf route');
      const smartHasMount = smart.text.includes(c.marker);
      const routeHasMount = route.text.includes(c.marker);
      const keepsOtherMust =
        smart.text.includes('训练师学习新技能') && route.text.includes('训练师学习新技能');
      const errors = smart.snap.luaErrors.length + route.snap.luaErrors.length;
      if (
        errors > 0 ||
        smartHasMount !== c.expectMount ||
        routeHasMount !== c.expectMount ||
        !keepsOtherMust
      ) {
        ridingFail = true;
        console.error(
          `[Assert Failed] 职业坐骑提醒过滤回归 (${c.label}) failed (errors=${errors}, smartMount=${smartHasMount}, routeMount=${routeHasMount}, keepsOther=${keepsOtherMust})`
        );
      }
      rt.destroy();
    }

    // 职业坐骑任务链只在「职业与天赋」页展示：未完成时保留，学会/完成后隐藏；路线页不再重复
    const mountChainCases = [
      { label: '圣骑士未完成战马任务', options: { knownSpells: [33388] }, expectChain: true },
      { label: '圣骑士已完成战马任务', options: { knownSpells: [33388, 23214] }, expectChain: false },
      { label: '圣骑士仅完成战马任务', options: { knownSpells: [33388], completedQuests: [7647] }, expectChain: false },
    ];
    for (const c of mountChainCases) {
      const rt = new WoWSimulatorRuntime({
        level: 60,
        classKey: 'PALADIN',
        raceKey: '人类',
        faction: 'Alliance',
        ...c.options,
      });
      rt.loadAddon(addonName, [
        { filename: 'RidingFilterMockData.lua', content: ridingMockLua },
        ...ridingCoreFiles,
      ]);
      const classPage = readRidingCards(rt, '/wowf class');
      const route = readRidingCards(rt, '/wowf route');
      const classHasChain = classPage.text.includes('审判和救赎');
      const routeHasChain = route.text.includes('审判和救赎');
      const errors = classPage.snap.luaErrors.length + route.snap.luaErrors.length;
      if (errors > 0 || classHasChain !== c.expectChain || routeHasChain) {
        ridingFail = true;
        console.error(
          `[Assert Failed] 职业坐骑任务链回归 (${c.label}) failed (errors=${errors}, classChain=${classHasChain}, routeChain=${routeHasChain})`
        );
      }
      rt.destroy();
    }

    // 智能匹配页职业任务入口必须与「职业与天赋」页当前筛选下的实际可见链一致：
    // MATCH 模式按等级/坐骑完成状态过滤，ALL 模式展示全部链；入口不得指向空列表。
    const hasClassEntry = (snap) => {
      for (const f of Object.values(snap.frames)) {
        if (!isFrameTreeShown(f, snap.frames) || f.frameType !== 'Frame' || !f.backdrop) continue;
        if (f.name === 'WoWFMainFrame') continue;
        for (const id of f.fontStrings) {
          const fs = snap.fontStrings[id];
          if (fs && fs.shown && String(fs.text || '').includes('|Hwowftab:3')) return true;
        }
      }
      return false;
    };
    const classShowsChainCard = (snap) =>
      summarizeCards(snap).some((c) => c.title.includes('职业任务链与坐标指引'));
    const findVisibleButton = (snap, predicate) => {
      for (const f of Object.values(snap.frames)) {
        if (f.frameType !== 'Button' || !isFrameTreeShown(f, snap.frames)) continue;
        if (predicate(stripWoWFormatting(f.text).trim())) return f;
      }
      return null;
    };
    const entryCases = [
      { label: '未学战马', options: { knownSpells: [33388] }, match: true, all: true },
      { label: '已学战马', options: { knownSpells: [33388, 23214] }, match: false, all: true },
      { label: '仅完成战马任务', options: { knownSpells: [33388], completedQuests: [7647] }, match: false, all: true },
    ];
    for (const c of entryCases) {
      const rt = new WoWSimulatorRuntime({
        level: 60,
        classKey: 'PALADIN',
        raceKey: '人类',
        faction: 'Alliance',
        ...c.options,
      });
      rt.loadAddon(addonName, [
        { filename: 'RidingFilterMockData.lua', content: ridingMockLua },
        ...ridingCoreFiles,
      ]);
      rt.runSlashCommand('/wowf');
      const smartMatchSnap = rt.getSnapshot();
      const entryMatch = hasClassEntry(smartMatchSnap);
      rt.runSlashCommand('/wowf class');
      const classMatchSnap = rt.getSnapshot();
      const chainMatch = classShowsChainCard(classMatchSnap);
      let ok = entryMatch === chainMatch && entryMatch === c.match;
      const allToggleBtn = findVisibleButton(classMatchSnap, (label) => label.includes('查看 1-60 全程'));
      if (allToggleBtn) {
        rt.triggerFrameScript(allToggleBtn.id, 'OnClick', 'LeftButton');
      }
      const classAllSnap = rt.getSnapshot();
      const chainAll = classShowsChainCard(classAllSnap);
      rt.runSlashCommand('/wowf');
      const smartAllSnap = rt.getSnapshot();
      const entryAll = hasClassEntry(smartAllSnap);
      ok = ok && Boolean(allToggleBtn) && entryAll === chainAll && entryAll === c.all;
      const errors = smartMatchSnap.luaErrors.length + classMatchSnap.luaErrors.length
        + classAllSnap.luaErrors.length + smartAllSnap.luaErrors.length;
      if (!ok || errors > 0) {
        ridingFail = true;
        console.error(
          `[Assert Failed] 职业任务入口可见性回归 (${c.label}) failed (errors=${errors}, entryMatch=${entryMatch}, chainMatch=${chainMatch}, entryAll=${entryAll}, chainAll=${chainAll}, allToggle=${Boolean(allToggleBtn)})`
        );
      }
      rt.destroy();
    }

    const autoRefreshCases = [
      { command: '/wowf', event: 'SPELLS_CHANGED' },
      { command: '/wowf', event: 'LEARNED_SPELL_IN_TAB' },
      { command: '/wowf route', event: 'SPELLS_CHANGED' },
      { command: '/wowf route', event: 'LEARNED_SPELL_IN_TAB' },
    ];
    const waitForRefresh = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    for (const c of autoRefreshCases) {
      const rt = new WoWSimulatorRuntime({
        level: 40,
        classKey: 'MAGE',
        raceKey: '人类',
        faction: 'Alliance',
      });
      rt.loadAddon(addonName, [
        { filename: 'RidingFilterMockData.lua', content: ridingMockLua },
        ...ridingCoreFiles,
      ]);
      const before = readRidingCards(rt, c.command);
      if (!before.text.includes('骑术')) {
        ridingFail = true;
        console.error(`[Assert Failed] 骑术自动刷新回归 (${c.command}/${c.event}) 初始未显示骑术提醒`);
        rt.destroy();
        continue;
      }
      rt.charState.knownSpells.push(33388);
      rt.callLuaGlobal('__WOW_DISPATCH_EVENT__', c.event);
      await waitForRefresh(600);
      const afterSnap = rt.getSnapshot();
      const afterText = summarizeCards(afterSnap)
        .map((card) => `${card.title}\n${card.body}`)
        .join('\n');
      if (
        afterSnap.luaErrors.length > 0 ||
        afterText.includes('骑术') ||
        !afterText.includes('训练师学习新技能')
      ) {
        ridingFail = true;
        console.error(
          `[Assert Failed] 骑术自动刷新回归 (${c.command}/${c.event}) failed (errors=${afterSnap.luaErrors.length}, riding=${afterText.includes('骑术')}, keepsOther=${afterText.includes('训练师学习新技能')})`
        );
      }
      rt.destroy();
    }

    // 职业坐骑任务完成事件：窗口开着时完成任务，提醒自动消失
    const mountRefreshRt = new WoWSimulatorRuntime({
      level: 40,
      classKey: 'PALADIN',
      raceKey: '人类',
      faction: 'Alliance',
      knownSpells: [33388],
    });
    mountRefreshRt.loadAddon(addonName, [
      { filename: 'RidingFilterMockData.lua', content: ridingMockLua },
      ...ridingCoreFiles,
    ]);
    const beforeMount = readRidingCards(mountRefreshRt, '/wowf');
    mountRefreshRt.charState.completedQuests.push(1661);
    mountRefreshRt.callLuaGlobal('__WOW_DISPATCH_EVENT__', 'QUEST_TURNED_IN');
    await waitForRefresh(600);
    const mountAfterSnap = mountRefreshRt.getSnapshot();
    const mountAfterText = summarizeCards(mountAfterSnap)
      .map((card) => `${card.title}\n${card.body}`)
      .join('\n');
    if (
      beforeMount.snap.luaErrors.length > 0 ||
      !beforeMount.text.includes('召唤军马') ||
      mountAfterSnap.luaErrors.length > 0 ||
      mountAfterText.includes('召唤军马') ||
      !mountAfterText.includes('训练师学习新技能')
    ) {
      ridingFail = true;
      console.error(
        `[Assert Failed] 职业坐骑任务自动刷新回归 failed (before=${beforeMount.text.includes('召唤军马')}, after=${mountAfterText.includes('召唤军马')}, keepsOther=${mountAfterText.includes('训练师学习新技能')})`
      );
    }
    mountRefreshRt.destroy();

    if (ridingFail) assertionFailed = true;
    else console.log('[✓] 骑术/职业坐骑提醒过滤回归通过（完成状态隐藏、事件刷新生效、其他里程碑保留）。');
  }

  // 凄凉之地半人马阵营任务卡：按声望只展开倾向部族、交物品/可重复标注、门槛与已完成折叠
  if (opts.assert && addonName.toLowerCase() === 'wowf') {
    const centaurCoreFiles = files.filter((f) => !isDataLuaFile(f));
    const buildCentaurMockLua = (rep92, rep93) => `
      function GetFactionInfoByID(id)
        local rep = { [92] = ${rep92}, [93] = ${rep93} }
        local value = rep[id]
        if value == nil then return nil end
        return "faction", "", 4, 0, 0, value
      end
      local function q(id, name, lv, extra)
        local t = { id = id, name = name, level = lv }
        for k, v in pairs(extra or {}) do t[k] = v end
        return t
      end
      local function it(id, name, n) return { id = id, name = name, count = n } end
      WoWF_Data = {
        meta = { version = "centaur-faction-test" },
        routes = {
          human = { name = "人类", faction = "alliance", bands = { { from = 38, to = 41, zone = "荒芜之地", hub = { name = "埃格蒙德的营地", x = 42.0, y = 31.0 }, quests = {} } } },
          orc = { name = "兽人", faction = "horde", bands = { { from = 38, to = 41, zone = "荒芜之地", hub = { name = "埃格蒙德的营地", x = 42.0, y = 31.0 }, quests = {} } } },
        },
        classes = { MAGE = { name = "法师", specs = { { key = "frost", name = "冰霜专精", recommendedProfs = "", phases = {}, musts = {} } } } },
        dungeons = {}, macros = {}, professions = {},
        factionQuests = {
          {
            id = "desolace-centaur", zone = "凄凉之地", title = "凄凉之地 · 半人马阵营",
            minLevel = 30, maxLevel = 45, summary = "两族二选一。",
            shared = {
              q(93224, "雕刻半人马图腾", 40, { faction = "alliance", items = { it(254432, "雕刻半人马图腾", 5) } }),
              q(96222, "赫鲁萨可汗", 42, { items = { it(6077, "玛洛迪钥匙碎片", 1) } }),
            },
            groups = {
              {
                factionId = 92, name = "吉尔吉斯", where = "吉尔吉斯村",
                entry = {
                  q(1368, "吉尔吉斯部族", 33, { faction = "horde", rep = 250, minRep = 3000, showWhenLocked = true }),
                  q(93227, "收买友谊：吉尔吉斯", 45, { faction = "alliance", neutralOnly = true, rep = 3000, otherRep = -15000, items = { it(257685, "图腾手提包", 1) } }),
                  q(94873, "收买友谊：吉尔吉斯", 45, { faction = "horde", neutralOnly = true, rep = 3000, otherRep = -15000, items = { it(257685, "图腾手提包", 1) } }),
                },
                friendly = {
                  q(1370, "偷取物资", 35, { rep = 500, items = { it(6069, "粗制干肉", 6) } }),
                  q(92755, "玄秘之术", 35, { profession = "附魔", rep = 1000, items = { it(11135, "强效秘法精华", 3) } }),
                },
                honored = {
                  q(93034, "白骨之谷", 38, { rep = 125 }),
                  q(93035, "肆虐的劫掠者", 38, { rep = 500 }),
                },
                repeatable = {
                  q(92812, "经济战", 60, { repeatable = true, rep = 750, otherRep = -3750, items = { it(254432, "雕刻半人马图腾", 5) }, requires = { 93227, 94873 }, note = "可反复交，直到崇拜。" }),
                },
              },
              {
                factionId = 93, name = "玛格拉姆", where = "玛格拉姆村",
                entry = {
                  q(1367, "玛格拉姆部族", 33, { faction = "horde", rep = 250, minRep = 3000, showWhenLocked = true }),
                  q(1385, "野蛮外交", 35, { faction = "alliance", rep = 250, minRep = 3000, showWhenLocked = true }),
                  q(93226, "收买友谊：玛格拉姆", 45, { faction = "alliance", neutralOnly = true, rep = 3000, otherRep = -15000, items = { it(257685, "图腾手提包", 1) } }),
                  q(94872, "收买友谊：玛格拉姆", 45, { faction = "horde", neutralOnly = true, rep = 3000, otherRep = -15000, items = { it(257685, "图腾手提包", 1) } }),
                },
                friendly = {
                  q(1386, "突袭科卡尔部族", 32, { faction = "alliance", rep = 500 }),
                  q(1369, "破碎之泪", 33, { rep = 500, items = { it(6083, "破碎之泪", 3) } }),
                },
                honored = {
                  q(92841, "白骨之谷", 40, { rep = 125 }),
                  q(92844, "白骨之山", 42, { rep = 500, items = { it(254663, "被轻微诅咒的骨头", 426) } }),
                },
                repeatable = {
                  q(92811, "经济战", 60, { repeatable = true, rep = 750, otherRep = -3750, items = { it(254432, "雕刻半人马图腾", 5) }, requires = { 93226, 94872 }, note = "可反复交，直到崇拜。" }),
                },
              },
            },
          },
        },
      }
    `;

    const centaurCases = [
      {
        label: '吉尔吉斯友善：只展开当前部族并过滤已完成',
        level: 40,
        raceKey: '人类',
        faction: 'Alliance',
        rep92: 3250,
        rep93: -12500,
        completedQuests: [1370],
        present: [
          '当前倾向',
          '吉尔吉斯 友善 (3,250)',
          '玛格拉姆：仇恨 (-12,500) · 已折叠',
          '收买友谊：吉尔吉斯',
          '经济战',
          '可重复',
          '需先完成「收买友谊：吉尔吉斯」',
          '尊敬阶段',
          '还差 5,750',
          '✓ 已完成 1 步',
          '雕刻半人马图腾',
          '赫鲁萨可汗',
          '另有 1 个专业配方任务需对应专业',
        ],
        absent: ['偷取物资', '破碎之泪', '白骨之谷', '白骨之山', '玛格拉姆部族', '奇怪的联盟'],
      },
      {
        label: '双方中立：并列提示二选一并隐藏未达门槛步骤',
        level: 35,
        raceKey: '兽人',
        faction: 'Horde',
        rep92: 0,
        rep93: 0,
        completedQuests: [],
        activeQuests: [1368],
        present: [
          '尚未选边',
          '吉尔吉斯部族',
          '玛格拉姆部族',
          '需友善 3,000 后交付',
          '收买友谊：吉尔吉斯',
          '收买友谊：玛格拉姆',
          '未解锁：需 友善 3,000',
        ],
        absent: ['奇怪的联盟', '野蛮外交', '偷取物资', '破碎之泪'],
      },
      {
        label: '玛格拉姆尊敬：展开尊敬链并折叠敌对部族',
        level: 44,
        raceKey: '兽人',
        faction: 'Horde',
        rep92: -20000,
        rep93: 9500,
        completedQuests: [1369, 92841],
        present: ['当前倾向', '白骨之山', '经济战', '吉尔吉斯：仇恨 (-20,000) · 已折叠', '✓ 已完成 2 步'],
        absent: ['肆虐的劫掠者', '偷取物资', '吉尔吉斯部族'],
      },
      {
        label: '满级 Lv.60：声望页仍正常展示半人马阵营（不再受 Lv.30-45 限制）',
        level: 60,
        raceKey: '人类',
        faction: 'Alliance',
        rep92: 3250,
        rep93: -12500,
        completedQuests: [1370],
        present: ['当前倾向', '吉尔吉斯 友善 (3,250)', '经济战', '尊敬阶段', '还差 5,750'],
        absent: ['偷取物资', '破碎之泪'],
      },
      {
        label: '低等级 Lv.20：保留半人马阵营卡片但按 minLevel 过滤未解锁任务并提示等级需求',
        level: 20,
        raceKey: '人类',
        faction: 'Alliance',
        rep92: 3250,
        rep93: -12500,
        completedQuests: [],
        present: ['当前倾向', '吉尔吉斯 友善 (3,250)', '需更高等级（Lv.30+）'],
        absent: ['收买友谊：吉尔吉斯', '经济战', '偷取物资', '雕刻半人马图腾', '赫鲁萨可汗'],
      },
    ];

    let centaurFailed = false;
    for (const tc of centaurCases) {
      const rt = new WoWSimulatorRuntime({
        level: tc.level,
        classKey: 'MAGE',
        raceKey: tc.raceKey,
        faction: tc.faction,
        completedQuests: tc.completedQuests,
        activeQuests: tc.activeQuests ?? [],
      });
      rt.loadAddon(addonName, [
        { filename: 'CentaurFactionMock.lua', content: buildCentaurMockLua(tc.rep92, tc.rep93) },
        ...centaurCoreFiles,
      ]);
      rt.runSlashCommand('/wowf route');
      const routeSnap = rt.getSnapshot();
      const routeHasCentaur = summarizeCards(routeSnap).some((c) => c.title.includes('凄凉之地 · 半人马阵营'));
      if (routeSnap.luaErrors.length > 0 || routeHasCentaur) {
        centaurFailed = true;
        console.error(
          `[Assert Failed] 半人马阵营不应再出现在升级路线页（${tc.label}）errors=${routeSnap.luaErrors.length}, routeHasCentaur=${routeHasCentaur}`
        );
      }

      rt.runSlashCommand('/wowf rep');
      const snap = rt.getSnapshot();
      const card = summarizeCards(snap).find((c) => c.title.includes('凄凉之地 · 半人马阵营'));
      const body = card ? `${card.title}\n${card.body}` : '';
      const missing = tc.present.filter((text) => !body.includes(text));
      const unexpected = tc.absent.filter((text) => body.includes(text));
      if (snap.luaErrors.length > 0 || !card || missing.length > 0 || unexpected.length > 0) {
        centaurFailed = true;
        console.error(
          `[Assert Failed] 半人马阵营任务卡（${tc.label}）errors=${snap.luaErrors.length}, card=${Boolean(card)}, missing=${missing.join('|')}, unexpected=${unexpected.join('|')}`
        );
      }
      rt.destroy();
    }
    if (centaurFailed) assertionFailed = true;
    else console.log('[✓] 半人马阵营任务卡回归通过（已迁入声望页、全等级可见、声望过滤、门槛与已完成折叠）。');
  }

  // 声望页：16 个新增第三方声望 + 半人马阵营的任务卡（单选/多选筛选、声望过滤、已完成折叠、跨阵营去重）
  if (opts.assert && addonName.toLowerCase() === 'wowf') {
    const repCoreFiles = files.filter((f) => !isDataLuaFile(f));
    const reputationMockLua = `
      local REP = { [2586] = 3250, [2740] = 9000, [2826] = 0, [2587] = 0, [92] = 3250, [93] = -12500 }
      function GetFactionInfoByID(id)
        local value = REP[id]
        if value == nil then return nil end
        return "faction", "", 4, 0, 0, value
      end
      local function q(id, name, lv, minLv, zone, extra)
        local t = { id = id, name = name, level = lv, minLevel = minLv, zone = zone, items = {}, otherRep = {} }
        for k, v in pairs(extra or {}) do t[k] = v end
        return t
      end
      WoWF_Data = {
        meta = { version = "reputation-test" },
        routes = {
          human = { name = "人类", faction = "alliance", bands = { { from = 38, to = 41, zone = "荒芜之地", hub = { name = "埃格蒙德的营地", x = 42.0, y = 31.0 }, quests = {} } } },
        },
        classes = { MAGE = { name = "法师", specs = { { key = "frost", name = "冰霜专精" } } } },
        dungeons = {}, macros = {}, professions = {},
        factionQuests = {
          {
            id = "desolace-centaur", zone = "凄凉之地", title = "凄凉之地 · 半人马阵营",
            minLevel = 30, maxLevel = 45, summary = "两族二选一。",
            shared = { q(96222, "赫鲁萨可汗", 42, 30, "凄凉之地") },
            groups = {
              {
                factionId = 92, name = "吉尔吉斯", where = "吉尔吉斯村",
                entry = { q(93227, "收买友谊：吉尔吉斯", 45, 30, "凄凉之地", { faction = "alliance", neutralOnly = true, rep = 3000 }) },
                friendly = { q(1370, "偷取物资", 35, 30, "凄凉之地", { rep = 500 }) },
                honored = {}, repeatable = {},
              },
              {
                factionId = 93, name = "玛格拉姆", where = "玛格拉姆村",
                entry = {}, friendly = {}, honored = {}, repeatable = {},
              },
            },
          },
        },
        reputationGuides = {
          factions = {
            {
              id = 2586, name = "艾泽拉斯贸易局", side = "alliance", max = 42999,
              summary = "联盟侧贸易声望。", sources = { "上交遭劫的板条箱" },
              rewards = { { standing = "友善", items = { { id = 1, name = "补给包" } }, total = 1 } },
              quests = {
                q(94004, "工匠文书：测试药水", 60, 1, "制造区", { rep = 75, repeatable = true, kind = "writ", items = { { id = 2, name = "测试药水", count = 1 } } }),
                q(99901, "联盟贸易任务", 38, 36, "赤脊山", { rep = 100, side = "alliance" }),
              },
            },
            {
              id = 2587, name = "杜隆塔尔补给后勤部", side = "horde", max = 42999,
              summary = "部落侧贸易声望。", sources = {}, rewards = {},
              quests = { q(99902, "部落贸易任务", 38, 36, "杜隆塔尔", { rep = 100, side = "horde" }) },
            },
            {
              id = 2740, name = "肯瑞托", side = "alliance", max = 42999,
              summary = "达拉然法师声望。", sources = {}, rewards = {},
              quests = {
                q(93963, "联盟之旅", 13, 7, "暴风城", { rep = 100, side = "alliance" }),
                q(90001, "共同任务", 40, 38, "达拉然", { rep = 250, otherRep = { { id = 2826, n = 150 } } }),
              },
            },
            {
              id = 2826, name = "铁马兄弟会", side = "alliance", max = 42999,
              summary = "联盟新阵营。", sources = {}, rewards = {},
              quests = {
                q(90001, "共同任务", 40, 38, "达拉然", { rep = 150, otherRep = { { id = 2740, n = 250 } } }),
                q(90002, "高等级任务", 55, 53, "河林", { rep = 100 }),
              },
            },
          },
        },
      }
    `;
    const findVisibleButton = (snap, predicate) => {
      for (const f of Object.values(snap.frames)) {
        if (f.frameType !== 'Button' || !isFrameTreeShown(f, snap.frames)) continue;
        const label = stripWoWFormatting(f.text).trim();
        if (predicate(label)) return f;
      }
      return null;
    };
    const clickRepBtn = (rt, labelMatcher, stepName) => {
      const snap = rt.getSnapshot();
      const btn = findVisibleButton(snap, labelMatcher);
      if (!btn) {
        throw new Error(`未找到声望页按钮：${stepName}`);
      }
      rt.triggerFrameScript(btn.id, 'OnClick', 'LeftButton');
      return rt.getSnapshot();
    };

    const repRt = new WoWSimulatorRuntime({
      level: 40,
      classKey: 'MAGE',
      raceKey: '人类',
      faction: 'Alliance',
      completedQuests: [93963, 94004],
    });
    repRt.loadAddon(addonName, [
      { filename: 'ReputationMock.lua', content: reputationMockLua },
      ...repCoreFiles,
    ]);
    repRt.runSlashCommand('/wowf rep');
    const repSnap = repRt.getSnapshot();
    const repCards = summarizeCards(repSnap);
    const repAll = repCards.map((c) => `${c.title}\n${c.body}`).join('\n');
    const repTitles = repCards.map((c) => c.title);
    const overviewCard = repCards.find((c) => c.title.includes('新增第三方声望'));
    const sharedCount = (repAll.match(/共同任务/g) || []).length;
    const repChecks = [
      ['声望总览卡', Boolean(overviewCard)],
      ['包含半人马详情卡', repTitles.some((t) => t.includes('凄凉之地 · 半人马阵营'))],
      ['总览含半人马声望', Boolean(overviewCard && overviewCard.body.includes('吉尔吉斯 友善 (3,250)'))],
      ['贸易局声望', repAll.includes('友善 (3,250)')],
      ['工匠文书分组', repTitles.some((t) => t.includes('工匠文书 +75'))],
      ['可重复文书未被完成过滤', repAll.includes('工匠文书：测试药水')],
      ['已完成任务折叠', repAll.includes('已完成 1 条声望任务') && !repAll.includes('联盟之旅')],
      ['共同任务只列一次', sharedCount === 1],
      ['去重提示', repAll.includes('已列在对应阵营卡')],
      ['高等级任务折叠', !repAll.includes('高等级任务') && repAll.includes('需更高等级')],
      ['对立阵营详情隐藏', !repTitles.some((t) => t.includes('杜隆塔尔补给后勤部'))],
      ['存在声望下拉按钮', Boolean(findVisibleButton(repSnap, (l) => l.startsWith('声望筛选: 全部')))],
      ['存在多选模式按钮', Boolean(findVisibleButton(repSnap, (l) => l.includes('筛选模式: 多选')))],
      ['存在清空筛选按钮', Boolean(findVisibleButton(repSnap, (l) => l.includes('全部声望')))],
      ['筛选工具栏已收起为单行', (() => {
        const dropBtn = findVisibleButton(repSnap, (l) => l.startsWith('声望筛选:'));
        const bar = dropBtn ? repSnap.frames[dropBtn.parentId] : null;
        return Boolean(bar && bar.height && bar.height <= 40);
      })()],
      ['不再平铺单阵营网格按钮', !findVisibleButton(repSnap, (l) => l.replace(/^✓\s*/, '') === '肯瑞托')],
    ];

    const openRepDropdown = (rt, stepName) => {
      const snap = clickRepBtn(rt, (l) => l.startsWith('声望筛选:'), stepName);
      if (!snap.dropdown.open) {
        throw new Error(`点击声望下拉按钮后菜单未打开：${stepName}`);
      }
      return snap;
    };
    const clickDropdownByText = (rt, matcher, stepName) => {
      const snap = rt.getSnapshot();
      const item = snap.dropdown.items.find((it) => matcher(stripWoWFormatting(it.text).trim()));
      if (!item) {
        throw new Error(`声望下拉菜单缺少选项（${stepName}）：${snap.dropdown.items.map((it) => it.text).join(' | ')}`);
      }
      rt.clickDropdownItem(item.index);
      return rt.getSnapshot();
    };

    // 交互验证：下拉菜单多选 -> 清空恢复 -> 切单选 -> 跨阵营共享任务 -> 多选切单选自动收束 -> 切页关闭下拉与筛选栏
    const assertDetailTitles = (snap, expected, forbidden, stepName) => {
      const detailTitles = summarizeCards(snap).slice(1).map((c) => c.title);
      const allText = summarizeCards(snap).map((c) => `${c.title}\n${c.body}`).join('\n');
      for (const name of expected) {
        if (!detailTitles.some((t) => t.includes(name))) {
          repChecks.push([`${stepName} 包含 ${name}`, false]);
        }
      }
      for (const name of forbidden) {
        if (detailTitles.some((t) => t.includes(name))) {
          repChecks.push([`${stepName} 隐藏 ${name}`, false]);
        }
      }
      return { detailTitles, allText };
    };

    try {
      // 1) 打开下拉框校验列表（含当前阵营、不含对立阵营）
      let snap = openRepDropdown(repRt, '打开声望下拉');
      const menuLabels = snap.dropdown.items.map((it) => stripWoWFormatting(it.text).trim());
      repChecks.push(['下拉含全部声望项', menuLabels.some((t) => t.includes('全部声望（清空筛选）'))]);
      repChecks.push(['下拉含半人马', menuLabels.some((t) => t.includes('凄凉之地·半人马'))]);
      repChecks.push(['下拉隐藏对立阵营', !menuLabels.some((t) => t.includes('杜隆塔尔补给后勤部'))]);

      // 2) 多选：先选「肯瑞托」，菜单应保持打开且已勾选
      snap = clickDropdownByText(repRt, (t) => t.startsWith('肯瑞托'), '多选点击肯瑞托');
      repChecks.push(['多选后下拉保持打开', snap.dropdown.open === true]);
      repChecks.push(['多选肯瑞托已勾选', Boolean(snap.dropdown.items.find((it) => it.text.startsWith('肯瑞托'))?.checked)]);
      repChecks.push(['按钮显示已选肯瑞托', Boolean(findVisibleButton(snap, (l) => l === '声望筛选: 肯瑞托'))]);
      assertDetailTitles(snap, ['肯瑞托'], ['艾泽拉斯贸易局', '铁马兄弟会', '凄凉之地 · 半人马阵营'], '多选-仅肯瑞托');

      // 3) 多选：继续追加「凄凉之地·半人马」
      snap = clickDropdownByText(repRt, (t) => t.startsWith('凄凉之地·半人马'), '多选点击凄凉之地·半人马');
      repChecks.push(['按钮显示已选2项', Boolean(findVisibleButton(snap, (l) => l === '声望筛选: 已选 2 项'))]);
      assertDetailTitles(snap, ['肯瑞托', '凄凉之地 · 半人马阵营'], ['艾泽拉斯贸易局', '铁马兄弟会'], '多选-肯瑞托+半人马');

      // 4) 多选：取消「肯瑞托」
      snap = clickDropdownByText(repRt, (t) => t.startsWith('肯瑞托'), '多选取消肯瑞托');
      assertDetailTitles(snap, ['凄凉之地 · 半人马阵营'], ['肯瑞托', '艾泽拉斯贸易局', '铁马兄弟会'], '多选-仅剩半人马');

      // 5) 点击下拉第 1 项「全部声望（清空筛选）」恢复全部并关闭下拉
      snap = clickDropdownByText(repRt, (t) => t.includes('全部声望（清空筛选）'), '下拉点击全部声望');
      repChecks.push(['点全部声望关闭下拉', snap.dropdown.open === false]);
      assertDetailTitles(snap, ['艾泽拉斯贸易局', '肯瑞托', '铁马兄弟会', '凄凉之地 · 半人马阵营'], ['杜隆塔尔补给后勤部'], '全部声望恢复');

      // 6) 切换到「单选」模式
      snap = clickRepBtn(repRt, (l) => l.includes('筛选模式:'), '切到单选模式');
      repChecks.push(['已切换单选模式按钮', Boolean(findVisibleButton(snap, (l) => l.includes('筛选模式: 单选')))]);

      // 7) 单选：打开下拉点「肯瑞托」（自动关闭下拉）
      openRepDropdown(repRt, '单选打开下拉选肯瑞托');
      snap = clickDropdownByText(repRt, (t) => t.startsWith('肯瑞托'), '单选点击肯瑞托');
      repChecks.push(['单选点选后自动关闭下拉', snap.dropdown.open === false]);
      assertDetailTitles(snap, ['肯瑞托'], ['艾泽拉斯贸易局', '铁马兄弟会', '凄凉之地 · 半人马阵营'], '单选-肯瑞托');

      // 8) 单选：点「铁马兄弟会」替换选中项，且共同任务在其卡上正常显示
      openRepDropdown(repRt, '单选打开下拉选铁马');
      snap = clickDropdownByText(repRt, (t) => t.startsWith('铁马兄弟会'), '单选点击铁马兄弟会');
      const ironRes = assertDetailTitles(snap, ['铁马兄弟会'], ['肯瑞托', '艾泽拉斯贸易局', '凄凉之地 · 半人马阵营'], '单选-铁马兄弟会');
      repChecks.push(['单选铁马显示共同任务', ironRes.allText.includes('共同任务')]);

      // 9) 单选：再次点击已选项「铁马兄弟会」恢复全部
      openRepDropdown(repRt, '单选打开下拉取消铁马');
      snap = clickDropdownByText(repRt, (t) => t.startsWith('铁马兄弟会'), '单选取消铁马兄弟会');
      assertDetailTitles(snap, ['艾泽拉斯贸易局', '肯瑞托', '铁马兄弟会', '凄凉之地 · 半人马阵营'], ['杜隆塔尔补给后勤部'], '单选-再次点击恢复全部');

      // 10) 多选切回单选自动收束为 1 项，并通过「清空筛选」恢复全部
      snap = clickRepBtn(repRt, (l) => l.includes('筛选模式:'), '切回多选模式');
      openRepDropdown(repRt, '多选打开下拉');
      clickDropdownByText(repRt, (t) => t.startsWith('肯瑞托'), '多选选肯瑞托');
      snap = clickDropdownByText(repRt, (t) => t.startsWith('铁马兄弟会'), '多选加铁马兄弟会');
      assertDetailTitles(snap, ['肯瑞托', '铁马兄弟会'], ['艾泽拉斯贸易局', '凄凉之地 · 半人马阵营'], '多选2项');
      snap = clickRepBtn(repRt, (l) => l.includes('筛选模式:'), '多选2项切单选收束');
      repChecks.push(['切模式关闭下拉', snap.dropdown.open === false]);
      assertDetailTitles(snap, ['肯瑞托'], ['铁马兄弟会', '艾泽拉斯贸易局', '凄凉之地 · 半人马阵营'], '切单选自动收束');
      snap = clickRepBtn(repRt, (l) => l.includes('清空筛选'), '点击清空筛选按钮');
      assertDetailTitles(snap, ['艾泽拉斯贸易局', '肯瑞托', '铁马兄弟会', '凄凉之地 · 半人马阵营'], ['杜隆塔尔补给后勤部'], '清空按钮恢复全部');

      // 11) 打开下拉状态下切出声望页：隐藏筛选栏并关闭下拉菜单；关闭后陈旧点击不得改写筛选状态
      openRepDropdown(repRt, '切页前打开下拉');
      repRt.runSlashCommand('/wowf route');
      const routeSnap = repRt.getSnapshot();
      repChecks.push(['切出声望页隐藏筛选栏', !findVisibleButton(routeSnap, (l) => l.includes('筛选模式:'))]);
      repChecks.push(['切出声望页关闭下拉菜单', routeSnap.dropdown.open === false && routeSnap.dropdown.items.length === 0]);

      repRt.clickDropdownItem(2);
      repRt.runSlashCommand('/wowf rep');
      const afterStaleClickSnap = repRt.getSnapshot();
      repChecks.push(['下拉关闭后陈旧点击无效', Boolean(findVisibleButton(afterStaleClickSnap, (l) => l.startsWith('声望筛选: 全部')))]);
      repRt.runSlashCommand('/wowf route');
      const routeSnap2 = repRt.getSnapshot();

      // 验证在其他页签打开职业下拉菜单时，HideUnusedCards 不会误关闭它
      const classBtn = findVisibleButton(routeSnap2, (l) => l.startsWith('职业:'));
      if (classBtn) {
        repRt.triggerFrameScript(classBtn.id, 'OnClick', 'LeftButton');
        const classOpenSnap = repRt.getSnapshot();
        const mageItem = classOpenSnap.dropdown.items.find((it) => stripWoWFormatting(it.text).trim() === '法师');
        repChecks.push(['非声望页打开职业下拉', classOpenSnap.dropdown.open === true && Boolean(mageItem)]);
        // 再切一次筛选刷新也不会因为 repFilterBar 隐藏而关闭外部下拉（多选或切换前）
        const toggleModeBtn = findVisibleButton(classOpenSnap, (l) => l.includes('查看 1-60'));
        if (toggleModeBtn) {
          repRt.triggerFrameScript(toggleModeBtn.id, 'OnClick', 'LeftButton');
          const afterRefreshSnap = repRt.getSnapshot();
          repChecks.push(['非声望页刷新不误关已开下拉', afterRefreshSnap.dropdown.open === true]);
        }
      }
    } catch (err) {
      repChecks.push([err.message, false]);
    }

    const repFailed = repChecks.filter(([, ok]) => !ok);
    const repFinalSnap = repRt.getSnapshot();
    if (repFinalSnap.luaErrors.length > 0 || repFailed.length > 0) {
      assertionFailed = true;
      console.error(
        `[Assert Failed] 声望页回归 errors=${repFinalSnap.luaErrors.length}, failed=${repFailed.map(([name]) => name).join('|')}`
      );
      if (repFinalSnap.luaErrors.length > 0) {
        console.error(repFinalSnap.luaErrors);
      }
    } else {
      console.log('[✓] 声望页回归通过（单行下拉筛选、单选/多选交互、半人马阵营、声望过滤、已完成折叠、跨阵营去重）。');
    }
    repRt.destroy();
  }

  // 顶部页签栏几何布局（含宽窗单行与超长标签自动换行兜底）+ 真实数据集与模拟回归
  if (opts.assert && addonName.toLowerCase() === 'wowf') {
    const layoutAndMageChecks = [];
    const mainFrame = Object.values(finalSnap.frames).find((f) => f.name === 'WoWFMainFrame');
    const scroll = Object.values(finalSnap.frames).find((f) => f.name === 'WoWFMainScrollFrame');
    const mainW = mainFrame?.width || 0;
    const expectedTabs = ['智能匹配', '升级路线', '职业与天赋', '一键宏库', '地下城百科', '专业&无限特色', '声望', '无限服速查', '制造套利'];
    const inspectTabGeometry = (snap) => {
      const mf = Object.values(snap.frames).find((f) => f.name === 'WoWFMainFrame');
      const sf = Object.values(snap.frames).find((f) => f.name === 'WoWFMainScrollFrame');
      const mfW = mf?.width || 0;
      const rects = [];
      for (const label of expectedTabs) {
        const btn = Object.values(snap.frames).find(
          (f) => f.frameType === 'Button' && isFrameTreeShown(f, snap.frames) && stripWoWFormatting(f.text).trim() === label
        );
        if (btn && btn.parentId === mf?.id) {
          const pt = btn.points.find((p) => p.point === 'TOPLEFT') || { x: 0, y: 0 };
          rects.push({ label, x: pt.x || 0, y: -(pt.y || 0), w: btn.width || 0, h: btn.height || 0 });
        }
      }
      const sfPt = sf?.points.find((p) => p.point === 'TOPLEFT') || { y: -112 };
      const sfTop = -(sfPt.y || -112);
      const inBounds = mfW >= 920 && rects.length === expectedTabs.length
        && rects.every((r) => r.x >= 0 && r.x + r.w <= mfW && r.y + r.h <= sfTop);
      let overlaps = false;
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i], b = rects[j];
          if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) overlaps = true;
        }
      }
      return { mfW, sfTop, rects, inBounds, overlaps, rows: new Set(rects.map((r) => r.y)).size };
    };

    const normalGeo = inspectTabGeometry(finalSnap);
    layoutAndMageChecks.push(['主窗口加宽>=920', mainW >= 920 && Boolean(scroll)]);
    layoutAndMageChecks.push(['9个页签全部在主窗边界内且不遮挡滚动区', normalGeo.inBounds]);
    layoutAndMageChecks.push(['9个页签彼此不重叠', !normalGeo.overlaps]);
    layoutAndMageChecks.push(['常规宽度下9个页签单行显示', normalGeo.rows === 1]);

    // 极端超宽页签字体下验证自动换行与滚动区避让兜底
    const wrapHookLua = `
      local origCreateFrame = CreateFrame
      function CreateFrame(frameType, name, parent, template)
        local f = origCreateFrame(frameType, name, parent, template)
        if frameType == "Button" and template == "UIPanelButtonTemplate" and type(parent) == "table" and parent.GetName and parent:GetName() == "WoWFMainFrame" then
          f.GetTextWidth = function() return 180 end
        end
        return f
      end
    `;
    const wrapRt = new WoWSimulatorRuntime({ level: 25, classKey: 'MAGE', faction: 'Alliance' });
    wrapRt.loadAddon(addonName, [
      { filename: 'WrapHookMock.lua', content: wrapHookLua },
      ...files,
    ]);
    wrapRt.runSlashCommand('/wowf');
    const wrapSnap = wrapRt.getSnapshot();
    const wrapGeo = inspectTabGeometry(wrapSnap);
    layoutAndMageChecks.push(['超宽页签自动换行(>=2行)', wrapGeo.rows >= 2]);
    layoutAndMageChecks.push(['超宽换行后全部页签仍在主窗内且不遮挡滚动区', wrapGeo.inBounds]);
    layoutAndMageChecks.push(['超宽换行后页签互不重叠', !wrapGeo.overlaps]);
    wrapRt.destroy();

    // 校验真实快照 scripts/locales/wowf-dataset.json 中祖尔法拉克 #2861 已拆分为 alliance/horde
    const datasetPath = path.resolve('scripts/locales/wowf-dataset.json');
    if (fs.existsSync(datasetPath)) {
      const ds = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
      const zfDs = (ds.dungeons || []).find((d) => d.id === 'zul-farrak');
      const q2861List = (zfDs?.quests || []).filter((q) => q.id === 2861);
      const hasAllianceBink = q2861List.some((q) => q.faction === 'alliance' && q.npc === '彬克');
      const hasHordeAnastasia = q2861List.some((q) => q.faction === 'horde' && String(q.npc || '').includes('安娜斯塔西娅'));
      const hasBoth = q2861List.some((q) => q.faction === 'both');
      layoutAndMageChecks.push(['真实快照祖尔法拉克#2861已按阵营拆分', q2861List.length === 2 && hasAllianceBink && hasHordeAnastasia && !hasBoth]);
    }

    // 自包含模拟：真实风格 Mage 职业任务链 + 祖尔法拉克 #2861 + _G.QuestDB 覆盖陷阱（不依赖外部 wowf.zip）
    const mageDataAndQdbMockLua = `
      local Q = {
        [1919] = { name = "向詹妮亚报告", minLv = 15, lv = 15, nextQ = 1920 },
        [1920] = { name = "调查蓝色隐士", minLv = 15, lv = 16, preS = { 1919 } },
        [1947] = { name = "沼泽之旅", minLv = 30, lv = 38 },
        [1948] = { name = "能量物品", minLv = 30, lv = 40, preS = { 1947 } },
        [1949] = { name = "隐藏的秘密", minLv = 30, lv = 38, nextQ = 1950, preS = { 1947 } },
        [1950] = { name = "解封咒语", minLv = 30, lv = 30, nextQ = 1951, preS = { 1949 } },
        [1951] = { name = "能量仪祭", minLv = 30, lv = 40, preS = { 1950 } },
        [1952] = { name = "法师的魔杖", minLv = 30, lv = 40, preG = { 1948, 1951 } },
        [1953] = { name = "返回沼泽", minLv = 35, lv = 40, nextQ = 1954 },
        [1954] = { name = "地狱火宝珠", minLv = 35, lv = 40, nextQ = 1955, preS = { 1953 } },
        [1955] = { name = "驱除魔鬼", minLv = 35, lv = 40, nextQ = 1956, preS = { 1954 } },
        [1956] = { name = "奥达曼的能量源", minLv = 35, lv = 40, nextQ = 1957, preS = { 1955 } },
        [1957] = { name = "法力怒灵", minLv = 35, lv = 40, nextQ = 1958, preS = { 1956 } },
        [1958] = { name = "苍穹之力", minLv = 35, lv = 40, preS = { 1957 } },
      }
      _G.QuestDB = {
        name = function(id) return Q[id] and Q[id].name end,
        questLevel = function(id) return Q[id] and Q[id].lv end,
        requiredLevel = function(id) return Q[id] and Q[id].minLv end,
        nextQuestInChain = function(id) return Q[id] and Q[id].nextQ end,
        preQuestSingle = function(id) return Q[id] and Q[id].preS end,
        preQuestGroup = function(id) return Q[id] and Q[id].preG end,
      }
      local mageRuns = {
        {
          id = 1860, faction = "alliance", raceId = "human", raceName = "人类", level = 10, to = 10, name = "明镜湖",
          steps = {
            { id = 1860, name = "和詹妮亚交谈", level = 10, zone = "艾尔文森林", npc = "扎尔迪玛·维夫希尔特", x = 43.2, y = 66.2 },
            { id = 1861, name = "明镜湖", level = 10, zone = "暴风城", npc = "詹妮亚·坎农", x = 49.6, y = 85.8 },
          },
        },
        {
          id = 1919, faction = "alliance", raceId = "human", raceName = "人类", level = 15, to = 16, name = "法纹长袍",
          steps = {
            { id = 1919, name = "向詹妮亚报告", level = 15, zone = "艾尔文森林", npc = "扎尔迪玛·维夫希尔特", x = 43.2, y = 66.2 },
            { id = 1920, name = "调查蓝色隐士", level = 16, zone = "暴风城", npc = "詹妮亚·坎农", x = 49.6, y = 85.8 },
            { id = 1921, name = "收集原料", level = 15, zone = "暴风城", npc = "詹妮亚·坎农", x = 49.6, y = 85.8, preId = 1920 },
            { id = 1941, name = "法纹长袍", level = 15, zone = "暴风城", npc = "维恩·拉尔森", x = 51.8, y = 83.5, preId = 1921 },
          },
        },
        {
          id = 1939, faction = "alliance", raceId = "human", raceName = "人类", level = 26, to = 28, name = "星结之衣",
          steps = {
            { id = 1939, name = "高阶巫师安多玛斯", level = 26, zone = "暴风城", npc = "詹妮亚·坎农", x = 49.6, y = 85.8 },
            { id = 1938, name = "乌尔的暗影魔法研究论文", level = 28, zone = "暴风城", npc = "高阶巫师安多玛斯", x = 48.7, y = 87.6 },
            { id = 1940, name = "新鲜的蜘蛛丝", level = 26, zone = "暴风城", npc = "高阶巫师安多玛斯", x = 48.7, y = 87.6, preId = 1938 },
            { id = 1942, name = "星结之衣", level = 26, zone = "暴风城", npc = "维恩·拉尔森", x = 51.8, y = 83.5, preId = 1940 },
          },
        },
        {
          id = 1947, faction = "alliance", raceId = "human", raceName = "人类", level = 30, to = 40, name = "法师的魔杖",
          steps = {
            { id = 1947, name = "沼泽之旅", level = 38, zone = "暴风城", npc = "詹妮亚·坎农", x = 49.6, y = 85.8 },
            { id = 1949, name = "隐藏的秘密", level = 38, zone = "尘泥沼泽", npc = "塔贝萨", x = 46.1, y = 57.1, preId = 1947 },
            { id = 1950, name = "解封咒语", level = 30, zone = "千针石林", npc = "大法师提尔斯", x = 78.3, y = 75.7, preId = 1949 },
            { id = 1951, name = "能量仪祭", level = 40, zone = "千针石林", npc = "大法师提尔斯", x = 78.3, y = 75.7, preId = 1950 },
            { id = 1952, name = "法师的魔杖", level = 40, zone = "尘泥沼泽", npc = "塔贝萨", x = 46.1, y = 57.1, preId = 1951 },
          },
        },
        {
          id = 1953, faction = "alliance", raceId = "human", raceName = "人类", level = 35, to = 40, name = "苍穹之力",
          steps = {
            { id = 1953, name = "返回沼泽", level = 40, zone = "铁炉堡", npc = "彬克", x = 27.2, y = 8.3 },
            { id = 1954, name = "地狱火宝珠", level = 40, zone = "尘泥沼泽", npc = "塔贝萨", x = 46.1, y = 57.1 },
            { id = 1955, name = "驱除魔鬼", level = 40, zone = "尘泥沼泽", npc = "塔贝萨", x = 46.1, y = 57.1, preId = 1954 },
            { id = 1956, name = "奥达曼的能量源", level = 40, zone = "尘泥沼泽", npc = "塔贝萨", x = 46.1, y = 57.1, preId = 1955 },
            { id = 1957, name = "法力怒灵", level = 40, zone = "尘泥沼泽", npc = "塔贝萨", x = 46.1, y = 57.1, preId = 1956 },
            { id = 1958, name = "苍穹之力", level = 40, zone = "尘泥沼泽", npc = "塔贝萨", x = 46.1, y = 57.1, preId = 1957 },
          },
        },
      }
      WoWF_Data = {
        meta = { version = "mage-qdb-test" },
        routes = {
          ["skyborne-alliance"] = {
            name = "天裔 (联盟)", faction = "alliance",
            classRunsByClass = { MAGE = mageRuns },
            bands = {
              {
                from = 38, to = 47, zone = "荒芜之地",
                hub = { name = "埃格蒙德的营地", x = 42.0, y = 31.0 },
                questsByClass = {
                  MAGE = {
                    { id = 90001, name = "法师专属阶段任务", level = 40, kind = "class", zone = "荒芜之地", npc = "法师训练师", x = 42.0, y = 31.0 },
                    { id = 90002, name = "荒芜之地关键任务", level = 40, zone = "荒芜之地", npc = "营地NPC", x = 43.0, y = 32.0 },
                  },
                },
              },
            },
          },
        },
        classes = {
          MAGE = {
            name = "法师",
            specs = { { key = "arcane", name = "奥术", recommendedProfs = "", phases = {}, steps = {}, musts = {} } },
            classRuns = mageRuns,
            macros = {},
          },
        },
        dungeons = {
          {
            id = "zul-farrak", name = "祖尔法拉克", minLevel = 45, maxLevel = 48, visit = 45, zone = "塔纳利斯",
            entranceZone = "塔纳利斯", entranceX = 39.1, entranceY = 19.9,
            quests = {
              { id = 2861, name = "塔贝萨的任务", level = 46, minLevel = 40, faction = "alliance", npc = "彬克", zone = "铁炉堡", x = 27.0, y = 8.2 },
              { id = 2861, name = "塔贝萨的任务", level = 46, minLevel = 40, faction = "alliance", npc = "彬克", zone = "铁炉堡", x = 27.0, y = 8.2 },
              { id = 2861, name = "塔贝萨的任务", level = 46, minLevel = 40, faction = "horde", npc = "安娜斯塔西娅·哈特威尔", zone = "幽暗城", x = 85.0, y = 10.2 },
              { id = 99981, name = "职业区分副本任务", level = 46, minLevel = 40, faction = "alliance", classes = { "MAGE" }, npc = "法系NPC", zone = "塔纳利斯", x = 51.0, y = 28.0 },
              { id = 99981, name = "职业区分副本任务", level = 46, minLevel = 40, faction = "alliance", classes = { "WARLOCK" }, npc = "术士NPC", zone = "塔纳利斯", x = 52.0, y = 29.0 },
              { id = 99982, name = "多NPC拾取任务", level = 46, minLevel = 40, faction = "alliance", npc = "拾取NPC甲", zone = "塔纳利斯", x = 53.0, y = 30.0 },
              { id = 99982, name = "多NPC拾取任务", level = 46, minLevel = 40, faction = "alliance", npc = "拾取NPC乙", zone = "塔纳利斯", x = 54.0, y = 31.0 },
            },
          },
        },
        macros = {}, professions = {},
      }
    `;
    const coreOnlyFiles = files.filter((f) => !isDataLuaFile(f));
    const mageRt = new WoWSimulatorRuntime({
      level: 41,
      classKey: 'MAGE',
      raceKey: '天裔 (联盟)',
      faction: 'Alliance',
      completedQuests: [1947, 1949],
    });
    mageRt.loadAddon(addonName, [
      { filename: 'MageDataAndQdbMock.lua', content: mageDataAndQdbMockLua },
      ...coreOnlyFiles,
    ]);

    // 1) /wowf class（MATCH 与 ALL 模式）
    mageRt.runSlashCommand('/wowf class');
    let mageSnap = mageRt.getSnapshot();
    const getChainCardBody = (snap) => {
      const card = summarizeCards(snap).find((c) => c.title.includes('职业任务链与坐标指引'));
      return card ? card.body : '';
    };
    const matchChainBody = getChainCardBody(mageSnap);
    const countOccurrences = (text, needle) => (text.match(new RegExp(needle, 'g')) || []).length;

    const findVisibleBtn = (snap, predicate) => {
      for (const f of Object.values(snap.frames)) {
        if (f.frameType !== 'Button' || !isFrameTreeShown(f, snap.frames)) continue;
        const label = stripWoWFormatting(f.text).trim();
        if (predicate(label)) return f;
      }
      return null;
    };
    const allToggleBtn = findVisibleBtn(mageSnap, (l) => l.includes('查看 1-60 全程'));
    if (allToggleBtn) mageRt.triggerFrameScript(allToggleBtn.id, 'OnClick', 'LeftButton');
    mageSnap = mageRt.getSnapshot();
    const allChainBody = getChainCardBody(mageSnap);

    // 验证 QuestieDB 存在时每条法师职业任务名在「职业与天赋」页只出现 1 次、等级/步数未被覆写、天裔标签正确
    for (const qName of ['明镜湖', '法纹长袍', '星结之衣', '沼泽之旅', '法师的魔杖', '返回沼泽', '苍穹之力']) {
      layoutAndMageChecks.push([`职业页ALL-${qName}仅1次`, countOccurrences(allChainBody, qName) === 1]);
    }
    for (const qName of ['沼泽之旅', '法师的魔杖', '返回沼泽', '苍穹之力']) {
      layoutAndMageChecks.push([`职业页MATCH-${qName}仅1次`, countOccurrences(matchChainBody, qName) === 1]);
    }
    layoutAndMageChecks.push(['职业页Lv.30–40未被QuestieDB覆写为38', allChainBody.includes('Lv.30–40') && !allChainBody.includes('Lv.38')]);
    layoutAndMageChecks.push(['职业页Lv.35–40未被QuestieDB覆写为40', allChainBody.includes('Lv.35–40')]);
    layoutAndMageChecks.push(['1919保留4步未被截断', allChainBody.includes('收集原料') && allChainBody.includes('法纹长袍')]);
    layoutAndMageChecks.push(['天裔路线不误标人类', allChainBody.includes('[天裔 (联盟)]') && !allChainBody.includes('[人类]')]);

    // 2) /wowf route 不再重复职业任务链，只保留练级手法与专精里程碑
    mageRt.runSlashCommand('/wowf route');
    const mageRouteSnap = mageRt.getSnapshot();
    const mageRouteCards = summarizeCards(mageRouteSnap);
    const mageRouteText = mageRouteCards.map((c) => c.title + '\n' + c.body).join('\n');
    const mageQuestNames = ['沼泽之旅', '隐藏的秘密', '解封咒语', '能量仪祭', '法师的魔杖', '返回沼泽', '地狱火宝珠', '驱除魔鬼', '奥达曼的能量源', '法力怒灵', '苍穹之力'];
    layoutAndMageChecks.push([
      '路线页不再出现职业任务链',
      mageQuestNames.every((name) => !mageRouteText.includes(name)),
    ]);
    layoutAndMageChecks.push(['路线页仍渲染升级路线主卡', mageRouteCards.some((c) => c.title.includes('专属升级路线'))]);
    layoutAndMageChecks.push([
      '路线页阶段卡过滤职业专属任务但保留关键任务',
      mageRouteText.includes('荒芜之地关键任务') && !mageRouteText.includes('法师专属阶段任务'),
    ]);
    layoutAndMageChecks.push(['路线页不出现职业专属任务标签', !/\[★[^\]]*职业任务\]/.test(mageRouteText)]);

    // 2.1) 智能匹配页只保留「职业任务」入口，不再铺开任务链
    mageRt.runSlashCommand('/wowf');
    const mageSmartSnap = mageRt.getSnapshot();
    const mageSmartText = summarizeCards(mageSmartSnap).map((c) => c.title + '\n' + c.body).join('\n');
    const mageSmartRaw = Object.values(mageSmartSnap.fontStrings).map((fs) => fs.text || '').join('\n');
    layoutAndMageChecks.push([
      '智能匹配页不再重复职业任务链',
      mageQuestNames.every((name) => !mageSmartText.includes(name)) && mageSmartText.includes('职业与天赋'),
    ]);
    const entryLinkMatch = mageSmartRaw.match(/\|H(wowftab:[^|]*)\|h/);
    const entryLink = entryLinkMatch ? entryLinkMatch[1] : '';
    const entryTab = Number((entryLink.match(/^wowftab:(\d+)/) || [])[1]);
    layoutAndMageChecks.push(['智能匹配页职业任务入口为可点击链接', Boolean(entryLinkMatch)]);
    layoutAndMageChecks.push(['智能匹配页职业任务入口指向职业页(3)', entryTab === 3]);
    const smartEntryCard = Object.values(mageSmartSnap.frames).find((f) => {
      if (f.frameType !== 'Frame' || !f.backdrop) return false;
      return f.fontStrings.some((fid) => String(mageSmartSnap.fontStrings[fid]?.text || '').includes('|Hwowftab:'));
    });
    layoutAndMageChecks.push(['智能匹配页职业任务入口所在卡片存在', Boolean(smartEntryCard)]);
    if (smartEntryCard && entryLink !== '') {
      mageRt.triggerFrameScript(smartEntryCard.id, 'OnHyperlinkClick', entryLink, '「职业与天赋」页', 'LeftButton');
      const smartAfterClick = mageRt.getSnapshot();
      const smartAfterText = summarizeCards(smartAfterClick).map((c) => c.title + '\n' + c.body).join('\n');
      layoutAndMageChecks.push([
        '点击职业任务入口切换到职业与天赋页',
        smartAfterClick.luaErrors.length === 0 && smartAfterText.includes('战斗循环、天赋与职业任务'),
      ]);
    }

    // 3) 祖尔法拉克 #2861 联盟视角仅 1 条且为铁炉堡彬克；不同拾取 NPC 与「显示全部副本」不同职业同 ID 任务不被误删
    mageRt.charState.level = 46;
    mageRt.runSlashCommand('/wowf dungeon');
    const zfSnap = mageRt.getSnapshot();
    const zfCard = summarizeCards(zfSnap).find((c) => c.title.includes('祖尔法拉克'));
    const zfBody = zfCard ? zfCard.body : '';
    layoutAndMageChecks.push(['祖尔法拉克卡片存在', Boolean(zfCard)]);
    layoutAndMageChecks.push(['祖尔法拉克#2861仅出现1次', countOccurrences(zfBody, '塔贝萨的任务') === 1]);
    layoutAndMageChecks.push(['祖尔法拉克#2861联盟显示彬克', zfBody.includes('彬克') && !zfBody.includes('安娜斯塔西娅')]);
    layoutAndMageChecks.push(['MATCH模式保留不同拾取NPC同ID任务', zfBody.includes('拾取NPC甲') && zfBody.includes('拾取NPC乙')]);
    layoutAndMageChecks.push(['MATCH模式仅保留法师职业任务', zfBody.includes('法系NPC') && !zfBody.includes('术士NPC')]);
    const showAllDungeonBtn = findVisibleBtn(zfSnap, (l) => l.includes('看无限服新本'));
    layoutAndMageChecks.push(['副本筛选按钮-看无限服新本存在', Boolean(showAllDungeonBtn)]);
    if (showAllDungeonBtn) mageRt.triggerFrameScript(showAllDungeonBtn.id, 'OnClick', 'LeftButton');
    const zfNewSnap = mageRt.getSnapshot();
    const showAllDungeonBtn2 = findVisibleBtn(zfNewSnap, (l) => l.includes('显示全部副本'));
    layoutAndMageChecks.push(['副本筛选按钮-显示全部副本存在', Boolean(showAllDungeonBtn2)]);
    if (showAllDungeonBtn2) mageRt.triggerFrameScript(showAllDungeonBtn2.id, 'OnClick', 'LeftButton');
    const zfAllSnap = mageRt.getSnapshot();
    const zfAllCards = summarizeCards(zfAllSnap);
    layoutAndMageChecks.push(['已切换到全部副本模式', zfAllCards.some((c) => c.title.includes('当前筛选: 全部'))]);
    const zfAllCard = zfAllCards.find((c) => c.title.includes('祖尔法拉克'));
    const zfAllBody = zfAllCard ? zfAllCard.body : '';
    layoutAndMageChecks.push(['全部副本模式保留同ID不同职业记录', zfAllBody.includes('法系NPC') && zfAllBody.includes('术士NPC')]);
    layoutAndMageChecks.push(['全部副本模式#2861保留双阵营但不重复同阵营', countOccurrences(zfAllBody, '塔贝萨的任务') === 2]);

    // 4) 单步职业任务与回退重复 classRuns 不重复渲染，同时保留末步相同但起始步骤不同的种族链
    const dupFallbackMockLua = `
      WoWF_Data = {
        meta = { version = "dup-test" },
        routes = {
          dwarf = { name = "矮人", faction = "alliance", bands = { { from = 1, to = 60, zone = "丹莫罗", hub = { name = "卡拉诺斯", x = 47.0, y = 52.0 }, quests = {} } } },
          troll = { name = "巨魔", faction = "horde", bands = { { from = 1, to = 60, zone = "杜隆塔尔", hub = { name = "森金村", x = 55.0, y = 74.0 }, quests = {} } } },
        },
        classes = {
          MAGE = {
            name = "法师",
            specs = { { key = "arcane", name = "奥术", recommendedProfs = "", phases = {}, steps = {}, musts = {} } },
            classRuns = {
              { id = 99910, faction = "alliance", raceId = "human", raceName = "人类", level = 40, to = 40, name = "单步职业任务", steps = { { id = 99910, name = "单步职业任务", level = 40, zone = "暴风城", npc = "詹妮亚", x = 49.6, y = 85.8 } } },
              { id = 99910, faction = "alliance", raceId = "gnome", raceName = "侏儒", level = 40, to = 40, name = "单步职业任务", steps = { { id = 99910, name = "单步职业任务", level = 40, zone = "暴风城", npc = "詹妮亚", x = 49.6, y = 85.8 } } },
            },
            macros = {},
          },
          SHAMAN = {
            name = "萨满祭司",
            specs = { { key = "ele", name = "元素", recommendedProfs = "", phases = {}, steps = {}, musts = {} } },
            classRuns = {
              {
                id = 2983, faction = "horde", raceId = "orc", raceName = "兽人", level = 10, to = 13, name = "火焰的召唤",
                steps = {
                  { id = 2983, name = "火焰的召唤(兽人)", level = 10, zone = "杜隆塔尔", npc = "斯瓦特", x = 54.4, y = 42.6 },
                  { id = 1527, name = "火焰的召唤(终步)", level = 13, zone = "杜隆塔尔", npc = "塔尔努", x = 38.5, y = 58.9 },
                },
              },
              {
                id = 2984, faction = "horde", raceId = "tauren", raceName = "牛头人", level = 10, to = 13, name = "火焰的召唤",
                steps = {
                  { id = 2984, name = "火焰的召唤(牛头人)", level = 10, zone = "莫高雷", npc = "纳姆·逐星", x = 48.3, y = 59.1 },
                  { id = 1527, name = "火焰的召唤(终步)", level = 13, zone = "杜隆塔尔", npc = "塔尔努", x = 38.5, y = 58.9 },
                },
              },
            },
            macros = {},
          },
        },
        dungeons = {}, macros = {}, professions = {},
      }
    `;
    const dupFallbackRt = new WoWSimulatorRuntime({
      level: 40,
      classKey: 'MAGE',
      raceKey: '矮人',
      faction: 'Alliance',
    });
    dupFallbackRt.loadAddon(addonName, [
      { filename: 'DupFallbackMock.lua', content: dupFallbackMockLua },
      ...coreOnlyFiles,
    ]);
    dupFallbackRt.runSlashCommand('/wowf class');
    const dupFallbackBody = getChainCardBody(dupFallbackRt.getSnapshot());
    layoutAndMageChecks.push(['单步及重复回退任务链仅显示1次', countOccurrences(dupFallbackBody, '单步职业任务') === 1]);

    const shamanFallbackRt = new WoWSimulatorRuntime({
      level: 10,
      classKey: 'SHAMAN',
      raceKey: '巨魔',
      faction: 'Horde',
    });
    shamanFallbackRt.loadAddon(addonName, [
      { filename: 'ShamanFallbackMock.lua', content: dupFallbackMockLua },
      ...coreOnlyFiles,
    ]);
    shamanFallbackRt.runSlashCommand('/wowf class');
    const shamanFallbackBody = getChainCardBody(shamanFallbackRt.getSnapshot());
    layoutAndMageChecks.push(['回退保留末步相同但起始不同的种族链', shamanFallbackBody.includes('火焰的召唤(兽人)') && shamanFallbackBody.includes('火焰的召唤(牛头人)')]);

    const layoutMageFailed = layoutAndMageChecks.filter(([, ok]) => !ok);
    const mageFinalSnap = mageRt.getSnapshot();
    const dupFbSnap = dupFallbackRt.getSnapshot();
    const shamanFbSnap = shamanFallbackRt.getSnapshot();
    if (wrapSnap.luaErrors.length > 0 || mageFinalSnap.luaErrors.length > 0 || dupFbSnap.luaErrors.length > 0 || shamanFbSnap.luaErrors.length > 0 || layoutMageFailed.length > 0) {
      assertionFailed = true;
      console.error(
        `[Assert Failed] 布局/法师职业任务回归 errors=${wrapSnap.luaErrors.length + mageFinalSnap.luaErrors.length + dupFbSnap.luaErrors.length + shamanFbSnap.luaErrors.length}, failed=${layoutMageFailed.map(([n]) => n).join('|')}`
      );
      if (wrapSnap.luaErrors.length > 0) console.error(wrapSnap.luaErrors);
      if (mageFinalSnap.luaErrors.length > 0) console.error(mageFinalSnap.luaErrors);
      if (dupFbSnap.luaErrors.length > 0) console.error(dupFbSnap.luaErrors);
      if (shamanFbSnap.luaErrors.length > 0) console.error(shamanFbSnap.luaErrors);
    } else {
      console.log('[✓] 宽窗页签布局（含自动换行兜底）与法师职业任务去重回归通过。');
    }
    mageRt.destroy();
    dupFallbackRt.destroy();
    shamanFallbackRt.destroy();

    // 黑石交易技能在无限服 1.60.1（GetRealmName() 返回空串）下的行情与在售数量回归
    const btChecks = [];
    const btRt = new WoWSimulatorRuntime({ level: 40, classKey: 'MAGE', faction: 'Alliance' });
    btRt.loadAddon(addonName, [...coreOnlyFiles]);
    btRt.execLua(`
      function GetRealmName() return "" end
      _G.BlackthornesTSDB = {
        prices = {
          ["Forever-Alliance"] = {
            [4496] = { market = 26849, min = 29000, rivalMin = 29000, quantity = 77, seen = 1795580000 },
          },
          ["Forever-Horde"] = {
            [4496] = { market = 99999, min = 99000, rivalMin = 99000, quantity = 99, seen = 1795580000 },
          },
        },
        lastFullScanByRealm = { ["Forever-Alliance"] = 1795580000 },
      }
      local runtimePrices = {
        [4496] = { market = 26849, min = 25000, rivalMin = 25000, quantity = 13, seen = 1795581100 },
      }
      _G.BlackthornesTS = {
        Config = {
          GetRealmKey = function() return "Forever-Alliance" end,
        },
        Prices = {
          changes = 1,
          GetTable = function() return runtimePrices end,
          GetLastScan = function() return 1795581100 end,
        },
      }
      _G.BlackthornesTS_API = {
        version = 1,
        GetPrice = function(item)
          if item == 4496 then return 26849 end
          return nil
        end,
      }
      WoWFDB = WoWFDB or {}
      WoWFDB.vendorCache = {
        ["查瑞迪·米普斯"] = {
          zone = "尘泥沼泽",
          at = 1795581000,
          [4496] = { id = 4496, price = 20000, stock = -1, stack = 1, zone = "尘泥沼泽", at = 1795581000 },
        },
      }
      WoWF_CraftArb.Reset()

      local supply, supplySource = WoWF_CraftArb.ListedSupply(4496)
      local quote, _, quoteSource = WoWF_CraftArb.SellQuote(4496)
      local rows, meta = WoWF_CraftArb.Analyse({ source = "vendor", onlyProfitable = false })
      local row4496
      for _, r in ipairs(rows) do
        if r.outputID == 4496 then row4496 = r; break end
      end
      __WOW_BRIDGE__:emitString(table.concat({
        "runtime",
        tostring(supply),
        tostring(supplySource),
        tostring(quote),
        tostring(quoteSource),
        tostring(meta and meta.market and meta.market.updatedAt),
        tostring(row4496 and row4496.listedSupply),
        tostring(row4496 and row4496.price),
      }, "|"))
    `, 'BtRuntimeTest.lua');

    const [runtimeOut] = btRt.takeEmittedStrings();
    const rtParts = String(runtimeOut || '').split('|');
    btChecks.push(['运行时-ListedSupply返回13/quantity', rtParts[1] === '13' && rtParts[2] === 'quantity']);
    btChecks.push(['运行时-SellQuote优先min而非API均值', rtParts[3] === '25000' && rtParts[4] === 'min']);
    btChecks.push(['运行时-Analyse返回updatedAt/supply/price', rtParts[5] === '1795581100' && rtParts[6] === '13' && rtParts[7] === '25000']);

    btRt.runSlashCommand('/wowf arb');
    let btArbSnap = btRt.getSnapshot();
    const switchSourceBtn = Object.values(btArbSnap.frames).find(
      (f) => f.frameType === 'Button' && isFrameTreeShown(f, btArbSnap.frames) && stripWoWFormatting(f.text).includes('来源: 制作')
    );
    btChecks.push(['UI-套利页存在来源切换按钮', Boolean(switchSourceBtn)]);
    if (switchSourceBtn) {
      btRt.triggerFrameScript(switchSourceBtn.id, 'OnClick', 'LeftButton');
      btArbSnap = btRt.getSnapshot();
    }
    const btVendorText = summarizeCards(btArbSnap).map((c) => `${c.title}\n${c.body}`).join('\n');
    btChecks.push(['UI-商人套利卡显示13件(偏少)', btVendorText.includes('13 件(偏少)')]);
    btChecks.push(['UI-商人套利卡不再显示未知(行情未扫描)', !btVendorText.includes('未知(行情未扫描)')]);
    btChecks.push(['UI-商人套利卡不再退回行情接口报价', !btVendorText.includes('行情接口报价')]);

    // 仅存档回退（无 _G.BlackthornesTS，GetRealmName() == ""）与标准服名校验
    btRt.execLua(`
      _G.BlackthornesTS = nil
      _G.BlackthornesTS_API = nil
      function GetRealmName() return "" end

      -- 场景 A：BlackthornesTSCharDB 记住服名，在 Forever-Alliance / Forever-Horde 并存时命中联盟表
      _G.BlackthornesTSCharDB = { realmName = "Forever" }
      _G.BlackthornesTSDB = {
        prices = {
          ["Forever-Alliance"] = { [4496] = { market = 26849, min = 25000, quantity = 13, seen = 1795581100 } },
          ["Forever-Horde"] = { [4496] = { market = 99999, min = 99000, quantity = 99, seen = 1795581100 } },
        },
      }
      WoWF_CraftArb.Reset()
      local sA = WoWF_CraftArb.ListedSupply(4496)

      -- 场景 B：无 BlackthornesTSCharDB，仅存在 UnknownRealm-Alliance / UnknownRealm-Horde
      _G.BlackthornesTSCharDB = nil
      _G.BlackthornesTSDB = {
        prices = {
          ["UnknownRealm-Alliance"] = { [4496] = { market = 26849, min = 25000, quantity = 13, seen = 1795581100 } },
          ["UnknownRealm-Horde"] = { [4496] = { market = 99999, min = 99000, quantity = 99, seen = 1795581100 } },
        },
      }
      WoWF_CraftArb.Reset()
      local sB = WoWF_CraftArb.ListedSupply(4496)

      -- 场景 C：跨阵营隔离（部落角色在只有 Forever-Alliance 时不得串读）
      local origFaction = UnitFactionGroup
      function UnitFactionGroup() return "Horde", "部落" end
      _G.BlackthornesTSDB = {
        prices = {
          ["Forever-Alliance"] = { [4496] = { market = 26849, min = 25000, quantity = 13, seen = 1795581100 } },
        },
      }
      WoWF_CraftArb.Reset()
      local sC = WoWF_CraftArb.ListedSupply(4496)
      UnitFactionGroup = origFaction

      -- 标准服名：SomeRealm-Alliance 命中且 min=0 时回退 rivalMin
      function GetRealmName() return "SomeRealm" end
      _G.BlackthornesTSDB = {
        prices = {
          ["SomeRealm-Alliance"] = { [4496] = { market = 26849, min = 0, rivalMin = 24000, quantity = 13, seen = 1795581100 } },
        },
      }
      WoWF_CraftArb.Reset()
      local sD = WoWF_CraftArb.ListedSupply(4496)
      local qD, _, qSrcD = WoWF_CraftArb.SellQuote(4496)

      __WOW_BRIDGE__:emitString(table.concat({
        tostring(sA), tostring(sB), tostring(sC), tostring(sD), tostring(qD), tostring(qSrcD)
      }, "|"))
    `, 'BtFallbackTest.lua');

    const [fallbackOut] = btRt.takeEmittedStrings();
    const fbParts = String(fallbackOut || '').split('|');
    btChecks.push(['存档回退A-CharDB记住服名命中Forever-Alliance(13)', fbParts[0] === '13']);
    btChecks.push(['存档回退B-UnknownRealm-Alliance命中(13)', fbParts[1] === '13']);
    btChecks.push(['存档回退C-部落不串读Forever-Alliance(nil)', fbParts[2] === 'nil']);
    btChecks.push(['标准服名-SomeRealm-Alliance命中(13)', fbParts[3] === '13']);
    btChecks.push(['标准服名-min=0时SellQuote回退rivalMin(24000)', fbParts[4] === '24000' && fbParts[5] === 'rivalMin']);

    const btFailed = btChecks.filter(([, ok]) => !ok);
    const btSnapFinal = btRt.getSnapshot();
    if (btSnapFinal.luaErrors.length > 0 || btFailed.length > 0) {
      assertionFailed = true;
      console.error(
        `[Assert Failed] 黑石空服名在售数量回归 errors=${btSnapFinal.luaErrors.length}, failed=${btFailed.map(([n]) => n).join('|')}`
      );
      if (btSnapFinal.luaErrors.length > 0) console.error(btSnapFinal.luaErrors);
    } else {
      console.log('[✓] 黑石交易技能空服名（无限服 1.60.1）在售数量与报价回归通过。');
    }
    btRt.destroy();
  }

  if (opts.assert && (finalSnap.luaErrors.length > 0 || assertionFailed)) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
