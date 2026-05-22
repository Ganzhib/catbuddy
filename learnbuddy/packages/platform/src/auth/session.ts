const AUTH_TOKEN_KEY = 'learnbuddy-webui.auth-token'

export function loadAuthToken(): string {
  if (typeof window === 'undefined') return ''
  try { return window.localStorage.getItem(AUTH_TOKEN_KEY) ?? '' } catch { return '' }
}

export function saveAuthToken(token: string): void {
  try { window.localStorage.setItem(AUTH_TOKEN_KEY, token) } catch {}
}

export function clearAuthToken(): void {
  try { window.localStorage.removeItem(AUTH_TOKEN_KEY) } catch {}
}

export function hasAuthToken(): boolean {
  return loadAuthToken().length > 0
}
