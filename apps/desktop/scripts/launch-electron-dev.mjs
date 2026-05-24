/**
 * Dev-only Electron launcher (replaces vite-plugin-electron default startup).
 * - Ignores stale PIDs on Windows taskkill
 * - Does not call process.exit when Electron quits (keeps Vite alive)
 */
import { execSync, spawn } from 'node:child_process'

/** @type {import('node:child_process').ChildProcess | undefined} */
process.electronApp = process.electronApp

export async function launchElectronDev(cwd) {
  const electron = await import('electron')
  const electronPath = electron.default ?? electron

  if (process.electronApp?.pid) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${process.electronApp.pid} /T /F`, { stdio: 'ignore' })
      } else {
        process.electronApp.kill('SIGTERM')
      }
    } catch {
      // stale pid
    }
    process.electronApp = undefined
  }

  console.log('[electron] starting', { cwd, VITE_DEV_SERVER_URL: process.env.VITE_DEV_SERVER_URL })

  process.electronApp = spawn(electronPath, ['.', '--no-sandbox'], {
    cwd,
    stdio: 'inherit',
    env: process.env,
  })

  process.electronApp.on('exit', (code, signal) => {
    console.log(`[electron] exited code=${code ?? '?'} signal=${signal ?? ''}`)
  })
}
