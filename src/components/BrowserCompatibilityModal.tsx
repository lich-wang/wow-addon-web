import React, { useState } from 'react';
import {
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  Globe,
  Zap,
  Laptop,
  ArrowRight,
  X,
  ShieldAlert,
} from 'lucide-react';
import type { BrowserCompatibilityResult } from '../services/browserDetector';

interface BrowserCompatibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  compatibility: BrowserCompatibilityResult;
  onContinueBrowsing: () => void;
  onOpenClientModal?: () => void;
}

export const BrowserCompatibilityModal: React.FC<BrowserCompatibilityModalProps> = ({
  isOpen,
  onClose,
  compatibility,
  onContinueBrowsing,
  onOpenClientModal,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyUrl = async () => {
    try {
      if (typeof window !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Fallback prompt if clipboard api is restricted
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isTauriIssue = compatibility.reason === 'tauri_no_permission';
  const isMobile = compatibility.isMobile || compatibility.reason === 'mobile_unsupported';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compat-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 p-5 sm:p-7 shadow-2xl text-slate-100">
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors cursor-pointer"
          aria-label="关闭"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Section */}
        <div className="flex items-start space-x-3.5 mb-5">
          <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
            {isTauriIssue ? (
              <ShieldAlert className="w-6 h-6 text-rose-400" />
            ) : isMobile ? (
              <Laptop className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>
          <div className="min-w-0 pr-6">
            <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 mb-1.5">
              <span>当前检测：{compatibility.browserName}</span>
            </div>
            <h2 id="compat-modal-title" className="text-lg sm:text-xl font-bold text-slate-100 leading-snug">
              {isTauriIssue
                ? '客户端未获得原生系统权限'
                : isMobile
                ? '推荐在电脑端 Chrome / Edge 中访问'
                : '推荐使用 Chrome 或 Edge 浏览器'}
            </h2>
          </div>
        </div>

        {/* Description */}
        <div className="text-xs sm:text-sm text-slate-300 space-y-2 mb-5 leading-relaxed bg-slate-950/50 p-3.5 rounded-xl border border-slate-800">
          {isTauriIssue ? (
            <p>
              检测到您正在桌面端环境中运行，但当前客户端版本未开启原生 IPC 权限或远程源受限。您可以直接下载运行我们的独立绿色助手，或换用 Chrome 浏览器管理。
            </p>
          ) : isMobile ? (
            <p>
              魔兽世界插件需直接存放于您电脑的游戏目录中。当前移动设备无法直接读写本地魔兽目录，推荐将本站分享到电脑桌面端打开。
            </p>
          ) : (
            <p>
              本站采用现代浏览器底层 <strong className="text-amber-300">File System Access API</strong> 技术，无需任何全家桶即可在网页里直接读取、汉化与更新魔兽插件。您当前的浏览器内核不支持此项功能。
            </p>
          )}
        </div>

        {/* Recommended Solutions */}
        {!isTauriIssue && !isMobile && (
          <div className="space-y-2.5 mb-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              推荐打开方式
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <a
                href="https://www.google.cn/chrome/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/50 transition-all group cursor-pointer"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 font-bold text-xs">
                    G
                  </div>
                  <div className="truncate">
                    <p className="font-bold text-xs sm:text-sm text-slate-200 group-hover:text-amber-300">
                      Google Chrome
                    </p>
                    <p className="text-[10px] text-slate-400">官方极速体验</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-amber-300 shrink-0 ml-1" />
              </a>

              <a
                href="https://www.microsoft.com/edge"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-sky-500/50 transition-all group cursor-pointer"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 font-bold text-xs">
                    E
                  </div>
                  <div className="truncate">
                    <p className="font-bold text-xs sm:text-sm text-slate-200 group-hover:text-sky-300">
                      Microsoft Edge
                    </p>
                    <p className="text-[10px] text-slate-400">Windows 自带直接用</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-sky-300 shrink-0 ml-1" />
              </a>
            </div>

            {/* Hint for Dual-engine browsers */}
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px] text-slate-400 flex items-center space-x-2">
              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                若使用 360/QQ/搜狗 浏览器，请在地址栏右侧切换为 <strong className="text-amber-300">极速模式（闪电图标）</strong> 即可正常使用。
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          {/* Main Action: Copy current URL */}
          <button
            onClick={handleCopyUrl}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-md shadow-amber-500/20 transition-all hover:scale-100.5 active:scale-99.5 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-950" />
                <span>网址已复制！请到 Chrome / Edge 粘贴打开</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>复制本站网址（前往 Chrome / Edge 打开）</span>
              </>
            )}
          </button>

          {/* Secondary Action: Fallback to Market only (Plan C Core) */}
          <button
            onClick={onContinueBrowsing}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl font-semibold text-xs sm:text-sm bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-slate-100 transition-all cursor-pointer"
          >
            <Globe className="w-4 h-4 text-slate-400" />
            <span>我仅需浏览市场 & 手动下载 ZIP（继续访问）</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {onOpenClientModal && (
            <button
              onClick={() => {
                onClose();
                onOpenClientModal();
              }}
              className="w-full text-center text-xs text-amber-400/90 hover:text-amber-300 underline pt-1 cursor-pointer"
            >
              或下载桌面客户端 / 本地极速助手（解除所有浏览器限制）
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
