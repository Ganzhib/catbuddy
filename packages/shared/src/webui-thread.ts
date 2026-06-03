import type {
  FileEditEvent,
  MessageRecord,
  ToolCallRequest,
} from './agent-types.js'
import type {
  ToolProgressEvent,
  UIMessage,
  WebuiThreadPersistedPayload,
} from './ui-types.js'

type WebuiThreadSession = {
  key: string
  updatedAt: string
  messages: MessageRecord[]
}

function timestampMs(iso: string): number {
  const value = new Date(iso).getTime()
  return Number.isFinite(value) ? value : Date.now()
}

function toolProgressKey(call: ToolCallRequest): string {
  return call.id || `name:${call.name}`
}

function toolStartEvent(call: ToolCallRequest): ToolProgressEvent {
  return {
    version: 1,
    phase: 'start',
    call_id: toolProgressKey(call),
    name: call.name,
    arguments: call.arguments,
  }
}

function toolEndEvent(message: MessageRecord): ToolProgressEvent {
  const name = message.name || 'tool'
  return {
    version: 1,
    phase: 'end',
    call_id: message.toolCallId || `name:${name}`,
    name,
    detail: message.content,
    result: message.content,
  }
}

function mergeToolEvent(
  progress: Record<string, ToolProgressEvent>,
  event: ToolProgressEvent,
): void {
  const directKey = event.call_id || `name:${event.name ?? 'tool'}`
  const nameKey = event.name ? `name:${event.name}` : ''
  const key = progress[directKey]
    ? directKey
    : nameKey && progress[nameKey]
      ? nameKey
      : directKey
  progress[key] = {
    ...progress[key],
    ...event,
    call_id: key,
    name: event.name ?? progress[key]?.name,
    arguments: event.arguments ?? progress[key]?.arguments,
  }
}

function traceMessage(
  source: MessageRecord,
  toolProgress: Record<string, ToolProgressEvent>,
  activitySegmentId: string,
  fileEdits?: FileEditEvent[],
): UIMessage {
  return {
    id: `trace-${activitySegmentId}-${source.id}`,
    role: 'tool',
    kind: 'trace',
    content: '',
    traces: [],
    toolProgress,
    activitySegmentId,
    createdAt: timestampMs(source.timestamp),
    ...(fileEdits?.length ? { fileEdits } : {}),
  }
}

function assistantMessage(source: MessageRecord, activitySegmentId?: string): UIMessage {
  return {
    id: String(source.id),
    role: 'assistant',
    content: source.content,
    createdAt: timestampMs(source.timestamp),
    ...(source.reasoningContent ? { reasoning: source.reasoningContent } : {}),
    ...(activitySegmentId ? { activitySegmentId } : {}),
    ...(source.tokenUsage ? { tokenUsage: source.tokenUsage } : {}),
    ...(source.latencyMs != null ? { latencyMs: source.latencyMs } : {}),
  }
}

function plainMessage(source: MessageRecord): UIMessage | null {
  if (source.role !== 'user' && source.role !== 'assistant' && source.role !== 'system') {
    return null
  }
  if (source.role === 'assistant') return assistantMessage(source)
  return {
    id: String(source.id),
    role: source.role,
    content: source.content,
    createdAt: timestampMs(source.timestamp),
  }
}

function collectToolResults(
  records: MessageRecord[],
  start: number,
  progress: Record<string, ToolProgressEvent>,
): number {
  let index = start
  while (index < records.length && records[index].role === 'tool') {
    const toolResult = records[index]
    if (toolResult.toolCalls?.[0]) mergeToolEvent(progress, toolStartEvent(toolResult.toolCalls[0]))
    mergeToolEvent(progress, toolEndEvent(toolResult))
    index += 1
  }
  return index
}

// ── FileEdit synthesis from persisted tool calls/results ──

/** Tool names that produce or modify files. */
const FILE_EDIT_TOOLS = new Set([
  'write_file', 'write', 'edit_file', 'edit',
  'create_file', 'replace_in_file',
  'display_diagram', 'append_diagram', 'edit_diagram',
])

/** Extract a file path from tool arguments (common key names). */
function extractPathFromArgs(args: unknown): string | undefined {
  if (!args || typeof args !== 'object') return undefined
  const a = args as Record<string, unknown>
  const candidates = [a.path, a.filePath, a.file_path, a.file, a.target, a.destination, a.dest]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return undefined
}

