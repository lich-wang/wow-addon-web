std = "lua51"
max_line_length = false

globals = {
  "WoWF_Data",
  "WoWFDB",
  "WoWF_CraftArb",
  "SLASH_WOWF1",
  "SLASH_WOWF2",
  "SlashCmdList",
  "BlackthornesTSDB",
  _G = {
    fields = {
      BlackthornesTSDB = { other_fields = true },
    },
  },
}

read_globals = {
  "UIParent",
  "Minimap",
  "WorldMapFrame",
  "GameTooltip",
  "DEFAULT_CHAT_FRAME",
  "CreateFrame",
  "C_Timer",
  "C_TradeSkillUI",
  "C_Map",
  "C_QuestLog",
  "Enum",
  "QuestieDB",
  "EasyAuctionAPI",
  "EasyAuctionDB12",
}

ignore = {
  "113", -- accessing undefined global (WoW 16001 client APIs)
  "211", -- unused local variable
  "212", -- unused argument
  "213", -- unused loop variable
  "231", -- variable is never accessed
  "311", -- value assigned to local variable is unused
  "411", -- shadowing local variable
  "412", -- shadowing argument
  "421", -- shadowing local variable
  "431", -- shadowing upvalue
  "611", -- line contains only whitespace
  "612", -- line contains trailing whitespace
  "614", -- trailing whitespace in a comment
}
