/**
 * 生成「魔兽无限」新增第三方声望的任务快照（scripts/locales/wowf-reputation-data.json）。
 *
 * 数据源：无限图鉴 https://wuxianwow.com/data/factions.json 与 quests.json（国服 1.60 客户端）。
 * 只收录 1.60 新增/新增第三方的 16 个阵营；按阵营汇总所有给该阵营声望的任务，
 * 供 WoWF 插件的「声望」页签按角色等级/声望/完成状态过滤展示。
 *
 * 重新生成：node scripts/generate-reputation-data.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'locales/wowf-reputation-data.json');
const QUEST_URL = 'https://wuxianwow.com/data/quests.json';
const FACTION_URL = 'https://wuxianwow.com/data/factions.json';

// 16 个新增第三方声望：贸易局/补给后勤部 + 1.60 新阵营
const TARGET_IDS = [
  2586, 2587, 2719, 2740, 2747, 2758, 2765, 2778, 2779,
  2782, 2787, 2798, 2799, 2819, 2826, 2827,
];

const GUIDES = {
  2586: {
    summary:
      '联盟侧贸易声望：把遭劫的板条箱交给主城与赤脊山的后勤官员，或完成各专业「工匠文书」；友善可换 12 格包与绿装配方，尊敬换 16 格包与蓝装图纸。',
    sources: ['上交遭劫的板条箱（空箱或填入对应专业制造品）', '各专业「工匠文书」可重复上交（+75/125/200）', '少量野外任务（如「蝎盐」）'],
  },
  2587: {
    summary:
      '部落侧贸易声望：把遭劫的板条箱交给主城与杜隆塔尔的补给官员，或完成各专业「工匠文书」；友善可换 12 格包与绿装配方，尊敬换 16 格包与蓝装图纸。',
    sources: ['上交遭劫的板条箱（空箱或填入对应专业制造品）', '各专业「工匠文书」可重复上交（+75/125/200）', '少量野外任务'],
  },
  2719: {
    summary: '塞纳里奥议会的新声望，主要靠塞纳里奥相关任务与物品上交；目前客户端没有独立任务链数据。',
    sources: ['塞纳里奥相关任务', '物品上交'],
  },
  2740: {
    summary: '达拉然法师阵营；任务从暴风城/泽风岛开始，延伸到达拉然与各副本，友善可买裁缝、制皮、锻造图纸与战袍。',
    sources: ['暴风城/泽风岛入门任务', '达拉然与各副本任务', '副本任务与物品上交'],
  },
  2747: {
    summary: '海加尔山熊怪，初始敌对；完成海加尔山任务/击杀恢复声望，主要奖励为专业图纸与玩具。',
    sources: ['海加尔山任务线', '击杀/上交恢复声望'],
  },
  2758: {
    summary: '泽风岛影风森林的德鲁伊；任务集中在泽风岛，友善可买各专业入门图纸，崇敬宠物、崇拜披风。',
    sources: ['泽风岛任务线', '影风森林日常/支线'],
  },
  2765: {
    summary: '海加尔山守护者；完成海加尔山任务/上交，崇敬可换复苏种荚，崇拜战袍。',
    sources: ['海加尔山任务线', '物品上交'],
  },
  2778: {
    summary: '部落天裔萨满阵营；泽风岛任务线，友善可换各专业配方。',
    sources: ['泽风岛任务线', '瓦拉纳尔相关任务'],
  },
  2779: {
    summary: '联盟天裔奥术阵营；泽风岛任务线，友善可换各专业配方。',
    sources: ['泽风岛任务线', '瓦拉纳尔相关任务'],
  },
  2782: {
    summary: '暮光之锤流放者组成的部落阵营；任务线集中在相关新区域，奖励以装备/配方为主。',
    sources: ['新区域任务线', '击杀/上交'],
  },
  2787: {
    summary: '部落萨满/德鲁伊阵营；任务与上交，友善可换各专业配方；声望上限 12,500（尊敬）。',
    sources: ['部落萨满/德鲁伊任务', '物品上交'],
  },
  2798: {
    summary: '暗矛群岛 PvP 阵营；击杀塞拉摩远征军/上交/战场，奖励饰品、戒指、武器与战袍。',
    sources: ['暗矛群岛 PvP 击杀与上交', '战场/日常'],
  },
  2799: {
    summary: '塞拉摩远征军（联盟）；与暗矛突袭者对立，奖励同类装备。',
    sources: ['暗矛群岛 PvP 击杀与上交', '战场/日常'],
  },
  2819: {
    summary: '暗夜精灵狱卒阵营；目前无独立任务链数据，主要靠相关任务/击杀。',
    sources: ['相关任务', '击杀'],
  },
  2826: {
    summary: '联盟新阵营（河林/东部海岸）；任务线较长，声望任务遍布多个区域。',
    sources: ['河林/东部海岸任务线', '副本任务'],
  },
  2827: {
    summary: '热砂集团新港口；河林任务线，友善/尊敬/崇敬可换装备与玩具。',
    sources: ['河林任务线', '港口相关支线'],
  },
};

const SIDE_MAP = { 联盟: 'alliance', 部落: 'horde' };

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'WoWF-reputation-data/1.0' },
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

function factionSide(side) {
  return SIDE_MAP[side] || 'both';
}

function questSide(q) {
  const raw = q.side || (q.tmp && q.tmp.side) || '';
  return SIDE_MAP[raw] || null;
}

function itemList(q) {
  return (q.goals || [])
    .filter(g => g.type === 'item' && g.id)
    .map(g => ({ id: g.id, name: g.name || '', count: g.n || 1 }));
}

function rewardGroups(faction) {
  const groups = new Map();
  for (const reward of faction.rewards || []) {
    const standing = reward.standing || '其他';
    if (!groups.has(standing)) groups.set(standing, []);
    groups.get(standing).push({ id: reward.item_id, name: reward.name });
  }
  const order = ['友善', '尊敬', '崇敬', '崇拜'];
  return order
    .filter(s => groups.has(s))
    .map(s => ({ standing: s, items: groups.get(s).slice(0, 4), total: groups.get(s).length }));
}

function buildQuests(allQuests, faction) {
  const fid = faction.id;
  const list = [];
  for (const q of allQuests) {
    const reps = q.reward && Array.isArray(q.reward.rep) ? q.reward.rep : [];
    const own = reps.find(r => Number(r.id) === fid);
    if (!own) continue;
    const side = questSide(q);
    if (side && factionSide(faction.side) !== 'both' && side !== factionSide(faction.side)) continue;
    const otherRep = reps
      .filter(r => Number(r.id) !== fid && TARGET_IDS.includes(Number(r.id)))
      .map(r => ({ id: Number(r.id), n: Number(r.n) || 0 }));
    list.push({
      id: q.id,
      name: q.name || q.title || `任务 #${q.id}`,
      level: Number(q.level) || 0,
      minLevel: Number(q.min_level) || 1,
      zone: q.zone && q.zone.name ? q.zone.name : '',
      side,
      rep: Number(own.n) || 0,
      otherRep,
      items: itemList(q),
      repeatable: /^工匠文书[:：]/.test(q.name || ''),
      kind: /^工匠文书[:：]/.test(q.name || '') ? 'writ' : 'quest',
    });
  }
  // 不做同名去重：任务链里不同步骤可能同名（如「肯瑞托」多步），只在渲染时按任务 ID 去重
  return list.sort((a, b) => a.minLevel - b.minLevel || a.level - b.level || a.id - b.id);
}

async function main() {
  console.log('[reputation] fetching wuxianwow data...');
  const [questsDoc, factionsDoc] = await Promise.all([fetchJson(QUEST_URL), fetchJson(FACTION_URL)]);
  const allQuests = Array.isArray(questsDoc.quests) ? questsDoc.quests : [];
  const factions = new Map((factionsDoc.factions || []).map(f => [Number(f.id), f]));

  const outFactions = [];
  for (const fid of TARGET_IDS) {
    const faction = factions.get(fid);
    if (!faction) {
      console.warn(`[reputation] faction ${fid} not found`);
      continue;
    }
    const guide = GUIDES[fid] || {};
    const quests = buildQuests(allQuests, faction);
    outFactions.push({
      id: fid,
      name: faction.name,
      side: factionSide(faction.side),
      category: faction.category || '',
      baseStanding: faction.base_standing || '中立',
      max: Number(faction.max) || 42999,
      summary: guide.summary || faction.desc || '',
      sources: guide.sources || [],
      rewards: rewardGroups(faction),
      quests,
    });
    console.log(`[reputation] ${fid} ${faction.name}: ${quests.length} quests`);
  }

  const output = {
    _meta: {
      source: '无限图鉴 wuxianwow.com（国服 1.60.1.71037）',
      generatedAt: new Date().toISOString().slice(0, 10),
      note: '16 个新增第三方声望的声望任务快照；由 scripts/generate-reputation-data.mjs 生成。',
    },
    factions: outFactions,
  };
  fs.writeFileSync(OUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`[reputation] wrote ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
