/**
 * 「无限百科」Worker 的主线程客户端封装。
 * 负责懒加载 Worker、请求排队（同一次渲染只保留最新请求）与错误透传。
 */
import type { WikiCharacter, WikiMeta, WikiWorkerRequest, WikiWorkerResponse, WowSnapshot } from './types';

type Pending = {
  resolve: (value: { snapshot: WowSnapshot; renderMs: number }) => void;
  reject: (reason: Error) => void;
};

/** 首次载入插件 Lua 的兜底超时（含下载三份 Lua 与编译） */
const INIT_TIMEOUT_MS = 45_000;
/** 单次渲染的兜底超时，避免 Worker 卡死时页面永远停在“渲染中” */
const RENDER_TIMEOUT_MS = 30_000;

export class WikiClient {
  private worker: Worker | null = null;
  private ready: Promise<{ meta: WikiMeta; loadMs: number }> | null = null;
  private pending = new Map<number, Pending>();
  private seq = 0;
  private latestRequestId = 0;

  /** 启动 Worker 并加载插件资源（仅首次真正下载，后续复用） */
  load(baseUrl: string): Promise<{ meta: WikiMeta; loadMs: number }> {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      let worker: Worker;
      try {
        worker = new Worker(new URL('./wiki.worker.ts', import.meta.url), { type: 'module' });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      this.worker = worker;

      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        fn();
      };

      const timer = window.setTimeout(() => {
        finish(() => reject(new Error(`百科载入超时（超过 ${INIT_TIMEOUT_MS / 1000} 秒），请刷新重试`)));
        this.failWorker();
      }, INIT_TIMEOUT_MS);

      worker.onmessage = (event: MessageEvent<WikiWorkerResponse>) => {
        const msg = event.data;
        if (msg.type === 'ready') {
          finish(() => resolve({ meta: msg.meta, loadMs: msg.loadMs }));
        } else if (msg.type === 'snapshot') {
          const entry = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          entry?.resolve({ snapshot: msg.snapshot, renderMs: msg.renderMs });
        } else if (msg.type === 'error') {
          if (msg.id != null) {
            const entry = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            entry?.reject(new Error(msg.message));
          } else {
            finish(() => reject(new Error(msg.message)));
          }
        }
      };
      worker.onerror = (event: ErrorEvent) => {
        const error = new Error(event.message || '百科渲染线程崩溃');
        finish(() => reject(error));
        // 已就绪之后 Worker 崩溃：终止在途渲染，避免页面白等 30 秒
        this.failWorker(error);
      };
      worker.postMessage({ type: 'init', baseUrl } satisfies WikiWorkerRequest);
    });
    return this.ready;
  }

  /**
   * 渲染指定角色 + 页签。
   * 快速连续切换时，调用方可根据返回的 requestId 判断是否为最新一次。
   */
  async render(
    character: WikiCharacter,
    slash: string
  ): Promise<{ snapshot: WowSnapshot; renderMs: number; requestId: number }> {
    if (!this.worker) throw new Error('百科渲染线程尚未就绪');
    const worker = this.worker;
    const id = ++this.seq;
    this.latestRequestId = id;
    const promise = new Promise<{ snapshot: WowSnapshot; renderMs: number }>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ type: 'render', id, character, slash } satisfies WikiWorkerRequest);
      window.setTimeout(() => {
        const entry = this.pending.get(id);
        if (entry) {
          this.pending.delete(id);
          entry.reject(new Error('百科渲染超时，请刷新重试'));
        }
      }, RENDER_TIMEOUT_MS);
    });
    const { snapshot, renderMs } = await promise;
    return { snapshot, renderMs, requestId: id };
  }

  isLatest(requestId: number): boolean {
    return requestId === this.latestRequestId;
  }

  /** Worker 已不可用：终止它并拒绝所有在途渲染 */
  private failWorker(reason?: Error): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    for (const entry of this.pending.values()) {
      entry.reject(reason ?? new Error('百科渲染线程已崩溃'));
    }
    this.pending.clear();
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    for (const entry of this.pending.values()) {
      entry.reject(new Error('百科渲染线程已关闭'));
    }
    this.pending.clear();
  }
}
