import fs from 'node:fs';
import path from 'node:path';

const REPO = 'lich-wang/wow-addon-web';
const OUTPUT_DIR = path.resolve('public/downloads');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.AUTO_SYNC_TOKEN || '';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; wow-addon-web/1.0)',
  Accept: 'application/vnd.github.v3+json',
  ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
};

/**
 * Download a remote binary file and save it to destPath
 */
async function downloadFile(url, destPath) {
  console.log(`Downloading: ${url} -> ${destPath}`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': HEADERS['User-Agent'],
      ...(GITHUB_TOKEN && url.includes('github') ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
  console.log(`Saved: ${destPath} (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
  return arrayBuffer.byteLength;
}

/**
 * Fetch latest desktop client release and bundle into public/downloads
 */
async function main() {
  console.log(`[fetch-client] Checking latest release for ${REPO}...`);

  let releaseData = null;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: HEADERS,
    });
    if (res.ok) {
      releaseData = await res.json();
    } else {
      console.warn(`[fetch-client] GitHub API returned ${res.status}: ${res.statusText}`);
    }
  } catch (err) {
    console.warn(`[fetch-client] Error contacting GitHub API: ${err.message}`);
  }

  // Fallback version from package.json if API failed
  const pkgVersion = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8')).version || '1.0.7';
  const tag = releaseData?.tag_name || `v${pkgVersion}`;
  const version = tag.replace(/^v/, '');
  const releaseUrl = releaseData?.html_url || `https://github.com/${REPO}/releases/tag/${tag}`;
  const publishedAt = releaseData?.published_at || new Date().toISOString();

  console.log(`[fetch-client] Target release: ${tag} (version ${version})`);

  let winSize = 0;
  let macSize = 0;

  const winFileName = `WoW-Addon-Manager-${tag}.exe`;
  const macFileName = `WoW-Addon-Manager-${tag}.dmg`;

  const winPath = path.join(OUTPUT_DIR, winFileName);
  const winGenericPath = path.join(OUTPUT_DIR, 'WoW-Addon-Manager.exe');

  const macPath = path.join(OUTPUT_DIR, macFileName);
  const macGenericPath = path.join(OUTPUT_DIR, 'WoW-Addon-Manager.dmg');

  if (releaseData?.assets && Array.isArray(releaseData.assets)) {
    // 1. Locate Windows .exe
    const winAsset = releaseData.assets.find(
      (a) => a.name.endsWith('.exe') && !a.name.includes('agent')
    ) || releaseData.assets.find((a) => a.name.endsWith('.exe'));

    if (winAsset?.browser_download_url) {
      try {
        winSize = await downloadFile(winAsset.browser_download_url, winPath);
        fs.copyFileSync(winPath, winGenericPath);
      } catch (e) {
        console.warn(`[fetch-client] Could not download Windows client: ${e.message}`);
      }
    }

    // 2. Locate macOS .dmg
    const macAsset = releaseData.assets.find((a) => a.name.endsWith('.dmg'));
    if (macAsset?.browser_download_url) {
      try {
        macSize = await downloadFile(macAsset.browser_download_url, macPath);
        fs.copyFileSync(macPath, macGenericPath);
      } catch (e) {
        console.warn(`[fetch-client] Could not download macOS client: ${e.message}`);
      }
    }
  }

  // If download failed or skipped, check existing files
  if (fs.existsSync(winGenericPath) && !winSize) {
    winSize = fs.statSync(winGenericPath).size;
    if (!fs.existsSync(winPath)) {
      fs.copyFileSync(winGenericPath, winPath);
    }
  }
  if (fs.existsSync(macGenericPath) && !macSize) {
    macSize = fs.statSync(macGenericPath).size;
    if (!fs.existsSync(macPath)) {
      fs.copyFileSync(macGenericPath, macPath);
    }
  }

  const versionManifest = {
    version,
    tag,
    winUrl: `/downloads/${winFileName}`,
    winFileName,
    winSize,
    macUrl: `/downloads/${macFileName}`,
    macFileName,
    macSize,
    releaseUrl,
    publishedAt,
  };

  const manifestPath = path.join(OUTPUT_DIR, 'client-version.json');
  fs.writeFileSync(manifestPath, JSON.stringify(versionManifest, null, 2), 'utf-8');
  console.log(`[fetch-client] Successfully wrote ${manifestPath}:`);
  console.log(JSON.stringify(versionManifest, null, 2));
}

main().catch((err) => {
  console.error('[fetch-client] Fatal error:', err);
  // Do not crash the entire build if client download fails
  process.exit(0);
});
