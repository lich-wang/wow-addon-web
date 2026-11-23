import fengari from 'fengari-web';
import { measureWoWText } from './text-measure.js';

const { lua, lauxlib, lualib, interop, to_luastring } = fengari;

/**
 * 与运行环境无关的 WoW Lua 模拟运行时核心。
 *
 * 同一份实现同时服务于：
 * - Node 侧 CI 渲染回归（scripts/wow-ui-simulator/runtime.js 注入磁盘上的 wow-shim.lua）
 * - 浏览器侧「无限百科」页面（Web Worker 内注入打包进来的 shim），保证网页与游戏内渲染完全一致
 */
export class WoWSimulatorRuntimeCore {
  /**
   * @param {Record<string, any>} [initialChar] 角色初始状态（等级/职业/种族/阵营等）
   * @param {{ shimSource: string }} options 必须提供 WoW API shim 的 Lua 源码
   */
  constructor(initialChar = {}, options = {}) {
    if (!options || typeof options.shimSource !== 'string' || options.shimSource.length === 0) {
      throw new Error('WoWSimulatorRuntimeCore 需要 shimSource（wow-shim.lua 源码字符串）');
    }
    this.shimSource = options.shimSource;
    this.nextId = 1;
    this.frames = new Map();
    this.fontStrings = new Map();
    this.textures = new Map();
    this.rootFrameIds = [];
    this.tooltip = { shown: false, ownerId: null, lines: [] };
    this.dropdown = { open: false, anchorId: null, items: [] };
    this.chatMessages = [];
    this.luaErrors = [];
    this.emittedStrings = [];
    this.loadedFiles = [];
    this.mapWaypoints = [];
    this.timers = new Set();
    this.startTime = Date.now();
    this.msgSeq = 1;
    this.errSeq = 1;

    this.charState = {
      name: '无限测试员',
      level: 25,
      classKey: 'MAGE',
      raceKey: '人类',
      faction: 'Alliance',
      zone: '暴风城',
      gold: 120,
      completedQuests: [],
      activeQuests: [],
      knownSpells: [],
      skills: [
        { name: '技能', rank: 1, maxRank: 1 },
        { name: '草药学', rank: 150, maxRank: 225 },
        { name: '炼金术', rank: 135, maxRank: 225 },
      ],
      ...initialChar,
    };

    this.initLuaState();
  }

  destroy() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  genId(prefix) {
    return `${prefix}_${this.nextId++}`;
  }

  initLuaState() {
    this.L = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(this.L);
    lauxlib.luaL_requiref(this.L, to_luastring('js'), interop.luaopen_js, 1);
    lua.lua_pop(this.L, 1);

    interop.push(this.L, this.createBridge());
    lua.lua_setglobal(this.L, to_luastring('__WOW_BRIDGE__'));

    this.execLua(this.shimSource, 'wow-shim.lua');
  }

