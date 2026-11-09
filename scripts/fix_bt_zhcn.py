# -*- coding: utf-8 -*-
"""
Blackthornes Tradeskills - Simplified Chinese (zhCN) targeted fixes
Applies only genuine mistranslation/untranslated fixes on top of upstream Locale/zhCN.lua.
"""
import re
import os
import zipfile
import shutil
import tempfile

BT_ZH_PATH = 'scripts/locales/bt_zhCN.lua'
GAME_ZH_PATH = 'C:/Program Files (x86)/World of Warcraft/_forever_/Interface/AddOns/Blackthornes_TS/Locale/zhCN.lua'

def decode_lua_str(s):
    res = []
    i = 0
    n = len(s)
    while i < n:
        if s[i] == '\\' and i + 1 < n:
            c = s[i+1]
            if c == 'n': res.append('\n'); i += 2
            elif c == 'r': res.append('\r'); i += 2
            elif c == 't': res.append('\t'); i += 2
            elif c == '"': res.append('"'); i += 2
            elif c == "'": res.append("'"); i += 2
            elif c == '\\': res.append('\\'); i += 2
            else: res.append(c); i += 2
        else:
            res.append(s[i])
            i += 1
    return "".join(res)

def encode_lua_str(s):
    res = []
    for c in s:
        if c == '\\': res.append('\\\\')
        elif c == '"': res.append('\\"')
        elif c == '\n': res.append('\\n')
        elif c == '\r': res.append('\\r')
        elif c == '\t': res.append('\\t')
        else: res.append(c)
    return '"' + "".join(res) + '"'

CURATED = {
    # 1. Mistranslated "Made for" (Logic/CraftedCost.lua:260 - precedes money cost, not character name)
    "Made for": "制造成本",
    # 2. Mistranslated "Artisan" (Classic 225-300 is 大师级, matching "an Artisan trainer" = "一位大师级训练师")
    "Train Artisan %s": "学习大师级%s",
    "Learn Artisan %s": "学习大师级%s",
    "Start with %s in %s. Catch the four rare fish he asks for. Then he teaches you Artisan %s.": "先去%2$s找%1$s。钓到他要的四条稀有鱼。然后他会教你大师级%3$s。",
    # 3. Untranslated punctuation in Disenchant chat output
    "%s %s: %s%s. %s.": "%s %s：%s%s。%s。",
    # 4. Untranslated English strings for Waylaid Crates / Craftsman's Writs / Merchant's Favor / Supply Officer
    "Deals: Craftsman's Writs": "划算货：工匠文书",
    "Craftsman's Writ: %s": "工匠文书：%s",
    "Craftsman's Writs": "工匠文书",
    "Deals: Merchant's Favor": "划算货：商人的青睐",
    "Merchant's Favor": "商人的青睐",
    "Waylaid Crate: %s": "遭劫的货物：%s",
    "WAYLAID CRATE": "遭劫的货物",
    "All bought. Fill the crates and take them to the Supply Officer.": "都买好了。装满箱子，交给军需官。",
    # 5. Enchanting material fallback names (when client item cache hasn't seen them yet)
    "Strange Dust": "奇异之尘",
    "Soul Dust": "灵魂之尘",
    "Vision Dust": "幻象之尘",
    "Dream Dust": "梦境之尘",
    "Illusion Dust": "幻影之尘",
    "Lesser Magic Essence": "次级魔法精华",
    "Greater Magic Essence": "强效魔法精华",
    "Lesser Astral Essence": "次级星界精华",
    "Greater Astral Essence": "强效星界精华",
    "Lesser Mystic Essence": "次级秘法精华",
    "Greater Mystic Essence": "强效秘法精华",
    "Lesser Nether Essence": "次级虚空精华",
    "Greater Nether Essence": "强效虚空精华",
    "Lesser Eternal Essence": "次级不灭精华",
    "Greater Eternal Essence": "强效不灭精华",
    "Small Glimmering Shard": "小块微光碎片",
    "Large Glimmering Shard": "大块微光碎片",
    "Small Glowing Shard": "小块闪光碎片",
    "Large Glowing Shard": "大块闪光碎片",
    "Small Radiant Shard": "小块强光碎片",
    "Large Radiant Shard": "大块强光碎片",
    "Small Brilliant Shard": "小块魔光碎片",
    "Large Brilliant Shard": "大块魔光碎片",
    "Nexus Crystal": "连结水晶",
}

