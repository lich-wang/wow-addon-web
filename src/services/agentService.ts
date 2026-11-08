import type { AddonInfo } from '../types/addon';

const AGENT_BASE = 'http://127.0.0.1:24642';

export interface WowInstallation {
  name: string;
  flavor: string;
  addonsPath: string;
  gameRoot: string;
}

export interface AgentStatus {
  status: 'ok';
  version: string;
  platform: string;
  installations: WowInstallation[];
}

export const GITHUB_RELEASES_URL = 'https://github.com/lich-wang/wow-addon-web/releases';
export const WIN_DOWNLOAD_URL = 'https://github.com/lich-wang/wow-addon-web/releases/latest/download/wow-addon-agent-windows-x64.zip';
export const MAC_DOWNLOAD_URL = 'https://github.com/lich-wang/wow-addon-web/releases/latest/download/wow-addon-agent-macos-universal.zip';

/**
 * Check if the native local bridge agent is running on 127.0.0.1:24642
 */
export async function checkAgentStatus(): Promise<AgentStatus | null> {
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
    // Agent is not active or blocked
  }
  return null;
}

/**
 * Open native OS directory picker dialog via agent
 */
export async function agentPickFolder(): Promise<string | null> {
  const res = await fetch(`${AGENT_BASE}/api/pick-folder`, { method: 'POST' });
  if (!res.ok) throw new Error('本地助手选择目录失败');
  const data = await res.json();
  if (data.success && data.path) {
    return data.path;
  }
  return null;
}

/**
 * Scan addons inside folder via native agent
 */
export async function agentScanAddons(addonsPath: string): Promise<AddonInfo[]> {
  const res = await fetch(`${AGENT_BASE}/api/addons?path=${encodeURIComponent(addonsPath)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '本地助手扫描目录失败');
  }
  const data = await res.json();
  return (data.addons || []) as AddonInfo[];
}

/**
 * Delete an addon folder via agent
 */
export async function agentDeleteAddon(addonsPath: string, folderName: string): Promise<void> {
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
 * Install addon ZIP directly via agent
 */
export async function agentInstallZip(addonsPath: string, zipBlob: Blob): Promise<number> {
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
