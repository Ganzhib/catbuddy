import { postGatewayAuth } from './gateway-auth-http'
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
  const body: { email: string; password?: string } = { email: email.trim() }
  if (password) body.password = password

  return postGatewayAuth('email/request-code', body, baseUrl) as Promise<RequestEmailCodeResponse>
}

export async function verifyEmailCode(
  email: string,
  code: string,
  baseUrl?: string,
): Promise<{ access_token: string; token_type: string; expires_in: number; email: string }> {
  const data = (await postGatewayAuth(
    'register/verify',
    { email: email.trim(), code: code.trim() },
    baseUrl,
  )) as {
    access_token: string
    token_type: string
    expires_in: number
    email: string
  }
  if (data.access_token) saveAuthToken(data.access_token)
  if (data.email) saveAuthEmail(data.email)
  return data
}
