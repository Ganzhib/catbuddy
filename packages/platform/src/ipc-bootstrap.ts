import type { BootstrapResponse } from '@learnbuddy/shared'
import { requireIpcBridge } from './ipc-bridge'

async function waitForIpc(timeoutMs = 5000): Promise<void> {
  const start = Date.now()
  while (!window.learnbuddy) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        'IPC bridge not available after 5s. '
        + 'The app must run inside Electron with preload.js.',
      )
    }
    await new Promise(r => setTimeout(r, 100))
  }
}

export async function fetchBootstrapIpc(
  _baseUrl: string = '',
  _secret: string = '',
): Promise<BootstrapResponse> {
  await waitForIpc()

  try {
    const status = await requireIpcBridge().getStatus()
    return {
      token: 'ipc-local',
      ws_path: '/',
      expires_in: 86400 * 365,
      model_name: status.model || null,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[bootstrap] getStatus failed, using defaults:', msg)
    return {
      token: 'ipc-local',
      ws_path: '/',
      expires_in: 86400 * 365,
      model_name: null,
    }
  }
}

export function deriveWsUrlIpc(_wsPath: string, _token: string): string {
  return ''
}
