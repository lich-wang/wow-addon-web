// 零重压缩 ZIP 分批拆分单元测试
// 运行：node --experimental-strip-types --test scripts/zip-splitter.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import JSZip from 'jszip';
import {
  buildZipBatch,
  planZipBatches,
} from '../src/services/zipSplitter.ts';

function makeBytes(length, seed) {
  const buf = Buffer.allocUnsafe(length);
  let state = (seed ^ 0x9e3779b9) >>> 0 || 1;
  for (let i = 0; i < length; i++) {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    buf[i] = state & 0xff;
  }
  return buf;
}

/**
 * 构造一个携带 bit 3 (Data Descriptor) 且 LFH 中 crc/sizes 为 0 的标准 ZIP，
 * 用于验证拆分器能否正确从 Central Directory 回填 LFH 并清除 bit 3。
 */
function buildBit3Zip(entries) {
  const localParts = [];
  const cdParts = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const compressed = zlib.deflateRawSync(data);
    const crc = zlib.crc32(data) >>> 0;

    // LFH (30 bytes + name) with bit 3 set and crc/sizes = 0
    const lfh = Buffer.alloc(30 + nameBuf.length);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4); // version needed
    lfh.writeUInt16LE(0x0808, 6); // UTF-8 + bit 3 (data descriptor)
    lfh.writeUInt16LE(8, 8); // DEFLATE
    lfh.writeUInt16LE(0, 10);
    lfh.writeUInt16LE(0, 12);
    lfh.writeUInt32LE(0, 14); // crc32 = 0 in LFH
    lfh.writeUInt32LE(0, 18); // compressedSize = 0 in LFH
    lfh.writeUInt32LE(0, 22); // uncompressedSize = 0 in LFH
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28);
    nameBuf.copy(lfh, 30);

    // 16-byte Data Descriptor after compressed data
    const dd = Buffer.alloc(16);
    dd.writeUInt32LE(0x08074b50, 0);
    dd.writeUInt32LE(crc, 4);
    dd.writeUInt32LE(compressed.length, 8);
    dd.writeUInt32LE(data.length, 12);

    const cdh = Buffer.alloc(46 + nameBuf.length);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt16LE(0x0808, 8);
    cdh.writeUInt16LE(8, 10);
    cdh.writeUInt16LE(0, 12);
    cdh.writeUInt16LE(0, 14);
    cdh.writeUInt32LE(crc, 16);
    cdh.writeUInt32LE(compressed.length, 20);
    cdh.writeUInt32LE(data.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30);
    cdh.writeUInt16LE(0, 32);
    cdh.writeUInt16LE(0, 34);
    cdh.writeUInt16LE(0, 36);
    cdh.writeUInt32LE(0, 38);
    cdh.writeUInt32LE(offset, 42);
    nameBuf.copy(cdh, 46);

    localParts.push(lfh, compressed, dd);
    cdParts.push(cdh);
    offset += lfh.length + compressed.length + dd.length;
  }

  const cdBuf = Buffer.concat(cdParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, cdBuf, eocd]);
}

