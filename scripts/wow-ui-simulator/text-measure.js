export function stripWoWFormatting(input) {
  if (!input) return '';
  return String(input)
    .replace(/\|n/g, '\n')
    .replace(/\|[cC][0-9a-fA-F]{8}/g, '')
    .replace(/\|[rR]/g, '')
    .replace(/\|H[^|]*\|h/g, '')
    .replace(/\|h/g, '')
    .replace(/\|T[^|]*\|t/g, '')
    .replace(/\|\|/g, '|');
}

function getCharWidthPx(ch, fontSize) {
  const code = ch.charCodeAt(0);
  if (
    (code >= 0x2e80 && code <= 0x9fff) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xff00 && code <= 0xffef)
  ) {
    return fontSize * 1.02;
  }
  if (ch === ' ') return fontSize * 0.35;
  if ('ilI.,:;\'!|'.includes(ch)) return fontSize * 0.32;
  if ('mwMW@#%&'.includes(ch)) return fontSize * 0.85;
  return fontSize * 0.56;
}

export function getFontSizeFromObject(fontObject = '') {
  const f = String(fontObject).toLowerCase();
  if (f.includes('huge') || f.includes('20')) return 18;
  if (f.includes('large') || f.includes('16')) return 14;
  if (f.includes('small') || f.includes('10')) return 11;
  return 12.5;
}

export function measureWoWText(rawText, maxWidth, fontObject = 'GameFontHighlight', spacing = 0, wordWrap = true) {
  const plain = stripWoWFormatting(rawText);
  if (!plain) return { width: 0, height: 0 };

  const fontSize = getFontSizeFromObject(fontObject);
  const lineHeight = fontSize * 1.38 + Math.max(0, spacing || 0);
  const paragraphs = plain.split('\n');

  let totalLines = 0;
  let maxLineWidth = 0;
  const wrapWidth = maxWidth && maxWidth > 10 && wordWrap ? maxWidth : Infinity;

  for (const para of paragraphs) {
    if (para.length === 0) {
      totalLines += 1;
      continue;
    }
    let curW = 0;
    let linesInPara = 1;
    for (let i = 0; i < para.length; i++) {
      const cw = getCharWidthPx(para[i], fontSize);
      if (curW + cw > wrapWidth && curW > 0) {
        maxLineWidth = Math.max(maxLineWidth, curW);
        linesInPara += 1;
        curW = cw;
      } else {
        curW += cw;
      }
    }
    maxLineWidth = Math.max(maxLineWidth, curW);
    totalLines += linesInPara;
  }

  return {
    width: Math.ceil(maxLineWidth),
    height: Math.ceil(totalLines * lineHeight),
  };
}
