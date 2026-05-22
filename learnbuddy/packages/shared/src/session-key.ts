import type { ChatSummary } from './ui-types'

const DEFAULT_CHANNEL = 'desktop'

/** Bare chat id (no ``channel:`` prefix). */
export function bareChatId(chatIdOrKey: string): string {
  const trimmed = chatIdOrKey.trim()
  if (!trimmed) return ''
  const colon = trimmed.indexOf(':')
  return colon === -1 ? trimmed : trimmed.slice(colon + 1)
}

/** Canonical storage / API session key, e.g. ``desktop:1730_abc``. */
export function toSessionKey(
  chatIdOrKey: string,
  channel: string = DEFAULT_CHANNEL,
): string {
  const trimmed = chatIdOrKey.trim()
  if (!trimmed) return `${channel}:`
  if (trimmed.includes(':')) return trimmed
  return `${channel}:${trimmed}`
}

export function channelFromSessionKey(sessionKey: string): string {
  const colon = sessionKey.indexOf(':')
  return colon === -1 ? DEFAULT_CHANNEL : sessionKey.slice(0, colon)
}

export function parseSessionKey(sessionKey: string): {
  key: string
  channel: string
  chatId: string
} {
  const key = toSessionKey(sessionKey)
  return {
    key,
    channel: channelFromSessionKey(key),
    chatId: bareChatId(key),
  }
}

/** Normalize list rows so ``key`` / ``chatId`` never disagree. */
export function normalizeChatSummary(row: ChatSummary): ChatSummary {
  const chatId = bareChatId(row.chatId || row.key)
  const key = toSessionKey(row.key || row.chatId, row.channel || DEFAULT_CHANNEL)
  return {
    ...row,
    key,
    channel: channelFromSessionKey(key),
    chatId,
  }
}

/** Merge server + local session lists without duplicate keys or split ids. */
export function mergeChatSummaries(
  server: ChatSummary[],
  local: ChatSummary[],
): ChatSummary[] {
  const byKey = new Map<string, ChatSummary>()
  for (const row of server) {
    const n = normalizeChatSummary(row)
    byKey.set(n.key, n)
  }
  for (const row of local) {
    const n = normalizeChatSummary(row)
    if (!byKey.has(n.key)) byKey.set(n.key, n)
  }
  return [...byKey.values()].sort((a, b) =>
    (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
  )
}
