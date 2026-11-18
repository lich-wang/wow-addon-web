import type {
  NetworkQualityLevel,
  PeerNetworkStats,
  PlaybackMode,
  RelayProvider,
  TransportMode,
  TransportProtocol,
  VoiceChatMessage,
  VoiceConnectionStatus,
  VoiceJoinOptions,
  VoiceParticipant,
} from '../types/voice';
import aecWorkletUrl from './aec/aec3.worklet.ts?worker&url';
import aecWasmUrl from '@ai-ecoverse/wasm-webrtc-audio-processing/webrtc-audio-processing.wasm?url';

const SIGNAL_WS_URL = 'wss://wow.lich.tech/api/voice-ws';
const SIGNAL_CONNECT_TIMEOUT_MS = 8000;
const SIGNAL_PING_INTERVAL_MS = 25000;

const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.miwifi.com:3478' },
  { urls: 'stun:stun.qq.com:3478' },
];

const TURN_CREDENTIALS_PATH = '/api/turn-credentials';
const REMOTE_TURN_CREDENTIALS_URL = 'https://wow.lich.tech/api/turn-credentials';
const TURN_FETCH_TIMEOUT_MS = 4000;
const TURN_CACHE_TTL_MS = 30 * 60 * 1000;

type SinkableAudioContext = AudioContext & { setSinkId?: (sinkId: string) => Promise<void> };
type SinkableAudioElement = HTMLAudioElement & { setSinkId?: (sinkId: string) => Promise<void> };

const NAT_WARNING_TEXT = '与部分成员的语音直连失败，可能受网络（NAT）限制，请更换网络或稍后重试。';
const AUTH_MISMATCH_WARNING_TEXT = '检测到同房间存在密码不匹配的成员，对方无法与您建立语音连接，请核对房间密码。';

const MIC_NOISE_SUPPRESSION_STORAGE_KEY = 'wow_voice_mic_noise_suppression';
const ECHO_CANCELLER_STORAGE_KEY = 'wow_voice_echo_canceller';

/** AEC3 只支持 16k / 48k，AudioContext 因此固定为 48k。 */
const AEC_SAMPLE_RATE = 48000;

export interface MicProcessingSettings {
  /** 降噪：请求噪声抑制 + 自动增益 + 人声隔离（浏览器自带处理）。 */
  noiseSuppression: boolean;
  /** 本机回声消除：用正在播放的远端语音做参考，把麦克风里的回声减掉。 */
  echoCanceller: boolean;
}

export interface MicProcessingState extends MicProcessingSettings {
  /** 回声消除是否真的接进了发送链路。 */
  echoCancellerActive: boolean;
  /** 回声消除不可用的原因（加载失败 / 采样率不支持等）。 */
  echoCancellerError: string | null;
  /** 浏览器/设备实际生效的回声消除；未知时为 null。 */
  echoCancellationActive: boolean | null;
  /** 浏览器/设备实际生效的噪声抑制；未知时为 null。 */
  noiseSuppressionActive: boolean | null;
}

function readStoredBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === '1';
  } catch {
    return fallback;
  }
}

function writeStoredBool(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // Ignore storage errors (private mode / disabled storage)
  }
}

function isValidIceServer(entry: unknown): entry is RTCIceServer {
  if (!entry || typeof entry !== 'object') return false;
  const obj = entry as Record<string, unknown>;
  const hasValidUrls =
    (typeof obj.urls === 'string' && obj.urls.length > 0) ||
    (Array.isArray(obj.urls) && obj.urls.length > 0 && obj.urls.every((u) => typeof u === 'string' && u.length > 0));
  if (!hasValidUrls) return false;
  if (obj.username !== undefined && typeof obj.username !== 'string') return false;
  if (obj.credential !== undefined && typeof obj.credential !== 'string') return false;
  return true;
}

interface PeerMetaPayload {
  nickname: string;
  isMuted: boolean;
  isDeafened: boolean;
  hasMic: boolean;
}

interface ChatPayload {
  id: string;
  nickname: string;
  text: string;
  timestamp: number;
}

type SignalPayload =
  | { kind: 'offer'; sdp: RTCSessionDescriptionInit }
  | { kind: 'answer'; sdp: RTCSessionDescriptionInit }
  | { kind: 'candidate'; candidate: RTCIceCandidateInit };

type ServerMessage =
  | { type: 'joined'; peerId: string; peers: Array<{ peerId: string; meta: unknown }> }
  | { type: 'peer-join'; peerId: string; meta: unknown }
  | { type: 'peer-leave'; peerId: string }
  | { type: 'peer-meta'; peerId: string; meta: unknown }
  | { type: 'signal'; fromPeerId: string; payload: unknown }
  | { type: 'chat'; peerId: string; message: unknown }
  | { type: 'auth-mismatch' }
  | { type: 'pong' };

function isValidPeerMeta(data: unknown): data is PeerMetaPayload {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.nickname === 'string' &&
    typeof obj.isMuted === 'boolean' &&
    typeof obj.isDeafened === 'boolean' &&
    typeof obj.hasMic === 'boolean'
  );
}

function isValidChatPayload(data: unknown): data is ChatPayload {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.nickname === 'string' &&
    typeof obj.text === 'string' &&
    typeof obj.timestamp === 'number' &&
    Number.isFinite(obj.timestamp)
  );
}

function isValidSignalPayload(data: unknown): data is SignalPayload {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  if (obj.kind === 'offer' || obj.kind === 'answer') {
    return Boolean(obj.sdp && typeof obj.sdp === 'object');
  }
  if (obj.kind === 'candidate') {
    return Boolean(obj.candidate && typeof obj.candidate === 'object');
  }
  return false;
}

function normalizeProtocol(value: unknown): TransportProtocol {
  if (value === 'udp') return 'udp';
  if (value === 'tcp' || value === 'tls') return 'tcp';
  return 'unknown';
}

function detectRelayProvider(candidate: {
  address?: string;
  relatedAddress?: string;
  url?: string;
} | undefined): RelayProvider {
  if (!candidate) return 'unknown';
  const text = `${candidate.address ?? ''} ${candidate.relatedAddress ?? ''} ${candidate.url ?? ''}`.toLowerCase();
  if (!text.trim()) return 'unknown';
  if (text.includes('118.193.35.163') || text.includes('lich.tech')) return 'vps';
  if (text.includes('cloudflare')) return 'cloudflare';
  return 'custom';
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 编译 AEC3 的 wasm；compileStreaming 失败（MIME 不对）时退回 arrayBuffer。 */
async function compileAudioProcessingWasm(url: string): Promise<WebAssembly.Module> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`回声消除 wasm 加载失败（HTTP ${response.status}）`);
  }
  if (typeof WebAssembly.compileStreaming === 'function') {
    try {
      return await WebAssembly.compileStreaming(response.clone());
    } catch {
      // 静态服务器未按 application/wasm 返回时退回下面的编译方式
    }
  }
  return WebAssembly.compile(await response.arrayBuffer());
}

