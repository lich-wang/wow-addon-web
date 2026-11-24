/**
 * 大文件流式下载工具。
 *
 * 背景：仅 OpenMap 的 Forever 包就有 198 MB（208,253,793 B），而原来的
 * `response.arrayBuffer()` 既不报进度、也没有超时，代理节点假死时界面会无限等待。
 * 这里统一提供：真实进度回调、空闲超时、断流后续传一次。
 */

/** 连续这么久没有收到任何字节就判定连接已死，主动断开以便重试或换源 */
export const DEFAULT_IDLE_TIMEOUT_MS = 45_000;

export interface DownloadOptions {
  /** 空闲超时（毫秒），默认 45 秒 */
  idleTimeoutMs?: number;
  /** 断流后的续传重试次数，默认 1 次 */
  maxRetries?: number;
  /** 每收到一段数据就回调一次（已接收字节数、总字节数；总长度未知时为 0） */
  onChunk?: (loaded: number, total: number) => void;
  /**
   * fetch 缓存策略。默认 no-store（大包不进浏览器 HTTP 缓存，避免和断点缓存重复占盘）；
   * 分块走自己的 Cache Storage 断点缓存，因此这里不需要 HTTP 缓存。
   */
  cache?: RequestCache;
  /**
   * 命中分块缓存时回调（已复用块数、总块数），用于在界面上提示「从断点继续」
   */
  onCacheHit?: (cachedParts: number, totalParts: number) => void;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

/**
 * 流式下载并返回完整内容。
 * - 服务器支持 Range 时，中途断开会带 If-Range 从已下载位置续传；
 * - 服务器忽略 Range / 校验器失效（返回 200）时，自动清空缓冲从头下载；
 * - 超过 idleTimeoutMs 没有任何数据则中断并抛出，由调用方决定换源；
 * - 不跟随跳转（避免清单/包地址被重定向到站外）。
 */
export async function downloadWithProgress(
  url: string,
  options: DownloadOptions = {}
): Promise<ArrayBuffer> {
  const {
    idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
    maxRetries = 1,
    onChunk,
    cache = 'no-store',
  } = options;

  let loaded = 0;
  let total = 0;
  let buffer: Uint8Array | null = null;
  let lastError: unknown = null;
  /** 强校验器（ETag/Last-Modified）：续传时用 If-Range 保证拼的是同一份内容 */
  let validator: string | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const armIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => controller.abort(), idleTimeoutMs);
    };

    try {
      const resumeFrom = loaded;
      const headers: Record<string, string> = {};
      if (resumeFrom > 0) {
        headers.Range = `bytes=${resumeFrom}-`;
        if (validator) headers['If-Range'] = validator;
      }
      armIdle();
      const response = await fetch(url, {
        signal: controller.signal,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        cache,
        // 静态产物不应跳转：跳转可能把请求带到站外，而调用方的来源校验只覆盖第一跳
        redirect: 'manual',
      });
      if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
        throw new Error('下载地址发生跳转，已拒绝跟随');
      }

      if (!response.ok) {
        controller.abort(); // 放弃这个响应，别把连接挂着
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        controller.abort();
        throw new Error('收到 HTML 页面而不是插件压缩包');
      }

      if (response.status === 206) {
        const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range') || '');
        if (!range) {
          controller.abort();
          throw new Error('服务器返回 206 但缺少 Content-Range');
        }
        total = Number(range[3]);
        if (Number(range[1]) !== resumeFrom) {
          // 起点对不上，不能把新响应的字节接在旧缓冲后面
          controller.abort();
          loaded = 0;
          buffer = null;
          lastError = new Error('续传起点与本地缓冲不一致，改为重新下载');
          continue;
        }
      } else {
        // 服务器不接受 Range（或 If-Range 校验器失效）：丢弃已收数据，从头开始
        loaded = 0;
        buffer = null;
        total = Number(response.headers.get('content-length') || 0);
        validator = response.headers.get('etag') || response.headers.get('last-modified') || null;
      }

      if (!buffer) {
        buffer = new Uint8Array(total > 0 ? total : 1024 * 1024);
      }

      const ensureCapacity = (extra: number) => {
        if (!buffer || loaded + extra <= buffer.byteLength) return;
        let size = Math.max(buffer.byteLength * 2, loaded + extra);
        if (total > 0) size = Math.max(size, total);
        const next = new Uint8Array(size);
        next.set(buffer.subarray(0, loaded));
        buffer = next;
      };

      const reader = response.body?.getReader();
      if (!reader) {
        const whole = new Uint8Array(await response.arrayBuffer());
        ensureCapacity(whole.byteLength);
        if (!buffer) throw new Error('下载内容为空');
        buffer.set(whole, loaded);
        loaded += whole.byteLength;
        onChunk?.(loaded, total);
      } else {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          armIdle();
          ensureCapacity(value.byteLength);
          if (!buffer) throw new Error('下载内容为空');
          buffer.set(value, loaded);
          loaded += value.byteLength;
          onChunk?.(loaded, total);
        }
      }

      if (total > 0 && loaded < total) {
        throw new Error(`下载中断 (${formatBytes(loaded)} / ${formatBytes(total)})`);
      }
      if (loaded === 0 || !buffer) {
        throw new Error('下载内容为空');
      }

      const result = buffer;
      return (loaded === result.byteLength ? result.buffer : result.buffer.slice(0, loaded)) as ArrayBuffer;
    } catch (error) {
      lastError = error;
      // 一个字节都没收到时续传没有意义，直接交给调用方换源
      if (loaded === 0) break;
    } finally {
      if (idleTimer) clearTimeout(idleTimer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('下载失败 (Network Error)');
}

/**
 * 分块清单。
 *
 * format 2（当前构建产物）：`chunks` 是去重后的内容寻址块表（sha256 → 长度），
 * `parts` 是按拼接顺序排列、允许重复的块路径。块 URL 只由内容决定，因此同一段
 * 字节在不同版本里是同一个 URL —— 这是「升级只下变化的块」的基础。
 *
 * 旧格式（无 format、有 partSize）：固定偏移切片，保留解析能力以便兼容旧客户端
 * 缓存里残留的清单。
 */
export interface PartsManifest {
  version?: string;
  /** 清单格式版本；>= 2 表示内容定义分块 */
  format?: number;
  totalSize: number;
  /** 仅旧格式：固定分片长度 */
  partSize?: number;
  /** 完整 zip 的 sha256，客户端拼接后据此校验 */
  sha256?: string;
  /** 仅 format 2：去重后的内容寻址块表 */
  chunks?: { sha256: string; size: number }[];
  /** 按顺序拼接即可得到完整 zip 的块路径（相对清单所在目录） */
  parts: string[];
  /** 仅用于溯源的上游地址；客户端不得把它当作下载地址使用 */
  source?: string;
}

export async function fetchPartsManifest(url: string, timeoutMs = 15_000): Promise<PartsManifest> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      // 清单是本站产物，跳转一律视为异常
      redirect: 'manual',
    });
    if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
      throw new Error('分片清单地址发生跳转，已拒绝跟随');
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as PartsManifest;
    if (
      !data ||
      !Array.isArray(data.parts) ||
      data.parts.length === 0 ||
      !Number.isFinite(data.totalSize) ||
      data.totalSize <= 0
    ) {
      throw new Error('分片清单格式无效');
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 把拼接结果转成小写十六进制 sha256
 * @param buffer 待校验内容
 * @returns sha256 十六进制字符串；环境不支持 SubtleCrypto 时返回 null
 */
async function sha256Hex(buffer: ArrayBuffer): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 分块缓存（内容寻址）。
 *
 * 198 MB 的包切成 300 多块后，任何一块失败、用户关页面、或者手动重试，都不该让
 * 已经下完的那几块白费。这里用 Cache Storage（磁盘缓存，浏览器/Tauri 的 WebView 都支持）
 * 按 **内容的 sha256** 存块：
 * - 块 URL 只由内容决定，跨版本稳定 —— OpenMap 从 v0.8.13 升到 v0.8.14 时，
 *   没变的 300 多块直接命中，只补下真正变化的那几块（实测占比 0.6%）；
 * - 不再按版本 sha 前缀清理，历史版本的块仍然是新版本的块，清掉等于自断增量能力。
 */
const CHUNK_CACHE_NAME = 'wow-addon-chunks-v2';
const CHUNK_CACHE_PREFIX = '/__addon-chunks/';
/** 块索引：记录每块最后被使用的时间与大小，用于按预算淘汰 */
const CHUNK_INDEX_KEY = '/__addon-chunk-index/';
/** 上一代「按版本前缀存整片」的缓存名；新版不会再读它，留着只会白占约 198 MB 磁盘 */
const LEGACY_PART_CACHE_NAME = 'wow-addon-parts-v1';

/**
 * 分块缓存总量上限。
 * 单个 OpenMap 约 198 MB，留出约 1.6 个版本的空间：既能容纳升级过程中的新旧块，
 * 又不会无限吃掉用户磁盘（浏览器配额通常按 origin 计算）。
 */
export const CHUNK_CACHE_BUDGET_BYTES = 320 * 1024 * 1024;

/** 并发下载块数：声音脚本/CDN 都能承受，198 MB 的分块串行下载会白白多花几十秒 RTT */
const CHUNK_CONCURRENCY = 4;

/** 块索引条目 */
interface ChunkIndexEntry {
  /** 最后一次被使用的时间戳（毫秒），用于淘汰最久未用的块 */
  lastUsed: number;
  /** 块字节数，用于统计缓存占用 */
  size: number;
}

type ChunkIndex = Record<string, ChunkIndexEntry>;

/**
 * 清掉上一代「wow-addon-parts-v1」缓存。
 *
 * 老版本按 `插件id/整包sha256/分片路径` 存整片，键里带版本 sha，跨版本永远命中不了；
 * 升级到内容寻址后那批数据已经没有复用价值，留着纯白占磁盘（OpenMap 一份约 198 MB）。
 * 只在首次打开分块缓存时尝试一次，失败不影响任何流程。
 */
async function dropLegacyPartCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    if (await caches.has(LEGACY_PART_CACHE_NAME)) {
      await caches.delete(LEGACY_PART_CACHE_NAME);
    }
  } catch {
    // 删不掉就算了，浏览器配额不足时它会自行回收
  }
}

