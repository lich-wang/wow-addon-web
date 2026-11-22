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
  // 不再额外生成 QuestieDB/QuestieDB.toc 副本：这份 TOC 内嵌了 18 MB 的 Base64+CBOR 元数据，
  // 每多一份副本就要多压 ~8 MB，三份会把 zip 顶到 Cloudflare Pages 的 25 MiB 单文件上限
  // （实测 25.6 MiB 直接部署失败）。客户端按 flavor 选 Forever / Camelot，仓库内也没有读取
  // QuestieDB.toc 的代码，保留 Forever + Camelot 两份即可。
  const foreverToc = zip.file('QuestieDB/QuestieDB_Forever.toc');
  if (foreverToc) {
    const content = await foreverToc.async('string');
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
