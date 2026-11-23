/** 文本测量工具的类型声明（实现见 text-measure.js） */

export function stripWoWFormatting(input: string): string;

export function getFontSizeFromObject(fontObject?: string): number;

export function measureWoWText(
  rawText: string,
  maxWidth?: number | null,
  fontObject?: string,
  spacing?: number,
  wordWrap?: boolean
): { width: number; height: number };
