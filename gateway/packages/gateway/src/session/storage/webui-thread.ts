import { buildWebuiThreadPayload } from '@catbuddy/shared'
import type { MessageRecord, SessionDetail } from './session-types.js'

function toSharedSessionDetail(session: SessionDetail): Parameters<typeof buildWebuiThreadPayload>[0] {
  return {
    key: session.key,
    updatedAt: session.updatedAt,
    messages: session.messages.map((message) => ({
      ...message,
      toolCalls: toToolCalls(message.toolCalls),
    })),
  }
}

function toToolCalls(value: MessageRecord['toolCalls']) {
  if (!Array.isArray(value)) return undefined
  return value
    .map((call) => {
      if (!call || typeof call !== 'object') return null
      const raw = call as Record<string, unknown>
      const fn = raw.function && typeof raw.function === 'object'
        ? raw.function as Record<string, unknown>
        : null
      const id = String(raw.id || raw.call_id || raw.toolCallId || '')
      const name = String(raw.name || raw.functionName || fn?.name || '')
      const args = raw.arguments && typeof raw.arguments === 'object'
        ? raw.arguments as Record<string, unknown>
        : {}
      if (!name) return null
      return { id, name, arguments: args }
    })
    .filter((call): call is { id: string; name: string; arguments: Record<string, unknown> } => !!call)
}

/** Build Web UI thread replay payload from gateway session storage. */
export function buildWebuiThreadFromDetail(
  session: SessionDetail | null,
): Record<string, unknown> | null {
  const payload = session ? buildWebuiThreadPayload(toSharedSessionDetail(session)) : null
  return payload as Record<string, unknown> | null
}
