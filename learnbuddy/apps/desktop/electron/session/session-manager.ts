/** Session Manager - JSONL 实现 Local First 原则 */
import * as fs from 'fs'
import * as path from 'path'
import type { SessionInfo, SessionDetail, MessageRecord } from "@learnbuddy/shared"


const MAX_MESSAGES = 2000
const PREVIEW_MAX_CHARS = 120

export class SessionManager {
  private readonly _dir: string
  private readonly _cache = new Map<string, SessionInfo>()

  constructor(workspace: string) {
    this._dir = path.join(workspace, 'sessions')
    fs.mkdirSync(this._dir, { recursive: true })
    this._migrateLegacyDb()
  }



  getOrCreate(key: string): SessionInfo {
    if (this._cache.has(key)) return this._cache.get(key)!
    const existing = this.get(key)
    if (existing) return existing

    // 仅占内存，首条 addMessage 时才落盘，避免 Web 频繁「新建」产生空 JSONL
    const info = this._createEmptyInfo(key)
    this._cache.set(key, info)
    return info
  }

  /** 是否有至少一条对话消息（非仅元数据行）。 */
  hasMessages(key: string): boolean {
    const fp = this._filePath(key)
    if (!fs.existsSync(fp)) return false
    try {
      const lines = fs.readFileSync(fp, 'utf-8').split('\n').filter(Boolean)
      return lines.length > 1
    } catch {
      return false
    }
  }

  get(key: string): SessionInfo | null {
    const fp = this._filePath(key)
    if (!fs.existsSync(fp)) return null

    try {
      const { info } = this._load(fp)
      return info
    } catch {
      return null
    }
  }

  getDetail(key: string): SessionDetail | null {
    const fp = this._filePath(key)
    if (!fs.existsSync(fp)) return null

    try {
      const { info, messages } = this._load(fp)
      return { ...info, messages }
    } catch {
      return null
    }
  }

  addMessage(sessionKey: string, msg: Omit<MessageRecord, 'id' | 'sessionKey'>) {
    const fp = this._filePath(sessionKey)
    const { info, messages } = fs.existsSync(fp) ? this._load(fp) : this._initSession(sessionKey)

    const now = new Date().toISOString()
    const id = this._nextMessageId(messages)

    messages.push({
      id,
      sessionKey,
      role: msg.role,
      content: msg.content,
      toolCalls: msg.toolCalls,
      toolCallId: msg.toolCallId,
      name: msg.name,
      media: msg.media,
      reasoningContent: msg.reasoningContent,
      timestamp: now,
    })

    // 上限裁剪
    if (messages.length > MAX_MESSAGES) {
      messages.splice(0, messages.length - MAX_MESSAGES)
    }

    // 更新会话预览
    info.updatedAt = now
    info.preview = this._extractPreview(messages)

    this._save(info, messages)
    this._cache.set(sessionKey, info)
  }

  getHistory(sessionKey: string, opts?: { maxMessages?: number; maxTokens?: number }): MessageRecord[] {
    const fp = this._filePath(sessionKey)
    if (!fs.existsSync(fp)) return []

    const { messages } = this._load(fp)
    const limit = opts?.maxMessages ?? 120

    // 找到最后一条 user 消息的位置
    const lastUserIdx = [...messages].reverse().findIndex((m) => m.role === 'user')
    const startIdx = lastUserIdx >= 0 ? messages.length - lastUserIdx : 0

    return messages.slice(startIdx, messages.length).slice(-limit)
  }

  clear(key: string) {
    const info = this._createEmptyInfo(key)
    this._save(info, [])
    this._cache.set(key, info)
  }

  delete(key: string): boolean {
    const fp = this._filePath(key)
    this._cache.delete(key)

    if (fs.existsSync(fp)) {
      fs.unlinkSync(fp)
      return true
    }
    return false
  }

