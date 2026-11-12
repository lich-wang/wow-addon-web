import JSZip from 'jszip';
import { get, set, del } from 'idb-keyval';
import type { AddonInfo, GameFlavor, InstallProgress } from '../types/addon';

const IDB_HANDLE_KEY = 'wow_addons_dir_handle';

/**
 * Check if the browser supports File System Access API
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/**
 * Clean WoW color and texture codes from string
 * Example: "|cffff7d0aDruid|r |TInterface/Icons/Spell:16|t" -> "Druid"
 */
export function cleanWoWString(str: string): string {
  if (!str) return '';
  return str
    .replace(/\|c[0-9a-fA-F]{8}(.*?)\|r/g, '$1')
    .replace(/\|c[0-9a-fA-F]{8}/g, '')
    .replace(/\|r/g, '')
    .replace(/\|T.*?\|t/gi, '')
    .trim();
}

/**
 * Parse a World of Warcraft .toc (Table of Contents) file
 */
export function parseTocFile(content: string, folderName: string): Partial<AddonInfo> {
  const lines = content.split(/\r?\n/);
  const metadata: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('##')) {
      const match = trimmed.match(/^##\s*([^:]+):\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        metadata[key.toLowerCase()] = value;
      }
    }
  }

  // Determine localized title preference (zhCN > default Title)
  const rawTitle = metadata['title-zhcn'] || metadata['title'] || folderName;
  const cleanedTitle = cleanWoWString(rawTitle);

  const rawNotes = metadata['notes-zhcn'] || metadata['notes'] || '';
  const cleanedNotes = cleanWoWString(rawNotes);

  const interfaceVer = metadata['interface'] || '';
  let flavor: GameFlavor = 'unknown';

  if (interfaceVer) {
    const intNum = parseInt(interfaceVer, 10);
    if (intNum >= 110000) flavor = 'retail';
    else if (intNum >= 40000 && intNum < 50000) flavor = 'cata';
    else if (intNum >= 30000 && intNum < 40000) flavor = 'classic';
    else if (intNum >= 10000 && intNum < 20000) flavor = 'vanilla';
    else flavor = 'retail';
  }

  const deps = [
    ...(metadata['dependencies'] ? metadata['dependencies'].split(',') : []),
    ...(metadata['requireddeps'] ? metadata['requireddeps'].split(',') : []),
    ...(metadata['optionaldeps'] ? metadata['optionaldeps'].split(',') : []),
  ].map((d) => d.trim()).filter(Boolean);

  return {
    id: folderName,
    name: cleanedTitle || folderName,
    rawTitle: rawTitle,
    version: metadata['version'] || '未知版本',
    author: metadata['author'] || '未知作者',
    notes: cleanedNotes,
    interfaceVersion: interfaceVer,
    gameFlavor: flavor,
    curseId: metadata['x-curse-project-id'],
    wagoId: metadata['x-wago-id'],
    folderName: folderName,
    dependencies: Array.from(new Set(deps)),
    status: 'local-only',
  };
}

/**
 * Case-insensitive search for a subdirectory inside parent handle
 */
async function findSubdirectory(
  parent: FileSystemDirectoryHandle,
  targetName: string
): Promise<FileSystemDirectoryHandle | null> {
  const target = targetName.toLowerCase();
  try {
    const iter = (parent as any).entries ? (parent as any).entries() : parent;
    for await (const [name, handle] of iter) {
      if (handle.kind === 'directory' && name.toLowerCase() === target) {
        return handle as FileSystemDirectoryHandle;
      }
    }
  } catch {
    // Ignore permission or read error
  }
  return null;
}

/**
 * Resolve target AddOns directory handle
 * Gracefully navigates case-insensitively if user selected root WoW folder, _retail_, or Interface
 */