async function computeAuthHash(roomId: string, password: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('当前浏览器环境不支持安全加密校验（需要 HTTPS），无法加入加密语音房间。');
  }
  const encoded = new TextEncoder().encode(`${roomId}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface AudioMonitor {
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  dataArray: Uint8Array<ArrayBuffer>;
  /** Present only for remote peers: routes playback through Web Audio instead of an <audio> element. */
  gain?: GainNode;
}

export interface VoiceStateSnapshot {
  status: VoiceConnectionStatus;
  roomId: string;
  selfPeerId: string;
  participants: VoiceParticipant[];
  messages: VoiceChatMessage[];
  warning: string | null;
  autoplayBlocked: boolean;
  error: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  listenOnly: boolean;
  selectedDeviceId: string;
  selectedOutputDeviceId: string;
  playbackMode: PlaybackMode;
  networkSummary: PeerNetworkStats | null;
  micProcessing: MicProcessingState;
}

type StateListener = (snapshot: VoiceStateSnapshot) => void;

export class VoiceRoomManager {
  private ws: WebSocket | null = null;
  private pingTimer: number | null = null;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private failedPeerIds = new Set<string>();
  private restartedIcePeers = new Set<string>();
  private activeIceServers: RTCIceServer[] = FALLBACK_ICE_SERVERS;

  private localStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private monitors = new Map<string, AudioMonitor>();
  private peerAudioElements = new Map<string, HTMLAudioElement>();
  private peerStreams = new Map<string, MediaStream>();
  private peerPlaybackModes = new Map<string, PlaybackMode>();
  private peerMeta = new Map<string, PeerMetaPayload>();
  private peerVolumes = new Map<string, number>();
  private peerLevels = new Map<string, { level: number; speaking: boolean }>();
  private peerNetworkStats = new Map<string, PeerNetworkStats>();
  private prevRtpCounts = new Map<string, Map<string, { received: number; lost: number }>>();
  private prevByteCounts = new Map<
    string,
    { timestamp: number; inboundBytes: number; outboundBytes: number }
  >();
  private levelTimer: number | null = null;
  private statsTimer: number | null = null;

  private status: VoiceConnectionStatus = 'idle';
  private roomId = '';
  private selfPeerId = '';
  private nickname = '';
  private isMuted = false;
  private isDeafened = false;
  private listenOnly = false;
  private selectedDeviceId = '';
  private selectedOutputDeviceId = '';
  private warning: string | null = null;
  private autoplayBlocked = false;
  private playbackBlockVersion = 0;
  private error: string | null = null;
  private messages: VoiceChatMessage[] = [];
  private connectedPeerIds = new Set<string>();
  private listeners = new Set<StateListener>();
  private joinAttemptId = 0;
  private pendingMicTrack: MediaStreamTrack | null = null;
  private pendingMicStream: MediaStream | null = null;
  private peerTrackCancelers = new Map<string, Set<() => void>>();
  private micSwitchChain: Promise<void> = Promise.resolve();
  private outputSwitchChain: Promise<void> = Promise.resolve();
  private cachedIceServers: { iceServers: RTCIceServer[]; expiresAt: number } | null = null;
  private micNoiseSuppression = readStoredBool(MIC_NOISE_SUPPRESSION_STORAGE_KEY, true);
  private aecEnabled = readStoredBool(ECHO_CANCELLER_STORAGE_KEY, true);
  private micAppliedSettings: {
    echoCancellation: boolean | null;
    noiseSuppression: boolean | null;
    autoGainControl: boolean | null;
  } | null = null;
  /** 原始麦克风流（getUserMedia 的结果），用于重采/设置查询与停止。 */
  private captureStream: MediaStream | null = null;
  private aecNode: AudioWorkletNode | null = null;
  private aecReferenceGain: GainNode | null = null;
  private aecDestination: MediaStreamAudioDestinationNode | null = null;
  private aecMicSource: MediaStreamAudioSourceNode | null = null;
  private aecWasmModule: WebAssembly.Module | null = null;
  private aecLoadPromise: Promise<boolean> | null = null;
  /** aecLoadPromise 绑定的 AudioContext；退房会关掉旧 context，必须重载模块。 */
  private aecLoadContext: AudioContext | null = null;
  private aecError: string | null = null;

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): VoiceStateSnapshot {
    const participants: VoiceParticipant[] = [];

    if (this.status === 'connected' || this.status === 'connecting') {
      const selfLevel = this.peerLevels.get('self') ?? { level: 0, speaking: false };
      participants.push({
        peerId: this.selfPeerId || 'self',
        nickname: this.nickname,
        isSelf: true,
        isMuted: this.listenOnly || this.isMuted,
        isDeafened: this.isDeafened,
        isSpeaking: !this.listenOnly && !this.isMuted && selfLevel.speaking,
        audioLevel: !this.listenOnly && !this.isMuted ? selfLevel.level : 0,
        hasAudioStream: !this.listenOnly && Boolean(this.localStream),
        volume: 1,
      });

      for (const peerId of this.connectedPeerIds) {
        const meta = this.peerMeta.get(peerId);
        const lvl = this.peerLevels.get(peerId) ?? { level: 0, speaking: false };
        const isPeerMuted = meta?.isMuted ?? false;
        participants.push({
          peerId,
          nickname: meta?.nickname || `队友-${peerId.slice(0, 4)}`,
          isSelf: false,
          isMuted: isPeerMuted,
          isDeafened: meta?.isDeafened ?? false,
          isSpeaking: !isPeerMuted && lvl.speaking,
          audioLevel: !isPeerMuted ? lvl.level : 0,
          hasAudioStream: this.peerStreams.has(peerId),
          volume: this.peerVolumes.get(peerId) ?? 1,
          network: this.peerNetworkStats.get(peerId),
        });
      }
    }

    return {
      status: this.status,
      roomId: this.roomId,
      selfPeerId: this.selfPeerId,
      participants,
      messages: [...this.messages],
      warning: this.warning,
      autoplayBlocked: this.autoplayBlocked,
      error: this.error,
      isMuted: this.isMuted,
      isDeafened: this.isDeafened,
      listenOnly: this.listenOnly,
      selectedDeviceId: this.selectedDeviceId,
      selectedOutputDeviceId: this.selectedOutputDeviceId,
      playbackMode: this.computePlaybackMode(),
      networkSummary: this.computeNetworkSummary(),
      micProcessing: this.computeMicProcessing(),
    };
  }

  private computeMicProcessing(): MicProcessingState {
    return {
      noiseSuppression: this.micNoiseSuppression,
      echoCanceller: this.aecEnabled,
      echoCancellerActive: Boolean(this.aecNode && this.captureStream && this.localStream !== this.captureStream),
      echoCancellerError: this.aecError,
      echoCancellationActive: this.micAppliedSettings?.echoCancellation ?? null,
      noiseSuppressionActive: this.micAppliedSettings?.noiseSuppression ?? null,
    };
  }

  private computePlaybackMode(): PlaybackMode {
    let hasWebAudio = false;
    for (const mode of this.peerPlaybackModes.values()) {
      if (mode === 'audio-element') return 'audio-element';
      if (mode === 'web-audio') hasWebAudio = true;
    }
    return hasWebAudio ? 'web-audio' : 'unknown';
  }

  private computeNetworkSummary(): PeerNetworkStats | null {
    if (this.status !== 'connected' || this.peerConnections.size === 0) return null;

    const qualityRank: Record<NetworkQualityLevel, number> = {
      excellent: 0,
      good: 1,
      fair: 2,
      connecting: 3,
      poor: 4,
    };

    let worstQuality: NetworkQualityLevel = 'excellent';
    let maxRtt: number | null = null;
    let maxLoss: number | null = null;
    let transport: TransportMode = 'unknown';
    let totalUplink: number | null = null;
    let totalDownlink: number | null = null;
    let maxUplinkRtt: number | null = null;
    let maxDownlinkRtt: number | null = null;
    const protocols = new Set<TransportProtocol>();
    const relays = new Set<RelayProvider>();

    for (const peerId of this.peerConnections.keys()) {
      const stat = this.peerNetworkStats.get(peerId);
      if (!stat) {
        if (qualityRank.connecting > qualityRank[worstQuality]) {
          worstQuality = 'connecting';
        }
        continue;
      }
      if (qualityRank[stat.quality] > qualityRank[worstQuality]) {
        worstQuality = stat.quality;
      }
      if (stat.rttMs !== null && (maxRtt === null || stat.rttMs > maxRtt)) {
        maxRtt = stat.rttMs;
      }
      if (stat.packetLossPct !== null && (maxLoss === null || stat.packetLossPct > maxLoss)) {
        maxLoss = stat.packetLossPct;
      }
      if (stat.transport === 'relay') {
        transport = 'relay';
      } else if (stat.transport === 'p2p' && transport === 'unknown') {
        transport = 'p2p';
      }
      if (stat.protocol !== 'unknown') {
        protocols.add(stat.protocol);
      }
      if (stat.relay !== 'unknown' && stat.relay !== 'none') {
        relays.add(stat.relay);
      }
      if (stat.uplinkKbps !== null) {
        totalUplink = (totalUplink ?? 0) + stat.uplinkKbps;
      }
      if (stat.downlinkKbps !== null) {
        totalDownlink = (totalDownlink ?? 0) + stat.downlinkKbps;
      }
      if (stat.uplinkRttMs !== null && (maxUplinkRtt === null || stat.uplinkRttMs > maxUplinkRtt)) {
        maxUplinkRtt = stat.uplinkRttMs;
      }
      if (stat.downlinkRttMs !== null && (maxDownlinkRtt === null || stat.downlinkRttMs > maxDownlinkRtt)) {
        maxDownlinkRtt = stat.downlinkRttMs;
      }
    }

    const protocol: TransportProtocol =
      protocols.size === 0 ? 'unknown' : protocols.size === 1 ? Array.from(protocols)[0] : 'unknown';
    let relay: RelayProvider = 'unknown';
    if (transport === 'p2p') {
      relay = 'none';
    } else if (transport === 'relay') {
      relay = relays.size === 0 ? 'unknown' : relays.size === 1 ? Array.from(relays)[0] : 'mixed';
    }

    return {
      quality: worstQuality,
      rttMs: maxRtt,
      packetLossPct: maxLoss,
      transport,
      protocol,
      relay,
      uplinkKbps: totalUplink,
      downlinkKbps: totalDownlink,
      uplinkRttMs: maxUplinkRtt,
      downlinkRttMs: maxDownlinkRtt,
    };
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.audioContext) {
      try {
        // AEC3 只支持 48k/16k，固定 48k 让参考信号和麦克风采样率一致。
        this.audioContext = new AudioCtx({ sampleRate: AEC_SAMPLE_RATE });
      } catch {
        try {
          this.audioContext = new AudioCtx();
        } catch {
          return null;
        }
      }
    }
    if (this.audioContext.state === 'suspended') {
      void this.audioContext
        .resume()
        .then(() => {
          if (
            this.audioContext?.state === 'running' &&
            this.autoplayBlocked &&
            this.peerAudioElements.size === 0
          ) {
            this.autoplayBlocked = false;
            this.emit();
          }
        })
        .catch(() => {
          // Keep the autoplay-blocked state; the user can retry from the UI.
        });
    }
    return this.audioContext;
  }

  /**
   * Creates the analyser used by the speaking indicator.
   * When `playback` is true the same source is also routed through a GainNode to the
   * AudioContext destination, so remote voice is rendered by Web Audio instead of an
   * <audio> element. Web Audio output is not a WebRTC communications render session,
   * which avoids Windows ducking/muting other applications (e.g. game audio).
   */
  private attachMonitor(key: string, stream: MediaStream, playback = false): boolean {
    this.detachMonitor(key);
    const ctx = this.ensureAudioContext();
    if (!ctx || stream.getAudioTracks().length === 0) return false;

    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let gain: GainNode | null = null;
    try {
      source = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.45;
      source.connect(analyser);
      if (playback) {
        gain = ctx.createGain();
        gain.gain.value = this.isDeafened ? 0 : (this.peerVolumes.get(key) ?? 1);
        source.connect(gain);
        gain.connect(ctx.destination);
        // 同一路信号再送进 AEC 的参考输入（没有 AEC 时为 null，跳过）。
        if (this.aecReferenceGain) gain.connect(this.aecReferenceGain);
      }
      const dataArray = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      this.monitors.set(key, { source, analyser, dataArray, gain: gain ?? undefined });
      return true;
    } catch {
      try {
        source?.disconnect();
        analyser?.disconnect();
        gain?.disconnect();
      } catch {
        // Ignore cleanup errors
      }
      return false;
    }
  }

  private detachMonitor(key: string): void {
    const existing = this.monitors.get(key);
    if (existing) {
      try {
        existing.source.disconnect();
        existing.analyser.disconnect();
        existing.gain?.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.monitors.delete(key);
    }
    this.peerLevels.delete(key);
  }

  private markAutoplayBlocked(): void {
    this.autoplayBlocked = true;
    this.playbackBlockVersion++;
    this.emit();
  }

  private attachPlayback(peerId: string, stream: MediaStream): void {
    const ctx = this.audioContext as SinkableAudioContext | null;
    // A selected output device only works with Web Audio when AudioContext.setSinkId
    // is available; otherwise use the <audio> element path so setSinkId can apply.
    const canUseWebAudio = !this.selectedOutputDeviceId || Boolean(ctx?.setSinkId);
    if (canUseWebAudio && this.attachMonitor(peerId, stream, true)) {
      this.peerPlaybackModes.set(peerId, 'web-audio');
      this.clearFallbackAudio(peerId);
      if (this.audioContext?.state === 'suspended') {
        this.markAutoplayBlocked();
      }
      return;
    }

    // Keep the level meter even when playback falls back to an <audio> element.
    this.attachMonitor(peerId, stream);

    // Fallback for browsers where MediaStream -> Web Audio is unavailable.
    let audio = this.peerAudioElements.get(peerId);
    if (!audio) {
      audio = new Audio();
      audio.autoplay = true;
      this.peerAudioElements.set(peerId, audio);
    }
    audio.srcObject = stream;
    audio.volume = this.isDeafened ? 0 : (this.peerVolumes.get(peerId) ?? 1);
    this.peerPlaybackModes.set(peerId, 'audio-element');
    const attemptId = this.joinAttemptId;
    const sinkable = audio as SinkableAudioElement;
    const sinkReady =
      this.selectedOutputDeviceId && sinkable.setSinkId
        ? sinkable
            .setSinkId(this.selectedOutputDeviceId)
            .then(() => true)
            .catch(() => false)
        : Promise.resolve(true);
    void sinkReady
      .then(() => {
        if (this.joinAttemptId !== attemptId) return;
        if (this.peerAudioElements.get(peerId) !== audio) return;
        return audio.play();
      })
      .catch(() => {
        if (this.joinAttemptId !== attemptId) return;
        if (this.peerAudioElements.get(peerId) !== audio) return;
        this.markAutoplayBlocked();
      });
  }

  private clearFallbackAudio(peerId: string): void {
    const audio = this.peerAudioElements.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      this.peerAudioElements.delete(peerId);
    }
  }

  private async applyOutputDevice(deviceId: string): Promise<void> {
    const ctx = this.audioContext as SinkableAudioContext | null;
    if (ctx?.setSinkId) {
      await ctx.setSinkId(deviceId);
    }
    for (const audio of this.peerAudioElements.values()) {
      const sinkable = audio as SinkableAudioElement;
      if (!sinkable.setSinkId) continue;
      await sinkable.setSinkId(deviceId);
    }
  }

  private rebuildPlayback(): void {
    for (const [peerId, stream] of this.peerStreams.entries()) {
      this.attachPlayback(peerId, stream);
    }
  }

  private startLevelPolling(): void {
    this.stopLevelPolling();
    this.levelTimer = window.setInterval(() => {
      let changed = false;

      for (const [key, monitor] of this.monitors.entries()) {
        monitor.analyser.getByteTimeDomainData(monitor.dataArray);
        let sumSquares = 0;
        for (let i = 0; i < monitor.dataArray.length; i++) {
          const normalized = (monitor.dataArray[i] - 128) / 128;
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / monitor.dataArray.length);
        const level = Math.min(1, rms * 3.5);
        const speaking = level > 0.06;

        const prev = this.peerLevels.get(key);
        if (!prev || prev.speaking !== speaking || Math.abs(prev.level - level) > 0.05) {
          this.peerLevels.set(key, { level, speaking });
          changed = true;
        }
      }

      if (changed) {
        this.emit();
      }
    }, 120);
  }

  private stopLevelPolling(): void {
    if (this.levelTimer !== null) {
      window.clearInterval(this.levelTimer);
      this.levelTimer = null;
    }
  }

  private startStatsPolling(): void {
    this.stopStatsPolling();
    const attemptId = this.joinAttemptId;
    this.statsTimer = window.setInterval(() => {
      if (this.joinAttemptId !== attemptId || this.peerConnections.size === 0) return;
      void this.collectPeerStats(attemptId);
    }, 2000);
  }

  private stopStatsPolling(): void {
    if (this.statsTimer !== null) {
      window.clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }

  private async collectPeerStats(attemptId: number): Promise<void> {
    let changed = false;
    const entries = Array.from(this.peerConnections.entries());

    await Promise.all(
      entries.map(async ([peerId, pc]) => {
        if (this.joinAttemptId !== attemptId) return;
        try {
          const report = await pc.getStats();
          if (this.joinAttemptId !== attemptId || this.peerConnections.get(peerId) !== pc) return;

          let selectedPairId: string | undefined;
          const candidatePairs = new Map<
            string,
            {
              currentRoundTripTime?: number;
              localCandidateId?: string;
              remoteCandidateId?: string;
              state?: string;
              nominated?: boolean;
            }
          >();
          let fallbackPair: {
            currentRoundTripTime?: number;
            localCandidateId?: string;
            remoteCandidateId?: string;
            state?: string;
            nominated?: boolean;
          } | null = null;
          const candidates = new Map<
            string,
            {
              candidateType?: string;
              protocol?: string;
              relayProtocol?: string;
              address?: string;
              relatedAddress?: string;
              url?: string;
            }
          >();
          const inboundStreams = new Map<string, { received: number; lost: number; bytes: number }>();
          const outboundStreams = new Map<string, { sent: number; bytes: number }>();
          let remoteInboundRtt: number | null = null;

          report.forEach((stat) => {
            if (stat.type === 'transport') {
              const t = stat as unknown as { selectedCandidatePairId?: string };
              if (typeof t.selectedCandidatePairId === 'string') {
                selectedPairId = t.selectedCandidatePairId;
              }
            } else if (stat.type === 'candidate-pair') {
              const pair = stat as unknown as {
                state?: string;
                nominated?: boolean;
                currentRoundTripTime?: number;
                localCandidateId?: string;
                remoteCandidateId?: string;
              };
              candidatePairs.set(stat.id, pair);
              if (pair.state === 'succeeded' && (pair.nominated || !fallbackPair)) {
                fallbackPair = pair;
              }
            } else if (stat.type === 'local-candidate' || stat.type === 'remote-candidate') {
              candidates.set(
                stat.id,
                stat as unknown as {
                  candidateType?: string;
                  protocol?: string;
                  relayProtocol?: string;
                  address?: string;
                  relatedAddress?: string;
                  url?: string;
                }
              );
            } else if (stat.type === 'inbound-rtp') {
              const rtp = stat as unknown as {
                kind?: string;
                mediaType?: string;
                packetsReceived?: number;
                packetsLost?: number;
                bytesReceived?: number;
              };
              if (rtp.kind === 'audio' || rtp.mediaType === 'audio') {
                inboundStreams.set(stat.id, {
                  received: rtp.packetsReceived ?? 0,
                  lost: rtp.packetsLost ?? 0,
                  bytes: rtp.bytesReceived ?? 0,
                });
              }
            } else if (stat.type === 'outbound-rtp') {
              const rtp = stat as unknown as {
                kind?: string;
                mediaType?: string;
                packetsSent?: number;
                bytesSent?: number;
              };
              if (rtp.kind === 'audio' || rtp.mediaType === 'audio') {
                outboundStreams.set(stat.id, {
                  sent: rtp.packetsSent ?? 0,
                  bytes: rtp.bytesSent ?? 0,
                });
              }
            } else if (stat.type === 'remote-inbound-rtp') {
              const rtp = stat as unknown as { roundTripTime?: number; kind?: string; mediaType?: string };
              if (
                (rtp.kind === 'audio' || rtp.mediaType === 'audio') &&
                typeof rtp.roundTripTime === 'number' &&
                Number.isFinite(rtp.roundTripTime)
              ) {
                remoteInboundRtt = Math.max(remoteInboundRtt ?? 0, rtp.roundTripTime);
              }
            }
          });

          const activePair = (selectedPairId ? candidatePairs.get(selectedPairId) : undefined) ?? fallbackPair;

          let transport: TransportMode = 'unknown';
          let protocol: TransportProtocol = 'unknown';
          let relay: RelayProvider = 'unknown';
          let rttMs: number | null = null;
          if (activePair) {
            const pairObj = activePair as {
              currentRoundTripTime?: number;
              localCandidateId?: string;
              remoteCandidateId?: string;
            };
            if (typeof pairObj.currentRoundTripTime === 'number' && Number.isFinite(pairObj.currentRoundTripTime)) {
              rttMs = Math.round(pairObj.currentRoundTripTime * 1000);
            }
            const localCandidate = pairObj.localCandidateId
              ? candidates.get(pairObj.localCandidateId)
              : undefined;
            const remoteCandidate = pairObj.remoteCandidateId
              ? candidates.get(pairObj.remoteCandidateId)
              : undefined;
            const localType = localCandidate?.candidateType;
            const remoteType = remoteCandidate?.candidateType;
            if (localType === 'relay' || remoteType === 'relay') {
              transport = 'relay';
              const relayCandidate =
                localType === 'relay' ? localCandidate : remoteType === 'relay' ? remoteCandidate : localCandidate ?? remoteCandidate;
              relay = detectRelayProvider(relayCandidate);
            } else if (localType || remoteType) {
              transport = 'p2p';
              relay = 'none';
            }
            const localRelayProtocol = localType === 'relay' ? localCandidate?.relayProtocol : undefined;
            protocol = normalizeProtocol(
              localRelayProtocol ?? localCandidate?.protocol ?? remoteCandidate?.protocol
            );
          }

          let packetLossPct: number | null = null;
          if (inboundStreams.size > 0) {
            const prevByStream = this.prevRtpCounts.get(peerId) ?? new Map<string, { received: number; lost: number }>();
            const nextByStream = new Map<string, { received: number; lost: number }>();
            let dRecvTotal = 0;
            let dLostTotal = 0;
            let hasDelta = false;

            for (const [streamId, curr] of inboundStreams.entries()) {
              const prev = prevByStream.get(streamId);
              if (prev && curr.received >= prev.received) {
                dRecvTotal += curr.received - prev.received;
                dLostTotal += Math.max(0, curr.lost - prev.lost);
                hasDelta = true;
              }
              nextByStream.set(streamId, curr);
            }

            this.prevRtpCounts.set(peerId, nextByStream);
            if (hasDelta) {
              const total = dRecvTotal + dLostTotal;
              packetLossPct = total > 0 ? Math.round((dLostTotal / total) * 1000) / 10 : 0;
            }
          } else {
            this.prevRtpCounts.delete(peerId);
          }

          let inboundBytes = 0;
          for (const stream of inboundStreams.values()) {
            inboundBytes += stream.bytes;
          }
          let outboundBytes = 0;
          for (const stream of outboundStreams.values()) {
            outboundBytes += stream.bytes;
          }
          const now = performance.now();
          const prevBytes = this.prevByteCounts.get(peerId);
          let uplinkKbps: number | null = null;
          let downlinkKbps: number | null = null;
          if (prevBytes && now > prevBytes.timestamp) {
            const seconds = (now - prevBytes.timestamp) / 1000;
            if (seconds > 0) {
              downlinkKbps = Math.max(
                0,
                Math.round(((inboundBytes - prevBytes.inboundBytes) * 8) / 1000 / seconds)
              );
              uplinkKbps = Math.max(
                0,
                Math.round(((outboundBytes - prevBytes.outboundBytes) * 8) / 1000 / seconds)
              );
            }
          }
          this.prevByteCounts.set(peerId, { timestamp: now, inboundBytes, outboundBytes });

          const uplinkRttMs = remoteInboundRtt !== null ? Math.round(remoteInboundRtt * 1000) : rttMs;
          const downlinkRttMs = rttMs;

          let quality: NetworkQualityLevel;
          if (pc.connectionState === 'failed') {
            quality = 'poor';
          } else if (pc.connectionState !== 'connected' || rttMs === null) {
            quality = 'connecting';
          } else {
            const loss = packetLossPct ?? 0;
            if (rttMs <= 80 && loss < 1) {
              quality = 'excellent';
            } else if (rttMs <= 160 && loss < 3) {
              quality = 'good';
            } else if (rttMs <= 300 && loss < 8) {
              quality = 'fair';
            } else {
              quality = 'poor';
            }
          }

          const nextStat: PeerNetworkStats = {
            quality,
            rttMs,
            packetLossPct,
            transport,
            protocol,
            relay,
            uplinkKbps,
            downlinkKbps,
            uplinkRttMs,
            downlinkRttMs,
          };
          const prevStat = this.peerNetworkStats.get(peerId);
          if (
            !prevStat ||
            prevStat.quality !== nextStat.quality ||
            prevStat.rttMs !== nextStat.rttMs ||
            prevStat.packetLossPct !== nextStat.packetLossPct ||
            prevStat.transport !== nextStat.transport ||
            prevStat.protocol !== nextStat.protocol ||
            prevStat.relay !== nextStat.relay ||
            prevStat.uplinkKbps !== nextStat.uplinkKbps ||
            prevStat.downlinkKbps !== nextStat.downlinkKbps ||
            prevStat.uplinkRttMs !== nextStat.uplinkRttMs ||
            prevStat.downlinkRttMs !== nextStat.downlinkRttMs
          ) {
            this.peerNetworkStats.set(peerId, nextStat);
            changed = true;
          }
        } catch {
          // Ignore transient getStats failures on closing connections
        }
      })
    );

    if (changed && this.joinAttemptId === attemptId) {
      this.emit();
    }
  }

  private sendWs(data: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private applyPeerMeta(peerId: string, rawMeta: unknown): void {
    if (!isValidPeerMeta(rawMeta)) return;
    this.peerMeta.set(peerId, {
      nickname: rawMeta.nickname.slice(0, 32) || `队友-${peerId.slice(0, 4)}`,
      isMuted: rawMeta.isMuted,
      isDeafened: rawMeta.isDeafened,
      hasMic: rawMeta.hasMic,
    });
  }

  private createPeerConnection(remotePeerId: string, attemptId: number): RTCPeerConnection {
    const existing = this.peerConnections.get(remotePeerId);
    if (existing) {
      existing.close();
      this.peerConnections.delete(remotePeerId);
    }

    const pc = new RTCPeerConnection({ iceServers: this.activeIceServers });
    this.peerConnections.set(remotePeerId, pc);

    const activeStream = this.pendingMicStream ?? this.localStream;
    const activeTrack = this.pendingMicTrack ?? activeStream?.getAudioTracks()[0];
    if (activeTrack && activeStream) {
      pc.addTrack(activeTrack, activeStream);
    } else {
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    pc.onicecandidate = (event) => {
      if (this.joinAttemptId !== attemptId || !event.candidate) return;
      this.sendWs({
        type: 'signal',
        targetPeerId: remotePeerId,
        payload: { kind: 'candidate', candidate: event.candidate.toJSON() },
      });
    };

    pc.ontrack = (event) => {
      if (this.joinAttemptId !== attemptId) return;
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      this.peerStreams.set(remotePeerId, stream);
      this.attachPlayback(remotePeerId, stream);
      this.emit();
    };

    pc.onconnectionstatechange = () => {
      if (this.joinAttemptId !== attemptId) return;
      if (pc.connectionState === 'connected') {
        this.failedPeerIds.delete(remotePeerId);
        if (this.failedPeerIds.size === 0 && this.warning === NAT_WARNING_TEXT) {
          this.warning = null;
        }
        this.emit();
      } else if (pc.connectionState === 'failed') {
        const isInitiator = this.selfPeerId < remotePeerId;
        if (isInitiator && !this.restartedIcePeers.has(remotePeerId)) {
          this.restartedIcePeers.add(remotePeerId);
          void this.initiateOffer(remotePeerId, pc, attemptId, true);
          return;
        }
        this.failedPeerIds.add(remotePeerId);
        this.warning = NAT_WARNING_TEXT;
        this.emit();
      }
    };

    return pc;
  }

  private async initiateOffer(
    remotePeerId: string,
    pc: RTCPeerConnection,
    attemptId: number,
    iceRestart = false
  ): Promise<void> {
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        iceRestart,
      });
      if (this.joinAttemptId !== attemptId || this.peerConnections.get(remotePeerId) !== pc) return;
      await pc.setLocalDescription(offer);
      this.sendWs({
        type: 'signal',
        targetPeerId: remotePeerId,
        payload: { kind: 'offer', sdp: offer },
      });
    } catch {
      // Connection state handler will report if recovery fails
    }
  }

  private async flushPendingCandidates(remotePeerId: string, pc: RTCPeerConnection): Promise<void> {
    const queued = this.pendingCandidates.get(remotePeerId);
    if (!queued || queued.length === 0) return;
    this.pendingCandidates.delete(remotePeerId);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        // Ignore stale candidates
      }
    }
  }

  private async handleSignal(fromPeerId: string, rawPayload: unknown, attemptId: number): Promise<void> {
    if (this.joinAttemptId !== attemptId || !isValidSignalPayload(rawPayload)) return;

    let pc = this.peerConnections.get(fromPeerId);
    if (!pc) {
      if (!this.connectedPeerIds.has(fromPeerId)) return;
      pc = this.createPeerConnection(fromPeerId, attemptId);
    }

    try {
      if (rawPayload.kind === 'offer') {
        await pc.setRemoteDescription(rawPayload.sdp);
        if (this.joinAttemptId !== attemptId || this.peerConnections.get(fromPeerId) !== pc) return;
        await this.flushPendingCandidates(fromPeerId, pc);
        const answer = await pc.createAnswer();
        if (this.joinAttemptId !== attemptId || this.peerConnections.get(fromPeerId) !== pc) return;
        await pc.setLocalDescription(answer);
        this.sendWs({
          type: 'signal',
          targetPeerId: fromPeerId,
          payload: { kind: 'answer', sdp: answer },
        });
      } else if (rawPayload.kind === 'answer') {
        if (pc.signalingState !== 'have-local-offer') return;
        await pc.setRemoteDescription(rawPayload.sdp);
        await this.flushPendingCandidates(fromPeerId, pc);
      } else if (rawPayload.kind === 'candidate') {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(rawPayload.candidate);
        } else {
          const list = this.pendingCandidates.get(fromPeerId) ?? [];
          list.push(rawPayload.candidate);
          this.pendingCandidates.set(fromPeerId, list);
        }
      }
    } catch {
      // Ignore transient signaling race errors
    }
  }

  private cleanupPeer(peerId: string): void {
    this.connectedPeerIds.delete(peerId);
    this.peerMeta.delete(peerId);
    this.peerStreams.delete(peerId);
    this.peerPlaybackModes.delete(peerId);
    this.pendingCandidates.delete(peerId);
    this.failedPeerIds.delete(peerId);
    this.restartedIcePeers.delete(peerId);
    this.peerNetworkStats.delete(peerId);
    this.prevRtpCounts.delete(peerId);
    this.prevByteCounts.delete(peerId);
    this.detachMonitor(peerId);

    const cancelers = this.peerTrackCancelers.get(peerId);
    if (cancelers) {
      for (const cancel of cancelers) {
        cancel();
      }
      this.peerTrackCancelers.delete(peerId);
    }

    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }

    this.clearFallbackAudio(peerId);

    if (this.failedPeerIds.size === 0 && this.warning === NAT_WARNING_TEXT) {
      this.warning = null;
    }
    this.emit();
  }

  private handleServerMessage(msg: ServerMessage, attemptId: number): void {
    if (this.joinAttemptId !== attemptId) return;

    switch (msg.type) {
      case 'peer-join': {
        if (!msg.peerId || msg.peerId === this.selfPeerId) return;
        this.connectedPeerIds.add(msg.peerId);
        this.applyPeerMeta(msg.peerId, msg.meta);
        const pc = this.createPeerConnection(msg.peerId, attemptId);
        if (this.selfPeerId < msg.peerId) {
          void this.initiateOffer(msg.peerId, pc, attemptId);
        }
        this.emit();
        break;
      }
      case 'peer-leave': {
        if (msg.peerId) {
          this.cleanupPeer(msg.peerId);
        }
        break;
      }
      case 'peer-meta': {
        if (msg.peerId) {
          this.applyPeerMeta(msg.peerId, msg.meta);
          this.emit();
        }
        break;
      }
      case 'signal': {
        if (msg.fromPeerId) {
          void this.handleSignal(msg.fromPeerId, msg.payload, attemptId);
        }
        break;
      }
      case 'chat': {
        if (!isValidChatPayload(msg.message)) return;
        const data = msg.message;
        this.messages = [
          ...this.messages.slice(-99),
          {
            id: data.id,
            peerId: msg.peerId,
            nickname: data.nickname.slice(0, 32) || `队友-${msg.peerId.slice(0, 4)}`,
            text: data.text.slice(0, 1000),
            timestamp: data.timestamp,
            isSelf: false,
          },
        ];
        this.emit();
        break;
      }
      case 'auth-mismatch': {
        this.warning = AUTH_MISMATCH_WARNING_TEXT;
        this.emit();
        break;
      }
      default:
        break;
    }
  }

  /**
   * 麦克风采集约束。外放回声由本机 AEC3（见 `buildOutboundStream`）负责减掉，
   * 这里仍然请求浏览器自带的降噪/自动增益，用来压键盘声、风扇声。
   */
  private buildMicConstraints(
    deviceId: string | undefined,
    noiseSuppression: boolean,
    includeLegacy = true
  ): MediaTrackConstraints {
    const constraints: Record<string, unknown> = {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      echoCancellation: noiseSuppression,
      noiseSuppression,
      autoGainControl: noiseSuppression,
    };
    if (noiseSuppression && includeLegacy) {
      // Chrome 扩展约束：人声隔离 + 高频/键入噪声过滤，不支持的浏览器会忽略未知约束。
      constraints.voiceIsolation = true;
      constraints.googEchoCancellation = true;
      constraints.googNoiseSuppression = true;
      constraints.googAutoGainControl = true;
      constraints.googHighpassFilter = true;
      constraints.googTypingNoiseDetection = true;
    }
    return constraints as MediaTrackConstraints;
  }

  private async acquireMicStream(deviceId: string | undefined): Promise<MediaStream> {
    const attempts: MediaTrackConstraints[] = [
      this.buildMicConstraints(deviceId, this.micNoiseSuppression),
      this.buildMicConstraints(deviceId, this.micNoiseSuppression, false),
    ];
    let lastError: unknown = null;
    for (const audio of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
        this.rememberMicSettings(stream);
        return stream;
      } catch (err) {
        lastError = err;
        const name = (err as DOMException)?.name;
        // 只有“约束不被支持”时才降级重试，权限/设备错误直接抛出。
        if (name !== 'OverconstrainedError' && name !== 'TypeError') {
          throw err;
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error('无法获取麦克风');
  }

  private rememberMicSettings(stream: MediaStream): void {
    const track = stream.getAudioTracks()[0];
    let settings: MediaTrackSettings | undefined;
    try {
      settings = track?.getSettings?.();
    } catch {
      settings = undefined;
    }
    if (!settings) {
      this.micAppliedSettings = null;
      return;
    }
    const read = (key: 'echoCancellation' | 'noiseSuppression' | 'autoGainControl'): boolean | null => {
      const value = settings?.[key];
      return typeof value === 'boolean' ? value : null;
    };
    this.micAppliedSettings = {
      echoCancellation: read('echoCancellation'),
      noiseSuppression: read('noiseSuppression'),
      autoGainControl: read('autoGainControl'),
    };
  }

  /** 麦克风音轨当前是否应该出声（手动闭麦时整条链路静音）。 */
  private isMicSending(): boolean {
    return !this.isMuted;
  }

  private applyMicTrackEnabled(): void {
    const enabled = this.isMicSending();
    for (const stream of [this.captureStream, this.localStream]) {
      if (!stream) continue;
      for (const track of stream.getAudioTracks()) {
        track.enabled = enabled;
      }
    }
    if (this.pendingMicTrack) {
      this.pendingMicTrack.enabled = enabled;
    }
  }

  /**
   * 准备 AEC3：编译 wasm + 加载 AudioWorklet 模块（只做一次）。
   * 浏览器不支持 AudioWorklet 或加载失败时返回 false，调用方回退到原始麦克风。
   */
  private async ensureAec3(ctx: AudioContext): Promise<boolean> {
    if (!ctx.audioWorklet) {
      this.aecError = '当前浏览器不支持 AudioWorklet，无法启用回声消除';
      return false;
    }
    if (this.aecLoadPromise && this.aecLoadContext === ctx) return this.aecLoadPromise;

    this.aecLoadContext = ctx;
    this.aecLoadPromise = (async () => {
      try {
        const wasm = this.aecWasmModule ?? (await compileAudioProcessingWasm(aecWasmUrl));
        const [, wasmModule] = await Promise.all([ctx.audioWorklet.addModule(aecWorkletUrl), wasm]);
        this.aecWasmModule = wasmModule;
        this.aecError = null;
        return true;
      } catch (err) {
        this.aecError = err instanceof Error ? err.message : String(err);
        // 允许下次重新尝试（例如网络恢复 / 新的 AudioContext）。
        this.aecLoadPromise = null;
        this.aecLoadContext = null;
        return false;
      }
    })();
    return this.aecLoadPromise;
  }

  /**
   * 建立「麦克风 → AEC3 → 发送」的处理链路，并把所有远端播放接成参考信号。
   * 失败或关闭时直接返回原始麦克风流。
   */
  private async buildOutboundStream(raw: MediaStream): Promise<MediaStream> {
    const ctx = this.ensureAudioContext();
    if (!ctx || !this.aecEnabled || this.listenOnly || !raw.getAudioTracks().length) {
      this.teardownAecGraph();
      return raw;
    }
    if (ctx.sampleRate !== 48000 && ctx.sampleRate !== 16000) {
      this.aecError = `当前音频采样率 ${Math.round(ctx.sampleRate)}Hz 不受 AEC3 支持`;
      return raw;
    }
    if (!(await this.ensureAec3(ctx))) return raw;
    // 编译期间用户可能已经关掉了开关。
    if (!this.aecEnabled || !this.aecWasmModule) return raw;

    try {
      this.teardownAecGraph();
      const node = new AudioWorkletNode(ctx, 'wow-aec3', {
        numberOfInputs: 2,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1,
        channelCountMode: 'explicit',
        processorOptions: {
          module: this.aecWasmModule,
          sampleRate: ctx.sampleRate,
          enabled: true,
        },
      });
      const destination = ctx.createMediaStreamDestination();
      const reference = ctx.createGain();
      const micSource = ctx.createMediaStreamSource(raw);

      micSource.connect(node, 0, 0);
      reference.connect(node, 0, 1);
      node.connect(destination);
      // 已经连上的远端播放也要接进参考，否则它们不会被抵消。
      for (const monitor of this.monitors.values()) {
        if (monitor.gain) monitor.gain.connect(reference);
      }

      this.aecNode = node;
      this.aecReferenceGain = reference;
      this.aecDestination = destination;
      this.aecMicSource = micSource;
      return destination.stream;
    } catch (err) {
      this.aecError = err instanceof Error ? err.message : String(err);
      this.teardownAecGraph();
      return raw;
    }
  }

  private teardownAecGraph(): void {
    try {
      this.aecMicSource?.disconnect();
      this.aecReferenceGain?.disconnect();
      this.aecNode?.disconnect();
    } catch {
      // 节点已断开时忽略
    }
    if (this.aecDestination) {
      for (const track of this.aecDestination.stream.getTracks()) {
        track.stop();
      }
    }
    this.aecNode = null;
    this.aecReferenceGain = null;
    this.aecDestination = null;
    this.aecMicSource = null;
  }

  /** 运行时开关回声消除：重建发送链路并替换所有成员侧的音轨。 */
  private async applyEchoCanceller(): Promise<void> {
    const raw = this.captureStream;
    if (!raw) return;
    const previous = this.localStream;
    const next = await this.buildOutboundStream(raw);
    const nextTrack = next.getAudioTracks()[0];
    if (!nextTrack) return;
    const previousTrack = previous?.getAudioTracks()[0];
    if (previousTrack && previousTrack !== nextTrack) {
      try {
        await this.replaceAudioTrackAcrossPeers(previousTrack, nextTrack, next, this.joinAttemptId);
        previousTrack.stop();
      } catch {
        // 替换失败时保留旧链路，下次切换再试
        return;
      }
    }
    this.localStream = next;
    this.applyMicTrackEnabled();
    this.emit();
  }

  async setMicProcessing(patch: Partial<MicProcessingSettings>): Promise<void> {
    let changed = false;
    if (patch.noiseSuppression !== undefined && patch.noiseSuppression !== this.micNoiseSuppression) {
      this.micNoiseSuppression = patch.noiseSuppression;
      writeStoredBool(MIC_NOISE_SUPPRESSION_STORAGE_KEY, this.micNoiseSuppression);
      changed = true;
    }
    if (patch.echoCanceller !== undefined && patch.echoCanceller !== this.aecEnabled) {
      this.aecEnabled = patch.echoCanceller;
      writeStoredBool(ECHO_CANCELLER_STORAGE_KEY, this.aecEnabled);
      changed = true;
    }
    if (!changed) return;

    // 先把开关状态推给界面，再去做可能耗时的重新采集 / 链路重建。
    this.emit();

    if (patch.noiseSuppression !== undefined && this.captureStream && !this.listenOnly) {
      await this.applyMicNoiseSuppression();
    }
    if (patch.echoCanceller !== undefined && !this.listenOnly) {
      await this.applyEchoCanceller();
    }
    this.emit();
  }

  private async applyMicNoiseSuppression(): Promise<void> {
    const stream = this.captureStream;
    const track = stream?.getAudioTracks()[0];
    if (!stream || !track) return;
    const wantsOn = this.micNoiseSuppression;
    try {
      // applyConstraints 不接受 deviceId，这里只传音频处理相关约束。
      await track.applyConstraints(this.buildMicConstraints(undefined, wantsOn, false));
      this.rememberMicSettings(stream);
    } catch {
      // Fall through to re-acquisition below.
    }
    const applied = this.micAppliedSettings;
    const matched =
      applied !== null &&
      applied.echoCancellation === wantsOn &&
      applied.noiseSuppression === wantsOn;
    if (!matched) {
      // 设备忽略了 applyConstraints（部分 USB 麦克风），用新约束重新采集一次。
      await this.switchMicrophone(this.selectedDeviceId).catch(() => {});
    }
  }

  async join(options: VoiceJoinOptions): Promise<void> {
    const trimmedRoom = options.roomId.trim();
    const trimmedPassword = options.password;
    const trimmedNickname = options.nickname.trim() || '艾泽拉斯勇士';

    if (!trimmedRoom) {
      throw new Error('请输入房间号');
    }
    if (trimmedPassword.length < 8) {
      throw new Error('房间密码至少需要 8 个字符');
    }

    const attemptId = ++this.joinAttemptId;
    await this.resetInternalState();
    if (this.joinAttemptId !== attemptId) return;

    this.status = 'connecting';
    this.roomId = trimmedRoom;
    this.nickname = trimmedNickname;
    this.listenOnly = Boolean(options.listenOnly);
    this.selectedDeviceId = options.deviceId || '';
    this.selectedOutputDeviceId = options.outputDeviceId || '';
    this.isMuted = Boolean(options.listenOnly);
    this.isDeafened = false;
    this.warning = null;
    this.error = null;
    this.messages = [];
    this.emit();

    try {
      this.ensureAudioContext();
      const initialOutputDeviceId = this.selectedOutputDeviceId;
      void this.applyOutputDevice(initialOutputDeviceId).catch(() => {
        if (this.listenOnly && this.selectedOutputDeviceId === initialOutputDeviceId) {
          this.selectedOutputDeviceId = '';
          this.warning = '所选语音输出设备不可用，已回退到系统默认输出。';
          this.emit();
        }
      });

      if (!this.listenOnly) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('当前浏览器不支持麦克风采集，请使用 HTTPS 或现代浏览器，或选择“仅收听模式”加入。');
        }
        try {
          const acquiredStream = await this.acquireMicStream(options.deviceId);
          if (this.joinAttemptId !== attemptId) {
            for (const track of acquiredStream.getTracks()) {
              track.stop();
            }
            return;
          }
          this.captureStream = acquiredStream;
          const outbound = await this.buildOutboundStream(acquiredStream);
          if (this.joinAttemptId !== attemptId) {
            this.teardownAecGraph();
            for (const track of acquiredStream.getTracks()) {
              track.stop();
            }
            this.captureStream = null;
            return;
          }
          this.localStream = outbound;
          this.applyMicTrackEnabled();
          this.attachMonitor('self', outbound);
          void this.applyOutputDevice(this.selectedOutputDeviceId).catch(() => {});
        } catch (err) {
          if (this.joinAttemptId !== attemptId) return;
          const domErr = err as DOMException;
          if (domErr.name === 'NotAllowedError' || domErr.name === 'PermissionDeniedError') {
            throw new Error('麦克风权限被拒绝，请在浏览器地址栏允许麦克风权限或使用“仅收听模式”加入。');
          }
          if (domErr.name === 'NotFoundError' || domErr.name === 'DevicesNotFoundError') {
            throw new Error('未检测到可用麦克风设备，请插入麦克风或勾选“仅收听模式”加入。');
          }
          throw new Error(`无法获取麦克风：${domErr.message || '未知错误'}`);
        }
      }

      const [iceServers, authHash] = await Promise.all([
        this.resolveIceServers(),
        computeAuthHash(trimmedRoom, trimmedPassword),
      ]);
      if (this.joinAttemptId !== attemptId) return;

      this.activeIceServers = iceServers;
      const selfPeerId = createId();
      this.selfPeerId = selfPeerId;

      const wsUrl = `${SIGNAL_WS_URL}?room=${encodeURIComponent(trimmedRoom)}`;
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      const initialPeers = await new Promise<Array<{ peerId: string; meta: unknown }>>((resolve, reject) => {
        let settled = false;
        const timeoutId = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error('连接语音信令服务器超时，请检查网络后重试'));
        }, SIGNAL_CONNECT_TIMEOUT_MS);

        const cleanupInit = () => {
          window.clearTimeout(timeoutId);
        };

        ws.addEventListener('open', () => {
          if (this.joinAttemptId !== attemptId) {
            cleanupInit();
            ws.close();
            return;
          }
          ws.send(
            JSON.stringify({
              type: 'join',
              peerId: selfPeerId,
              authHash,
              meta: this.buildSelfMeta(),
            })
          );
        });

        ws.addEventListener('message', (event) => {
          if (typeof event.data !== 'string') return;
          let msg: ServerMessage;
          try {
            msg = JSON.parse(event.data) as ServerMessage;
          } catch {
            return;
          }
          if (!settled && msg.type === 'joined') {
            settled = true;
            cleanupInit();
            resolve(Array.isArray(msg.peers) ? msg.peers : []);
            return;
          }
          this.handleServerMessage(msg, attemptId);
        });

        ws.addEventListener('error', () => {
          if (!settled) {
            settled = true;
            cleanupInit();
            reject(new Error('无法连接语音信令服务器，请检查网络或稍后重试'));
          }
        });

        ws.addEventListener('close', () => {
          if (!settled) {
            settled = true;
            cleanupInit();
            reject(new Error('语音信令连接已关闭'));
          } else if (this.joinAttemptId === attemptId && this.status === 'connected') {
            void this.resetInternalState().then(() => {
              if (this.joinAttemptId === attemptId) {
                this.status = 'error';
                this.error = '语音信令连接已断开，请重新加入房间。';
                this.emit();
              }
            });
          }
        });
      });

      if (this.joinAttemptId !== attemptId) {
        ws.close();
        return;
      }

      this.pingTimer = window.setInterval(() => {
        this.sendWs({ type: 'ping' });
      }, SIGNAL_PING_INTERVAL_MS);

      for (const peer of initialPeers) {
        if (!peer.peerId || peer.peerId === selfPeerId) continue;
        this.connectedPeerIds.add(peer.peerId);
        this.applyPeerMeta(peer.peerId, peer.meta);
        const pc = this.createPeerConnection(peer.peerId, attemptId);
        if (selfPeerId < peer.peerId) {
          void this.initiateOffer(peer.peerId, pc, attemptId);
        }
      }

      this.status = 'connected';
      this.startLevelPolling();
      this.startStatsPolling();
      this.emit();
    } catch (err) {
      if (this.joinAttemptId !== attemptId) return;
      const message = err instanceof Error ? err.message : '加入语音房间失败';
      await this.resetInternalState();
      this.status = 'error';
      this.error = message;
      this.emit();
      throw err;
    }
  }

  private async resolveIceServers(): Promise<RTCIceServer[]> {
    if (this.cachedIceServers && Date.now() < this.cachedIceServers.expiresAt) {
      return this.cachedIceServers.iceServers;
    }

    const endpoint =
      typeof window !== 'undefined' &&
      (window.location.protocol === 'http:' || window.location.protocol === 'https:')
        ? TURN_CREDENTIALS_PATH
        : REMOTE_TURN_CREDENTIALS_URL;

    try {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(TURN_FETCH_TIMEOUT_MS),
      });
      if (!response.ok) return FALLBACK_ICE_SERVERS;

      const data = (await response.json()) as {
        iceServers?: unknown;
        turnConfigured?: boolean;
      };
      if (!Array.isArray(data.iceServers)) return FALLBACK_ICE_SERVERS;

      const validServers = data.iceServers.filter(isValidIceServer);
      if (validServers.length === 0) return FALLBACK_ICE_SERVERS;

      if (data.turnConfigured) {
        this.cachedIceServers = {
          iceServers: validServers,
          expiresAt: Date.now() + TURN_CACHE_TTL_MS,
        };
      }

      return validServers;
    } catch {
      return FALLBACK_ICE_SERVERS;
    }
  }

  private buildSelfMeta(): PeerMetaPayload {
    return {
      nickname: this.nickname,
      isMuted: this.listenOnly || this.isMuted,
      isDeafened: this.isDeafened,
      hasMic: !this.listenOnly && Boolean(this.localStream),
    };
  }

  toggleMute(): void {
    if (this.listenOnly || !this.localStream) return;
    this.isMuted = !this.isMuted;
    this.applyMicTrackEnabled();
    this.sendWs({ type: 'meta', meta: this.buildSelfMeta() });
    this.emit();
  }

  toggleDeafen(): void {
    this.isDeafened = !this.isDeafened;
    for (const [peerId, audio] of this.peerAudioElements.entries()) {
      const peerVol = this.peerVolumes.get(peerId) ?? 1;
      audio.volume = this.isDeafened ? 0 : peerVol;
    }
    for (const [peerId, monitor] of this.monitors.entries()) {
      if (monitor.gain) {
        monitor.gain.gain.value = this.isDeafened ? 0 : (this.peerVolumes.get(peerId) ?? 1);
      }
    }
    this.sendWs({ type: 'meta', meta: this.buildSelfMeta() });
    this.emit();
  }

  setPeerVolume(peerId: string, volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.peerVolumes.set(peerId, clamped);
    const audio = this.peerAudioElements.get(peerId);
    if (audio) {
      audio.volume = this.isDeafened ? 0 : clamped;
    }
    const monitor = this.monitors.get(peerId);
    if (monitor?.gain) {
      monitor.gain.gain.value = this.isDeafened ? 0 : clamped;
    }
    this.emit();
  }

  setOutputDevice(deviceId: string): Promise<boolean> {
    const attemptId = this.joinAttemptId;
    const run = () => this.performSetOutputDevice(deviceId, attemptId);
    const next = this.outputSwitchChain.then(run, run);
    this.outputSwitchChain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  private async performSetOutputDevice(deviceId: string, attemptId: number): Promise<boolean> {
    if (this.joinAttemptId !== attemptId) return false;
    const nextDeviceId = deviceId || '';
    const previousDeviceId = this.selectedOutputDeviceId;
    this.selectedOutputDeviceId = nextDeviceId;
    try {
      this.rebuildPlayback();
      await this.applyOutputDevice(nextDeviceId);
      if (this.joinAttemptId !== attemptId) return false;
    } catch (err) {
      if (this.joinAttemptId !== attemptId) return false;
      this.selectedOutputDeviceId = previousDeviceId;
      this.rebuildPlayback();
      await this.applyOutputDevice(previousDeviceId).catch(() => {});
      if (this.joinAttemptId !== attemptId) return false;
      this.emit();
      throw err instanceof Error ? err : new Error('切换语音输出设备失败');
    }
    this.emit();
    return true;
  }

  private async replaceAudioTrackAcrossPeers(
    oldTrack: MediaStreamTrack | undefined,
    newTrack: MediaStreamTrack,
    newStream: MediaStream,
    expectedAttemptId: number
  ): Promise<void> {
    const ops: Promise<void>[] = [];
    for (const [peerId, pc] of this.peerConnections.entries()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'audio' || (oldTrack && s.track === oldTrack));
      if (!sender) {
        pc.addTrack(newTrack, newStream);
        continue;
      }

      const op = new Promise<void>((resolve, reject) => {
        let finished = false;
        const cancel = () => {
          if (finished) return;
          finished = true;
          resolve();
        };

        let set = this.peerTrackCancelers.get(peerId);
        if (!set) {
          set = new Set();
          this.peerTrackCancelers.set(peerId, set);
        }
        set.add(cancel);

        sender.replaceTrack(newTrack).then(
          () => {
            set?.delete(cancel);
            if (!finished) {
              finished = true;
              resolve();
            }
          },
          (err) => {
            set?.delete(cancel);
            if (!finished) {
              finished = true;
              if (this.joinAttemptId !== expectedAttemptId || this.peerConnections.get(peerId) !== pc) {
                resolve();
              } else {
                reject(err);
              }
            }
          }
        );
      });
      ops.push(op);
    }
    await Promise.all(ops);
  }

  async switchMicrophone(deviceId: string): Promise<void> {
    const expectedAttemptId = this.joinAttemptId;

    const runSwitch = async () => {
      if (
        this.joinAttemptId !== expectedAttemptId ||
        this.status !== 'connected' ||
        this.listenOnly ||
        !this.ws ||
        !this.localStream
      ) {
        return;
      }

      const requestedNoiseSuppression = this.micNoiseSuppression;
      const newStream = await this.acquireMicStream(deviceId || undefined);

      if (this.joinAttemptId !== expectedAttemptId || !this.ws || !this.localStream) {
        for (const track of newStream.getTracks()) {
          track.stop();
        }
        return;
      }

      const newTrack = newStream.getAudioTracks()[0];
      if (!newTrack) {
        for (const track of newStream.getTracks()) {
          track.stop();
        }
        throw new Error('未获取到有效的麦克风音轨');
      }

      // 采集是异步的，期间用户可能刚改过降噪开关：按最新设置补一次约束，避免装上过期音轨。
      if (requestedNoiseSuppression !== this.micNoiseSuppression) {
        try {
          await newTrack.applyConstraints(this.buildMicConstraints(undefined, this.micNoiseSuppression, false));
          this.rememberMicSettings(newStream);
        } catch {
          // 个别设备不支持二次约束，保留本次采集结果，避免切麦失败。
        }
        // 等待期间用户可能已经退房/换房，这里必须重新校验，否则会装到新房间上。
        if (this.joinAttemptId !== expectedAttemptId || !this.ws || !this.localStream) {
          for (const track of newStream.getTracks()) {
            track.stop();
          }
          return;
        }
      }

      const oldCapture = this.captureStream;
      const oldTrack = this.localStream.getAudioTracks()[0];

      if (this.aecNode && this.aecMicSource && this.audioContext) {
        // AEC 已经在链路里：只替换麦克风输入，发送音轨不变，避免切换设备时断音。
        this.aecMicSource.disconnect();
        this.aecMicSource = this.audioContext.createMediaStreamSource(newStream);
        this.aecMicSource.connect(this.aecNode, 0, 0);
        this.captureStream = newStream;
        this.selectedDeviceId = deviceId;
        this.applyMicTrackEnabled();
        for (const track of oldCapture?.getTracks() ?? []) {
          if (track !== newTrack) track.stop();
        }
        this.emit();
        return;
      }

      // 没有 AEC（关闭或不可用）：沿用替换发送音轨的方式，并顺带重建处理链路。
      const nextLocal = await this.buildOutboundStream(newStream);
      const outboundTrack = nextLocal.getAudioTracks()[0];
      if (!outboundTrack) {
        for (const track of newStream.getTracks()) {
          track.stop();
        }
        throw new Error('未获取到有效的发送音轨');
      }
      this.pendingMicTrack = outboundTrack;
      this.pendingMicStream = nextLocal;
      outboundTrack.enabled = this.isMicSending();

      try {
        await this.replaceAudioTrackAcrossPeers(oldTrack, outboundTrack, nextLocal, expectedAttemptId);
      } catch (err) {
        if (oldTrack && this.joinAttemptId === expectedAttemptId) {
          this.pendingMicTrack = oldTrack;
          this.pendingMicStream = this.localStream;
          await this.replaceAudioTrackAcrossPeers(outboundTrack, oldTrack, this.localStream, expectedAttemptId).catch(() => {});
        }
        for (const track of newStream.getTracks()) {
          track.stop();
        }
        for (const track of nextLocal.getTracks()) {
          track.stop();
        }
        throw err;
      } finally {
        if (this.pendingMicTrack === outboundTrack) {
          this.pendingMicTrack = null;
          this.pendingMicStream = null;
        }
      }

      if (this.joinAttemptId !== expectedAttemptId || !this.ws) {
        for (const track of newStream.getTracks()) {
          track.stop();
        }
        return;
      }

      this.captureStream = newStream;
      this.localStream = nextLocal;
      this.applyMicTrackEnabled();
      this.selectedDeviceId = deviceId;
      this.attachMonitor('self', nextLocal);
      for (const track of oldCapture?.getTracks() ?? []) {
        if (track !== newTrack) track.stop();
      }
      this.emit();
    };

    const next = this.micSwitchChain.then(runSwitch, runSwitch);
    this.micSwitchChain = next.catch(() => {});
    return next;
  }

  async sendChatMessage(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || !this.ws || this.ws.readyState !== WebSocket.OPEN || this.status !== 'connected') return;
    const payload: ChatPayload = {
      id: createId(),
      nickname: this.nickname,
      text: trimmed,
      timestamp: Date.now(),
    };
    this.sendWs({ type: 'chat', message: payload });
    this.messages = [
      ...this.messages.slice(-99),
      {
        ...payload,
        peerId: this.selfPeerId || 'self',
        isSelf: true,
      },
    ];
    this.emit();
  }

  resumePlayback(): void {
    const attemptId = this.joinAttemptId;
    const resumeVersion = this.playbackBlockVersion;
    const fallbackPlaybacks = Array.from(this.peerAudioElements.values()).map((audio) => {
      if (!audio.paused) return Promise.resolve(true);
      return audio
        .play()
        .then(() => true)
        .catch(() => false);
    });
    const ctx = this.audioContext;
    const contextReady =
      ctx?.state === 'suspended'
        ? ctx
            .resume()
            .then(() => ctx.state === 'running')
            .catch(() => false)
        : Promise.resolve(true);

    void Promise.all([contextReady, ...fallbackPlaybacks]).then((results) => {
      if (this.joinAttemptId !== attemptId) return;
      const allFallbackPlaying = Array.from(this.peerAudioElements.values()).every((audio) => !audio.paused);
      if (results.every(Boolean) && this.playbackBlockVersion === resumeVersion && allFallbackPlaying) {
        this.autoplayBlocked = false;
        this.emit();
      } else if (!results.every(Boolean)) {
        this.markAutoplayBlocked();
      }
    });
  }

  async leave(): Promise<void> {
    this.joinAttemptId++;
    await this.resetInternalState();
  }

  private async resetInternalState(): Promise<void> {
    this.stopLevelPolling();
    this.stopStatsPolling();

    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    for (const key of Array.from(this.monitors.keys())) {
      this.detachMonitor(key);
    }

    // 先拆 AEC（它持有麦克风源节点），再停流。
    this.teardownAecGraph();
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }
    if (this.captureStream) {
      for (const track of this.captureStream.getTracks()) {
        track.stop();
      }
      this.captureStream = null;
    }
    this.micAppliedSettings = null;

    for (const cancelers of this.peerTrackCancelers.values()) {
      for (const cancel of cancelers) {
        cancel();
      }
    }
    this.peerTrackCancelers.clear();

    for (const pc of this.peerConnections.values()) {
      pc.close();
    }
    this.peerConnections.clear();
    this.pendingCandidates.clear();
    this.failedPeerIds.clear();
    this.restartedIcePeers.clear();

    for (const audio of this.peerAudioElements.values()) {
      audio.pause();
      audio.srcObject = null;
    }
    this.peerAudioElements.clear();
    this.peerStreams.clear();
    this.peerPlaybackModes.clear();
    this.peerMeta.clear();
    this.peerVolumes.clear();
    this.peerNetworkStats.clear();
    this.prevRtpCounts.clear();
    this.prevByteCounts.clear();
    this.connectedPeerIds.clear();

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore close errors
      }
      this.ws = null;
    }

    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch {
        // Ignore close errors
      }
      this.audioContext = null;
    }

    this.status = 'idle';
    this.roomId = '';
    this.selfPeerId = '';
    this.selectedDeviceId = '';
    this.selectedOutputDeviceId = '';
    this.pendingMicTrack = null;
    this.pendingMicStream = null;
    this.warning = null;
    this.autoplayBlocked = false;
    this.playbackBlockVersion++;
    this.error = null;
    this.messages = [];
    this.emit();
  }
}

export const voiceRoomManager = new VoiceRoomManager();
