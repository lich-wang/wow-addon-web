import React from 'react';
import {
  FolderOpen,
  UploadCloud,
  Share2,
  CloudLightning,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { GithubIcon } from './icons/GithubIcon';
import type { DirectoryState } from '../types/addon';

interface NavbarProps {
  directoryState: DirectoryState;
  activeTab: 'installed' | 'market';
  setActiveTab: (tab: 'installed' | 'market') => void;
  onPickDirectory: () => void;
  onRefreshDirectory: () => void;
  onOpenZipModal: () => void;
  onOpenShareModal: () => void;
  onOpenDeployModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  directoryState,
  activeTab,
  setActiveTab,
  onPickDirectory,
  onRefreshDirectory,
  onOpenZipModal,
  onOpenShareModal,
  onOpenDeployModal,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Navigation */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3 cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 p-0.5 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-amber-400 font-black tracking-wider text-lg">
                  W
                </div>
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-amber-300 via-amber-200 to-yellow-400 bg-clip-text text-transparent">
                  WoW Addon Web
                </span>
                <span className="hidden sm:inline-block ml-2 text-xs text-amber-500/80 font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                  纯网页端
                </span>
              </div>
            </div>

            {/* Nav Tabs */}
            <nav className="hidden md:flex space-x-1">
              <button
                onClick={() => setActiveTab('installed')}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'installed'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                已装插件 {directoryState.handle ? `(${directoryState.addonCount})` : ''}
              </button>
              <button
                onClick={() => setActiveTab('market')}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'market'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                常用插件市场
              </button>
            </nav>
          </div>

          {/* Directory Status & Actions */}
          <div className="flex items-center space-x-3">
            {directoryState.handle ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={onRefreshDirectory}
                  title="重新扫描目录"
                  className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <div
                  onClick={onPickDirectory}
                  title="点击切换目录"
                  className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-mono cursor-pointer hover:border-emerald-500/60 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="truncate max-w-[160px]">{directoryState.fullPathHint}</span>
                </div>
              </div>
            ) : (
              <button
                onClick={onPickDirectory}
                className="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold shadow-md shadow-amber-500/20 transition-all hover:scale-102 cursor-pointer"
              >
                <FolderOpen className="w-4 h-4" />
                <span>选择魔兽目录</span>
              </button>
            )}

            {/* Drag & Drop ZIP Install Button */}
            <button
              onClick={onOpenZipModal}
              title="本地 ZIP 插件安装"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">安装 ZIP</span>
            </button>

            {/* Share / Backup Button */}
            <button
              onClick={onOpenShareModal}
              title="导出/导入插件配置清单"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {/* Cloudflare Deploy Guide Button */}
            <button
              onClick={onOpenDeployModal}
              title="一键部署到 Cloudflare"
              className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-orange-950/40 border border-orange-500/30 text-orange-300 hover:bg-orange-900/30 text-xs font-medium transition-colors cursor-pointer"
            >
              <CloudLightning className="w-3.5 h-3.5 text-orange-400" />
              <span>部署教程</span>
            </button>

            {/* GitHub Repo */}
            <a
              href="https://github.com/lich-wang/wow-addon-web"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHub 开源仓库"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <GithubIcon className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="flex md:hidden border-t border-slate-800/80 py-2 space-x-2">
          <button
            onClick={() => setActiveTab('installed')}
            className={`flex-1 py-1.5 text-center text-xs rounded-md ${
              activeTab === 'installed'
                ? 'bg-amber-500/20 text-amber-300 font-medium'
                : 'text-slate-400'
            }`}
          >
            已装插件 ({directoryState.addonCount})
          </button>
          <button
            onClick={() => setActiveTab('market')}
            className={`flex-1 py-1.5 text-center text-xs rounded-md ${
              activeTab === 'market'
                ? 'bg-amber-500/20 text-amber-300 font-medium'
                : 'text-slate-400'
            }`}
          >
            常用插件市场
          </button>
        </div>
      </div>
    </header>
  );
};
