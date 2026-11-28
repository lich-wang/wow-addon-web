import { invoke } from '@tauri-apps/api/core';
import type { AddonInfo } from '../types/addon';
import {
  buildZipBatch,
  CURRENT_AGENT_BODY_LIMIT_BYTES,
  DEFAULT_ZIP_BATCH_MAX_BYTES,
  LEGACY_AGENT_BODY_LIMIT_BYTES,
  planZipBatches,
} from './zipSplitter';

const AGENT_BASE = 'http://127.0.0.1:24642';

export interface WowInstallation {
  name: string;
  flavor: string;
  addonsPath: string;
  gameRoot: string;
  isRunning?: boolean;
}

export interface AgentStatus {
  status: 'ok';
  version: string;
  mode?: string;
  maxBodyBytes?: number;
  platform: string;
  installations: WowInstallation[];
}

let lastAgentMeta: { version: string; mode?: string; maxBodyBytes?: number } | null = null;

function isVersionAtLeast(version: string, minParts: [number, number, number]): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) return false;
  const parts: [number, number, number] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  for (let i = 0; i < 3; i++) {
    if (parts[i] > minParts[i]) return true;
    if (parts[i] < minParts[i]) return false;
  }
  return true;
}

function resolveAgentBodyLimitBytes(
  meta: { version?: string; mode?: string; maxBodyBytes?: number } | null
): number {
  if (
    typeof meta?.maxBodyBytes === 'number' &&
    Number.isFinite(meta.maxBodyBytes) &&
    meta.maxBodyBytes > 0
  ) {
    return meta.maxBodyBytes;
  }
  if (meta?.version && isVersionAtLeast(meta.version, [1, 0, 9])) {
    return CURRENT_AGENT_BODY_LIMIT_BYTES;
  }
  return LEGACY_AGENT_BODY_LIMIT_BYTES;
}

export interface ClientReleaseInfo {
  version: string;
  tag: string;
  winUrl: string;
  winFileName: string;
  winSize?: number;
  macUrl: string;
  macFileName: string;
  macSize?: number;
  releaseUrl: string;
  publishedAt?: string;
}

export const GITHUB_RELEASES_URL = 'https://github.com/lich-wang/wow-addon-web/releases';
export const WIN_DOWNLOAD_URL = '/downloads/WoW-Addon-Manager.exe';
export const MAC_DOWNLOAD_URL = '/downloads/WoW-Addon-Manager.dmg';

export const DEFAULT_CLIENT_RELEASE: ClientReleaseInfo = {
  version: '',
  tag: '',
  winUrl: WIN_DOWNLOAD_URL,
  winFileName: 'WoW-Addon-Manager.exe',
  macUrl: MAC_DOWNLOAD_URL,
  macFileName: 'WoW-Addon-Manager.dmg',
  releaseUrl: GITHUB_RELEASES_URL,
};

let cachedClientRelease: { data: ClientReleaseInfo; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Fetch latest desktop client release information with TTL cache and fallback
 * @param forceRefresh - If true, bypasses in-memory cache and re-fetches manifest
 * @param timeoutMs - Maximum request time in milliseconds (defaults to 5000ms)
 */
export async function fetchClientReleaseInfo(forceRefresh = false, timeoutMs = 5000): Promise<ClientReleaseInfo> {
  const now = Date.now();
  if (!forceRefresh && cachedClientRelease && now - cachedClientRelease.timestamp < CACHE_TTL_MS) {
    return cachedClientRelease.data;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`/downloads/client-version.json?_t=${now}`, {
      cache: 'no-cache',
      signal: controller.signal,
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.version && data.tag) {
        const info = data as ClientReleaseInfo;
        cachedClientRelease = { data: info, timestamp: now };
        return info;
      }
    }
  } catch (e) {
    console.warn('Failed to fetch client-version.json, using fallback:', e);
  } finally {
    clearTimeout(timeoutId);
  }

  if (cachedClientRelease) {
    return {
      ...cachedClientRelease.data,
      winUrl: WIN_DOWNLOAD_URL,
      winFileName: 'WoW-Addon-Manager.exe',
      macUrl: MAC_DOWNLOAD_URL,
      macFileName: 'WoW-Addon-Manager.dmg',
    };
  }
  return DEFAULT_CLIENT_RELEASE;
}

/**
 * Check if running inside the Tauri native desktop app
 */
export function isTauriEnv(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  );
}