export async function resolveAddOnsDirectory(
  pickedHandle: FileSystemDirectoryHandle
): Promise<{ handle: FileSystemDirectoryHandle; pathHint: string; flavor: GameFlavor }> {
  const rootName = pickedHandle.name.toLowerCase();

  // 1. Direct AddOns folder (e.g. AddOns or WoW-AddOns)
  if (rootName.includes('addons')) {
    return { handle: pickedHandle, pathHint: `.../${pickedHandle.name}`, flavor: 'retail' };
  }

  // 2. Interface folder: check if contains addons folder
  const directAddons = await findSubdirectory(pickedHandle, 'addons');
  if (directAddons) {
    return { handle: directAddons, pathHint: `${pickedHandle.name}/AddOns`, flavor: 'retail' };
  }

  // 3. Folder containing Interface: check if contains interface -> addons
  const interfaceHandle = await findSubdirectory(pickedHandle, 'interface');
  if (interfaceHandle) {
    const addonsInside = await findSubdirectory(interfaceHandle, 'addons');
    if (addonsInside) {
      const flavor: GameFlavor = rootName.includes('forever')
        ? 'forever'
        : rootName.includes('classic')
        ? 'classic'
        : 'retail';
      return { handle: addonsInside, pathHint: `${pickedHandle.name}/Interface/AddOns`, flavor };
    }
  }

  // 4. WoW Root folder containing _retail_, _classic_, _forever_, etc.
  for (const flavorSub of ['_forever_', '_retail_', '_classic_', '_classic_era_', '_classic_titan_', '_ptr_']) {
    const subFlavorHandle = await findSubdirectory(pickedHandle, flavorSub);
    if (subFlavorHandle) {
      const iface = await findSubdirectory(subFlavorHandle, 'interface');
      if (iface) {
        const addonsInside = await findSubdirectory(iface, 'addons');
        if (addonsInside) {
          const isForever = flavorSub.includes('forever');
          const isVanilla = flavorSub.includes('era');
          return {
            handle: addonsInside,
            pathHint: `${pickedHandle.name}/${flavorSub}/Interface/AddOns`,
            flavor: isForever
              ? 'forever'
              : isVanilla
              ? 'vanilla'
              : flavorSub.includes('classic')
              ? 'classic'
              : 'retail',
          };
        }
      }
    }
  }

  // 5. Default fallback: user selected custom addons folder directly
  return { handle: pickedHandle, pathHint: pickedHandle.name, flavor: 'retail' };
}

let isPickerActive = false;

/**
 * Ask user to pick the directory
 */