/**
 * 打开分块缓存；环境不支持 Cache Storage（http 非 localhost、老 WebView）时返回 null
 * @returns Cache 实例或 null
 */
async function openChunkCache(): Promise<Cache | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(CHUNK_CACHE_NAME);
    void dropLegacyPartCache();
    return cache;
  } catch {
    return null;
  }
}

/**
 * 读取块索引；缺失或损坏时返回空索引（宁可多下一次，也不要因为索引坏了装不上）
 * @param chunkCache 分块缓存
 * @returns 块索引
 */
async function readChunkIndex(chunkCache: Cache | null): Promise<ChunkIndex> {
  if (!chunkCache) return {};
  try {
    const hit = await chunkCache.match(CHUNK_INDEX_KEY);
    if (!hit) return {};
    const raw = (await hit.json()) as unknown;
    if (!raw || typeof raw !== 'object') return {};
    const index: ChunkIndex = {};
    for (const [sha, value] of Object.entries(raw as Record<string, unknown>)) {
      const entry = value as Partial<ChunkIndexEntry> | null;
      if (!entry || typeof entry.lastUsed !== 'number' || typeof entry.size !== 'number') continue;
      if (!/^[0-9a-f]{64}$/.test(sha)) continue;
      index[sha] = { lastUsed: entry.lastUsed, size: entry.size };
    }
    return index;
  } catch {
    return {};
  }
}