function inferFlavorAndLabel(pathStr: string): { flavor: string; label: string } {
  const lower = pathStr.toLowerCase();
  const flavors = [
    { pattern: '_classic_era_', flavor: 'classic_era', label: '经典旧世 (Era)' },
    { pattern: '_classic_titan_', flavor: 'classic_titan', label: '怀旧泰坦 (Titan)' },
    { pattern: '_classic_', flavor: 'classic', label: '经典怀旧服 (Classic)' },
    { pattern: '_forever_', flavor: 'forever', label: '无限服 (WoW Forever)' },
    { pattern: '_ptr_', flavor: 'ptr', label: '测试服 (PTR)' },
    { pattern: '_retail_', flavor: 'retail', label: '正式服 (The War Within)' },
  ];
  for (const item of flavors) {
    if (lower.includes(item.pattern)) {
      return { flavor: item.flavor, label: item.label };
    }
  }
  return { flavor: 'retail', label: '魔兽客户端' };
}

let activeRecoveryPromise: Promise<AddonInfo[]> | null = null;
let activeRecoveryPath: string | null = null;
const verifiedPathCache = new Map<string, { addons: AddonInfo[]; timestamp: number }>();

/**
 * Check if the native local bridge agent is running on 127.0.0.1:24642,
 * or connect directly via Tauri native IPC if inside desktop app.
 */
export async function checkAgentStatus(): Promise<AgentStatus | null> {
  let status: AgentStatus | null = null;

  if (isTauriEnv()) {
    try {
      status = await invoke<AgentStatus>('ping');
    } catch (e) {
      console.warn('Tauri ping error:', e);
    }
  } else {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const res = await fetch(`${AGENT_BASE}/api/ping`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        status = (await res.json()) as AgentStatus;
      }
    } catch {
      // Agent is not active or blocked by browser
    }
  }

  if (status) {
    lastAgentMeta = {
      version: status.version,
      mode: status.mode,
      maxBodyBytes: status.maxBodyBytes,
    };
  }

  // Restore and verify recently used custom path if available
  if (status && typeof window !== 'undefined') {
    let lastAgentPath: string | null = null;
    try {
      lastAgentPath = localStorage.getItem('wow_addon_last_agent_path');
    } catch (storageErr) {
      console.warn('读取助手路径失败:', storageErr);
    }

    if (lastAgentPath) {
      const normalizedPath = lastAgentPath.toLowerCase();
      const alreadyHas = status.installations.some(
        (inst) => inst.addonsPath.toLowerCase() === normalizedPath
      );
      if (!alreadyHas) {
        const cached = verifiedPathCache.get(normalizedPath);
        if (cached && Date.now() - cached.timestamp < 60000 && Array.isArray(cached.addons)) {
          const { flavor, label } = inferFlavorAndLabel(lastAgentPath);
          status.installations.unshift({
            name: `${label} (${flavor})`,
            flavor,
            addonsPath: lastAgentPath,
            gameRoot: lastAgentPath.split(/_[a-z0-9_]+_/i)[0] || lastAgentPath,
            isRunning: false,
          });
        } else {
          try {
            if (!activeRecoveryPromise || activeRecoveryPath !== lastAgentPath) {
              activeRecoveryPath = lastAgentPath;
              activeRecoveryPromise = agentScanAddons(lastAgentPath)
                .then((scanned) => {
                  if (Array.isArray(scanned)) {
                    verifiedPathCache.set(normalizedPath, {
                      addons: scanned,
                      timestamp: Date.now(),
                    });
                  }
                  return scanned;
                })
                .finally(() => {
                  activeRecoveryPromise = null;
                  activeRecoveryPath = null;
                });
            }

            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('recovery scan timeout')), 1500)
            );
            const addons = await Promise.race([activeRecoveryPromise, timeoutPromise]);

            if (Array.isArray(addons)) {
              const { flavor, label } = inferFlavorAndLabel(lastAgentPath);
              status.installations.unshift({
                name: `${label} (${flavor})`,
                flavor,
                addonsPath: lastAgentPath,
                gameRoot: lastAgentPath.split(/_[a-z0-9_]+_/i)[0] || lastAgentPath,
                isRunning: false,
              });
            }
          } catch {
            // ignore scan error or timeout for obsolete saved path; keep successful ping status
          }
        }
      }
    }
  }

  return status;
}

/**
 * Open native OS directory picker dialog via agent or Tauri IPC
 */
export async function agentPickFolder(): Promise<string | null> {
  if (isTauriEnv()) {
    try {
      const res = await invoke<{ success: boolean; path?: string; cancelled?: boolean }>('pick_folder');
      if (res.success && res.path) {
        return res.path;
      }
      return null;
    } catch (e) {
      console.error('Tauri pick_folder failed:', e);
      throw new Error('选择目录失败');
    }
  }

  const res = await fetch(`${AGENT_BASE}/api/pick-folder`, { method: 'POST' });
  if (!res.ok) throw new Error('本地助手选择目录失败');
  const data = await res.json();
  if (data.success && data.path) {
    return data.path;
  }
  return null;
}

/**
 * Scan addons inside folder via native agent or Tauri IPC
 */