test('planZipBatches 与 buildZipBatch 将大包按上限拆分并把 *.toc 置于最后一批且逐字节一致', async () => {
  const zip = new JSZip();
  const originalFiles = new Map();

  const tocMain = '## Interface: 11503\n## Version: v0.8.14\nCore.lua\n';
  const tocCamelot = '## Interface: 11503\n## Version: v0.8.14\nCore.lua\n';
  zip.file('OpenMap/OpenMap.toc', tocMain);
  originalFiles.set('OpenMap/OpenMap.toc', Buffer.from(tocMain, 'utf8'));

  // 故意把另一个 .toc 放在最前面，验证拆分后仍被挪到最后一批
  zip.file('OpenMap/OpenMap_Camelot.toc', tocCamelot);
  originalFiles.set('OpenMap/OpenMap_Camelot.toc', Buffer.from(tocCamelot, 'utf8'));

  for (let i = 0; i < 8; i++) {
    const name = i % 2 === 0 ? `OpenMap/Media/Textures/tile_${i}.tga` : `OpenMap/中文目录/说明_${i}.dat`;
    const payload = makeBytes(6000, i + 1);
    zip.file(name, payload, { compression: i % 3 === 0 ? 'STORE' : 'DEFLATE' });
    originalFiles.set(name, payload);
  }

  const fullZip = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  const maxBatchBytes = 14000;
  const plan = planZipBatches(fullZip, maxBatchBytes);

  assert.ok(plan, '应当生成拆分计划');
  assert.ok(plan.batches.length >= 3, `应当至少拆成 3 批，实际为 ${plan.batches.length}`);

  const extracted = new Map();
  for (let bIdx = 0; bIdx < plan.batches.length; bIdx++) {
    const batch = plan.batches[bIdx];
    assert.ok(batch.estimatedBytes <= maxBatchBytes, `第 ${bIdx + 1} 批超出上限`);

    const batchBytes = buildZipBatch(fullZip, batch);
    assert.equal(batchBytes.byteLength, batch.estimatedBytes);
    assert.ok(batchBytes.buffer instanceof ArrayBuffer);

    const parsed = await JSZip.loadAsync(batchBytes, { checkCRC32: true });
    const entryNames = Object.keys(parsed.files).filter((p) => !parsed.files[p].dir);
    if (bIdx < plan.batches.length - 1) {
      assert.ok(
        entryNames.every((n) => !n.toLowerCase().endsWith('.toc')),
        `非末尾批次不应包含 .toc：${entryNames.join(', ')}`
      );
    } else {
      assert.ok(entryNames.includes('OpenMap/OpenMap.toc'));
      assert.ok(entryNames.includes('OpenMap/OpenMap_Camelot.toc'));
    }

    for (const entryName of entryNames) {
      const content = Buffer.from(await parsed.file(entryName).async('uint8array'));
      extracted.set(entryName, content);
    }
  }

  assert.equal(extracted.size, originalFiles.size);
  for (const [name, expected] of originalFiles) {
    assert.ok(extracted.has(name), `缺少文件 ${name}`);
    assert.ok(extracted.get(name).equals(expected), `文件内容不一致: ${name}`);
  }
});

test('buildZipBatch 正确处理携带 bit 3 Data Descriptor 的 ZIP 条目', async () => {
  const files = [
    { name: 'Addon/DataA.bin', data: makeBytes(5000, 11) },
    { name: 'Addon/DataB.bin', data: makeBytes(5000, 29) },
    { name: 'Addon/Addon.toc', data: Buffer.from('## Version: v1.2.3\n', 'utf8') },
  ];
  const rawZip = new Uint8Array(buildBit3Zip(files));
  const plan = planZipBatches(rawZip, 6200);
  assert.ok(plan);
  assert.ok(plan.batches.length >= 2);

  const recovered = new Map();
  for (const batch of plan.batches) {
    const batchBytes = buildZipBatch(rawZip, batch);
    const view = new DataView(batchBytes.buffer, batchBytes.byteOffset, batchBytes.byteLength);
    // 验证第一条 LFH 的 bit 3 已被清除
    assert.equal(view.getUint16(6, true) & 0x08, 0);

    const zip = await JSZip.loadAsync(batchBytes, { checkCRC32: true });
    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      recovered.set(name, Buffer.from(await entry.async('uint8array')));
    }
  }

  assert.equal(recovered.size, files.length);
  for (const f of files) {
    assert.ok(recovered.get(f.name).equals(f.data));
  }
});

test('planZipBatches 对单个超大条目、小包、ZIP64 与损坏输入表现符合预期', async () => {
  const zip = new JSZip();
  zip.file('Big/big.bin', makeBytes(12000, 7));
  zip.file('Big/Big.toc', '## Version: 1.0\n');
  const fullZip = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });

  // maxBatchBytes 小于单个 Big/big.bin 时，单个超大条目仍应独立成批而不死循环（只要未超过单请求硬上限）
  // JSZip 默认会生成目录条目 "Big/"，因此共 3 批：Big/ -> Big/big.bin -> Big/Big.toc
  const oversizedPlan = planZipBatches(fullZip, 4096, 16384);
  assert.ok(oversizedPlan);
  const allBatchNames = oversizedPlan.batches.map((b) => b.entries.map((e) => e.fileName));
  assert.ok(oversizedPlan.batches.some((b) => b.entries.length === 1 && b.entries[0].fileName === 'Big/big.bin'));
  assert.deepEqual(allBatchNames[allBatchNames.length - 1], ['Big/Big.toc']);

  // 单个条目超出目标助手单请求硬上限时，必须在规划阶段直接抛错拒绝（避免前序批次写入后才失败）
  assert.throws(
    () => planZipBatches(fullZip, 4096, 8192),
    /Big\/big\.bin.*单次请求上限/
  );

  // 无效输入返回 null
  assert.equal(planZipBatches(new Uint8Array(0)), null);
  assert.equal(planZipBatches(new Uint8Array([1, 2, 3, 4])), null);
  assert.equal(planZipBatches(fullZip.subarray(0, fullZip.byteLength - 10)), null);

  // 伪造 ZIP64 sentinel (totalEntries = 0xffff) 应拒绝拆分并返回 null
  const zip64Mock = new Uint8Array(fullZip);
  const view = new DataView(zip64Mock.buffer);
  view.setUint16(zip64Mock.byteLength - 12, 0xffff, true);
  assert.equal(planZipBatches(zip64Mock, 4096), null);
});