  createBridge() {
    return {
      luaDate: () => new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      luaTime: () => Math.floor(Date.now() / 1000),
      getTime: () => (Date.now() - this.startTime) / 1000,
      reportLuaError: (msg, source) => this.pushError(msg, source),
      scheduleTimer: (timerId, delaySec) => {
        const ms = Math.max(0, Math.min(30000, (delaySec || 0) * 1000));
        const t = setTimeout(() => {
          this.timers.delete(t);
          this.callLuaGlobal('__WOW_RUN_TIMER__', timerId);
        }, ms);
        this.timers.add(t);
      },

      createFrame: (frameType, name, parentId, template) => {
        const id = this.genId('F');
        const isButton = frameType === 'Button' || frameType === 'CheckButton';
        const frame = {
          id,
          name: name || null,
          frameType,
          parentId: parentId || (name === 'UIParent' ? null : this.getUIParentId()),
          template: template || null,
          shown: true,
          alpha: 1,
          scale: 1,
          width: isButton ? 100 : null,
          height: isButton ? 22 : null,
          points: [],
          frameStrata: 'MEDIUM',
          frameLevel: 1,
          backdrop: null,
          text: '',
          enabled: true,
          checked: false,
          movable: false,
          enableMouse: isButton || frameType === 'EditBox',
          hyperlinksEnabled: false,
          scrollChildId: null,
          verticalScroll: 0,
          verticalScrollRange: 0,
          minValue: 0,
          maxValue: 100,
          value: 0,
          fontStrings: [],
          textures: [],
          childrenIds: [],
        };
        this.frames.set(id, frame);
        if (frame.parentId && this.frames.has(frame.parentId)) {
          this.frames.get(frame.parentId).childrenIds.push(id);
        } else if (!frame.parentId) {
          this.rootFrameIds.push(id);
        }
        return id;
      },

      frameSetSize: (id, w, h) => {
        const f = this.frames.get(id);
        if (f) {
          f.width = w;
          f.height = h;
          this.recomputeScrollRangeIfNeeded(id);
        }
      },
      frameSetWidth: (id, w) => { const f = this.frames.get(id); if (f) f.width = w; },
      frameSetHeight: (id, h) => {
        const f = this.frames.get(id);
        if (f) {
          f.height = h;
          this.recomputeScrollRangeIfNeeded(id);
        }
      },
      frameGetWidth: (id) => this.frames.get(id)?.width ?? 0,
      frameGetHeight: (id) => this.frames.get(id)?.height ?? 0,
      frameClearAllPoints: (id) => { const f = this.frames.get(id); if (f) f.points = []; },
      frameSetPoint: (id, point, relativeToId, relativePoint, x, y) => {
        const f = this.frames.get(id);
        if (f) f.points.push({ point, relativeToId, relativePoint, x, y });
      },
      frameShow: (id, shown) => { const f = this.frames.get(id); if (f) f.shown = shown; },
      frameIsShown: (id) => this.frames.get(id)?.shown ?? false,
      frameSetAlpha: (id, alpha) => { const f = this.frames.get(id); if (f) f.alpha = alpha; },
      frameGetAlpha: (id) => this.frames.get(id)?.alpha ?? 1,
      frameSetScale: (id, scale) => { const f = this.frames.get(id); if (f) f.scale = scale; },
      frameSetStrata: (id, strata) => { const f = this.frames.get(id); if (f) f.frameStrata = strata; },
      frameSetLevel: (id, level) => { const f = this.frames.get(id); if (f) f.frameLevel = level; },
      frameGetLevel: (id) => this.frames.get(id)?.frameLevel ?? 1,
      frameSetEnableMouse: (id, e) => { const f = this.frames.get(id); if (f) f.enableMouse = e; },
      frameSetMovable: (id, m) => { const f = this.frames.get(id); if (f) f.movable = m; },
      frameSetHyperlinksEnabled: (id, e) => { const f = this.frames.get(id); if (f) f.hyperlinksEnabled = e; },
      frameSetEnabled: (id, e) => { const f = this.frames.get(id); if (f) f.enabled = e; },
      frameIsEnabled: (id) => this.frames.get(id)?.enabled ?? true,
      frameSetBackdrop: (id, bd) => {
        const f = this.frames.get(id);
        if (!f) return;
        if (!bd) { f.backdrop = null; return; }
        f.backdrop = {
          bgFile: bd.bgFile,
          edgeFile: bd.edgeFile,
          tile: bd.tile,
          tileSize: bd.tileSize,
          edgeSize: bd.edgeSize,
          insets: { left: bd.left ?? 0, right: bd.right ?? 0, top: bd.top ?? 0, bottom: bd.bottom ?? 0 },
          bgColor: f.backdrop?.bgColor ?? [0.06, 0.08, 0.12, 0.92],
          borderColor: f.backdrop?.borderColor ?? [0.4, 0.45, 0.55, 0.9],
        };
      },
      frameSetBackdropColor: (id, r, g, b, a) => {
        const f = this.frames.get(id);
        if (f) { if (!f.backdrop) f.backdrop = {}; f.backdrop.bgColor = [r, g, b, a]; }
      },
      frameSetBackdropBorderColor: (id, r, g, b, a) => {
        const f = this.frames.get(id);
        if (f) { if (!f.backdrop) f.backdrop = {}; f.backdrop.borderColor = [r, g, b, a]; }
      },
      frameSetText: (id, text) => { const f = this.frames.get(id); if (f) f.text = text; },
      frameGetText: (id) => this.frames.get(id)?.text ?? '',
      frameGetTextWidth: (id) => {
        const f = this.frames.get(id);
        return f ? measureWoWText(f.text, null, 'GameFontNormal', 0, false).width : 0;
      },
      frameSetChecked: (id, c) => { const f = this.frames.get(id); if (f) f.checked = c; },
      frameGetChecked: (id) => this.frames.get(id)?.checked ?? false,
      frameSetScrollChild: (id, childId) => {
        const f = this.frames.get(id);
        if (f) { f.scrollChildId = childId; this.recomputeScrollRangeIfNeeded(childId); }
      },
      frameSetVerticalScroll: (id, v) => {
        const f = this.frames.get(id);
        if (f) f.verticalScroll = Math.max(0, Math.min(f.verticalScrollRange, v));
      },
      frameGetVerticalScroll: (id) => this.frames.get(id)?.verticalScroll ?? 0,
      frameGetVerticalScrollRange: (id) => this.frames.get(id)?.verticalScrollRange ?? 0,
      frameSetMinMax: (id, mn, mx) => { const f = this.frames.get(id); if (f) { f.minValue = mn; f.maxValue = mx; } },
      frameSetValue: (id, v) => { const f = this.frames.get(id); if (f) f.value = v; },
      frameGetValue: (id) => this.frames.get(id)?.value ?? 0,

      createFontString: (parentId, name, layer, fontObject) => {
        const id = this.genId('FS');
        this.fontStrings.set(id, {
          id, name: name || null, parentId, layer: layer || 'OVERLAY',
          fontObject: fontObject || 'GameFontHighlight', text: '', color: [1, 1, 1, 1],
          justifyH: 'LEFT', justifyV: 'MIDDLE', wordWrap: true, spacing: 0,
          width: null, height: null, shown: true, alpha: 1, points: [], hyperlinksEnabled: false,
        });
        this.frames.get(parentId)?.fontStrings.push(id);
        return id;
      },
      fsClearAllPoints: (id) => { const fs = this.fontStrings.get(id); if (fs) fs.points = []; },
      fsSetPoint: (id, point, relativeToId, relativePoint, x, y) => {
        const fs = this.fontStrings.get(id);
        if (fs) fs.points.push({ point, relativeToId, relativePoint, x, y });
      },
      fsSetText: (id, text) => { const fs = this.fontStrings.get(id); if (fs) fs.text = text; },
      fsSetColor: (id, r, g, b, a) => { const fs = this.fontStrings.get(id); if (fs) fs.color = [r, g, b, a]; },
      fsSetFontObject: (id, obj) => { const fs = this.fontStrings.get(id); if (fs) fs.fontObject = obj; },
      fsSetJustifyH: (id, j) => { const fs = this.fontStrings.get(id); if (fs) fs.justifyH = j; },
      fsSetJustifyV: (id, j) => { const fs = this.fontStrings.get(id); if (fs) fs.justifyV = j; },
      fsSetWordWrap: (id, w) => { const fs = this.fontStrings.get(id); if (fs) fs.wordWrap = w; },
      fsSetSpacing: (id, s) => { const fs = this.fontStrings.get(id); if (fs) fs.spacing = s; },
      fsSetWidth: (id, w) => { const fs = this.fontStrings.get(id); if (fs) fs.width = w; },
      fsSetHeight: (id, h) => { const fs = this.fontStrings.get(id); if (fs) fs.height = h; },
      fsGetStringWidth: (id) => {
        const fs = this.fontStrings.get(id);
        if (!fs) return 0;
        const parentW = this.frames.get(fs.parentId)?.width ?? null;
        return measureWoWText(fs.text, fs.width ?? parentW, fs.fontObject, fs.spacing, fs.wordWrap).width;
      },
      fsGetStringHeight: (id) => {
        const fs = this.fontStrings.get(id);
        if (!fs) return 0;
        const parentW = this.frames.get(fs.parentId)?.width ?? null;
        return measureWoWText(fs.text, fs.width ?? parentW, fs.fontObject, fs.spacing, fs.wordWrap).height;
      },
      fsShow: (id, s) => { const fs = this.fontStrings.get(id); if (fs) fs.shown = s; },
      fsSetAlpha: (id, a) => { const fs = this.fontStrings.get(id); if (fs) fs.alpha = a; },
      fsSetHyperlinksEnabled: (id, e) => { const fs = this.fontStrings.get(id); if (fs) fs.hyperlinksEnabled = e; },

      createTexture: (parentId, name, layer) => {
        const id = this.genId('TX');
        this.textures.set(id, {
          id, name: name || null, parentId, layer: layer || 'ARTWORK',
          texture: null, colorTexture: null, vertexColor: null,
          width: null, height: null, shown: true, alpha: 1, points: [],
        });
        this.frames.get(parentId)?.textures.push(id);
        return id;
      },
      texClearAllPoints: (id) => { const t = this.textures.get(id); if (t) t.points = []; },
      texSetPoint: (id, point, relativeToId, relativePoint, x, y) => {
        const t = this.textures.get(id);
        if (t) t.points.push({ point, relativeToId, relativePoint, x, y });
      },
      texSetTexture: (id, p) => { const t = this.textures.get(id); if (t) t.texture = p; },
      texSetColorTexture: (id, r, g, b, a) => { const t = this.textures.get(id); if (t) t.colorTexture = [r, g, b, a]; },
      texSetVertexColor: (id, r, g, b, a) => { const t = this.textures.get(id); if (t) t.vertexColor = [r, g, b, a]; },
      texSetSize: (id, w, h) => {
        const t = this.textures.get(id);
        // Lua 的 nil 经 fengari-interop 会变成 undefined：单独设宽/设高时不能把另一维清掉
        if (t) {
          if (w !== null && w !== undefined) t.width = w;
          if (h !== null && h !== undefined) t.height = h;
        }
      },
      texShow: (id, s) => { const t = this.textures.get(id); if (t) t.shown = s; },
      texSetAlpha: (id, a) => { const t = this.textures.get(id); if (t) t.alpha = a; },

      tooltipSetOwner: (ownerId) => { this.tooltip.ownerId = ownerId; },
      tooltipClearLines: () => { this.tooltip.lines = []; },
      tooltipAddLine: (text, r, g, b, wrap) => { this.tooltip.lines.push({ text, r, g, b, wrap }); },
      tooltipSetHyperlink: (link) => { this.tooltip.lines = [{ text: `超链接预览: ${link}`, r: 1, g: 0.82, b: 0 }]; },
      tooltipShow: (shown) => { this.tooltip.shown = shown; },
      tooltipIsShown: () => this.tooltip.shown,

      dropdownClear: () => { this.dropdown.items = []; },
      dropdownAddItem: (index, text, checked, disabled, isTitle, isNotRadio, notCheckable, keepShownOnClick) => {
        this.dropdown.items.push({ index, text, checked, disabled, isTitle, isNotRadio, notCheckable, keepShownOnClick });
      },
      dropdownOpen: (anchorId) => { this.dropdown.anchorId = anchorId; this.dropdown.open = true; },
      dropdownClose: () => { this.dropdown.open = false; },
      dropdownIsOpen: () => this.dropdown.open,

      addChatMessage: (text, r, g, b) => {
        this.chatMessages.push({
          id: this.msgSeq++, text, r, g, b,
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        });
      },
      getCharField: (field) => this.charState[field],
      isQuestCompleted: (qid) => this.charState.completedQuests.includes(qid),
      isQuestActive: (qid) => this.charState.activeQuests.includes(qid),
      isPlayerSpell: (spellId) => this.charState.knownSpells.includes(spellId),
      getNumSkills: () => this.charState.skills.length,
      getSkillInfo: (idx) => this.charState.skills[idx - 1]?.name ?? null,
      addWaypoint: (zone, label, x, y) => { this.mapWaypoints.push({ zone, label, x, y }); },
      // 让 Lua 侧能把结构化文本回传给宿主（网页端用来导出职业/种族清单等元数据）
      emitString: (text) => { this.emittedStrings.push(String(text)); },
    };
  }

