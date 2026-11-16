import { joinRoom, type Room } from '@trystero-p2p/mqtt';
import type { VoiceChatMessage, VoiceConnectionStatus, VoiceJoinOptions, VoiceParticipant } from '../types/voice';

const VOICE_APP_ID = 'wow-addon-web-voice-v1';

const MQTT_RELAY_URLS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081/mqtt',
];

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

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
}

type StateListener = (snapshot: VoiceStateSnapshot) => void;

export class VoiceRoomManager {
  private room: Room | null = null;
  private localStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private monitors = new Map<string, AudioMonitor>();
  private peerAudioElements = new Map<string, HTMLAudioElement>();
  private peerStreams = new Map<string, MediaStream>();
  private peerMeta = new Map<string, PeerMetaPayload>();
  private peerVolumes = new Map<string, number>();
  private peerLevels = new Map<string, { level: number; speaking: boolean }>();
  private levelTimer: number | null = null;

  private sendMeta: ((data: PeerMetaPayload, options?: { target?: string }) => Promise<void>) | null = null;
  private sendChat: ((data: ChatPayload) => Promise<void>) | null = null;

  private status: VoiceConnectionStatus = 'idle';
  private roomId = '';
  private selfPeerId = '';
  private nickname = '';
  private isMuted = false;
  private isDeafened = false;
  private listenOnly = false;
  private warning: string | null = null;
  private error: string | null = null;
  private messages: VoiceChatMessage[] = [];
  private connectedPeerIds = new Set<string>();
  private listeners = new Set<StateListener>();

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

