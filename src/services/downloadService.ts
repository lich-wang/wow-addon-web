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
   * fetch 缓存策略。默认 no-store（大包不进浏览器缓存，避免 198 MB 常驻）；
   * 内容哈希命名、可长期缓存的分片传 'default'，重复安装直接命中缓存。
   */
  cache?: RequestCache;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

/**
 * 流式下载并返回完整内容。
 * - 服务器支持 Range 时，中途断开会从已下载位置续传；
 * - 服务器忽略 Range（返回 200）时，自动清空缓冲从头下载；
 * - 超过 idleTimeoutMs 没有任何数据则中断并抛出，由调用方决定换源。
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

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const armIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => controller.abort(), idleTimeoutMs);
    };

    try {
      const resumeFrom = loaded;
      armIdle();
      const response = await fetch(url, {
        signal: controller.signal,
        headers: resumeFrom > 0 ? { Range: `bytes=${resumeFrom}-` } : undefined,
        cache,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        throw new Error('收到 HTML 页面而不是插件压缩包');
      }

      if (response.status === 206) {
        const range = /\/(\d+)\s*$/.exec(response.headers.get('content-range') || '');
        if (range) total = Number(range[1]);
      } else {
        // 服务器不接受 Range（或首次请求）：丢弃已收数据，从头开始
        loaded = 0;
        buffer = null;
        total = Number(response.headers.get('content-length') || 0);
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
 * 分片清单：Cloudflare Pages 单文件上限 25 MiB，放不下的插件包（OpenMap 198 MB）
 * 由构建脚本切成多个 < 25 MiB 的分片，客户端按清单顺序下载后拼回完整 zip。
 */
export interface PartsManifest {
  version?: string;
  totalSize: number;
  partSize?: number;
  sha256?: string;
  /** 分片路径（相对清单所在目录，如 "v0.8.13/part-001.bin"） */
  parts: string[];
  /** 兜底直链（原始 GitHub Release 地址），分片整体不可用时可回退 */
  source?: string;
}

export async function fetchPartsManifest(url: string, timeoutMs = 15_000): Promise<PartsManifest> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
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
 * 按清单下载全部分片并拼接成一个 ArrayBuffer。
 * 进度以「已收到的字节 / totalSize」汇总上报，耗时最长的下载阶段也能显示真实百分比。
 */
export async function downloadParts(
  manifestUrl: string,
  manifest: PartsManifest,
  options: DownloadOptions = {}
): Promise<ArrayBuffer> {
  const { onChunk, idleTimeoutMs, maxRetries, cache = 'default' } = options;
  const base = typeof location !== 'undefined' && location.href ? location.href : 'http://localhost/';
  const resolvedManifest = new URL(manifestUrl, base).href;
  const out = new Uint8Array(manifest.totalSize);
  let offset = 0;

  for (const [index, part] of manifest.parts.entries()) {
    const partUrl = new URL(part, resolvedManifest).href;
    let buffer: ArrayBuffer;
    try {
      buffer = await downloadWithProgress(partUrl, {
        idleTimeoutMs,
        maxRetries,
        cache,
        onChunk: onChunk ? (loaded) => onChunk(offset + loaded, manifest.totalSize) : undefined,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`分片 ${index + 1}/${manifest.parts.length} 下载失败：${reason}`);
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
  return out.buffer as ArrayBuffer;
}
