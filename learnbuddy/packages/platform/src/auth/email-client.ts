import { resolveGatewayHttpBase } from '../gateway-http'
import { saveAuthToken } from './session'

export async function requestEmailCode(email: string, baseUrl?: string): Promise<{
  ok: boolean
  expiresIn: number
}> {
  const base = (baseUrl ?? resolveGatewayHttpBase()).replace(/\/$/, '')
  const res = await fetch(`${base}/auth/email/request-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`request-code failed (${res.status}): ${text}`)
  }
  return res.json()
}

export async function verifyEmailCode(
  email: string,
  code: string,
  baseUrl?: string,
): Promise<{ access_token: string; token_type: string; expires_in: number; email: string }> {
  const base = (baseUrl ?? resolveGatewayHttpBase()).replace(/\/$/, '')
  const res = await fetch(`${base}/auth/email/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`verify failed (${res.status}): ${text}`)
  }
  const data = await res.json()
  if (data.access_token) saveAuthToken(data.access_token)
  return data
}