BASE_SRC_PATH = "scripts/locales/v119_upstream_zhCN.lua" if os.path.exists("scripts/locales/v119_upstream_zhCN.lua") else BT_ZH_PATH
with open(BASE_SRC_PATH, 'r', encoding='utf-8') as f:
    raw_content = f.read()

pattern = re.compile(r'L\["((?:[^"\\]|\\.)*)"\]\s*=\s*"((?:[^"\\]|\\.)*)"')
entries = []
for m in pattern.finditer(raw_content):
    k = decode_lua_str(m.group(1))
    v = decode_lua_str(m.group(2))
    entries.append((k, v))

out_lines = [
    '-- Blackthornes Tradeskills -- Locale/zhCN.lua',
    '-- 简体中文 (Simplified Chinese)',
    '',
    'local _, ns = ...',
    'local L = ns.L',
    ''
]

changed_count = 0
seen = set()

for k, old_v in entries:
    if k in seen:
        continue
    seen.add(k)
    new_v = CURATED.get(k, old_v)
    if new_v != old_v:
        changed_count += 1
    out_lines.append(f'L[{encode_lua_str(k)}] = {encode_lua_str(new_v)}')

for k, v in CURATED.items():
    if k not in seen:
        seen.add(k)
        out_lines.append(f'L[{encode_lua_str(k)}] = {encode_lua_str(v)}')
        changed_count += 1

final_text = '\n'.join(out_lines) + '\n'

with open(BT_ZH_PATH, 'w', encoding='utf-8') as f:
    f.write(final_text)
print(f"Updated {BT_ZH_PATH}: {len(seen)} total entries ({changed_count} targeted fixes + material fallbacks).")

if os.path.exists(os.path.dirname(GAME_ZH_PATH)):
    with open(GAME_ZH_PATH, 'w', encoding='utf-8') as f:
        f.write(final_text)
    print(f"Updated game directory: {GAME_ZH_PATH}")

