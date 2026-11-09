/**
 * Single-Button Fishing zhCN Localization Generator & Patcher
 */

export const SBF_HELP_ZH = {
  "set.warnNoPole": {
    title: "无鱼竿时警告",
    body: "当手中未装备鱼竿且未配置穿戴规则时，按钓鱼键不会甩竿，并提示将鱼竿拖入配置方案中的鱼竿栏。取消勾选可强制甩竿。"
  },
  "set.petStance": {
    title: "钓鱼时宠物姿态",
    body: "在钓鱼时保持宠物处于此姿态。若在脱战状态下按钓鱼键且宠物处于其它姿态，SBF 将自动切换。停止钓鱼不会恢复原姿态。选择“保持原样”则不干涉宠物。"
  },
  "set.petFight": {
    title: "宠物战斗时协同攻击",
    body: "当宠物进入战斗而你尚未进入战斗时，钓鱼键将自动触发战斗动作，而不是甩竿或拾取。需在战斗栏中设置技能。"
  },
  "set.petFightTarget": {
    title: "优先以宠物攻击目标为目标",
    body: "当按钓鱼键协助宠物战斗时，自动选中宠物正在攻击的目标。"
  },
  "set.combatReleasesLoot": {
    title: "进入战斗时优先反击而非拾取",
    body: "若在浮漂上钩拾取过程中被野怪攻击进入战斗，钓鱼键将立即切换为战斗动作，防止因拾取窗口卡死在战斗中。"
  },
  "set.guardFishingOff": {
    title: "Shift+点击 关闭钓鱼动作",
    body: "开启后，按住 Shift 并点击钓鱼键可临时停用钓鱼循环模式。"
  },
  "set.sitBeforeCast": {
    title: "每次甩竿前坐下",
    body: "在每次抛竿前让角色坐下，适合休闲钓鱼体验。"
  },
  "set.autoDismount": {
    title: "钓鱼时自动下坐骑",
    body: "在坐骑上按钓鱼键时，自动取消坐骑并开始钓鱼流程。"
  },
  "set.refreshSkillOnCast": {
    title: "甩竿时刷新钓鱼技能点数",
    body: "每次抛竿时重新读取并刷新角色当前的钓鱼技能等级与加成。"
  },
  "set.combatWindows": {
    title: "战斗中隐藏界面",
    body: "进入战斗后自动隐藏 SBF 界面和浮动指示器，脱战后自动恢复。"
  },
  "set.castBackoff": {
    title: "施法失败后退避间隔",
    body: "当抛竿失败（例如距离过近或卡模型）时，设置短暂的重试冷却时间，避免狂点按键刷屏报错。"
  },
  "set.zoneIndicator": {
    title: "区域增益发光提示",
    body: "当处于特殊钓鱼区域或拥有特殊钓鱼增益效果时，高亮显示状态指示器。"
  },
  "set.idleTimeout": {
    title: "闲置超时时间",
    body: "超过指定时间未按钓鱼键后，自动判定为停止钓鱼并还原装备。"
  },
  "set.mouseDouble": {
    title: "双击间隔时间 (秒)",
    body: "设置鼠标右键双击判定的时间窗口。"
  },
  "set.useMouse": {
    title: "启用鼠标双击钓鱼",
    body: "允许通过右键双击水面或空地来触发完整的单键钓鱼流程（抛竿/拾取）。"
  },
  "set.twoButton": {
    title: "双键模式",
    body: "将抛竿与交互拾取分离为两个独立的按键，适合习惯传统双键操作的玩家。"
  },
  "set.gamepadEnable": {
    title: "启用手柄控制器支持",
    body: "支持将钓鱼循环动作绑定到手柄按键。"
  },
  "set.fastLoot": {
    title: "极速极快拾取 (跳过拾取框瞬间全拿)",
    body: "起竿瞬间自动高速拾取鱼类与物品，无需等待拾取窗口打开与动画播放。"
  },
  "set.advancedMode": {
    title: "配置方案高级模式",
    body: "解锁多套独立配置方案、条件宏支持与精细化栏位调整。"
  },
  "set.autoSwap": {
    title: "根据区域自动切换方案",
    body: "进入特定水域或副本地图时，自动切换到对应预设的鱼竿与鱼饵方案。"
  },
  "set.warnUnsavedOnClose": {
    title: "关闭时提示未保存的更改",
    body: "在关闭设置面板时，若有未保存的槽位修改则弹窗确认。"
  },
  "set.swapFlash": {
    title: "切换方案时屏幕闪烁提醒",
    body: "当自动切换方案触发时在屏幕边缘给出视觉提示。"
  },
  "set.idleRestore": {
    title: "闲置时自动换回战斗装备",
    body: "停止钓鱼一段时间后，自动换回原先的主副手武器与头饰装备。"
  },
  "set.focusAudio": {
    title: "钓鱼专注音频 (放大起竿水花声)",
    body: "钓鱼时自动调大环境音效并放大鱼儿咬钩溅水声，即使切到后台也能清晰听见起竿时机！"
  },
  "set.showUnownedToys": {
    title: "显示未拥有的钓鱼玩具",
    body: "在玩具栏中列出所有钓鱼相关玩具（包括未收集的）。"
  },
  "set.showUnownedItems": {
    title: "显示背包中未持有的鱼饵物品",
    body: "在备选列表中展示所有支持的增益鱼饵与道具。"
  },
  "set.showWarbandItems": {
    title: "显示战团共享物品",
    body: "包含战团银行中可用的钓鱼物资。"
  },
  "set.showHiddenItems": {
    title: "显示已隐藏物品",
    body: "在物品选择器中显示先前被标记为隐藏的条目。"
  },
  "set.hideMinimap": {
    title: "隐藏小地图图标",
    body: "在小地图周围隐藏 SBF 快捷入口图标。"
  },
  "set.castSound": {
    title: "抛竿提示音",
    body: "成功抛出鱼线时播放提示音效。"
  },
  "set.castFailSound": {
    title: "抛竿失败提示音",
    body: "抛竿遇到障碍或无法下竿时播放警告音效。"
  },
  "set.bobberReach": {
    title: "浮漂交互距离判定",
    body: "监测浮漂与角色的交互范围，超出距离自动报警或重抛。"
  },
  "set.reachCamera": {
    title: "使用专用钓鱼视距镜头",
    body: "进入钓鱼状态后自动拉近或微调镜头视角，便于观察浮漂。"
  },
  "set.reachViewSlot": {
    title: "视距镜头保存栏位",
    body: "指定绑定的游戏内置镜头视角编号。"
  },
  "set.reachSaveCamera": {
    title: "保存当前镜头为钓鱼视角",
    body: "将当前的镜头朝向和视距保存为钓鱼默认视角。"
  },
  "set.reachRecast": {
    title: "超出范围时自动重新抛竿",
    body: "当浮漂落点距离角色太远超出拾取范围时，自动取消并立即重抛。"
  },
  "set.reachSound": {
    title: "超距提示音",
    body: "落点超出交互范围时播放警告音。"
  },
  "set.noFishSound": {
    title: "未咬钩提示音",
    body: "直到倒计时结束仍无鱼上钩时播放提示音。"
  },
  "set.expiredSound": {
    title: "抛竿超时提示音",
    body: "浮漂倒计时结束超时提示。"
  },
  "set.nothingSound": {
    title: "空杆收线提示音",
    body: "提竿时空空如也未获得物品时的音效。"
  },
  "set.prSound": {
    title: "耐心收获奖励音效",
    body: "长时间连续垂钓获得稀有收获时的专属庆祝音效！"
  },
  "set.bgAlpha": {
    title: "面板背景透明度",
    body: "调整 SBF 设置窗口的半透明程度。"
  },
  "set.debug": {
    title: "调试日志输出",
    body: "在聊天窗口输出按键判定与状态转换详细诊断日志。"
  },
  "set.footing": {
    title: "落脚点与站位诊断面板",
    body: "显示当前水体表面与地面高度碰撞检测。"
  }
};

