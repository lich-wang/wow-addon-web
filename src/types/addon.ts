export type GameFlavor = 'retail' | 'forever' | 'classic' | 'vanilla' | 'cata' | 'ptr' | 'unknown';

export interface AddonInfo {
  id: string; // Folder name
  name: string; // Cleaned title
  rawTitle: string; // Original title with color codes
  version: string;
  author: string;
  notes: string;
  interfaceVersion: string;
  gameFlavor: GameFlavor;
  curseId?: string;
  wagoId?: string;
  folderName: string;
  fileCount: number;
  totalSize: number; // in bytes
  modifiedTime: number;
  status: 'up-to-date' | 'update-available' | 'unknown' | 'local-only';
  latestVersion?: string;
  downloadUrl?: string;
  dependencies: string[];
  category?: string;
  icon?: string;
}

export interface CuratedAddon {
  id: string;
  name: string;
  description: string;
  author: string;
  category: 'Combat' | 'UI' | 'Raid' | 'QoL' | 'PvP' | 'Trade';
  icon: string;
  defaultFolderName: string;
  latestVersion: string;
  downloadUrl: string;
  curseSlug?: string;
  githubRepo?: string;
  homeUrl?: string;
  gameFlavors?: GameFlavor[];
  isForeverRecommended?: boolean;
}

export interface DirectoryState {
  handle: FileSystemDirectoryHandle | null;
  mode?: 'browser' | 'agent';
  agentPath?: string;
  folderName: string;
  fullPathHint: string;
  isAuthorized: boolean;
  flavor: GameFlavor;
  addonCount: number;
}

export interface InstallProgress {
  status: 'idle' | 'downloading' | 'extracting' | 'writing' | 'completed' | 'error';
  addonName: string;
  percent: number;
  message: string;
}
