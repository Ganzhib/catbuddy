import { resolveGatewayHttpBase } from '../gateway-http'
import { mapAuthError } from './map-auth-error'
import { saveAuthEmail, saveAuthToken } from './session'

export type OtpDelivery = 'email' | 'console'

export type RequestEmailCodeResponse = {
  ok: boolean
  expiresIn: number
  delivery?: OtpDelivery
}

export async function requestEmailCode(
  email: string,
  baseUrl?: string,
  password?: string,
): Promise<RequestEmailCodeResponse> {
  const base = (baseUrl ?? resolveGatewayHttpBase()).replace(/\/$/, '')
  const body: { email: string; password?: string } = { email: email.trim() }
  if (password) body.password = password

  const res = await fetch(`${base}/auth/email/request-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(mapAuthError(text, res.status))
  }
  return res.json() as Promise<RequestEmailCodeResponse>
}

export async function verifyEmailCode(
  email: string,
  code: string,
  baseUrl?: string,
): Promise<{ access_token: string; token_type: string; expires_in: number; email: string }> {
  const base = (baseUrl ?? resolveGatewayHttpBase()).replace(/\/$/, '')
  const res = await fetch(`${base}/auth/register/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), code: code.trim() }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(mapAuthError(text, res.status))
  }
  const data = await res.json() as {
    access_token: string
    token_type: string
    expires_in: number
    email: string
  }
  if (data.access_token) saveAuthToken(data.access_token)
  if (data.email) saveAuthEmail(data.email)
  return data
}