/**
 * 写回块索引；写失败（配额不足 / 隐私模式）只影响后续淘汰精度，不影响本次安装
 * @param chunkCache 分块缓存
 * @param index 块索引
 */
async function writeChunkIndex(chunkCache: Cache | null, index: ChunkIndex): Promise<void> {
  if (!chunkCache) return;
  try {
    await chunkCache.put(
      CHUNK_INDEX_KEY,
      new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } })
    );
  } catch {
    // 索引写不进去时，缓存依然可用，只是下次无法精确淘汰
  }
}

/**
 * 生成块的缓存键：只由内容的 sha256 决定，跨版本、跨插件共享
 * @param origin 站点源
 * @param sha256 块内容的 sha256
 * @returns Cache Storage 键
 */
function chunkCacheKey(origin: string, sha256: string): string {
  return `${origin}${CHUNK_CACHE_PREFIX}${sha256}`;
}

/**
 * 读取已缓存的块，长度不符的直接丢弃（例如上次写了一半）
 * @param chunkCache 分块缓存
 * @param key 缓存键
 * @param expectedSize 该块应有的字节数
 * @returns 块内容或 null
 */
async function readCachedChunk(
  chunkCache: Cache | null,
  key: string,
  expectedSize: number
): Promise<ArrayBuffer | null> {
  if (!chunkCache) return null;
  try {
    const hit = await chunkCache.match(key);
    if (!hit) return null;
    const buffer = await hit.arrayBuffer();
    if (buffer.byteLength === 0 || (expectedSize > 0 && buffer.byteLength !== expectedSize)) {
      await chunkCache.delete(key);
      return null;
    }
    return buffer;
  } catch {
    return null;
  }
}

