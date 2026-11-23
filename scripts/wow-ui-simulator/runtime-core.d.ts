/** WoW UI 模拟运行时的 TypeScript 声明（实现见 runtime-core.js，供 Node 与浏览器共用） */

export type WowPoint = {
  point: string;
  relativeToId: string | null;
  relativePoint: string;
  x: number;
  y: number;
};

export type WowColor = [number, number, number, number];

export type WowBackdrop = {
  bgFile?: string | null;
  edgeFile?: string | null;
  tile?: boolean;
  tileSize?: number;
  edgeSize?: number;
  insets?: { left: number; right: number; top: number; bottom: number };
  bgColor?: WowColor;
  borderColor?: WowColor;
};

export type WowFrameSnapshot = {
  id: string;
  name: string | null;
  frameType: string;
  parentId: string | null;
  template: string | null;
  shown: boolean;
  alpha: number;
  scale: number;
  width: number | null;
  height: number | null;
  points: WowPoint[];
  frameStrata: string;
  frameLevel: number;
  backdrop: WowBackdrop | null;
  text: string;
  enabled: boolean;
  checked: boolean;
  movable: boolean;
  scrollChildId: string | null;
  verticalScroll: number;
  verticalScrollRange: number;
  childrenIds: string[];
  fontStrings: string[];
  textures: string[];
};

export type WowFontStringSnapshot = {
  id: string;
  name: string | null;
  parentId: string;
  layer: string;
  fontObject: string;
  text: string;
  color: WowColor;
  justifyH: string;
  justifyV: string;
  wordWrap: boolean;
  spacing: number;
  width: number | null;
  height: number | null;
  shown: boolean;
  alpha: number;
  points: WowPoint[];
  hyperlinksEnabled?: boolean;
};

export type WowTextureSnapshot = {
  id: string;
  name: string | null;
  parentId: string;
  layer: string;
  shown: boolean;
  alpha: number;
  width: number | null;
  height: number | null;
  colorTexture: WowColor | null;
  vertexColor: WowColor | null;
  points: WowPoint[];
};

export type WowCharState = {
  name: string;
  level: number;
  classKey: string;
  raceKey: string;
  faction: string;
  zone: string;
  gold: number;
  completedQuests: number[];
  activeQuests: number[];
  knownSpells: number[];
  skills: { name: string; rank: number; maxRank: number }[];
};

export type WowSnapshot = {
  frames: Record<string, WowFrameSnapshot>;
  fontStrings: Record<string, WowFontStringSnapshot>;
  textures: Record<string, WowTextureSnapshot>;
  rootFrameIds: string[];
  tooltip: { shown: boolean; ownerId: string | null; lines: { text: string; r: number; g: number; b: number }[] };
  dropdown: {
    open: boolean;
    anchorId: string | null;
    items: {
      index: number;
      text: string;
      checked: boolean;
      disabled: boolean;
      isTitle: boolean;
      isNotRadio: boolean;
      notCheckable: boolean;
      keepShownOnClick: boolean;
    }[];
  };
  chatMessages: { id: number; text: string; r: number; g: number; b: number; timestamp: string }[];
  luaErrors: { id: number; message: string; source: string; timestamp: string }[];
  charState: WowCharState;
  loadedFiles: string[];
};

export class WoWSimulatorRuntimeCore {
  /** 第二个参数是必填项：缺少 shim 源码时实现会立即抛错 */
  constructor(initialChar: Partial<WowCharState> | undefined, options: { shimSource: string });
  charState: WowCharState;
  execLua(code: string, chunkName?: string, varargs?: string[]): boolean;
  callLuaGlobal(fnName: string, ...args: unknown[]): void;
  loadAddon(
    addonName: string,
    files: { filename: string; content: string }[]
  ): boolean;
  getLuaErrorCount(): number;
  runSlashCommand(cmdLine: string): void;
  triggerFrameScript(frameId: string, scriptName: string, ...args: unknown[]): void;
  clickDropdownItem(index: number): void;
  takeEmittedStrings(): string[];
  getSnapshot(): WowSnapshot;
  destroy(): void;
}