  /** Import gateway / webui-thread payload into local JSONL (desktop ← gateway sync). */
  importWebuiThread(
    sessionKey: string,
    payload: { messages?: Array<Record<string, unknown>>; savedAt?: string },
  ): void {
    const raw = payload?.messages
    if (!Array.isArray(raw) || raw.length === 0) return

    const local = this.getDetail(sessionKey)
    const localUpdated = local?.updatedAt ?? ''
    const incomingAt =
      typeof payload.savedAt === 'string' ? payload.savedAt : ''
    if (local && localUpdated && incomingAt && incomingAt <= localUpdated) {
      return
    }

    const { info, messages } = this._initSession(sessionKey)
    let id = 1
    for (const m of raw) {
      const role = String(m.role ?? 'assistant')
      const content = String(m.content ?? '')
      const ts =
        typeof m.createdAt === 'number'
          ? new Date(m.createdAt).toISOString()
          : new Date().toISOString()
      if (m.kind === 'trace') {
        const traces = Array.isArray(m.traces) ? m.traces.map(String) : [content]
        messages.push({
          id: id++,
          sessionKey,
          role: 'tool',
          content: traces.join('\n'),
          name: 'trace',
          timestamp: ts,
        })
      } else if (role === 'user' || role === 'assistant' || role === 'system') {
        messages.push({
          id: id++,
          sessionKey,
          role: role as MessageRecord['role'],
          content,
          timestamp: ts,
        })
      }
    }
    if (messages.length === 0) return
    info.updatedAt = incomingAt || messages[messages.length - 1].timestamp
    info.preview = this._extractPreview(messages)
    this._save(info, messages)
    this._cache.set(sessionKey, info)
  }

  list(): SessionInfo[] {
    const byKey = new Map<string, SessionInfo>()

    const files = fs.readdirSync(this._dir).filter((f) => f.endsWith('.jsonl'))
    for (const f of files) {
      const fp = path.join(this._dir, f)
      try {
        const lines = fs.readFileSync(fp, 'utf-8').split('\n').filter(Boolean)
        if (lines.length <= 1) continue
        const info = this._parseInfoLine(lines[0])
        if (info) byKey.set(info.key, info)
      } catch {
        // 跳过损坏文件
      }
    }

    // 含内存中新建、尚未落盘的会话，供 Gateway sessions_sync 推送到 Web
    for (const info of this._cache.values()) {
      if (!byKey.has(info.key)) byKey.set(info.key, info)
    }

    return [...byKey.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }



  private _migrateLegacyDb() {
    const dbPath = path.join(this._dir, 'sessions.db')
    if (fs.existsSync(dbPath)) {
      fs.renameSync(dbPath, path.join(this._dir, 'sessions.db.bak'))
    }
  }

  private _safeKey(key: string): string {
    return key.replace(/[<>:"/\\|?*]/g, '_').slice(0, 200)
  }

  private _filePath(key: string): string {
    return path.join(this._dir, `${this._safeKey(key)}.jsonl`)
  }

  private _createEmptyInfo(key: string): SessionInfo {
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

  private _initSession(sessionKey: string) {
    return {
      info: this._createEmptyInfo(sessionKey),
      messages: [] as MessageRecord[],
    }
  }

  private _nextMessageId(messages: MessageRecord[]): number {
    return messages.length > 0 ? messages[messages.length - 1].id + 1 : 1
  }

  private _extractPreview(messages: MessageRecord[]): string {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    return (lastUser?.content ?? '').slice(0, PREVIEW_MAX_CHARS)
  }

  private _load(fp: string): { info: SessionInfo; messages: MessageRecord[] } {
    const lines = fs.readFileSync(fp, 'utf-8').split('\n').filter(Boolean)
    const info = this._parseInfoLine(lines[0])
    const messages: MessageRecord[] = lines.slice(1).map((line) => JSON.parse(line))
    return { info, messages }
  }

  private _readInfoLine(fp: string): SessionInfo | null {
    const firstLine = fs.readFileSync(fp, 'utf-8').split('\n')[0]
    if (!firstLine) return null
    return this._parseInfoLine(firstLine)
  }

  private _parseInfoLine(raw: string): SessionInfo {
    const d = JSON.parse(raw)
    return {
      key: d.key,
      title: d.title ?? '',
      preview: d.preview ?? '',
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      lastConsolidated: d.last_consolidated ?? 0,
      metadata: d.metadata ?? {},
    }
  }

  private _save(info: SessionInfo, messages: MessageRecord[]) {
    const fp = this._filePath(info.key)
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
    const tmp = fp + '.tmp'

    // 原子写入：先写临时文件再 rename
    fs.writeFileSync(tmp, lines.join('\n') + '\n', 'utf-8')
    fs.renameSync(tmp, fp)
  }
}
