import JSZip from 'jszip';
import type { InstallProgress } from '../types/addon';

export interface WoWFLiveNewsItem {
  date: string;
  title: string;
  summary: string;
  href: string;
}

/**
 * 将字符串转义为安全的 Lua 双引号字面量
 */
function escapeLuaString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n');
}

/**
 * 解析 wowf.io/zh/news HTML 提取最新热修与官方公告
 */
function parseLiveNewsHtml(html: string): WoWFLiveNewsItem[] {
  const articles: WoWFLiveNewsItem[] = [];
  const linkRegex = /<a[^>]+href="(\/zh\/news\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null && articles.length < 8) {
    const href = `https://wowf.io${match[1]}`;
    const rawText = match[2]
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
    if (!rawText || rawText.length < 10) continue;

    const dateMatch = rawText.match(/(\d{4}年\d{1,2}月\d{1,2}日(?:\s*\d{1,2}:\d{2})?)/);
    const date = dateMatch ? dateMatch[1] : '最新公告';
    const cleaned = rawText
      .replace(/^Blizzard\s*公告\s*/i, '')
      .replace(dateMatch ? dateMatch[0] : '', '')
      .replace(/UTC\+8/g, '')
      .trim();
    const parts = cleaned.split(/\s{2,}|\s*\|\s*/);
    const title = parts[0] ? parts[0].slice(0, 60) : cleaned.slice(0, 50);
    const summary = cleaned.length > title.length ? cleaned.slice(title.length).trim() : cleaned;
    if (title && !articles.some((a) => a.title === title)) {
      articles.push({ date, title, summary: summary || title, href });
    }
  }

  return articles;
}

/**
 * 从新闻列表中提取最新的 YYYY.MM.DD 数据库版本标签
 */
function extractDbVersionFromNews(news: WoWFLiveNewsItem[]): string | null {
  if (news.length === 0) return null;
  const firstDate = news[0].date || '';
  const zhMatch = firstDate.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (zhMatch) {
    return `${zhMatch[1]}.${Number(zhMatch[2])}.${Number(zhMatch[3])}`;
  }
  const isoMatch = firstDate.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}.${Number(isoMatch[2])}.${Number(isoMatch[3])}`;
  }
  return null;
}

/**
 * 安装或更新 巫妖王的无限百科 时，通过 /api/proxy 动态拉取 https://wowf.io 最新热修与元数据，
 * 实时注入到压缩包内的 WoWF/Data.lua 中，确保玩家装入游戏的数据与网站同步。
 * 若网络离线或超时则无感回退至内置离线包。
 */
export async function syncWoWFZipWithLiveWebsite(
  zipBuffer: ArrayBuffer,
  onProgress?: (p: InstallProgress) => void
): Promise<ArrayBuffer> {
  try {
    onProgress?.({
      status: 'downloading',
      addonName: '巫妖王的无限百科',
      percent: 40,
      message: '正在从 https://wowf.io/zh 实时同步最新热修与百科数据...',
    });

    const proxyBase = '/api/proxy?url=';
    const newsUrl = `${proxyBase}${encodeURIComponent('https://wowf.io/zh/news')}`;
    const res = await fetch(newsUrl, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) {
      return zipBuffer;
    }

    const html = await res.text();
    const liveNews = parseLiveNewsHtml(html);
    if (liveNews.length === 0) {
      return zipBuffer;
    }

    const zip = await JSZip.loadAsync(zipBuffer);
    const dataFile = zip.file('WoWF/Data.lua');
    if (!dataFile) {
      return zipBuffer;
    }

    let dataLua = await dataFile.async('string');
    const liveDbVersion = extractDbVersionFromNews(liveNews);
    const newsLuaItems = liveNews
      .map(
        (n) =>
          `    {\n      date = "${escapeLuaString(n.date)}",\n      title = "${escapeLuaString(n.title)}",\n      summary = "${escapeLuaString(n.summary)}",\n      href = "${escapeLuaString(n.href)}"\n    }`
      )
      .join(',\n');

    const liveOverridePatch = `\n-- Live website sync injected at install time from https://wowf.io/zh\nif WoWF_Data then\n  WoWF_Data.news = {\n${newsLuaItems}\n  }\n  if WoWF_Data.meta then\n    WoWF_Data.meta.updatedAt = "${escapeLuaString(liveDbVersion ? liveDbVersion.replace(/\./g, '-') : new Date().toISOString().slice(0, 10))}"\n  end\nend\n`;

    dataLua = dataLua + liveOverridePatch;
    zip.file('WoWF/Data.lua', dataLua);

    return await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  } catch {
    // 离线或跨域代理不可用时安全回退到预打包产物
    return zipBuffer;
  }
}
