import React, { useState } from 'react';
import {
  Download,
  X,
  ShieldCheck,
  ExternalLink,
  Laptop,
  CheckCircle2,
} from 'lucide-react';
import { WIN_DOWNLOAD_URL, MAC_DOWNLOAD_URL, GITHUB_RELEASES_URL } from '../services/agentService';

interface ClientDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ClientDownloadModal: React.FC<ClientDownloadModalProps> = ({ isOpen, onClose }) => {
  const [userOS] = useState<'windows' | 'mac' | 'other'>(() => {
    if (typeof window !== 'undefined') {
      const ua = window.navigator.userAgent.toLowerCase();
      if (ua.includes('win')) return 'windows';
      if (ua.includes('mac')) return 'mac';
    }
    return 'windows';
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>下载魔兽插件管理器客户端</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                  本站高速直链 · 免登录
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                直接从本站极速下载，无需跳转 GitHub，双击即用
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Why use client note */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 flex items-start space-x-3">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-slate-200 font-medium">为什么推荐下载桌面客户端？</p>
              <p className="text-slate-400 leading-relaxed">
                若魔兽安装在系统盘（如 <code className="text-amber-300/90 font-mono">C:\Program Files</code>），浏览器会强制安全拦截；桌面端为单文件绿色版，彻底解除权限阻拦，自动检测魔兽运行并一键安装。
              </p>
            </div>
          </div>

          {/* Download cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Windows Card */}
            <div
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                userOS === 'windows'
                  ? 'bg-gradient-to-b from-amber-950/20 to-slate-900 border-amber-500/50 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/20'
                  : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-bold text-white flex items-center gap-1.5">
                    <span>🪟 Windows 客户端</span>
                  </span>
                  {userOS === 'windows' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                      推荐您的系统
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  单文件绿色免安装版，约 11.6 MB。下载后双击直接运行，自动识别所有魔兽版本。
                </p>
              </div>

              <div className="space-y-2 mt-2">
                <a
                  href={WIN_DOWNLOAD_URL}
                  download="WoW-Addon-Manager.exe"
                  className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all hover:scale-101 active:scale-99 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>本站直接下载 (.exe)</span>
                </a>
                <span className="block text-center text-[10px] text-slate-500">
                  绿色免安装 · 双击即可启动
                </span>
              </div>
            </div>

            {/* macOS Card */}
            <div
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                userOS === 'mac'
                  ? 'bg-gradient-to-b from-blue-950/20 to-slate-900 border-blue-500/50 shadow-lg shadow-blue-500/5 ring-1 ring-blue-500/20'
                  : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-bold text-white flex items-center gap-1.5">
                    <span>🍎 macOS 客户端</span>
                  </span>
                  {userOS === 'mac' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500 text-white">
                      推荐您的系统
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  通用架构 DMG 安装包，约 8.5 MB。原生支持 Apple Silicon (M1~M4) 及 Intel Mac。
                </p>
              </div>

              <div className="space-y-2 mt-2">
                <a
                  href={MAC_DOWNLOAD_URL}
                  download="WoW-Addon-Manager.dmg"
                  className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all hover:scale-101 active:scale-99 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>本站直接下载 (.dmg)</span>
                </a>
                <span className="block text-center text-[10px] text-slate-500">
                  通用安装包 · 支持所有 Mac
                </span>
              </div>
            </div>
          </div>

          {/* Quick instructions */}
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>本站直连 CDN 高速下载，不限速无需魔法</span>
            </span>

            <a
              href={GITHUB_RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <span>GitHub Releases 备用渠道</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
