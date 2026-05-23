#!/usr/bin/env node
/**
 * Desktop build wrapper: staged timestamps + optional electron-builder DEBUG.
 *
 * Run from apps/desktop via package.json, or:
 *   node scripts/desktop-build.mjs [--verbose] [--dir] [electron-builder args...]
 *
 * Env:
 *   LEARNBUDDY_BUILD_VERBOSE=1  — same as --verbose
 *   LEARNBUDDY_BUILD_NO_KILL=1  — skip stopping learnbuddy/electron before pack
 *   DEBUG                       — if set, not overwritten unless --verbose
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const desktopRoot = path.join(repoRoot, 'apps', 'desktop');

const rawArgs = process.argv.slice(2);
const verbose =
  rawArgs.includes('--verbose') ||
  process.env.LEARNBUDDY_BUILD_VERBOSE === '1' ||
  process.env.LEARNBUDDY_BUILD_VERBOSE === 'true';
const dirOnly = rawArgs.includes('--dir');
const noKill =
  rawArgs.includes('--no-kill') ||
  process.env.LEARNBUDDY_BUILD_NO_KILL === '1' ||
  process.env.LEARNBUDDY_BUILD_NO_KILL === 'true';
const ebExtraArgs = rawArgs.filter((a) => a !== '--verbose' && a !== '--dir' && a !== '--no-kill');
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));

function stamp() {
  return new Date().toISOString();
}

function log(msg) {
  console.log(`[${stamp()}] ${msg}`);
}

function runStep(label, command, args, extraEnv = {}) {
  // Windows: pnpm is a .cmd shim — spawn without shell → EINVAL
  const useShell = process.platform === 'win32' && command === 'pnpm';
  log(`▶ ${label}`);
  log(`  $ ${command} ${args.join(' ')}`);
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: desktopRoot,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
    shell: useShell,
    windowsHide: true,
  });
  const sec = ((Date.now() - started) / 1000).toFixed(1);
  if (result.error) {
    log(`✗ ${label} spawn failed: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    log(`✗ ${label} failed after ${sec}s (exit ${result.status ?? 1})`);
    process.exit(result.status ?? 1);
  }
  log(`✓ ${label} finished (${sec}s)`);
}

const targetLabel = dirOnly ? 'win-unpacked (--dir)' : 'NSIS installer';

log(`learnbuddy desktop build → ${targetLabel}`);
if (verbose) {
  log('Verbose mode ON (Vite logLevel=verbose, electron-builder DEBUG)');
  log(
    'Note: after "packaging" starts, NSIS LZMA compression often runs 2–10+ min with few lines — usually not frozen.',
  );
} else {
  log('Tip: use `pnpm run build:verbose` or LEARNBUDDY_BUILD_VERBOSE=1 for detailed logs');
}

runStep('Typecheck (tsc --noEmit)', 'pnpm', ['exec', 'tsc', '--noEmit']);

const viteArgs = ['exec', 'vite', 'build'];
if (verbose) viteArgs.push('--logLevel', 'verbose');
runStep('Vite production build', 'pnpm', viteArgs);

const ebArgs = ['exec', 'electron-builder', ...ebExtraArgs];
if (dirOnly) ebArgs.push('--dir');

const ebEnv = {};
if (verbose && !process.env.DEBUG) {
  ebEnv.DEBUG = 'electron-builder,app-builder-lib,builder-util,builder-util:*';
  log(`DEBUG=${ebEnv.DEBUG}`);
}

let useFreshOutput = process.env.LEARNBUDDY_BUILD_OUTPUT === 'release-fresh';

if (!noKill) {
  const killScript = path.join(scriptsDir, 'kill-desktop-processes.mjs');
  log('▶ Stop processes & unlock release/');
  const killResult = spawnSync(process.execPath, [killScript], {
    cwd: desktopRoot,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (killResult.status === 2) {
    useFreshOutput = true;
    log('release/win-unpacked still locked → output directory: release-fresh');
    log('  (close learnbuddy.exe / dev Electron; or delete apps/desktop/release manually)');
  } else if (killResult.status !== 0) {
    log(`kill script exit ${killResult.status ?? 1}`);
    process.exit(killResult.status ?? 1);
  } else {
    log('✓ release/ unlocked');
  }
} else {
  log('Skipping process kill (LEARNBUDDY_BUILD_NO_KILL / --no-kill)');
}

if (useFreshOutput) {
  ebArgs.push('--config.directories.output=release-fresh');
}

log(`▶ electron-builder → ${targetLabel}`);
log('  Typical slow steps: copy Electron → asar → NSIS (makensis + compression)');
runStep(`Package (${targetLabel})`, 'pnpm', ebArgs, ebEnv);

log(
  `Done. Output: apps/desktop/${useFreshOutput ? 'release-fresh/' : 'release/'} (NSIS .exe inside)`,
);
