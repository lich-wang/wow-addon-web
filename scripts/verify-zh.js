import fs from 'fs';

const s = fs.readFileSync('C:/Program Files (x86)/World of Warcraft/_forever_/Interface/AddOns/Blackthornes_TS/Locale/zhCN.lua', 'utf8');
console.log('First 15 lines:\n' + s.split('\n').slice(0, 15).join('\n'));
console.log('Does it have \\u6211 ?', s.includes('\\u6211'));
console.log('Does it have raw "利润" ?', s.includes('"利润"'));
console.log('Does it have raw "制造队列" ?', s.includes('"制造队列"'));
console.log('Does it have raw "材料清单" ?', s.includes('"材料清单"'));
console.log('Does it have raw "拍卖上架" ?', s.includes('"拍卖上架"'));
