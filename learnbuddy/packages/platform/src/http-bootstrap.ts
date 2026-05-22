import type { BootstrapResponse } from '@learnbuddy/shared'
import {
  BootstrapAuthRequired,
  hasAuthToken,
  loadAuthToken,
  requiresEmailLogin,
} from './auth'
import { resolveGatewayHttpBase } from './gateway-http'
import { loadSavedSecret, saveSecret } from './secrets'

export { loadSavedSecret, saveSecret, clearSavedSecret } from './secrets'
export { BootstrapAuthRequired } from './auth'

export async function fetchBootstrapHttp(
  baseUrl: string = '',
  secret: string = '',
): Promise<BootstrapResponse> {
  if (requiresEmailLogin() && !hasAuthToken()) {
    throw new BootstrapAuthRequired()
  }

  const loginRequired = requiresEmailLogin()
  const saved = loginRequired ? '' : (secret || loadSavedSecret())
  const authToken = loadAuthToken()
  const base = (baseUrl || resolveGatewayHttpBase()).replace(/\/$/, '')
  const q = saved ? `?secret=${encodeURIComponent(saved)}` : ''
  const url = `${base}/webui/bootstrap${q}`
  const headers: Record<string, string> = {}
  if (authToken) headers.Authorization = `Bearer ${authToken}`

  const res = await fetch(url, { credentials: 'include', headers })
  if (res.status === 401) {
    let requiresAuth = loginRequired
    try {
      const body = (await res.json()) as { requires_auth?: boolean }
      if (body.requires_auth === true) requiresAuth = true
    } catch { /* ignore */ }
    if (requiresAuth) throw new BootstrapAuthRequired()
  }
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Bootstrap failed (${res.status}): ${text}`)
  }
  const raw = await res.text()
  const trimmed = raw.trim()
  if (trimmed.startsWith('<')) {
    throw new Error(
      `Bootstrap 返回了 HTML 而非 JSON（请确认 Gateway 已启动，且请求地址为 ${url}）`,
    )
  }
  let data: BootstrapResponse
  try {
    data = JSON.parse(trimmed) as BootstrapResponse
  } catch {
    throw new Error(`Bootstrap 响应不是有效 JSON: ${trimmed.slice(0, 120)}`)
  }
  if (saved) saveSecret(saved)
  return data
}

export function deriveWsUrlHttp(wsPath: string, token: string): string {
  const path = wsPath.startsWith('/') ? wsPath : `/${wsPath}`
  const q = token ? `?token=${encodeURIComponent(token)}` : ''
  const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}${path}${q}`
}