  /**
   * 取出并清空 Lua 侧通过 __WOW_BRIDGE__:emitString 回传的文本
   * @returns {string[]}
   */
  takeEmittedStrings() {
    const out = this.emittedStrings.slice();
    this.emittedStrings.length = 0;
    return out;
  }

  getUIParentId() {
    for (const f of this.frames.values()) {
      if (f.name === 'UIParent') return f.id;
    }
    return null;
  }

  recomputeScrollRangeIfNeeded(frameId) {
    for (const f of this.frames.values()) {
      if (f.frameType === 'ScrollFrame' && f.scrollChildId === frameId) {
        const child = this.frames.get(frameId);
        const childH = child?.height ?? 0;
        const sfH = f.height ?? 400;
        f.verticalScrollRange = Math.max(0, childH - sfH);
        if (f.verticalScroll > f.verticalScrollRange) f.verticalScroll = f.verticalScrollRange;
      }
    }
  }

  pushError(message, source) {
    this.luaErrors.push({
      id: this.errSeq++, message, source,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    });
  }

  execLua(code, chunkName = 'chunk.lua', varargs = []) {
    const L = this.L;
    const bytes = to_luastring(code);
    const status = lauxlib.luaL_loadbuffer(L, bytes, bytes.length, to_luastring('@' + chunkName));
    if (status !== lua.LUA_OK) {
      const err = lua.lua_tojsstring(L, -1);
      lua.lua_pop(L, 1);
      this.pushError(err || 'Syntax error', chunkName);
      return false;
    }
    for (const arg of varargs) lua.lua_pushstring(L, to_luastring(arg));
    const callStatus = lua.lua_pcall(L, varargs.length, 0, 0);
    if (callStatus !== lua.LUA_OK) {
      const err = lua.lua_tojsstring(L, -1);
      lua.lua_pop(L, 1);
      this.pushError(err || 'Runtime error', chunkName);
      return false;
    }
    return true;
  }

