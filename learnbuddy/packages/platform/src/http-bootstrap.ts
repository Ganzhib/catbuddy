import type { BootstrapResponse } from '@learnbuddy/shared'
import { loadSavedSecret, saveSecret } from './secrets'

export { loadSavedSecret, saveSecret, clearSavedSecret } from './secrets'

export async function fetchBootstrapHttp(
  baseUrl: string = '',
  secret: string = '',
): Promise<BootstrapResponse> {
  const saved = secret || loadSavedSecret()
  const base = (baseUrl || '').replace(/\/$/, '')
  const url = `${base}/webui/bootstrap${saved ? `?secret=${encodeURIComponent(saved)}` : ''}`
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Bootstrap failed (${res.status}): ${text}`)
  }
  const data = (await res.json()) as BootstrapResponse
  if (saved) saveSecret(saved)
  return data
}

export function deriveWsUrlHttp(wsPath: string, token: string): string {
  const path = wsPath.startsWith('/') ? wsPath : `/${wsPath}`
  const q = token ? `?token=${encodeURIComponent(token)}` : ''
  const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}${path}${q}`
}
