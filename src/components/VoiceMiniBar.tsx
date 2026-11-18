import React from 'react';
import { Mic, MicOff, PhoneOff, Headphones } from 'lucide-react';
import type { VoiceStateSnapshot } from '../services/voiceService';

interface VoiceMiniBarProps {
  voiceState: VoiceStateSnapshot;
  onOpenVoiceTab: () => void;
  onToggleMute: () => void;
  onLeave: () => Promise<void>;
}

export const VoiceMiniBar: React.FC<VoiceMiniBarProps> = ({
  voiceState,
  onOpenVoiceTab,
  onToggleMute,
  onLeave,
}) => {
  if (voiceState.status !== 'connected' && voiceState.status !== 'connecting') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center space-x-2.5 px-3.5 py-2.5 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-emerald-500/40 shadow-2xl shadow-black/50">
      <button
        onClick={onOpenVoiceTab}
        className="flex items-center space-x-2 text-left cursor-pointer group"
        title="点击返回语音聊天房间"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>
        <div>
          <div className="text-xs font-bold text-slate-100 group-hover:text-amber-300 transition-colors flex items-center space-x-1">
            <Headphones className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono">{voiceState.roomId}</span>
          </div>
          <div className="text-[10px] text-slate-400">
            {voiceState.participants.length} 人在语音中
          </div>
        </div>
      </button>

      <div className="h-6 w-px bg-slate-800" />

      <button
        onClick={onToggleMute}
        disabled={voiceState.listenOnly}
        title={voiceState.listenOnly ? '仅收听模式' : voiceState.isMuted ? '取消闭麦' : '闭麦'}
        className={`p-2 rounded-xl transition-colors cursor-pointer disabled:opacity-40 ${
          voiceState.isMuted || voiceState.listenOnly
            ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
            : 'bg-slate-800 text-emerald-300 hover:bg-slate-700'
        }`}
      >
        {voiceState.isMuted || voiceState.listenOnly ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>

      <button
        onClick={() => void onLeave()}
        title="退出语音房间"
        className="p-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white transition-colors cursor-pointer"
      >
        <PhoneOff className="w-4 h-4" />
      </button>
    </div>
  );
};
