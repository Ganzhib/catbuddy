#!/usr/bin/env node
/**
 * Unlock apps/desktop/release for electron-builder.
 * Returns exit 0 if release/win-unpacked is gone or removable; 2 if still locked.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptsDir, '..', 'apps', 'desktop');
const releaseDir = path.join(desktopRoot, 'release');
const releaseUnpacked = path.join(releaseDir, 'win-unpacked');

function log(msg) {
  console.log(`[unlock-release] ${msg}`);
}

function sleepMs(ms) {
  if (process.platform === 'win32') {
    spawnSync('powershell.exe', ['-NoProfile', '-Command', `Start-Sleep -Milliseconds ${ms}`], {
      stdio: 'ignore',
      windowsHide: true,
    });
  } else {
    spawnSync('sleep', [String(ms / 1000)], { stdio: 'ignore' });
  }
}

function tryRm(target) {
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
}

function tryRmdirWindows(target) {
  spawnSync('cmd.exe', ['/c', 'rmdir', '/s', '/q', target], {
    stdio: 'ignore',
    windowsHide: true,
  });
}

function tryRenameAway(dir) {
  if (!fs.existsSync(dir)) return true;
  const backup = `${dir}.bak.${Date.now()}`;
  fs.renameSync(dir, backup);
  log(`renamed to ${path.basename(backup)}`);
  return true;
}

export function unlockDesktopRelease() {
  if (!fs.existsSync(releaseUnpacked)) {
    log('release/win-unpacked absent (ok)');
    return { ok: true, usedFreshOutput: false };
  }

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      tryRm(releaseUnpacked);
      log('removed release/win-unpacked');
      return { ok: true, usedFreshOutput: false };
    } catch {
      if (process.platform === 'win32') tryRmdirWindows(releaseUnpacked);
      if (!fs.existsSync(releaseUnpacked)) {
        log('removed via rmdir');
        return { ok: true, usedFreshOutput: false };
      }
      sleepMs(500);
    }
  }

  try {
    tryRenameAway(releaseUnpacked);
    return { ok: true, usedFreshOutput: false };
  } catch (err) {
    log(`rename failed: ${err instanceof Error ? err.message : err}`);
  }

  return { ok: false, usedFreshOutput: false };
}

function main() {
  const result = unlockDesktopRelease();
  if (result.ok) process.exit(0);
  log('release/win-unpacked still locked');
  process.exit(2);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
