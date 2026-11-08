import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { GithubIcon } from './icons/GithubIcon';
import { POPULAR_ADDONS } from '../services/catalogService';
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

  const categories = [
    { id: 'forever', label: '🔥 无限服推荐', highlight: true },
    { id: 'all', label: '全部插件' },
    { id: 'Combat', label: '战斗统计' },
    { id: 'Raid', label: '副本首领' },
    { id: 'UI', label: '界面血条' },
    { id: 'QoL', label: '便捷辅助' },
    { id: 'Trade', label: '商业拍卖' },
  ];

  const getInstalledState = (curated: CuratedAddon) => {
    return installedAddons.find(
      (installed) =>
        installed.folderName.toLowerCase() === curated.defaultFolderName.toLowerCase() ||
        installed.name.toLowerCase().includes(curated.id.toLowerCase())
    );
  };

  const filteredCatalog = useMemo(() => {
    let list = POPULAR_ADDONS.filter((item) => {
      // Forever specific filter
      if (selectedCategory === 'forever') {
        if (!item.isForeverRecommended && !item.gameFlavors?.includes('forever')) {
          return false;
        }
      } else if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q)
      );
    });

    // Prioritize Forever addons when on 'all' tab if current connected flavor is forever
    if (currentFlavor === 'forever' && selectedCategory === 'all') {
      list = [...list].sort((a, b) => {
        const aFav = a.isForeverRecommended ? 1 : 0;
        const bFav = b.isForeverRecommended ? 1 : 0;
        return bFav - aFav;
      });
    }

    return list;
  }, [selectedCategory, searchQuery, currentFlavor]);

  return (
    <div className="space-y-6">
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
                已为您置顶筛选 60 级传承升级、仇恨统计、平砍计时器与目标施法条等核心插件。
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

          return (
            <div
              key={addon.id}
              className={`p-5 rounded-xl bg-slate-900 border flex flex-col justify-between shadow-lg transition-all ${
                addon.isForeverRecommended
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

              {/* Footer: Status, External Links & Install Button */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
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

                <div>
                  {installed ? (
                    <div className="flex items-center space-x-1.5">
                      <span className="inline-flex items-center space-x-1 text-xs text-emerald-400 font-medium bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded-md">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>已安装</span>
                      </span>
                      <button
                        onClick={() =>
                          hasDirectory ? onInstallAddon(addon) : onPromptPickDirectory()
                        }
                        title="覆盖更新"
                        className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors cursor-pointer"
                      >
                        重新覆盖
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        hasDirectory ? onInstallAddon(addon) : onPromptPickDirectory()
                      }
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition-all hover:scale-102 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{hasDirectory ? '一键安装' : '选择目录后安装'}</span>
                    </button>
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
