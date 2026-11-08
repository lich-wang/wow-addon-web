import React from 'react';
import {
  FolderCheck,
  ShieldCheck,
  Zap,
  HardDrive,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';
import { isFileSystemAccessSupported } from '../services/fsService';

interface DirectoryBannerProps {
  onPickDirectory: () => void;
}

export const DirectoryBanner: React.FC<DirectoryBannerProps> = ({ onPickDirectory }) => {
  const isSupported = isFileSystemAccessSupported();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 via-slate-900/60 to-slate-950 p-6 md:p-10 mb-8 shadow-2xl">
      {/* Background glow */}
      <div className="absolute top-0 right-1/4 -mt-16 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 -mb-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-3xl">
        {/* Tag */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-4">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>全新纯 Web 架构 · 零客户端依赖</span>
        </div>

        {/* Main Heading */}
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3">
          魔兽世界本地插件 · 在线智能管理器
        </h1>

        <p className="text-slate-300 text-base md:text-lg leading-relaxed mb-6">
          利用现代浏览器直读写本地技术，
          <strong className="text-amber-400 font-semibold"> 无需下载安装任何电脑客户端</strong>。
          直接在网页端扫描插件、查看版本、一键解压安装常用插件与备份清单。
        </p>

        {/* Compatibility Alert if unsupported */}
        {!isSupported && (
          <div className="flex items-start space-x-3 p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 mb-6">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-rose-200">当前浏览器不支持文件系统直接访问</p>
              <p className="text-rose-300/90 mt-1">
                此功能基于 File System Access API。请使用基于 Chromium 的现代浏览器（如
                <strong> Google Chrome</strong>、<strong>Microsoft Edge</strong> 或 <strong>Brave</strong>）打开。
              </p>
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <button
            onClick={onPickDirectory}
            disabled={!isSupported}
            className={`flex items-center space-x-3 px-6 py-3.5 rounded-xl font-bold text-base shadow-xl transition-all ${
              isSupported
                ? 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-amber-500/25 hover:scale-102 active:scale-98 cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <FolderOpen className="w-5 h-5" />
            <span>选择魔兽世界 AddOns 目录</span>
          </button>

          <span className="text-xs text-slate-400 font-mono">
            提示：可选择根目录、_retail_ 或直接选择 AddOns 文件夹
          </span>
        </div>

        {/* 3 Pillars / Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-800/80">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-200">100% 本地安全保护</h4>
              <p className="text-xs text-slate-400 mt-1">
                所有解压与读取全在浏览器沙箱内完成，不上传个人游戏账号数据。
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-200">直读 TOC 与版本</h4>
              <p className="text-xs text-slate-400 mt-1">
                智能解析魔兽插件 TOC 元数据、作者、依赖关系与支持的游戏版本。
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <FolderCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-200">一键解压并安装</h4>
              <p className="text-xs text-slate-400 mt-1">
                支持拖拽本地 ZIP 压缩包或在常用市场一键下载，直连本地目录解压。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
