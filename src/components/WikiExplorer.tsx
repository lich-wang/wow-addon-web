import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ChevronDown, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { WowFrameView } from './wiki/WowFrameView';
import { WIKI_TABS } from '../services/wowfWiki/tabs';
import { WikiClient } from '../services/wowfWiki/wikiClient';
import type { WikiCharacter, WikiMeta, WowSnapshot } from '../services/wowfWiki/types';

// 网页百科直接读取打包时生成的 Lua 资源（不经 .zip，避免被迅雷等下载器扩展拦截）
const WIKI_ASSET_BASE = '/wiki';

const LEVEL_TICKS = [1, 10, 20, 30, 40, 50, 60];

/**
 * 等级必须是 1-60 的整数：
 * 插件侧用 string.format("Lv.%d", level) 渲染，Lua 5.3 下小数会让 %d 报错并中断刷新。
 */
function clampLevel(raw: string | number): number {
  const value = Math.round(Number(raw));
  if (!Number.isFinite(value)) return 1;
  return Math.min(60, Math.max(1, value));
}

function classColor(meta: WikiMeta | null, classKey: string): string {
  const raw = meta?.classes.find((c) => c.key === classKey)?.color || '';
  return raw.length === 6 ? `#${raw}` : '#e2e8f0';
}

/**
 * 「无限百科」页面：在浏览器里运行插件本体，让玩家不装插件也能查。
 * 角色信息（等级/种族/职业）由用户自选，渲染结果与游戏内完全一致。
 */
