import React from 'react';
import { X, CloudLightning } from 'lucide-react';

interface DeployModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeployModal: React.FC<DeployModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-400">
              <CloudLightning className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">免费部署到 Cloudflare Pages 指南</h3>
              <p className="text-xs text-slate-400">零服务器成本 · 全球 CDN 加速 · 自动持续集成</p>
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
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs text-slate-300">
          <div className="p-3.5 rounded-xl bg-orange-950/20 border border-orange-500/20 text-orange-200">
            Cloudflare Pages 提供完全免费的静态网站托管与全球 Anycast CDN，自带免费 SSL 证书（HTTPS），非常契合 File System Access API 必须在 HTTPS 环境下运行的安全要求！
          </div>

          <div className="space-y-3">
            {/* Step 1 */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <h4 className="font-bold text-amber-400 mb-1 flex items-center space-x-1.5">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] flex items-center justify-center">1</span>
                <span>将本项目开源/推送到 GitHub</span>
              </h4>
              <p className="text-slate-400 mt-1">
                在 GitHub 新建一个仓库（例如 <code className="text-slate-300">wow-addon-web</code>），并将当前项目源码提交并推送（Push）到该仓库。
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <h4 className="font-bold text-amber-400 mb-1 flex items-center space-x-1.5">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] flex items-center justify-center">2</span>
                <span>登录 Cloudflare 控制台</span>
              </h4>
              <p className="text-slate-400 mt-1">
                打开 <a href="https://dash.cloudflare.com" target="_blank" rel="noreferrer" className="text-amber-400 underline">dash.cloudflare.com</a>，点击侧边栏的 <strong>Workers 与 Pages</strong> → <strong>创建应用程序 (Create Application)</strong> → 选择 <strong>Pages</strong> → <strong>连接到 Git</strong>。
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <h4 className="font-bold text-amber-400 mb-1 flex items-center space-x-1.5">
                <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[10px] flex items-center justify-center">3</span>
                <span>填写构建预设 (Build Configuration)</span>
              </h4>
              <div className="mt-2 space-y-1 font-mono text-[11px] bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-slate-300">
                <p>• 框架预设 (Framework Preset): <strong className="text-amber-400">Vite</strong></p>
                <p>• 构建命令 (Build command): <strong className="text-slate-100">npm run build</strong></p>
                <p>• 构建输出目录 (Build output directory): <strong className="text-slate-100">dist</strong></p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
              <h4 className="font-bold text-emerald-400 mb-1 flex items-center space-x-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center">4</span>
                <span>点击 “保存并部署” (Save and Deploy)</span>
              </h4>
              <p className="text-slate-400 mt-1">
                约 30 秒后构建完成，你将免费获得一个类似 <code className="text-emerald-400">https://your-repo.pages.dev</code> 的永久全球加速访问网址，且每次向 GitHub git push 代码都会自动重新构建部署！
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
};