/**
 * 写入块缓存；写失败（配额不足等）只告警，不影响本次安装
 * @param chunkCache 分块缓存
 * @param key 缓存键
 * @param buffer 块内容
 */
async function writeCachedChunk(chunkCache: Cache | null, key: string, buffer: ArrayBuffer): Promise<void> {
  if (!chunkCache) return;
  try {
    await chunkCache.put(
      key,
      new Response(buffer, { headers: { 'Content-Type': 'application/octet-stream' } })
    );
  } catch {
    // 配额不足 / 隐私模式：放弃缓存，安装继续
  }
}

/** 最近一次成功下载用到的块 sha256：安装完成后的清理由此知道「哪些块刚刚用过」 */
let lastDownloadChunkShas: string[] = [];

/**
 * 取得最近一次下载用到的块 sha256 列表（供安装收尾时保护这些块不被立刻淘汰）
 * @returns 块 sha256 列表（无下载时为空数组）
 */
export function getLastDownloadChunkShas(): string[] {
  return lastDownloadChunkShas;
}

/**
 * 安装收尾：清理失效索引，并在超出预算时按「最久未用」淘汰。
 *
 * 这里**不再按插件或版本清空缓存**：块按内容寻址，旧版本的块就是新版本的块，
 * 清掉等于把下次升级重新变成全量下载。只按总字节预算淘汰最冷的那批。
 *
 * 刻意不只信任索引：下载中途失败、索引写入失败或页面被关掉时，块已经落在
 * Cache Storage 里但没进索引。若只按索引算预算，实际占用会被严重低估
 * （150 MiB 残留 + 198 MiB 新包 = 348 MiB，却以为只有 198 MiB），
 * 所以这里以「实际枚举到的缓存键」为准，把漏记的块补进索引再算预算。
 * @param protectedShas 本次安装刚用到的块；省略时取最近一次下载的块
 */
export async function releaseDownloadCache(protectedShas?: Iterable<string>): Promise<void> {
  const chunkCache = await openChunkCache();
  if (!chunkCache) return;
  const keepWarm = new Set(protectedShas ?? lastDownloadChunkShas);

  try {
    const index = await readChunkIndex(chunkCache);
    const requests = await chunkCache.keys();

    /** sha256 → 实际缓存中的请求 URL（删除时必须用它，而不是用当前 origin 重新拼） */
    const requestsBySha = new Map<string, string>();
    for (const request of requests) {
      const match = /\/([0-9a-f]{64})$/.exec(new URL(request.url).pathname);
      if (match) requestsBySha.set(match[1], request.url);
    }

    // 索引里有、磁盘上没有的块（被浏览器回收或上次写失败）先从索引移除
    for (const sha of Object.keys(index)) {
      if (!requestsBySha.has(sha)) delete index[sha];
    }

    // 磁盘上有、索引里没有的块：补录大小（lastUsed 记 0，让它们优先被淘汰）。
    // 用 blob().size 取长度，避免把这些块整体读进 JS 堆。
    let dirty = false;
    for (const [sha, url] of requestsBySha) {
      if (index[sha]) continue;
      let size = 0;
      try {
        const hit = await chunkCache.match(url);
        size = hit ? (await hit.blob()).size : 0;
      } catch {
        size = 0;
      }
      if (size <= 0) continue;
      index[sha] = { lastUsed: 0, size };
      dirty = true;
    }

    let totalBytes = Object.values(index).reduce((sum, entry) => sum + entry.size, 0);
    if (totalBytes > CHUNK_CACHE_BUDGET_BYTES) {
      // 刚用过的排最后：它们很可能在这次升级的后续重试里还要用
      const candidates = Object.entries(index)
        .filter(([sha]) => !keepWarm.has(sha))
        .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
      for (const [sha, entry] of candidates) {
        if (totalBytes <= CHUNK_CACHE_BUDGET_BYTES) break;
        const url = requestsBySha.get(sha);
        if (url) await chunkCache.delete(url);
        delete index[sha];
        totalBytes -= entry.size;
        dirty = true;
      }
    }

    if (dirty) await writeChunkIndex(chunkCache, index);
  } catch {
    // 清理失败不影响安装
  }
}

