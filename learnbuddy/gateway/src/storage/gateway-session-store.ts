import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { buildWebuiThreadFromDetail } from './webui-thread'
import type { GatewaySessionRow, MessageRecord, SessionDetail, SessionInfo } from './session-types'

const MAX_MESSAGES = 2000
const PREVIEW_MAX_CHARS = 120

export class GatewaySessionStore {
  private readonly dir: string
  private readonly cache = new Map<string, SessionInfo>()

  constructor(workspace?: string) {
    const base =
      workspace?.trim()
      || process.env.GATEWAY_DATA_DIR?.trim()
      || path.join(os.homedir(), '.learnbuddy-gateway', 'workspace')
    this.dir = path.join(base, 'sessions')
    fs.mkdirSync(this.dir, { recursive: true })
  }

  getOrCreate(key: string): SessionInfo {
    if (this.cache.has(key)) return this.cache.get(key)!
    const existing = this.get(key)
    if (existing) return existing
    const info = this.createEmptyInfo(key)
    this.cache.set(key, info)
    return info
  }

  get(key: string): SessionInfo | null {
    const fp = this.filePath(key)
    if (!fs.existsSync(fp)) return null
    try {
      const { info } = this.load(fp)
      this.cache.set(key, info)
      return info
    } catch {
      return null
    }
  }

  getDetail(key: string): SessionDetail | null {
    const fp = this.filePath(key)
    if (!fs.existsSync(fp)) return null
    try {
      const { info, messages } = this.load(fp)
      return { ...info, messages }
    } catch {
      return null
    }
  }

  hasMessages(key: string): boolean {
    const fp = this.filePath(key)
    if (!fs.existsSync(fp)) return false
    try {
      const lines = fs.readFileSync(fp, 'utf-8').split('\n').filter(Boolean)
      return lines.length > 1
    } catch {
      return false
    }
  }

  addUserMessage(sessionKey: string, content: string): void {
    this.addMessage(sessionKey, { role: 'user', content })
  }

  addAssistantMessage(sessionKey: string, content: string): void {
    this.addMessage(sessionKey, { role: 'assistant', content })
  }

  addMessage(
    sessionKey: string,
    msg: Omit<MessageRecord, 'id' | 'sessionKey' | 'timestamp'>,
  ): void {
    const fp = this.filePath(sessionKey)
    const { info, messages } = fs.existsSync(fp)
      ? this.load(fp)
      : this.initSession(sessionKey)

    const now = new Date().toISOString()
    messages.push({
      id: this.nextMessageId(messages),
      sessionKey,
      role: msg.role,
      content: msg.content,
      toolCalls: msg.toolCalls,
      toolCallId: msg.toolCallId,
      name: msg.name,
      media: msg.media,
      timestamp: now,
    })

    if (messages.length > MAX_MESSAGES) {
      messages.splice(0, messages.length - MAX_MESSAGES)
    }

    info.updatedAt = now
    info.preview = this.extractPreview(messages)
    this.save(info, messages)
    this.cache.set(sessionKey, info)
  }

  /** Replace transcript from desktop ``thread_snapshot`` / webui-thread payload. */
  importWebuiPayload(
    sessionKey: string,
    payload: Record<string, unknown> | null,
  ): void {
    if (!sessionKey || !payload) return
    const rawMessages = payload.messages
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) return

    const info = this.getOrCreate(sessionKey)
    const messages: MessageRecord[] = []
    let id = 1
    for (const m of rawMessages) {
      if (!m || typeof m !== 'object') continue
      const row = m as Record<string, unknown>
      const role = String(row.role || 'assistant')
      const content = String(row.content ?? '')
      const createdAt =
        typeof row.createdAt === 'number'
          ? new Date(row.createdAt).toISOString()
          : new Date().toISOString()
      if (row.kind === 'trace') {
        const traces = Array.isArray(row.traces) ? row.traces.map(String) : [content]
        messages.push({
          id: id++,
          sessionKey,
          role: 'tool',
          content: traces.join('\n'),
          name: 'trace',
          timestamp: createdAt,
        })
      } else if (role === 'user' || role === 'assistant' || role === 'system') {
        messages.push({
          id: id++,
          sessionKey,
          role,
          content,
          timestamp: createdAt,
        })
      }
    }

