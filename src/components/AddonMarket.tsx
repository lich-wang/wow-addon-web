import React, { useState, useMemo, useCallback } from 'react';
import {
  Download,
  CheckCircle2,
  ExternalLink,
  Sword,
  Sparkles,
  Skull,
  ShieldAlert,
  BadgePercent,
  Compass,
  LayoutGrid,
  Clock,
  Package,
  Eye,
  MapPin,
  Wrench,
  Cpu,
  Coins,
  Search,
  Flame,
  FolderOpen,
  Zap,
} from 'lucide-react';
import { GithubIcon } from './icons/GithubIcon';
import { POPULAR_ADDONS, isUpdateAvailable, findMatchingCuratedAddon } from '../services/catalogService';
import type { AddonInfo, CuratedAddon, GameFlavor } from '../types/addon';

interface AddonMarketProps {
  installedAddons: AddonInfo[];
  hasDirectory: boolean;
  currentFlavor?: GameFlavor;
  onInstallAddon: (addon: CuratedAddon) => void;
  onPromptPickDirectory: () => void;
}

const iconMap: Record<string, React.ReactNode> = {
  Sword: <Sword className="w-5 h-5" />,
  Sparkles: <Sparkles className="w-5 h-5" />,
  Skull: <Skull className="w-5 h-5" />,
  ShieldAlert: <ShieldAlert className="w-5 h-5" />,
  BadgePercent: <BadgePercent className="w-5 h-5" />,
  Compass: <Compass className="w-5 h-5" />,
  LayoutGrid: <LayoutGrid className="w-5 h-5" />,
  Clock: <Clock className="w-5 h-5" />,
  Package: <Package className="w-5 h-5" />,
  Eye: <Eye className="w-5 h-5" />,
  MapPin: <MapPin className="w-5 h-5" />,
  Wrench: <Wrench className="w-5 h-5" />,
  Cpu: <Cpu className="w-5 h-5" />,
  Coins: <Coins className="w-5 h-5" />,
};

