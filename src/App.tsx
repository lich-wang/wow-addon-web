import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Loader2, FolderSync } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { DirectoryBanner } from './components/DirectoryBanner';
import { AddonList } from './components/AddonList';
import { AddonMarket } from './components/AddonMarket';
import { AddonDetailModal } from './components/AddonDetailModal';
import { ZipInstallModal } from './components/ZipInstallModal';
import { ShareModal } from './components/ShareModal';
import { DeployModal } from './components/DeployModal';
import { ProgressModal } from './components/ProgressModal';
import { ClientDownloadModal } from './components/ClientDownloadModal';
import { UpdateBanner, type OutdatedAddonItem } from './components/UpdateBanner';

import {
  pickAddOnsDirectory,
  getSavedDirectoryHandle,
  verifyPermission,
  clearSavedDirectoryHandle,
  scanAddOns,
  deleteAddon,
  installAddonFromZip,
} from './services/fsService';
import { groupAddons } from './services/addonGrouper';

import {
  downloadAndInstallAddon,
  enrichAddonsWithUpdateStatus,
  findMatchingCuratedAddon,
} from './services/catalogService';

import {
  checkAgentStatus,
  agentPickFolder,
  agentScanAddons,
  agentDeleteAddon,
  agentInstallZip,
  type AgentStatus,
  type WowInstallation,
} from './services/agentService';

import type { AddonInfo, CuratedAddon, DirectoryState, InstallProgress } from './types/addon';