    if (messages.length === 0) return
    info.updatedAt =
      typeof payload.savedAt === 'string'
        ? payload.savedAt
        : messages[messages.length - 1].timestamp
    info.preview = this.extractPreview(messages)
    this.save(info, messages)
    this.cache.set(sessionKey, info)
  }

  mergeSessionRow(row: GatewaySessionRow): void {
    const key = row.key
    if (!key) return
    const local = this.get(key)
    if (!local) {
      this.save(
        {
          key,
          title: row.title ?? '',
          preview: row.preview ?? '',
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          lastConsolidated: 0,
          metadata: {},
        },
        [],
      )
      return
    }
    if (row.updatedAt > local.updatedAt) {
      local.title = row.title ?? local.title
      local.preview = row.preview ?? local.preview
      local.updatedAt = row.updatedAt
      const detail = this.getDetail(key)
      if (detail) this.save(local, detail.messages)
    }
  }

  mergeSessionRows(rows: GatewaySessionRow[]): void {
    for (const row of rows) this.mergeSessionRow(row)
  }

  list(): SessionInfo[] {
    const results: SessionInfo[] = []
    if (!fs.existsSync(this.dir)) return results
    for (const f of fs.readdirSync(this.dir)) {
      if (!f.endsWith('.jsonl')) continue
      const fp = path.join(this.dir, f)
      try {
        const lines = fs.readFileSync(fp, 'utf-8').split('\n').filter(Boolean)
        if (lines.length <= 1) continue
        const info = this.parseInfoLine(lines[0])
        if (info) results.push(info)
      } catch {
        /* skip corrupt */
      }
    }
    return results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  listRows(): GatewaySessionRow[] {
    return this.list().map((info) => this.infoToRow(info))
  }

  buildWebuiThread(sessionKey: string): Record<string, unknown> | null {
    return buildWebuiThreadFromDetail(this.getDetail(sessionKey))
  }

  collectSyncThreads(): Record<string, Record<string, unknown>> {
    const out: Record<string, Record<string, unknown>> = {}
    for (const info of this.list()) {
      if (!this.hasMessages(info.key)) continue
      const thread = this.buildWebuiThread(info.key)
      if (thread && Array.isArray(thread.messages) && thread.messages.length > 0) {
        out[info.key] = thread
      }
    }
    return out
  }

  private infoToRow(info: SessionInfo): GatewaySessionRow {
    const idx = info.key.indexOf(':')
    return {
      key: info.key,
      channel: idx === -1 ? 'desktop' : info.key.slice(0, idx),
      chatId: idx === -1 ? info.key : info.key.slice(idx + 1),
      createdAt: info.createdAt,
      updatedAt: info.updatedAt,
      title: info.title,
      preview: info.preview,
    }
  }

  private safeKey(key: string): string {
    return key.replace(/[<>:"/\\|?*]/g, '_').slice(0, 200)
  }

  private filePath(key: string): string {
    return path.join(this.dir, `${this.safeKey(key)}.jsonl`)
  }

  private createEmptyInfo(key: string): SessionInfo {
    const now = new Date().toISOString()
    return {
      key,
      title: '',
      preview: '',
      createdAt: now,
      updatedAt: now,
      lastConsolidated: 0,
      metadata: {},
    }
  }

  private initSession(sessionKey: string) {
    return { info: this.createEmptyInfo(sessionKey), messages: [] as MessageRecord[] }
  }

  private nextMessageId(messages: MessageRecord[]): number {
    return messages.length > 0 ? messages[messages.length - 1].id + 1 : 1
  }

  private extractPreview(messages: MessageRecord[]): string {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    return (lastUser?.content ?? '').slice(0, PREVIEW_MAX_CHARS)
  }

  private load(fp: string): { info: SessionInfo; messages: MessageRecord[] } {
    const lines = fs.readFileSync(fp, 'utf-8').split('\n').filter(Boolean)
    const info = this.parseInfoLine(lines[0])
    const messages: MessageRecord[] = lines.slice(1).map((line) => JSON.parse(line))
    return { info, messages }
  }

  private parseInfoLine(raw: string): SessionInfo {
    const d = JSON.parse(raw) as Record<string, unknown>
    return {
      key: String(d.key ?? ''),
      title: String(d.title ?? ''),
      preview: String(d.preview ?? ''),
      createdAt: String(d.created_at ?? d.createdAt ?? new Date().toISOString()),
      updatedAt: String(d.updated_at ?? d.updatedAt ?? new Date().toISOString()),
      lastConsolidated: Number(d.last_consolidated ?? d.lastConsolidated ?? 0),
      metadata: (d.metadata as Record<string, unknown>) ?? {},
    }
  }

  private save(info: SessionInfo, messages: MessageRecord[]): void {
    const fp = this.filePath(info.key)
    const meta = {
      key: info.key,
      title: info.title,
      preview: info.preview,
      created_at: info.createdAt,
      updated_at: info.updatedAt,
      last_consolidated: info.lastConsolidated,
      metadata: info.metadata,
    }
    const lines = [JSON.stringify(meta), ...messages.map((m) => JSON.stringify(m))]
    const tmp = `${fp}.tmp`
    fs.writeFileSync(tmp, `${lines.join('\n')}\n`, 'utf-8')
    fs.renameSync(tmp, fp)
  }
}
