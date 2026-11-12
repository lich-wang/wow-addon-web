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
 */
export async function fetchClientReleaseInfo(forceRefresh = false): Promise<ClientReleaseInfo> {
  const now = Date.now();
  if (!forceRefresh && cachedClientRelease && now - cachedClientRelease.timestamp < CACHE_TTL_MS) {
    return cachedClientRelease.data;
  }

  try {
    const res = await fetch(`/downloads/client-version.json?_t=${now}`, { cache: 'no-cache' });
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

/**
 * Check if the native local bridge agent is running on 127.0.0.1:24642,
 * or connect directly via Tauri native IPC if inside desktop app.
 */
export async function checkAgentStatus(): Promise<AgentStatus | null> {
  if (isTauriEnv()) {
    try {
      const res = await invoke<AgentStatus>('ping');
      return res;
    } catch (e) {
      console.warn('Tauri ping error:', e);
    }
  }

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
      return (await res.json()) as AgentStatus;
    }
  } catch {
    // Agent is not active or blocked by browser
  }
  return null;
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

  const res = await fetch(`${AGENT_BASE}/api/install-zip`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/zip',
      'X-Addons-Path': addonsPath,
    },
    body: zipBlob,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
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
