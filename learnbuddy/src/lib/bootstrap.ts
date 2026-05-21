/**
 * IPC-based bootstrap — 替代 HTTP /webui/bootstrap
 */
import type { BootstrapResponse } from './types'

const SECRET_STORAGE_KEY = 'learnbuddy-webui.bootstrap-secret'

export function loadSavedSecret(): string {
  if (typeof window === 'undefined') return ''
  try { return window.localStorage.getItem(SECRET_STORAGE_KEY) ?? '' } catch { return '' }
}

export function saveSecret(secret: string): void {
  try { window.localStorage.setItem(SECRET_STORAGE_KEY, secret) } catch {}
}

export function clearSavedSecret(): void {
  try { window.localStorage.removeItem(SECRET_STORAGE_KEY) } catch {}
}

/** 等待 window.learnbuddy 注入（preload 可能比 React 挂载慢） */
async function waitForIpc(timeoutMs = 5000): Promise<void> {
  const start = Date.now()
  while (!window.learnbuddy) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        'IPC bridge not available after 5s. ' +
        'The app must run inside Electron with preload.js.'
      )
    }
    await new Promise(r => setTimeout(r, 100))
  }
}

export async function fetchBootstrap(
  _baseUrl: string = '',
  _secret: string = '',
): Promise<BootstrapResponse> {
  await waitForIpc()

  try {
    const status = await window.learnbuddy.getStatus()
    return {
      token: 'ipc-local',
      ws_path: '/',
      expires_in: 86400 * 365,
      model_name: status.model || null,
    }
  } catch (err: any) {
    console.warn('[bootstrap] getStatus failed, using defaults:', err?.message)
    return {
      token: 'ipc-local',
      ws_path: '/',
      expires_in: 86400 * 365,
      model_name: null,
    }
  }
}

export function deriveWsUrl(_wsPath: string, _token: string): string {
  return ''
}
