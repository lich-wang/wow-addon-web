import React from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { InstallProgress } from '../types/addon';

interface ProgressModalProps {
  progress: InstallProgress;
  onClose: () => void;
}

export const ProgressModal: React.FC<ProgressModalProps> = ({ progress, onClose }) => {
  if (progress.status === 'idle') return null;

  const isDone = progress.status === 'completed';
  const isError = progress.status === 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 text-center space-y-4">
        {/* Status Icon */}
        <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center">
          {isDone ? (
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
          ) : isError ? (
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-8 h-8" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          )}
        </div>

        {/* Title */}
        <div>
          <h3 className="text-base font-bold text-slate-100">
            {isDone
              ? '插件安装成功！'
              : isError
              ? '安装中断'
              : `正在安装: ${progress.addonName}`}
          </h3>
          <p className="text-xs text-slate-400 mt-1">{progress.message}</p>
        </div>

        {/* Progress Bar */}
        {!isError && (
          <div className="space-y-1.5">
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-300 ${
                  isDone ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-yellow-400'
                }`}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-slate-500">
              <span>{isDone ? '写入完成' : '执行中...'}</span>
              <span>{progress.percent}%</span>
            </div>
          </div>
        )}

        {/* Action Button */}
        {(isDone || isError) && (
          <div className="pt-2">
            <button
              onClick={onClose}
              className={`w-full py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isDone
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
            >
              确定
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
