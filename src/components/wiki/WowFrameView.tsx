import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  WowFontStringSnapshot,
  WowFrameSnapshot,
  WowPoint,
  WowSnapshot,
  WowTextureSnapshot,
} from '../../../scripts/wow-ui-simulator/runtime-core';
import { getFontSizeFromObject, measureWoWText } from '../../../scripts/wow-ui-simulator/text-measure';

type Rect = { x: number; y: number; w: number; h: number };

const WOW_FONT_STACK = '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", sans-serif';

function rgba(color: [number, number, number, number] | null | undefined, fallback: string): string {
  if (!color) return fallback;
  const [r, g, b, a] = color;
  return `rgba(${Math.round((r ?? 0) * 255)},${Math.round((g ?? 0) * 255)},${Math.round((b ?? 0) * 255)},${a ?? 1})`;
}

/** 取锚点在矩形上的坐标（与 WoW 一致：y 轴向上，故外部做减法） */
function anchorPoint(rect: Rect, point: string): { x: number; y: number } {
  let x = rect.x;
  if (point === 'TOP' || point === 'CENTER' || point === 'BOTTOM') x += rect.w / 2;
  else if (point === 'TOPRIGHT' || point === 'RIGHT' || point === 'BOTTOMRIGHT') x += rect.w;

  let y = rect.y;
  if (point === 'LEFT' || point === 'CENTER' || point === 'RIGHT') y += rect.h / 2;
  else if (point === 'BOTTOMLEFT' || point === 'BOTTOM' || point === 'BOTTOMRIGHT') y += rect.h;

  return { x, y };
}

/**
 * 把 WoW 的 SetPoint 锚点解析成父级坐标系内的矩形。
 * 实现与 scripts/wow-ui-simulator/html-report.js 保持一致，只是坐标改为相对父容器。
 */
function resolveRect(
  points: WowPoint[],
  ownWidth: number | null,
  ownHeight: number | null,
  parent: Rect,
  siblings: Map<string, Rect>,
  parentId: string
): Rect {
  if (!points || points.length === 0) {
    return { x: 0, y: 0, w: ownWidth ?? parent.w, h: ownHeight ?? parent.h };
  }

  let left: number | null = null;
  let right: number | null = null;
  let top: number | null = null;
  let bottom: number | null = null;
  let centerX: number | null = null;
  let centerY: number | null = null;

  for (const pt of points) {
    const isParent = !pt.relativeToId || pt.relativeToId === parentId;
    const relRect = isParent
      ? { x: 0, y: 0, w: parent.w, h: parent.h }
      : (pt.relativeToId ? siblings.get(pt.relativeToId) : undefined) ?? {
          x: 0,
          y: 0,
          w: parent.w,
          h: parent.h,
        };
    const relAnchor = anchorPoint(relRect, pt.relativePoint ?? 'CENTER');
    const targetX = relAnchor.x + (pt.x || 0);
    const targetY = relAnchor.y - (pt.y || 0);

    if (pt.point === 'TOPLEFT' || pt.point === 'LEFT' || pt.point === 'BOTTOMLEFT') left = targetX;
    if (pt.point === 'TOPRIGHT' || pt.point === 'RIGHT' || pt.point === 'BOTTOMRIGHT') right = targetX;
    if (pt.point === 'TOP' || pt.point === 'CENTER' || pt.point === 'BOTTOM') centerX = targetX;
    if (pt.point === 'TOPLEFT' || pt.point === 'TOP' || pt.point === 'TOPRIGHT') top = targetY;
    if (pt.point === 'BOTTOMLEFT' || pt.point === 'BOTTOM' || pt.point === 'BOTTOMRIGHT') bottom = targetY;
    if (pt.point === 'LEFT' || pt.point === 'CENTER' || pt.point === 'RIGHT') centerY = targetY;
  }

  let w = ownWidth ?? 100;
  let h = ownHeight ?? 24;
  let x = 0;
  let y = 0;

  if (left !== null && right !== null) {
    x = left;
    w = Math.max(0, right - left);
  } else if (left !== null) x = left;
  else if (right !== null) x = right - w;
  else if (centerX !== null) x = centerX - w / 2;

  if (top !== null && bottom !== null) {
    y = top;
    h = Math.max(0, bottom - top);
  } else if (top !== null) y = top;
  else if (bottom !== null) y = bottom - h;
  else if (centerY !== null) y = centerY - h / 2;

  return { x, y, w, h };
}

