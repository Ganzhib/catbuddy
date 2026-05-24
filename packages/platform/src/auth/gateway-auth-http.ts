import { hasCatbuddyIpc } from '../create-platform'
import { resolveGatewayHttpBase } from '../gateway-http'
import { mapAuthError } from './map-auth-error'

export type GatewayAuthPostResponse =
  | { ok: true; data: unknown }
  | { ok: false; status: number; text: string }

async function postGatewayAuthIpc(
  path: string,
  body: Record<string, unknown>,
): Promise<GatewayAuthPostResponse> {
  const api = window.catbuddy?.postGatewayAuth
  if (!api) {
    return { ok: false, status: 503, text: 'IPC bridge not available' }
  }
  return api({ path, body })
}

/** Auth POST — desktop uses main-process fetch; web uses browser fetch. */
export async function postGatewayAuth(
  path: string,
  body: Record<string, unknown>,
  baseUrl?: string,
): Promise<unknown> {
  let res: GatewayAuthPostResponse
  if (hasCatbuddyIpc()) {
    res = await postGatewayAuthIpc(path, body)
  } else {
    const base = (baseUrl ?? resolveGatewayHttpBase()).replace(/\/$/, '')
    const httpRes = await fetch(`${base}/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await httpRes.text().catch(() => httpRes.statusText)
    if (!httpRes.ok) {
      res = { ok: false, status: httpRes.status, text }
    } else {
      try {
        res = { ok: true, data: JSON.parse(text) as unknown }
      } catch {
        res = { ok: false, status: httpRes.status, text }
      }
    }
  }

  if (!res.ok) {
    throw new Error(mapAuthError(res.text, res.status))
  }
  return res.data
}
