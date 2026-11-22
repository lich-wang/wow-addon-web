// 无限服客户端（1.60.1）的 TOC 选择同时认 Camelot 与 Forever 两种 flavor 后缀。
// 2026-11 起上游 Questie / QuestieDB / QuestieTrace 的发行包先后不再附带 *_Camelot.toc，
// 而网页端安装器只覆盖写入、不删除旧文件，用户本地于是残留旧版 Camelot TOC，
// 形成「代码已是新版、TOC 还是旧版」的半更新状态：例如 12.10.0 的 Questie_Camelot.toc
// 缺 12.12.0 新增的 Modules\Map\ProfessionStations.lua，客户端按 Camelot 加载后
// QuestieMenu:OnLogin 访问 ProfessionStations.stations 即为 nil，初始化直接报错。
// 打包时把 Camelot TOC 补成与同期 Forever TOC 完全一致的副本，即可在下次更新时覆盖掉陈旧文件。
const CAMELOT_TOC_ALIASES = [
  ['Questie/Questie_Forever.toc', 'Questie/Questie_Camelot.toc'],
  ['QuestieTrace/QuestieTrace-Forever.toc', 'QuestieTrace/QuestieTrace-Camelot.toc'],
  ['QuestieDB/QuestieDB_Forever.toc', 'QuestieDB/QuestieDB_Camelot.toc'],
];

/**
 * 让 Camelot flavor 的 TOC 与对应 Forever TOC 保持字节级一致，缺失时补建、内容不同时覆盖
 * @param {import('jszip')} zip - 已完成 Questie / QuestieDB 合并与本地化补丁的压缩包
 * @returns {Promise<string[]>} 实际写入或更新的 TOC 路径
 */
export async function syncCamelotTocs(zip) {
  const synced = [];
  for (const [sourcePath, aliasPath] of CAMELOT_TOC_ALIASES) {
    const source = zip.file(sourcePath);
    if (!source) continue;
    const sourceBuf = await source.async('nodebuffer');
    const alias = zip.file(aliasPath);
    if (alias) {
      const aliasBuf = await alias.async('nodebuffer');
      if (aliasBuf.equals(sourceBuf)) continue;
    }
    zip.file(aliasPath, sourceBuf);
    synced.push(aliasPath);
  }
  return synced;
}

export async function patchQuestie(zip) {
  const tocFiles = [
    'Questie/Questie.toc',
    'Questie/Questie_Forever.toc',
    'Questie/Questie_Camelot.toc',
    'Questie/Questie_Vanilla.toc',
    'Questie/Questie_TBC.toc',
    'Questie/Questie_Wrath.toc',
    'Questie/Questie_Mists.toc',
  ];

  // 从上游 Forever TOC 读取真实版本号，避免在 Questie.toc 中手工写死版本
  let upstreamVersion = '';
  const foreverToc = zip.file('Questie/Questie_Forever.toc');
  if (foreverToc) {
    const m = (await foreverToc.async('string')).match(/^##\s*Version:\s*(.+?)\s*$/m);
    if (m) upstreamVersion = m[1].startsWith('v') ? m[1] : `v${m[1]}`;
  }

  for (const tocPath of tocFiles) {
    const f = zip.file(tocPath);
    if (!f) continue;
    let toc = await f.async('string');

    if (tocPath === 'Questie/Questie.toc') {
      // Make fallback Questie.toc friendly for addon scanners while keeping Forever/Classic metadata clean
      const titleVersion = upstreamVersion ? ` ${upstreamVersion}` : '';
      const versionLine = upstreamVersion ? `\n## Version: ${upstreamVersion} (Forever 专版)` : '';
      toc = toc
        .replace('## Interface: 00000', '## Interface: 16001')
        .replace(
          '## Title: Questie|cFFFF0000 game client not supported|r',
          `## Title: Questie|cFF00FF00${titleVersion}|r\n## Title-zhCN: |cff00ff00[任务]|r Questie Forever (全知地图任务雷达)${versionLine}\n## Author: Questie Team`
        )
        .replace('## Notes: Questie only supports Classic official servers.', '## Notes: A standalone Classic & Forever QuestHelper\n## Notes-zhCN: 魔兽世界无限服与怀旧服全知任务雷达！自动读取角色已完成任务并隐藏，智能过滤前置未解锁任务，在大地图与小地图精准标注可接任务、怪物刷新点与掉落归属。');
    } else if (!toc.includes('Title-zhCN')) {
      toc = toc
        .replace(/## Title: (.*)/, '## Title: $1\n## Title-zhCN: |cff00ff00[任务]|r Questie Forever (全知地图任务雷达)')
        .replace(/## Notes-zhCN: (.*)/, '## Notes-zhCN: 魔兽世界无限服与怀旧服全知任务雷达！自动读取角色已完成任务并隐藏，智能过滤前置未解锁任务，精准标注可接任务与怪物掉落。');
    }
    zip.file(tocPath, toc);
  }
}

export async function patchQuestieDB(zip) {
  const dbTocs = ['QuestieDB/QuestieDB_Forever.toc', 'QuestieDB/QuestieDB_Camelot.toc'];
  for (const tocPath of dbTocs) {
    const f = zip.file(tocPath);
    if (!f) continue;
    let toc = await f.async('string');
    if (!toc.includes('Title-zhCN')) {
      toc = toc
        .replace(/## Title: (.*)/, '## Title: $1\n## Title-zhCN: |cff00ff00[任务]|r QuestieDB (无限服任务数据库)')
        .replace(/## Notes: (.*)/, '## Notes: $1\n## Notes-zhCN: Questie 无限服专属离线任务、NPC、物体与全量中文数据库模块。');
      zip.file(tocPath, toc);
    }
  }
  // Also create QuestieDB/QuestieDB.toc metadata copy so scanners immediately find exact match
  const foreverToc = zip.file('QuestieDB/QuestieDB_Forever.toc');
  if (foreverToc) {
    const content = await foreverToc.async('string');
    if (!zip.file('QuestieDB/QuestieDB.toc')) {
      zip.file('QuestieDB/QuestieDB.toc', content);
    }
    // 将 QuestieDB 版本同步写入 Questie/Questie.toc 的 ## Version，确保本地扫描与版本清单一致
    const dbMatch = content.match(/^##\s*Version:\s*(.+?)\s*$/m);
    if (dbMatch) {
      const rawDbVer = dbMatch[1].replace(/-forever$/i, '').trim();
      const dbVer = rawDbVer.startsWith('v') ? rawDbVer : `v${rawDbVer}`;
      const mainTocFile = zip.file('Questie/Questie.toc');
      if (mainTocFile) {
        let mainToc = await mainTocFile.async('string');
        if (!/\bDB\s*v?\d+/i.test(mainToc)) {
          mainToc = mainToc.replace(
            /^(##\s*Version:\s*[^\r\n]+?)(\s*\(Forever 专版\))?\s*$/m,
            (_, prefix, suffix = '') => `${prefix} + DB ${dbVer}${suffix}`
          );
          zip.file('Questie/Questie.toc', mainToc);
        }
      }
    }
  }
}
