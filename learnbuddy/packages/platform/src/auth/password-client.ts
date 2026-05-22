import { resolveGatewayHttpBase } from '../gateway-http'
import { saveAuthToken } from './session'

export type AuthTokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
  email: string
}

function mapAuthError(body: string, status: number): string {
  try {
    const j = JSON.parse(body) as { message?: string | string[]; error?: string }
    const raw = Array.isArray(j.message) ? j.message[0] : j.message ?? j.error
    const code = String(raw ?? '')
    const labels: Record<string, string> = {
      invalid_email: '请输入有效的邮箱地址',
      weak_password: '密码至少需要 8 位',
      email_taken: '该邮箱已注册，请切换到登录',
      account_not_found: '该邮箱尚未注册，请先注册',
      invalid_password: '密码不正确，请重试',
      invalid_credentials: '邮箱或密码不正确',
    }
    if (labels[code]) return labels[code]
    if (code) return code
  } catch { /* ignore */ }
  return `请求失败 (${status})`
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
  return data
}

export function loginWithPassword(
  email: string,
  password: string,
  baseUrl?: string,
): Promise<AuthTokenResponse> {
  return postAuth('login', email, password, baseUrl)
}

export function registerWithPassword(
  email: string,
  password: string,
  baseUrl?: string,
): Promise<AuthTokenResponse> {
  return postAuth('register', email, password, baseUrl)
}
