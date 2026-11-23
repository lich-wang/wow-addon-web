import type { WowSnapshot } from '../../../scripts/wow-ui-simulator/runtime-core';

/** Worker 加载完成后回报的元数据（供页面渲染下拉框） */
export interface WikiMeta {
  version: string;
  classes: { key: string; name: string; color: string }[];
  routes: { id: string; name: string; faction: 'alliance' | 'horde'; classes: string[] }[];
}

export interface WikiCharacter {
  level: number;
  classKey: string;
  routeId: string;
}

export type WikiWorkerRequest =
  | { type: 'init'; baseUrl: string }
  | { type: 'render'; id: number; character: WikiCharacter; slash: string };

export type WikiWorkerResponse =
  | { type: 'ready'; meta: WikiMeta; loadMs: number }
  | { type: 'snapshot'; id: number; snapshot: WowSnapshot; renderMs: number }
  | { type: 'error'; id?: number; message: string };

export type { WowSnapshot };