  callLuaGlobal(fnName, ...args) {
    const L = this.L;
    lua.lua_getglobal(L, to_luastring(fnName));
    for (const arg of args) interop.push(L, arg);
    const status = lua.lua_pcall(L, args.length, 0, 0);
    if (status !== lua.LUA_OK) {
      const err = lua.lua_tojsstring(L, -1);
      lua.lua_pop(L, 1);
      this.pushError(err || 'Call error', fnName);
    }
  }

  /**
   * 按 TOC 顺序加载插件文件并派发登录事件。
   * @returns {boolean} 所有文件都成功执行时才为 true
   */
  loadAddon(addonName, files) {
    this.loadedFiles = [];
    let allOk = true;
    for (const file of files) {
      const ok = this.execLua(file.content, file.filename, [addonName]);
      if (!ok) allOk = false;
      this.loadedFiles.push(ok ? file.filename : `${file.filename} (ERR)`);
    }
    this.callLuaGlobal('__WOW_DISPATCH_EVENT__', 'ADDON_LOADED', addonName);
    this.callLuaGlobal('__WOW_DISPATCH_EVENT__', 'PLAYER_LOGIN');
    this.callLuaGlobal('__WOW_DISPATCH_EVENT__', 'PLAYER_ENTERING_WORLD', true, false);
    return allOk;
  }

