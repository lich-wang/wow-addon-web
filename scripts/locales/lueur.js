export function generateLueurZhCN() {
  return `-- Lueur : 简体中文本地化文本
local _, ns = ...

local L = {}
ns.LOCALES.zhCN = L

L.LANGUAGE_NAME = "简体中文"
L.PREFIX = "|cffffd200Lueur|r: "
L.YES = "是"
L.NO = "否"
L.SETTING = "%s: %s"
L.FORMAT_PERCENT = "%d%%"
L.FORMAT_RANGE = "%d 码"
L.CONFIRM = "确认？"

L.COMMANDS = {}

---------------------------------------------------------------------------
-- 分类、状态与发光特效
---------------------------------------------------------------------------

L.CATEGORY_ORE = "矿石矿脉"
L.CATEGORY_ORE_TIP = "矿脉与矿藏沉积。"
L.CATEGORY_HERB = "草药植物"
L.CATEGORY_HERB_TIP = "你可以采集的草药植物。"
L.CATEGORY_QUEST = "任务目标"
L.CATEGORY_QUEST_TIP = "与你当前正在进行的任务相关的物体。"
L.CATEGORY_CHEST = "宝箱容器"
L.CATEGORY_CHEST_TIP = "宝箱、箱子与其他可搜刮的容器。"
L.CATEGORY_BOBBER = "钓鱼浮标"
L.CATEGORY_BOBBER_TIP = "你抛入水中的钓鱼浮标/鱼漂。"
L.CATEGORY_OTHER = "其他物体"
L.CATEGORY_OTHER_TIP = "日常交互物体：门、邮箱、控制杆等。"

L.NAME_ORE = "矿石"
L.NAME_HERB = "草药"
L.NAME_QUEST = "任务"
L.NAME_CHEST = "宝箱"
L.NAME_BOBBER = "鱼漂"
L.NAME_OTHER = "其他"
L.NAME_NONE = "无"

L.SAMPLE_ORE = "铜矿脉"
L.SAMPLE_HERB = "宁神花"
L.SAMPLE_QUEST = "补给箱"
L.SAMPLE_CHEST = "破损的宝箱"
L.SAMPLE_BOBBER = "钓鱼浮标"
L.SAMPLE_OTHER = "邮箱"

L.STATE_FAR = "超出交互范围"
L.STATE_READY = "在交互范围内"
L.STATE_LOCKED = "不可用"

L.EFFECT_AURA = "光环光晕"
L.EFFECT_AURA_TIP = "环绕物体的明亮光晕，伴随精致细环、流星彗星与萤火微光。"
L.EFFECT_RETICLE = "准星标线"
L.EFFECT_RETICLE_TIP = "清晰的圆形准星标线及其流星，叠加柔和发光。"
L.EFFECT_SUBTLE = "柔和微光"
L.EFFECT_SUBTLE_TIP = "柔和高亮，不显示圆环或流星。"
L.EFFECT_SIGIL = "符文光环"
L.EFFECT_SIGIL_TIP = "一圈古老符文在物体周围缓缓盘旋。"
L.EFFECT_BRACKETS = "方括号"
L.EFFECT_BRACKETS_TIP = "四个边角框住物体，进入交互范围时缩拢锁定。"
L.EFFECT_BEAM = "冲天光柱"
L.EFFECT_BEAM_TIP = "一道明亮光柱从物体拔地而起，火花沿光柱徐徐升腾。"
L.EFFECT_BEACON = "水晶信标"
L.EFFECT_BEACON_TIP = "一枚魔法水晶悬浮在物体上方，由光丝牵引连接。"
L.EFFECT_ORBIT = "轨道星光"
L.EFFECT_ORBIT_TIP = "幽光精灵绕着物体循环盘旋，身后拖曳出璀璨光轨。"
L.EFFECT_RIPPLE = "地面涟漪"
L.EFFECT_RIPPLE_TIP = "一道道魔法光芒自物体脚下的地面向四周扩散扩散。"
L.EFFECT_SPARKLE = "璀璨闪光"
L.EFFECT_SPARKLE_TIP = "物体周围闪烁微光点点，不带任何环形底图。"

---------------------------------------------------------------------------
-- 菜单与设置项
---------------------------------------------------------------------------

L.HEADER_SILHOUETTE = "角色遮挡避让 (剪影)"
L.HEADER_OBJECTS = "高亮物体分类"
L.HEADER_HIDE = "何时隐藏效果"
L.HEADER_DETECTION = "目标检测与探测"
L.HEADER_GENERAL = "常规设置"
L.SETTINGS = "设置"

L.SCOPE_ALL = "全部"
L.SCOPE_ALL_TIP = "设置将应用到所有分类。此前单独配置的分类将重置为全局值。"
L.SCOPE_ONE_TIP = "设置仅对当前分类生效，不受其他分类影响。"
L.EFFECT = "效果样式"
L.EFFECT_TIP = "发光的视觉形状样式。"
L.LOOK_OF_ALL = "所有物体的外观"
L.LOOK_OF = "外观样式: %s"
L.OF_CATEGORY = "%s (%s)"
L.SHARED = "与全部物体一致"
L.SHARED_TIP = "移除此分类的独立效果与外观，恢复跟随全部物体的全局外观。"

L.SIZE = "大小尺寸"
L.SIZE_TIP = "发光特效的覆盖大小。"
L.INTENSITY = "发光强度"
L.INTENSITY_TIP = "特效发光的明暗亮度。"
L.OFFSET = "垂直偏移"
L.OFFSET_TIP = "从物体姓名板向上或向下偏移发光特效。可在预览中查看实际落点。"
L.FADE = "随姓名板淡出"
L.FADE_TIP = "当场景遮挡物体姓名板时，发光特效也一同淡出隐藏。"

L.SILHOUETTE = "在角色身后穿过"
L.SILHOUETTE_TIP = "在角色身形周围裁剪特效，使光晕穿过你的身后，而不是遮盖角色身体。"
L.ZONE_SIZE = "裁剪范围大小"
L.ZONE_SIZE_TIP = "如果光效切入角色身体请调大，如果光效离身体太远请调小。每个角色独立保存。"
L.ZONE_HEIGHT = "裁剪垂直高度"
L.ZONE_HEIGHT_TIP = "上下移动裁剪区域的高度。每个角色独立保存。"
L.ZONE_SHOW = "显示裁剪轮廓"
L.ZONE_SHOW_TIP = "用红线勾勒裁剪区域轮廓，应紧贴你的角色身形。关闭设置窗口时自动消失。"

L.SHOW_NAME = "显示物体名称"
L.SHOW_NAME_TIP = "在物体上方写出其名称，取代游戏自带文字。"
L.SHOW_ICON = "显示交互图标"
L.SHOW_ICON_TIP = "在物体上方绘制其交互图标，取代游戏默认绘制。"
L.TEXT_SIZE = "文字大小"
L.TEXT_SIZE_TIP = "物体上方名称字号相对于游戏自带文字的比例。"
L.FONT = "字体"
L.FONT_TIP = "物体上方名称所使用的字体。"
L.FONT_GAME = "游戏默认字体"
L.COLOR = "发光颜色"
L.COLOR_TIP = "此类物体发光特效的色彩。"
L.TIP_COLOR_SET = "左键点击: 选择颜色"
L.TIP_COLOR_RESET = "右键点击: 恢复初始颜色"
L.IGNORED = "已忽略物体: %d"
L.IGNORED_TIP = "无论属于哪个分类均不产生发光的物体。输入 /lueur ignore list 查看，/lueur ignore clear 清空。"
L.IGNORE_TARGET = "忽略当前目标"
L.IGNORE_TARGET_TIP = "忽略当前正面对的物体，或取消对其的忽略。"

L.HIDE_COMBAT = "战斗中隐藏"
L.HIDE_COMBAT_TIP = "处于战斗状态时不显示发光特效。"
L.HIDE_INSTANCE = "副本中隐藏"
L.HIDE_INSTANCE_TIP = "在地下城、团队副本和战场中隐藏发光特效。"
L.HIDE_LOCKED = "隐藏无法使用的物体"
L.HIDE_LOCKED_TIP = "当游戏暂时拒绝交互（技能点数不足、物体上锁等）时隐藏特效。游戏仅在靠近时确认此状态。"
L.HIDE_UNTRAINED = "未学专业时隐藏草药与矿石"
L.HIDE_UNTRAINED_TIP = "未学草药学时不显示草药光效，未学采矿时不显示矿石光效。"

L.RANGE = "探测距离"
L.RANGE_TIP = "游戏判定可高亮物体的最大距离（码）。"
L.DIRECTION = "探测方向"
L.DIRECTION_TIP = "游戏寻找并拾取交互物体的朝向扇面。"
L.ARC_0 = "正前方"
L.ARC_0_TIP = "仅拾取正好位于你正前方的目标。"
L.ARC_1 = "前方扇形"
L.ARC_1_TIP = "拾取你身前扇形区域内的目标。"
L.ARC_2 = "全方位"
L.ARC_2_TIP = "全方位 360 度，包含你身后的目标。"
L.EXCLUSIVE = "仅显示高亮目标"
L.EXCLUSIVE_TIP = "游戏不再指出没有特效的交互目标（NPC、邮箱等）。取消勾选则在所有目标上都显示名称和图标。"

L.KEY = "交互快捷键"
L.KEY_TIP = "当高亮物体进入范围时用于拾取、采集或使用的快捷键。此为游戏原生交互键，可同样用于NPC，也可在游戏按键绑定中修改。"
L.KEY_NONE = "未绑定"
L.KEY_LISTEN = "请按下按键"
L.KEY_LISTEN_TIP = "按下你想使用的键盘按键、鼠标按键或滚轮。按 Escape 键取消。"
L.KEY_TAKEN = "按键 %s 已被“%s”使用。再次按下将其重新绑定为交互键，或按其他键取消。"
L.TIP_KEY_SET = "左键点击: 选择按键"
L.TIP_KEY_CLEAR = "右键点击: 清除按键绑定"

L.LANGUAGE = "语言"
L.LANGUAGE_TIP = "Lueur 界面文字与命令所使用的语言。"
L.LANGUAGE_AUTO = "自动"
L.LANGUAGE_AUTO_TIP = "跟随游戏客户端语言。"

L.ENABLE = "启用 Lueur"
L.ENABLE_TIP = "禁用后，Lueur 将原生物体交互设置归还给游戏客户端。"
L.MINIMAP = "小地图按钮"
L.MINIMAP_TIP = "在小地图边框周围显示 Lueur 快捷按钮。"
L.DEBUG = "聊天框调试输出"
L.DEBUG_TIP = "在聊天窗口中打印每一个被锁定的目标及 Lueur 对其做出的判定。"

-- 小地图页面
L.NODES_PAGE = "小地图草药与矿脉"
L.HEADER_NODES = "小地图采集图标"
L.HEADER_SWITCH = "双采技能交替助手"
L.NODE_HERBS = "显示草药专用图标"
L.NODE_HERBS_TIP = "在小地图上将追踪到的草药显示为其专属植物图标，而非单调的小黄点。"
L.NODE_ORE = "显示矿石专用图标"
L.NODE_ORE_TIP = "在小地图上将追踪到的矿脉显示为其对应矿石图标，而非单调的小黄点。"
L.NODE_SIZE = "图标大小"
L.NODE_SIZE_TIP = "小地图采集图标的尺寸大小。"
L.NODE_SWITCH = "交替双采追踪"
L.NODE_SWITCH_TIP = "游戏通常只能同时开启“寻找草药”或“寻找矿物”之一。开启后，Lueur 将在你移动一定距离后自动交替切换追踪，并在小地图上保留两者的图标。每个角色独立保存。"
L.NODE_SWITCH_YARDS = "切换移动距离"
L.NODE_SWITCH_YARDS_TIP = "移动多少码后自动切换到另一种追踪技能。"

L.PREVIEW = "效果预览"
L.PREVIEW_STOP = "关闭预览"
L.PREVIEW_TIP = "打开 3D 模型窗口，直观展示物体在各状态下的发光效果。设置修改即时呈现。"
L.PREVIEW_NO_MODEL = "当前客户端不支持 3D 模型预览"
L.PREVIEW_HINT = "左键拖动: 旋转  ·  右键拖动: 平移  ·  滚轮: 缩放"
L.DEFAULTS = "恢复默认"
L.DEFAULTS_TIP = "将发光与检测设置还原为初始默认值。再次点击确认。"
L.FOOTER = "Lueur %s  ·  /lueur help: 查看所有命令"

L.OPTIONS_NOTE = "当你接近矿脉、草药、任务物品和宝箱时，呈现视觉光芒加强提示。"
L.OPTIONS_OPEN = "打开 Lueur 设置面板"

L.TIP_ENABLED = "已启用"
L.TIP_DISABLED = "已禁用"
L.TIP_LEFT_CLICK = "左键点击: 打开设置"
L.TIP_RIGHT_CLICK = "右键点击: 启用 / 禁用"
L.TIP_DRAG = "拖动: 移动此图标"

---------------------------------------------------------------------------
-- 命令行提示信息
---------------------------------------------------------------------------

L.MSG_ENABLED = "已启用。"
L.MSG_DISABLED = "已禁用，已恢复原始设置。"
L.MSG_RESTART = "请完全重启游戏以完成 Lueur 更新。"
L.MSG_EXCLUSIVE_ON = "游戏不再指出没有特效的目标。"
L.MSG_EXCLUSIVE_OFF = "游戏将在所有交互目标（NPC、场景物体等）上显示名称与图标。"
L.MSG_SILHOUETTE_ON = "发光特效在角色身后穿过。"
L.MSG_SILHOUETTE_OFF = "发光特效覆盖在角色上方。"
L.MSG_CUTOUT_UNAVAILABLE = "裁剪功能不可用: %s。"
L.MSG_ZONE_SHOWN = "红线轮廓已开启：应紧密贴合你的角色身形。"
L.MSG_ZONE_HIDDEN = "红线轮廓已隐藏。"
L.MSG_SILHOUETTE_VALUES = "角色剪影避让: 大小 %d%%, 高度 %d%%"
L.MSG_SILHOUETTE_USAGE = "用法: /lueur silhouette | show | <size {bodyScale}> [height {bodyShift}]"
L.MSG_EFFECTS = "可用效果样式: %s (当前: %s)"
L.MSG_FONTS = "可用字体: %s (当前: %s)"
L.MSG_COLOR = "%s: 颜色 %s"
L.MSG_NO_PICKER = "当前客户端未内置拾色器：请输入 /lueur color <category> <rrggbb>。"
L.MSG_SHARED = "%s: 已恢复为全局统一外观样式。"
L.MSG_HIDE_COMBAT = "战斗中隐藏效果: %s"
L.MSG_HIDE_INSTANCE = "副本中隐藏效果: %s"
L.MSG_HIDE_LOCKED = "无法使用的物体隐藏效果: %s"
L.MSG_HIDE_UNTRAINED = "未学专业时隐藏草药与矿石效果: %s"

---------------------------------------------------------------------------
-- 调试与诊断 (/lueur debug)
---------------------------------------------------------------------------

L.DEBUG_NO_TARGET = "没有检测到任何交互目标"
L.DEBUG_PAUSED = "已暂停 (战斗或副本中)"
L.DEBUG_LINE_OUT = "鱼线抛出: 请求 %d 码，客户端保持 %s"
L.DEBUG_LINE_IN = "鱼线收回: 请求 %d 码，客户端保持 %s"
L.DEBUG_IGNORED = "%s 已忽略 (非世界物体)"
L.DEBUG_SKIPPED = "%s 已跳过 (在你的忽略列表中)"
L.DEBUG_HIDDEN = "%s → %s, 无发光效果 (分类隐藏或未知)"
L.DEBUG_UNTRAINED = "%s → %s, 无发光效果 (当前角色未学该专业)"
L.DEBUG_NO_PLATE = "%s → %s, 已检测但未创建姓名板: 无法附加效果"
L.DEBUG_SHOWN = "%s → %s, %s"
L.DEBUG_CURSOR = "鼠标指针: %s"
L.DEBUG_VIA = "锁定方式: %s"
L.VIA_DIRECT = "直接锁定"
L.VIA_SWEEP = "扫描锁定"
L.DEBUG_RANGE = "处于交互范围内: %s"
L.DEBUG_OBJECT = "物体 ID: %s"
L.DEBUG_FISHING = "钓鱼浮标: %s"
L.DEBUG_QUEST = "任务相关: %s"
L.DEBUG_MATCH = "关联至任务目标: %s (%d 个进行中的目标)"
L.MATCH_NONE = "无匹配"
L.MATCH_CURSOR = "无匹配，由指针类型识别"
L.MATCH_TOOLTIP = "由鼠标提示信息匹配"
L.MATCH_NAME = "由物体名称匹配"
L.MATCH_WORD = "包含词语“%s”"
L.MATCH_LOOT = "由此前获取的掉落拾取匹配"
L.DEBUG_CHEST = "被判定为容器宝箱: %s"
L.DEBUG_SECRET = "秘密身份: %s"
L.DEBUG_BEHIND = "位于镜头视野后方: %s"

---------------------------------------------------------------------------
-- 帮助信息 (/lueur help)
---------------------------------------------------------------------------

L.HELP_HEADER = "可用命令列表:"
L.HELP = {
	"/lueur — 打开或关闭设置面板 (如同点击小地图按钮)",
	"/lueur minimap — 显示或隐藏小地图按钮",
	"/lueur on | off — 启用或禁用 Lueur (关闭时恢复原生设置)",
	"/lueur preview — 打开或关闭 3D 模型效果预览窗口",
	"/lueur effect [category] <name> — 为所有或指定分类设置特效样式 (ore, herb, quest, chest, bobber, other)",
	"/lueur color <category> <rrggbb> | default — 设置指定分类特效的颜色",
	"/lueur shared <category> — 将指定分类恢复为跟随全局外观",
	"/lueur size [category] <{size}> — 设置发光特效大小 (默认 {size=})",
	"/lueur intensity [category] <{intensity}> — 设置发光强度 % (默认 {intensity=})",
	"/lueur offset [category] <{offsetY}> — 设置垂直偏移 (默认 {offsetY=})",
	"/lueur fade [category] — 切换特效是否随姓名板淡出",
	"/lueur name | icon [category] — 切换物体上方是否显示名称或图标；text [category] <{textSize}> 设置文字大小 %",
	"/lueur font [category] <name> | default — 设置物体名称字体",
	"/lueur silhouette [category] — 切换特效是否在角色身后穿过 (角色遮挡避让)",
	"/lueur silhouette show | <size %> [height %] — 显示并调整裁剪避让轮廓",
	"/lueur range <{range}> — 设置拾取物体的探测距离，单位码 (默认 {range=})",
	"/lueur arc <{arc}> — 设置探测朝向：0 正前方，1 前方扇形，2 全方位 (默认 {arc=})",
	"/lueur exclusive — 切换是否仅对有发光特效的目标进行交互指向",
	"/lueur combat | instance | unavailable | profession — 切换在战斗、副本、不可用物体或未学专业时的隐藏开关",
	"/lueur key <KEY> | none — 绑定高亮物体拾取/交互快捷键 (如 F, SHIFT-E, BUTTON4...)",
	"/lueur ore | herb | quest | chest | bobber | other — 针对当前角色显示或隐藏某一分类",
	"/lueur nodes [ore | herb] — 切换小地图草药与矿石的专属图标；nodes size <{nodeSize}> 设置图标大小",
	"/lueur switch [<{nodeSwitchYards}>] — 双采助手：在移动时自动交替切换草药与采矿追踪，可指定切换码数",
	"/lueur scan — 查看小地图上次扫描的结果与解析状态",
	"/lueur ignore — 忽略正面对的物体，或解除忽略；ignore list 查看列表，ignore clear 清空",
	"/lueur language <auto | zhCN | en | fr | de | es | ru> — 设置界面文字与命令语言",
	"/lueur debug — 在聊天框中输出目标调试与诊断信息",
	"/lueur objectives — 列出当前用于物体名称比对的任务目标列表",
	"/lueur status — 显示客户端当前实际应用的参数数值",
	"/lueur help — 显示此帮助信息列表",
}
`;
}

