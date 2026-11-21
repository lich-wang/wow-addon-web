import { getFontSizeFromObject, measureWoWText } from './text-measure.js';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wowTextToHtml(input, defaultColor = '#ffffff') {
  if (!input) return '';
  const str = String(input).replace(/\|n/g, '\n');
  const stack = [defaultColor];
  let i = 0;
  let out = '';
  let inLink = false;

  while (i < str.length) {
    if (str[i] === '|' && i + 1 < str.length) {
      const code = str[i + 1];
      if ((code === 'c' || code === 'C') && i + 9 < str.length) {
        const hex = str.slice(i + 2, i + 10);
        if (/^[0-9a-fA-F]{8}$/.test(hex)) {
          stack.push('#' + hex.slice(2));
          i += 10;
          continue;
        }
      } else if (code === 'r' || code === 'R') {
        if (stack.length > 1) stack.pop();
        i += 2;
        continue;
      } else if (code === 'H') {
        const endH = str.indexOf('|h', i + 2);
        if (endH !== -1) {
          const payload = str.slice(i + 2, endH);
          out += `<span class="wow-link" title="${escapeHtml(payload)}" style="color:${stack[stack.length - 1]}">`;
          inLink = true;
          i = endH + 2;
          continue;
        }
      } else if (code === 'h') {
        if (inLink) {
          out += '</span>';
          inLink = false;
          i += 2;
          continue;
        }
      } else if (code === 'T') {
        const endT = str.indexOf('|t', i + 2);
        if (endT !== -1) {
          i = endT + 2;
          continue;
        }
      } else if (code === '|') {
        out += '|';
        i += 2;
        continue;
      }
    }
    const ch = str[i];
    if (ch === '\n') {
      out += '<br/>';
    } else {
      out += `<span style="color:${stack[stack.length - 1]}">${escapeHtml(ch)}</span>`;
    }
    i += 1;
  }
  if (inLink) out += '</span>';
  return out;
}

function getAnchorXY(rect, point) {
  let x = rect.x;
  if (point === 'TOP' || point === 'CENTER' || point === 'BOTTOM') x += rect.w / 2;
  else if (point === 'TOPRIGHT' || point === 'RIGHT' || point === 'BOTTOMRIGHT') x += rect.w;
  let y = rect.y;
  if (point === 'LEFT' || point === 'CENTER' || point === 'RIGHT') y += rect.h / 2;
  else if (point === 'BOTTOMLEFT' || point === 'BOTTOM' || point === 'BOTTOMRIGHT') y += rect.h;
  return { x, y };
}

function resolvePointsToRect(points, ownW, ownH, parentRect, siblingRects, parentId) {
  if (!points || points.length === 0) {
    return { x: 0, y: 0, w: ownW ?? parentRect.w, h: ownH ?? parentRect.h };
  }
  let left = null, right = null, top = null, bottom = null, centerX = null, centerY = null;
  for (const pt of points) {
    const isParent = !pt.relativeToId || pt.relativeToId === parentId;
    const relRect = isParent
      ? { x: 0, y: 0, w: parentRect.w, h: parentRect.h }
      : siblingRects.get(pt.relativeToId) ?? { x: 0, y: 0, w: parentRect.w, h: parentRect.h };
    const relAnchor = getAnchorXY(relRect, pt.relativePoint);
    const targetX = relAnchor.x + pt.x;
    const targetY = relAnchor.y - pt.y;
    if (pt.point === 'TOPLEFT' || pt.point === 'LEFT' || pt.point === 'BOTTOMLEFT') left = targetX;
    if (pt.point === 'TOPRIGHT' || pt.point === 'RIGHT' || pt.point === 'BOTTOMRIGHT') right = targetX;
    if (pt.point === 'TOP' || pt.point === 'CENTER' || pt.point === 'BOTTOM') centerX = targetX;
    if (pt.point === 'TOPLEFT' || pt.point === 'TOP' || pt.point === 'TOPRIGHT') top = targetY;
    if (pt.point === 'BOTTOMLEFT' || pt.point === 'BOTTOM' || pt.point === 'BOTTOMRIGHT') bottom = targetY;
    if (pt.point === 'LEFT' || pt.point === 'CENTER' || pt.point === 'RIGHT') centerY = targetY;
  }
  let w = ownW ?? 100, h = ownH ?? 24, x = 0, y = 0;
  if (left !== null && right !== null) { x = left; w = Math.max(0, right - left); }
  else if (left !== null) x = left;
  else if (right !== null) x = right - w;
  else if (centerX !== null) x = centerX - w / 2;

  if (top !== null && bottom !== null) { y = top; h = Math.max(0, bottom - top); }
  else if (top !== null) y = top;
  else if (bottom !== null) y = bottom - h;
  else if (centerY !== null) y = centerY - h / 2;
  return { x, y, w, h };
}

