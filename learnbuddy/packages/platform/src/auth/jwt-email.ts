/** Read account email from Gateway Web JWT payload (no signature verify). */
export function emailFromGatewayToken(token: string): string | undefined {
  const raw = token.trim()
  const parts = raw.split('.')
  if (parts.length < 2) return undefined
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(b64)) as { sub?: string; email?: string }
    const sub = json.sub ?? json.email
    if (typeof sub !== 'string') return undefined
    const email = sub.trim().toLowerCase()
    return email.includes('@') ? email : undefined
  } catch {
    return undefined
  }
}
