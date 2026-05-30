import { sessionRecordsFromWebuiMessages } from '@catbuddy/shared'
import type { PoolConnection, RowDataPacket } from 'mysql2/promise'
import type { MysqlPool } from '../../database/mysql-pool.js'
import {
  normalizeOwnerEmail,
  readOwnerEmail,
  SESSION_OWNER_KEY,
} from '../session-ownership.js'
import type {
  GatewaySessionRow,
  MessageRecord,
  SessionDetail,
  SessionInfo,
} from '../session-types.js'
import type { SessionStore } from '../ports/session-store.port.js'
import { buildWebuiThreadFromDetail } from '../webui-thread.js'

const MAX_MESSAGES = 2000
const PREVIEW_MAX_CHARS = 120

type SessionRow = RowDataPacket & {
  session_key: string
  title: string
  preview: string
  created_at: Date | string
  updated_at: Date | string
  last_consolidated: number
  metadata: string | Record<string, unknown>
}

type MessageRow = RowDataPacket & {
  message_id: number
  session_key: string
  role: MessageRecord['role']
  content: string
  tool_calls: string | unknown[] | null
  tool_call_id: string | null
  name: string | null
  media: string | string[] | null
  ts: Date | string
}

export class MysqlSessionStore implements SessionStore {
  private readonly cache = new Map<string, SessionInfo>()

  constructor(private readonly db: MysqlPool) {}

  async getOrCreate(key: string): Promise<SessionInfo> {
    if (this.cache.has(key)) return this.cache.get(key)!
    const existing = await this.get(key)
    if (existing) return existing
    const info = this.emptyInfo(key)
    await this.upsertSession(info, [])
    this.cache.set(key, info)
    return info
  }

  async get(key: string): Promise<SessionInfo | null> {
    const pool = this.db.getPool()
    const [rows] = await pool.execute<SessionRow[]>(
      `SELECT session_key, title, preview, created_at, updated_at, last_consolidated, metadata
       FROM gateway_sessions WHERE session_key = ? LIMIT 1`,
      [key],
    )
    const row = rows[0]
    if (!row) return null
    const info = this.rowToInfo(row)
    this.cache.set(key, info)
    return info
  }

  async getDetail(key: string): Promise<SessionDetail | null> {
    const info = await this.get(key)
    if (!info) return null
    const messages = await this.loadMessages(key)
    return { ...info, messages }
  }

