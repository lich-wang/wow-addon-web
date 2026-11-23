/// <reference lib="webworker" />

/**
 * 「无限百科」页面的 Lua 渲染 Worker。
 *
 * 读取打包时生成的 /wiki/*.lua（与 wowf.zip 同源），在 Worker 内用 fengari 跑真正的插件 Lua
 * （data.lua + craftarb.lua + core.lua），把渲染出的控件树回传给主线程。
 * 这样网页与游戏内是同一套数据与同一套渲染逻辑，不存在二次实现导致的偏差。
 * 注意：不直接抓 wowf.zip —— .zip 链接触发下载器扩展（迅雷等）时会拿到空响应。
 */
import { WoWSimulatorRuntimeCore } from '../../../scripts/wow-ui-simulator/runtime-core.js';
import wowShimSource from '../../../scripts/wow-ui-simulator/wow-shim.lua?raw';
import { CLASS_ORDER, ROUTE_ORDER } from './tabs';
import type { WikiMeta, WikiWorkerRequest, WikiWorkerResponse } from './types';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let runtime: WoWSimulatorRuntimeCore | null = null;
let meta: WikiMeta | null = null;

/** 从 WoWF_Data 导出职业/种族清单元数据（Lua 侧拼成行文本，避免写 JSON 序列化） */
const EXTRACT_META_LUA = `
local D = WoWF_Data or {}
local out = {}
local meta = D.meta or {}
out[#out + 1] = "VERSION\\t" .. tostring(meta.version or "")
for key, cls in pairs(D.classes or {}) do
  out[#out + 1] = "CLASS\\t" .. tostring(key) .. "\\t" .. tostring(cls.name or key) .. "\\t" .. tostring(cls.color or "")
end
for id, route in pairs(D.routes or {}) do
  local classKeys = {}
  for classKey, _ in pairs(route.classRunsByClass or {}) do
    classKeys[#classKeys + 1] = tostring(classKey)
  end
  if #classKeys == 0 then
    for bandIndex = 1, #(route.bands or {}) do
      for classKey, _ in pairs(route.bands[bandIndex].trainersByClass or {}) do
        classKeys[#classKeys + 1] = tostring(classKey)
      end
      if #classKeys > 0 then break end
    end
  end
  out[#out + 1] = "ROUTE\\t" .. tostring(id) .. "\\t" .. tostring(route.name or id) .. "\\t" .. tostring(route.faction or "")
    .. "\\t" .. table.concat(classKeys, ",")
end
__WOW_BRIDGE__:emitString(table.concat(out, "\\n"))
`;

function parseMeta(lines: string[]): WikiMeta {
  let version = '';
  const classes: WikiMeta['classes'] = [];
  const routes: WikiMeta['routes'] = [];
  for (const raw of lines) {
    for (const line of raw.split('\n')) {
      const parts = line.split('\t');
      if (parts[0] === 'VERSION') version = parts[1] || '';
      else if (parts[0] === 'CLASS' && parts[1]) {
        classes.push({ key: parts[1], name: parts[2] || parts[1], color: parts[3] || '' });
      } else if (parts[0] === 'ROUTE' && parts[1]) {
        routes.push({
          id: parts[1],
          name: parts[2] || parts[1],
          faction: (parts[3] === 'horde' ? 'horde' : 'alliance') as 'alliance' | 'horde',
          classes: (parts[4] || '').split(',').filter(Boolean),
        });
      }
    }
  }
  const orderOf = (list: string[], value: string) => {
    const idx = list.indexOf(value);
    return idx < 0 ? list.length : idx;
  };
  classes.sort((a, b) => orderOf(CLASS_ORDER, a.key) - orderOf(CLASS_ORDER, b.key));
  routes.sort((a, b) => orderOf(ROUTE_ORDER, a.id) - orderOf(ROUTE_ORDER, b.id));
  // Lua 的 pairs 遍历顺序不固定，这里统一按职业顺序排序，保证下拉框与默认值稳定
  for (const route of routes) {
    route.classes.sort((a, b) => orderOf(CLASS_ORDER, a) - orderOf(CLASS_ORDER, b));
  }
  return { version, classes, routes };
}

