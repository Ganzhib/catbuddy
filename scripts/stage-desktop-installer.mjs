#!/usr/bin/env node
/**
 * Stage the desktop NSIS installer as a zip in apps/web/public/downloads/.
 *
 * Usage (from catbuddy/):
 *   node scripts/stage-desktop-installer.mjs
 *   node scripts/stage-desktop-installer.mjs --source path/to/installer.exe
 *   node scripts/stage-desktop-installer.mjs --dry-run
 *
 * Env:
 *   CATBUDDY_DESKTOP_RELEASE_DIR  — release | release-fresh (default: try both)
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @see packages/shared/src/desktop-download.ts */
const DESKTOP_INSTALLER_FILENAME = 'catbuddy-setup-win-x64.exe';
const DESKTOP_DOWNLOAD_ARCHIVE_FILENAME = 'catbuddy-setup-win-x64.zip';
const DESKTOP_DOWNLOAD_PATH = `/downloads/${DESKTOP_DOWNLOAD_ARCHIVE_FILENAME}`;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const desktopRoot = path.join(repoRoot, 'apps', 'desktop');
const destDir = path.join(repoRoot, 'apps', 'web', 'public', 'downloads');
const destExe = path.join(destDir, DESKTOP_INSTALLER_FILENAME);
const destZip = path.join(destDir, DESKTOP_DOWNLOAD_ARCHIVE_FILENAME);

function log(msg) {
  console.log(`[stage-desktop-installer] ${msg}`);
}

function parseArgs(argv) {
  let sourceOverride = null;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') dryRun = true;
    else if (a === '--source' && argv[i + 1]) {
      sourceOverride = argv[++i];
    } else if (a === '-h' || a === '--help') {
      console.log(`Usage: node scripts/stage-desktop-installer.mjs [--source <exe>] [--dry-run]`);
      process.exit(0);
    }
  }
  return { sourceOverride, dryRun };
}

function readDesktopMeta() {
  const pkg = JSON.parse(fs.readFileSync(path.join(desktopRoot, 'package.json'), 'utf8'));
  const productName = pkg.build?.productName ?? 'catbuddy';
  const version = pkg.version ?? '0.0.0';
  const expectedName = `${productName} Setup ${version}.exe`;
  return { productName, version, expectedName };
}

function listReleaseDirs() {
  const preferred = process.env.CATBUDDY_DESKTOP_RELEASE_DIR?.trim();
  if (preferred) {
    return [path.join(desktopRoot, preferred)];
  }
  const names = fs
    .readdirSync(desktopRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^release/.test(d.name))
    .map((d) => d.name)
    .sort((a, b) => {
      const ta = fs.statSync(path.join(desktopRoot, a)).mtimeMs;
      const tb = fs.statSync(path.join(desktopRoot, b)).mtimeMs;
      return tb - ta;
    });
  return names.map((n) => path.join(desktopRoot, n));
}

function findInstaller({ expectedName }) {
  for (const dir of listReleaseDirs()) {
    if (!fs.existsSync(dir)) continue;

    const exact = path.join(dir, expectedName);
    if (fs.existsSync(exact)) {
      return { src: exact, releaseDir: dir };
    }

    const setups = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.exe') && /setup/i.test(e.name))
      .map((e) => e.name)
      .sort((a, b) => {
        const ta = fs.statSync(path.join(dir, a)).mtimeMs;
        const tb = fs.statSync(path.join(dir, b)).mtimeMs;
        return tb - ta;
      });

    if (setups.length > 0) {
      return { src: path.join(dir, setups[0]), releaseDir: dir };
    }
  }
  return null;
}

function formatBytes(n) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function createZipArchive(exePath, zipPath) {
  const dir = path.dirname(exePath);
  const base = path.basename(exePath);
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

  const tryTar = () => {
    const r = spawnSync('tar', ['-acf', zipPath, '-C', dir, base], {
      stdio: 'pipe',
      encoding: 'utf8',
    });
    if (r.status !== 0 && r.stderr?.trim()) log(`tar: ${r.stderr.trim()}`);
    return r.status === 0 && fs.existsSync(zipPath);
  };

  const tryZip = () => {
    const r = spawnSync('zip', ['-j', zipPath, exePath], { stdio: 'pipe', encoding: 'utf8' });
    if (r.status !== 0 && r.stderr?.trim()) log(`zip: ${r.stderr.trim()}`);
    return r.status === 0 && fs.existsSync(zipPath);
  };

  if (tryTar()) return;
  if (tryZip()) return;
  log('error: could not create zip (need `tar -acf` or `zip` on PATH)');
  process.exit(1);
}

const { sourceOverride, dryRun } = parseArgs(process.argv.slice(2));
const meta = readDesktopMeta();

let srcPath = sourceOverride ? path.resolve(sourceOverride) : null;
let releaseDir = null;

if (srcPath) {
  if (!fs.existsSync(srcPath)) {
    log(`error: --source not found: ${srcPath}`);
    process.exit(1);
  }
} else {
  const found = findInstaller(meta);
  if (!found) {
    log('error: no NSIS installer found.');
    log(`  looked in: ${listReleaseDirs().join(', ')}`);
    log(`  expected: ${meta.expectedName} (or any *Setup*.exe)`);
    log('  run: pnpm build:desktop');
    process.exit(1);
  }
  srcPath = found.src;
  releaseDir = found.releaseDir;
}

const { size: srcSize } = fs.statSync(srcPath);

log(`source: ${srcPath}${releaseDir ? ` (${path.basename(releaseDir)})` : ''}`);
log(`dest:   ${destZip}`);
log(`exe:    ${formatBytes(srcSize)}`);

if (dryRun) {
  log('dry-run — no files written');
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(srcPath, destExe);
createZipArchive(destExe, destZip);
fs.unlinkSync(destExe);

const { size: zipSize } = fs.statSync(destZip);
const ratio = srcSize > 0 ? ((1 - zipSize / srcSize) * 100).toFixed(0) : '0';
log(`zip:    ${formatBytes(zipSize)} (~${ratio}% vs raw exe)`);
log(`ok → public${DESKTOP_DOWNLOAD_PATH}`);