  async hasMessages(key: string): Promise<boolean> {
    const pool = this.db.getPool()
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 1 FROM gateway_session_messages WHERE session_key = ? LIMIT 1`,
      [key],
    )
    return rows.length > 0
  }

  async addUserMessage(sessionKey: string, content: string): Promise<void> {
    await this.addMessage(sessionKey, { role: 'user', content })
  }

  async addAssistantMessage(sessionKey: string, content: string): Promise<void> {
    await this.addMessage(sessionKey, { role: 'assistant', content })
  }

  async addMessage(
    sessionKey: string,
    msg: Omit<MessageRecord, 'id' | 'sessionKey' | 'timestamp'>,
  ): Promise<void> {
    const conn = await this.db.getPool().getConnection()
    try {
      await conn.beginTransaction()
      const { info, messages } = await this.loadOrInit(conn, sessionKey)
      const now = new Date().toISOString()
      const nextId = messages.length > 0 ? messages[messages.length - 1].id + 1 : 1
      const record: MessageRecord = {
        id: nextId,
        sessionKey,
        role: msg.role,
        content: msg.content,
        toolCalls: msg.toolCalls,
        toolCallId: msg.toolCallId,
        name: msg.name,
        media: msg.media,
        timestamp: now,
      }
      messages.push(record)
      if (messages.length > MAX_MESSAGES) {
        const drop = messages.length - MAX_MESSAGES
        const keep = messages.slice(drop)
        await conn.execute(`DELETE FROM gateway_session_messages WHERE session_key = ?`, [
          sessionKey,
        ])
        for (const m of keep) {
          await this.insertMessage(conn, m)
        }
        messages.length = 0
        messages.push(...keep)
      } else {
        await this.insertMessage(conn, record)
      }
      info.updatedAt = now
      info.preview = this.extractPreview(messages)
      await this.writeSession(conn, info)
      await conn.commit()
      this.cache.set(sessionKey, info)
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  async importWebuiPayload(
    sessionKey: string,
    payload: Record<string, unknown> | null,
  ): Promise<void> {
    if (!sessionKey || !payload) return
    const rawMessages = payload.messages
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) return

    const info = await this.getOrCreate(sessionKey)
    const messages = sessionRecordsFromWebuiMessages(sessionKey, rawMessages)
    if (messages.length === 0) return

    info.updatedAt =
      typeof payload.savedAt === 'string'
        ? payload.savedAt
        : messages[messages.length - 1].timestamp
    info.preview = this.extractPreview(messages)

    const conn = await this.db.getPool().getConnection()
    try {
      await conn.beginTransaction()
      await conn.execute(`DELETE FROM gateway_session_messages WHERE session_key = ?`, [
        sessionKey,
      ])
      for (const m of messages) await this.insertMessage(conn, m)
      await this.writeSession(conn, info)
      await conn.commit()
      this.cache.set(sessionKey, info)
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  async mergeSessionRow(row: GatewaySessionRow): Promise<void> {
    const key = row.key
    if (!key) return
    const local = await this.get(key)
    if (!local) {
      await this.upsertSession(
        {
          key,
          title: row.title ?? '',
          preview: row.preview ?? '',
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          lastConsolidated: 0,
          metadata: {
            ...(row.workspaceFolderId ? { workspaceFolderId: row.workspaceFolderId } : {}),
            ...(row.workspaceFolderName ? { workspaceFolderName: row.workspaceFolderName } : {}),
          },
        },
        [],
      )
      return
    }
    const nextMetadata = {
      ...local.metadata,
      ...(row.workspaceFolderId ? { workspaceFolderId: row.workspaceFolderId } : {}),
      ...(row.workspaceFolderName ? { workspaceFolderName: row.workspaceFolderName } : {}),
    }
    const metadataChanged = JSON.stringify(nextMetadata) !== JSON.stringify(local.metadata)
    if (row.updatedAt > local.updatedAt || metadataChanged) {
      local.title = row.title ?? local.title
      local.preview = row.preview ?? local.preview
      if (row.updatedAt > local.updatedAt) local.updatedAt = row.updatedAt
      local.metadata = nextMetadata
      const conn = await this.db.getPool().getConnection()
      try {
        await this.writeSession(conn, local)
      } finally {
        conn.release()
      }
      this.cache.set(key, local)
    }
  }

  async mergeSessionRows(rows: GatewaySessionRow[]): Promise<void> {
    for (const row of rows) await this.mergeSessionRow(row)
  }

  async list(): Promise<SessionInfo[]> {
    const pool = this.db.getPool()
    const [rows] = await pool.execute<SessionRow[]>(
      `SELECT s.session_key, s.title, s.preview, s.created_at, s.updated_at,
              s.last_consolidated, s.metadata
       FROM gateway_sessions s
       ORDER BY s.updated_at DESC`,
    )
    return rows.map((r) => this.rowToInfo(r))
  }

  async listRows(): Promise<GatewaySessionRow[]> {
    return (await this.list()).map((info) => this.infoToRow(info))
  }

  async getSessionOwner(sessionKey: string): Promise<string | null> {
    const info = (await this.get(sessionKey)) ?? this.cache.get(sessionKey)
    return info ? readOwnerEmail(info.metadata) : null
  }

  async setSessionOwner(sessionKey: string, ownerEmail: string): Promise<void> {
    const owner = normalizeOwnerEmail(ownerEmail)
    const conn = await this.db.getPool().getConnection()
    try {
      const { info, messages } = await this.loadOrInit(conn, sessionKey)
      info.metadata = { ...info.metadata, [SESSION_OWNER_KEY]: owner }
      await this.writeSession(conn, info)
      if (messages.length === 0) {
        /* session row only */
      }
      this.cache.set(sessionKey, info)
    } finally {
      conn.release()
    }
  }

  async isSessionOwnedBy(sessionKey: string, ownerEmail: string): Promise<boolean> {
    const owner = await this.getSessionOwner(sessionKey)
    if (!owner) return false
    return owner === normalizeOwnerEmail(ownerEmail)
  }

  async listRowsForOwner(ownerEmail: string): Promise<GatewaySessionRow[]> {
    const want = normalizeOwnerEmail(ownerEmail)
    const rows = await this.listRows()
    const out: GatewaySessionRow[] = []
    for (const row of rows) {
      const info = await this.get(row.key)
      if (info && readOwnerEmail(info.metadata) === want) out.push(row)
    }
    return out
  }

  async deleteSession(sessionKey: string): Promise<boolean> {
    const key = sessionKey.trim()
    if (!key) return false
    const conn = await this.db.getPool().getConnection()
    try {
      await conn.beginTransaction()
      const [msgResult] = await conn.execute(
        `DELETE FROM gateway_session_messages WHERE session_key = ?`,
        [key],
      )
      const [sessResult] = await conn.execute(
        `DELETE FROM gateway_sessions WHERE session_key = ?`,
        [key],
      )
      await conn.commit()
      this.cache.delete(key)
      const msgCount = (msgResult as { affectedRows?: number }).affectedRows ?? 0
      const sessCount = (sessResult as { affectedRows?: number }).affectedRows ?? 0
      return msgCount > 0 || sessCount > 0
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  async buildWebuiThread(sessionKey: string): Promise<Record<string, unknown> | null> {
    return buildWebuiThreadFromDetail(await this.getDetail(sessionKey))
  }

  async collectSyncThreads(): Promise<Record<string, Record<string, unknown>>> {
    const out: Record<string, Record<string, unknown>> = {}
    for (const info of await this.list()) {
      const thread = await this.buildWebuiThread(info.key)
      if (thread && Array.isArray(thread.messages) && thread.messages.length > 0) {
        out[info.key] = thread
      }
    }
    return out
  }

  async collectSyncThreadsForOwner(
    ownerEmail: string,
  ): Promise<Record<string, Record<string, unknown>>> {
    const out: Record<string, Record<string, unknown>> = {}
    for (const row of await this.listRowsForOwner(ownerEmail)) {
      const thread = await this.buildWebuiThread(row.key)
      if (thread && Array.isArray(thread.messages) && thread.messages.length > 0) {
        out[row.key] = thread
      }
    }
    return out
  }

  private async loadOrInit(
    conn: PoolConnection,
    sessionKey: string,
  ): Promise<{ info: SessionInfo; messages: MessageRecord[] }> {
    const [rows] = await conn.execute<SessionRow[]>(
      `SELECT session_key, title, preview, created_at, updated_at, last_consolidated, metadata
       FROM gateway_sessions WHERE session_key = ? LIMIT 1`,
      [sessionKey],
    )
    if (rows[0]) {
      const info = this.rowToInfo(rows[0])
      const messages = await this.loadMessages(sessionKey, conn)
      return { info, messages }
    }
    const info = this.emptyInfo(sessionKey)
    await this.writeSession(conn, info)
    return { info, messages: [] }
  }

  private async loadMessages(
    sessionKey: string,
    conn?: PoolConnection,
  ): Promise<MessageRecord[]> {
    const runner = conn ?? this.db.getPool()
    const [rows] = await runner.execute<MessageRow[]>(
      `SELECT message_id, session_key, role, content, tool_calls, tool_call_id, name, media, ts
       FROM gateway_session_messages
       WHERE session_key = ?
       ORDER BY message_id ASC`,
      [sessionKey],
    )
    return rows.map((r) => this.rowToMessage(r))
  }

  private async upsertSession(info: SessionInfo, messages: MessageRecord[]): Promise<void> {
    const conn = await this.db.getPool().getConnection()
    try {
      await conn.beginTransaction()
      await this.writeSession(conn, info)
      await conn.execute(`DELETE FROM gateway_session_messages WHERE session_key = ?`, [
        info.key,
      ])
      for (const m of messages) await this.insertMessage(conn, m)
      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  private async writeSession(conn: PoolConnection, info: SessionInfo): Promise<void> {
    await conn.execute(
      `INSERT INTO gateway_sessions
         (session_key, title, preview, created_at, updated_at, last_consolidated, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         preview = VALUES(preview),
         updated_at = VALUES(updated_at),
         last_consolidated = VALUES(last_consolidated),
         metadata = VALUES(metadata)`,
      [
        info.key,
        info.title,
        info.preview,
        this.toMysqlDatetime(info.createdAt),
        this.toMysqlDatetime(info.updatedAt),
        info.lastConsolidated,
        JSON.stringify(info.metadata ?? {}),
      ],
    )
  }

  private async insertMessage(conn: PoolConnection, m: MessageRecord): Promise<void> {
    await conn.execute(
      `INSERT INTO gateway_session_messages
         (session_key, message_id, role, content, tool_calls, tool_call_id, name, media, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.sessionKey,
        m.id,
        m.role,
        m.content,
        m.toolCalls ? JSON.stringify(m.toolCalls) : null,
        m.toolCallId ?? null,
        m.name ?? null,
        m.media ? JSON.stringify(m.media) : null,
        this.toMysqlDatetime(m.timestamp),
      ],
    )
  }

