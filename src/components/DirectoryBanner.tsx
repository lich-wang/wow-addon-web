import React, { useState } from 'react';
import {
  ShieldCheck,
  Zap,
  HardDrive,
  AlertTriangle,
  FolderOpen,
  Download,
  Terminal,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { isFileSystemAccessSupported } from '../services/fsService';
import type { AgentStatus, WowInstallation } from '../services/agentService';
import { WIN_DOWNLOAD_URL, MAC_DOWNLOAD_URL, GITHUB_RELEASES_URL, isTauriEnv } from '../services/agentService';

interface DirectoryBannerProps {
  onPickDirectory: () => void;
  isPicking?: boolean;
  agentStatus: AgentStatus | null;
  onSelectAgentInstallation: (inst: WowInstallation) => void;
  onPickAgentDirectory: () => void;
  onBrowseMarket?: () => void;
}

export const DirectoryBanner: React.FC<DirectoryBannerProps> = ({
  onPickDirectory,
  isPicking = false,
  agentStatus,
  onSelectAgentInstallation,
  onPickAgentDirectory,
  onBrowseMarket,
}) => {
  const isTauri = isTauriEnv();
  const isSupported = isFileSystemAccessSupported() || isTauri;
  const isAgentConnected = !!agentStatus;
  const [showAllVersions, setShowAllVersions] = useState(false);

  const allInstalls = agentStatus?.installations || [];
  const runningInstalls = allInstalls.filter((i) => i.isRunning);

  // Priority display:
  // 1. If any game is running, only show running versions by default.
  // 2. If no game is running, default to only showing the active Infinite server (无限服).
  // 3. Other idle versions only show on page after they are launched or user clicks expand.
  const defaultInstalls = React.useMemo(() => {
    if (runningInstalls.length > 0) {
      return runningInstalls;
    }
    const forever = allInstalls.filter((i) => i.flavor === 'forever');
    return forever.length > 0 ? forever : allInstalls.slice(0, 1);
  }, [runningInstalls, allInstalls]);

  const displayedInstalls = showAllVersions ? allInstalls : defaultInstalls;
  const idleHiddenInstalls = allInstalls.filter(
    (inst) => !displayedInstalls.some((d) => d.addonsPath === inst.addonsPath)
  );

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 via-slate-900/60 to-slate-950 p-6 md:p-10 mb-8 shadow-2xl">
      {/* Background glow */}
      <div className="absolute top-0 right-1/4 -mt-16 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 -mb-20 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-4xl">
        {/* Status Badge */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>智能架构 · 免设置直下 ZIP + 浏览器直连 + 原生桌面端</span>
          </div>

          {isTauri ? (
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Tauri 原生桌面端 · 极速本地访问</span>
            </div>
          ) : isAgentConnected ? (
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>本地助手在线 (v{agentStatus?.version || '1.0.4'}) · 已解除沙箱限制</span>
            </div>
          ) : (
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs">
              <Terminal className="w-3.5 h-3.5 text-amber-400" />
              <span>免配置模式（可直接下载插件 ZIP 或连接本地目录）</span>
            </div>
          )}
        </div>

        {/* Main Heading */}
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3">
          魔兽世界本地插件 · 在线智能管理器与汉化市场
        </h1>

        <p className="text-slate-300 text-base md:text-lg leading-relaxed mb-6">
          无需任何繁琐设置，在首页即可<strong className="text-amber-400 font-semibold">直接下载</strong>《魔兽世界：无限服 (WoW Forever)》及经典/正式服精选 100% 深度汉化插件 ZIP 包；也可连接本地 <code className="text-amber-300 font-mono text-sm">AddOns</code> 目录，实现一键自动解压安装、TOC 扫描与多模块整合管理。
        </p>

        {/* If Agent is Connected: Show Auto-Discovered Versions */}
        {isAgentConnected ? (
          <div className="mb-8 p-5 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-bold text-emerald-300 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>
                  {runningInstalls.length > 0
                    ? `检测到正在运行的游戏版本（点击一键载入）：`
                    : `扫描发现已安装的魔兽版本（点击一键载入）：`}
                </span>
              </h3>
              <button
                onClick={onPickAgentDirectory}
                className="text-xs text-amber-400 hover:text-amber-300 underline cursor-pointer"
              >
                选择其他自定义目录
              </button>
            </div>

            {displayedInstalls.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {displayedInstalls.map((inst, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSelectAgentInstallation(inst)}
                      className={`flex flex-col text-left p-4 rounded-xl border transition-all cursor-pointer group shadow-lg ${
                        inst.isRunning
                          ? 'bg-gradient-to-r from-emerald-950/50 to-slate-900 border-emerald-500/60 hover:border-emerald-400 ring-1 ring-emerald-500/30 hover:scale-101'
                          : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700/80 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 min-w-0">
                          {inst.isRunning && (
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                          )}
                          <span className="font-bold text-slate-100 group-hover:text-amber-300 text-sm truncate">
                            {inst.name}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5 shrink-0">
                          {inst.isRunning ? (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              🟢 游戏运行中
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                              未运行
                            </span>
                          )}
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500 text-slate-950">
                            一键载入
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 font-mono truncate mt-2" title={inst.addonsPath}>
                        {inst.addonsPath}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Toggle for other un-launched versions */}
                {(idleHiddenInstalls.length > 0 || showAllVersions) && allInstalls.length > 1 && (
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/60 mt-3">
                    <p className="text-xs text-slate-400">
                      💡 其他版本的魔兽开启后页面将自动感应显示：
                    </p>
                    <button
                      onClick={() => setShowAllVersions(!showAllVersions)}
                      className="inline-flex items-center space-x-1 text-xs text-amber-400 hover:text-amber-300 cursor-pointer font-medium px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors"
                    >
                      <span>
                        {showAllVersions
                          ? '收起其他未开启版本'
                          : `展开显示其他版本 (${allInstalls.length - displayedInstalls.length} 个未开启)`}
                      </span>
                      {showAllVersions ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">未在默认路径找到魔兽客户端，请手动选择目录</span>
                <button
                  onClick={onPickAgentDirectory}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  通过助手选择 AddOns 目录
                </button>
              </div>
            )}
          </div>
        ) : (
          /* When Agent is NOT Connected */
          <>
            {/* Primary Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 mb-5">
              {onBrowseMarket && (
                <button
                  onClick={onBrowseMarket}
                  className="flex items-center justify-center space-x-2.5 px-6 py-3.5 rounded-xl font-bold text-base bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-xl shadow-amber-500/25 hover:scale-102 active:scale-98 transition-all cursor-pointer"
                >
                  <Download className="w-5 h-5" />
                  <span>免设置 · 直接下载插件 ZIP</span>
                </button>
              )}

              <button
                onClick={onPickDirectory}
                disabled={!isSupported || isPicking}
                className={`flex items-center justify-center space-x-2.5 px-5 py-3.5 rounded-xl font-bold text-sm sm:text-base border transition-all ${
                  !isSupported
                    ? 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
                    : isPicking
                    ? 'bg-slate-800 border-slate-700 text-slate-400 cursor-wait'
                    : 'bg-slate-800/90 hover:bg-slate-800 border-amber-500/40 hover:border-amber-400 text-amber-300 shadow-lg hover:scale-102 active:scale-98 cursor-pointer'
                }`}
              >
                <FolderOpen className="w-5 h-5" />
                <span>
                  {isPicking
                    ? '已打开选择窗口，请在弹窗中选择文件夹...'
                    : '连接本地 AddOns 目录（一键自动安装）'}
                </span>
              </button>
            </div>

            {/* Browser Sandbox Prompt & Native Agent Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950 border border-amber-500/30 text-slate-300 mb-8 shadow-xl">
              <div className="flex items-start space-x-3">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-bold text-slate-100 text-base">
                      遇到系统盘保护 (C:\Program Files) 拦截或使用 Safari / Mac？
                    </h3>
                    <span className="text-[11px] text-amber-400 font-medium bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                      推荐使用
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    由于 Chromium 浏览器强制拦截系统保护目录，若您的魔兽安装在系统盘，推荐使用
                    <strong className="text-amber-300 font-semibold"> 原生桌面端 (基于 Tauri 2.0)</strong>。
                    启动后网页端与客户端将<strong>自动识别并解除拦截</strong>，随时随地畅通读写！
                  </p>

                  {/* Download Buttons */}
                  <div className="flex flex-wrap items-center gap-3 mt-4">
                    <a
                      href={WIN_DOWNLOAD_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 text-xs font-semibold transition-all hover:scale-102 cursor-pointer shadow"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-400" />
                      <span>🪟 Windows 客户端 (单个 .exe 绿色免安装)</span>
                    </a>

                    <a
                      href={MAC_DOWNLOAD_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 text-xs font-semibold transition-all hover:scale-102 cursor-pointer shadow"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-400" />
                      <span>🍎 macOS 客户端下载 (.dmg)</span>
                    </a>

                    <a
                      href={GITHUB_RELEASES_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-slate-200 ml-2 transition-colors"
                    >
                      <span>GitHub Releases 全部下载</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <p className="text-[11px] text-slate-500 mt-2.5">
                    💡 提示：单个可执行 .exe 绿色免安装，下载后双击直接运行！内置云端直连架构，界面与功能实时云端同步，无需反复重装。
                  </p>
                </div>
              </div>
            </div>

            {/* Incompatible alert for older browsers or Safari without desktop app */}
            {!isSupported && !isTauri && (
              <div className="flex items-start space-x-3 p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 mb-6">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-amber-100">当前浏览器可直接下载插件 ZIP，本地目录自动直写受沙箱限制</p>
                  <p className="text-amber-200/90 mt-1 leading-relaxed">
                    📦 <strong>免设置直接下载</strong>：您依然可以在下方市场直接点击 <strong>「直接下载 ZIP」</strong> 保存插件包并手动解压！<br />
                    🍎 <strong>Mac / Windows 一键直装</strong>：如需自动扫描与一键安装，推荐下载上方 <strong>macOS (.dmg)</strong> 或 <strong>Windows (.exe)</strong> 原生客户端。
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* 3 Pillars / Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-800/80">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-200">免配置直接下载 & 一键直装</h4>
              <p className="text-xs text-slate-400 mt-1">
                未设置目录时可直接下载插件 ZIP 压缩包；连接目录后更支持流式解压一键安装。
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-200">无限服精选 100% 深度汉化</h4>
              <p className="text-xs text-slate-400 mt-1">
                内置单键钓鱼 (SBF)、商业制造拍卖、IceHUD、无限副本手册、Bagnon 等全中文插件与多模块聚合管理。
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-200">100% 本地安全与跨平台</h4>
              <p className="text-xs text-slate-400 mt-1">
                纯网页沙箱 + Tauri 2.0 原生桌面端双擎驱动，所有读写均在本地完成，绝不上传个人数据。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
