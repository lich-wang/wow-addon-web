/**
 * 零重压缩 ZIP 分批拆分工具。
 *
 * 背景：OpenMap v0.8.14 体积已达 227.4 MiB，超过旧版桌面端/本地助手（≤ v1.0.8）的
 * 200 MiB 单次请求体上限，直接 POST 会在连接重置时导致浏览器抛出 `Failed to fetch`。
 * 本模块在不解压、不重新压缩的前提下，直接切片 PKZIP Local File Header、原始压缩字节与
 * Central Directory，按批组装成多个独立合法的子 ZIP（默认每批 ≤ 96 MiB），依次传给本地助手解压。
 */

/** 默认单批上限：96 MiB，远低于旧版 200 MiB / 新版 256 MiB 限制，也大幅降低峰值拷贝内存 */
export const DEFAULT_ZIP_BATCH_MAX_BYTES = 96 * 1024 * 1024;
/** 旧版桌面端/本地助手单次请求硬上限（200 MiB） */
export const LEGACY_AGENT_BODY_LIMIT_BYTES = 200 * 1024 * 1024;
/** 新版桌面端/本地助手（v1.0.9+）单次请求硬上限（256 MiB） */
export const CURRENT_AGENT_BODY_LIMIT_BYTES = 256 * 1024 * 1024;

const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_EOCD_LOCATOR_SIGNATURE = 0x07064b50;
const CD_SIGNATURE = 0x02014b50;
const LFH_SIGNATURE = 0x04034b50;

const EOCD_MIN_SIZE = 22;
const MAX_ZIP_COMMENT_BYTES = 0xffff;
const MAX_BATCH_ENTRIES = 0xffff - 1;
const CD_FIXED_SIZE = 46;
const LFH_FIXED_SIZE = 30;
const DATA_DESCRIPTOR_FLAG = 0x08;

export interface ZipEntrySlice {
  fileName: string;
  isToc: boolean;
  localHeaderOffset: number;
  lfhSize: number;
  compressedSize: number;
  uncompressedSize: number;
  crc32: number;
  flags: number;
  cdOffset: number;
  cdSize: number;
}

export interface ZipBatchPlan {
  entries: ZipEntrySlice[];
  estimatedBytes: number;
}

export interface ZipSplitPlan {
  batches: ZipBatchPlan[];
  totalEntries: number;
}

function getEntryBatchBytes(entry: ZipEntrySlice): number {
  return entry.lfhSize + entry.compressedSize + entry.cdSize;
}

function findEocdOffset(zipBytes: Uint8Array, view: DataView): number {
  const len = zipBytes.byteLength;
  if (len < EOCD_MIN_SIZE) return -1;
  const minOffset = Math.max(0, len - EOCD_MIN_SIZE - MAX_ZIP_COMMENT_BYTES);
  for (let pos = len - EOCD_MIN_SIZE; pos >= minOffset; pos--) {
    if (view.getUint32(pos, true) !== EOCD_SIGNATURE) continue;
    const commentLen = view.getUint16(pos + 20, true);
    if (pos + EOCD_MIN_SIZE + commentLen === len) {
      return pos;
    }
  }
  return -1;
}

/**
 * 解析标准 PKZIP 并规划按批拆分的方案。
 *
 * - 所有 `*.toc` 文件统一放到最后一批（若放不下则单独追加在末尾），确保只有全部数据文件
 *   成功解压写入后才更新本地版本号，避免中途中断留下「新版本号 + 半套旧文件」。
 * - 若提供了 `maxSingleBatchBytes`（如目标助手单请求硬上限 200 MiB / 256 MiB），
 *   当单个条目加上 EOCD 已超过该硬上限时在上传任何批次前直接抛错，避免前序批次写入后才失败。
 * - 多分卷、ZIP64、空包或结构异常时返回 `null`，由调用方安全回退单包上传。
 */
