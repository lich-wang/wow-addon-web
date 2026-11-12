import { invoke } from '@tauri-apps/api/core';
import type { AddonInfo } from '../types/addon';

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
  platform: string;
  installations: WowInstallation[];
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

  // Restore and verify recently used custom path if available
  if (status && typeof window !== 'undefined') {
    let lastAgentPath: string | null = null;
    try {
      lastAgentPath = localStorage.getItem('wow_addon_last_agent_path');
    } catch (storageErr) {
      console.warn('读取助手路径失败:', storageErr);
    }

    if (lastAgentPath) {
      const alreadyHas = status.installations.some(
        (inst) => inst.addonsPath.toLowerCase() === lastAgentPath!.toLowerCase()
      );
      if (!alreadyHas) {
        try {
          if (!activeRecoveryPromise || activeRecoveryPath !== lastAgentPath) {
            activeRecoveryPath = lastAgentPath;
            activeRecoveryPromise = agentScanAddons(lastAgentPath).finally(() => {
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

/**
 * Install addon ZIP directly via agent or Tauri IPC
 */
export async function agentInstallZip(addonsPath: string, zipBlob: Blob): Promise<number> {
  if (isTauriEnv()) {
    try {
      const arrayBuffer = await zipBlob.arrayBuffer();
      const zipBytes = Array.from(new Uint8Array(arrayBuffer));
      const res = await invoke<{ success: boolean; fileCount: number }>('install_zip', {
        addonsPath,
        zipBytes,
      });
      return res.fileCount || 0;
    } catch (e) {
      throw new Error(String(e) || '安装插件失败');
    }
  }

  const encodedPath = encodeURIComponent(addonsPath);
  const isAsciiOnly = /^[\x20-\x7E]*$/.test(addonsPath);
  const headers: Record<string, string> = {
    'Content-Type': 'application/zip',
  };
  // Send raw unencoded path in header only when ASCII-safe, ensuring backwards compatibility
  // with older agents without triggering browser ISO-8859-1 header errors on Chinese paths
  if (isAsciiOnly) {
    headers['X-Addons-Path'] = addonsPath;
  }

  const res = await fetch(`${AGENT_BASE}/api/install-zip?path=${encodedPath}`, {
    method: 'POST',
    headers,
    body: zipBlob,
  });
  if (!res.ok) {
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