export function WikiExplorer() {
  const clientRef = useRef<WikiClient | null>(null);
  const [meta, setMeta] = useState<WikiMeta | null>(null);
  const [snapshot, setSnapshot] = useState<WowSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMs, setLoadMs] = useState<number | null>(null);
  const [renderMs, setRenderMs] = useState<number | null>(null);
  const [level, setLevel] = useState(25);
  const [routeId, setRouteId] = useState('human');
  const [classKey, setClassKey] = useState('MAGE');
  const [tabId, setTabId] = useState('home');
  const [tabsOpen, setTabsOpen] = useState(false);
  const [renderSeq, setRenderSeq] = useState(0);

  const getClient = useCallback(() => {
    if (!clientRef.current) clientRef.current = new WikiClient();
    return clientRef.current;
  }, []);

  // 启动 Worker 并加载插件包
  useEffect(() => {
    let active = true;
    const client = getClient();
    setLoading(true);
    client
      .load(WIKI_ASSET_BASE)
      .then(({ meta: loadedMeta, loadMs: ms }) => {
        if (!active) return;
        setMeta(loadedMeta);
        setLoadMs(ms);
        const firstRoute = loadedMeta.routes.find((r) => r.id === 'human') ?? loadedMeta.routes[0];
        if (firstRoute) {
          setRouteId(firstRoute.id);
          if (firstRoute.classes.length > 0) setClassKey(firstRoute.classes[0]);
        }
        setLoading(false);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message);
        setLoading(false);
      });
    return () => {
      active = false;
      client.dispose();
      clientRef.current = null;
    };
  }, [getClient]);

  const availableClasses = useMemo(() => {
    if (!meta) return [];
    const route = meta.routes.find((r) => r.id === routeId);
    const allowed = route?.classes?.length ? new Set(route.classes) : null;
    const list = allowed ? meta.classes.filter((c) => allowed.has(c.key)) : meta.classes;
    return list.length > 0 ? list : meta.classes;
  }, [meta, routeId]);

  // 切换种族后若当前职业不可用，自动选该种族第一个职业
  useEffect(() => {
    if (availableClasses.length === 0) return;
    if (!availableClasses.some((c) => c.key === classKey)) {
      setClassKey(availableClasses[0].key);
    }
  }, [availableClasses, classKey]);

  const slash = useMemo(() => WIKI_TABS.find((t) => t.id === tabId)?.slash ?? '/wowf', [tabId]);

  // 角色或页签变化 → 重新渲染（等级拖动做 150ms 防抖，避免刷屏）
  useEffect(() => {
    if (!meta) return;
    const character: WikiCharacter = { level, classKey, routeId };
    let cancelled = false;
    setRendering(true);
    const timer = window.setTimeout(() => {
      const client = getClient();
      client
        .render(character, slash)
        .then(({ snapshot: snap, renderMs: ms, requestId }) => {
          if (cancelled || !client.isLatest(requestId)) return;
          setSnapshot(snap);
          // 换页签/换角色后重新挂载渲染树，让内部滚动容器回到顶部
          setRenderSeq((seq) => seq + 1);
          setRenderMs(ms);
          setError(null);
          setRendering(false);
        })
        .catch((err: Error) => {
          if (cancelled) return;
          setError(err.message);
          setRendering(false);
        });
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [meta, level, classKey, routeId, slash, getClient]);

  const activeTab = WIKI_TABS.find((t) => t.id === tabId) ?? WIKI_TABS[0];
  const charLabel = `${meta?.routes.find((r) => r.id === routeId)?.name ?? ''} · ${
    meta?.classes.find((c) => c.key === classKey)?.name ?? classKey
  }`;

  return (
    <section className="space-y-5">
      {/* 头部说明 */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600/30 to-cyan-500/20 border border-emerald-500/30">
              <BookOpen className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">无限百科 · 网页版</h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
                页面直接运行「巫妖王的无限百科」插件本体的 Lua 渲染逻辑（与游戏内同一份数据、同一套界面），
                无需安装插件即可查看。选择你的角色信息，内容会自动匹配到对应等级阶段。
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>{meta?.version || '数据加载中…'}</span>
          </div>
        </div>
      </div>

      {/* 角色选择 + 页签 */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 等级 */}
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium text-slate-400">角色等级</span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={60}
                step={1}
                value={level}
                onChange={(e) => setLevel(clampLevel(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-amber-400"
                aria-label="角色等级"
              />
              <input
                type="number"
                min={1}
                max={60}
                step={1}
                value={level}
                onChange={(e) => setLevel(clampLevel(e.target.value))}
                className="w-16 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-center text-sm font-bold text-amber-300 outline-none focus:border-amber-500"
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-600">
              {LEVEL_TICKS.map((tick) => (
                <span key={tick}>{tick}</span>
              ))}
            </div>
          </label>

          {/* 种族 */}
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium text-slate-400">种族</span>
            <div className="relative">
              <select
                value={routeId}
                onChange={(e) => setRouteId(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-amber-500"
              >
                {meta?.routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.name}（{route.faction === 'horde' ? '部落' : '联盟'}）
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-slate-500" />
            </div>
          </label>

          {/* 职业 */}
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium text-slate-400">职业</span>
            <div className="relative">
              <select
                value={classKey}
                onChange={(e) => setClassKey(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
                style={{ color: classColor(meta, classKey) }}
              >
                {availableClasses.map((cls) => (
                  <option key={cls.key} value={cls.key}>
                    {cls.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-slate-500" />
            </div>
          </label>

          {/* 当前匹配提示 */}
          <div className="flex items-end">
            <div className="w-full rounded-lg border border-slate-700/70 bg-slate-950/70 px-3 py-2">
              <div className="text-[10px] text-slate-500">当前角色</div>
              <div className="truncate text-sm font-semibold text-slate-200">
                Lv.{level} {charLabel}
              </div>
            </div>
          </div>
        </div>

        {/* 页签（与插件内 TAB_DEFS 一致） */}
        <div className="flex flex-wrap gap-1.5 border-t border-slate-800 pt-3">
          <button
            type="button"
            onClick={() => setTabsOpen((v) => !v)}
            className="mb-1 flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-400 hover:border-amber-500/50 hover:text-amber-300 sm:hidden"
          >
            页签：{activeTab.label}
            <ChevronDown className={`h-3 w-3 transition-transform ${tabsOpen ? 'rotate-180' : ''}`} />
          </button>
          <div className={`${tabsOpen ? 'flex' : 'hidden'} flex-wrap gap-1.5 sm:flex`}>
            {WIKI_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTabId(tab.id)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  tabId === tab.id
                    ? 'border border-amber-500/40 bg-amber-500/15 text-amber-300'
                    : 'border border-transparent text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 text-[10px] text-slate-500">
            {loadMs != null ? <span>载入 {loadMs} ms</span> : null}
            {renderMs != null ? <span>渲染 {renderMs} ms</span> : null}
          </div>
        </div>
      </div>

      {/* 渲染区 */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-2 sm:p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-sm text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            <p>正在载入插件与百科数据（首次约需数秒）…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-rose-300">
            <p>百科加载失败：{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-500/10"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重新加载
            </button>
          </div>
        ) : snapshot ? (
          <>
            {rendering ? (
              <div className="absolute right-6 top-6 z-10 flex items-center gap-1.5 rounded-full bg-slate-950/80 px-2.5 py-1 text-[10px] text-amber-300">
                <Loader2 className="h-3 w-3 animate-spin" />
                渲染中
              </div>
            ) : null}
            {snapshot.luaErrors.length > 0 ? (
              <div className="mb-3 rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-[11px] text-rose-200">
                <p className="font-semibold">插件渲染时出现 {snapshot.luaErrors.length} 条 Lua 错误</p>
                <ul className="mt-1 space-y-0.5 font-mono">
                  {snapshot.luaErrors.slice(0, 3).map((err) => (
                    <li key={err.id}>
                      [{err.source}] {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <WowFrameView key={renderSeq} snapshot={snapshot} />
          </>
        ) : (
          <div className="py-24 text-center text-sm text-slate-500">暂无内容</div>
        )}
      </div>

      <p className="text-center text-[11px] leading-relaxed text-slate-600">
        内容与「巫妖王的无限百科」插件同源；网页版为只读视图，坐标/任务链接请在游戏内点击。
        <br />
        网页版不加载游戏内的 QuestieDB，个别任务名与前置链会以插件内置数据为准；
        制造套利、专业与声望中依赖游戏内行情的部分也不会显示真实数值。
      </p>
    </section>
  );
}