  async join(options: VoiceJoinOptions): Promise<void> {
    const trimmedRoom = options.roomId.trim();
    const trimmedPassword = options.password;
    const trimmedNickname = options.nickname.trim() || '艾泽拉斯勇士';

    if (!trimmedRoom) {
      throw new Error('请输入房间号');
    }
    if (!trimmedPassword) {
      throw new Error('请输入房间密码');
    }

    await this.leave();

    this.status = 'connecting';
    this.roomId = trimmedRoom;
    this.nickname = trimmedNickname;
    this.listenOnly = Boolean(options.listenOnly);
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
          this.localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: options.deviceId ? { exact: options.deviceId } : undefined,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });
          this.attachMonitor('self', this.localStream);
        } catch (err) {
          const domErr = err as DOMException;
          if (domErr.name === 'NotAllowedError' || domErr.name === 'PermissionDeniedError') {
            throw new Error('麦克风权限被拒绝。请在浏览器地址栏允许麦克风权限，或勾选“仅收听模式”加入。');
          }
          if (domErr.name === 'NotFoundError' || domErr.name === 'DevicesNotFoundError') {
            throw new Error('未检测到可用麦克风设备，请插入麦克风或勾选“仅收听模式”加入。');
          }
          throw new Error(`无法获取麦克风：${domErr.message || '未知错误'}`);
        }
      }

      const room = joinRoom(
        {
          appId: VOICE_APP_ID,
          password: trimmedPassword,
          relayConfig: {
            urls: MQTT_RELAY_URLS,
          },
          rtcConfig: {
            iceServers: ICE_SERVERS,
          },
        },
        trimmedRoom
      );

      this.room = room;
      const selfInfo = await room.getSelf();
      this.selfPeerId = selfInfo.peerId;

      const metaAction = room.makeAction<PeerMetaPayload>('meta');
      const chatAction = room.makeAction<ChatPayload>('chat');

      this.sendMeta = (data, opts) => metaAction.send(data, opts);
      this.sendChat = (data) => chatAction.send(data);

      metaAction.onMessage((data, { peerId }) => {
        this.peerMeta.set(peerId, data);
        this.emit();
      });

      chatAction.onMessage((data, { peerId }) => {
        this.messages = [
          ...this.messages.slice(-99),
          {
            id: data.id,
            peerId,
            nickname: data.nickname,
            text: data.text,
            timestamp: data.timestamp,
            isSelf: false,
          },
        ];
        this.emit();
      });

      room.onPeerJoin(({ peerId }) => {
        this.connectedPeerIds.add(peerId);
        void metaAction.send(this.buildSelfMeta(), { target: peerId });
        if (this.localStream) {
          void room.addStream(this.localStream, { target: peerId });
        }
        this.emit();
      });

      room.onPeerLeave(({ peerId }) => {
        this.connectedPeerIds.delete(peerId);
        this.peerMeta.delete(peerId);
        this.peerStreams.delete(peerId);
        this.detachMonitor(peerId);
        const audio = this.peerAudioElements.get(peerId);
        if (audio) {
          audio.pause();
          audio.srcObject = null;
          this.peerAudioElements.delete(peerId);
        }
        this.emit();
      });

      room.onPeerStream((stream, { peerId }) => {
        this.peerStreams.set(peerId, stream);
        let audio = this.peerAudioElements.get(peerId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          this.peerAudioElements.set(peerId, audio);
        }
        audio.srcObject = stream;
        const peerVol = this.peerVolumes.get(peerId) ?? 1;
        audio.volume = this.isDeafened ? 0 : peerVol;
        void audio.play().catch(() => {
          this.warning = '浏览器阻止了自动播放，请点击页面任意位置恢复语音播放。';
          this.emit();
        });
        this.attachMonitor(peerId, stream);
        this.emit();
      });

      room.onError((roomErr) => {
        if (roomErr.code === 'decrypt-failed') {
          this.warning = '检测到同房间存在密码不匹配的成员，对方无法与您建立语音连接，请核对房间密码。';
          this.emit();
        } else if (roomErr.code === 'relay-failed') {
          this.warning = '部分信令节点连接失败，可能影响新成员加入，建议检查网络或稍后重试。';
          this.emit();
        }
      });

      await room.ready;

      if (this.localStream) {
        await room.addStream(this.localStream);
      }

      this.status = 'connected';
      this.startLevelPolling();
      this.emit();
    } catch (err) {
      const message = err instanceof Error ? err.message : '加入语音房间失败';
      await this.leave();
      this.status = 'error';
      this.error = message;
      this.emit();
      throw err;
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
    if (this.sendMeta) {
      void this.sendMeta(this.buildSelfMeta());
    }
    this.emit();
  }

  toggleDeafen(): void {
    this.isDeafened = !this.isDeafened;
    for (const [peerId, audio] of this.peerAudioElements.entries()) {
      const peerVol = this.peerVolumes.get(peerId) ?? 1;
      audio.volume = this.isDeafened ? 0 : peerVol;
    }
    if (this.sendMeta) {
      void this.sendMeta(this.buildSelfMeta());
    }
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

  async switchMicrophone(deviceId: string): Promise<void> {
    if (this.listenOnly || !this.room || !this.localStream) return;
    const oldTrack = this.localStream.getAudioTracks()[0];
    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    const newTrack = newStream.getAudioTracks()[0];
    if (!newTrack) return;

    newTrack.enabled = !this.isMuted;
    if (oldTrack) {
      await this.room.replaceTrack(oldTrack, newTrack);
      oldTrack.stop();
    }
    this.localStream = newStream;
    this.attachMonitor('self', newStream);
    this.emit();
  }

  async sendChatMessage(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || !this.sendChat || this.status !== 'connected') return;
    const payload: ChatPayload = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      nickname: this.nickname,
      text: trimmed,
      timestamp: Date.now(),
    };
    this.messages = [
      ...this.messages.slice(-99),
      {
        ...payload,
        peerId: this.selfPeerId || 'self',
        isSelf: true,
      },
    ];
    this.emit();
    await this.sendChat(payload);
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
    this.stopLevelPolling();

    for (const key of Array.from(this.monitors.keys())) {
      this.detachMonitor(key);
    }

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }

    for (const audio of this.peerAudioElements.values()) {
      audio.pause();
      audio.srcObject = null;
    }
    this.peerAudioElements.clear();
    this.peerStreams.clear();
    this.peerMeta.clear();
    this.peerVolumes.clear();
    this.connectedPeerIds.clear();

    if (this.room) {
      try {
        await this.room.leave();
      } catch {
        // Ignore leave errors
      }
      this.room = null;
    }

    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch {
        // Ignore close errors
      }
      this.audioContext = null;
    }

    this.sendMeta = null;
    this.sendChat = null;
    this.status = 'idle';
    this.roomId = '';
    this.selfPeerId = '';
    this.warning = null;
    this.error = null;
    this.messages = [];
    this.emit();
  }
}

export const voiceRoomManager = new VoiceRoomManager();
