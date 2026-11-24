/**
 * OpenMap 的内容定义分块（CDC, Content-Defined Chunking）。
 *
 * 背景：OpenMap 的 Forever 包 198.6 MiB，是唯一超过 Cloudflare Pages 25 MiB
 * 单文件上限的插件。早先按「固定 20 MiB 字节偏移」切片，只要包内任意位置有
 * 1 个字节变化，后面所有分片的边界都会错位——实测 v0.8.12 → v0.8.13 只改了
 * 17 个文件 / 1.07 MiB，10 个分片却全部要重下（100%）。
 *
 * 这里改用滚动哈希（Gear）在内容里找边界：边界由数据本身决定，插入/删除
 * 字节只影响其周围的一两个块，其余块的哈希与 URL 完全不变。分块再按内容
 * 寻址存放（blobs/<sha256>.bin），于是升级时客户端只需要下载真正变化的块。
 *
 * 实测（v0.8.12 → v0.8.13，平均 512 KiB 块）：324 块里只需重下 1.26 MiB（0.6%）。
 */

import crypto from 'node:crypto';

/** 平均块长 2^19 = 512 KiB：块数与增量收益的平衡点 */
export const CHUNK_MASK_BITS = 19;
/** 最小块长 128 KiB：避免出现大量碎片块，撑爆 Pages 的文件数量预算 */
export const CHUNK_MIN_BYTES = 128 * 1024;
/** 最大块长 2 MiB：无边界数据（如整片纹理）时强制切开，仍远低于 Pages 25 MiB 单文件上限 */
export const CHUNK_MAX_BYTES = 2 * 1024 * 1024;

/** 分块算法标识，写进清单以便将来换算法时客户端能识别 */
export const CHUNKING_ALGORITHM = 'gear-cdc-v1';

/**
 * 构造 Gear 滚动哈希表。
 * 用固定种子的 xorshift 生成，保证构建机、CI、任何未来实现都得到同一张表——
 * 表一变，所有块的边界都会变，增量收益直接归零。
 * @returns {Uint32Array} 256 项查找表
 */
function buildGearTable() {
  const table = new Uint32Array(256);
  let state = 0x9e3779b9;
  for (let i = 0; i < 256; i++) {
    // xorshift32
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    table[i] = state;
  }
  return table;
}

const GEAR = buildGearTable();
const CHUNK_MASK = (1 << CHUNK_MASK_BITS) - 1;

/**
 * 把一段字节切成内容定义块。
 * 不修改输入，只返回每块的偏移与长度；调用方自行决定如何取内容。
 * @param {Uint8Array} buffer 完整内容（开放地图包约 198.6 MiB）
 * @returns {{ offset: number, length: number }[]} 按顺序排列的块边界
 */
export function splitChunkRanges(buffer) {
  const ranges = [];
  let start = 0;
  let hash = 0;

  for (let i = 0; i < buffer.length; i++) {
    hash = ((hash << 1) + GEAR[buffer[i]]) >>> 0;
    const length = i - start + 1;
    if (length >= CHUNK_MAX_BYTES || (length >= CHUNK_MIN_BYTES && (hash & CHUNK_MASK) === 0)) {
      ranges.push({ offset: start, length });
      start = i + 1;
      hash = 0;
    }
  }

  // 结尾不足最小块长的部分并入最后一块；空输入不产生块
  if (start < buffer.length) {
    ranges.push({ offset: start, length: buffer.length - start });
  }
  return ranges;
}

/**
 * 计算一段字节的 sha256 小写十六进制
 * @param {Uint8Array} data
 * @returns {string}
 */
export function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * 把完整包切成内容定义块并算出每块的摘要。
 * 同一个字节序列永远得到同一组块（边界稳定、摘要稳定），这是增量更新的前提。
 * @param {Uint8Array} buffer 完整 zip 内容
 * @returns {{ sha256: string, size: number, offset: number }[]} 按顺序排列的块
 */
export function chunkBuffer(buffer) {
  return splitChunkRanges(buffer).map(({ offset, length }) => {
    const digest = sha256Hex(buffer.subarray(offset, offset + length));
    return { sha256: digest, size: length, offset };
  });
}

/**
 * 生成分块清单（format 2）。
 *
 * 同时写两份等价信息：
 * - `chunks`：去重后的「地址 → 长度」表，新版客户端据此按需下载（同一内容只存一份）；
 * - `parts`：**按拼接顺序**排列的完整路径列表（允许重复），旧版桌面客户端只认这个字段，
 *   顺序拼接即为完整包。两条路径都指向内容寻址的 blob，所以新旧客户端命中同一份缓存。
 * @param {Uint8Array} buffer 完整 zip 内容
 * @param {{ version?: string, source?: string }} [meta] 版本号与上游溯源地址
 * @returns {object} 可直接 JSON.stringify 的清单
 */
export function buildChunkManifest(buffer, meta = {}) {
  const chunks = chunkBuffer(buffer);
  const unique = new Map();
  for (const { sha256, size } of chunks) {
    if (!unique.has(sha256)) unique.set(sha256, size);
  }

  return {
    version: meta.version,
    format: 2,
    totalSize: buffer.length,
    sha256: sha256Hex(buffer),
    chunking: {
      algorithm: CHUNKING_ALGORITHM,
      avgBytes: 1 << CHUNK_MASK_BITS,
      minBytes: CHUNK_MIN_BYTES,
      maxBytes: CHUNK_MAX_BYTES,
      maskBits: CHUNK_MASK_BITS,
    },
    chunks: Array.from(unique, ([sha256, size]) => ({ sha256, size })),
    // 旧客户端只认 parts：按顺序拼接（可能含重复的同一块）即为完整包
    parts: chunks.map(({ sha256 }) => `chunks/${sha256}.bin`),
    source: meta.source,
  };
}
