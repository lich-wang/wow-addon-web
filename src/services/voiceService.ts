import type { VoiceChatMessage, VoiceConnectionStatus, VoiceJoinOptions, VoiceParticipant } from '../types/voice';

const SIGNAL_WS_URL = 'wss://wow-voice-signal.lich-wang8718.workers.dev/ws';
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

const NAT_WARNING_TEXT = '与部分成员的语音直连失败，可能受网络（NAT）限制，请更换网络或稍后重试。';
const AUTH_MISMATCH_WARNING_TEXT = '检测到同房间存在密码不匹配的成员，对方无法与您建立语音连接，请核对房间密码。';

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

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
}

export interface VoiceStateSnapshot {
  status: VoiceConnectionStatus;
  roomId: string;
  selfPeerId: string;
  participants: VoiceParticipant[];
  messages: VoiceChatMessage[];
  warning: string | null;
  error: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  listenOnly: boolean;
  selectedDeviceId: string;
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
  private peerMeta = new Map<string, PeerMetaPayload>();
  private peerVolumes = new Map<string, number>();
  private peerLevels = new Map<string, { level: number; speaking: boolean }>();
  private levelTimer: number | null = null;

  private status: VoiceConnectionStatus = 'idle';
  private roomId = '';
  private selfPeerId = '';
  private nickname = '';
  private isMuted = false;
  private isDeafened = false;
  private listenOnly = false;
  private selectedDeviceId = '';
  private warning: string | null = null;
  private error: string | null = null;
  private messages: VoiceChatMessage[] = [];
  private connectedPeerIds = new Set<string>();
  private listeners = new Set<StateListener>();
  private joinAttemptId = 0;
  private pendingMicTrack: MediaStreamTrack | null = null;
  private pendingMicStream: MediaStream | null = null;
  private peerTrackCancelers = new Map<string, Set<() => void>>();
  private micSwitchChain: Promise<void> = Promise.resolve();
  private cachedIceServers: { iceServers: RTCIceServer[]; expiresAt: number } | null = null;

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
      error: this.error,
      isMuted: this.isMuted,
      isDeafened: this.isDeafened,
      listenOnly: this.listenOnly,
      selectedDeviceId: this.selectedDeviceId,
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
      this.audioContext = new AudioCtx();
    }
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
    return this.audioContext;
  }

  private attachMonitor(key: string, stream: MediaStream): void {
    this.detachMonitor(key);
    const ctx = this.ensureAudioContext();
    if (!ctx || stream.getAudioTracks().length === 0) return;

    try {
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.45;
      source.connect(analyser);
      const dataArray = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      this.monitors.set(key, { source, analyser, dataArray });
    } catch {
      // Ignore analyser errors for streams without playable audio
    }
  }

  private detachMonitor(key: string): void {
    const existing = this.monitors.get(key);
    if (existing) {
      try {
        existing.source.disconnect();
        existing.analyser.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.monitors.delete(key);
    }
    this.peerLevels.delete(key);
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
      let audio = this.peerAudioElements.get(remotePeerId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        this.peerAudioElements.set(remotePeerId, audio);
      }
      audio.srcObject = stream;
      const peerVol = this.peerVolumes.get(remotePeerId) ?? 1;
      audio.volume = this.isDeafened ? 0 : peerVol;
      void audio.play().catch(() => {
        this.warning = '浏览器阻止了自动播放，请点击“恢复播放”按钮以收听语音。';
        this.emit();
      });
      this.attachMonitor(remotePeerId, stream);
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
    this.pendingCandidates.delete(peerId);
    this.failedPeerIds.delete(peerId);
    this.restartedIcePeers.delete(peerId);
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

    const audio = this.peerAudioElements.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      this.peerAudioElements.delete(peerId);
    }

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
    this.isMuted = Boolean(options.listenOnly);
    this.isDeafened = false;
    this.warning = null;
    this.error = null;
    this.messages = [];
    this.emit();

    try {
      this.ensureAudioContext();

      if (!this.listenOnly) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('当前浏览器不支持麦克风采集，请使用 HTTPS 或现代浏览器，或选择“仅收听模式”加入。');
        }
        try {
          const acquiredStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: options.deviceId ? { exact: options.deviceId } : undefined,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });
          if (this.joinAttemptId !== attemptId) {
            for (const track of acquiredStream.getTracks()) {
              track.stop();
            }
            return;
          }
          this.localStream = acquiredStream;
          this.attachMonitor('self', this.localStream);
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
            this.warning = '信令连接已断开，新成员可能无法加入，建议重新进入房间。';
            this.emit();
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
    for (const track of this.localStream.getAudioTracks()) {
      track.enabled = !this.isMuted;
    }
    if (this.pendingMicTrack) {
      this.pendingMicTrack.enabled = !this.isMuted;
    }
    this.sendWs({ type: 'meta', meta: this.buildSelfMeta() });
    this.emit();
  }

  toggleDeafen(): void {
    this.isDeafened = !this.isDeafened;
    for (const [peerId, audio] of this.peerAudioElements.entries()) {
      const peerVol = this.peerVolumes.get(peerId) ?? 1;
      audio.volume = this.isDeafened ? 0 : peerVol;
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
    this.emit();
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

      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

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

      const oldTrack = this.localStream.getAudioTracks()[0];
      this.pendingMicTrack = newTrack;
      this.pendingMicStream = newStream;
      newTrack.enabled = !this.isMuted;

      try {
        await this.replaceAudioTrackAcrossPeers(oldTrack, newTrack, newStream, expectedAttemptId);
      } catch (err) {
        if (oldTrack && this.joinAttemptId === expectedAttemptId) {
          this.pendingMicTrack = oldTrack;
          this.pendingMicStream = this.localStream;
          await this.replaceAudioTrackAcrossPeers(newTrack, oldTrack, this.localStream, expectedAttemptId).catch(() => {});
        }
        for (const track of newStream.getTracks()) {
          track.stop();
        }
        throw err;
      } finally {
        if (this.pendingMicTrack === newTrack) {
          this.pendingMicTrack = null;
    this.pendingMicStream = null;
          this.pendingMicStream = null;
        }
      }

      if (this.joinAttemptId !== expectedAttemptId || !this.ws) {
        for (const track of newStream.getTracks()) {
          track.stop();
        }
        return;
      }

      newTrack.enabled = !this.isMuted;
      if (oldTrack) {
        oldTrack.stop();
      }
      this.localStream = newStream;
      this.selectedDeviceId = deviceId;
      this.attachMonitor('self', newStream);
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
    for (const audio of this.peerAudioElements.values()) {
      if (audio.paused) {
        void audio.play().catch(() => {});
      }
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }
    if (this.warning?.includes('自动播放')) {
      this.warning = null;
      this.emit();
    }
  }

  async leave(): Promise<void> {
    this.joinAttemptId++;
    await this.resetInternalState();
  }

  private async resetInternalState(): Promise<void> {
    this.stopLevelPolling();

    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    for (const key of Array.from(this.monitors.keys())) {
      this.detachMonitor(key);
    }

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }

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
    this.peerMeta.clear();
    this.peerVolumes.clear();
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
    this.pendingMicTrack = null;
    this.pendingMicStream = null;
    this.warning = null;
    this.error = null;
    this.messages = [];
    this.emit();
  }
}

export const voiceRoomManager = new VoiceRoomManager();
