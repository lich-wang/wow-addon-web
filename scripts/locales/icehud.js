/**
 * IceHUD zhCN Localization Completer
 */
export const ICEHUD_TRANSLATIONS = {
  "A custom bar has been created and can be configured through Module Settings => MyCustomBar. It is highly recommended that you change the bar name of this module so that it's easier to identify.": "已创建自定义状态条，可在模块设置 => MyCustomBar 中配置。强烈建议修改此模块的条名称，以便更容易识别。",
  "A custom cooldown bar has been created and can be configured through Module Settings => MyCustomCD. It is highly recommended that you change the bar name of this module so that it's easier to identify.": "已创建自定义冷却条，可在模块设置 => MyCustomCD 中配置。强烈建议修改此模块的条名称，以便更容易识别。",
  "A custom counter bar has been created and can be configured through Module Settings => MyCustomCounterBar. It is highly recommended that you change the bar name of this module so that it's easier to identify.": "已创建自定义计数条，可在模块设置 => MyCustomCounterBar 中配置。强烈建议修改此模块的条名称，以便更容易识别。",
  "A custom counter has been created and can be configured through Module Settings => MyCustomCounter. It is highly recommended that you change the bar name of this module so that it's easier to identify.": "已创建自定义计数器，可在模块设置 => MyCustomCounter 中配置。强烈建议修改此模块的条名称，以便更容易识别。",
  "A custom health bar has been created and can be configured through Module Settings => MyCustomHealth. It is highly recommended that you change the bar name of this module so that it's easier to identify.": "已创建自定义生命条，可在模块设置 => MyCustomHealth 中配置。强烈建议修改此模块的条名称，以便更容易识别。",
  "A custom mana bar has been created and can be configured through Module Settings => MyCustomMana. It is highly recommended that you change the bar name of this module so that it's easier to identify.": "已创建自定义法力条，可在模块设置 => MyCustomMana 中配置。强烈建议修改此模块的条名称，以便更容易识别。",
  "Absorb bar alpha": "吸收条透明度",
  "Added strata": "附加框架层级",
  "After spell name": "在法术名称之后",
  "Allow custom point placement": "允许自定义点放置",
  "Also show numeric": "同时显示数值",
  "Always": "总是",
  "Always shows the Druid's Energy level while in non-energy-using forms.": "在非能量形态下始终显示德鲁伊的能量值。",
  "Always, when targeting": "有目标时始终显示",
  "Anchor to": "锚点对齐到",
  "Are you sure you want to delete this module? This will remove all settings associated with it and cannot be un-done.": "确定要删除此模块吗？这将移除与其关联的所有设置且不可恢复。",
  "Bear": "熊形态",
  "Below spell name": "在法术名称下方",
  "Blizzard currently does not provide a proper way to right-click dismiss a pet with custom unit frames.": "暴雪目前未为自定义框体提供右键解散宠物的安全接口。",
  "Blizzard currently does not provide a proper way to right-click focus with custom unit frames.": "暴雪目前未为自定义框体提供右键设为焦点的安全接口。",
  "Blizzard currently does not provide a proper way to right-click report someone AFK with custom unit frames.": "暴雪目前未为自定义框体提供右键举报挂机(AFK)的安全接口。",
  "Cannot report AFK from addons": "无法从插件界面举报挂机",
  "Cast Text": "施法文本",
  "Center": "居中",
  "Checking this means that only buffs or debuffs that the player applied will trigger this bar": "勾选此项表示仅由玩家自身施加的增益或减益才会触发此条",
  "Choose a marker to edit. This will place the marker's settings in the fields above here.": "选择要编辑的标记。这会将该标记的设置加载到上方的字段中。",
  "Choose whether you'd like a graphical or numeric representation of the runes.": "选择符文采用图形还是数字形式展现。",
  "Cooldown type": "冷却类型",
  "CounterBar": "计数条",
  "Create or remove markers at various points along the bar here": "在此处为状态条添加或删除不同刻度位置的标记",
  "Create marker": "创建标记",
  "Current marker": "当前标记",
  "Delete marker": "删除标记",
  "Marker position": "标记位置",
  "Marker color": "标记颜色",
  "Bar color": "状态条颜色",
  "Display mode": "显示模式",
  "Energy / Mana": "能量 / 法力",
  "Custom CD settings": "自定义冷却设置",
  "Custom bar settings": "自定义状态条设置",
  "Custom counter settings": "自定义计数器设置",
  "Scale": "缩放比例",
  "Offset": "偏移量",
  "Horizontal offset": "水平偏移",
  "Vertical offset": "垂直偏移",
  "Transparency settings": "透明度设置",
  "Bar Texture": "状态条材质",
  "Font Size": "字体大小",
  "Text format": "文本格式",
  "Combat alpha": "战斗中透明度",
  "Out of combat alpha": "脱战透明度",
  "Target alpha": "有目标时透明度",
  "Enabled": "启用",
  "Disabled": "禁用",
  "Reverse direction": "反向增长",
  "Low threshold": "低值报警阈值",
  "High threshold": "高值报警阈值",
  "Flash when low": "低值时闪烁报警",
  "Show text": "显示文本",
  "Hide text": "隐藏文本",
  "Color": "颜色",
  "Outline": "轮廓描边",
  "Thick outline": "加粗描边",
  "Lock": "锁定位置",
  "Unlock": "解锁移动",
  "Profile": "配置方案",
  "Reset to defaults": "恢复默认设置"
};

export function patchIceHUDZhCN(zhCNContent) {
  let patched = zhCNContent;
  for (const [enKey, zhVal] of Object.entries(ICEHUD_TRANSLATIONS)) {
    // Look for --[[Translation missing --]] followed by L["enKey"] = ...
    const escaped = enKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`--\\[\\[Translation missing --\\]\\]\\r?\\nL\\[[ \\t]*["'\`]${escaped}["'\`][ \\t]*\\]\\s*=\\s*.*`, 'g');
    if (regex.test(patched)) {
      patched = patched.replace(regex, `L[${JSON.stringify(enKey)}] = ${JSON.stringify(zhVal)}`);
    } else {
      // Also match without the comment if it already has an assignment
      const regexDirect = new RegExp(`L\\[[ \\t]*["'\`]${escaped}["'\`][ \\t]*\\]\\s*=\\s*true`, 'g');
      patched = patched.replace(regexDirect, `L[${JSON.stringify(enKey)}] = ${JSON.stringify(zhVal)}`);
    }
  }

  // Also replace any remaining simple missing translations like L["Word"] = true
  patched = patched.replace(/--\[\[Translation missing --\]\]\r?\nL\["(.*?)"\]\s*=\s*(?:true|"(.*?)")/g, (m, k, v) => {
    if (ICEHUD_TRANSLATIONS[k]) {
      return `L[${JSON.stringify(k)}] = ${JSON.stringify(ICEHUD_TRANSLATIONS[k])}`;
    }
    return `L[${JSON.stringify(k)}] = ${JSON.stringify(v || k)}`;
  });

  return patched;
}