export function planZipBatches(
  zipBytes: Uint8Array,
  maxBatchBytes: number = DEFAULT_ZIP_BATCH_MAX_BYTES,
  maxSingleBatchBytes?: number
): ZipSplitPlan | null {
  if (!(zipBytes instanceof Uint8Array) || zipBytes.byteLength < EOCD_MIN_SIZE) {
    return null;
  }
  if (!Number.isFinite(maxBatchBytes) || maxBatchBytes <= EOCD_MIN_SIZE) {
    return null;
  }

  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
  const eocdPos = findEocdOffset(zipBytes, view);
  if (eocdPos < 0) return null;

  // 若前面紧邻 ZIP64 EOCD Locator，则按 ZIP64 拒绝拆分，交由原路径处理
  if (eocdPos >= 20 && view.getUint32(eocdPos - 20, true) === ZIP64_EOCD_LOCATOR_SIGNATURE) {
    return null;
  }

  const diskNumber = view.getUint16(eocdPos + 4, true);
  const cdStartDisk = view.getUint16(eocdPos + 6, true);
  const diskEntries = view.getUint16(eocdPos + 8, true);
  const totalEntries = view.getUint16(eocdPos + 10, true);
  const cdSize = view.getUint32(eocdPos + 12, true);
  const cdOffset = view.getUint32(eocdPos + 16, true);

  if (diskNumber !== 0 || cdStartDisk !== 0 || diskEntries !== totalEntries) {
    return null;
  }
  if (totalEntries === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    return null;
  }
  if (totalEntries === 0 || cdSize === 0 || cdOffset + cdSize > eocdPos) {
    return null;
  }

  const cdEnd = cdOffset + cdSize;
  const decoder = new TextDecoder('utf-8');
  const regularEntries: ZipEntrySlice[] = [];
  const tocEntries: ZipEntrySlice[] = [];

  let cursor = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (cursor + CD_FIXED_SIZE > cdEnd) return null;
    if (view.getUint32(cursor, true) !== CD_SIGNATURE) return null;

    const flags = view.getUint16(cursor + 8, true);
    const crc32 = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLen = view.getUint16(cursor + 28, true);
    const extraLen = view.getUint16(cursor + 30, true);
    const commentLen = view.getUint16(cursor + 32, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);

    if (
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localHeaderOffset === 0xffffffff
    ) {
      return null;
    }

    const entryCdSize = CD_FIXED_SIZE + nameLen + extraLen + commentLen;
    if (cursor + entryCdSize > cdEnd) return null;

    if (localHeaderOffset + LFH_FIXED_SIZE > eocdPos) return null;
    if (view.getUint32(localHeaderOffset, true) !== LFH_SIGNATURE) return null;

    const lfhNameLen = view.getUint16(localHeaderOffset + 26, true);
    const lfhExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const lfhSize = LFH_FIXED_SIZE + lfhNameLen + lfhExtraLen;
    const dataEnd = localHeaderOffset + lfhSize + compressedSize;

    // 数据区不能越界或侵入 Central Directory / EOCD
    if (dataEnd > eocdPos || (dataEnd > cdOffset && localHeaderOffset < cdEnd)) {
      return null;
    }

    const fileName = decoder.decode(zipBytes.subarray(cursor + CD_FIXED_SIZE, cursor + CD_FIXED_SIZE + nameLen));
    const slice: ZipEntrySlice = {
      fileName,
      isToc: /\.toc$/i.test(fileName),
      localHeaderOffset,
      lfhSize,
      compressedSize,
      uncompressedSize,
      crc32,
      flags,
      cdOffset: cursor,
      cdSize: entryCdSize,
    };

    if (slice.isToc) {
      tocEntries.push(slice);
    } else {
      regularEntries.push(slice);
    }
    cursor += entryCdSize;
  }

  if (cursor !== cdEnd) {
    return null;
  }

  const hasHardLimit =
    maxSingleBatchBytes !== undefined &&
    Number.isFinite(maxSingleBatchBytes) &&
    maxSingleBatchBytes > 0;
  if (hasHardLimit) {
    for (const entry of [...regularEntries, ...tocEntries]) {
      const singleBatchBytes = EOCD_MIN_SIZE + getEntryBatchBytes(entry);
      if (singleBatchBytes > maxSingleBatchBytes) {
        const entryMb = (singleBatchBytes / (1024 * 1024)).toFixed(1);
        const limitMb = Math.round(maxSingleBatchBytes / (1024 * 1024));
        throw new Error(
          `单个文件 "${entry.fileName}"（约 ${entryMb} MB）超过了当前本地助手的单次请求上限（${limitMb} MB），无法分批上传，请升级至最新版桌面客户端后重试。`
        );
      }
    }
  }

  const effectiveMaxBatchBytes = hasHardLimit
    ? Math.min(maxBatchBytes, maxSingleBatchBytes)
    : maxBatchBytes;

  const batches: ZipBatchPlan[] = [];
  const appendEntries = (entries: ZipEntrySlice[], tryReuseLastBatch: boolean) => {
    let currentEntries: ZipEntrySlice[] = [];
    let currentBytes = EOCD_MIN_SIZE;

    if (tryReuseLastBatch && batches.length > 0) {
      const last = batches.pop()!;
      currentEntries = last.entries;
      currentBytes = last.estimatedBytes;
    }

    for (const entry of entries) {
      const entryBytes = getEntryBatchBytes(entry);
      const wouldExceedSize = currentBytes + entryBytes > effectiveMaxBatchBytes;
      const wouldExceedCount = currentEntries.length >= MAX_BATCH_ENTRIES;
      if (currentEntries.length > 0 && (wouldExceedSize || wouldExceedCount)) {
        batches.push({ entries: currentEntries, estimatedBytes: currentBytes });
        currentEntries = [];
        currentBytes = EOCD_MIN_SIZE;
      }
      currentEntries.push(entry);
      currentBytes += entryBytes;
    }

    if (currentEntries.length > 0) {
      batches.push({ entries: currentEntries, estimatedBytes: currentBytes });
    }
  };

  appendEntries(regularEntries, false);
  if (tocEntries.length > 0) {
    const tocTotalBytes = tocEntries.reduce((sum, entry) => sum + getEntryBatchBytes(entry), 0);
    const lastBatch = batches[batches.length - 1];
    const canShareLastBatch =
      lastBatch !== undefined &&
      lastBatch.estimatedBytes + tocTotalBytes <= effectiveMaxBatchBytes &&
      lastBatch.entries.length + tocEntries.length <= MAX_BATCH_ENTRIES;
    appendEntries(tocEntries, canShareLastBatch);
  }

  if (batches.length === 0) return null;
  return { batches, totalEntries };
}

