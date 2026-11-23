import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WoWSimulatorRuntimeCore } from './runtime-core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WOW_LUA_SHIM = fs.readFileSync(path.join(__dirname, 'wow-shim.lua'), 'utf8');

/**
 * Node 侧运行时：从磁盘读取 wow-shim.lua，再交给与环境无关的核心实现。
 * 浏览器侧请直接使用 runtime-core.js 并自行注入 shim 源码。
 */
export class WoWSimulatorRuntime extends WoWSimulatorRuntimeCore {
  constructor(initialChar = {}) {
    super(initialChar, { shimSource: WOW_LUA_SHIM });
  }
}