/**
 * 按并发上限执行异步任务
 * @param items 待处理列表
 * @param limit 并发上限
 * @param worker 处理单个元素的函数
 */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

/**
 * 推断清单所在站点的 origin（块 URL 必须与清单同源）
 * @param resolvedManifest 清单绝对地址
 * @returns 站点 origin
 */
function manifestOrigin(resolvedManifest: string): string {
  return new URL(resolvedManifest).origin;
}

/**
 * 按清单下载全部分块并拼接成一个 ArrayBuffer。
 *
 * - format 2：按内容寻址并发下载，命中的块直接复用（跨版本），只补下变化的块；
 * - 旧格式（固定分片）：顺序下载，不做跨版本复用。
 *
 * 进度以「已收到的字节 / totalSize」汇总上报，耗时最长的下载阶段也能显示真实百分比。
 */
export async function downloadParts(
  manifestUrl: string,
  manifest: PartsManifest,
  options: DownloadOptions = {}
): Promise<ArrayBuffer> {
  const { onChunk, idleTimeoutMs, maxRetries, cache = 'no-store', onCacheHit } = options;
  const base = typeof location !== 'undefined' && location.href ? location.href : 'http://localhost/';
  const resolvedManifest = new URL(manifestUrl, base).href;
  const origin = manifestOrigin(resolvedManifest);
  const packageSha = String(manifest.sha256 || '').toLowerCase();

  // 构建端一定会写 sha256；没有摘要就无法判断「等长但内容错误」的块
  if (!/^[0-9a-f]{64}$/.test(packageSha)) {
    throw new Error('分块清单缺少有效的 sha256，拒绝安装');
  }

  const out = new Uint8Array(manifest.totalSize);
  const isChunked = Number(manifest.format) >= 2 && Array.isArray(manifest.chunks);

  if (!isChunked) {
    await downloadLegacyParts(resolvedManifest, manifest, out, origin, {
      onChunk,
      idleTimeoutMs,
      maxRetries,
      cache,
    });
  } else {
    await downloadContentAddressedChunks(resolvedManifest, manifest, out, origin, {
      onChunk,
      idleTimeoutMs,
      maxRetries,
      cache,
      onCacheHit,
    });
  }

  // 长度一致不代表内容正确（等长分块互换、单点损坏都查不出来），再比一次整包 sha256
  const actual = await sha256Hex(out.buffer as ArrayBuffer);
  if (!actual) {
    throw new Error('当前环境不支持 sha256 校验（需要 HTTPS/localhost），已拒绝安装');
  }
  if (actual !== packageSha) {
    // 缓存里的块已经被证明不可信：整份清掉，让下次重新下载
    await clearChunkCache();
    throw new Error('分块拼接结果校验失败（sha256 与清单不一致）');
  }

  return out.buffer as ArrayBuffer;
}

/**
 * format 2 主路径：内容寻址 + 并发下载。
 * @param resolvedManifest 清单绝对地址
 * @param manifest 分块清单
 * @param out 待填充的输出缓冲（长度等于清单 totalSize）
 * @param origin 站点 origin
 * @param options 下载选项
 */