type TextSegment = { text: string; color: string; href?: string };

/** 解析 WoW 颜色/链接码，得到可渲染的分段 */
function parseWowText(input: string, defaultColor: string): TextSegment[] {
  const str = String(input ?? '').replace(/\|n/g, '\n');
  const segments: TextSegment[] = [];
  const colorStack: string[] = [defaultColor];
  let buffer = '';
  let href: string | undefined;

  const flush = () => {
    if (buffer) {
      segments.push({ text: buffer, color: colorStack[colorStack.length - 1], href });
      buffer = '';
    }
  };

  let i = 0;
  while (i < str.length) {
    if (str[i] === '|' && i + 1 < str.length) {
      const code = str[i + 1];
      if ((code === 'c' || code === 'C') && /^[0-9a-fA-F]{8}$/.test(str.slice(i + 2, i + 10))) {
        flush();
        colorStack.push(`#${str.slice(i + 4, i + 10)}`);
        i += 10;
        continue;
      }
      if (code === 'r' || code === 'R') {
        flush();
        if (colorStack.length > 1) colorStack.pop();
        i += 2;
        continue;
      }
      if (code === 'H') {
        const endH = str.indexOf('|h', i + 2);
        if (endH !== -1) {
          flush();
          href = str.slice(i + 2, endH);
          i = endH + 2;
          continue;
        }
      }
      if (code === 'h') {
        flush();
        href = undefined;
        i += 2;
        continue;
      }
      if (code === 'T') {
        const endT = str.indexOf('|t', i + 2);
        if (endT !== -1) {
          i = endT + 2;
          continue;
        }
      }
      if (code === '|') {
        buffer += '|';
        i += 2;
        continue;
      }
    }
    buffer += str[i];
    i += 1;
  }
  flush();
  return segments;
}

function WowText({ text, defaultColor }: { text: string; defaultColor: string }) {
  const segments = useMemo(() => parseWowText(text, defaultColor), [text, defaultColor]);
  return (
    <>
      {segments.map((seg, idx) => {
        const lines = seg.text.split('\n');
        return (
          <span
            key={idx}
            title={seg.href ? describeLink(seg.href) : undefined}
            style={{ color: seg.color, ...(seg.href ? { borderBottom: '1px dotted rgba(255,255,255,0.35)', cursor: 'help' } : {}) }}
          >
            {lines.map((line, lineIdx) => (
              <span key={lineIdx}>
                {line}
                {lineIdx < lines.length - 1 ? <br /> : null}
              </span>
            ))}
          </span>
        );
      })}
    </>
  );
}

/** 把超链接载荷转成可读提示（坐标/任务/NPC 链接） */
function describeLink(payload: string): string {
  const [kind, ...rest] = payload.split(':');
  if (kind === 'wowfmap') {
    const [, x, y, zone] = rest;
    const zoneName = zone || rest[3] || '';
    return zoneName ? `${zoneName} (${x}, ${y})` : `坐标 (${x}, ${y})`;
  }
  if (kind === 'wowfnpc') return `NPC：${rest.join(' ')}`;
  if (kind === 'quest' || kind === 'wowfquest') return '游戏内任务链接';
  return payload;
}