export async function agentScanAddons(addonsPath: string): Promise<AddonInfo[]> {
  if (isTauriEnv()) {
    try {
      const res = await invoke<{ path: string; addons: AddonInfo[] }>('scan_addons', {
        path: addonsPath,
      });
      return res.addons || [];
    } catch (e) {
      throw new Error(String(e) || '扫描目录失败');
    }
  }

  const res = await fetch(`${AGENT_BASE}/api/addons?path=${encodeURIComponent(addonsPath)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '本地助手扫描目录失败');
  }
  const data = await res.json();
  return (data.addons || []) as AddonInfo[];
}

/**
 * Delete an addon folder via agent or Tauri IPC
 */
export async function agentDeleteAddon(addonsPath: string, folderName: string): Promise<void> {
  if (isTauriEnv()) {
    try {
      await invoke<{ success: boolean }>('delete_addon', {
        addonsPath,
        folderName,
      });
      return;
    } catch (e) {
      throw new Error(String(e) || '删除插件失败');
    }
  }

  const res = await fetch(`${AGENT_BASE}/api/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addonsPath, folderName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '本地助手删除插件失败');
  }
}

export interface AgentInstallZipOptions {
  onBatchProgress?: (currentBatch: number, totalBatches: number, batchBytes: number) => void;
  maxBatchBytes?: number;
  maxSingleRequestBytes?: number;
}

