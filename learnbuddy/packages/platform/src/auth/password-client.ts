import { resolveGatewayHttpBase } from '../gateway-http'
import { mapAuthError } from './map-auth-error'
import { saveAuthEmail, saveAuthToken } from './session'
import type { OtpDelivery } from './email-client'

export type AuthTokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
  email: string
}

async function postAuth(
  path: string,
  email: string,
  password: string,
  baseUrl?: string,
): Promise<AuthTokenResponse> {
  const base = (baseUrl ?? resolveGatewayHttpBase()).replace(/\/$/, '')
  const res = await fetch(`${base}/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(mapAuthError(text, res.status))
  }
  const data = (await res.json()) as AuthTokenResponse
  if (data.access_token) saveAuthToken(data.access_token)
  if (data.email) saveAuthEmail(data.email)
  return data
}

export function loginWithPassword(
  email: string,
  password: string,
  baseUrl?: string,
): Promise<AuthTokenResponse> {
  return postAuth('login', email, password, baseUrl)
}

export type RegisterPendingResponse = {
  ok: true
  expiresIn: number
  delivery?: OtpDelivery
}

export async function requestRegister(
  email: string,
  password: string,
  baseUrl?: string,
): Promise<RegisterPendingResponse> {
  const base = (baseUrl ?? resolveGatewayHttpBase()).replace(/\/$/, '')
  const res = await fetch(`${base}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(mapAuthError(text, res.status))
  }
  return res.json() as Promise<RegisterPendingResponse>
}

export async function verifyRegister(
  email: string,
  code: string,
  baseUrl?: string,
): Promise<AuthTokenResponse> {
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
  const data = (await res.json()) as AuthTokenResponse
  if (data.access_token) saveAuthToken(data.access_token)
  if (data.email) saveAuthEmail(data.email)
  return data
}

/** @deprecated Use requestRegister + verifyRegister */
export function registerWithPassword(
  email: string,
  password: string,
  baseUrl?: string,
): Promise<RegisterPendingResponse> {
  return requestRegister(email, password, baseUrl)
}
