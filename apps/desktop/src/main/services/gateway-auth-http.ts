import {
  resolveBuiltinGatewayHttpUrl,
} from '@catbuddy/shared'

function useLocalGatewayHttp(): boolean {
  const flag = process.env.CATBUDDY_GATEWAY_USE_LOCAL?.trim()
  if (flag === 'true' || flag === '1') return true
  if (flag === 'false' || flag === '0') return false
  return false
}

export function resolveMainGatewayHttpBase(): string {
  if (useLocalGatewayHttp()) {
    return resolveBuiltinGatewayHttpUrl(true)
  }
  const fromEnv = process.env.VITE_GATEWAY_HTTP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  return resolveBuiltinGatewayHttpUrl(false)
}

export type GatewayAuthPostResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; text: string }

/** Node fetch to Gateway auth routes (desktop main process). */
export async function postGatewayAuthHttp(
  path: string,
  body: Record<string, unknown>,
): Promise<GatewayAuthPostResult> {
  const base = resolveMainGatewayHttpBase().replace(/\/$/, '')
  try {
    const res = await fetch(`${base}/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await res.text().catch(() => res.statusText)
    if (!res.ok) return { ok: false, status: res.status, text }
    try {
      return { ok: true, data: JSON.parse(text) as unknown }
    } catch {
      return { ok: false, status: res.status, text }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, status: 503, text: message }
  }
}