function rgba(arr, fallback) {
  if (!arr) return fallback;
  return `rgba(${Math.round((arr[0] ?? 0) * 255)},${Math.round((arr[1] ?? 0) * 255)},${Math.round((arr[2] ?? 0) * 255)},${arr[3] ?? 1})`;
}

function renderFrameHtml(frameId, rect, snapshot, isScrollChild = false) {
  const frame = snapshot.frames[frameId];
  if (!frame || !frame.shown) return '';

  const siblingRects = new Map();
  let inner = '';

  for (const tid of frame.textures) {
    const tex = snapshot.textures[tid];
    if (!tex || !tex.shown) continue;
    const tr = resolvePointsToRect(tex.points, tex.width, tex.height, rect, siblingRects, frame.id);
    siblingRects.set(tex.id, tr);
    const bg = tex.colorTexture ? rgba(tex.colorTexture, 'transparent') : 'transparent';
    inner += `<div style="position:absolute;left:${tr.x}px;top:${tr.y}px;width:${tr.w}px;height:${tr.h}px;background:${bg};opacity:${tex.alpha};pointer-events:none"></div>`;
  }

  for (const fid of frame.fontStrings) {
    const fs = snapshot.fontStrings[fid];
    if (!fs || !fs.shown) continue;
    const measured = measureWoWText(fs.text, fs.width ?? rect.w, fs.fontObject, fs.spacing, fs.wordWrap);
    const fr = resolvePointsToRect(fs.points, fs.width ?? measured.width, fs.height ?? measured.height, rect, siblingRects, frame.id);
    siblingRects.set(fs.id, fr);
    const fontSize = getFontSizeFromObject(fs.fontObject);
    const lineH = fontSize * 1.38 + Math.max(0, fs.spacing || 0);
    const align = fs.justifyH === 'CENTER' ? 'center' : fs.justifyH === 'RIGHT' ? 'right' : 'left';
    inner += `<div style="position:absolute;left:${fr.x}px;top:${fr.y}px;width:${fr.w}px;min-height:${fr.h}px;font-size:${fontSize}px;line-height:${lineH}px;text-align:${align};white-space:${fs.wordWrap ? 'pre-wrap' : 'nowrap'};word-break:break-word;opacity:${fs.alpha}">${wowTextToHtml(fs.text, rgba(fs.color, '#ffffff'))}</div>`;
  }

  for (const cid of frame.childrenIds) {
    const child = snapshot.frames[cid];
    if (!child || !child.shown) continue;
    if (frame.frameType === 'ScrollFrame' && frame.scrollChildId === cid) continue;
    const cr = resolvePointsToRect(child.points, child.width, child.height, rect, siblingRects, frame.id);
    siblingRects.set(child.id, cr);
    inner += renderFrameHtml(child.id, cr, snapshot, false);
  }

  if (frame.frameType === 'ScrollFrame' && frame.scrollChildId) {
    const sc = snapshot.frames[frame.scrollChildId];
    if (sc && sc.shown) {
      const scr = { x: 0, y: 0, w: sc.width ?? rect.w, h: sc.height ?? rect.h };
      inner += renderFrameHtml(sc.id, scr, snapshot, true);
    }
  }

  if (frame.frameType === 'Button') {
    const label = frame.template === 'UIPanelCloseButton' ? '✕' : wowTextToHtml(frame.text, '#fde68a');
    inner += `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;padding:0 6px;box-sizing:border-box">${label}</div>`;
  } else if (frame.frameType === 'EditBox') {
    inner += `<div style="width:100%;height:100%;display:flex;align-items:center;padding:0 8px;font-size:12px;color:#cbd5e1;box-sizing:border-box">${escapeHtml(frame.text || '搜索...')}</div>`;
  }

  let style = `position:${isScrollChild ? 'relative' : 'absolute'};left:${isScrollChild ? 0 : rect.x}px;top:${isScrollChild ? 0 : rect.y}px;width:${rect.w}px;height:${rect.h}px;opacity:${frame.alpha};z-index:${frame.frameLevel};box-sizing:border-box;`;
  if (frame.frameType === 'ScrollFrame') {
    style += 'overflow-y:auto;overflow-x:hidden;';
  }
  if (frame.backdrop) {
    style += `background:${rgba(frame.backdrop.bgColor, 'rgba(14,18,28,0.92)')};border:1px solid ${rgba(frame.backdrop.borderColor, 'rgba(110,120,145,0.85)')};border-radius:6px;`;
  } else if (frame.frameType === 'Button') {
    style += frame.name === 'WoWFMinimapButton'
      ? 'background:#0f172a;border:2px solid #eab308;border-radius:9999px;'
      : 'background:linear-gradient(180deg,#6e1a1a,#441010);border:1px solid rgba(196,154,69,0.75);border-radius:4px;';
  } else if (frame.frameType === 'EditBox') {
    style += 'background:rgba(8,11,18,0.95);border:1px solid rgba(120,135,160,0.7);border-radius:4px;';
  }

  return `<div data-name="${escapeHtml(frame.name || '')}" style="${style}">${inner}</div>`;
}

