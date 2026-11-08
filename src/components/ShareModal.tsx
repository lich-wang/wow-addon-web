import React, { useState } from 'react';
import { X, Share2, Copy, Check, Download, Shield } from 'lucide-react';
import type { AddonInfo } from '../types/addon';
import { generateShareManifest } from '../services/catalogService';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  installedAddons: AddonInfo[];
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  installedAddons,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'export' | 'wtf'>('export');

  if (!isOpen) return null;

  const manifestJson = generateShareManifest(installedAddons);

  const handleCopy = () => {
    navigator.clipboard.writeText(manifestJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([manifestJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wow-addons-manifest-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">配置清单共享与备份</h3>
              <p className="text-xs text-slate-400">跨电脑同步、公会队友一键分享与 WTF 备份</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-2">
          <button
            onClick={() => setActiveTab('export')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'export'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            已安装插件清单 JSON ({installedAddons.length})
          </button>
          <button
            onClick={() => setActiveTab('wtf')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'wtf'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            WTF 账号与界面配置备份指南
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'export' ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                这是您当前电脑上安装的全部魔兽插件清单元数据。您可以直接将此 JSON 发送给好友或公会团员，也可以在网吧或新电脑上一键对齐插件列表。
              </p>

              <div className="relative">
                <textarea
                  readOnly
                  value={manifestJson}
                  className="w-full h-44 p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">已复制到剪贴板</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-400" />
                      <span>复制 JSON 数据</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownload}
                  className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition-all hover:scale-102 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>下载为 .json 文件</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <h4 className="font-bold text-amber-300 flex items-center space-x-1.5">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span>什么是 WTF 目录？</span>
                </h4>
                <p className="text-slate-400">
                  魔兽世界所有角色的<strong>宏命令、按键绑定、插件参数设置（Details窗口位置、WeakAuras字符串、血条布局等）</strong>
                  全部储存在游戏安装目录下的 <code className="text-amber-400 bg-slate-900 px-1 py-0.5 rounded">WTF</code> 文件夹中。
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <h4 className="font-semibold text-slate-200">推荐备份步骤：</h4>
                <ol className="list-decimal list-inside space-y-1 text-slate-400">
                  <li>打开魔兽世界游戏目录，例如 <code className="text-slate-300">World of Warcraft\_retail_\WTF</code></li>
                  <li>选中该文件夹并将其压缩为 <code className="text-slate-300">WTF_Backup.zip</code></li>
                  <li>上传保存到微云/百度网盘/OneDrive。换电脑解压覆盖即可 100% 恢复所有界面！</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
