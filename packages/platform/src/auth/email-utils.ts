import { loadAuthEmail } from './session'

/** Local part of an email address (before @). */
export function emailPrefixFromEmail(email: string): string {
  const normalized = email.trim().toLowerCase()
  const at = normalized.indexOf('@')
  if (at <= 0) return normalized
  return normalized.slice(0, at)
}

function emailFromJwt(token: string): string | null {
  const parts = token.trim().split('.')
  if (parts.length < 2) return null
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(atob(padded)) as { sub?: unknown }
    const sub = typeof payload.sub === 'string' ? payload.sub.trim().toLowerCase() : ''
    return sub.includes('@') ? sub : null
  } catch {
    return null
  }
}

/** Saved login email, or email from JWT `sub` when only the token is present. */
export function resolveAuthEmail(token?: string): string {
  const saved = loadAuthEmail()
  if (saved.includes('@')) return saved
  if (token) {
    const fromJwt = emailFromJwt(token)
    if (fromJwt) return fromJwt
  }
  return ''
}

export function resolveAuthEmailPrefix(token?: string): string {
  const email = resolveAuthEmail(token)
  if (!email) return ''
  return emailPrefixFromEmail(email)
}