test('planZipBatches 在最后一个普通批次仅能容纳部分 .toc 时将全部 .toc 整体置入独立末批', async () => {
  const zip = new JSZip();
  zip.file('Multi/data.bin', makeBytes(3500, 3), { compression: 'STORE' });
  zip.file('Multi/Multi_Forever.toc', '## Version: 1.0\n' + '#'.repeat(300));
  zip.file('Multi/Multi_Camelot.toc', '## Version: 1.0\n' + '#'.repeat(300));

  const fullZip = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
  const planAll = planZipBatches(fullZip, 100000);
  assert.ok(planAll);
  const entries = planAll.batches[0].entries;
  const dataEntry = entries.find((e) => e.fileName === 'Multi/data.bin');
  const toc1 = entries.find((e) => e.fileName === 'Multi/Multi_Forever.toc');
  const toc2 = entries.find((e) => e.fileName === 'Multi/Multi_Camelot.toc');
  assert.ok(dataEntry && toc1 && toc2);

  const regularBytes =
    22 +
    entries
      .filter((e) => !e.fileName.toLowerCase().endsWith('.toc'))
      .reduce((sum, e) => sum + e.lfhSize + e.compressedSize + e.cdSize, 0);
  const toc1Bytes = toc1.lfhSize + toc1.compressedSize + toc1.cdSize;
  const toc2Bytes = toc2.lfhSize + toc2.compressedSize + toc2.cdSize;
  // 上限足够放全部普通条目 + 第一个 .toc，但放不下全部普通条目 + 两个 .toc
  const tightLimit = regularBytes + toc1Bytes + 10;
  assert.ok(regularBytes + toc1Bytes <= tightLimit);
  assert.ok(regularBytes + toc1Bytes + toc2Bytes > tightLimit);

  const tightPlan = planZipBatches(fullZip, tightLimit);
  assert.ok(tightPlan);
  assert.equal(tightPlan.batches.length, 2);
  assert.deepEqual(
    tightPlan.batches[1].entries.map((e) => e.fileName).sort(),
    ['Multi/Multi_Camelot.toc', 'Multi/Multi_Forever.toc']
  );
});

test('planZipBatches 在 maxBatchBytes 高于 maxSingleBatchBytes 时按较小的硬上限拆批并控制 TOC 合并', async () => {
  const zip = new JSZip();
  zip.file('Cap/partA.bin', makeBytes(3000, 17), { compression: 'STORE' });
  zip.file('Cap/partB.bin', makeBytes(3000, 23), { compression: 'STORE' });
  zip.file('Cap/Cap.toc', '## Version: 1.0\n' + '#'.repeat(1600));

  const fullZip = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
  const hardLimit = 4500;
  // 故意传入高于 hardLimit 的 maxBatchBytes (10000)，确保累计大小与 TOC 合并均受 hardLimit 约束
  const plan = planZipBatches(fullZip, 10000, hardLimit);
  assert.ok(plan);
  assert.equal(plan.batches.length, 3);
  for (const batch of plan.batches) {
    assert.ok(
      batch.estimatedBytes <= hardLimit,
      `批次大小 ${batch.estimatedBytes} 不应超过硬上限 ${hardLimit}`
    );
  }
  assert.deepEqual(
    plan.batches[plan.batches.length - 1].entries.map((e) => e.fileName),
    ['Cap/Cap.toc']
  );
});
