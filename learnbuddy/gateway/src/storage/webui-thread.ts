import type { MessageRecord, SessionDetail } from './session-types'

/** Build Web UI thread replay payload from gateway session storage. */
export function buildWebuiThreadFromDetail(
  session: SessionDetail | null,
): Record<string, unknown> | null {
  if (!session) return null

  const result: Record<string, unknown> = {
    schemaVersion: 1,
    sessionKey: session.key,
    savedAt: session.updatedAt,
    messages: [],
  }

  const messages: Array<Record<string, unknown>> = []
  for (const m of session.messages) {
    if (m.role === 'tool') {
      messages.push({
        id: String(m.id),
        role: 'assistant',
        kind: 'trace',
        traces: [`${m.name ?? 'tool'}: ${m.content}`],
        createdAt: new Date(m.timestamp).getTime(),
        content: '',
      })
    } else {
      messages.push({
        id: String(m.id),
        role: m.role,
        content: m.content,
        createdAt: new Date(m.timestamp).getTime(),
      })
    }
  }
  result.messages = messages
  return result
}
