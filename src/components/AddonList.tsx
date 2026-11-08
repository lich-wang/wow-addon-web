import React, { useState, useMemo } from 'react';
import {
  Search,
  Folder,
  Trash2,
  Copy,
  Check,
  HardDrive,
  FileCode,
} from 'lucide-react';
import type { AddonInfo } from '../types/addon';
import { formatBytes } from '../services/fsService';

interface AddonListProps {
  addons: AddonInfo[];
  onDeleteAddon: (folderName: string, name: string) => void;
  onSelectAddonDetail: (addon: AddonInfo) => void;
}

export const AddonList: React.FC<AddonListProps> = ({
  addons,
  onDeleteAddon,
  onSelectAddonDetail,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFlavor, setSelectedFlavor] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'files' | 'date'>('name');
  const [copiedFolder, setCopiedFolder] = useState<string | null>(null);

  // Copy folder name helper
  const handleCopy = (folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(folderName);
    setCopiedFolder(folderName);
    setTimeout(() => setCopiedFolder(null), 2000);
  };

  // Filtered & sorted addons
  const filteredAddons = useMemo(() => {
    return addons
      .filter((addon) => {
        // Flavor filter
        if (selectedFlavor !== 'all' && addon.gameFlavor !== selectedFlavor) {
          return false;
        }

        // Search filter
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          addon.name.toLowerCase().includes(q) ||
          addon.folderName.toLowerCase().includes(q) ||
          addon.author.toLowerCase().includes(q) ||
          addon.notes.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name, 'zh-Hans-CN');
        if (sortBy === 'size') return b.totalSize - a.totalSize;
        if (sortBy === 'files') return b.fileCount - a.fileCount;
        if (sortBy === 'date') return b.modifiedTime - a.modifiedTime;
        return 0;
      });
  }, [addons, searchQuery, selectedFlavor, sortBy]);

  // Total stats
  const totalStats = useMemo(() => {
    const size = addons.reduce((acc, a) => acc + a.totalSize, 0);
    const files = addons.reduce((acc, a) => acc + a.fileCount, 0);
    return { size, files };
  }, [addons]);

  const flavorLabels: Record<string, string> = {
    all: '全部版本',
    retail: '正式服 (The War Within)',
    classic: '经典怀旧 (Classic)',
    cata: '大灾变 (Cataclysm)',
    vanilla: '经典旧世 (Era)',
  };

  return (
    <div className="space-y-6">
      {/* Control Toolbar */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between shadow-lg">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索插件名称、文件夹、作者或说明..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              清空
            </button>
          )}
        </div>

        {/* Filter and Sort controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Flavor select */}
          <select
            value={selectedFlavor}
            onChange={(e) => setSelectedFlavor(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-medium text-slate-300 focus:outline-none focus:border-amber-500/50"
          >
            {Object.entries(flavorLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          {/* Sort select */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-medium text-slate-300 focus:outline-none focus:border-amber-500/50"
          >
            <option value="name">排序: 名称 (A-Z)</option>
            <option value="size">排序: 占用体积 (大到小)</option>
            <option value="files">排序: 文件数量</option>
            <option value="date">排序: 最近修改</option>
          </select>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-2 text-xs text-slate-400 font-mono">
        <div className="flex items-center space-x-4">
          <span>
            已识别插件: <strong className="text-amber-400">{filteredAddons.length}</strong> / {addons.length}
          </span>
          <span>
            总大小: <strong className="text-slate-200">{formatBytes(totalStats.size)}</strong>
          </span>
          <span>
            总文件数: <strong className="text-slate-200">{totalStats.files.toLocaleString()}</strong>
          </span>
        </div>
        <div className="text-slate-500">
          提示：点击插件卡片可查看详细 TOC 元数据与依赖项
        </div>
      </div>

      {/* Addons Grid */}
      {filteredAddons.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-slate-900/60 border border-slate-800">
          <Folder className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">未找到符合条件的插件</h3>
          <p className="text-sm text-slate-500 mt-1">请尝试修改搜索词或筛选条件</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAddons.map((addon) => (
            <div
              key={addon.id}
              onClick={() => onSelectAddonDetail(addon)}
              className="group relative p-4 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 hover:border-amber-500/40 transition-all duration-200 shadow-md hover:shadow-xl hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between"
            >
              <div>
                {/* Top header: Name & Version */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3
                    className="font-bold text-sm text-slate-100 group-hover:text-amber-300 transition-colors line-clamp-1"
                    title={addon.name}
                  >
                    {addon.name}
                  </h3>
                  <span className="shrink-0 text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700/60">
                    {addon.version}
                  </span>
                </div>

                {/* Subtitle / Notes */}
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3">
                  {addon.notes || '暂无详细描述'}
                </p>

                {/* Meta details badges */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3 text-[11px] font-mono text-slate-400">
                  <span className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-950/60 border border-slate-800">
                    <HardDrive className="w-3 h-3 text-slate-500" />
                    <span>{formatBytes(addon.totalSize)}</span>
                  </span>

                  <span className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-950/60 border border-slate-800">
                    <FileCode className="w-3 h-3 text-slate-500" />
                    <span>{addon.fileCount} 文件</span>
                  </span>

                  {addon.interfaceVersion && (
                    <span className="px-2 py-0.5 rounded bg-blue-950/40 text-blue-300 border border-blue-500/20">
                      TOC: {addon.interfaceVersion}
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom footer: Folder name & delete button */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                <button
                  onClick={(e) => handleCopy(addon.folderName, e)}
                  title="点击复制文件夹名"
                  className="flex items-center space-x-1 hover:text-slate-300 font-mono transition-colors group/copy cursor-pointer"
                >
                  <Folder className="w-3 h-3 text-slate-500 group-hover/copy:text-amber-400" />
                  <span className="truncate max-w-[140px]">{addon.folderName}</span>
                  {copiedFolder === addon.folderName ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 opacity-0 group-hover/copy:opacity-100 transition-opacity" />
                  )}
                </button>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteAddon(addon.folderName, addon.name);
                    }}
                    title="卸载删除此插件"
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
