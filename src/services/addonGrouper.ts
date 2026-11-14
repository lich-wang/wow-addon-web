import type { AddonInfo } from '../types/addon';

interface BundleRule {
  id: string;
  mainFolder: string;
  matcher: (folderName: string) => boolean;
}

const KNOWN_BUNDLES: BundleRule[] = [
  {
    id: 'dungeonsforever',
    mainFolder: 'DungeonsForever',
    matcher: (f) => {
      const lower = f.toLowerCase();
      return (
        lower === 'df_cnlocale' ||
        (lower.startsWith('dungeonsforever') && lower !== 'dungeonsforever')
      );
    },
  },
  {
    id: 'bagnon',
    mainFolder: 'Bagnon',
    matcher: (f) => {
      const lower = f.toLowerCase();
      return (
        lower === 'bagbrother' ||
        (lower.startsWith('bagnon_') && lower !== 'bagnon')
      );
    },
  },
  {
    id: 'icehud',
    mainFolder: 'IceHUD',
    matcher: (f) =>
      f.toLowerCase().startsWith('icehud_') && f.toLowerCase() !== 'icehud',
  },
  {
    id: 'dbm',
    mainFolder: 'DBM-Core',
    matcher: (f) => {
      const lower = f.toLowerCase();
      return (
        (lower.startsWith('dbm-') || lower.startsWith('dbm_')) &&
        lower !== 'dbm-core'
      );
    },
  },
  {
    id: 'details',
    mainFolder: 'Details',
    matcher: (f) => {
      const lower = f.toLowerCase();
      return (
        (lower.startsWith('details_') || lower.startsWith('details-')) &&
        lower !== 'details'
      );
    },
  },
  {
    id: 'bigwigs',
    mainFolder: 'BigWigs',
    matcher: (f) =>
      f.toLowerCase().startsWith('bigwigs_') && f.toLowerCase() !== 'bigwigs',
  },
  {
    id: 'weakauras',
    mainFolder: 'WeakAuras',
    matcher: (f) =>
      f.toLowerCase().startsWith('weakauras') && f.toLowerCase() !== 'weakauras',
  },
  {
    id: 'foreverauras',
    mainFolder: 'ForeverAuras',
    matcher: (f) =>
      f.toLowerCase().startsWith('foreverauras') && f.toLowerCase() !== 'foreverauras',
  },
  {
    id: 'tradeskillmaster',
    mainFolder: 'TradeSkillMaster',
    matcher: (f) =>
      f.toLowerCase().startsWith('tradeskillmaster_') &&
      f.toLowerCase() !== 'tradeskillmaster',
  },
  {
    id: 'questie',
    mainFolder: 'Questie',
    matcher: (f) => {
      const lower = f.toLowerCase();
      return lower.startsWith('questie') && lower !== 'questie';
    },
  },
  {
    id: 'btwquests',
    mainFolder: 'BtWQuests',
    matcher: (f) => {
      const lower = f.toLowerCase();
      return lower.startsWith('btwquests') && lower !== 'btwquests';
    },
  },
];

/**
 * Group multiple sub-module folders (like Bagnon + BagBrother, or DungeonsForever + DungeonsForeverClass)
 * into a single unified entry in the interface.
 */
export function groupAddons(addons: AddonInfo[]): AddonInfo[] {
  const byFolder = new Map<string, AddonInfo>();
  for (const a of addons) {
    byFolder.set(a.folderName.toLowerCase(), a);
  }

  const consumed = new Set<string>();
  const result: AddonInfo[] = [];

  // 1. Process known bundles
  for (const bundle of KNOWN_BUNDLES) {
    const mainKey = bundle.mainFolder.toLowerCase();
    const mainAddon = byFolder.get(mainKey);

    const children: AddonInfo[] = [];
    for (const a of addons) {
      if (a.folderName.toLowerCase() !== mainKey && bundle.matcher(a.folderName)) {
        children.push(a);
      }
    }

    if (children.length > 0) {
      children.forEach((c) => consumed.add(c.folderName.toLowerCase()));

      if (mainAddon) {
        consumed.add(mainKey);
        const subFolders = children.map((c) => c.folderName);
        const mergedSize =
          mainAddon.totalSize +
          children.reduce((sum, c) => sum + c.totalSize, 0);
        const mergedFiles =
          mainAddon.fileCount +
          children.reduce((sum, c) => sum + c.fileCount, 0);

        result.push({
          ...mainAddon,
          subFolders,
          isBundle: true,
          totalSize: mergedSize,
          fileCount: mergedFiles,
        });
      } else {
        // If main folder not present, pick the first child as main
        const first = children[0];
        consumed.add(first.folderName.toLowerCase());
        const rest = children.slice(1);
        const subFolders = rest.map((c) => c.folderName);

        result.push({
          ...first,
          subFolders,
          isBundle: true,
          totalSize:
            first.totalSize + rest.reduce((sum, c) => sum + c.totalSize, 0),
          fileCount:
            first.fileCount + rest.reduce((sum, c) => sum + c.fileCount, 0),
        });
      }
    }
  }

  // 2. Generic prefix rule for remaining addons (e.g. AddonX and AddonX_Options)
  const remaining = addons.filter(
    (a) => !consumed.has(a.folderName.toLowerCase())
  );
  const genericConsumed = new Set<string>();

  for (const a of remaining) {
    if (genericConsumed.has(a.folderName.toLowerCase())) continue;

    const prefixUnderscore = a.folderName.toLowerCase() + '_';
    const prefixHyphen = a.folderName.toLowerCase() + '-';

    const subChildren = remaining.filter((other) => {
      const oKey = other.folderName.toLowerCase();
      return (
        oKey !== a.folderName.toLowerCase() &&
        (oKey.startsWith(prefixUnderscore) || oKey.startsWith(prefixHyphen))
      );
    });

    if (subChildren.length > 0) {
      subChildren.forEach((sc) =>
        genericConsumed.add(sc.folderName.toLowerCase())
      );
      const subFolders = subChildren.map((sc) => sc.folderName);
      const mergedSize =
        a.totalSize + subChildren.reduce((sum, c) => sum + c.totalSize, 0);
      const mergedFiles =
        a.fileCount + subChildren.reduce((sum, c) => sum + c.fileCount, 0);

      result.push({
        ...a,
        subFolders,
        isBundle: true,
        totalSize: mergedSize,
        fileCount: mergedFiles,
      });
    } else {
      result.push(a);
    }
  }

  return result.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
}
