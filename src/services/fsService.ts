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
 * Resolve target AddOns directory handle
 * Gracefully navigates if user selected root WoW folder, _retail_, or Interface
 */
export async function resolveAddOnsDirectory(
  pickedHandle: FileSystemDirectoryHandle
): Promise<{ handle: FileSystemDirectoryHandle; pathHint: string; flavor: GameFlavor }> {
  const rootName = pickedHandle.name.toLowerCase();

  // 1. Direct AddOns folder
  if (rootName === 'addons') {
    return { handle: pickedHandle, pathHint: '.../Interface/AddOns', flavor: 'retail' };
  }

  // 2. Interface folder
  try {
    const addonsHandle = await pickedHandle.getDirectoryHandle('AddOns');
    return { handle: addonsHandle, pathHint: `${pickedHandle.name}/AddOns`, flavor: 'retail' };
  } catch {
    // Continue checking
  }

  // 3. Flavor folder like _retail_, _classic_, etc.
  try {
    const interfaceHandle = await pickedHandle.getDirectoryHandle('Interface');
    const addonsHandle = await interfaceHandle.getDirectoryHandle('AddOns');
    const flavor: GameFlavor = rootName.includes('classic') ? 'classic' : 'retail';
    return { handle: addonsHandle, pathHint: `${pickedHandle.name}/Interface/AddOns`, flavor };
  } catch {
    // Continue checking
  }

  // 4. WoW Root folder containing _retail_
  for (const flavorSub of ['_retail_', '_classic_', '_era_', '_ptr_']) {
    try {
      const subHandle = await pickedHandle.getDirectoryHandle(flavorSub);
      const interfaceHandle = await subHandle.getDirectoryHandle('Interface');
      const addonsHandle = await interfaceHandle.getDirectoryHandle('AddOns');
      return {
        handle: addonsHandle,
        pathHint: `${pickedHandle.name}/${flavorSub}/Interface/AddOns`,
        flavor: flavorSub.includes('classic') ? 'classic' : 'retail',
      };
    } catch {
      // ignore
    }
  }

  // If none matched, assume the user picked their custom AddOns folder directly
  return { handle: pickedHandle, pathHint: pickedHandle.name, flavor: 'retail' };
}

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

  // @ts-expect-error showDirectoryPicker is standard in Chromium
  const rawHandle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
    mode: 'readwrite',
    id: 'wow-addons-dir',
    startIn: 'desktop',
  });

  const resolved = await resolveAddOnsDirectory(rawHandle);
  await set(IDB_HANDLE_KEY, resolved.handle);
  return resolved;
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
  await del(IDB_HANDLE_KEY);
}

/**
 * Verify or query permission for directory handle
 */
export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<boolean> {
  // @ts-expect-error queryPermission exists on handle
  if ((await handle.queryPermission({ mode })) === 'granted') {
    return true;
  }
  // @ts-expect-error requestPermission exists on handle
  if ((await handle.requestPermission({ mode })) === 'granted') {
    return true;
  }
  return false;
}

/**
 * Scan all addons inside the AddOns directory
 */
export async function scanAddOns(dirHandle: FileSystemDirectoryHandle): Promise<AddonInfo[]> {
  const addons: AddonInfo[] = [];

  for await (const [entryName, entryHandle] of (dirHandle as any).entries()) {
    if (entryHandle.kind !== 'directory') continue;

    const subDirHandle = entryHandle as FileSystemDirectoryHandle;
    let tocFound = false;
    let tocContent = '';
    let fileCount = 0;
    let totalSize = 0;
    let latestModified = 0;

    const tocCandidates: { name: string; file: File }[] = [];

    try {
      for await (const [childName, childHandle] of (subDirHandle as any).entries()) {
        if (childHandle.kind === 'file') {
          fileCount++;
          try {
            const file = await (childHandle as FileSystemFileHandle).getFile();
            totalSize += file.size;
            if (file.lastModified > latestModified) {
              latestModified = file.lastModified;
            }
            if (childName.toLowerCase().endsWith('.toc')) {
              tocCandidates.push({ name: childName, file });
            }
          } catch {
            // ignore unreadable file
          }
        }
      }

      if (tocCandidates.length > 0) {
        tocFound = true;
        const exactMatch = tocCandidates.find(
          (t) => t.name.toLowerCase() === `${entryName.toLowerCase()}.toc`
        );
        const mainlineMatch = tocCandidates.find((t) =>
          t.name.toLowerCase().includes('mainline')
        );
        const chosen = exactMatch || mainlineMatch || tocCandidates[0];
        tocContent = await chosen.file.text();
      }
    } catch {
      // Cannot read directory
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