  private rowToInfo(row: SessionRow): SessionInfo {
    let metadata: Record<string, unknown> = {}
    if (typeof row.metadata === 'string') {
      try {
        metadata = JSON.parse(row.metadata) as Record<string, unknown>
      } catch {
        metadata = {}
      }
    } else if (row.metadata && typeof row.metadata === 'object') {
      metadata = row.metadata as Record<string, unknown>
    }
    return {
      key: row.session_key,
      title: row.title ?? '',
      preview: row.preview ?? '',
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      lastConsolidated: Number(row.last_consolidated ?? 0),
      metadata,
    }
  }

  private rowToMessage(row: MessageRow): MessageRecord {
    return {
      id: Number(row.message_id),
      sessionKey: row.session_key,
      role: row.role,
      content: row.content,
      toolCalls: this.parseJson(row.tool_calls),
      toolCallId: row.tool_call_id ?? undefined,
      name: row.name ?? undefined,
      media: this.parseJson(row.media) as string[] | undefined,
      timestamp: new Date(row.ts).toISOString(),
    }
  }

  private parseJson(raw: string | unknown[] | null): unknown[] | undefined {
    if (raw == null) return undefined
    if (Array.isArray(raw)) return raw
    try {
      return JSON.parse(raw) as unknown[]
    } catch {
      return undefined
    }
  }

  private emptyInfo(key: string): SessionInfo {
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
      workspaceFolderId:
        typeof info.metadata?.workspaceFolderId === 'string'
          ? info.metadata.workspaceFolderId
          : null,
      workspaceFolderName:
        typeof info.metadata?.workspaceFolderName === 'string'
          ? info.metadata.workspaceFolderName
          : null,
    }
  }

  private extractPreview(messages: MessageRecord[]): string {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    return (lastUser?.content ?? '').slice(0, PREVIEW_MAX_CHARS)
  }

  private toMysqlDatetime(iso: string): string {
    return iso.slice(0, 23).replace('T', ' ')
  }
}