export const AddonMarket: React.FC<AddonMarketProps> = ({
  installedAddons,
  hasDirectory,
  currentFlavor,
  onInstallAddon,
  onPromptPickDirectory,
}) => {
  // If current flavor is forever, default to 'forever' tab to prioritize forever addons
  const [selectedCategory, setSelectedCategory] = useState<string>(
    currentFlavor === 'forever' ? 'forever' : 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');

  const getInstalledState = useCallback((curated: CuratedAddon) => {
    return installedAddons.find((installed) => {
      const matched = findMatchingCuratedAddon(installed);
      return matched?.id === curated.id;
    });
  }, [installedAddons]);

  const outdatedCount = useMemo(() => {
    return POPULAR_ADDONS.filter((item) => {
      const installed = getInstalledState(item);
      if (!installed) return false;
      return isUpdateAvailable(installed.version, item.latestVersion);
    }).length;
  }, [getInstalledState]);

  // If outdated count becomes 0 while user is on 'outdated' tab, reset category
  const activeCategory = selectedCategory === 'outdated' && outdatedCount === 0 ? 'all' : selectedCategory;

  const categories = useMemo(() => {
    const list = [
      { id: 'forever', label: '🔥 无限服推荐', highlight: true },
      { id: 'all', label: '全部插件', highlight: false },
      { id: 'Combat', label: '战斗统计', highlight: false },
      { id: 'Raid', label: '副本首领', highlight: false },
      { id: 'UI', label: '界面血条', highlight: false },
      { id: 'QoL', label: '便捷辅助', highlight: false },
      { id: 'Trade', label: '商业拍卖', highlight: false },
    ];
    if (outdatedCount > 0) {
      list.splice(1, 0, {
        id: 'outdated',
        label: `⚡ 待更新 (${outdatedCount})`,
        highlight: true,
      });
    }
    return list;
  }, [outdatedCount]);

  const filteredCatalog = useMemo(() => {
    let list = POPULAR_ADDONS.filter((item) => {
      // Outdated filter
      if (activeCategory === 'outdated') {
        const installed = getInstalledState(item);
        if (!installed) return false;
        if (!isUpdateAvailable(installed.version, item.latestVersion)) return false;
      } else if (activeCategory === 'forever') {
        // Forever specific filter
        if (!item.isForeverRecommended && !item.gameFlavors?.includes('forever')) {
          return false;
        }
      } else if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }

      // Search filter applied to all categories including 'outdated'
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q)
      );
    });

    // Prioritize Forever addons when on 'all' tab if current connected flavor is forever
    if (currentFlavor === 'forever' && activeCategory === 'all') {
      list = [...list].sort((a, b) => {
        const aFav = a.isForeverRecommended ? 1 : 0;
        const bFav = b.isForeverRecommended ? 1 : 0;
        return bFav - aFav;
      });
    }

    return list;
  }, [activeCategory, searchQuery, currentFlavor, getInstalledState]);

  return (
    <div id="addon-market-section" className="space-y-6">
      {/* Forever Server Priority Banner */}
      {currentFlavor === 'forever' && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900 border border-amber-500/30 flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-300">
                已进入【魔兽世界：无限服 (WoW Forever)】优先匹配模式
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                已为您置顶筛选单键钓鱼、商业制造拍卖、副本掉落手册与背包整合等全汉化核心插件。
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedCategory('forever')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedCategory === 'forever'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
            }`}
          >
            仅看无限服推荐 ({POPULAR_ADDONS.filter((a) => a.isForeverRecommended).length})
          </button>
        </div>
      )}

      {/* Search & Categories Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-lg">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? cat.highlight
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold shadow-md shadow-amber-500/25'
                    : 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : cat.highlight
                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="在市场中搜索..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      {/* Grid of Curated Addons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCatalog.map((addon) => {
          const installed = getInstalledState(addon);
          const hasUpdate = installed
            ? isUpdateAvailable(installed.version, addon.latestVersion)
            : false;

          return (
            <div
              key={addon.id}
              className={`p-5 rounded-xl bg-slate-900 border flex flex-col justify-between shadow-lg transition-all ${
                hasUpdate
                  ? 'border-amber-500/60 bg-gradient-to-b from-slate-900 via-slate-900 to-amber-950/20 shadow-amber-500/10'
                  : addon.isForeverRecommended
                  ? 'border-amber-500/30 hover:border-amber-500/60 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950/80'
                  : 'border-slate-800/90 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Header: Icon, Name & Author */}
                <div className="flex items-start space-x-3.5 mb-3">
                  <div
                    className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${
                      addon.isForeverRecommended
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    {iconMap[addon.icon] || <Package className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <h3 className="font-bold text-sm text-slate-100 truncate" title={addon.name}>
                        {addon.name}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 mt-1">
                      <span>{addon.author}</span>
                      <span>•</span>
                      <span className="font-mono text-amber-500/90">{addon.latestVersion}</span>

                      {addon.isForeverRecommended && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                          无限服适配
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 mb-4">
                  {addon.description}
                </p>
              </div>

              {/* Footer: Status, External Links & Install / Download Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  {addon.githubRepo && (
                    <a
                      href={`https://github.com/${addon.githubRepo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="查看 GitHub 源码与发布页"
                      className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                    >
                      <GithubIcon className="w-4 h-4" />
                    </a>
                  )}
                  {addon.homeUrl && (
                    <a
                      href={addon.homeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="官方主页"
                      className="text-slate-500 hover:text-slate-300 transition-colors p-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {installed ? (
                    <div className="flex items-center space-x-1.5">
                      <a
                        href={addon.downloadUrl}
                        download={`${addon.defaultFolderName}.zip`}
                        title="直接下载插件 ZIP 压缩包"
                        className="inline-flex items-center space-x-1 px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        <span>ZIP</span>
                      </a>
                      {hasUpdate ? (
                        <>
                          <span className="inline-flex items-center space-x-1 text-xs text-amber-300 font-semibold bg-amber-950/60 border border-amber-500/40 px-2 py-1 rounded-md animate-pulse">
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span>可更新</span>
                          </span>
                          <button
                            onClick={() =>
                              hasDirectory ? onInstallAddon(addon) : onPromptPickDirectory()
                            }
                            title={`本地版本: ${installed.version}，点击更新至最新版: ${addon.latestVersion}`}
                            className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition-all hover:scale-102 cursor-pointer"
                          >
                            <Zap className="w-3 h-3 fill-slate-950" />
                            <span>立即更新</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="inline-flex items-center space-x-1 text-xs text-emerald-400 font-medium bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded-md">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>已是最新</span>
                          </span>
                          <button
                            onClick={() =>
                              hasDirectory ? onInstallAddon(addon) : onPromptPickDirectory()
                            }
                            title="重新覆盖安装"
                            className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors cursor-pointer"
                          >
                            重新覆盖
                          </button>
                        </>
                      )}
                    </div>
                  ) : hasDirectory ? (
                    <div className="flex items-center space-x-1.5">
                      <a
                        href={addon.downloadUrl}
                        download={`${addon.defaultFolderName}.zip`}
                        title="直接下载插件 ZIP 压缩包到本地"
                        className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-slate-100 text-xs font-medium transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>下载 ZIP</span>
                      </a>
                      <button
                        onClick={() => onInstallAddon(addon)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition-all hover:scale-102 cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>一键安装</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={onPromptPickDirectory}
                        title="连接本地魔兽 AddOns 目录后自动解压安装"
                        className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-amber-300 text-xs font-medium transition-colors cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>连目录安装</span>
                      </button>
                      <a
                        href={addon.downloadUrl}
                        download={`${addon.defaultFolderName}.zip`}
                        title="无需设置目录，直接下载插件 ZIP 压缩包"
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition-all hover:scale-102 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>直接下载 ZIP</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
