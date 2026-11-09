export async function patchBtWQuests(zip) {
  // 1. Patch BtWQuests/Localization.zhCN.lua for any missing keys
  const zhFile = zip.file('BtWQuests/Localization.zhCN.lua');
  if (zhFile) {
    let zh = await zhFile.async('string');
    const additions = [];
    if (!zh.includes('L["BTWQUESTS_PINNED"]')) {
      additions.push('L["BTWQUESTS_PINNED"] = "已固定"');
    }
    if (!zh.includes('L["BTWQUESTS_TOOLTIP_PREREQUISITES_MORE"]')) {
      additions.push('L["BTWQUESTS_TOOLTIP_PREREQUISITES_MORE"] = "前置要求：（按住 Shift 显示更多）"');
    }
    if (!zh.includes('L["GROUP_PINNED"]')) {
      additions.push('L["GROUP_PINNED"] = "按已固定分组"');
    }
    if (additions.length > 0) {
      zh = zh.trimEnd() + '\n' + additions.join('\n') + '\n';
      zip.file('BtWQuests/Localization.zhCN.lua', zh);
    }
  }

  // 2. Patch BtWQuests/BtWQuests.toc
  const mainToc = zip.file('BtWQuests/BtWQuests.toc');
  if (mainToc) {
    let toc = await mainToc.async('string');
    if (!toc.includes('Title-zhCN')) {
      toc = toc
        .replace(/## Title: (.*)/, '## Title: $1\n## Title-zhCN: |cff00ff00[任务]|r BtWQuests (任务链与前置流程图)')
        .replace(/## Notes: (.*)/, '## Notes: Visual quest chain and prerequisite tree viewer.\n## Notes-zhCN: 可视化任务链与前置条件追溯神器！以科技树流程图形式展示所有主支线脉络，自动同步角色已完成节点并打钩，点击即可导航续接断档任务。');
      zip.file('BtWQuests/BtWQuests.toc', toc);
    }
  }

  // 3. Patch BtWQuestsClassic/BtWQuestsClassic.toc
  const classicToc = zip.file('BtWQuestsClassic/BtWQuestsClassic.toc');
  if (classicToc) {
    let toc = await classicToc.async('string');
    if (!toc.includes('Title-zhCN')) {
      toc = toc
        .replace(/## Title: (.*)/, '## Title: $1\n## Title-zhCN: |cff00ff00[任务]|r BtWQuests: Classic (经典与无限服任务库)')
        .replace(/## Notes: (.*)/, '## Notes: $1\n## Notes-zhCN: BtWQuests 经典旧世与无限服（含泽风岛等新区域）完整任务链数据库模块。');
      zip.file('BtWQuestsClassic/BtWQuestsClassic.toc', toc);
    }
  }
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

  for (const tocPath of tocFiles) {
    const f = zip.file(tocPath);
    if (!f) continue;
    let toc = await f.async('string');

    if (tocPath === 'Questie/Questie.toc') {
      // Make fallback Questie.toc friendly for addon scanners while keeping Forever/Classic metadata clean
      toc = toc
        .replace('## Interface: 00000', '## Interface: 16001')
        .replace('## Title: Questie|cFFFF0000 game client not supported|r', '## Title: Questie|cFF00FF00 v12.6.4|r\n## Title-zhCN: |cff00ff00[任务]|r Questie Forever (全知地图任务雷达)\n## Version: v12.6.4 (Forever 专版)\n## Author: Questie Team')
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
        .replace(/## Title: (.*)/, '## Title: $1\n## Title-zhCN: |cff00ff00[任务]|r QuestieDB (无限服任务数据库)\n## Version: v1.0.13-Forever')
        .replace(/## Notes: (.*)/, '## Notes: $1\n## Notes-zhCN: Questie 无限服专属离线任务、NPC、物体与全量中文数据库模块。');
      zip.file(tocPath, toc);
    }
  }
  // Also create QuestieDB/QuestieDB.toc metadata copy so scanners immediately find exact match
  const foreverToc = zip.file('QuestieDB/QuestieDB_Forever.toc');
  if (foreverToc && !zip.file('QuestieDB/QuestieDB.toc')) {
    const content = await foreverToc.async('string');
    zip.file('QuestieDB/QuestieDB.toc', content);
  }
}
