/*
 * 回声消除 AudioWorklet：WebRTC AEC3（@ai-ecoverse/wasm-webrtc-audio-processing）。
 *
 * 输入 0：麦克风采集；输入 1：电脑正在播放的声音（Web Audio 播放的远端语音混音）。
 * 输出：减掉回声后的麦克风信号。AEC3 内部按 10ms 帧处理、自带延迟估计，
 * 输出会比输入晚 latencySamples 个采样点（48kHz 下约 19~25ms）。
 */
import type { EchoCanceller, WebRtcAudioProcessing } from '@ai-ecoverse/wasm-webrtc-audio-processing';
import { instantiate } from '@ai-ecoverse/wasm-webrtc-audio-processing';

declare function registerProcessor(name: string, processorCtor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: unknown);
}

interface Aec3ProcessorOptions {
  module?: WebAssembly.Module;
  sampleRate?: number;
  enabled?: boolean;
}

const RENDER_QUANTUM = 128;
const SILENCE = new Float32Array(RENDER_QUANTUM);

class Aec3Processor extends AudioWorkletProcessor {
  private instance: WebRtcAudioProcessing | null = null;
  private aec: EchoCanceller | null = null;
  private enabled = true;
  private disposed = false;
  private error: string | null = null;
  private readonly rate: 16000 | 48000;

  constructor(options?: { processorOptions?: Aec3ProcessorOptions }) {
    super(options);
    const opts = options?.processorOptions ?? {};
    this.rate = opts.sampleRate === 16000 ? 16000 : 48000;
    this.enabled = opts.enabled !== false;

    try {
      if (!opts.module) throw new Error('缺少 AEC3 wasm 模块');
      this.instance = instantiate(opts.module);
      this.createCanceller();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    }

    this.port.onmessage = (event: MessageEvent) => {
      const data = (event.data ?? {}) as { type?: string; value?: boolean };
      if (data.type === 'dispose') {
        this.disposed = true;
        this.destroyCanceller();
        this.instance = null;
      } else if (data.type === 'enabled') {
        const next = Boolean(data.value);
        if (next === this.enabled) return;
        this.enabled = next;
        if (next) {
          this.createCanceller();
        } else {
          this.destroyCanceller();
        }
      } else if (data.type === 'stats') {
        this.port.postMessage({
          type: 'stats',
          enabled: this.enabled,
          error: this.error,
          rate: this.rate,
          latencySamples: this.aec?.latencySamples ?? 0,
          stats: this.aec?.stats() ?? null,
        });
      }
    };

    this.port.postMessage({
      type: 'ready',
      error: this.error,
      latencySamples: this.aec?.latencySamples ?? 0,
    });
  }

  private createCanceller(): void {
    if (!this.instance) return;
    this.destroyCanceller();
    this.aec = this.instance.create({ sampleRate: this.rate, noiseSuppression: false, vad: false });
  }

  private destroyCanceller(): void {
    if (!this.aec) return;
    try {
      this.aec.destroy();
    } catch {
      // 忽略销毁时的 wasm 异常
    }
    this.aec = null;
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    if (this.disposed) return false;
    const output = outputs[0]?.[0];
    if (!output) return true;
    const mic = inputs[0]?.[0];

    if (!mic) {
      output.fill(0);
      return true;
    }
    if (!this.aec || !this.enabled) {
      output.set(mic);
      return true;
    }

    try {
      const reference = inputs[1]?.[0] ?? SILENCE;
      this.aec.cancel(mic, reference, output);
    } catch {
      // AEC 出错时宁可原样放行，也不要静音整条链路。
      output.set(mic);
    }
    return true;
  }
}

registerProcessor('wow-aec3', Aec3Processor);
