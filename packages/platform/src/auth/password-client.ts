import { postGatewayAuth } from './gateway-auth-http'
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
  const data = (await postGatewayAuth(
    path,
    { email: email.trim(), password },
    baseUrl,
  )) as AuthTokenResponse
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
  return postGatewayAuth(
    'register',
    { email: email.trim(), password },
    baseUrl,
  ) as Promise<RegisterPendingResponse>
}

export async function verifyRegister(
  email: string,
  code: string,
  baseUrl?: string,
): Promise<AuthTokenResponse> {
  const data = (await postGatewayAuth(
    'register/verify',
    { email: email.trim(), code: code.trim() },
    baseUrl,
  )) as AuthTokenResponse
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
