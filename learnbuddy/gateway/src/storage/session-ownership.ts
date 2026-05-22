export const SESSION_OWNER_KEY = 'ownerEmail'

export function normalizeOwnerEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function readOwnerEmail(metadata: Record<string, unknown> | undefined): string | null {
  const raw = metadata?.[SESSION_OWNER_KEY]
  return typeof raw === 'string' && raw.includes('@')
    ? normalizeOwnerEmail(raw)
    : null
}
