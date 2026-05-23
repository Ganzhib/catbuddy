#!/usr/bin/env node
/**
 * Copy the desktop NSIS installer into apps/web/public/downloads/ for Web UI download button.
 *
 * Usage (from learnbuddy/):
 *   node scripts/stage-desktop-installer.mjs
 *   node scripts/stage-desktop-installer.mjs --source path/to/installer.exe
 *   node scripts/stage-desktop-installer.mjs --dry-run
 *
 * Env:
 *   LEARNBUDDY_DESKTOP_RELEASE_DIR  — release | release-fresh (default: try both)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @see packages/shared/src/desktop-download.ts */
const DESKTOP_INSTALLER_FILENAME = 'learnbuddy-setup-win-x64.exe';
const DESKTOP_DOWNLOAD_PATH = `/downloads/${DESKTOP_INSTALLER_FILENAME}`;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const desktopRoot = path.join(repoRoot, 'apps', 'desktop');
const destDir = path.join(repoRoot, 'apps', 'web', 'public', 'downloads');
const destFile = path.join(destDir, DESKTOP_INSTALLER_FILENAME);

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
  const productName = pkg.build?.productName ?? 'learnbuddy';
  const version = pkg.version ?? '0.0.0';
  const expectedName = `${productName} Setup ${version}.exe`;
  return { productName, version, expectedName };
}

function listReleaseDirs() {
  const preferred = process.env.LEARNBUDDY_DESKTOP_RELEASE_DIR?.trim();
  if (preferred) {
    return [path.join(desktopRoot, preferred)];
  }
  return [path.join(desktopRoot, 'release-fresh'), path.join(desktopRoot, 'release')];
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
log(`dest:   ${destFile}`);
log(`size:   ${formatBytes(srcSize)}`);

if (dryRun) {
  log('dry-run — no files copied');
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(srcPath, destFile);

const { size: destSize } = fs.statSync(destFile);
if (destSize !== srcSize) {
  log(`error: size mismatch after copy (${srcSize} vs ${destSize})`);
  process.exit(1);
}

log(`ok → public/${DESKTOP_DOWNLOAD_PATH}`);