export async function pickAddOnsDirectory(): Promise<{
  handle: FileSystemDirectoryHandle;
  pathHint: string;
  flavor: GameFlavor;
}> {
  if (!isFileSystemAccessSupported()) {
    throw new Error('当前浏览器不支持本地文件系统访问，请使用 Chrome、Edge 或 Brave 浏览器');
  }

  if (isPickerActive) {
    throw new Error('文件夹选择窗口已处于打开状态，请检查任务栏或按 Alt + Tab 切换到打开的窗口！');
  }

  isPickerActive = true;
  try {
    let rawHandle: FileSystemDirectoryHandle;
    try {
      // @ts-expect-error showDirectoryPicker is standard in Chromium
      rawHandle = await window.showDirectoryPicker({
        startIn: 'desktop',
      });
    } catch (err: any) {
      if (err.name === 'SecurityError' || (err.message && /sensitive|restricted|not allowed|security/i.test(err.message))) {
        throw new Error(
          '受浏览器系统安全保护限制，无法直接选择系统盘（如 C:\\Program Files）下的目录。\n\n' +
          '💡 解决方案：\n' +
          '1.【移动游戏】：将魔兽世界整体文件夹移动到非系统盘（如 D 盘或 E 盘），即可在网页端正常选择管理；\n' +
          '2.【换用本地客户端】：下载并运行本站单文件绿色桌面端（免安装、可直接读写系统盘）。'
        );
      }
      if (err.name === 'AbortError') {
        throw new Error(
          '未完成文件夹选择。\n\n' +
          '⚠️ 若您的魔兽世界安装在系统盘（如 C:\\Program Files），受浏览器安全保护限制无法直接选择。\n' +
          '💡 建议解决方案：\n' +
          '1.【移动游戏】：将魔兽世界整体文件夹移动到非系统盘（如 D 盘或 E 盘），即可在网页端正常选择管理；\n' +
          '2.【换用本地客户端】：下载并运行本站单文件绿色桌面端（免安装、可直接读写系统盘）。'
        );
      }
      if (err.message && err.message.includes('already active')) {
        throw new Error('文件夹选择窗口已在后台打开，请检查任务栏或按 Alt + Tab 查看已打开的窗口！');
      }
      throw err;
    }

    // Request readwrite permission explicitly if supported
    try {
      // @ts-expect-error requestPermission
      if (rawHandle.requestPermission) {
        // @ts-expect-error requestPermission
        await rawHandle.requestPermission({ mode: 'readwrite' });
      }
    } catch (permErr) {
      console.warn('Permission request error:', permErr);
    }

    const resolved = await resolveAddOnsDirectory(rawHandle);

    // Safely persist handle in IndexedDB
    try {
      await set(IDB_HANDLE_KEY, resolved.handle);
    } catch (idbErr) {
      console.warn('Could not save handle to IndexedDB (e.g. private mode):', idbErr);
    }

    return resolved;
  } finally {
    isPickerActive = false;
  }
}

/**
 * Restore directory handle saved in IndexedDB
 */
export async function getSavedDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await get<FileSystemDirectoryHandle>(IDB_HANDLE_KEY);
    return handle || null;
  } catch {
    return null;
  }
}

/**
 * Clear stored handle
 */
