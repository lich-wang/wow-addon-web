import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const OUTPUT_DIR = path.resolve('public/addons');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const HEADERS = {
  'User-Agent': 'WoW-Addon-Manager-Builder/1.0',
  ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
};

const ADDONS = [
  {
    id: 'questie',
    repo: 'Questie/Questie',
    isQuestieBundle: true,
  },
  {
    id: 'threatclassic2',
    repo: 'dfherr/ThreatClassic2',
  },
  {
    id: 'classiccastbars',
    repo: 'wardz/ClassicCastbars',
  },
  {
    id: 'weaponswingtimer',
    repo: 'LeftHandedGlove/WeaponSwingTimerAddon',
    archiveBranch: 'master',
    targetFolder: 'WeaponSwingTimer',
  },
  {
    id: 'whatstraining',
    repo: 'fusionpit/WhatsTraining',
  },
  {
    id: 'atlasloot',
    repo: 'Hoizame/AtlasLootClassic',
  },
  {
    id: 'weakauras',
    repo: 'WeakAuras/WeakAuras2',
  },
  {
    id: 'details',
    repo: 'Tercioo/Details-Damage-Meter',
    archiveBranch: 'master',
    targetFolder: 'Details',
  },
  {
    id: 'dbm',
    repo: 'DeadlyBossMods/DeadlyBossMods',
  },
  {
    id: 'leatrix-plus',
    repo: 'Sattva-108/Leatrix_Plus',
    archiveBranch: 'master',
    targetFolder: 'Leatrix_Plus',
  },
  {
    id: 'bartender4',
    repo: 'Nevcairiel/Bartender4',
  },
  {
    id: 'omnicc',
    repo: 'tullamods/OmniCC',
  },
  {
    id: 'bagnon',
    repo: 'Jaliborc/Bagnon',
    archiveBranch: 'master',
    targetFolder: 'Bagnon',
  },
  {
    id: 'auctionator',
    repo: 'Wetxius/Auctionator',
    archiveBranch: 'master',
    targetFolder: 'Auctionator',
  },
  {
    id: 'plater',
    repo: 'Tercioo/Plater-Nameplates',
    archiveBranch: 'master',
    targetFolder: 'Plater',
  },
  {
    id: 'mdt',
    repo: 'Nnoggie/MythicDungeonTools',
  },
  {
    id: 'simc',
    repo: 'simulationcraft/simc-addon',
  },
];

async function getLatestReleaseZip(repo) {
  const url = `https://api.github.com/repos/${repo}/releases?per_page=1`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  const releases = await res.json();
  if (!releases.length) throw new Error(`No releases found for ${repo}`);
  const release = releases[0];
  const zipAsset = release.assets.find((a) => a.name.toLowerCase().endsWith('.zip'));
  if (!zipAsset) throw new Error(`No zip asset in release ${release.tag_name} for ${repo}`);
  return {
    url: zipAsset.browser_download_url,
    tag: release.tag_name,
    name: zipAsset.name,
    size: zipAsset.size,
  };
}

async function downloadBuffer(url) {
  console.log(`  Downloading: ${url}`);
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function processAddon(addon) {
  const outputFile = path.join(OUTPUT_DIR, `${addon.id}.zip`);
  console.log(`\n[+] Processing ${addon.id} (${addon.repo})...`);

  try {
    let zipBuffer;
    if (addon.archiveBranch) {
      const archiveUrl = `https://github.com/${addon.repo}/archive/refs/heads/${addon.archiveBranch}.zip`;
      const rawZip = await downloadBuffer(archiveUrl);
      
      // Repack archive so folder name matches targetFolder
      const zip = await JSZip.loadAsync(rawZip);
      const newZip = new JSZip();
      
      // Find top folder prefix (e.g. WeaponSwingTimerAddon-master/)
      const rootFolder = Object.keys(zip.files)[0].split('/')[0];
      for (const [relativePath, file] of Object.entries(zip.files)) {
        if (file.dir) continue;
        const subPath = relativePath.startsWith(rootFolder + '/') 
          ? relativePath.substring(rootFolder.length + 1)
          : relativePath;
        const content = await file.async('nodebuffer');
        newZip.file(`${addon.targetFolder}/${subPath}`, content);
      }
      zipBuffer = await newZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    } else {
      const releaseInfo = await getLatestReleaseZip(addon.repo);
      const rawZip = await downloadBuffer(releaseInfo.url);

      if (addon.isQuestieBundle) {
        console.log(`  Optimizing Questie for Forever/Classic to stay within Cloudflare 25MB limit...`);
        const zip = await JSZip.loadAsync(rawZip);
        const newZip = new JSZip();
        
        for (const [relativePath, file] of Object.entries(zip.files)) {
          // Exclude huge Cata, Mists, Wrath, TBC databases not needed for Forever (level 60)
          if (
            relativePath.includes('Mists') ||
            relativePath.includes('Cata') ||
            relativePath.includes('Wrath') ||
            relativePath.includes('TBC') ||
            relativePath.includes('Camelot') ||
            relativePath.includes('cataItemDrops') ||
            relativePath.includes('mopItemDrops') ||
            relativePath.includes('wotlkItemDrops') ||
            relativePath.includes('tbcItemDrops') ||
            relativePath.includes('factionTemplateMoP') ||
            relativePath.includes('factionTemplateCata') ||
            relativePath.includes('factionTemplateWotlk') ||
            relativePath.includes('factionTemplateTBC')
          ) {
            continue;
          }
          if (file.dir) {
            newZip.folder(relativePath);
          } else {
            const content = await file.async('nodebuffer');
            newZip.file(relativePath, content);
          }
        }
        zipBuffer = await newZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
      } else {
        zipBuffer = rawZip;
      }
    }

    fs.writeFileSync(outputFile, zipBuffer);
    const sizeMb = (zipBuffer.length / (1024 * 1024)).toFixed(2);
    console.log(`  [OK] Saved ${addon.id}.zip (${sizeMb} MB)`);
    return { id: addon.id, size: sizeMb, success: true };
  } catch (err) {
    console.error(`  [FAIL] Failed to process ${addon.id}:`, err.message);
    return { id: addon.id, error: err.message, success: false };
  }
}

async function main() {
  console.log(`Starting addon fetch and bundle into ${OUTPUT_DIR}...`);
  const results = [];
  for (const addon of ADDONS) {
    const res = await processAddon(addon);
    results.push(res);
  }

  console.log('\n================ Summary ================');
  for (const r of results) {
    if (r.success) {
      console.log(`  ✓ ${r.id.padEnd(20)} : ${r.size} MB`);
    } else {
      console.log(`  ✗ ${r.id.padEnd(20)} : ${r.error}`);
    }
  }
}

main();
