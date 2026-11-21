import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { WoWSimulatorRuntime } from './runtime.js';
import { SAMPLE_WOWF_DATA_LUA } from './sample-data.js';
import { stripWoWFormatting } from './text-measure.js';
import { generateHtmlReport } from './html-report.js';

function parseArgs(argv) {
  const opts = {
    addonDir: path.resolve('addons/WoWF'),
    wowDir: '',
    level: 25,
    classKey: 'MAGE',
    faction: 'Alliance',
    slash: ['/wowf', '/wowf route', '/wowf dungeon', '/wowf class', '/wowf macro', '/wowf arb'],
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
    const coreFiles = files.filter((f) => !path.basename(f.filename).toLowerCase().startsWith('data.lua'));
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

  if (opts.assert && (finalSnap.luaErrors.length > 0 || assertionFailed)) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
