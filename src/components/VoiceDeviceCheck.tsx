import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Mic, Square, Volume2 } from 'lucide-react';

interface VoiceDeviceCheckProps {
  micDeviceId?: string;
  outputDeviceId?: string;
  inRoom?: boolean;
  selfAudioLevel?: number;
}

function describeMicError(err: unknown): string {
  const domErr = err as DOMException;
  if (domErr?.name === 'NotAllowedError' || domErr?.name === 'PermissionDeniedError') {
    return '麦克风权限被拒绝，请在浏览器地址栏允许麦克风权限后重试。';
  }
  if (domErr?.name === 'NotFoundError' || domErr?.name === 'DevicesNotFoundError') {
    return '未检测到可用麦克风设备。';
  }
  return err instanceof Error ? `麦克风测试失败：${err.message}` : '麦克风测试失败。';
}

export const VoiceDeviceCheck: React.FC<VoiceDeviceCheckProps> = ({
  micDeviceId,
  outputDeviceId,
  inRoom = false,
  selfAudioLevel = 0,
}) => {
  const [micStarting, setMicStarting] = useState(false);
  const [micTesting, setMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [speakerTesting, setSpeakerTesting] = useState(false);
  const [speakerStatus, setSpeakerStatus] = useState<string | null>(null);

  const micStreamRef = useRef<MediaStream | null>(null);
  const micContextRef = useRef<AudioContext | null>(null);
  const micFrameRef = useRef<number | null>(null);
  const micTokenRef = useRef(0);
  const speakerTokenRef = useRef(0);
  const speakerCleanupRef = useRef<(() => void) | null>(null);

  const stopMicTest = useCallback(() => {
    micTokenRef.current++;
    if (micFrameRef.current !== null) {
      cancelAnimationFrame(micFrameRef.current);
      micFrameRef.current = null;
    }
    if (micStreamRef.current) {
      for (const track of micStreamRef.current.getTracks()) {
        track.stop();
      }
      micStreamRef.current = null;
    }
    if (micContextRef.current) {
      void micContextRef.current.close().catch(() => {});
      micContextRef.current = null;
    }
    setMicStarting(false);
    setMicTesting(false);
    setMicLevel(0);
  }, []);

  const startMicTest = async () => {
    if (micTesting || micStarting) {
      stopMicTest();
      return;
    }

    const token = ++micTokenRef.current;
    setMicStarting(true);
    setMicError(null);
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('当前浏览器不支持麦克风采集');
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: micDeviceId ? { deviceId: { exact: micDeviceId } } : true,
        video: false,
      });
      if (micTokenRef.current !== token) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }

      micStreamRef.current = stream;
      context = new AudioContext();
      if (micTokenRef.current !== token) {
        for (const track of stream.getTracks()) track.stop();
        void context.close().catch(() => {});
        if (micStreamRef.current === stream) micStreamRef.current = null;
        return;
      }

      micContextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      setMicTesting(true);

      const tick = () => {
        if (micTokenRef.current !== token) return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const value = (data[i] - 128) / 128;
          sum += value * value;
        }
        const rms = Math.sqrt(sum / data.length);
        setMicLevel(Math.min(1, rms * 4));
        micFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
        if (micStreamRef.current === stream) micStreamRef.current = null;
      }
      if (context) {
        void context.close().catch(() => {});
        if (micContextRef.current === context) micContextRef.current = null;
      }
      if (micTokenRef.current === token) {
        setMicError(describeMicError(err));
      }
    } finally {
      if (micTokenRef.current === token) {
        setMicStarting(false);
      }
    }
  };

  const testSpeaker = async () => {
    if (speakerTesting) {
      speakerTokenRef.current++;
      speakerCleanupRef.current?.();
      speakerCleanupRef.current = null;
      setSpeakerTesting(false);
      setSpeakerStatus(null);
      return;
    }

    const token = ++speakerTokenRef.current;
    setSpeakerTesting(true);
    setSpeakerStatus('正在播放测试音...');

    let context: AudioContext | null = null;
    let audio: HTMLAudioElement | null = null;
    let oscillator: OscillatorNode | null = null;
    let gain: GainNode | null = null;
    let cleaned = false;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      try {
        oscillator?.stop();
      } catch {
        // Already stopped
      }
      try {
        gain?.disconnect();
      } catch {
        // Already disconnected
      }
      if (audio) {
        audio.pause();
        audio.srcObject = null;
      }
      if (context) {
        void context.close().catch(() => {});
      }
    };
    speakerCleanupRef.current = cleanup;

    try {
      context = new AudioContext();
      if (speakerTokenRef.current !== token) {
        cleanup();
        return;
      }

      const sinkableContext = context as AudioContext & { setSinkId?: (sinkId: string) => Promise<void> };
      if (outputDeviceId && sinkableContext.setSinkId) {
        await sinkableContext.setSinkId(outputDeviceId);
      }
      if (speakerTokenRef.current !== token) {
        cleanup();
        return;
      }

      oscillator = context.createOscillator();
      gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 440;
      gain.gain.value = 0.18;
      oscillator.connect(gain);

      if (sinkableContext.setSinkId) {
        gain.connect(context.destination);
      } else {
        const destination = context.createMediaStreamDestination();
        gain.connect(destination);
        audio = new Audio();
        audio.srcObject = destination.stream;
        const sinkableAudio = audio as HTMLAudioElement & { setSinkId?: (sinkId: string) => Promise<void> };
        if (outputDeviceId && sinkableAudio.setSinkId) {
          await sinkableAudio.setSinkId(outputDeviceId);
        }
        if (speakerTokenRef.current !== token) {
          cleanup();
          return;
        }
        await audio.play();
        if (speakerTokenRef.current !== token) {
          cleanup();
          return;
        }
      }

      oscillator.start();
      oscillator.stop(context.currentTime + 1.2);

      window.setTimeout(() => {
        if (speakerTokenRef.current !== token) return;
        cleanup();
        if (speakerCleanupRef.current === cleanup) {
          speakerCleanupRef.current = null;
        }
        setSpeakerTesting(false);
        setSpeakerStatus('测试音播放完成');
      }, 1400);
    } catch (err) {
      cleanup();
      if (speakerCleanupRef.current === cleanup) {
        speakerCleanupRef.current = null;
      }
      if (speakerTokenRef.current === token) {
        setSpeakerTesting(false);
        setSpeakerStatus(err instanceof Error ? `扬声器测试失败：${err.message}` : '扬声器测试失败');
      }
    }
  };

  useEffect(
    () => () => {
      stopMicTest();
    },
    [micDeviceId, stopMicTest]
  );

  useEffect(
    () => () => {
      speakerTokenRef.current++;
      speakerCleanupRef.current?.();
      speakerCleanupRef.current = null;
      setSpeakerTesting(false);
      setSpeakerStatus(null);
    },
    [outputDeviceId]
  );

  const level = inRoom ? Math.min(1, selfAudioLevel) : micLevel;
  const levelPercent = Math.round(level * 100);

  return (
    <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-200">设备自检</p>
          <p className="text-[11px] text-slate-500 mt-0.5">先确认麦克风和扬声器是否正常，再加入房间。</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-300 flex items-center space-x-1.5">
            <Mic className="w-3.5 h-3.5 text-amber-400" />
            <span>麦克风</span>
          </span>
          {inRoom ? (
            <span className="text-[11px] text-emerald-400">房间内实时电平</span>
          ) : (
            <button
              type="button"
              onClick={() => void startMicTest()}
              disabled={micStarting}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 disabled:opacity-50 cursor-pointer flex items-center space-x-1"
            >
              {micStarting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : micTesting ? (
                <Square className="w-3 h-3" />
              ) : (
                <Mic className="w-3 h-3" />
              )}
              <span>{micTesting ? '停止测试' : '测试麦克风'}</span>
            </button>
          )}
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-[width] duration-100"
            style={{ width: `${levelPercent}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-500">
          {micError
            ? micError
            : inRoom
              ? levelPercent > 2
                ? '检测到麦克风声音'
                : '等待麦克风声音...'
              : micTesting
                ? levelPercent > 2
                  ? '检测到麦克风声音'
                  : '请对着麦克风说话...'
                : '点击“测试麦克风”并说话，观察电平条。'}
        </p>
      </div>

      <div className="space-y-2 pt-3 border-t border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-300 flex items-center space-x-1.5">
            <Volume2 className="w-3.5 h-3.5 text-sky-400" />
            <span>扬声器 / 耳机</span>
          </span>
          <button
            type="button"
            onClick={() => void testSpeaker()}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 cursor-pointer flex items-center space-x-1"
          >
            {speakerTesting ? <Square className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
            <span>{speakerTesting ? '停止测试' : '播放测试音'}</span>
          </button>
        </div>
        <p className="text-[11px] text-slate-500 flex items-center space-x-1">
          {speakerStatus?.startsWith('扬声器测试失败') && <AlertTriangle className="w-3 h-3 text-rose-400" />}
          <span>{speakerStatus ?? '点击“播放测试音”，应能听到约 1 秒的提示音。'}</span>
        </p>
      </div>
    </div>
  );
};
