/**
 * Dev-only Electron launcher (replaces vite-plugin-electron default startup).
 * - Ignores stale PIDs on Windows taskkill
 * - Does not call process.exit when Electron quits (keeps Vite alive)
 */
import { execSync, spawn } from 'node:child_process'

/** @type {import('node:child_process').ChildProcess | undefined} */
process.electronApp = process.electronApp

const expectedExits = new WeakSet()

function psSingleQuoted(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

function cleanupStaleElectronDev(electronPath) {
  if (process.cleanedStaleElectronDev) return
  process.cleanedStaleElectronDev = true
  if (process.platform !== 'win32') return

  const script = [
    '$electronPath = ' + psSingleQuoted(electronPath),
    "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'electron.exe' -and $_.CommandLine -like \"*$electronPath*\" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
  ].join('; ')

  try {
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command ${psSingleQuoted(script)}`, { stdio: 'ignore' })
  } catch {
    // best-effort cleanup only
  }
}

export async function launchElectronDev(cwd) {
  const electron = await import('electron')
  const electronPath = electron.default ?? electron
  cleanupStaleElectronDev(String(electronPath))

  if (process.electronApp?.pid) {
    const previousApp = process.electronApp
    expectedExits.add(previousApp)
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${previousApp.pid} /T /F`, { stdio: 'ignore' })
      } else {
        previousApp.kill('SIGTERM')
      }
    } catch {
      // stale pid
    }
    process.electronApp = undefined
  }

  console.log('[electron] starting', { cwd, VITE_DEV_SERVER_URL: process.env.VITE_DEV_SERVER_URL })

  const electronApp = spawn(electronPath, ['.', '--no-sandbox'], {
    cwd,
    stdio: 'inherit',
    env: process.env,
  })
  process.electronApp = electronApp

  electronApp.on('exit', (code, signal) => {
    if (expectedExits.has(electronApp)) return
    console.log(`[electron] exited code=${code ?? '?'} signal=${signal ?? ''}`)
  })
}
