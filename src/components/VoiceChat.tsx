import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  Lock,
  Users,
  Copy,
  Check,
  Shuffle,
  Eye,
  EyeOff,
  AlertTriangle,
  Send,
  Headphones,
  Loader2,
  Radio,
  Share2,
} from 'lucide-react';
import type { VoiceStateSnapshot } from '../services/voiceService';
import type { VoiceJoinOptions } from '../types/voice';

interface VoiceChatProps {
  voiceState: VoiceStateSnapshot;
  initialRoomId?: string;
  onJoin: (options: VoiceJoinOptions) => Promise<void>;
  onLeave: () => Promise<void>;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onSetPeerVolume: (peerId: string, volume: number) => void;
  onSwitchMicrophone: (deviceId: string) => Promise<void>;
  onSendMessage: (text: string) => Promise<void>;
  onResumePlayback: () => void;
}

const NICKNAME_STORAGE_KEY = 'wow_voice_nickname';

function generateRandomRoomId(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `wow-${num}`;
}

export const VoiceChat: React.FC<VoiceChatProps> = ({
  voiceState,
  initialRoomId = '',
  onJoin,
  onLeave,
  onToggleMute,
  onToggleDeafen,
  onSetPeerVolume,
  onSwitchMicrophone,
  onSendMessage,
  onResumePlayback,
}) => {
  const [nickname, setNickname] = useState<string>(() => {
    try {
      return localStorage.getItem(NICKNAME_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [roomId, setRoomId] = useState<string>(initialRoomId);
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [listenOnly, setListenOnly] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'room' | 'link' | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const lastMessageId = voiceState.messages[voiceState.messages.length - 1]?.id;

  useEffect(() => {
    const loadDevices = async () => {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devices.filter((d) => d.kind === 'audioinput'));
      } catch {
        // Ignore device enumeration failures before permission
      }
    };
    void loadDevices();
  }, [voiceState.status]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lastMessageId]);

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await triggerJoin(listenOnly);
  };

  const triggerJoin = async (useListenOnly: boolean) => {
    setLocalError(null);
    setRoomError(null);
    const trimmedRoom = roomId.trim();
    if (!trimmedRoom) {
      setLocalError('请输入房间号');
      return;
    }
    if (password.length < 8) {
      setLocalError('房间密码至少需要 8 个字符');
      return;
    }

    const finalNickname = nickname.trim() || `勇士-${Math.floor(100 + Math.random() * 900)}`;
    try {
      localStorage.setItem(NICKNAME_STORAGE_KEY, finalNickname);
    } catch {
      // Ignore storage errors
    }

    try {
      await onJoin({
        roomId: trimmedRoom,
        password,
        nickname: finalNickname,
        deviceId: selectedDeviceId || undefined,
        listenOnly: useListenOnly,
      });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : '加入语音频道失败');
    }
  };

  const handleCopy = async (type: 'room' | 'link') => {
    const targetRoom = voiceState.roomId || roomId.trim();
    if (!targetRoom) return;
    const text =
      type === 'room'
        ? targetRoom
        : `${window.location.origin}${window.location.pathname}?voiceRoom=${encodeURIComponent(targetRoom)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      window.setTimeout(() => setCopiedType(null), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (voiceState.status !== 'connected' || isSendingChat || !chatInput.trim()) return;
    const text = chatInput;
    setRoomError(null);
    setIsSendingChat(true);
    try {
      await onSendMessage(text);
      setChatInput('');
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : '发送消息失败，请稍后重试');
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleSwitchMicChange = async (nextDeviceId: string) => {
    const prevDeviceId = selectedDeviceId;
    setRoomError(null);
    setSelectedDeviceId(nextDeviceId);
    try {
      await onSwitchMicrophone(nextDeviceId);
    } catch (err) {
      setSelectedDeviceId(prevDeviceId);
      setRoomError(err instanceof Error ? err.message : '切换麦克风设备失败');
    }
  };

  const isInRoom = voiceState.status === 'connected' || voiceState.status === 'connecting';
  const displayError = localError || voiceState.error;

  if (!isInRoom) {
    return (
      <section className="max-w-3xl mx-auto py-4">
        <div className="rounded-2xl bg-slate-900/70 border border-slate-800 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/20 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Headphones className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">网页语音开黑房间</h2>
                <p className="text-xs text-slate-400">
                  输入相同的房间号与密码即可多人实时群聊 · 无需安装客户端
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
              <Lock className="w-3.5 h-3.5" />
              <span>端到端加密信令</span>
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleJoinSubmit} className="p-6 space-y-5">
            {displayError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{displayError}</span>
                </div>
                {(displayError.includes('麦克风') || displayError.includes('权限')) && (
                  <button
                    type="button"
                    onClick={() => {
                      setListenOnly(true);
                      void triggerJoin(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-medium shrink-0 cursor-pointer"
                  >
                    改为仅收听加入
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  我的昵称 / 角色名
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={24}
                  placeholder="例如：暴风城圣骑（留空自动生成）"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:outline-none text-sm text-slate-100 placeholder-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  房间号 <span className="text-rose-400">*</span>
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    maxLength={40}
                    placeholder="例如：mc-raid-01"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:outline-none text-sm text-slate-100 placeholder-slate-600 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setRoomId(generateRandomRoomId())}
                    title="随机生成房间号"
                    className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-amber-300 transition-colors cursor-pointer flex items-center space-x-1 text-xs"
                  >
                    <Shuffle className="w-4 h-4" />
                    <span className="hidden sm:inline">随机</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  房间密码 <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    maxLength={64}
                    placeholder="至少 8 位房间密码（队友需一致）"
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:outline-none text-sm text-slate-100 placeholder-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  麦克风设备
                </label>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  disabled={listenOnly}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:outline-none text-sm text-slate-200 disabled:opacity-50"
                >
                  <option value="">系统默认麦克风</option>
                  {audioInputs.map((device, idx) => (
                    <option key={device.deviceId || idx} value={device.deviceId}>
                      {device.label || `麦克风设备 ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <label className="inline-flex items-center space-x-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={listenOnly}
                  onChange={(e) => setListenOnly(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500"
                />
                <span>仅收听模式加入（不开启麦克风）</span>
              </label>

              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center space-x-2"
              >
                <Mic className="w-4 h-4" />
                <span>加入语音频道</span>
              </button>
            </div>
          </form>

          {/* Footer Info */}
          <div className="px-6 py-4 bg-slate-950/60 border-t border-slate-800/80 text-xs text-slate-400 space-y-1.5">
            <p className="font-medium text-slate-300">使用说明：</p>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>任意成员输入相同的「房间号」与「密码」即可自动进入同一语音群聊，支持多人同时通话。</li>
              <li>音频基于浏览器 WebRTC P2P 直连传输，房间密码仅用于本地加密信令，不会上传至任何服务器。</li>
              <li>切换回「精选插件市场」或「已装插件」页面时，语音通话会在后台保持连接不会中断。</li>
            </ul>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 py-2">
      {/* Room Top Bar */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2.5">
            <span className="relative flex h-3 w-3">
              {voiceState.status === 'connected' ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </>
              ) : (
                <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              )}
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400">房间号</span>
                <span className="font-mono font-bold text-amber-300 text-base">{voiceState.roomId}</span>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px]">
                  <Lock className="w-3 h-3" />
                  <span>已加密</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center space-x-2">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  {voiceState.status === 'connecting'
                    ? '正在连接信令服务器...'
                    : `当前在线 ${voiceState.participants.length} 人`}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Room Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void handleCopy('room')}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center space-x-1.5 cursor-pointer transition-colors"
          >
            {copiedType === 'room' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedType === 'room' ? '已复制房间号' : '复制房间号'}</span>
          </button>

          <button
            onClick={() => void handleCopy('link')}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center space-x-1.5 cursor-pointer transition-colors"
          >
            {copiedType === 'link' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-amber-400" />}
            <span>{copiedType === 'link' ? '已复制邀请链接' : '复制邀请链接'}</span>
          </button>

          <div className="h-5 w-px bg-slate-800 hidden sm:block mx-1" />

          <button
            onClick={onToggleMute}
            disabled={voiceState.listenOnly}
            title={voiceState.listenOnly ? '当前为仅收听模式' : voiceState.isMuted ? '取消静音' : '麦克风静音'}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              voiceState.isMuted || voiceState.listenOnly
                ? 'bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25'
                : 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
            }`}
          >
            {voiceState.isMuted || voiceState.listenOnly ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{voiceState.listenOnly ? '仅收听' : voiceState.isMuted ? '已静音' : '麦克风开启'}</span>
          </button>

          <button
            onClick={onToggleDeafen}
            title={voiceState.isDeafened ? '恢复收听' : '全部闭麦（静音他人）'}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-colors ${
              voiceState.isDeafened
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                : 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
          >
            {voiceState.isDeafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span>{voiceState.isDeafened ? '已闭麦' : '扬声器正常'}</span>
          </button>

          <button
            onClick={() => void onLeave()}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer transition-colors shadow-md"
          >
            <PhoneOff className="w-4 h-4" />
            <span>退出房间</span>
          </button>
        </div>
      </div>

      {/* Warning Banner */}
      {voiceState.warning && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{voiceState.warning}</span>
          </div>
          {voiceState.warning.includes('自动播放') && (
            <button
              onClick={onResumePlayback}
              className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold shrink-0 cursor-pointer"
            >
              恢复播放
            </button>
          )}
        </div>
      )}

      {/* Room Action Error Banner (permanently mounted live region for screen readers) */}
      <div role="status" aria-live="polite">
        {roomError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{roomError}</span>
            </div>
            <button
              onClick={() => setRoomError(null)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 cursor-pointer"
            >
              关闭
            </button>
          </div>
        )}
      </div>

      {/* Main Content: Participants + Text Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Participants List */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900/60 border border-slate-800 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
              <Radio className="w-4 h-4 text-amber-400" />
              <span>频道成员 ({voiceState.participants.length})</span>
            </h3>

            {!voiceState.listenOnly && audioInputs.length > 1 && (
              <select
                value={selectedDeviceId}
                onChange={(e) => {
                  void handleSwitchMicChange(e.target.value);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50"
              >
                <option value="">切换麦克风：默认</option>
                {audioInputs.map((d, idx) => (
                  <option key={d.deviceId || idx} value={d.deviceId}>
                    {d.label || `麦克风 ${idx + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {voiceState.participants.length <= 1 && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-xs text-slate-400 text-center">
              当前房间只有你一人，把房间号 <span className="font-mono text-amber-300">{voiceState.roomId}</span> 和密码发给队友即可开始群聊。
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {voiceState.participants.map((p) => (
              <div
                key={p.peerId}
                className={`p-3.5 rounded-xl border transition-all ${
                  p.isSpeaking
                    ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-950/70 border-slate-800/90'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-all ${
                        p.isSpeaking
                          ? 'bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/30'
                          : 'bg-slate-800 text-amber-300'
                      }`}
                    >
                      {p.nickname.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-sm font-semibold text-slate-100 truncate">
                          {p.nickname}
                        </span>
                        {p.isSelf && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-medium shrink-0">
                            我
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-[11px] mt-0.5">
                        {p.isSpeaking ? (
                          <span className="text-emerald-400 font-medium">正在说话...</span>
                        ) : p.isMuted ? (
                          <span className="text-rose-400 flex items-center space-x-1">
                            <MicOff className="w-3 h-3" />
                            <span>已静音</span>
                          </span>
                        ) : p.isDeafened ? (
                          <span className="text-amber-400 flex items-center space-x-1">
                            <VolumeX className="w-3 h-3" />
                            <span>已闭麦</span>
                          </span>
                        ) : !p.isSelf && !p.hasAudioStream ? (
                          <span className="text-slate-500">仅收听 / 建立音频中</span>
                        ) : (
                          <span className="text-slate-400">待机中</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Volume bar + slider for remote peers */}
                {!p.isSelf && (
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center space-x-2">
                    <Volume2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(p.volume * 100)}
                      onChange={(e) => onSetPeerVolume(p.peerId, Number(e.target.value) / 100)}
                      aria-label={`调整 ${p.nickname} 的音量`}
                      className="flex-1 accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <span className="text-[11px] font-mono text-slate-400 w-9 text-right">
                      {Math.round(p.volume * 100)}%
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Room Text Chat */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col h-80 lg:h-[420px]">
          <div className="px-4 py-3 border-b border-slate-800 text-xs font-bold text-slate-200 flex items-center justify-between">
            <span>文字频道（P2P 临时消息）</span>
            <span className="text-[11px] font-normal text-slate-500">刷新页面后清空</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 text-xs">
            {voiceState.messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-center px-4">
                暂无消息，可在此发送战网 ID、集合石信息或宏命令。
              </div>
            ) : (
              voiceState.messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-slate-500 mb-0.5">
                    {msg.nickname} · {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div
                    className={`px-3 py-1.5 rounded-xl max-w-[85%] break-words ${
                      msg.isSelf
                        ? 'bg-amber-500/20 border border-amber-500/30 text-amber-100'
                        : 'bg-slate-800 text-slate-200'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSendChat} className="p-2.5 border-t border-slate-800 flex space-x-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              maxLength={500}
              placeholder={voiceState.status === 'connected' ? '发送文字消息...' : '正在连接频道...'}
              className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:outline-none text-xs text-slate-100 placeholder-slate-600"
            />
            <button
              type="submit"
              disabled={voiceState.status !== 'connected' || isSendingChat || !chatInput.trim()}
              className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs cursor-pointer transition-colors"
              aria-label="发送消息"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};
