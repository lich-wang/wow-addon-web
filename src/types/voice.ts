export type VoiceConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export type NetworkQualityLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'connecting';
export type TransportMode = 'p2p' | 'relay' | 'unknown';

export interface PeerNetworkStats {
  quality: NetworkQualityLevel;
  rttMs: number | null;
  packetLossPct: number | null;
  transport: TransportMode;
}

export interface VoiceParticipant {
  peerId: string;
  nickname: string;
  isSelf: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  audioLevel: number; // 0 to 1
  hasAudioStream: boolean;
  volume: number; // 0 to 1, local playback volume for remote peers
  network?: PeerNetworkStats;
}

export interface VoiceChatMessage {
  id: string;
  peerId: string;
  nickname: string;
  text: string;
  timestamp: number;
  isSelf: boolean;
}

export interface VoiceJoinOptions {
  roomId: string;
  password: string;
  nickname: string;
  deviceId?: string;
  listenOnly?: boolean;
}