export function generateHtmlReport(captures) {
  const sections = captures
    .map((cap, idx) => {
      const uiParent = Object.values(cap.snapshot.frames).find((f) => f.name === 'UIParent');
      const viewportW = uiParent?.width ?? 1280;
      const viewportH = uiParent?.height ?? 720;
      const treeHtml = uiParent ? renderFrameHtml(uiParent.id, { x: 0, y: 0, w: viewportW, h: viewportH }, cap.snapshot) : '';
      const errCount = cap.snapshot.luaErrors.length;
      const errHtml = errCount > 0
        ? `<div class="err-box">${cap.snapshot.luaErrors.map((e) => `<div>[${escapeHtml(e.source)}] ${escapeHtml(e.message)}</div>`).join('')}</div>`
        : '<div class="ok-badge">0 Lua Errors</div>';
      return `
      <section class="capture">
        <div class="cap-header">
          <h2>#${idx + 1} ${escapeHtml(cap.label)}</h2>
          ${errHtml}
        </div>
        <div class="viewport" style="width:${viewportW}px;height:${viewportH}px">${treeHtml}</div>
      </section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>WoW UI Simulator 测试报告</title>
<style>
  body { margin: 0; padding: 24px; background: #090d16; color: #e2e8f0; font-family: "Microsoft YaHei", system-ui, sans-serif; }
  h1 { color: #fbbf24; font-size: 20px; margin: 0 0 16px; }
  .capture { margin-bottom: 36px; }
  .cap-header { display: flex; align-items: center; gap: 16px; margin-bottom: 10px; }
  .cap-header h2 { font-size: 16px; margin: 0; color: #38bdf8; }
  .ok-badge { font-size: 12px; color: #34d399; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.35); padding: 2px 8px; border-radius: 999px; }
  .err-box { font-size: 12px; color: #fda4af; background: rgba(244,63,94,0.12); border: 1px solid rgba(244,63,94,0.4); padding: 6px 10px; border-radius: 6px; font-family: monospace; }
  .viewport { position: relative; border: 1px solid #334155; border-radius: 10px; overflow: hidden; background: radial-gradient(ellipse at top, #17253b 0%, #0b111e 65%, #05080f 100%); box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
  .wow-link { text-decoration: underline; cursor: pointer; }
</style>
</head>
<body>
  <h1>WoW UI Simulator 渲染测试报告</h1>
  ${sections}
</body>
</html>`;
}