export async function clearSavedDirectoryHandle(): Promise<void> {
  try {
    await del(IDB_HANDLE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Verify or query permission for directory handle
 */
export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<boolean> {
  try {
    // @ts-expect-error queryPermission exists on handle
    if ((await handle.queryPermission({ mode })) === 'granted') {
      return true;
    }
    // @ts-expect-error requestPermission exists on handle
    if ((await handle.requestPermission({ mode })) === 'granted') {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Scan all addons inside the AddOns directory
 * High-performance: iterates entries and only reads .toc files
 */
export async function scanAddOns(dirHandle: FileSystemDirectoryHandle): Promise<AddonInfo[]> {
  const addons: AddonInfo[] = [];

  const iter = (dirHandle as any).entries ? (dirHandle as any).entries() : dirHandle;

  for await (const [entryName, entryHandle] of iter) {
    if (entryHandle.kind !== 'directory') continue;

    const subDirHandle = entryHandle as FileSystemDirectoryHandle;
    let tocFound = false;
    let tocContent = '';
    let fileCount = 0;
    let totalSize = 0;
    let latestModified = 0;

    const tocHandles: { name: string; handle: FileSystemFileHandle }[] = [];

    try {
      const childIter = (subDirHandle as any).entries
        ? (subDirHandle as any).entries()
        : subDirHandle;

      for await (const [childName, childHandle] of childIter) {
        if (childHandle.kind === 'file') {
          fileCount++;
          if (childName.toLowerCase().endsWith('.toc')) {
            tocHandles.push({ name: childName, handle: childHandle as FileSystemFileHandle });
          }
        }
      }

      // Read only the matched .toc file for maximum performance
      if (tocHandles.length > 0) {
        tocFound = true;
        const exactMatch = tocHandles.find(
          (t) => t.name.toLowerCase() === `${entryName.toLowerCase()}.toc`
        );
        const mainlineMatch = tocHandles.find((t) =>
          t.name.toLowerCase().includes('mainline')
        );
        const chosen = exactMatch || mainlineMatch || tocHandles[0];

        try {
          const file = await chosen.handle.getFile();
          latestModified = file.lastModified;
          totalSize = file.size;
          tocContent = await file.text();
        } catch (readErr) {
          console.warn(`Could not read TOC file for ${entryName}:`, readErr);
        }
      }
    } catch (e) {
      console.warn(`Error scanning folder ${entryName}:`, e);
    }

    if (tocFound && tocContent) {
      const parsed = parseTocFile(tocContent, entryName);
      addons.push({
        ...(parsed as AddonInfo),
        fileCount,
        totalSize,
        modifiedTime: latestModified || Date.now(),
      });
    } else {
      addons.push({
        id: entryName,
        name: entryName,
        rawTitle: entryName,
        version: '未知',
        author: '未知',
        notes: '未找到标准 .toc 文件，可能为内置支持库或模块',
        interfaceVersion: '',
        gameFlavor: 'unknown',
        folderName: entryName,
        fileCount,
        totalSize,
        modifiedTime: latestModified || Date.now(),
        status: 'local-only',
        dependencies: [],
      });
    }
  }

  return addons.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

/**
 * Recursively write files from a JSZip archive into the target directory handle
 */
export async function installAddonFromZip(
  targetDirHandle: FileSystemDirectoryHandle,
  zipBlob: Blob | ArrayBuffer,
  onProgress?: (progress: InstallProgress) => void
): Promise<{ installedFolders: string[] }> {
  onProgress?.({
    status: 'extracting',
    addonName: '插件压缩包',
    percent: 10,
    message: '正在解压 ZIP 文件包...',
  });

  const zip = await JSZip.loadAsync(zipBlob);
  const fileEntries = Object.keys(zip.files).filter((path) => !zip.files[path].dir);
  const totalFiles = fileEntries.length;

  if (totalFiles === 0) {
    throw new Error('ZIP 压缩包中没有有效文件');
  }

  const topLevelFolders = new Set<string>();
  for (const path of Object.keys(zip.files)) {
    const parts = path.split('/').filter(Boolean);
    if (parts.length > 0) {
      topLevelFolders.add(parts[0]);
    }
  }

  let written = 0;
  onProgress?.({
    status: 'writing',
    addonName: Array.from(topLevelFolders).join(', '),
    percent: 20,
    message: `准备写入本地目录 (共 ${totalFiles} 个文件)...`,
  });

  for (const filePath of fileEntries) {
    const fileEntry = zip.files[filePath];
    const pathParts = filePath.split('/').filter(Boolean);
    const fileName = pathParts.pop()!;

    let currentDir = targetDirHandle;
    for (const subDirName of pathParts) {
      currentDir = await currentDir.getDirectoryHandle(subDirName, { create: true });
    }

    const fileData = await fileEntry.async('uint8array');
    const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
    const writableStream = await (fileHandle as any).createWritable();
    await writableStream.write(new Blob([fileData as any]));
    await writableStream.close();

    written++;
    if (written % 5 === 0 || written === totalFiles) {
      const percent = Math.min(95, Math.floor(20 + (written / totalFiles) * 75));
      onProgress?.({
        status: 'writing',
        addonName: Array.from(topLevelFolders).join(', '),
        percent,
        message: `正在写入: ${written}/${totalFiles} (${Math.round((written / totalFiles) * 100)}%)`,
      });
    }
  }

  onProgress?.({
    status: 'completed',
    addonName: Array.from(topLevelFolders).join(', '),
    percent: 100,
    message: `安装成功！已写入 ${topLevelFolders.size} 个插件目录`,
  });

  return { installedFolders: Array.from(topLevelFolders) };
}

/**
 * Remove an addon directory completely
 */
export async function deleteAddon(
  addonsDirHandle: FileSystemDirectoryHandle,
  folderName: string
): Promise<void> {
  await (addonsDirHandle as any).removeEntry(folderName, { recursive: true });
}

/**
 * Format bytes to readable size (KB, MB)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