  runSlashCommand(cmdLine) {
    this.callLuaGlobal('__WOW_RUN_SLASH__', cmdLine);
  }

  triggerFrameScript(frameId, scriptName, ...args) {
    this.callLuaGlobal('__WOW_DISPATCH_SCRIPT__', frameId, scriptName, ...args);
  }

  getSnapshot() {
    const frames = {};
    for (const [k, f] of this.frames.entries()) {
      frames[k] = {
        ...f,
        points: f.points.map((p) => ({ ...p })),
        fontStrings: [...f.fontStrings],
        textures: [...f.textures],
        childrenIds: [...f.childrenIds],
        backdrop: f.backdrop
          ? {
              ...f.backdrop,
              insets: f.backdrop.insets ? { ...f.backdrop.insets } : undefined,
              bgColor: f.backdrop.bgColor ? [...f.backdrop.bgColor] : undefined,
              borderColor: f.backdrop.borderColor ? [...f.backdrop.borderColor] : undefined,
            }
          : null,
      };
    }

    const fontStrings = {};
    for (const [k, fs] of this.fontStrings.entries()) {
      fontStrings[k] = {
        ...fs,
        points: fs.points.map((p) => ({ ...p })),
        color: [...fs.color],
      };
    }

    const textures = {};
    for (const [k, tex] of this.textures.entries()) {
      textures[k] = {
        ...tex,
        points: tex.points.map((p) => ({ ...p })),
        colorTexture: tex.colorTexture ? [...tex.colorTexture] : null,
        vertexColor: tex.vertexColor ? [...tex.vertexColor] : null,
      };
    }

    return {
      frames,
      fontStrings,
      textures,
      rootFrameIds: [...this.rootFrameIds],
      tooltip: { ...this.tooltip, lines: this.tooltip.lines.map((l) => ({ ...l })) },
      dropdown: { ...this.dropdown, items: this.dropdown.items.map((i) => ({ ...i })) },
      chatMessages: this.chatMessages.map((m) => ({ ...m })),
      luaErrors: this.luaErrors.map((e) => ({ ...e })),
      charState: { ...this.charState },
      loadedFiles: [...this.loadedFiles],
    };
  }
}