function FontStringView({ fs, rect }: { fs: WowFontStringSnapshot; rect: Rect }) {
  const fontSize = getFontSizeFromObject(fs.fontObject);
  const lineHeight = fontSize * 1.38 + Math.max(0, fs.spacing || 0);
  const align = fs.justifyH === 'CENTER' ? 'center' : fs.justifyH === 'RIGHT' ? 'right' : 'left';
  return (
    <div
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        minHeight: rect.h,
        fontFamily: WOW_FONT_STACK,
        fontSize,
        lineHeight: `${lineHeight}px`,
        textAlign: align,
        whiteSpace: fs.wordWrap === false ? 'nowrap' : 'pre-wrap',
        wordBreak: 'break-word',
        opacity: fs.alpha,
        pointerEvents: fs.hyperlinksEnabled ? 'auto' : 'none',
      }}
    >
      <WowText text={fs.text} defaultColor={rgba(fs.color, '#ffffff')} />
    </div>
  );
}

function TextureView({ tex, rect }: { tex: WowTextureSnapshot; rect: Rect }) {
  const background = tex.colorTexture ? rgba(tex.colorTexture, 'transparent') : 'transparent';
  return (
    <div
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        background,
        opacity: tex.alpha,
        pointerEvents: 'none',
      }}
    />
  );
}

const BUTTON_STYLE: React.CSSProperties = {
  background: 'linear-gradient(180deg, #3a3a42 0%, #22222a 55%, #16161c 100%)',
  border: '1px solid #6b5a33',
  borderRadius: 4,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 2px rgba(0,0,0,0.5)',
  color: '#ffd100',
  fontFamily: WOW_FONT_STACK,
  fontSize: 12,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: '0 6px',
  boxSizing: 'border-box',
  overflow: 'hidden',
};

function FrameView({
  frame,
  rect,
  snapshot,
}: {
  frame: WowFrameSnapshot;
  rect: Rect;
  snapshot: WowSnapshot;
}) {
  const siblings = new Map<string, Rect>();

  const textures = frame.textures
    .map((id) => snapshot.textures[id])
    .filter((tex): tex is WowTextureSnapshot => Boolean(tex?.shown));

  const fontStrings = frame.fontStrings
    .map((id) => snapshot.fontStrings[id])
    .filter((fs): fs is WowFontStringSnapshot => Boolean(fs?.shown));

  const children = frame.childrenIds
    .map((id) => snapshot.frames[id])
    .filter((child): child is WowFrameSnapshot => Boolean(child?.shown));

  const style: React.CSSProperties = {
    position: 'absolute',
    left: rect.x,
    top: rect.y,
    width: rect.w,
    height: rect.h,
    opacity: frame.alpha,
    boxSizing: 'border-box',
  };

  if (frame.backdrop) {
    style.background = rgba(frame.backdrop.bgColor, 'rgba(12,16,24,0.95)');
    style.border = `1px solid ${rgba(frame.backdrop.borderColor, 'rgba(110,120,145,0.85)')}`;
    style.borderRadius = 6;
    style.boxShadow = '0 12px 34px rgba(0,0,0,0.55)';
  }

  const isScroll = frame.frameType === 'ScrollFrame';
  if (isScroll) {
    style.overflowY = 'auto';
    style.overflowX = 'hidden';
  }

  const isButton = frame.frameType === 'Button' || frame.frameType === 'CheckButton';
  if (isButton && !frame.backdrop) Object.assign(style, BUTTON_STYLE);

  const isEditBox = frame.frameType === 'EditBox';
  if (isEditBox) {
    style.background = 'rgba(8,11,18,0.95)';
    style.border = '1px solid rgba(120,135,160,0.7)';
    style.borderRadius = 4;
    style.display = 'flex';
    style.alignItems = 'center';
    style.padding = '0 8px';
    style.fontFamily = WOW_FONT_STACK;
    style.fontSize = 12;
    style.color = '#94a3b8';
    style.boxSizing = 'border-box';
  }

  return (
    <div style={style}>
      {textures.map((tex) => {
        const texRect = resolveRect(tex.points, tex.width, tex.height, { x: 0, y: 0, w: rect.w, h: rect.h }, siblings, frame.id);
        siblings.set(tex.id, texRect);
        return <TextureView key={tex.id} tex={tex} rect={texRect} />;
      })}

      {fontStrings.map((fs) => {
        const measured = measureWoWText(fs.text, fs.width ?? rect.w, fs.fontObject, fs.spacing, fs.wordWrap !== false);
        const fsRect = resolveRect(
          fs.points,
          fs.width ?? measured.width,
          fs.height ?? measured.height,
          { x: 0, y: 0, w: rect.w, h: rect.h },
          siblings,
          frame.id
        );
        siblings.set(fs.id, fsRect);
        return <FontStringView key={fs.id} fs={fs} rect={fsRect} />;
      })}

      {children
        .filter((child) => !(isScroll && frame.scrollChildId === child.id))
        .map((child) => {
          const childRect = resolveRect(child.points, child.width, child.height, { x: 0, y: 0, w: rect.w, h: rect.h }, siblings, frame.id);
          siblings.set(child.id, childRect);
          return <FrameView key={child.id} frame={child} rect={childRect} snapshot={snapshot} />;
        })}

      {isScroll && frame.scrollChildId
        ? (() => {
            const scrollChild = snapshot.frames[frame.scrollChildId];
            if (!scrollChild?.shown) return null;
            const childRect = {
              x: 0,
              y: 0,
              w: scrollChild.width ?? rect.w,
              h: scrollChild.height ?? rect.h,
            };
            return (
              <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden' }}>
                <div style={{ position: 'relative', width: childRect.w, height: childRect.h }}>
                  <FrameView frame={scrollChild} rect={childRect} snapshot={snapshot} />
                </div>
              </div>
            );
          })()
        : null}

      {isButton && (frame.text || frame.template === 'UIPanelCloseButton') ? (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <WowText
            text={frame.template === 'UIPanelCloseButton' && !frame.text ? '|cffff5555✕|r' : frame.text}
            defaultColor={BUTTON_STYLE.color as string}
          />
        </div>
      ) : null}

      {isEditBox && frame.text ? <span>{frame.text}</span> : null}
    </div>
  );
}

