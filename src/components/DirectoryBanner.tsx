import React, { useState } from 'react';
import {
  FolderOpen,
  Download,
  ChevronDown,
  ChevronUp,
  Laptop,
  HelpCircle,
  AlertTriangle,
} from 'lucide-react';
import { isFileSystemAccessSupported } from '../services/fsService';
import type { AgentStatus, WowInstallation } from '../services/agentService';
import { isTauriEnv } from '../services/agentService';

interface DirectoryBannerProps {
  onPickDirectory: () => void;
  isPicking?: boolean;
  agentStatus: AgentStatus | null;
  onSelectAgentInstallation: (inst: WowInstallation) => void;
  onPickAgentDirectory: () => void;
  onOpenClientModal?: () => void;
  onOpenCompatModal?: () => void;
  isCompatible?: boolean;
}

export const DirectoryBanner: React.FC<DirectoryBannerProps> = ({
  onPickDirectory,
  isPicking = false,
  agentStatus,
  onSelectAgentInstallation,
  onPickAgentDirectory,
  onOpenClientModal,
  onOpenCompatModal,
  isCompatible,
}) => {
  const isTauri = isTauriEnv();
  // If isCompatible is explicitly provided from comprehensive check, prioritize it
  const isSupported = isCompatible !== undefined
    ? isCompatible
    : (isFileSystemAccessSupported() || isTauri);
  const isAgentConnected = !!agentStatus;
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [showSandboxTip, setShowSandboxTip] = useState(false);

  const allInstalls = agentStatus?.installations || [];
  const runningInstalls = allInstalls.filter((i) => i.isRunning);

  // Priority display:
  // 1. If any game is running, only show running versions by default.
  // 2. If no game is running, default to only showing the active Infinite server (无限服).
  const defaultInstalls = React.useMemo(() => {
    const installs = agentStatus?.installations || [];
    const running = installs.filter((i) => i.isRunning);
    if (running.length > 0) {
      return running;
    }
    const forever = installs.filter((i) => i.flavor === 'forever');
    return forever.length > 0 ? forever : installs.slice(0, 1);
  }, [agentStatus]);

  const displayedInstalls = showAllVersions ? allInstalls : defaultInstalls;
  const idleHiddenInstalls = allInstalls.filter(
    (inst) => !displayedInstalls.some((d) => d.addonsPath === inst.addonsPath)
  );

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 via-slate-900/60 to-slate-950 p-5 sm:p-6 mb-6 shadow-xl">
      {/* Background glow */}
      <div className="absolute top-0 right-1/4 -mt-16 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        {/* If Agent is Connected: Show Auto-Discovered Versions */}
        {isAgentConnected ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-sm font-bold text-emerald-300">
                  {runningInstalls.length > 0
                    ? '检测到正在运行的魔兽世界：'
                    : '已扫描发现本地魔兽客户端：'}
                </h3>
              </div>
              <button
                onClick={onPickAgentDirectory}
                className="text-xs text-amber-400 hover:text-amber-300 underline cursor-pointer"
              >
                选择其他自定义目录
              </button>
            </div>

            {displayedInstalls.length > 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {displayedInstalls.map((inst, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSelectAgentInstallation(inst)}
                      className={`flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer group shadow ${
                        inst.isRunning
                          ? 'bg-gradient-to-r from-emerald-950/50 to-slate-900 border-emerald-500/60 hover:border-emerald-400 ring-1 ring-emerald-500/30'
                          : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 min-w-0">
                          {inst.isRunning && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                          )}
                          <span className="font-bold text-slate-100 group-hover:text-amber-300 text-sm truncate">
                            {inst.name}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5 shrink-0">
                          {inst.isRunning ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              🟢 运行中
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
                      <span className="text-xs text-slate-400 font-mono truncate mt-1.5" title={inst.addonsPath}>
                        {inst.addonsPath}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Toggle for other versions */}
                {(idleHiddenInstalls.length > 0 || showAllVersions) && allInstalls.length > 1 && (
                  <div className="pt-2 flex items-center justify-between border-t border-slate-800/60 mt-2">
                    <p className="text-[11px] text-slate-500">
                      其他魔兽客户端运行后将自动置顶显示
                    </p>
                    <button
                      onClick={() => setShowAllVersions(!showAllVersions)}
                      className="inline-flex items-center space-x-1 text-xs text-amber-400 hover:text-amber-300 cursor-pointer font-medium px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700"
                    >
                      <span>
                        {showAllVersions
                          ? '收起其他版本'
                          : `展开其他版本 (${allInstalls.length - displayedInstalls.length})`}
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
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-slate-400">未在默认路径发现魔兽客户端，请手动选择目录</span>
                <button
                  onClick={onPickAgentDirectory}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  通过助手选择 AddOns 目录
                </button>
              </div>
            )}
          </div>
        ) : (
          /* When Agent is NOT Connected: Streamlined Compact Hero */
          <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>魔兽世界插件管理器 · 深度汉化</span>
                  <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300">
                    免设置直下 · 浏览器直连 · 客户端直装
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  下方市场可直接下载汉化 ZIP 包；连接魔兽 AddOns 目录后支持一键自动解压安装与多模块整合管理。
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  onClick={!isSupported && onOpenCompatModal ? onOpenCompatModal : onPickDirectory}
                  disabled={isPicking}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all ${
                    !isSupported
                      ? 'bg-slate-900/90 border border-amber-500/40 text-amber-300 hover:bg-slate-800 hover:border-amber-400 cursor-pointer'
                      : isPicking
                      ? 'bg-slate-800 text-slate-400 cursor-wait'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 hover:scale-101 active:scale-99 cursor-pointer'
                  }`}
                  title={!isSupported ? '当前浏览器不支持本地读写，点击查看说明' : undefined}
                >
                  {!isSupported ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <FolderOpen className="w-4 h-4" />
                  )}
                  <span>
                    {!isSupported
                      ? '浏览器不受支持 (点击查看)'
                      : isPicking
                      ? '请在弹窗中选择文件夹...'
                      : '选择魔兽 AddOns 目录'}
                  </span>
                </button>

                {onOpenCompatModal && !isSupported && (
                  <button
                    onClick={onOpenCompatModal}
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all cursor-pointer"
                  >
                    <span>换 Chrome 打开</span>
                  </button>
                )}

                {onOpenClientModal && (
                  <button
                    onClick={onOpenClientModal}
                    className="flex items-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-slate-800/90 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 transition-all hover:scale-101 active:scale-99 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-amber-400" />
                    <span>下载桌面客户端</span>
                  </button>
                )}
              </div>
            </div>

            {/* Subtle Collapsible Permission Tip */}
            <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
              <button
                onClick={() => setShowSandboxTip(!showSandboxTip)}
                className="inline-flex items-center space-x-1.5 text-[11px] text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>魔兽安装在系统盘 (C:\Program Files) 无法选择？点击查看提示</span>
                {showSandboxTip ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>

              <span className="text-[11px] text-slate-500">
                所有插件均由网页在本地直接解压写入，不收集或上传任何个人数据
              </span>
            </div>

            {showSandboxTip && (
              <div className="mt-2.5 p-3.5 rounded-xl bg-slate-950/80 border border-amber-500/20 text-xs text-slate-300 space-y-2.5 animate-in fade-in duration-150">
                <p className="leading-relaxed">
                  由于 Chrome / Edge 浏览器强制保护系统盘敏感目录，若您的魔兽安装在 <code className="text-amber-300 font-mono">C:\Program Files</code>，浏览器会触发安全保护限制，无法直接选择或授权读写。
                </p>
                <div className="space-y-1.5 pt-0.5 text-xs">
                  <p className="font-semibold text-amber-300">💡 推荐解决方案：</p>
                  <div className="flex items-start space-x-2 text-slate-300 pl-1">
                    <span className="text-amber-400 font-bold">1.</span>
                    <span>
                      <strong className="text-slate-100">移动游戏目录：</strong>
                      将魔兽世界整体文件夹移动到非系统盘（例如 <code className="text-amber-300/90 font-mono">D:\World of Warcraft</code> 或 E 盘），即可在网页中无缝选择与一键管理。
                    </span>
                  </div>
                  <div className="flex items-start space-x-2 text-slate-300 pl-1">
                    <span className="text-amber-400 font-bold">2.</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <strong className="text-slate-100">换用本地客户端：</strong>
                      <span>使用无需安装的单文件绿色桌面端，直接原生读写系统盘游戏目录。</span>
                      {onOpenClientModal && (
                        <button
                          onClick={onOpenClientModal}
                          className="inline-flex items-center space-x-1 text-amber-400 hover:text-amber-300 underline font-semibold cursor-pointer ml-1"
                        >
                          <Laptop className="w-3.5 h-3.5" />
                          <span>点击极速下载桌面端</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 pt-0.5">
                  或者您也可以在下方插件市场直接点击「下载 ZIP」手动解压到本地 AddOns 目录。
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
