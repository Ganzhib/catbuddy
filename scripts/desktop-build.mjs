#!/usr/bin/env node
/**
 * Desktop build wrapper: staged timestamps + optional electron-builder DEBUG.
 *
 * Run from apps/desktop via package.json, or:
 *   node scripts/desktop-build.mjs [--verbose] [--dir] [electron-builder args...]
 *
 * Env:
 *   CATBUDDY_BUILD_VERBOSE=1  — same as --verbose
 *   CATBUDDY_BUILD_NO_KILL=1  — skip stopping catbuddy/electron before pack
 *   DEBUG                       — if set, not overwritten unless --verbose
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pickElectronBuilderOutputDir } from './unlock-desktop-release.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const desktopRoot = path.join(repoRoot, 'apps', 'desktop');

const rawArgs = process.argv.slice(2);
const verbose =
  rawArgs.includes('--verbose') ||
  process.env.CATBUDDY_BUILD_VERBOSE === '1' ||
  process.env.CATBUDDY_BUILD_VERBOSE === 'true';
const dirOnly = rawArgs.includes('--dir');
const noKill =
  rawArgs.includes('--no-kill') ||
  process.env.CATBUDDY_BUILD_NO_KILL === '1' ||
  process.env.CATBUDDY_BUILD_NO_KILL === 'true';
const ebExtraArgs = rawArgs.filter((a) => a !== '--verbose' && a !== '--dir' && a !== '--no-kill');
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));

function stamp() {
  return new Date().toISOString();
}

function buildTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
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

// Inject build timestamp for artifact name (e.g. "catbuddy-Setup-0.1.0-20260524-120530.exe")
process.env.BUILD_TIMESTAMP = buildTimestamp();

log(`catbuddy desktop build → ${targetLabel}`);
if (verbose) {
  log('Verbose mode ON (Vite logLevel=verbose, electron-builder DEBUG)');
  log(
    'Note: after "packaging" starts, NSIS LZMA compression often runs 2–10+ min with few lines — usually not frozen.',
  );
} else {
  log('Tip: use `pnpm run build:verbose` or CATBUDDY_BUILD_VERBOSE=1 for detailed logs');
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

if (!noKill) {
  const killScript = path.join(scriptsDir, 'kill-desktop-processes.mjs');
  log('▶ Stop processes & unlock release/');
  const killResult = spawnSync(process.execPath, [killScript], {
    cwd: desktopRoot,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (killResult.status !== 0) {
    log(`kill script exit ${killResult.status ?? 1}`);
    process.exit(killResult.status ?? 1);
  }
} else {
  log('Skipping process kill (CATBUDDY_BUILD_NO_KILL / --no-kill)');
}

const outputDirName = pickElectronBuilderOutputDir();
ebArgs.push(`--config.directories.output=${outputDirName}`);

log(`▶ electron-builder → ${targetLabel}`);
log('  Typical slow steps: copy Electron → asar → NSIS (makensis + compression)');
runStep(`Package (${targetLabel})`, 'pnpm', ebArgs, ebEnv);

const outDir = path.join(desktopRoot, outputDirName);
log(`Done. Output folder: ${outDir}`);

const pkg = JSON.parse(fs.readFileSync(path.join(desktopRoot, 'package.json'), 'utf8'));
const productName = pkg.build?.productName ?? 'catbuddy';
// New naming: productName-Setup-version-TIMESTAMP.exe (see artifactName in package.json)
const ts = process.env.BUILD_TIMESTAMP ?? 'YYYYMMDD-HHmmss';
const setupName = `${productName}-Setup-${pkg.version}-${ts}.exe`;
const setupPath = path.join(outDir, setupName);
if (fs.existsSync(setupPath)) {
  log(`NSIS installer: ${setupPath}`);
} else {
  const found = fs.existsSync(outDir)
    ? fs.readdirSync(outDir).filter((f) => f.endsWith('.exe') && f.includes('Setup'))
    : [];
  if (found.length) log(`NSIS installer: ${path.join(outDir, found[0])}`);
  else log(`(no Setup .exe found in ${outDir} — check build log)`);
}