/** WoW 主窗口在插件里的固定尺寸 */
export const WOW_MAIN_FRAME_WIDTH = 800;
export const WOW_MAIN_FRAME_HEIGHT = 560;

/**
 * 把 Lua 渲染出的控件树还原成 DOM。
 * 缩放策略：按容器宽度等比缩放（保持游戏内 800×560 的比例与像素布局）。
 */
export function WowFrameView({ snapshot, rootName = 'WoWFMainFrame' }: { snapshot: WowSnapshot; rootName?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const width = el.clientWidth;
      if (width > 0) setScale(Math.min(1.35, width / WOW_MAIN_FRAME_WIDTH));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const root = Object.values(snapshot.frames).find((frame) => frame.name === rootName);

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <div
        style={{
          width: WOW_MAIN_FRAME_WIDTH * scale,
          height: WOW_MAIN_FRAME_HEIGHT * scale,
          position: 'relative',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            width: WOW_MAIN_FRAME_WIDTH,
            height: WOW_MAIN_FRAME_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'relative',
            background: 'radial-gradient(ellipse at top, #17253b 0%, #0b111e 65%, #05080f 100%)',
            borderRadius: 8,
            overflow: 'hidden',
            border: '1px solid rgba(120,140,170,0.25)',
          }}
        >
          {root ? (
            <FrameView
              frame={root}
              rect={{ x: 0, y: 0, w: WOW_MAIN_FRAME_WIDTH, h: WOW_MAIN_FRAME_HEIGHT }}
              snapshot={snapshot}
            />
          ) : (
            <div style={{ padding: 24, color: '#fca5a5', fontFamily: WOW_FONT_STACK }}>
              未找到 {rootName} 窗口，插件可能未正常渲染。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
