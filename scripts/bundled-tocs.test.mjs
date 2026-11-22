// flavor 清单（Forever / Camelot）对齐与校验的单元测试
// 运行：npm run test:tocs  或  node --test scripts/bundled-tocs.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { syncFlavorTocs, validateFlavorTocs } from './bundled-tocs.js';

/**
 * 造一份最小可用 TOC
 * @param {string} version
 * @param {string[]} files
 * @returns {string}
 */
function makeToc(version, files) {
  return [`## Interface: 16001`, `## Version: ${version}`, ...files].join('\n') + '\n';
}

/**
 * 造一个插件包：folder 下放 TOC 与对应模块文件
 * @param {Record<string, string|{toc: string, files?: string[]}>} addons
 * @returns {Promise<JSZip>}
 */
async function makeZip(addons) {
  const zip = new JSZip();
  for (const [folder, spec] of Object.entries(addons)) {
    const tocMap = typeof spec === 'string' ? { [`${folder}.toc`]: spec } : { [spec.toc]: spec.files ? makeToc('1.0.0', spec.files) : '' };
    for (const [tocName, tocText] of Object.entries(tocMap)) {
      const files = [...tocText.matchAll(/^(.+\.(?:lua|xml))\s*$/gim)].map(m => m[1].replace(/\\/g, '/'));
      zip.file(`${folder}/${tocName}`, tocText);
      for (const file of files) zip.file(`${folder}/${file}`, '-- module');
    }
  }
  return zip;
}

test('只有 Forever 清单时补出一份字节一致的 Camelot 清单', async () => {
  const zip = await makeZip({
    Questie: { toc: 'Questie_Forever.toc', files: ['Modules\\Map\\ProfessionStations.lua'] },
  });

  const written = await syncFlavorTocs(zip);

  assert.deepEqual(written, ['Questie/Questie_Camelot.toc']);
  const forever = await zip.file('Questie/Questie_Forever.toc').async('nodebuffer');
  const camelot = await zip.file('Questie/Questie_Camelot.toc').async('nodebuffer');
  assert.ok(forever.equals(camelot));
  assert.deepEqual(await validateFlavorTocs(zip), []);
});

test('残留的旧版 Camelot 清单会被本期 Forever 清单覆盖', async () => {
  const zip = new JSZip();
  zip.file('Questie/Questie_Forever.toc', makeToc('12.12.0', ['Modules\\Map\\ProfessionStations.lua']));
  zip.file('Questie/Modules/Map/ProfessionStations.lua', '-- new module');
  // 模拟用户本地残留的 12.10.0 清单：还在引用早已删除的 Moonwell.lua
  zip.file('Questie/Questie_Camelot.toc', makeToc('12.10.0', ['Modules\\Map\\Moonwell.lua']));

  const written = await syncFlavorTocs(zip);

  assert.deepEqual(written, ['Questie/Questie_Camelot.toc']);
  const camelot = await zip.file('Questie/Questie_Camelot.toc').async('string');
  assert.match(camelot, /12\.12\.0/);
  assert.match(camelot, /ProfessionStations\.lua/);
  assert.doesNotMatch(camelot, /Moonwell\.lua/);
  assert.deepEqual(await validateFlavorTocs(zip), []);
});

test('只有 Camelot 清单时反向补一份 Forever 清单', async () => {
  const zip = await makeZip({
    SomeAddon: { toc: 'SomeAddon_Camelot.toc', files: ['Core.lua'] },
  });

  const written = await syncFlavorTocs(zip);

  assert.deepEqual(written, ['SomeAddon/SomeAddon_Forever.toc']);
  const camelot = await zip.file('SomeAddon/SomeAddon_Camelot.toc').async('nodebuffer');
  const forever = await zip.file('SomeAddon/SomeAddon_Forever.toc').async('nodebuffer');
  assert.ok(camelot.equals(forever));
  assert.deepEqual(await validateFlavorTocs(zip), []);
});

