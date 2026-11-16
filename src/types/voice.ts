export type VoiceConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

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