/**
 * 按批次计划零重压缩生成单个合法 ZIP 字节数组。
 *
 * 显式分配独立的 `ArrayBuffer`，确保返回的 `Uint8Array<ArrayBuffer>` 可直接用于 `new Blob([bytes])`。
 */
export function buildZipBatch(zipBytes: Uint8Array, batch: ZipBatchPlan): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(batch.estimatedBytes));
  const outView = new DataView(out.buffer);
  const newLocalOffsets: number[] = new Array(batch.entries.length);

  let writePos = 0;
  for (let i = 0; i < batch.entries.length; i++) {
    const entry = batch.entries[i];
    const span = entry.lfhSize + entry.compressedSize;
    newLocalOffsets[i] = writePos;
    out.set(zipBytes.subarray(entry.localHeaderOffset, entry.localHeaderOffset + span), writePos);

    // 若原条目启用了 bit 3 (Data Descriptor)，但输出子包不追加 Data Descriptor，
    // 必须清除 LFH 的 bit 3 并将 CD 中的 crc32/压缩长度/解压长度补写回 LFH。
    if ((entry.flags & DATA_DESCRIPTOR_FLAG) !== 0) {
      const lfhFlags = outView.getUint16(writePos + 6, true) & ~DATA_DESCRIPTOR_FLAG;
      outView.setUint16(writePos + 6, lfhFlags, true);
      outView.setUint32(writePos + 14, entry.crc32, true);
      outView.setUint32(writePos + 18, entry.compressedSize, true);
      outView.setUint32(writePos + 22, entry.uncompressedSize, true);
    }

    writePos += span;
  }

  const cdOffset = writePos;
  for (let i = 0; i < batch.entries.length; i++) {
    const entry = batch.entries[i];
    out.set(zipBytes.subarray(entry.cdOffset, entry.cdOffset + entry.cdSize), writePos);

    if ((entry.flags & DATA_DESCRIPTOR_FLAG) !== 0) {
      const cdFlags = outView.getUint16(writePos + 8, true) & ~DATA_DESCRIPTOR_FLAG;
      outView.setUint16(writePos + 8, cdFlags, true);
    }
    outView.setUint32(writePos + 42, newLocalOffsets[i], true);
    writePos += entry.cdSize;
  }

  const cdSize = writePos - cdOffset;
  outView.setUint32(writePos, EOCD_SIGNATURE, true);
  outView.setUint16(writePos + 4, 0, true);
  outView.setUint16(writePos + 6, 0, true);
  outView.setUint16(writePos + 8, batch.entries.length, true);
  outView.setUint16(writePos + 10, batch.entries.length, true);
  outView.setUint32(writePos + 12, cdSize, true);
  outView.setUint32(writePos + 16, cdOffset, true);
  outView.setUint16(writePos + 20, 0, true);

  return out;
}