test('大小写不同的旧别名清单会被就地覆盖，不留下重复条目', async () => {
  const zip = new JSZip();
  zip.file('A/A_Forever.toc', makeToc('2.0.0', ['New.lua']));
  zip.file('A/New.lua', '-- new module');
  // 旧包用的是小写 camelot，且清单内容已过期
  zip.file('A/A_camelot.toc', makeToc('1.0.0', ['Old.lua']));
  zip.file('A/Old.lua', '-- old module');

  const written = await syncFlavorTocs(zip);

  assert.deepEqual(written, ['A/A_camelot.toc']);
  const aliasEntries = Object.keys(zip.files).filter(p => /camelot\.toc$/i.test(p));
  assert.deepEqual(aliasEntries, ['A/A_camelot.toc'], `不应出现重复条目：${aliasEntries.join(', ')}`);
  const alias = await zip.file('A/A_camelot.toc').async('string');
  assert.match(alias, /2\.0\.0/);
  assert.match(alias, /New\.lua/);
  assert.deepEqual(await validateFlavorTocs(zip), []);
});

test('同名清单已一致时不重复写入（幂等）', async () => {
  const zip = await makeZip({ A: { toc: 'A_Forever.toc', files: ['a.lua'] } });
  await syncFlavorTocs(zip);

  assert.deepEqual(await syncFlavorTocs(zip), []);
});

test('多插件包只处理带 flavor 清单的目录，Libs 子目录不被改动', async () => {
  const zip = await makeZip({
    Bagnon: { toc: 'Bagnon.toc', files: ['Bagnon.lua'] },
    SpellActivationOverlay: { toc: 'SpellActivationOverlay_Forever.toc', files: ['Core.lua'] },
  });
  zip.file('SpellActivationOverlay/Libs/LibStub/LibStub.toc', '## Interface: 16001\nLibStub.lua\n');

  const written = await syncFlavorTocs(zip);

  assert.deepEqual(written, ['SpellActivationOverlay/SpellActivationOverlay_Camelot.toc']);
  assert.equal(zip.file('Bagnon/Bagnon.toc') !== null, true);
  assert.equal(zip.file('Bagnon/Bagnon_Camelot.toc'), null);
  assert.equal(zip.file('SpellActivationOverlay/Libs/LibStub/LibStub_Camelot.toc'), null);
  assert.deepEqual(await validateFlavorTocs(zip), []);
});

test('清单引用包内不存在的文件时报错', async () => {
  const zip = new JSZip();
  zip.file('Broken/Broken_Forever.toc', makeToc('1.0.0', ['Missing.lua']));

  const problems = await validateFlavorTocs(zip);

  // 除了缺文件，同时会报告缺少配套的 Camelot 清单
  assert.equal(problems.length, 2);
  const missingFileProblem = problems.find(p => p.includes('Broken_Forever.toc 引用了包内不存在的文件'));
  assert.ok(missingFileProblem, `未报告缺文件：${problems.join(' | ')}`);
  assert.match(missingFileProblem, /Missing\.lua/);
});

test('保留 Forever 却缺 Camelot（只可能在未运行对齐时出现）会被判为错误', async () => {
  const zip = new JSZip();
  zip.file('X/X_Forever.toc', makeToc('1.0.0', ['x.lua']));
  zip.file('X/x.lua', '-- module');

  const problems = await validateFlavorTocs(zip);

  assert.equal(problems.length, 1);
  assert.match(problems[0], /缺少配套的 X_Camelot\.toc/);
});

test('注释行与跨目录 `..\\` 引用不会被误判', async () => {
  const zip = new JSZip();
  zip.file('BagBrother/frames/bank/bank.xml', '<Ui/>');
  zip.file('BagBrother/config/config.xml', '<Ui/>');
  zip.file(
    'Bagnon_Bank/Bagnon_Bank.toc',
    [
      '## Interface: 16001',
      '## Version: 1.0.0',
      '#..\\BagBrother\\missing\\commented.xml',
      ';..\\BagBrother\\also\\commented.lua',
      '..\\BagBrother\\frames\\bank\\bank.xml',
      '..\\BagBrother\\config\\config.xml',
    ].join('\n') + '\n'
  );

  assert.deepEqual(await validateFlavorTocs(zip), []);
});