async function probeAgentPingMeta(
  timeoutMs = 1200
): Promise<{ version?: string; mode?: string; maxBodyBytes?: number } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${AGENT_BASE}/api/ping`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<AgentStatus>;
    if (data?.version) {
      lastAgentMeta = {
        version: data.version,
        mode: data.mode,
        maxBodyBytes: data.maxBodyBytes,
      };
    }
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const inProcessInstallLocks = new Map<string, Promise<void>>();

function normalizeInstallLockPath(addonsPath: string): string {
  return addonsPath.trim().replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

async function withInProcessLock<T>(lockKey: string, task: () => Promise<T>): Promise<T> {
  const previous = inProcessInstallLocks.get(lockKey) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => current);
  inProcessInstallLocks.set(lockKey, chained);

  await previous;
  try {
    return await task();
  } finally {
    release();
    if (inProcessInstallLocks.get(lockKey) === chained) {
      inProcessInstallLocks.delete(lockKey);
    }
  }
}

/**
 * 针对目标 AddOns 目录加排他锁，确保分批安装的多轮请求在多标签页/多窗口间也不交错。
 * 优先使用浏览器原生的 Web Locks API（异常或页面关闭时自动释放），不可用时回退进程内串行锁。
 */
async function withAddonsInstallLock<T>(addonsPath: string, task: () => Promise<T>): Promise<T> {
  const lockKey = `wow-addon-install:${normalizeInstallLockPath(addonsPath)}`;
  if (typeof navigator !== 'undefined' && typeof navigator.locks?.request === 'function') {
    return navigator.locks.request(lockKey, { mode: 'exclusive' }, () => task());
  }
  return withInProcessLock(lockKey, task);
}

async function isAgentBridgeReachable(timeoutMs = 1200): Promise<boolean> {
  return (await probeAgentPingMeta(timeoutMs)) !== null;
}

async function postZipToAgent(
  addonsPath: string,
  zipBlob: Blob,
  isAsciiOnly: boolean
): Promise<number> {
  const encodedPath = encodeURIComponent(addonsPath);
  const headers: Record<string, string> = {
    'Content-Type': 'application/zip',
  };
  // Send raw unencoded path in header only when ASCII-safe, ensuring backwards compatibility
  // with older agents without triggering browser ISO-8859-1 header errors on Chinese paths
  if (isAsciiOnly) {
    headers['X-Addons-Path'] = addonsPath;
  }

  // 只有 fetch 本身失败（bridge 没起来 / 网络层错误）才回退到 IPC。
  // 服务端已经给出业务错误（比如解压失败）时再走一次 invoke 只会重复安装、
  // 并用 IPC 的错误信息盖掉真正的原因。
  let res: Response;
  try {
    res = await fetch(`${AGENT_BASE}/api/install-zip?path=${encodedPath}`, {
      method: 'POST',
      headers,
      body: zipBlob,
    });
  } catch (error) {
    // 桌面端的内置 bridge 未就绪时，≤32 MB 的小包仍可用 invoke 兜底；
    // 大包宁可明确报错，也不要再走一次会让界面假死的 JSON 序列化。
    if (isTauriEnv() && zipBlob.size <= 32 * 1024 * 1024) {
      try {
        const arrayBuffer = await zipBlob.arrayBuffer();
        const zipBytes = Array.from(new Uint8Array(arrayBuffer));
        const invokeRes = await invoke<{ success: boolean; fileCount: number }>('install_zip', {
          addonsPath,
          zipBytes,
        });
        return invokeRes.fileCount || 0;
      } catch (invokeError) {
        throw new Error(String(invokeError) || '安装插件失败');
      }
    }

    // 区分“本地助手根本没连上”与“传到一半被对端重置（例如旧版助手超限）”
    const reachable = await isAgentBridgeReachable();
    if (!reachable) {
      throw new Error(
        '无法连接到本地助手 (127.0.0.1:24642)，请确认本地助手或桌面客户端仍在运行后重试。'
      );
    }
    const rawMsg = error instanceof Error ? error.message : String(error || '');
    throw new Error(
      `上传安装包到本地助手时连接中断（可能是安装包超过旧版助手单次上限或被安全软件拦截），请重试或升级至最新版桌面客户端${rawMsg ? `：${rawMsg}` : ''}`
    );
  }

  if (!res.ok) {
    if (res.status === 413) {
      throw new Error(
        '安装包超过了本地客户端的单次请求上限（新版 256 MB，旧版 200 MB）：请更新客户端，或改用体积更小的安装包。'
      );
    }
    const err = await res.json().catch(() => ({}));
    if (!isAsciiOnly && (res.status === 400 || res.status === 404)) {
      throw new Error(
        err.error
          ? `${err.error} (如果使用中文等特殊游戏路径，请下载并升级至最新版客户端/助手)`
          : '本地助手安装插件失败，如果游戏路径包含中文，请升级至最新版助手客户端'
      );
    }
    throw new Error(err.error || '本地助手安装插件失败');
  }

  const data = await res.json();
  return data.fileCount || 0;
}

/**
 * Install addon ZIP directly via agent or Tauri IPC.
 *
 * 超过 96 MiB 的大包（如 OpenMap v0.8.14 已达 227.4 MiB）会自动零重压缩拆分为多个小包分批上传：
 * - 兼容所有历史版本本地助手（包括仅支持 200 MiB 上限的旧版）；
 * - 避免浏览器与 Rust 进程同时持有超大型请求体缓冲；
 * - 所有 *.toc 文件放在最后一批，确保中途失败不提前改写本地版本号。
 */
export async function agentInstallZip(
  addonsPath: string,
  zipData: Blob | ArrayBuffer | Uint8Array,
  options: AgentInstallZipOptions = {}
): Promise<number> {
  return withAddonsInstallLock(addonsPath, async () => {
    const isAsciiOnly = /^[\x20-\x7E]*$/.test(addonsPath);
    const totalSize = zipData instanceof Blob ? zipData.size : zipData.byteLength;
    const maxBatchBytes = options.maxBatchBytes ?? DEFAULT_ZIP_BATCH_MAX_BYTES;

    if (totalSize > maxBatchBytes) {
      const zipBytes =
        zipData instanceof Uint8Array
          ? zipData
          : zipData instanceof ArrayBuffer
          ? new Uint8Array(zipData)
          : new Uint8Array(await zipData.arrayBuffer());

      const agentMeta = lastAgentMeta ?? (await probeAgentPingMeta());
      const maxSingleRequestBytes =
        options.maxSingleRequestBytes ?? resolveAgentBodyLimitBytes(agentMeta);
      const plan = planZipBatches(zipBytes, maxBatchBytes, maxSingleRequestBytes);
      if (plan && plan.batches.length > 1) {
        let totalFileCount = 0;
        for (let i = 0; i < plan.batches.length; i++) {
          const batch = plan.batches[i];
          options.onBatchProgress?.(i + 1, plan.batches.length, batch.estimatedBytes);
          const batchBytes = buildZipBatch(zipBytes, batch);
          const batchBlob = new Blob([batchBytes], { type: 'application/zip' });
          totalFileCount += await postZipToAgent(addonsPath, batchBlob, isAsciiOnly);
        }
        return totalFileCount;
      }
    }

    const zipBlob =
      zipData instanceof Blob
        ? zipData
        : zipData instanceof ArrayBuffer
        ? new Blob([zipData], { type: 'application/zip' })
        : new Blob([new Uint8Array(zipData)], { type: 'application/zip' });

    return postZipToAgent(addonsPath, zipBlob, isAsciiOnly);
  });
}

/**
 * Open folder in system file explorer (Explorer / Finder)
 */
export async function agentOpenFolder(path: string): Promise<void> {
  if (isTauriEnv()) {
    try {
      await invoke<{ success: boolean }>('open_folder', { path });
      return;
    } catch (e) {
      console.warn('Could not open folder via Tauri:', e);
      return;
    }
  }

  try {
    await fetch(`${AGENT_BASE}/api/open-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
  } catch (e) {
    console.warn('Could not open folder via agent:', e);
  }
}
