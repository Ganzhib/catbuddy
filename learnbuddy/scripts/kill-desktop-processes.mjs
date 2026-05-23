#!/usr/bin/env node
/**
 * Stop processes that lock apps/desktop/release, then unlock release/win-unpacked.
 * Exit 0 = ok; 2 = still locked (caller may use release-fresh output).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unlockDesktopRelease } from './unlock-desktop-release.mjs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(scriptsDir, '..', 'apps', 'desktop');

function log(msg) {
  console.log(`[kill-desktop] ${msg}`);
}

function runExe(command, args) {
  return spawnSync(command, args, {
    stdio: 'inherit',
    windowsHide: true,
  });
}

function killWindows() {
  const ps1 = path.join(scriptsDir, 'kill-desktop-win.ps1');
  const r = runExe('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    ps1,
    '-DesktopRoot',
    desktopRoot,
  ]);
  if (r.error) {
    log(`powershell failed: ${r.error.message}`);
    process.exit(1);
  }
}

function killUnix() {
  for (const pattern of ['learnbuddy', `${desktopRoot}/release`, `${desktopRoot}/dist-electron`]) {
    spawnSync('pkill', ['-f', pattern], { stdio: 'ignore' });
  }
  spawnSync('sleep', ['0.8'], { stdio: 'ignore' });
}

if (process.platform === 'win32') {
  killWindows();
} else {
  killUnix();
}

const unlock = unlockDesktopRelease();
if (!unlock.ok) {
  log('done (still locked — build will use release-fresh if supported)');
  process.exit(2);
}
log('done');
process.exit(0);
