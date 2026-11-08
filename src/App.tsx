import { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { DirectoryBanner } from './components/DirectoryBanner';
import { AddonList } from './components/AddonList';
import { AddonMarket } from './components/AddonMarket';
import { AddonDetailModal } from './components/AddonDetailModal';
import { ZipInstallModal } from './components/ZipInstallModal';
import { ShareModal } from './components/ShareModal';
import { DeployModal } from './components/DeployModal';
import { ProgressModal } from './components/ProgressModal';

import type { AddonInfo, CuratedAddon, DirectoryState, InstallProgress } from './types/addon';
import {
  pickAddOnsDirectory,
  getSavedDirectoryHandle,
  verifyPermission,
  scanAddOns,
  deleteAddon,
  installAddonFromZip,
  clearSavedDirectoryHandle,
} from './services/fsService';
import { downloadAndInstallAddon } from './services/catalogService';
import { Loader2, FolderSync } from 'lucide-react';

export function App() {
  const [directoryState, setDirectoryState] = useState<DirectoryState>({
    handle: null,
    folderName: '',
    fullPathHint: '',
    isAuthorized: false,
    flavor: 'retail',
    addonCount: 0,
  });

  const [addons, setAddons] = useState<AddonInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [needsResumeAuth, setNeedsResumeAuth] = useState(false);
  const [activeTab, setActiveTab] = useState<'installed' | 'market'>('installed');

  // Modals state
  const [selectedAddonDetail, setSelectedAddonDetail] = useState<AddonInfo | null>(null);
  const [isZipModalOpen, setIsZipModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);

  // Install Progress State
  const [installProgress, setInstallProgress] = useState<InstallProgress>({
    status: 'idle',
    addonName: '',
    percent: 0,
    message: '',
  });

  // Scan current directory handle
  const loadAddons = useCallback(async (handle: FileSystemDirectoryHandle) => {
    setIsLoading(true);
    try {
      const list = await scanAddOns(handle);
      setAddons(list);
      setDirectoryState((prev) => ({
        ...prev,
        addonCount: list.length,
      }));
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Try auto-restoring directory from IndexedDB on startup
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
            folderName: savedHandle.name,
            fullPathHint: `.../${savedHandle.name}`,
            isAuthorized: true,
            flavor: 'retail',
            addonCount: 0,
          });
          await loadAddons(savedHandle);
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
  }, [loadAddons]);

  // Request directory permission on user click
  const handlePickDirectory = async () => {
    try {
      const resolved = await pickAddOnsDirectory();
      setDirectoryState({
        handle: resolved.handle,
        folderName: resolved.handle.name,
        fullPathHint: resolved.pathHint,
        isAuthorized: true,
        flavor: resolved.flavor,
        addonCount: 0,
      });
      setNeedsResumeAuth(false);
      await loadAddons(resolved.handle);
    } catch (err: any) {
      console.error('Directory pick error:', err);
      alert(err.message || '选择目录失败，请重试');
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
        await loadAddons(directoryState.handle);
      } else {
        await clearSavedDirectoryHandle();
        setNeedsResumeAuth(false);
        setDirectoryState((prev) => ({ ...prev, handle: null, isAuthorized: false }));
      }
    } catch {
      handlePickDirectory();
    }
  };

  // Delete an addon
  const handleDeleteAddon = async (folderName: string, name: string) => {
    if (!directoryState.handle) return;
    const confirmed = window.confirm(
      `确定要彻底从魔兽本地目录中删除插件 [${name}] (${folderName}) 吗？\n删除后不可撤销。`
    );
    if (!confirmed) return;

    try {
      await deleteAddon(directoryState.handle, folderName);
      await loadAddons(directoryState.handle);
    } catch (err: any) {
      alert(`删除插件失败: ${err.message || '未知错误'}`);
    }
  };

  // Install Curated Addon from Market
  const handleInstallCuratedAddon = async (addon: CuratedAddon) => {
    if (!directoryState.handle) {
      handlePickDirectory();
      return;
    }

    try {
      await downloadAndInstallAddon(addon, directoryState.handle, (p) => {
        setInstallProgress(p);
      });
      await loadAddons(directoryState.handle);
    } catch (err: any) {
      setInstallProgress({
        status: 'error',
        addonName: addon.name,
        percent: 0,
        message: err.message || '安装过程中发生异常',
      });
    }
  };

  // Install Local ZIP file
  const handleInstallZip = async (file: File) => {
    if (!directoryState.handle) {
      handlePickDirectory();
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      await installAddonFromZip(directoryState.handle, buffer, (p) => {
        setInstallProgress(p);
      });
      await loadAddons(directoryState.handle);
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
        onRefreshDirectory={() => directoryState.handle && loadAddons(directoryState.handle)}
        onOpenZipModal={() => setIsZipModalOpen(true)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onOpenDeployModal={() => setIsDeployModalOpen(true)}
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

        {/* Directory Banner when not authorized */}
        {!directoryState.isAuthorized && !needsResumeAuth && (
          <DirectoryBanner onPickDirectory={handlePickDirectory} />
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
                />
              ) : (
                <div className="text-center py-12 p-6 rounded-2xl bg-slate-900/40 border border-slate-800">
                  <h3 className="text-lg font-bold text-slate-300 mb-2">尚未连接魔兽世界插件目录</h3>
                  <p className="text-xs text-slate-400 mb-5">
                    请在上方点击“选择魔兽世界 AddOns 目录”开始扫描本地已装插件。
                  </p>
                  <button
                    onClick={handlePickDirectory}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition-all cursor-pointer"
                  >
                    立即选择本地目录
                  </button>
                </div>
              )
            ) : (
              <AddonMarket
                installedAddons={addons}
                hasDirectory={directoryState.isAuthorized}
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
    </div>
  );
}

export default App;