export async function patchLueur(zip) {
  // 1. Add Locales/zhCN.lua
  const zhCNLua = generateLueurZhCN();
  zip.file('Lueur/Locales/zhCN.lua', zhCNLua);

  // 2. Update Locales/Locales.lua if needed to include zhCN in language choices
  const localesFile = zip.file('Lueur/Locales/Locales.lua');
  if (localesFile) {
    let localesContent = await localesFile.async('string');
    // Ensure SAME_AS has zhTW pointing to zhCN if desirable or keep it
    if (!localesContent.includes('zhTW = "zhCN"')) {
      localesContent = localesContent.replace('local SAME_AS = {', 'local SAME_AS = { zhTW = "zhCN",');
    }
    zip.file('Lueur/Locales/Locales.lua', localesContent);
  }

  // 3. Update Lueur.toc
  const tocFile = zip.file('Lueur/Lueur.toc');
  if (tocFile) {
    let toc = await tocFile.async('string');
    if (!toc.includes('Title-zhCN')) {
      toc = toc
        .replace(/## Title: (.*)/, '## Title: $1\n## Title-zhCN: |cff00ff00[任务]|r Lueur (任务品与交互标记加强)')
        .replace(/## Notes: (.*)/, '## Notes: $1\n## Notes-zhCN: 专为探索与做任务打造的交互高亮插件，在接近矿脉、草药、任务物品与宝箱时显示炫彩高亮光芒，支持小地图双采自动交替追踪。');
    }
    if (!toc.includes('Locales\\zhCN.lua')) {
      toc = toc.replace('Locales\\ruRU.lua', 'Locales\\ruRU.lua\nLocales\\zhCN.lua');
    }
    zip.file('Lueur/Lueur.toc', toc);
  }
}