export function patchSBF(zip) {
  // 1. Create SBF/Locale/zhCN.lua
  const zhCNLua = `-- SBF 简体中文本地化
local ADDON, ns = ...

if GetLocale() == "zhCN" or GetLocale() == "zhTW" then
    _G["BINDING_HEADER_SBF"] = "SBF - 单键钓鱼助手"
    _G["BINDING_NAME_CLICK SBFBtn_fishing:LeftButton"] = "钓鱼动作 / 施法与交互"

    local zhHelp = ${JSON.stringify(SBF_HELP_ZH, null, 2)}

    if SBF and SBF.Help then
        for k, v in pairs(zhHelp) do
            if SBF.Help[k] then
                SBF.Help[k].title = v.title
                SBF.Help[k].body = v.body
            else
                SBF.Help[k] = v
            end
        end
    end
end
`;
  zip.file('SBF/Locale/zhCN.lua', zhCNLua);

  // 2. Append locale load and Chinese bindings to SBF/Core.lua
  let core = zip.file('SBF/Core.lua') ? zip.file('SBF/Core.lua').async('string') : null;
  // 3. Update SBF/SBF.toc
  let toc = zip.file('SBF/SBF.toc').async('string');
  return Promise.all([core, toc]).then(([coreText, tocText]) => {
    if (coreText) {
      const injection = `
-- [zhCN Localization Inject]
if GetLocale() == "zhCN" or GetLocale() == "zhTW" then
    _G["BINDING_HEADER_SBF"] = "SBF - 单键钓鱼助手"
    _G["BINDING_NAME_CLICK SBFBtn_fishing:LeftButton"] = "钓鱼动作 / 抛竿与拾取"
end
`;
      zip.file('SBF/Core.lua', coreText + injection);
    }

    if (tocText && !tocText.includes('Locale\\zhCN.lua')) {
      const newToc = tocText
        .replace(/## Title: (.*)/, '## Title: $1\n## Title-zhCN: |cff00ff00[钓鱼]|r Single-Button Fishing (单键钓鱼)')
        .replace(/## Notes: (.*)/, '## Notes: $1\n## Notes-zhCN: 单键完成钓鱼循环（抛竿、浮漂交互、自动拾取、换装上饵），完美支持无限服与各经典版本。')
        .replace('Welcome.lua', 'Welcome.lua\nLocale\\zhCN.lua');
      zip.file('SBF/SBF.toc', newToc);
    }
  });
}
