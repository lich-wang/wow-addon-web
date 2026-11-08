import React from 'react';
import { X, Folder, HardDrive, FileCode, Trash2, Tag, Layers, User } from 'lucide-react';
import type { AddonInfo } from '../types/addon';
import { formatBytes } from '../services/fsService';

interface AddonDetailModalProps {
  addon: AddonInfo | null;
  onClose: () => void;
  onDelete: (folderName: string, name: string) => void;
}

export const AddonDetailModal: React.FC<AddonDetailModalProps> = ({
  addon,
  onClose,
  onDelete,
}) => {
  if (!addon) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div>
            <span className="text-xs font-mono text-amber-500 font-semibold uppercase tracking-wider">
              插件详情 (TOC 元数据)
            </span>
            <h3 className="text-lg font-bold text-slate-100 mt-0.5">{addon.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Notes */}
          {addon.notes && (
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 leading-relaxed">
              {addon.notes}
            </div>
          )}

          {/* Details Table */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
              <span className="text-slate-500 flex items-center space-x-1">
                <Tag className="w-3.5 h-3.5" />
                <span>版本号 (Version)</span>
              </span>
              <p className="font-mono font-medium text-amber-400 truncate">{addon.version}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
              <span className="text-slate-500 flex items-center space-x-1">
                <Layers className="w-3.5 h-3.5" />
                <span>魔兽版本 (Interface)</span>
              </span>
              <p className="font-mono font-medium text-blue-400">{addon.interfaceVersion || '未指定'}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
              <span className="text-slate-500 flex items-center space-x-1">
                <Folder className="w-3.5 h-3.5" />
                <span>本地文件夹名</span>
              </span>
              <p className="font-mono font-medium text-slate-200 truncate">{addon.folderName}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
              <span className="text-slate-500 flex items-center space-x-1">
                <User className="w-3.5 h-3.5" />
                <span>作者 (Author)</span>
              </span>
              <p className="font-medium text-slate-200 truncate">{addon.author || '未知'}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
              <span className="text-slate-500 flex items-center space-x-1">
                <HardDrive className="w-3.5 h-3.5" />
                <span>占用体积</span>
              </span>
              <p className="font-mono font-medium text-slate-200">{formatBytes(addon.totalSize)}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
              <span className="text-slate-500 flex items-center space-x-1">
                <FileCode className="w-3.5 h-3.5" />
                <span>文件总数</span>
              </span>
              <p className="font-mono font-medium text-slate-200">{addon.fileCount} 个文件</p>
            </div>
          </div>

          {/* Dependencies */}
          {addon.dependencies && addon.dependencies.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 mb-2">前置依赖项 (Dependencies):</h4>
              <div className="flex flex-wrap gap-1.5">
                {addon.dependencies.map((dep, index) => (
                  <span
                    key={index}
                    className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300"
                  >
                    {dep}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => {
              onDelete(addon.folderName, addon.name);
              onClose();
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 hover:bg-rose-900/50 text-xs font-medium transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>彻底卸载此插件</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
