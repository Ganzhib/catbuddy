#!/usr/bin/env node
/**
 * Desktop build wrapper: staged timestamps + optional electron-builder DEBUG.
 *
 * Run from apps/desktop via package.json, or:
 *   node scripts/desktop-build.mjs [--verbose] [--dir] [electron-builder args...]
 *
 * Env:
 *   LEARNBUDDY_BUILD_VERBOSE=1  — same as --verbose
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
const ebExtraArgs = rawArgs.filter((a) => a !== '--verbose' && a !== '--dir');

function stamp() {
  return new Date().toISOString();
}

function log(msg) {
  console.log(`[${stamp()}] ${msg}`);
}

function runStep(label, command, args, extraEnv = {}) {
  log(`▶ ${label}`);
  log(`  $ ${command} ${args.join(' ')}`);
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: desktopRoot,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
    shell: process.platform === 'win32',
  });
  const sec = ((Date.now() - started) / 1000).toFixed(1);
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

log(`▶ electron-builder → ${targetLabel}`);
log('  Typical slow steps: copy Electron → asar → NSIS (makensis + compression)');
runStep(`Package (${targetLabel})`, 'pnpm', ebArgs, ebEnv);

log(`Done. Output: apps/desktop/release/`);