async function downloadContentAddressedChunks(
  resolvedManifest: string,
  manifest: PartsManifest,
  out: Uint8Array,
  origin: string,
  options: DownloadOptions
): Promise<void> {
  const { onChunk, idleTimeoutMs, maxRetries, cache = 'no-store', onCacheHit } = options;

  const declaredSize = new Map<string, number>();
  for (const chunk of manifest.chunks ?? []) {
    const digest = String(chunk?.sha256 || '').toLowerCase();
    const size = Number(chunk?.size) || 0;
    if (!/^[0-9a-f]{64}$/.test(digest) || size <= 0) {
      throw new Error('分块清单存在无效的 chunks 条目');
    }
    declaredSize.set(digest, size);
  }

  // 按 parts 顺序算出每块在输出缓冲里的偏移；同一块可能出现多次（重复内容只存一份）
  interface Placement {
    sha256: string;
    size: number;
    offset: number;
  }
  const placements: Placement[] = [];
  let offset = 0;
  for (const [index, part] of (manifest.parts ?? []).entries()) {
    const partUrl = new URL(part, resolvedManifest);
    // 清单里的块地址必须与清单同源，否则等于把下载引向站外
    if (partUrl.origin !== origin) {
      throw new Error(`分块 ${index + 1}/${manifest.parts.length} 指向站外地址（${partUrl.origin}），已拒绝下载`);
    }
    const match = /([0-9a-f]{64})\.bin$/i.exec(partUrl.pathname);
    const digest = match ? match[1].toLowerCase() : '';
    const size = declaredSize.get(digest);
    if (!digest || size === undefined) {
      throw new Error(`分块 ${index + 1}/${manifest.parts.length} 不在清单 chunks 里，拒绝安装`);
    }
    if (offset + size > out.byteLength) {
      throw new Error('分块总长度超出清单 totalSize');
    }
    placements.push({ sha256: digest, size, offset });
    offset += size;
  }
  if (offset !== out.byteLength) {
    throw new Error(`分块总长度 ${offset} 与清单 ${out.byteLength} 不一致`);
  }

  // 每个块只下载一次，即使它在 parts 里出现多次
  const unique = new Map<string, number>();
  for (const placement of placements) unique.set(placement.sha256, placement.size);
  const digests = Array.from(unique.keys());
  const chunkCache = await openChunkCache();
  const index = await readChunkIndex(chunkCache);

  /**
   * 块内容表：缓存命中的与刚下载的都放在这里。
   * 不能用「下完再从 Cache Storage 读回来」的方式拼包——Cache Storage 在
   * http 非 localhost、隐私模式、老 WebView 下根本不可用，那样会导致
   * 明明下载成功却永远拼不出包。内容一律以内存里这份为准。
   */
  const contents = new Map<string, ArrayBuffer>();

  /** 每块当前已接收的字节数，用于汇总总进度 */
  const progress = new Map<string, number>();
  let doneBytes = 0;
  const report = () => {
    if (!onChunk) return;
    let loaded = doneBytes;
    for (const received of progress.values()) loaded += received;
    onChunk(loaded, manifest.totalSize);
  };

  // 先扫一遍缓存：命中的块直接计入进度，界面能立刻显示「已复用多少」
  const missing: string[] = [];
  for (const digest of digests) {
    const size = unique.get(digest)!;
    const buffer = await readCachedChunk(chunkCache, chunkCacheKey(origin, digest), size);
    if (buffer) {
      contents.set(digest, buffer);
      doneBytes += buffer.byteLength;
      onCacheHit?.(contents.size, digests.length);
      report();
    } else {
      missing.push(digest);
    }
  }

  const now = Date.now();
  let failure: unknown = null;
  if (missing.length > 0) {
    await runWithConcurrency(missing, CHUNK_CONCURRENCY, async (digest) => {
      // 一块失败就停：继续下载只会白耗流量，错误由调用方统一处理
      if (failure) return;
      const size = unique.get(digest)!;
      const partUrl = new URL(`chunks/${digest}.bin`, resolvedManifest).href;
      try {
        const buffer = await downloadWithProgress(partUrl, {
          idleTimeoutMs,
          maxRetries,
          cache,
          onChunk: (loaded) => {
            progress.set(digest, Math.min(loaded, size));
            report();
          },
        });
        if (buffer.byteLength !== size) {
          throw new Error(`分块长度不符（${buffer.byteLength} != ${size}）`);
        }
        // 先记进内存再写缓存：缓存写不进去也照样能装
        contents.set(digest, buffer);
        progress.delete(digest);
        doneBytes += size;
        report();
        await writeCachedChunk(chunkCache, chunkCacheKey(origin, digest), buffer);
      } catch (error) {
        progress.delete(digest);
        if (!failure) failure = error;
      }
    });
  }
  if (failure) {
    const reason = failure instanceof Error ? failure.message : String(failure);
    throw new Error(`分块下载失败：${reason}`);
  }

  // 按 parts 顺序拼接（重复块在多处复用同一份内容）
  for (const placement of placements) {
    const buffer = contents.get(placement.sha256);
    if (!buffer) {
      throw new Error(`分块 ${placement.sha256.slice(0, 12)}… 缺失，请重试`);
    }
    out.set(new Uint8Array(buffer), placement.offset);
    index[placement.sha256] = { lastUsed: now, size: placement.size };
  }

  // 记下本次用到的块：安装收尾淘汰缓存时要保护这批（它们可能还要用于重试）
  lastDownloadChunkShas = digests;

  await writeChunkIndex(chunkCache, index);
}

