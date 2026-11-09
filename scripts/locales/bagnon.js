export async function patchBagnon(zip) {
  // Enhance Bagnon.toc
  const bagnonToc = zip.file('Bagnon/Bagnon.toc');
  if (bagnonToc) {
    let content = await bagnonToc.async('string');
    if (!content.includes('Title-zhCN')) {
      content = content
        .replace(/## Title: (.*)/, '## Title: $1\n## Title-zhCN: |cff00ff00[背包]|r Bagnon (经典背包整合)')
        .replace(/## Notes: (.*)/, '## Notes: $1\n## Notes-zhCN: 经典全能背包整合插件，随时随地查看所有角色背包、银行、公会银行物品，支持搜索、染色与离线浏览。');
      zip.file('Bagnon/Bagnon.toc', content);
    }
  }

  // Enhance BagBrother.toc
  const brotherToc = zip.file('BagBrother/BagBrother.toc');
  if (brotherToc) {
    let content = await brotherToc.async('string');
    if (!content.includes('Title-zhCN')) {
      content = content
        .replace(/## Title: (.*)/, '## Title: $1\n## Title-zhCN: |cff00ff00[背包]|r BagBrother (背包数据服务)')
        .replace(/## Notes: (.*)/, '## Notes: $1\n## Notes-zhCN: Bagnon 背包整合核心数据与跨角色存储支持。');
      zip.file('BagBrother/BagBrother.toc', content);
    }
  }
}
