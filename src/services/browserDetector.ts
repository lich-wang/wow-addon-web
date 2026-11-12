import { invoke } from '@tauri-apps/api/core';
import type { AgentStatus } from './agentService';
import { isTauriEnv } from './agentService';

const DISMISSED_SESSION_KEY = 'wow_addon_browser_check_dismissed_v1';

export type IncompatibilityReason =
  | 'tauri_no_permission'
  | 'mobile_unsupported'
  | 'unsupported_browser'
  | 'insecure_context';

export interface BrowserCompatibilityResult {
  isCompatible: boolean;
  reason?: IncompatibilityReason;
  browserName: string;
  isMobile: boolean;
  isFsSupported: boolean;
  isTauri: boolean;
  hasTauriPermission: boolean;
  isAgentConnected: boolean;
}

/**
 * Check if the browser supports File System Access API in a secure context
 */
export function isFileSystemAccessSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'showDirectoryPicker' in window &&
    (window.isSecureContext ?? true)
  );
}

/**
 * Detect if the client is running on a mobile or tablet device
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|Silk/i;
  const isTouchScreen = navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua); // iPadOS masquerading as Mac
  return mobileRegex.test(ua) || isTouchScreen;
}

/**
 * Identify browser name for user-friendly hints
 */
export function detectBrowserName(): string {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return '未知浏览器';

  const ua = navigator.userAgent;

  // WeChat
  if (/MicroMessenger/i.test(ua)) return '微信内置浏览器';
  // QQ Browser
  if (/MQQBrowser|QQBrowser/i.test(ua)) return 'QQ 浏览器';
  // 360 Browser
  if (/360SE|360EE|QIHU/i.test(ua)) return '360 浏览器';
  // Edge
  if (/Edg\//i.test(ua)) return 'Microsoft Edge';
  // Opera
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return 'Opera 浏览器';
  // Brave (navigator.brave)
  if ((navigator as unknown as { brave?: { isBrave?: () => Promise<boolean> } }).brave) return 'Brave 浏览器';
  // Chrome
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return 'Google Chrome';
  // Firefox
  if (/Firefox\//i.test(ua)) return 'Mozilla Firefox';
  // Safari (must check after Chrome/Edge because they contain Safari in UA)
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Apple Safari';

  return '非 Chromium 浏览器';
}

/**
 * Dynamically verify if Tauri IPC API permissions are available and functional
 */
let cachedTauriPermission: boolean | null = null;

export async function verifyTauriApiAccess(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!isTauriEnv()) return false;

  if (cachedTauriPermission !== null) {
    return cachedTauriPermission;
  }

  try {
    // Attempt to invoke the ping command with a 4s timeout (macOS disk/process scan may take >1s on cold start)
    const pingPromise = invoke<{ status: string }>('ping');
    const timeoutPromise = new Promise<{ status: string }>((_, reject) =>
      setTimeout(() => reject(new Error('Tauri IPC timeout (4000ms)')), 4000)
    );

    const res = await Promise.race([pingPromise, timeoutPromise]);
    const valid = res?.status === 'ok';
    cachedTauriPermission = valid;
    return valid;
  } catch (err) {
    console.warn('[BrowserDetector] Tauri detected but IPC call failed (lack of permissions or remote URL restricted):', err);
    // Do not permanently cache failure if it was a transient timeout, allowing subsequent retries
    if (err instanceof Error && err.message.includes('timeout')) {
      cachedTauriPermission = null;
    } else {
      cachedTauriPermission = false;
    }
    return false;
  }
}

/**
 * Reset cached Tauri verification result (useful for test/retry)
 */
export function resetTauriPermissionCache(): void {
  cachedTauriPermission = null;
}

/**
 * Comprehensive compatibility evaluation
 */
export async function evaluateBrowserCompatibility(
  agentStatus: AgentStatus | null
): Promise<BrowserCompatibilityResult> {
  const isTauri = isTauriEnv();
  const isMobile = isMobileDevice();
  const isFsSupported = isFileSystemAccessSupported();
  const browserName = detectBrowserName();
  const isAgentConnected = !!agentStatus;

  // 1. If in Tauri environment, dynamically check IPC permissions
  let hasTauriPermission = false;
  if (isTauri) {
    hasTauriPermission = await verifyTauriApiAccess();
    if (hasTauriPermission) {
      return {
        isCompatible: true,
        browserName: 'Tauri 客户端',
        isMobile: false,
        isFsSupported,
        isTauri: true,
        hasTauriPermission: true,
        isAgentConnected,
      };
    } else {
      // In Tauri container but lacks IPC permissions
      return {
        isCompatible: false,
        reason: 'tauri_no_permission',
        browserName: 'Tauri 客户端 (无API权限)',
        isMobile,
        isFsSupported,
        isTauri: true,
        hasTauriPermission: false,
        isAgentConnected,
      };
    }
  }

  // 2. If connected to local Agent (127.0.0.1:24642), user can manage files regardless of browser
  if (isAgentConnected) {
    return {
      isCompatible: true,
      browserName,
      isMobile,
      isFsSupported,
      isTauri: false,
      hasTauriPermission: false,
      isAgentConnected: true,
    };
  }

  // 3. Check mobile device
  if (isMobile) {
    return {
      isCompatible: false,
      reason: 'mobile_unsupported',
      browserName,
      isMobile: true,
      isFsSupported,
      isTauri: false,
      hasTauriPermission: false,
      isAgentConnected: false,
    };
  }

  // 4. Insecure context (HTTP instead of HTTPS/localhost)
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return {
      isCompatible: false,
      reason: 'insecure_context',
      browserName,
      isMobile: false,
      isFsSupported: false,
      isTauri: false,
      hasTauriPermission: false,
      isAgentConnected: false,
    };
  }

  // 5. Check desktop browser File System Access API
  if (!isFsSupported) {
    return {
      isCompatible: false,
      reason: 'unsupported_browser',
      browserName,
      isMobile: false,
      isFsSupported: false,
      isTauri: false,
      hasTauriPermission: false,
      isAgentConnected: false,
    };
  }

  // 6. Compatible desktop Chromium
  return {
    isCompatible: true,
    browserName,
    isMobile: false,
    isFsSupported: true,
    isTauri: false,
    hasTauriPermission: false,
    isAgentConnected: false,
  };
}

/**
 * Check if user has already dismissed this check in the current browser session
 */
export function isBrowserCheckDismissed(): boolean {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(DISMISSED_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Save user dismissal to sessionStorage
 */
export function dismissBrowserCheck(): void {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(DISMISSED_SESSION_KEY, 'true');
  } catch {
    // Ignore storage quota or access exceptions
  }
}
