#!/usr/bin/env node
/**
 * Clear apps/desktop release folders (win-unpacked); pick electron-builder output dir.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'apps',
  'desktop',
);

const PREFERRED_OUTPUT_DIRS = ['release', 'release-fresh'];

function log(msg) {
  console.log(`[unlock-release] ${msg}`);
}

function sleepMs(ms) {
  spawnSync(process.execPath, ['-e', `const d=Date.now();while(Date.now()-d<${ms});`], {
    stdio: 'ignore',
    windowsHide: true,
  });
}

function tryRm(target) {
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
}

function tryRmdirWindows(target) {
  spawnSync('cmd.exe', ['/c', 'rmdir', '/s', '/q', target], {
    stdio: 'ignore',
    windowsHide: true,
  });
}

function tryClearUnpacked(unpacked) {
  if (!fs.existsSync(unpacked)) return true;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      tryRm(unpacked);
      return true;
    } catch {
      if (process.platform === 'win32') tryRmdirWindows(unpacked);
      if (!fs.existsSync(unpacked)) return true;
      sleepMs(400);
    }
  }

  try {
    const backup = `${unpacked}.bak.${Date.now()}`;
    fs.renameSync(unpacked, backup);
    log(`renamed ${path.basename(path.dirname(unpacked))}/win-unpacked → ${path.basename(backup)}`);
    return true;
  } catch (err) {
    log(`${path.relative(desktopRoot, unpacked)} locked: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

/** Try release + release-fresh (best effort). */
export function unlockAllReleaseDirs() {
  for (const name of PREFERRED_OUTPUT_DIRS) {
    const unpacked = path.join(desktopRoot, name, 'win-unpacked');
    if (fs.existsSync(unpacked)) {
      if (tryClearUnpacked(unpacked)) {
        log(`cleared ${name}/win-unpacked`);
      }
    }
  }
}

/**
 * Directory name for electron-builder `directories.output` (under apps/desktop).
 */
export function pickElectronBuilderOutputDir() {
  const forced = process.env.CATBUDDY_BUILD_OUTPUT?.trim();
  if (forced) {
    log(`output dir (env): ${forced}`);
    return forced;
  }

  for (const name of PREFERRED_OUTPUT_DIRS) {
    const unpacked = path.join(desktopRoot, name, 'win-unpacked');
    if (tryClearUnpacked(unpacked)) {
      log(`output dir: ${name}`);
      return name;
    }
  }

  const stamp = `release-build-${Date.now()}`;
  log(`release & release-fresh locked → output dir: ${stamp}`);
  return stamp;
}

function main() {
  unlockAllReleaseDirs();
  pickElectronBuilderOutputDir();
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
