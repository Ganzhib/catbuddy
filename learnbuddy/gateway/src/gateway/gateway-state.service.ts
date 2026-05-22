import { Injectable } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import type WebSocket from 'ws'
import { gatewayEnv } from '../config/env'
import { GatewaySessionStore } from '../storage/gateway-session-store'

export const GATEWAY_OFFLINE_REPLY =
  '桌面端未连接或未开启「远程控制」，无法执行 Agent。请启动 learnbuddy 桌面应用，在侧栏打开远程控制开关后重试。'

export interface GatewaySessionRow {
  key: string
  channel: string
  chatId: string
  createdAt: string
  updatedAt: string
  title?: string
  preview: string
}

const EXECUTOR_RPC_TIMEOUT_MS = 8_000

type PendingRpc<T> = {
  resolve: (value: T) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export type GatewayClientRole = 'executor' | 'viewer'

export interface GatewayClient {
  ws: WebSocket
  role: GatewayClientRole
  deviceId: string
  sessions: Set<string>
  clientKey: string
  viewerEmail?: string
}

@Injectable()
export class GatewayStateService {
  readonly store: GatewaySessionStore

  private readonly clients = new Map<string, GatewayClient>()
  private readonly pairingByCode = new Map<string, string>()
  private readonly viewerTokens = new Set<string>()
  private readonly sessionExecutor = new Map<string, string>()
  private readonly sessionViewers = new Map<string, Set<WebSocket>>()
  /** Latest session list from desktop executor (deviceId → rows). */
  private readonly sessionCatalogByDevice = new Map<string, GatewaySessionRow[]>()
  private readonly pendingSessions = new Map<string, PendingRpc<GatewaySessionRow[]>>()
  private readonly pendingThreads = new Map<
    string,
    PendingRpc<Record<string, unknown> | null>
  >()
  /** Web 拉历史时的缓存（由桌面 thread_snapshot / thread_response 写入）。 */
  private readonly threadCache = new Map<string, Record<string, unknown>>()

  constructor() {
    this.store = new GatewaySessionStore(gatewayEnv.dataDir || undefined)
  }

  registerViewerToken(token: string): void {
    if (token) this.viewerTokens.add(token)
  }

  isViewerAuthorized(token: string): boolean {
    return !!token && this.viewerTokens.has(token)
  }

  getExecutorSecret(): string {
    return gatewayEnv.executorSecret
  }

  getDevViewerToken(): string {
    return gatewayEnv.devViewerToken
  }

  chatIdFromSessionKey(sessionKey: string): string {
    const idx = sessionKey.indexOf(':')
    return idx === -1 ? sessionKey : sessionKey.slice(idx + 1)
  }

  channelFromSessionKey(sessionKey: string): string {
    const idx = sessionKey.indexOf(':')
    return idx === -1 ? 'desktop' : sessionKey.slice(0, idx)
  }

  collectSessionKeys(): string[] {
    const keys = new Set(this.sessionExecutor.keys())
    for (const c of this.clients.values()) {
      if (c.role === 'executor') {
        for (const sk of c.sessions) keys.add(sk)
      }
    }
    return [...keys]
  }

  private getExecutor(deviceId: string): GatewayClient | null {
    for (const c of this.clients.values()) {
      if (c.role === 'executor' && c.deviceId === deviceId) return c
    }
    return null
  }

  private pickOnlineExecutor(): GatewayClient | null {
    const online = [...this.clients.values()].filter(
      (c) => c.role === 'executor' && c.ws.readyState === 1,
    )
    return online.length === 1 ? online[0] : online[0] ?? null
  }

  private pickExecutorForSession(sessionKey: string): string | null {
    let deviceId = this.sessionExecutor.get(sessionKey)
    if (deviceId) return deviceId
    const online = [...this.clients.values()].filter(
      (c) => c.role === 'executor' && c.ws.readyState === 1,
    )
    if (online.length === 1) {
      deviceId = online[0].deviceId
      this.sessionExecutor.set(sessionKey, deviceId)
      return deviceId
    }
    return null
  }

  /** 将 viewer WS 记入 session，避免仅 HTTP 发消息时尚未 subscribe 而收不到流式事件。 */
  ensureViewerSubscribedForToken(viewerToken: string, sessionKey: string): void {
    if (!viewerToken || !sessionKey) return
    const prefix = `viewer:${viewerToken}:`
    for (const [clientKey, client] of this.clients.entries()) {
      if (client.role !== 'viewer' || !clientKey.startsWith(prefix)) continue
      client.sessions.add(sessionKey)
      let set = this.sessionViewers.get(sessionKey)
      if (!set) {
        set = new Set()
        this.sessionViewers.set(sessionKey, set)
      }
      set.add(client.ws)
    }
  }

  broadcastUiEvent(sessionKey: string, chatId: string, event: Record<string, unknown>): void {
    const payload = JSON.stringify({ type: 'ui_event', sessionKey, chatId, event })
    const targeted = this.sessionViewers.get(sessionKey)
    const sent = new Set<WebSocket>()
    if (targeted) {
      for (const ws of targeted) {
        if (ws.readyState === 1) {
          ws.send(payload)
          sent.add(ws)
        }
      }
    }
    // 开发期常见：HTTP 已转发、WS subscribe 尚未到达 → 兜底发给所有 viewer
    for (const client of this.clients.values()) {
      if (client.role !== 'viewer' || client.ws.readyState !== 1) continue
      if (sent.has(client.ws)) continue
      client.ws.send(payload)
      client.sessions.add(sessionKey)
      let set = this.sessionViewers.get(sessionKey)
      if (!set) {
        set = new Set()
        this.sessionViewers.set(sessionKey, set)
      }
      set.add(client.ws)
    }
  }

  applySessionsSync(
    deviceId: string,
    sessions: GatewaySessionRow[],
    options?: { notifyViewers?: boolean },
  ): void {
    this.sessionCatalogByDevice.set(deviceId, sessions)
    this.store.mergeSessionRows(sessions)
    for (const row of sessions) {
      this.sessionExecutor.set(row.key, deviceId)
    }
    if (options?.notifyViewers) this.notifyViewersSessionListChanged()
  }

  private notifyViewersSessionListChanged(): void {
    const payload = JSON.stringify({
      type: 'ui_event',
      sessionKey: 'desktop:',
      chatId: 'metadata',
      event: {
        event: 'session_updated',
        chat_id: 'metadata',
        scope: 'metadata',
      },
    })
    for (const client of this.clients.values()) {
      if (client.role === 'viewer' && client.ws.readyState === 1) {
        client.ws.send(payload)
      }
    }
  }

  resolveSessionsRpc(requestId: string, sessions: GatewaySessionRow[]): void {
    const pending = this.pendingSessions.get(requestId)
    if (!pending) return
    clearTimeout(pending.timer)
    this.pendingSessions.delete(requestId)
    pending.resolve(sessions)
  }

  resolveThreadRpc(
    requestId: string,
    payload: Record<string, unknown> | null,
    sessionKey?: string,
  ): void {
    if (sessionKey && payload) this.putThreadCache(sessionKey, payload)
    const pending = this.pendingThreads.get(requestId)
    if (!pending) return
    clearTimeout(pending.timer)
    this.pendingThreads.delete(requestId)
    pending.resolve(payload)
  }

  private requestSessionsRpc(exec: GatewayClient): Promise<GatewaySessionRow[] | null> {
    const requestId = randomBytes(8).toString('hex')
    return new Promise<GatewaySessionRow[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingSessions.delete(requestId)
        reject(new Error('sessions_rpc_timeout'))
      }, EXECUTOR_RPC_TIMEOUT_MS)
      this.pendingSessions.set(requestId, { resolve, reject, timer })
      exec.ws.send(JSON.stringify({ type: 'request_sessions', requestId }))
    }).catch(() => null)
  }

  async fetchSessionsFromExecutor(): Promise<GatewaySessionRow[]> {
    const local = this.store.listRows()
    const exec = this.pickOnlineExecutor()
    if (!exec) return local.length ? local : this.fallbackSessionRows()

    const cached = this.sessionCatalogByDevice.get(exec.deviceId)
    if (cached?.length) {
      this.store.mergeSessionRows(cached)
      return this.store.listRows()
    }

    const rows = await this.requestSessionsRpc(exec)
    if (rows?.length) {
      this.applySessionsSync(exec.deviceId, rows, { notifyViewers: false })
      return this.store.listRows()
    }
    return local.length ? local : this.fallbackSessionRows()
  }

  /** 仅写入 Gateway 缓存，不通知 Web（避免 webui-thread ↔ session_updated 死循环）。 */
  putThreadCache(sessionKey: string, payload: Record<string, unknown> | null): void {
    if (!sessionKey || !payload) return
    this.threadCache.set(sessionKey, payload)
  }

  getCachedThread(sessionKey: string): Record<string, unknown> | null {
    return this.threadCache.get(sessionKey) ?? null
  }

  async fetchThreadFromExecutor(
    sessionKey: string,
  ): Promise<Record<string, unknown> | null> {
    const persisted = this.store.buildWebuiThread(sessionKey)
    if (
      persisted
      && Array.isArray(persisted.messages)
      && persisted.messages.length > 0
    ) {
      return persisted
    }
    const cached = this.getCachedThread(sessionKey)
    if (cached) return cached
    const exec = this.pickOnlineExecutor()
    if (!exec) return persisted
    const requestId = randomBytes(8).toString('hex')
    const fresh = await new Promise<Record<string, unknown> | null>(
      (resolve, reject) => {
        const timer = setTimeout(() => {
          this.pendingThreads.delete(requestId)
          reject(new Error('thread_rpc_timeout'))
        }, EXECUTOR_RPC_TIMEOUT_MS)
        this.pendingThreads.set(requestId, { resolve, reject, timer })
        exec.ws.send(
          JSON.stringify({ type: 'request_thread', requestId, sessionKey }),
        )
      },
    ).catch(() => null)
    if (fresh) {
      this.putThreadCache(sessionKey, fresh)
      this.store.importWebuiPayload(sessionKey, fresh)
      return fresh
    }
    return cached ?? persisted
  }

  private fallbackSessionRows(): GatewaySessionRow[] {
    const fromStore = this.store.listRows()
    if (fromStore.length) return fromStore
    const now = new Date().toISOString()
    return this.collectSessionKeys().map((key) => ({
      key,
      channel: this.channelFromSessionKey(key),
      chatId: this.chatIdFromSessionKey(key),
      createdAt: now,
      updatedAt: now,
      title: '',
      preview: '',
    }))
  }

  forwardCreateSessionToExecutor(
    sessionKey: string,
    chatId: string,
  ): { ok: boolean; error?: string; offline?: boolean } {
    this.store.getOrCreate(sessionKey)
    const exec = this.pickOnlineExecutor()
    if (!exec) return { ok: true, offline: true }
    exec.sessions.add(sessionKey)
    this.sessionExecutor.set(sessionKey, exec.deviceId)
    exec.ws.send(JSON.stringify({ type: 'create_session', sessionKey, chatId }))
    return { ok: true }
  }

  /** Web 发消息：先写 Gateway JSONL，再转发桌面；无 executor 时返回离线系统提示。 */
  handleWebInbound(
    sessionKey: string,
    chatId: string,
    content: string,
    media: unknown[] | undefined,
    source: 'web' | 'relay',
  ): { ok: boolean; queued?: boolean; offline?: boolean; error?: string } {
    this.store.getOrCreate(sessionKey)
    this.store.addUserMessage(sessionKey, content)

    const exec = this.pickOnlineExecutor()
    if (!exec) {
      this.emitOfflineAssistantReply(sessionKey, chatId)
      return { ok: true, offline: true, queued: false }
    }

    this.sessionExecutor.set(sessionKey, exec.deviceId)
    exec.sessions.add(sessionKey)
    exec.ws.send(
      JSON.stringify({
        type: 'inbound_message',
        sessionKey,
        chatId,
        content,
        media: media ?? [],
        source,
      }),
    )
    return { ok: true, queued: true }
  }

  private emitOfflineAssistantReply(sessionKey: string, chatId: string): void {
    const text = GATEWAY_OFFLINE_REPLY
    this.store.addAssistantMessage(sessionKey, text)
    this.broadcastUiEvent(sessionKey, chatId, {
      event: 'message',
      chat_id: chatId,
      text,
    })
    this.broadcastUiEvent(sessionKey, chatId, {
      event: 'turn_end',
      chat_id: chatId,
      latency_ms: 0,
    })
    this.notifyViewersSessionListChanged()
  }

  forwardInboundToExecutor(
    sessionKey: string,
    chatId: string,
    content: string,
    media: unknown[] | undefined,
    source: 'web' | 'relay',
  ): { ok: boolean; queued?: boolean; error?: string } {
    return this.handleWebInbound(sessionKey, chatId, content, media, source)
  }

  /** 桌面连接后：把 Gateway JSONL 会话推送给 executor 合并。 */
  pushSyncToExecutor(ws: WebSocket): void {
    if (ws.readyState !== 1) return
    const sessions = this.store.listRows()
    const threads = this.store.collectSyncThreads()
    ws.send(JSON.stringify({ type: 'sync_push', sessions, threads }))
  }

  persistThreadSnapshot(
    sessionKey: string,
    payload: Record<string, unknown> | null,
  ): void {
    if (!sessionKey || !payload) return
    this.putThreadCache(sessionKey, payload)
    this.store.importWebuiPayload(sessionKey, payload)
  }

  pairViewer(pairingCode: string, token: string): { ok: boolean; deviceId?: string; error?: string } {
    const code = pairingCode.trim().toUpperCase()
    const deviceId = this.pairingByCode.get(code)
    if (!deviceId) return { ok: false, error: 'invalid_pairing_code' }
    this.registerViewerToken(token)
    return { ok: true, deviceId }
  }

  registerExecutor(ws: WebSocket, deviceId: string, token: string): {
    ok: boolean
    pairingCode?: string
    error?: string
  } {
    if (token !== gatewayEnv.executorSecret) {
      return { ok: false, error: 'unauthorized' }
    }
    const pairingCode = randomBytes(3).toString('hex').toUpperCase()
    this.pairingByCode.set(pairingCode, deviceId)
    const clientKey = `executor:${deviceId}`
    this.clients.set(clientKey, {
      ws,
      role: 'executor',
      deviceId,
      sessions: new Set(),
      clientKey,
    })
    this.pushSyncToExecutor(ws)
    return { ok: true, pairingCode }
  }

  registerViewer(ws: WebSocket, deviceId: string, token: string, viewerEmail?: string): {
    ok: boolean
    error?: string
  } {
    if (!this.isViewerAuthorized(token)) {
      return { ok: false, error: 'unauthorized' }
    }
    const clientKey = `viewer:${token}:${deviceId}`
    this.clients.set(clientKey, {
      ws,
      role: 'viewer',
      deviceId,
      sessions: new Set(),
      clientKey,
      viewerEmail,
    })
    return { ok: true }
  }

  subscribe(ws: WebSocket, sessionKey: string, clientKey: string): void {
    const client = this.clients.get(clientKey)
    if (!client || !sessionKey) return
    client.sessions.add(sessionKey)
    if (client.role === 'viewer') {
      let set = this.sessionViewers.get(sessionKey)
      if (!set) {
        set = new Set()
        this.sessionViewers.set(sessionKey, set)
      }
      set.add(ws)
    }
    if (client.role === 'executor') {
      this.sessionExecutor.set(sessionKey, client.deviceId)
    }
  }

  unsubscribe(ws: WebSocket, sessionKey: string, clientKey: string): void {
    const client = this.clients.get(clientKey)
    if (!client) return
    client.sessions.delete(sessionKey)
    this.sessionViewers.get(sessionKey)?.delete(ws)
  }

  publishUiEventFromExecutor(
    clientKey: string,
    sessionKey: string,
    chatId: string,
    event: Record<string, unknown>,
  ): void {
    const client = this.clients.get(clientKey)
    if (!client || client.role !== 'executor') return
    const cid = chatId || this.chatIdFromSessionKey(sessionKey)
    this.broadcastUiEvent(sessionKey, cid, event)
  }

  disconnect(clientKey: string): void {
    const client = this.clients.get(clientKey)
    if (!client) return
    if (client.role === 'executor') {
      for (const [sk, did] of this.sessionExecutor) {
        if (did === client.deviceId) this.sessionExecutor.delete(sk)
      }
      for (const [code, did] of this.pairingByCode) {
        if (did === client.deviceId) this.pairingByCode.delete(code)
      }
      this.sessionCatalogByDevice.delete(client.deviceId)
    }
    for (const sk of client.sessions) {
      this.sessionViewers.get(sk)?.delete(client.ws)
    }
    this.clients.delete(clientKey)
  }

  countExecutors(): { total: number; online: number } {
    const executors = [...this.clients.values()].filter((c) => c.role === 'executor')
    return {
      total: executors.length,
      online: executors.filter((c) => c.ws.readyState === 1).length,
    }
  }
}
