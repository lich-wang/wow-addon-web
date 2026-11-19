import fs from 'fs';

const s = fs.readFileSync('C:/Program Files (x86)/World of Warcraft/_forever_/Interface/AddOns/EasyCraft/Locales/zhCN.lua', 'utf8');
console.log('First 15 lines:\n' + s.split('\n').slice(0, 15).join('\n'));
console.log('Does it have \\u6211 ?', s.includes('\\u6211'));
console.log('Does it have raw "炼金术" ?', s.includes('"炼金术"'));
console.log('Does it have raw "拍卖行" ?', s.includes('"拍卖行"'));
console.log('Does it have raw "制造" ?', s.includes('"制造"'));
