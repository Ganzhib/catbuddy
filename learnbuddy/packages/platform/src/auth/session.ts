const AUTH_TOKEN_KEY = 'learnbuddy-webui.auth-token'
const AUTH_EMAIL_KEY = 'learnbuddy-webui.auth-email'

export function loadAuthToken(): string {
  if (typeof window === 'undefined') return ''
  try { return window.localStorage.getItem(AUTH_TOKEN_KEY) ?? '' } catch { return '' }
}

export function saveAuthToken(token: string): void {
  try { window.localStorage.setItem(AUTH_TOKEN_KEY, token) } catch {}
}

export function loadAuthEmail(): string {
  if (typeof window === 'undefined') return ''
  try { return window.localStorage.getItem(AUTH_EMAIL_KEY) ?? '' } catch { return '' }
}

export function saveAuthEmail(email: string): void {
  try { window.localStorage.setItem(AUTH_EMAIL_KEY, email.trim().toLowerCase()) } catch {}
}

export function clearAuthToken(): void {
  try {
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
    window.localStorage.removeItem(AUTH_EMAIL_KEY)
  } catch {}
}

export function hasAuthToken(): boolean {
  return loadAuthToken().length > 0
}