for zip_path in ["public/addons/blackthornes-tradeskills.zip", "dist/addons/blackthornes-tradeskills.zip"]:
    if os.path.exists(zip_path):
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".zip")
        os.close(tmp_fd)
        replaced = False
        with zipfile.ZipFile(zip_path, 'r') as zin, zipfile.ZipFile(tmp_path, 'w', zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                norm_name = item.filename.replace('\\', '/')
                if norm_name == 'Blackthornes_TS/Locale/zhCN.lua':
                    zout.writestr(item, final_text.encode('utf-8'))
                    replaced = True
                elif norm_name == 'Blackthornes_TS/Logic/Disenchant.lua':
                    de_raw = zin.read(item.filename).decode('utf-8')
                    de_raw = re.sub(
                        r'for _, material in ipairs\(Disenchant\.MATERIALS\) do\r?\n\s*MATERIAL_NAME\[material\.itemID\] = material\.name\r?\nend',
                        'for _, material in ipairs(Disenchant.MATERIALS) do\n    material.name = L[material.name]\n    MATERIAL_NAME[material.itemID] = material.name\nend',
                        de_raw
                    )
                    de_raw = re.sub(
                        r'function Disenchant:MaterialName\(itemID\)\r?\n\s*return MATERIAL_NAME\[itemID\]\r?\nend',
                        'function Disenchant:MaterialName(itemID)\n    return MATERIAL_NAME[itemID] and self:ItemName(itemID) or nil\nend',
                        de_raw
                    )
                    zout.writestr(item, de_raw.encode('utf-8'))
                elif norm_name == 'Blackthornes_TS/Core/Util.lua':
                    u_raw = zin.read(item.filename).decode('utf-8')
                    u_raw = (u_raw
                        .replace('local GOLD_SUFFIX   = "|cffffd700g|r"', 'local GOLD_SUFFIX   = "|cffffd700金|r"')
                        .replace('local SILVER_SUFFIX = "|cffc7c7cfs|r"', 'local SILVER_SUFFIX = "|cffc7c7cf银|r"')
                        .replace('local COPPER_SUFFIX = "|cffeda55fc|r"', 'local COPPER_SUFFIX = "|cffeda55f铜|r"')
                        .replace('g, s, c = "g", "s", "c"', 'g, s, c = "金", "银", "铜"'))
                    zout.writestr(item, u_raw.encode('utf-8'))
                elif norm_name == 'Blackthornes_TS/UI/PriceEditor.lua':
                    pe_raw = zin.read(item.filename).decode('utf-8')
                    pe_raw = (pe_raw
                        .replace('Coin(48, 214748, "|cffffd700g|r")', 'Coin(48, 214748, "|cffffd700金|r")')
                        .replace('Coin(30, 99, "|cffc7c7cfs|r")', 'Coin(30, 99, "|cffc7c7cf银|r")')
                        .replace('Coin(30, 99, "|cffeda55fc|r")', 'Coin(30, 99, "|cffeda55f铜|r")'))
                    zout.writestr(item, pe_raw.encode('utf-8'))
                elif norm_name == 'Blackthornes_TS/UI/Tab_Prices.lua':
                    tp_raw = zin.read(item.filename).decode('utf-8')
                    tp_raw = (tp_raw
                        .replace('Coin("gold", 44, 214748, "|cffffd700g|r")', 'Coin("gold", 44, 214748, "|cffffd700金|r")')
                        .replace('Coin("silver", 28, 99, "|cffc7c7cfs|r")', 'Coin("silver", 28, 99, "|cffc7c7cf银|r")')
                        .replace('Coin("copper", 28, 99, "|cffeda55fc|r")', 'Coin("copper", 28, 99, "|cffeda55f铜|r")'))
                    zout.writestr(item, tp_raw.encode('utf-8'))
                elif norm_name == 'Blackthornes_TS/UI/GoldGoal.lua':
                    gg_raw = zin.read(item.filename).decode('utf-8')
                    gg_raw = gg_raw.replace('unit:SetText("g")', 'unit:SetText("金")')
                    zout.writestr(item, gg_raw.encode('utf-8'))
                elif norm_name == 'Blackthornes_TS/UI/Tab_Settings.lua':
                    ts_raw = zin.read(item.filename).decode('utf-8')
                    ts_raw = ts_raw.replace('AddUnit(goalRow, widgets.goldGoal, "g")', 'AddUnit(goalRow, widgets.goldGoal, "金")')
                    zout.writestr(item, ts_raw.encode('utf-8'))
                elif norm_name == 'Blackthornes_TS/Blackthornes_TS.toc':
                    toc_raw = zin.read(item.filename).decode('utf-8')
                    if 'Title-zhCN:' not in toc_raw:
                        toc_raw = re.sub(r'## Title: (.*)', r'## Title: \1\n## Title-zhCN: |cff00ff00[商业]|r Blackthornes Tradeskills (商业制造与拍卖)', toc_raw)
                        toc_raw = re.sub(r'## Notes: (.*)', r'## Notes: \1\n## Notes-zhCN: 专为无限服打造的专业制造与拍卖行全能管理插件，实时计算配方利润、排队制造与防亏损上架。', toc_raw)
                    zout.writestr(item, toc_raw.encode('utf-8'))
                else:
                    zout.writestr(item, zin.read(item.filename))
            if not replaced:
                zout.writestr('Blackthornes_TS/Locale/zhCN.lua', final_text.encode('utf-8'))
        shutil.move(tmp_path, zip_path)
        os.chmod(zip_path, 0o644)
        print(f"Updated zip archive: {zip_path}")