export function App() {
  const [directoryState, setDirectoryState] = useState<DirectoryState>({
    handle: null,
    mode: 'browser',
    agentPath: '',
    folderName: '',
    fullPathHint: '',
    isAuthorized: false,
    flavor: 'retail',
    addonCount: 0,
  });

  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [addons, setAddons] = useState<AddonInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [needsResumeAuth, setNeedsResumeAuth] = useState(false);
  const [activeTab, setActiveTab] = useState<'installed' | 'market'>('market');

  const handleBrowseMarket = () => {
    setActiveTab('market');
    setTimeout(() => {
      document.getElementById('addon-market-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  // Modals state
  const [selectedAddonDetail, setSelectedAddonDetail] = useState<AddonInfo | null>(null);
  const [isZipModalOpen, setIsZipModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);

  // Install Progress State
  const [installProgress, setInstallProgress] = useState<InstallProgress>({
    status: 'idle',
    addonName: '',
    percent: 0,
    message: '',
  });

  // Check agent status on load and periodically
  useEffect(() => {
    let active = true;
    const pollAgent = async () => {
      const status = await checkAgentStatus();
      if (active) {
        setAgentStatus(status);
      }
    };

    pollAgent();
    const timer = setInterval(pollAgent, 3500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const scanSeqRef = useRef(0);

  // Scan current browser directory handle
  const loadBrowserAddons = useCallback(async (handle: FileSystemDirectoryHandle) => {
    const seq = ++scanSeqRef.current;
    setIsLoading(true);
    try {
      const list = await scanAddOns(handle);
      if (seq !== scanSeqRef.current) return;
      const grouped = groupAddons(list);
      const enriched = enrichAddonsWithUpdateStatus(grouped);
      setAddons(enriched);
      setDirectoryState((prev) => ({
        ...prev,
        addonCount: enriched.length,
      }));
    } catch (err) {
      console.error('Browser scan error:', err);
    } finally {
      if (seq === scanSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Scan addons via agent path
  const loadAgentAddons = useCallback(async (addonsPath: string) => {
    const seq = ++scanSeqRef.current;
    setIsLoading(true);
    try {
      const list = await agentScanAddons(addonsPath);
      if (seq !== scanSeqRef.current) return;
      const grouped = groupAddons(list);
      const enriched = enrichAddonsWithUpdateStatus(grouped);
      setAddons(enriched);
      setDirectoryState((prev) => ({
        ...prev,
        addonCount: enriched.length,
      }));
    } catch (err: any) {
      console.error('Agent scan error:', err);
      alert(`扫描目录失败: ${err.message || '未知错误'}`);
    } finally {
      if (seq === scanSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Select auto-discovered installation from agent
  const handleSelectAgentInstallation = async (inst: WowInstallation) => {
    setAddons([]);
    setDirectoryState({
      handle: null,
      mode: 'agent',
      agentPath: inst.addonsPath,
      folderName: inst.name,
      fullPathHint: inst.addonsPath,
      isAuthorized: true,
      flavor: (inst.flavor as any) || 'retail',
      addonCount: 0,
    });
    setNeedsResumeAuth(false);
    await loadAgentAddons(inst.addonsPath);
  };

  // Pick folder via native OS dialog through agent
  const handlePickAgentDirectory = async () => {
    try {
      const picked = await agentPickFolder();
      if (picked) {
        setAddons([]);
        setDirectoryState({
          handle: null,
          mode: 'agent',
          agentPath: picked,
          folderName: '魔兽 AddOns 目录',
          fullPathHint: picked,
          isAuthorized: true,
          flavor: 'retail',
          addonCount: 0,
        });
        setNeedsResumeAuth(false);
        await loadAgentAddons(picked);
      }
    } catch (err: any) {
      alert(`打开选择窗口失败: ${err.message || '未知错误'}`);
    }
  };

  // Try auto-restoring directory from IndexedDB on startup (Browser Mode)
  useEffect(() => {
    const restoreSession = async () => {
      const savedHandle = await getSavedDirectoryHandle();
      if (!savedHandle) return;

      try {
        // @ts-expect-error queryPermission exists in Chromium
        const perm = await savedHandle.queryPermission({ mode: 'readwrite' });
        if (perm === 'granted') {
          setDirectoryState({
            handle: savedHandle,
            mode: 'browser',
            agentPath: '',
            folderName: savedHandle.name,
            fullPathHint: `.../${savedHandle.name}`,
            isAuthorized: true,
            flavor: 'retail',
            addonCount: 0,
          });
          await loadBrowserAddons(savedHandle);
        } else {
          setNeedsResumeAuth(true);
          setDirectoryState((prev) => ({
            ...prev,
            handle: savedHandle,
            folderName: savedHandle.name,
            fullPathHint: `.../${savedHandle.name}`,
            isAuthorized: false,
          }));
        }
      } catch (err) {
        console.warn('Could not restore handle:', err);
      }
    };

    restoreSession();
  }, [loadBrowserAddons]);

  // Request directory permission on user click (Browser Mode)
  const handlePickDirectory = async () => {
    // If agent is active, prefer agent folder picker to avoid Chromium Program Files block!
    if (agentStatus) {
      await handlePickAgentDirectory();
      return;
    }

    if (isPicking) return;
    setIsPicking(true);
    try {
      const resolved = await pickAddOnsDirectory();
      setAddons([]);
      setDirectoryState({
        handle: resolved.handle,
        mode: 'browser',
        agentPath: '',
        folderName: resolved.handle.name,
        fullPathHint: resolved.pathHint,
        isAuthorized: true,
        flavor: resolved.flavor,
        addonCount: 0,
      });
      setNeedsResumeAuth(false);
      await loadBrowserAddons(resolved.handle);
    } catch (err: any) {
      console.error('Directory pick error:', err);
      alert(err.message || '选择目录失败，请重试');
    } finally {
      setIsPicking(false);
    }
  };

  // Resume permission for stored directory handle
  const handleResumePermission = async () => {
    if (!directoryState.handle) return;
    try {
      const granted = await verifyPermission(directoryState.handle);
      if (granted) {
        setDirectoryState((prev) => ({ ...prev, isAuthorized: true }));
        setNeedsResumeAuth(false);
        await loadBrowserAddons(directoryState.handle);
      } else {
        await clearSavedDirectoryHandle();
        setNeedsResumeAuth(false);
        setDirectoryState((prev) => ({ ...prev, handle: null, isAuthorized: false }));
      }
    } catch {
      handlePickDirectory();
    }
  };

  // Refresh current directory
  const handleRefreshCurrentDirectory = () => {
    if (directoryState.mode === 'agent' && directoryState.agentPath) {
      loadAgentAddons(directoryState.agentPath);
    } else if (directoryState.handle) {
      loadBrowserAddons(directoryState.handle);
    }
  };

  // Delete an addon (handles both single folder and multi-folder bundles)
  const handleDeleteAddon = async (folderName: string, name: string, subFolders?: string[]) => {
    const allFolders = [folderName, ...(subFolders || [])];
    const foldersDesc =
      allFolders.length > 1
        ? `\n\n该插件组合由 ${allFolders.length} 个关联组件目录组成，将一并彻底删除：\n${allFolders.map((f) => ` • ${f}`).join('\n')}`
        : ` (${folderName})`;

    const confirmed = window.confirm(
      `确定要彻底从魔兽本地目录中删除插件 [${name}] 吗？${foldersDesc}\n\n删除后不可撤销。`
    );
    if (!confirmed) return;

    try {
      for (const folder of allFolders) {
        if (directoryState.mode === 'agent' && directoryState.agentPath) {
          await agentDeleteAddon(directoryState.agentPath, folder);
        } else if (directoryState.handle) {
          await deleteAddon(directoryState.handle, folder);
        }
      }
      if (directoryState.mode === 'agent' && directoryState.agentPath) {
        await loadAgentAddons(directoryState.agentPath);
      } else if (directoryState.handle) {
        await loadBrowserAddons(directoryState.handle);
      }
    } catch (err: any) {
      alert(`删除插件失败: ${err.message || '未知错误'}`);
    }
  };

  const [isUpdatingBusy, setIsUpdatingBusy] = useState(false);

  // Install Curated Addon from Market
  const handleInstallCuratedAddon = async (addon: CuratedAddon) => {
    if (!directoryState.isAuthorized) {
      handlePickDirectory();
      return;
    }
    if (isUpdatingBusy) return;
    setIsUpdatingBusy(true);

    try {
      if (directoryState.mode === 'agent' && directoryState.agentPath) {
        setInstallProgress({
          status: 'downloading',
          addonName: addon.name,
          percent: 25,
          message: `正在从 wow.lich.tech 下载 ${addon.name}...`,
        });

        const url = addon.downloadUrl.startsWith('http')
          ? addon.downloadUrl
          : `https://wow.lich.tech${addon.downloadUrl}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`下载失败 (HTTP ${res.status})`);
        const blob = await res.blob();

        setInstallProgress({
          status: 'writing',
          addonName: addon.name,
          percent: 75,
          message: `正在写入本地 AddOns 目录...`,
        });

        await agentInstallZip(directoryState.agentPath, blob);

        setInstallProgress({
          status: 'completed',
          addonName: addon.name,
          percent: 100,
          message: `插件 ${addon.name} 安装成功！`,
        });

        await loadAgentAddons(directoryState.agentPath);
      } else if (directoryState.handle) {
        await downloadAndInstallAddon(addon, directoryState.handle, (p: InstallProgress) => {
          setInstallProgress(p);
        });
        await loadBrowserAddons(directoryState.handle);
      }
    } catch (err: any) {
      setInstallProgress({
        status: 'error',
        addonName: addon.name,
        percent: 0,
        message: err.message || '安装过程中发生异常',
      });
    } finally {
      setIsUpdatingBusy(false);
    }
  };

  // Filter outdated items
  const outdatedItems = useMemo<OutdatedAddonItem[]>(() => {
    const list: OutdatedAddonItem[] = [];
    for (const addon of addons) {
      if (addon.status === 'update-available') {
        const curated = findMatchingCuratedAddon(addon);
        if (curated) {
          list.push({ addon, curated });
        }
      }
    }
    return list;
  }, [addons]);

  // Batch update all outdated addons
  const handleUpdateAllOutdated = async () => {
    if (outdatedItems.length === 0 || isUpdatingBusy) return;
    setIsUpdatingBusy(true);
    let updatedCount = 0;
    try {
      for (let i = 0; i < outdatedItems.length; i++) {
        const { curated } = outdatedItems[i];
        setInstallProgress({
          status: 'downloading',
          addonName: curated.name,
          percent: Math.round(((i) / outdatedItems.length) * 100),
          message: `[${i + 1}/${outdatedItems.length}] 正在下载更新: ${curated.name}...`,
        });

        if (directoryState.mode === 'agent' && directoryState.agentPath) {
          const url = curated.downloadUrl.startsWith('http')
            ? curated.downloadUrl
            : `https://wow.lich.tech${curated.downloadUrl}`;
          const res = await fetch(url);
          if (!res.ok) throw new Error(`下载 ${curated.name} 失败 (HTTP ${res.status})`);
          const blob = await res.blob();
          await agentInstallZip(directoryState.agentPath, blob);
        } else if (directoryState.handle) {
          await downloadAndInstallAddon(curated, directoryState.handle, (p) => {
            setInstallProgress({
              ...p,
              message: `[${i + 1}/${outdatedItems.length}] ${p.message}`,
            });
          });
        }
        updatedCount++;
      }

      setInstallProgress({
        status: 'completed',
        addonName: '所有过期插件',
        percent: 100,
        message: `成功完成 ${outdatedItems.length} 个插件的批量更新！`,
      });
    } catch (err: any) {
      setInstallProgress({
        status: 'error',
        addonName: '批量更新',
        percent: 0,
        message: err.message || '批量更新时发生异常',
      });
    } finally {
      // 无论成功或部分更新失败，只要有安装变动均刷新目录状态，确保已写入项不重复展示为待更新
      if (directoryState.mode === 'agent' && directoryState.agentPath) {
        await loadAgentAddons(directoryState.agentPath);
      } else if (directoryState.handle) {
        await loadBrowserAddons(directoryState.handle);
      }
      setIsUpdatingBusy(false);
    }
  };

  // Install Local ZIP file
  const handleInstallZip = async (file: File) => {
    if (!directoryState.isAuthorized) {
      handlePickDirectory();
      return;
    }

    try {
      if (directoryState.mode === 'agent' && directoryState.agentPath) {
        setInstallProgress({
          status: 'writing',
          addonName: file.name,
          percent: 50,
          message: `本地助手正在解压写入 ${file.name}...`,
        });

        await agentInstallZip(directoryState.agentPath, file);

        setInstallProgress({
          status: 'completed',
          addonName: file.name,
          percent: 100,
          message: `安装成功！`,
        });

        await loadAgentAddons(directoryState.agentPath);
      } else if (directoryState.handle) {
        const buffer = await file.arrayBuffer();
        await installAddonFromZip(directoryState.handle, buffer, (p) => {
          setInstallProgress(p);
        });
        await loadBrowserAddons(directoryState.handle);
      }
    } catch (err: any) {
      setInstallProgress({
        status: 'error',
        addonName: file.name,
        percent: 0,
        message: err.message || '解压或写入失败',
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        directoryState={directoryState}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onPickDirectory={handlePickDirectory}
        onRefreshDirectory={handleRefreshCurrentDirectory}
        onOpenZipModal={() => setIsZipModalOpen(true)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onOpenDeployModal={() => setIsDeployModalOpen(true)}
        onOpenClientModal={() => setIsClientModalOpen(true)}
        isPicking={isPicking}
        agentStatus={agentStatus}
        outdatedCount={outdatedItems.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Banner if resume permission needed */}
        {needsResumeAuth && (
          <div className="mb-6 p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 flex items-center justify-between text-amber-200">
            <div className="flex items-center space-x-3">
              <FolderSync className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="text-sm">
                <span className="font-bold">检测到上次连接的插件目录：</span>
                <span className="font-mono ml-1 text-amber-300">{directoryState.folderName}</span>
                <p className="text-xs text-amber-300/80 mt-0.5">
                  浏览器安全机制要求每次重新打开网页时点击一次恢复授权。
                </p>
              </div>
            </div>
            <button
              onClick={handleResumePermission}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all hover:scale-102 cursor-pointer shrink-0 ml-4"
            >
              一键恢复授权
            </button>
          </div>
        )}

        {/* Update Banner when outdated addons exist */}
        {directoryState.isAuthorized && outdatedItems.length > 0 && (
          <UpdateBanner
            directoryKey={directoryState.agentPath || directoryState.folderName}
            outdatedItems={outdatedItems}
            onUpdateSingle={handleInstallCuratedAddon}
            onUpdateAll={handleUpdateAllOutdated}
            onViewInstalledTab={() => setActiveTab('installed')}
            isUpdatingAll={isUpdatingBusy}
          />
        )}

        {/* Directory Banner when not authorized */}
        {!directoryState.isAuthorized && !needsResumeAuth && (
          <DirectoryBanner
            onPickDirectory={handlePickDirectory}
            isPicking={isPicking}
            agentStatus={agentStatus}
            onSelectAgentInstallation={handleSelectAgentInstallation}
            onPickAgentDirectory={handlePickAgentDirectory}
            onOpenClientModal={() => setIsClientModalOpen(true)}
          />
        )}

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin mx-auto" />
            <p className="text-sm text-slate-400 font-mono">正在扫描本地插件目录并解析 TOC 元数据...</p>
          </div>
        ) : (
          <>
            {activeTab === 'installed' ? (
              directoryState.isAuthorized ? (
                <AddonList
                  addons={addons}
                  onDeleteAddon={handleDeleteAddon}
                  onSelectAddonDetail={(addon) => setSelectedAddonDetail(addon)}
                  onUpdateAddon={handleInstallCuratedAddon}
                />
              ) : (
                <div className="text-center py-12 p-6 rounded-2xl bg-slate-900/40 border border-slate-800">
                  <h3 className="text-lg font-bold text-slate-300 mb-2">尚未连接魔兽世界插件目录</h3>
                  <p className="text-xs text-slate-400 mb-5">
                    您可以选择本地 AddOns 目录进行插件扫描与一键安装，或直接前往插件市场免设置下载插件 ZIP 包。
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={handlePickDirectory}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition-all cursor-pointer"
                    >
                      立即选择本地目录
                    </button>
                    <button
                      onClick={handleBrowseMarket}
                      className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-bold text-xs shadow-lg transition-all cursor-pointer"
                    >
                      免设置 · 直接去市场下载插件 ZIP
                    </button>
                  </div>
                </div>
              )
            ) : (
              <AddonMarket
                installedAddons={addons}
                hasDirectory={directoryState.isAuthorized}
                currentFlavor={directoryState.flavor}
                onInstallAddon={handleInstallCuratedAddon}
                onPromptPickDirectory={handlePickDirectory}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>
            WoW Web Addon Manager · 遵循 MIT 开源协议 · 专为魔兽世界玩家打造
          </p>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsDeployModalOpen(true)}
              className="text-amber-500 hover:underline cursor-pointer"
            >
              Cloudflare Pages 免费部署
            </button>
            <span>•</span>
            <a
              href="https://github.com/lich-wang/wow-addon-web"
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-slate-200"
            >
              GitHub 仓库
            </a>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AddonDetailModal
        addon={selectedAddonDetail}
        onClose={() => setSelectedAddonDetail(null)}
        onDelete={handleDeleteAddon}
      />

      <ZipInstallModal
        isOpen={isZipModalOpen}
        onClose={() => setIsZipModalOpen(false)}
        onInstallZip={handleInstallZip}
        hasDirectory={directoryState.isAuthorized}
        onPromptPickDirectory={handlePickDirectory}
      />

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        installedAddons={addons}
      />

      <DeployModal
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
      />

      <ProgressModal
        progress={installProgress}
        onClose={() => setInstallProgress((p) => ({ ...p, status: 'idle' }))}
      />

      <ClientDownloadModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
      />
    </div>
  );
}

export default App;
