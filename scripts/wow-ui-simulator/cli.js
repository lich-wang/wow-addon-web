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

// 职业任务链标签：里程碑卡「Lv.N …·法师职业任务]」，阶段卡「★Lv.N 法师专属职业任务链]」
// 以及 FormatClassRunLine 默认「Lv.N …·法师专属任务链]」
const CHAIN_TAG_RE = /\[★?Lv\.(\d+) ([^\]\n]*?)(?:专属职业任务链|专属任务链|职业任务)\]/g;

// 同一任务链在里程碑卡与阶段卡里的标签前缀不同（「天裔 (联盟)·法师」vs「法师」），
// 因此链身份用「等级 + 归一化职业名」：取标签最后一个「·」后的部分，忽略种族/路线前缀。
function normalizeChainOwner(label) {
  const parts = String(label || '').split('·');
  return parts[parts.length - 1].replace(/专属$/, '').trim();
}

function analyzeRouteDedupe(cards) {
  // key = `${等级}|${职业}`，value = 出现过的卡片下标集合
  const chainKeys = new Map();
  cards.forEach((c, idx) => {
    for (const m of c.body.matchAll(CHAIN_TAG_RE)) {
      const key = `${m[1]}|${normalizeChainOwner(m[2])}`;
      if (!chainKeys.has(key)) chainKeys.set(key, new Set());
      chainKeys.get(key).add(idx);
    }
  });
  return {
    chainKeys,
    dupChains: [...chainKeys.entries()].filter(([, set]) => set.size > 1),
    zoneBlockCards: cards.filter((c) => c.body.includes('本阶段适龄练级区域')),
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

function selfTestRouteDedupe() {
  const cases = [
    {
      name: '同一任务链跨卡重复',
      cards: [{ body: '[Lv.20 人类·法师职业任务]' }, { body: '[★Lv.20 法师专属职业任务链]' }],
      expectDup: true,
    },
    {
      name: '同等级但不同职业的两条链',
      cards: [{ body: '[Lv.20 人类·法师职业任务]' }, { body: '[Lv.20 人类·战士职业任务]' }],
      expectDup: false,
    },
  ];
  for (const c of cases) {
    const dup = analyzeRouteDedupe(c.cards).dupChains.length > 0;
    if (dup !== c.expectDup) {
      return `去重自检失败：${c.name}（期望 ${c.expectDup ? '判定重复' : '不判定重复'}）`;
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
      // 职业任务链只允许在顶部「核心职业任务与专精里程碑」卡出现一次。
      // 按「链身份（等级 + 标签）」统计，而不是按“职业任务”字样计数，
      // 这样阶段卡里合法的普通职业关键任务不会被误判成重复链。
      const { dupChains, zoneBlockCards } = analyzeRouteDedupe(cards);
      if (dupChains.length > 0) {
        console.error(
          `[Assert Failed] /wowf route 职业任务链重复渲染：${dupChains
            .map(([lvl, set]) => `Lv.${lvl} 出现在 ${set.size} 张卡`)
            .join('、')}`
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

  // Sample-data dedupe regression: 用固定的样例角色验证「职业任务链只渲染一次」
  // 与「本阶段适龄练级区域只渲染一次」确实被覆盖（内置演示数据含 classRunsByClass 与 altZones）。
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
      if (
        snap.luaErrors.length > 0 ||
        chainKeys.size === 0 ||
        dupChains.length > 0 ||
        zoneBlockCards.length !== 1
      ) {
        sampleFail = true;
        console.error(
          `[Assert Failed] 样例去重回归 (${c.label}) failed (errors=${snap.luaErrors.length}, chains=${chainKeys.size}, dup=${dupChains.length}, zoneBlocks=${zoneBlockCards.length})`
        );
      }
      srt.destroy();
    }
    if (sampleFail) assertionFailed = true;
    else console.log('[✓] 样例数据去重回归通过（职业任务链/区域块各只出现一次）。');
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
      {
        label: '圣骑士未完成战马任务',
        classKey: 'PALADIN',
        marker: '审判和救赎',
        level: 60,
        options: { knownSpells: [33388] },
        expectMount: true,
      },
      {
        label: '圣骑士已完成战马任务',
        classKey: 'PALADIN',
        marker: '审判和救赎',
        level: 60,
        options: { knownSpells: [33388, 23214] },
        expectMount: false,
      },
      {
        label: '圣骑士仅完成战马任务',
        classKey: 'PALADIN',
        marker: '审判和救赎',
        level: 60,
        options: { knownSpells: [33388], completedQuests: [7647] },
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

    // 自动刷新回归：窗口已打开时学会骑术，事件驱动重绘后提醒应消失
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
    else console.log('[✓] 半人马阵营任务卡回归通过（声望过滤、交物品/可重复、门槛与已完成折叠）。');
  }

  // 声望页：16 个新增第三方声望的任务卡（声望过滤、已完成折叠、跨阵营去重）
  if (opts.assert && addonName.toLowerCase() === 'wowf') {
    const repCoreFiles = files.filter((f) => !isDataLuaFile(f));
    const reputationMockLua = `
      local REP = { [2586] = 3250, [2740] = 9000, [2826] = 0, [2587] = 0 }
      function GetFactionInfoByID(id)
        local value = REP[id] or 0
        return "faction", "", 4, 0, 0, value
      end
      local function q(id, name, lv, minLv, zone, extra)
        local t = { id = id, name = name, level = lv, minLevel = minLv, zone = zone, items = {}, otherRep = {} }
        for k, v in pairs(extra or {}) do t[k] = v end
        return t
      end
      WoWF_Data = {
        meta = { version = "reputation-test" },
        routes = {},
        classes = { MAGE = { name = "法师", specs = { { key = "frost", name = "冰霜专精" } } } },
        dungeons = {}, macros = {}, professions = {},
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
    const sharedCount = (repAll.match(/共同任务/g) || []).length;
    const repChecks = [
      ['声望总览卡', repTitles.some((t) => t.includes('新增第三方声望'))],
      ['贸易局声望', repAll.includes('友善 (3,250)')],
      ['工匠文书分组', repTitles.some((t) => t.includes('工匠文书 +75'))],
      ['可重复文书未被完成过滤', repAll.includes('工匠文书：测试药水')],
      ['已完成任务折叠', repAll.includes('已完成 1 条声望任务') && !repAll.includes('联盟之旅')],
      ['共同任务只列一次', sharedCount === 1],
      ['去重提示', repAll.includes('已列在其他阵营卡')],
      ['高等级任务折叠', !repAll.includes('高等级任务') && repAll.includes('需更高等级')],
      ['对立阵营详情隐藏', !repTitles.some((t) => t.includes('杜隆塔尔补给后勤部'))],
    ];
    const repFailed = repChecks.filter(([, ok]) => !ok);
    if (repSnap.luaErrors.length > 0 || repFailed.length > 0) {
      assertionFailed = true;
      console.error(
        `[Assert Failed] 声望页回归 errors=${repSnap.luaErrors.length}, failed=${repFailed.map(([name]) => name).join('|')}`
      );
    } else {
      console.log('[✓] 声望页回归通过（声望过滤、已完成折叠、工匠文书/可重复、跨阵营去重）。');
    }
    repRt.destroy();
  }

  if (opts.assert && (finalSnap.luaErrors.length > 0 || assertionFailed)) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