async function loadAddon(baseUrl: string): Promise<{ meta: WikiMeta; loadMs: number }> {
  const startedAt = performance.now();
  const fetchLua = async (name: string) => {
    const res = await fetch(`${baseUrl}/${name}`);
    if (!res.ok) throw new Error(`载入 ${name} 失败：HTTP ${res.status}`);
    const text = await res.text();
    if (!text) throw new Error(`载入 ${name} 失败：内容为空`);
    return text;
  };
  const [dataLua, craftLua, coreLua] = await Promise.all([
    fetchLua('data.lua'),
    fetchLua('craftarb.lua'),
    fetchLua('core.lua'),
  ]);

  runtime?.destroy();
  const candidate = new WoWSimulatorRuntimeCore(
    { level: 1, classKey: 'WARRIOR', raceKey: 'human', faction: 'Alliance' },
    { shimSource: wowShimSource }
  );
  const loaded = candidate.loadAddon('WoWF', [
    { filename: 'Data.lua', content: dataLua },
    { filename: 'CraftArb.lua', content: craftLua },
    { filename: 'WoWF.lua', content: coreLua },
  ]);
  if (!loaded) {
    // 任一文件语法/运行期出错都不要对外宣称就绪，否则页面只会显示一个空窗口
    const reason = candidate.getSnapshot().luaErrors.map((e) => `[${e.source}] ${e.message}`).join('；');
    candidate.destroy();
    throw new Error(`插件 Lua 初始化失败：${reason || '未知错误'}`);
  }
  runtime = candidate;

  if (!runtime.execLua(EXTRACT_META_LUA, 'extract-meta.lua')) {
    const reason = runtime.getSnapshot().luaErrors.map((e) => `[${e.source}] ${e.message}`).join('；');
    runtime.destroy();
    runtime = null;
    throw new Error(`读取百科元数据失败：${reason || '未知错误'}`);
  }
  meta = parseMeta(runtime.takeEmittedStrings());
  return { meta, loadMs: Math.round(performance.now() - startedAt) };
}

function render(id: number, character: { level: number; classKey: string; routeId: string }, slash: string) {
  if (!runtime) throw new Error('运行时尚未初始化');
  const startedAt = performance.now();

  const route = meta?.routes.find((r) => r.id === character.routeId);
  runtime.charState.level = Math.round(character.level);
  runtime.charState.classKey = character.classKey;
  runtime.charState.raceKey = character.routeId;
  runtime.charState.faction = route?.faction === 'horde' ? 'Horde' : 'Alliance';

  // 运行时的 luaErrors 是累计的：只把本次渲染新增的错误交给页面，
  // 否则用户改回有效角色后仍会看到上一次的报错。
  const errorBase = runtime.getLuaErrorCount();
  runtime.runSlashCommand(slash);
  const snapshot = runtime.getSnapshot();
  snapshot.luaErrors = snapshot.luaErrors.slice(errorBase);
  ctx.postMessage({
    type: 'snapshot',
    id,
    snapshot,
    renderMs: Math.round(performance.now() - startedAt),
  } satisfies WikiWorkerResponse);
}

ctx.onmessage = async (event: MessageEvent<WikiWorkerRequest>) => {
  const msg = event.data;
  try {
    if (msg.type === 'init') {
      const { meta: loadedMeta, loadMs } = await loadAddon(msg.baseUrl);
      ctx.postMessage({ type: 'ready', meta: loadedMeta, loadMs } satisfies WikiWorkerResponse);
    } else if (msg.type === 'render') {
      render(msg.id, msg.character, msg.slash);
    }
  } catch (err) {
    ctx.postMessage({
      type: 'error',
      id: msg.type === 'render' ? msg.id : undefined,
      message: err instanceof Error ? err.message : String(err),
    } satisfies WikiWorkerResponse);
  }
};
