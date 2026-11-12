import React, { useState } from 'react';
import { ArrowUpCircle, Sparkles, ChevronDown, ChevronUp, Zap, X } from 'lucide-react';
import type { AddonInfo, CuratedAddon } from '../types/addon';

export interface OutdatedAddonItem {
  addon: AddonInfo;
  curated: CuratedAddon;
}

interface UpdateBannerProps {
  directoryKey?: string;
  outdatedItems: OutdatedAddonItem[];
  onUpdateAll: () => void;
  onUpdateSingle: (addon: CuratedAddon) => void;
  onViewInstalledTab: () => void;
  isUpdatingAll?: boolean;
}

/**
 * 插件过期更新全局提示横幅组件
 * 当检测到已安装插件版本低于精选市场版本时展示
 */
export const UpdateBanner: React.FC<UpdateBannerProps> = ({
  directoryKey,
  outdatedItems,
  onUpdateAll,
  onUpdateSingle,
  onViewInstalledTab,
  isUpdatingAll = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const [prevKey, setPrevKey] = useState(directoryKey);

  // 当连接的目录标识变更时，重置关闭状态，确保新目录的更新提示正常呈现
  if (directoryKey !== prevKey) {
    setPrevKey(directoryKey);
    setIsDismissed(false);
  }

  if (outdatedItems.length === 0 || isDismissed) {
    return null;
  }

  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/80 border border-amber-500/40 p-4 sm:p-5 shadow-2xl shadow-amber-500/10 text-slate-100 relative overflow-hidden transition-all">
      {/* Background glowing ambient light */}
      <div className="absolute -right-12 -top-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Top Content */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left Side: Icon & Title & Description */}
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-0.5 shrink-0 shadow-lg shadow-amber-500/30 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-base text-slate-100 flex items-center space-x-2">
                <span>发现</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-xs border border-amber-500/40 font-bold">
                  {outdatedItems.length} 款
                </span>
                <span>已安装插件有新版本可用！</span>
              </h3>
            </div>
            <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
              检测到您本地的部分插件版本落后于精选库。建议立即更新以获取最新汉化修复与游戏适配。
            </p>
          </div>
        </div>

        {/* Right Side: Quick Action Buttons */}
        <div className="flex items-center space-x-2.5 w-full md:w-auto shrink-0 justify-end">
          <button
            onClick={onUpdateAll}
            disabled={isUpdatingAll}
            className="flex-1 md:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/25 transition-all hover:scale-102 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Zap className="w-4 h-4 fill-slate-950" />
            <span>{isUpdatingAll ? '正在批量更新...' : `一键更新全部 (${outdatedItems.length})`}</span>
          </button>

          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            title={isExpanded ? '收起详情' : '展开详情'}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-colors cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            title="关闭本次提醒"
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/80 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expandable Outdated Addons Details */}
      {isExpanded && (
        <div className="mt-4 pt-3.5 border-t border-amber-500/20">
          <div className="flex items-center justify-between text-xs text-amber-300/90 font-medium mb-2.5">
            <span>待更新插件清单：</span>
            <button
              onClick={onViewInstalledTab}
              className="text-amber-400 hover:text-amber-300 hover:underline cursor-pointer flex items-center space-x-1"
            >
              <span>前往已装插件列表</span>
              <span>→</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {outdatedItems.map(({ addon, curated }) => (
              <div
                key={addon.id}
                className="p-2.5 rounded-xl bg-slate-950/70 border border-amber-500/20 flex items-center justify-between space-x-3 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-200 truncate" title={addon.name}>
                    {addon.name}
                  </div>
                  <div className="flex items-center space-x-1 font-mono text-[11px] text-slate-400 mt-0.5">
                    <span className="text-slate-400 line-through truncate max-w-[80px]" title={`当前: ${addon.version}`}>
                      {addon.version}
                    </span>
                    <span className="text-amber-500">→</span>
                    <span className="text-amber-300 font-semibold truncate max-w-[110px]" title={`最新: ${curated.latestVersion}`}>
                      {curated.latestVersion}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onUpdateSingle(curated)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-amber-200 text-xs font-semibold shrink-0 transition-colors cursor-pointer flex items-center space-x-1"
                >
                  <ArrowUpCircle className="w-3.5 h-3.5" />
                  <span>更新</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
