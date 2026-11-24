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
 * 分片清单：Cloudflare Pages 单文件上限 25 MiB，放不下的插件包（OpenMap 198 MB）
 * 由构建脚本切成多个 < 25 MiB 的分片，客户端按清单顺序下载后拼回完整 zip。
 */
export interface PartsManifest {
  version?: string;
  totalSize: number;
  partSize?: number;
  /** 完整 zip 的 sha256，客户端拼接后据此校验 */
  sha256?: string;
  /** 分片路径（相对清单所在目录，如 "<sha256>/part-001.bin"） */
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
  const manifestOrigin = new URL(resolvedManifest).origin;

  for (const [index, part] of manifest.parts.entries()) {
    const partUrl = new URL(part, resolvedManifest);
    // 清单里的分片地址必须与清单同源，否则等于把下载引向站外
    if (partUrl.origin !== manifestOrigin) {
      throw new Error(`分片 ${index + 1}/${manifest.parts.length} 指向站外地址（${partUrl.origin}），已拒绝下载`);
    }
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
    if (offset + buffer.byteLength > out.byteLength) {
      throw new Error('分片总长度超出清单 totalSize');
    }
    out.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }

  if (offset !== out.byteLength) {
    throw new Error(`分片总长度 ${offset} 与清单 ${out.byteLength} 不一致`);
  }

  // 长度一致不代表内容正确（等长分片互换、单点损坏都查不出来），再比一次整包 sha256
  if (manifest.sha256) {
    const actual = await sha256Hex(out.buffer as ArrayBuffer);
    if (actual && actual !== manifest.sha256.toLowerCase()) {
      throw new Error('分片拼接结果校验失败（sha256 与清单不一致）');
    }
  }

  return out.buffer as ArrayBuffer;
}
