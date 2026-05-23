#!/usr/bin/env node
/**
 * Stop processes that lock apps/desktop/release* (cross-platform, no .ps1).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { unlockAllReleaseDirs } from './unlock-desktop-release.mjs';

const desktopRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'apps',
  'desktop',
);

function log(msg) {
  console.log(`[kill-desktop] ${msg}`);
}

function taskkill(image) {
  const r = spawnSync('taskkill', ['/F', '/IM', image], {
    stdio: 'pipe',
    encoding: 'utf8',
    windowsHide: true,
  });
  if (r.status === 0) log(`stopped ${image}`);
}

function killWindows() {
  taskkill('learnbuddy.exe');
  taskkill('app-builder.exe');

  const root = desktopRoot.replace(/\\/g, '\\\\');
  const ps = [
    'Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |',
    'Where-Object {',
    "  ($_.Name -eq 'learnbuddy.exe') -or",
    "  ($_.Name -eq 'electron.exe' -and (",
    `    ($_.CommandLine -match 'learnbuddy') -or`,
    `    ($_.ExecutablePath -match '${root}\\\\release') -or`,
    `    ($_.CommandLine -match 'win-unpacked')`,
    '  ))',
    '} | ForEach-Object {',
    "  Write-Host ('[kill-desktop] Stop ' + $_.Name + ' PID ' + $_.ProcessId);",
    '  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue',
    '}',
  ].join(' ');

  spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], {
    stdio: 'inherit',
    windowsHide: true,
  });
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

unlockAllReleaseDirs();
log('done');