/** Try to find a .drawio file path in a tool result string. */
function extractDrawioPath(content: string): string | undefined {
  // Look for paths ending in .drawio (Windows or Unix)
  const m = content.match(/([^\s"'`\[\]()]+\.drawio)/i)
  return m?.[1]
}

/** Build synthetic FileEditEvent[] from toolCalls + tool results for history replay. */
function synthesizeFileEdits(
  calls: ToolCallRequest[],
  results: MessageRecord[],
): FileEditEvent[] {
  const edits: FileEditEvent[] = []
  const resultByCallId = new Map<string, MessageRecord>()
  for (const r of results) {
    if (r.toolCallId) resultByCallId.set(r.toolCallId, r)
  }

  for (const call of calls) {
    if (!FILE_EDIT_TOOLS.has(call.name)) continue
    const path = extractPathFromArgs(call.arguments)
    const result = resultByCallId.get(call.id)
    const resultContent = result?.content ?? ''

    // Try to get path from arguments, or extract .drawio from result
    const resolvedPath = path ?? extractDrawioPath(resultContent)

    if (!resolvedPath) continue

    // Detect status from result content
    const isError = /\b(?:Error|Failed)\b/i.test(resultContent)
    const status: FileEditEvent['status'] = isError ? 'error' : 'done'

    edits.push({
      call_id: call.id,
      tool: call.name,
      path: resolvedPath,
      added: 0,
      deleted: 0,
      status,
      ...(isError ? { error: resultContent.slice(0, 200) } : {}),
    })
  }
  return edits
}

/** Collect tool results for the assistant's tool calls. */
function collectResultsForCalls(
  records: MessageRecord[],
  start: number,
  callCount: number,
): { results: MessageRecord[]; next: number } {
  const results: MessageRecord[] = []
  let index = start
  while (index < records.length && results.length < callCount) {
    const record = records[index]
    if (record.role === 'tool') {
      results.push(record)
    } else {
      break
    }
    index += 1
  }
  return { results, next: index }
}

/** Convert persisted session messages into the Web UI replay shape. */
export function buildWebuiThreadPayload(
  session: WebuiThreadSession | null,
): WebuiThreadPersistedPayload | null {
  if (!session) return null

  const messages: UIMessage[] = []
  let activityIndex = 0

  for (let i = 0; i < session.messages.length; i += 1) {
    const message = session.messages[i]

    if (message.role === 'assistant' && message.toolCalls?.length) {
      activityIndex += 1
      const segmentId = `history-activity-${activityIndex}`
      if (message.content.trim() || message.reasoningContent?.trim()) {
        messages.push(assistantMessage(message, segmentId))
      }
      const progress: Record<string, ToolProgressEvent> = {}
      for (const call of message.toolCalls) mergeToolEvent(progress, toolStartEvent(call))
      const { results, next: resultEnd } = collectResultsForCalls(session.messages, i + 1, message.toolCalls.length)
      const next = collectToolResults(session.messages, i + 1, progress)
      const fileEdits = synthesizeFileEdits(message.toolCalls, results)
      messages.push(traceMessage(message, progress, segmentId, fileEdits))
      i = Math.max(next, resultEnd) - 1
      continue
    }

    if (message.role === 'tool') {
      activityIndex += 1
      const segmentId = `history-activity-${activityIndex}`
      const progress: Record<string, ToolProgressEvent> = {}
      const next = collectToolResults(session.messages, i, progress)
      // For orphan tool results, reconstruct fileEdits from toolCall info in each record
      const toolRecords = session.messages.slice(i, next)
      const callsFromResults = toolRecords
        .filter(r => r.toolCalls?.[0])
        .map(r => r.toolCalls![0])
      const fileEdits = synthesizeFileEdits(callsFromResults, toolRecords)
      messages.push(traceMessage(message, progress, segmentId, fileEdits))
      i = next - 1
      continue
    }

    const plain = plainMessage(message)
    if (plain) messages.push(plain)
  }

  return {
    schemaVersion: 1,
    sessionKey: session.key,
    savedAt: session.updatedAt,
    messages,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function toolProgressToRecords(
  sessionKey: string,
  source: Record<string, unknown>,
  idStart: number,
  timestamp: string,
): MessageRecord[] {
  const progress = source.toolProgress
  if (!isRecord(progress)) return []
  const records: MessageRecord[] = []
  let id = idStart
  for (const value of Object.values(progress)) {
    if (!isRecord(value)) continue
    const name = typeof value.name === 'string' && value.name.trim()
      ? value.name.trim()
      : 'tool'
    const callId = typeof value.call_id === 'string' ? value.call_id : `name:${name}`
    const args = isRecord(value.arguments) ? value.arguments : {}
    const detail = value.detail ?? value.result ?? value.error ?? ''
    records.push({
      id: id++,
      sessionKey,
      role: 'tool',
      content: typeof detail === 'string' ? detail : JSON.stringify(detail),
      name,
      toolCallId: callId,
      toolCalls: [{ id: callId, name, arguments: args }],
      timestamp,
    })
  }
  return records
}

export function sessionRecordsFromWebuiMessages(
  sessionKey: string,
  rawMessages: unknown[],
): MessageRecord[] {
  const records: MessageRecord[] = []
  let id = 1
  for (const raw of rawMessages) {
    if (!isRecord(raw)) continue
    const role = String(raw.role || 'assistant')
    const content = String(raw.content ?? '')
    const timestamp = typeof raw.createdAt === 'number'
      ? new Date(raw.createdAt).toISOString()
      : new Date().toISOString()

    if (raw.kind === 'trace') {
      const toolRecords = toolProgressToRecords(sessionKey, raw, id, timestamp)
      if (toolRecords.length > 0) {
        records.push(...toolRecords)
        id += toolRecords.length
        continue
      }
      const traces = Array.isArray(raw.traces) ? raw.traces.map(String) : [content]
      records.push({
        id: id++,
        sessionKey,
        role: 'tool',
        content: traces.join('\n'),
        name: 'trace',
        timestamp,
      })
      continue
    }

    if (role === 'user' || role === 'assistant' || role === 'system') {
      records.push({
        id: id++,
        sessionKey,
        role,
        content,
        reasoningContent: typeof raw.reasoning === 'string' ? raw.reasoning : undefined,
        timestamp,
        tokenUsage: isRecord(raw.tokenUsage) ? {
          inputTokens: Number((raw.tokenUsage as Record<string, unknown>).inputTokens) || 0,
          outputTokens: Number((raw.tokenUsage as Record<string, unknown>).outputTokens) || 0,
        } : undefined,
        latencyMs: typeof raw.latencyMs === 'number' ? raw.latencyMs : undefined,
      })
    }
  }
  return records
}
