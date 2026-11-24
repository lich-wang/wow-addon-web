// 内容定义分块（CDC）与分块清单的单元测试
// 运行：npm run test:chunks  或  node --test scripts/openmap-chunks.test.mjs
//
// 这些测试守住的是「增量更新能不能成立」的前提：
// 1. 分块必须能无损拼回原始字节（否则装出来的包是坏的）；
// 2. 同一段字节在不同位置必须切出同一组块（否则升级会退化成全量下载）；
// 3. 清单里的 chunks / parts 必须自洽（否则旧客户端会拼错包）。
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  CHUNK_MAX_BYTES,
  CHUNK_MIN_BYTES,
  buildChunkManifest,
  chunkBuffer,
  sha256Hex,
  splitChunkRanges,
} from './openmap-chunks.js';

/**
 * 造一段伪随机但可复现的字节
 * @param {number} length 长度
 * @param {number} seed 随机种子
 * @returns {Uint8Array}
 */
function makeBytes(length, seed = 1) {
  const out = new Uint8Array(length);
  let state = seed >>> 0 || 1;
  for (let i = 0; i < length; i++) {
    // xorshift32，保证跨平台每次生成相同内容
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    out[i] = state & 0xff;
  }
  return out;
}

/**
 * 按块边界把内容拼回去
 * @param {Uint8Array} source 原始内容
 * @returns {Buffer} 拼接结果
 */
function reassemble(source) {
  const pieces = chunkBuffer(source).map(({ offset, size }) => Buffer.from(source.subarray(offset, offset + size)));
  return Buffer.concat(pieces);
}

test('分块可无损拼回原始内容', () => {
  const source = makeBytes(CHUNK_MAX_BYTES * 3 + 12_345);
  assert.ok(reassemble(source).equals(Buffer.from(source)));
});

test('空输入不产生分块', () => {
  assert.deepEqual(splitChunkRanges(new Uint8Array(0)), []);
});

test('分块长度都在 [min, max] 区间内（末块除外）', () => {
  const source = makeBytes(CHUNK_MAX_BYTES * 4);
  const ranges = splitChunkRanges(source);
  assert.ok(ranges.length > 0);
  for (const range of ranges.slice(0, -1)) {
    assert.ok(range.length >= CHUNK_MIN_BYTES, `块长 ${range.length} 小于下限`);
    assert.ok(range.length <= CHUNK_MAX_BYTES, `块长 ${range.length} 超过上限`);
  }
  // 相邻块必须首尾相接，不能有空洞或重叠
  for (let i = 1; i < ranges.length; i++) {
    assert.equal(ranges[i].offset, ranges[i - 1].offset + ranges[i - 1].length);
  }
});

test('在内容中间插入一段字节，其后的大部分块仍然复用', () => {
  const before = makeBytes(CHUNK_MAX_BYTES * 8, 7);
  const inserted = makeBytes(4096, 99);
  const after = new Uint8Array(before.length + inserted.length);
  const cut = Math.floor(before.length / 2);
  after.set(before.subarray(0, cut), 0);
  after.set(inserted, cut);
  after.set(before.subarray(cut), cut + inserted.length);

  const hashesBefore = new Set(chunkBuffer(before).map((c) => c.sha256));
  const chunksAfter = chunkBuffer(after);
  const reused = chunksAfter.filter((c) => hashesBefore.has(c.sha256)).length;

  // 插入点附近会有一两个块变化，但远不该是全部
  assert.ok(
    reused >= chunksAfter.length - 3,
    `只应影响插入点附近的块，实际复用 ${reused}/${chunksAfter.length}`
  );
  assert.ok(reassemble(after).equals(Buffer.from(after)), '插入后的内容也必须能无损拼回');
});

test('相同内容产生完全相同的分块（跨构建可复现）', () => {
  const a = chunkBuffer(makeBytes(CHUNK_MAX_BYTES * 2, 42));
  const b = chunkBuffer(makeBytes(CHUNK_MAX_BYTES * 2, 42));
  assert.deepEqual(
    a.map((c) => c.sha256),
    b.map((c) => c.sha256)
  );
});

test('内容改动一个字节会改变所在块的摘要，但总长不变', () => {
  const source = makeBytes(CHUNK_MAX_BYTES * 2, 5);
  const mutated = source.slice();
  mutated[Math.floor(mutated.length / 2)] ^= 0xff;

  const before = chunkBuffer(source);
  const after = chunkBuffer(mutated);
  const changed = after.filter((c, i) => c.sha256 !== before[i]?.sha256).length;

  assert.ok(changed >= 1, '至少一块的摘要必须变化');
  assert.equal(
    after.reduce((sum, c) => sum + c.size, 0),
    source.length,
    '分块总长必须等于原始长度'
  );
  assert.ok(reassemble(mutated).equals(Buffer.from(mutated)));
});

test('清单包含整包摘要、块表与顺序拼接列表', () => {
  const source = makeBytes(CHUNK_MAX_BYTES * 2 + 1000, 11);
  const manifest = buildChunkManifest(source, { version: 'v0.8.13', source: 'https://example.test/x.zip' });
  const chunks = chunkBuffer(source);

  assert.equal(manifest.format, 2);
  assert.equal(manifest.version, 'v0.8.13');
  assert.equal(manifest.totalSize, source.length);
  assert.equal(manifest.sha256, crypto.createHash('sha256').update(source).digest('hex'));
  assert.equal(manifest.chunking.algorithm, 'gear-cdc-v1');

  // parts 是「按顺序拼接」的完整列表，允许同一块重复出现
  assert.equal(manifest.parts.length, chunks.length);
  for (const [i, part] of manifest.parts.entries()) {
    assert.equal(part, `chunks/${chunks[i].sha256}.bin`);
  }

  // chunks 是去重后的块表
  const uniqueShas = new Set(chunks.map((c) => c.sha256));
  assert.equal(manifest.chunks.length, uniqueShas.size);
  const sizeBySha = new Map(manifest.chunks.map((c) => [c.sha256, c.size]));
  for (const chunk of chunks) {
    assert.equal(sizeBySha.get(chunk.sha256), chunk.size);
  }
});

test('清单里全部块的长度累加等于 totalSize', () => {
  const source = makeBytes(CHUNK_MAX_BYTES * 3 + 7, 3);
  const manifest = buildChunkManifest(source);
  const sizeBySha = new Map(manifest.chunks.map((c) => [c.sha256, c.size]));
  const sum = manifest.parts.reduce((total, part) => {
    const sha = part.slice('chunks/'.length, -'.bin'.length);
    return total + sizeBySha.get(sha);
  }, 0);
  assert.equal(sum, manifest.totalSize);
});

test('sha256Hex 与 node:crypto 一致', () => {
  const data = makeBytes(1234, 8);
  assert.equal(sha256Hex(data), crypto.createHash('sha256').update(data).digest('hex'));
});