/**
 * 旧格式（固定偏移分片）兼容路径：顺序下载后拼接。
 *
 * 该格式没有内容寻址信息，无法跨版本复用，这里不再做分片级缓存；
 * 单块内部的断流续传仍由 downloadWithProgress 的 Range/If-Range 保证。
 * @param resolvedManifest 清单绝对地址
 * @param manifest 分片清单
 * @param out 待填充的输出缓冲
 * @param origin 站点 origin
 * @param options 下载选项
 */
async function downloadLegacyParts(
  resolvedManifest: string,
  manifest: PartsManifest,
  out: Uint8Array,
  origin: string,
  options: DownloadOptions
): Promise<void> {
  const { onChunk, idleTimeoutMs, maxRetries, cache = 'no-store' } = options;
  const declaredPartSize = Number(manifest.partSize);
  const knownPartSize = Number.isFinite(declaredPartSize) && declaredPartSize > 0 ? declaredPartSize : 0;
  let offset = 0;

  for (const [index, part] of manifest.parts.entries()) {
    const partUrl = new URL(part, resolvedManifest);
    // 清单里的分片地址必须与清单同源，否则等于把下载引向站外
    if (partUrl.origin !== origin) {
      throw new Error(`分片 ${index + 1}/${manifest.parts.length} 指向站外地址（${partUrl.origin}），已拒绝下载`);
    }

    const expectedSize = knownPartSize > 0 ? Math.min(manifest.totalSize - offset, knownPartSize) : 0;
    let buffer: ArrayBuffer;
    try {
      buffer = await downloadWithProgress(partUrl.href, {
        idleTimeoutMs,
        maxRetries,
        cache,
        onChunk: onChunk ? (loaded) => onChunk(offset + loaded, manifest.totalSize) : undefined,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`分片 ${index + 1}/${manifest.parts.length} 下载失败：${reason}`);
    }
    if (expectedSize > 0 && buffer.byteLength !== expectedSize) {
      throw new Error(`分片 ${index + 1}/${manifest.parts.length} 长度不符（${buffer.byteLength} != ${expectedSize}）`);
    }
    if (offset + buffer.byteLength > out.byteLength) {
      throw new Error('分片总长度超出清单 totalSize');
    }
    out.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }

  if (offset !== out.byteLength) {
    throw new Error(`分片总长度 ${offset} 与清单 ${out.byteLength} 不一致`);
  }
}

/**
 * 清空全部分块缓存（只在拼接结果校验失败时调用：此时缓存里的块已被证明不可信）
 */
async function clearChunkCache(): Promise<void> {
  const chunkCache = await openChunkCache();
  if (!chunkCache) return;
  try {
    const keys = await chunkCache.keys();
    await Promise.all(keys.map((request) => chunkCache.delete(request.url)));
  } catch {
    // 清不掉就算了，下次安装会按长度与整包 sha256 兜底
  }
}
