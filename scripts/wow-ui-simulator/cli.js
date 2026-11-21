import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { WoWSimulatorRuntime } from './runtime.js';
import { SAMPLE_WOWF_DATA_LUA } from './sample-data.js';
import { stripWoWFormatting } from './text-measure.js';
import { generateHtmlReport } from './html-report.js';

// 坐标数值：兼容整点/多位小数、半角/全角逗号，用于校验可见文案中不得残留坐标
const COORD_TEXT_PATTERN = /\b\d{1,3}(?:\.\d+)?\s*[,，]\s*\d{1,3}(?:\.\d+)?\b/;

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
        const leaked = [c.title, c.body].find((t) => COORD_TEXT_PATTERN.test(t));
        if (leaked) {
          console.error(`[Assert Failed] ${cmd} 仍渲染出裸坐标: ${String(leaked).slice(0, 160)}`);
          assertionFailed = true;
          break;
        }
      }
      for (const m of snap.chatMessages) {
        const plain = stripWoWFormatting(m.text);
        if (COORD_TEXT_PATTERN.test(plain)) {
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

  if (opts.assert && (finalSnap.luaErrors.length > 0 || assertionFailed)) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
