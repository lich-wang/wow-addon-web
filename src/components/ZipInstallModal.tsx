import React, { useState, useRef } from 'react';
import { X, UploadCloud, FileArchive, AlertTriangle, ArrowRight } from 'lucide-react';

interface ZipInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstallZip: (file: File) => void;
  hasDirectory: boolean;
  onPromptPickDirectory: () => void;
}

export const ZipInstallModal: React.FC<ZipInstallModalProps> = ({
  isOpen,
  onClose,
  onInstallZip,
  hasDirectory,
  onPromptPickDirectory,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.zip')) {
        setSelectedFile(file);
      } else {
        alert('请上传以 .zip 结尾的魔兽插件压缩包');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleConfirmInstall = () => {
    if (!selectedFile) return;
    if (!hasDirectory) {
      onPromptPickDirectory();
      return;
    }
    onInstallZip(selectedFile);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">本地 ZIP 插件免解压安装</h3>
              <p className="text-xs text-slate-400">拖入压缩包，网页端自动解压并写入 AddOns 目录</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {!hasDirectory && (
            <div className="flex items-start space-x-2.5 p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">尚未授权本地 AddOns 目录</span>
                <p className="text-amber-200/80 mt-0.5">请先授权选择魔兽世界插件文件夹后方可执行安装。</p>
              </div>
            </div>
          )}

          {/* Drag & Drop Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-amber-400 bg-amber-500/10 scale-[1.01]'
                : selectedFile
                ? 'border-emerald-500/50 bg-emerald-950/20'
                : 'border-slate-700 hover:border-slate-600 bg-slate-950/50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".zip"
              className="hidden"
            />

            {selectedFile ? (
              <div className="space-y-2">
                <FileArchive className="w-12 h-12 text-emerald-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-200">{selectedFile.name}</p>
                <p className="text-xs text-slate-400 font-mono">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB · 准备就绪
                </p>
                <span className="inline-block text-[11px] text-amber-400 underline pt-1">
                  点击重新选择其他文件
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <UploadCloud className="w-10 h-10 text-slate-400 mx-auto" />
                <p className="text-sm font-medium text-slate-300">
                  将魔兽插件 <span className="text-amber-400 font-bold">.zip</span> 文件拖入此处
                </p>
                <p className="text-xs text-slate-500">或点击此处浏览本地电脑中的插件压缩包</p>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-500 space-y-1">
            <p>• 支持从 CurseForge、Wago、GitHub 下载的任何通用插件 ZIP 包。</p>
            <p>• 自动识别压缩包内的多模块目录（例如 Details、Details_DataStorage 等），并安全写入。</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleConfirmInstall}
            disabled={!selectedFile}
            className={`flex items-center space-x-1.5 px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-lg ${
              selectedFile
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <span>开始解压并安装</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
