/**
 * Session Manager — JSONL 实现Local Fist原则
 */
import * as fs from 'fs'
import * as path from 'path'
import type { SessionInfo, SessionDetail, MessageRecord } from '../../shared/types'

const MAX_MESSAGES = 2000
const PREVIEW_MAX_CHARS = 120

export class SessionManager {
  private readonly _dir: string
  private readonly _cache = new Map<string, SessionInfo>()

  constructor(workspace: string) {
    this._dir = path.join(workspace, 'sessions')
    fs.mkdirSync(this._dir, { recursive: true })
    // 迁移旧数据库（如果存在）
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

  // ═══ CRUD ═══

  getOrCreate(key: string): SessionInfo {
    if (this._cache.has(key)) return this._cache.get(key)!
    const existing = this.get(key)
    if (existing) return existing

    const now = new Date().toISOString()
    const info: SessionInfo = { key, title: '', preview: '', createdAt: now, updatedAt: now, lastConsolidated: 0, metadata: {} }
    this._save(info, [])
    this._cache.set(key, info)
    return info
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
    let info: SessionInfo
    let messages: MessageRecord[]

    if (fs.existsSync(fp)) {
      const loaded = this._load(fp)
      info = loaded.info
      messages = loaded.messages
    } else {
      const now = new Date().toISOString()
      info = { key: sessionKey, title: '', preview: '', createdAt: now, updatedAt: now, lastConsolidated: 0, metadata: {} }
      messages = []
    }

    const now = new Date().toISOString()
    const id = messages.length > 0 ? messages[messages.length - 1].id + 1 : 1

    messages.push({
      id,
      sessionKey,
      role: msg.role,
      content: msg.content,
      toolCalls: msg.toolCalls,
      toolCallId: msg.toolCallId,
      name: msg.name,
      media: msg.media,
      timestamp: now,
    })

    // 上限裁剪
    if (messages.length > MAX_MESSAGES) {
      messages = messages.slice(messages.length - MAX_MESSAGES)
    }

    info.updatedAt = now

    // 生成预览
    const lastUser = [...messages].reverse().find((m: any) => m.role === 'user')
    info.preview = (lastUser?.content ?? '').slice(0, PREVIEW_MAX_CHARS)

    this._save(info, messages)
    this._cache.set(sessionKey, info)
  }

  getHistory(sessionKey: string, opts?: { maxMessages?: number; maxTokens?: number }): MessageRecord[] {
    const fp = this._filePath(sessionKey)
    if (!fs.existsSync(fp)) return []

    const { messages } = this._load(fp)
    const limit = opts?.maxMessages ?? 120

    // 找到最后一条 user 消息的位置
    let startIdx = messages.length
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { startIdx = i; break }
    }

    return messages.slice(Math.max(0, startIdx), messages.length).slice(-limit)
  }

  clear(key: string) {
    const now = new Date().toISOString()
    const info: SessionInfo = { key, title: '', preview: '', createdAt: now, updatedAt: now, lastConsolidated: 0, metadata: {} }
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

  list(): SessionInfo[] {
    const results: SessionInfo[] = []
    const files = fs.readdirSync(this._dir).filter(f => f.endsWith('.jsonl'))

    for (const f of files) {
      const fp = path.join(this._dir, f)
      try {
        const info = this._readInfoLine(fp)
        if (info) results.push(info)
      } catch {
        // 跳过损坏文件
      }
    }

    return results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  // ═══ 内部方法 ═══

  private _load(fp: string): { info: SessionInfo; messages: MessageRecord[] } {
    const lines = fs.readFileSync(fp, 'utf-8').split('\n').filter(Boolean)
    const infoLine = JSON.parse(lines[0])
    const info: SessionInfo = {
      key: infoLine.key,
      title: infoLine.title ?? '',
      preview: infoLine.preview ?? '',
      createdAt: infoLine.created_at,
      updatedAt: infoLine.updated_at,
      lastConsolidated: infoLine.last_consolidated ?? 0,
      metadata: infoLine.metadata ?? {},
    }
    const messages: MessageRecord[] = lines.slice(1).map((line) => JSON.parse(line))
    return { info, messages }
  }

  private _readInfoLine(fp: string): SessionInfo | null {
    const firstLine = fs.readFileSync(fp, 'utf-8').split('\n')[0]
    if (!firstLine) return null
    const d = JSON.parse(firstLine)
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

    const lines = [JSON.stringify(meta), ...messages.map(m => JSON.stringify(m))]
    // 原子写入：先写临时文件再 rename
    const tmp = fp + '.tmp'
    fs.writeFileSync(tmp, lines.join('\n') + '\n', 'utf-8')
    fs.renameSync(tmp, fp)
  }
}
