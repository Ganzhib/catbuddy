import { randomBytes } from 'node:crypto'
import type WebSocket from 'ws'
import { isWebLoginRequired } from './auth/auth-policy.js'
import { gatewayEnv } from './config/env.js'
import type { SessionStore } from './storage/ports/session-store.port.js'
import type { GatewaySessionRow } from './storage/session-types.js'
import { forbidden } from '../http-errors.js'

export const GATEWAY_OFFLINE_REPLY =
  '桌面端未连接或未开启「远程控制」，无法执行 Agent。请启动 learnbuddy 桌面应用，在侧栏打开远程控制开关后重试。'

export type { GatewaySessionRow }

const DESKTOP_RPC_TIMEOUT_MS = 8_000

type PendingRpc<T> = {
  resolve: (value: T) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export type GatewayClientRole = 'web' | 'desktop'

export interface GatewayClient {
  ws: WebSocket
  role: GatewayClientRole
  deviceId: string
  sessions: Set<string>
  clientKey: string
  webEmail?: string
}

export class GatewayStateService {
  private readonly clients = new Map<string, GatewayClient>()
  private readonly pairingByCode = new Map<string, string>()
  private readonly webTokens = new Set<string>()
  private readonly webEmailByToken = new Map<string, string>()
  private readonly sessionDesktop = new Map<string, string>()
  private readonly sessionWebSockets = new Map<string, Set<WebSocket>>()
  /** Latest session list from desktop client (deviceId → rows). */
  private readonly sessionCatalogByDevice = new Map<string, GatewaySessionRow[]>()
  private readonly pendingSessions = new Map<string, PendingRpc<GatewaySessionRow[]>>()
  private readonly pendingThreads = new Map<
    string,
    PendingRpc<Record<string, unknown> | null>
  >()
  /** Web 拉历史时的缓存（由桌面 thread_snapshot / thread_response 写入）。 */
  private readonly threadCache = new Map<string, Record<string, unknown>>()

  constructor(private readonly store: SessionStore) {}

  registerWebToken(token: string, webEmail?: string): void {
    if (!token) return
    this.webTokens.add(token)
    const email = webEmail?.trim().toLowerCase()
    if (email?.includes('@')) this.webEmailByToken.set(token, email)
  }

  getWebEmailForToken(token: string): string | undefined {
    return this.webEmailByToken.get(token)
  }

  private webTokenFromClientKey(clientKey: string): string {
    if (!clientKey.startsWith('web:')) return ''
    const rest = clientKey.slice('web:'.length)
    const lastColon = rest.lastIndexOf(':')
    return lastColon === -1 ? rest : rest.slice(0, lastColon)
  }

  isWebAuthorized(token: string): boolean {
    return !!token && this.webTokens.has(token)
  }

  getDesktopSecret(): string {
    return gatewayEnv.desktopSecret
  }

  getDevWebToken(): string {
    return gatewayEnv.devWebToken
  }

  private getDesktopClient(deviceId: string): GatewayClient | null {
    for (const c of this.clients.values()) {
      if (c.role === 'desktop' && c.deviceId === deviceId) return c
    }
    return null
  }

  private pickOnlineDesktop(): GatewayClient | null {
    const online = [...this.clients.values()].filter(
      (c) => c.role === 'desktop' && c.ws.readyState === 1,
    )
    return online.length === 1 ? online[0] : online[0] ?? null
  }

  private pickDesktopForSession(sessionKey: string): string | null {
    let deviceId = this.sessionDesktop.get(sessionKey)
    if (deviceId) return deviceId
    const online = [...this.clients.values()].filter(
      (c) => c.role === 'desktop' && c.ws.readyState === 1,
    )
    if (online.length === 1) {
      deviceId = online[0].deviceId
      this.sessionDesktop.set(sessionKey, deviceId)
      return deviceId
    }
    return null
  }

  channelFromSessionKey(sessionKey: string): string {
    const idx = sessionKey.indexOf(':')
    return idx === -1 ? 'desktop' : sessionKey.slice(0, idx)
  }

  chatIdFromSessionKey(sessionKey: string): string {
    const idx = sessionKey.indexOf(':')
    return idx === -1 ? sessionKey : sessionKey.slice(idx + 1)
  }

  collectSessionKeys(): string[] {
    const keys = new Set(this.sessionDesktop.keys())
    for (const c of this.clients.values()) {
      if (c.role === 'desktop') {
        for (const sk of c.sessions) keys.add(sk)
      }
    }
    return [...keys]
  }

  /** 将 web WS 记入 session，避免仅 HTTP 发消息时尚未 subscribe 而收不到流式事件。 */
  ensureWebSubscribedForToken(webToken: string, sessionKey: string): void {
    if (!webToken || !sessionKey) return
    const prefix = `web:${webToken}:`
    for (const [clientKey, client] of this.clients.entries()) {
      if (client.role !== 'web' || !clientKey.startsWith(prefix)) continue
      client.sessions.add(sessionKey)
      let set = this.sessionWebSockets.get(sessionKey)
      if (!set) {
        set = new Set()
        this.sessionWebSockets.set(sessionKey, set)
      }
      set.add(client.ws)
    }
  }

  broadcastUiEvent(sessionKey: string, chatId: string, event: Record<string, unknown>): void {
    void this.broadcastUiEventAsync(sessionKey, chatId, event)
  }

  private async broadcastUiEventAsync(
    sessionKey: string,
    chatId: string,
    event: Record<string, unknown>,
  ): Promise<void> {
    const payload = JSON.stringify({ type: 'ui_event', sessionKey, chatId, event })
    const targeted = this.sessionWebSockets.get(sessionKey)
    const sent = new Set<WebSocket>()
    if (targeted) {
      for (const ws of targeted) {
        if (ws.readyState !== 1 || sent.has(ws)) continue
        if (!(await this.webWsMayReceiveSession(ws, sessionKey))) continue
        ws.send(payload)
        sent.add(ws)
      }
    }
    if (isWebLoginRequired()) return
    for (const client of this.clients.values()) {
      if (client.role !== 'web' || client.ws.readyState !== 1) continue
      if (sent.has(client.ws)) continue
      client.ws.send(payload)
      client.sessions.add(sessionKey)
      let set = this.sessionWebSockets.get(sessionKey)
      if (!set) {
        set = new Set()
        this.sessionWebSockets.set(sessionKey, set)
      }
      set.add(client.ws)
    }
  }

  private async webWsMayReceiveSession(ws: WebSocket, sessionKey: string): Promise<boolean> {
    if (!isWebLoginRequired()) return true
    const owner = await this.store.getSessionOwner(sessionKey)
    if (!owner) return false
    for (const client of this.clients.values()) {
      if (client.role !== 'web' || client.ws !== ws) continue
      const email =
        client.webEmail
        || this.getWebEmailForToken(this.webTokenFromClientKey(client.clientKey))
      return !!email && (await this.store.isSessionOwnedBy(sessionKey, email))
    }
    return false
  }

  async applySessionsSync(
    deviceId: string,
    sessions: GatewaySessionRow[],
    options?: { notifyWebClients?: boolean },
  ): Promise<void> {
    this.sessionCatalogByDevice.set(deviceId, sessions)
    await this.store.mergeSessionRows(sessions)
    for (const row of sessions) {
      this.sessionDesktop.set(row.key, deviceId)
    }
    if (options?.notifyWebClients) this.notifyWebClientsSessionListChanged()
  }

  private notifyWebClientsSessionListChanged(): void {
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
      if (client.role === 'web' && client.ws.readyState === 1) {
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
      }, DESKTOP_RPC_TIMEOUT_MS)
      this.pendingSessions.set(requestId, { resolve, reject, timer })
      exec.ws.send(JSON.stringify({ type: 'request_sessions', requestId }))
    }).catch(() => null)
  }

  async fetchSessionsFromDesktop(): Promise<GatewaySessionRow[]> {
    return this.fetchSessionsForWeb('')
  }

  /** List sessions visible to a logged-in user (owner-tagged only when email auth is on). */
  async fetchSessionsForWeb(ownerEmail: string): Promise<GatewaySessionRow[]> {
    if (!isWebLoginRequired()) {
      const exec = this.pickOnlineDesktop()
      if (exec) {
        const cached = this.sessionCatalogByDevice.get(exec.deviceId)
        if (cached?.length) await this.store.mergeSessionRows(cached)
        else {
          const rows = await this.requestSessionsRpc(exec)
          if (rows?.length) {
            await this.applySessionsSync(exec.deviceId, rows, { notifyWebClients: false })
          }
        }
      }
      return this.store.listRows()
    }

    const owner = ownerEmail.trim().toLowerCase()
    if (!owner.includes('@')) return []

    const owned = await this.store.listRowsForOwner(owner)
    const exec = this.pickOnlineDesktop()
    if (!exec) return owned

    const cached = this.sessionCatalogByDevice.get(exec.deviceId)
    if (cached?.length) {
      await this.store.mergeSessionRows(cached)
    } else {
      const rows = await this.requestSessionsRpc(exec)
      if (rows?.length) {
        await this.applySessionsSync(exec.deviceId, rows, { notifyWebClients: false })
      }
    }
    return this.store.listRowsForOwner(owner)
  }

  /**
   * Email-auth: allow web client to use a session if unowned (e.g. created on desktop first),
   * otherwise require matching owner in MySQL.
   */
  async assertWebOwnsSession(ownerEmail: string, sessionKey: string): Promise<void> {
    if (!isWebLoginRequired()) return
    const key = sessionKey.trim()
    const email = ownerEmail.trim().toLowerCase()
    if (!key || !email.includes('@')) forbidden()
    const owner = await this.store.getSessionOwner(key)
    if (!owner) {
      await this.store.getOrCreate(key)
      await this.store.setSessionOwner(key, email)
      return
    }
    if (!(await this.store.isSessionOwnedBy(key, email))) forbidden()
  }

  async tagSessionForWeb(ownerEmail: string, sessionKey: string): Promise<void> {
    if (!sessionKey.trim() || !ownerEmail.trim()) return
    await this.store.getOrCreate(sessionKey)
    await this.store.setSessionOwner(sessionKey, ownerEmail)
  }

  /** 仅写入 Gateway 缓存，不通知 Web（避免 webui-thread ↔ session_updated 死循环）。 */
  putThreadCache(sessionKey: string, payload: Record<string, unknown> | null): void {
    if (!sessionKey || !payload) return
    this.threadCache.set(sessionKey, payload)
  }

  getCachedThread(sessionKey: string): Record<string, unknown> | null {
    return this.threadCache.get(sessionKey) ?? null
  }

  async fetchThreadForWeb(
    ownerEmail: string,
    sessionKey: string,
  ): Promise<Record<string, unknown> | null> {
    await this.assertWebOwnsSession(ownerEmail, sessionKey)
    return this.fetchThreadFromDesktop(sessionKey)
  }

  async fetchThreadFromDesktop(
    sessionKey: string,
  ): Promise<Record<string, unknown> | null> {
    const persisted = await this.store.buildWebuiThread(sessionKey)
    if (
      persisted
      && Array.isArray(persisted.messages)
      && persisted.messages.length > 0
    ) {
      return persisted
    }
    const cached = this.getCachedThread(sessionKey)
    if (cached) return cached
    const exec = this.pickOnlineDesktop()
    if (!exec) return persisted
    const requestId = randomBytes(8).toString('hex')
    const fresh = await new Promise<Record<string, unknown> | null>(
      (resolve, reject) => {
        const timer = setTimeout(() => {
          this.pendingThreads.delete(requestId)
          reject(new Error('thread_rpc_timeout'))
        }, DESKTOP_RPC_TIMEOUT_MS)
        this.pendingThreads.set(requestId, { resolve, reject, timer })
        exec.ws.send(
          JSON.stringify({ type: 'request_thread', requestId, sessionKey }),
        )
      },
    ).catch(() => null)
    if (fresh) {
      this.putThreadCache(sessionKey, fresh)
      await this.store.importWebuiPayload(sessionKey, fresh)
      return fresh
    }
    return cached ?? persisted
  }

  private async fallbackSessionRows(): Promise<GatewaySessionRow[]> {
    const fromStore = await this.store.listRows()
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

  async forwardCreateSessionToDesktop(
    sessionKey: string,
    chatId: string,
    ownerEmail?: string,
  ): Promise<{ ok: boolean; error?: string; offline?: boolean }> {
    await this.store.getOrCreate(sessionKey)
    if (ownerEmail?.trim()) {
      await this.store.setSessionOwner(sessionKey, ownerEmail)
    }
    const exec = this.pickOnlineDesktop()
    if (!exec) return { ok: true, offline: true }
    exec.sessions.add(sessionKey)
    this.sessionDesktop.set(sessionKey, exec.deviceId)
    exec.ws.send(JSON.stringify({ type: 'create_session', sessionKey, chatId }))
    return { ok: true }
  }

  async handleWebInboundForUser(
    ownerEmail: string,
    sessionKey: string,
    chatId: string,
    content: string,
    media: unknown[] | undefined,
    source: 'web' | 'gateway',
  ): Promise<{ ok: boolean; queued?: boolean; offline?: boolean; error?: string }> {
    await this.assertWebOwnsSession(ownerEmail, sessionKey)
    return this.handleWebInbound(sessionKey, chatId, content, media, source)
  }

  /** Web 发消息：先写 Gateway 存储，再转发桌面；无 desktop 在线时返回离线系统提示。 */
  async handleWebInbound(
    sessionKey: string,
    chatId: string,
    content: string,
    media: unknown[] | undefined,
    source: 'web' | 'gateway',
  ): Promise<{ ok: boolean; queued?: boolean; offline?: boolean; error?: string }> {
    await this.store.getOrCreate(sessionKey)
    await this.store.addUserMessage(sessionKey, content)

    const exec = this.pickOnlineDesktop()
    if (!exec) {
      await this.emitOfflineAssistantReply(sessionKey, chatId)
      return { ok: true, offline: true, queued: false }
    }

    this.sessionDesktop.set(sessionKey, exec.deviceId)
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

  private async emitOfflineAssistantReply(sessionKey: string, chatId: string): Promise<void> {
    const text = GATEWAY_OFFLINE_REPLY
    await this.store.addAssistantMessage(sessionKey, text)
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
    this.notifyWebClientsSessionListChanged()
  }

  async forwardInboundToDesktop(
    sessionKey: string,
    chatId: string,
    content: string,
    media: unknown[] | undefined,
    source: 'web' | 'gateway',
  ): Promise<{ ok: boolean; queued?: boolean; error?: string }> {
    return this.handleWebInbound(sessionKey, chatId, content, media, source)
  }

  /** 桌面连接后：把 Gateway 会话推送给 desktop 合并。 */
  async pushSyncToDesktop(ws: WebSocket): Promise<void> {
    if (ws.readyState !== 1) return
    const sessions = await this.store.listRows()
    const threads = await this.store.collectSyncThreads()
    ws.send(JSON.stringify({ type: 'sync_push', sessions, threads }))
  }

  async persistThreadSnapshot(
    sessionKey: string,
    payload: Record<string, unknown> | null,
  ): Promise<void> {
    if (!sessionKey || !payload) return
    this.putThreadCache(sessionKey, payload)
    await this.store.importWebuiPayload(sessionKey, payload)
  }

  pairWeb(pairingCode: string, token: string): { ok: boolean; deviceId?: string; error?: string } {
    const code = pairingCode.trim().toUpperCase()
    const deviceId = this.pairingByCode.get(code)
    if (!deviceId) return { ok: false, error: 'invalid_pairing_code' }
    this.registerWebToken(token)
    return { ok: true, deviceId }
  }

  registerDesktop(ws: WebSocket, deviceId: string, token: string): {
    ok: boolean
    pairingCode?: string
    error?: string
  } {
    if (token !== gatewayEnv.desktopSecret) {
      return { ok: false, error: 'unauthorized' }
    }
    const pairingCode = randomBytes(3).toString('hex').toUpperCase()
    this.pairingByCode.set(pairingCode, deviceId)
    const clientKey = `desktop:${deviceId}`
    this.clients.set(clientKey, {
      ws,
      role: 'desktop',
      deviceId,
      sessions: new Set(),
      clientKey,
    })
    void this.pushSyncToDesktop(ws)
    return { ok: true, pairingCode }
  }

  registerWeb(ws: WebSocket, deviceId: string, token: string, webEmail?: string): {
    ok: boolean
    error?: string
  } {
    if (!this.isWebAuthorized(token)) {
      return { ok: false, error: 'unauthorized' }
    }
    const clientKey = `web:${token}:${deviceId}`
    const email = webEmail || this.getWebEmailForToken(token)
    this.clients.set(clientKey, {
      ws,
      role: 'web',
      deviceId,
      sessions: new Set(),
      clientKey,
      webEmail: email,
    })
    return { ok: true }
  }

  async subscribe(ws: WebSocket, sessionKey: string, clientKey: string): Promise<void> {
    const client = this.clients.get(clientKey)
    if (!client || !sessionKey) return
    if (client.role === 'web' && isWebLoginRequired()) {
      const email =
        client.webEmail
        || this.getWebEmailForToken(this.webTokenFromClientKey(clientKey))
      if (!email?.includes('@')) {
        ws.send(JSON.stringify({ type: 'error', message: 'forbidden' }))
        return
      }
      try {
        await this.assertWebOwnsSession(email, sessionKey)
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'forbidden' }))
        return
      }
    }
    client.sessions.add(sessionKey)
    if (client.role === 'web') {
      let set = this.sessionWebSockets.get(sessionKey)
      if (!set) {
        set = new Set()
        this.sessionWebSockets.set(sessionKey, set)
      }
      set.add(ws)
    }
    if (client.role === 'desktop') {
      this.sessionDesktop.set(sessionKey, client.deviceId)
    }
  }

  unsubscribe(ws: WebSocket, sessionKey: string, clientKey: string): void {
    const client = this.clients.get(clientKey)
    if (!client) return
    client.sessions.delete(sessionKey)
    this.sessionWebSockets.get(sessionKey)?.delete(ws)
  }

  publishUiEventFromDesktop(
    clientKey: string,
    sessionKey: string,
    chatId: string,
    event: Record<string, unknown>,
  ): void {
    const client = this.clients.get(clientKey)
    if (!client || client.role !== 'desktop') return
    const cid = chatId || this.chatIdFromSessionKey(sessionKey)
    this.broadcastUiEvent(sessionKey, cid, event)
  }

  disconnect(clientKey: string): void {
    const client = this.clients.get(clientKey)
    if (!client) return
    if (client.role === 'desktop') {
      for (const [sk, did] of this.sessionDesktop) {
        if (did === client.deviceId) this.sessionDesktop.delete(sk)
      }
      for (const [code, did] of this.pairingByCode) {
        if (did === client.deviceId) this.pairingByCode.delete(code)
      }
      this.sessionCatalogByDevice.delete(client.deviceId)
    }
    for (const sk of client.sessions) {
      this.sessionWebSockets.get(sk)?.delete(client.ws)
    }
    this.clients.delete(clientKey)
  }

  countDesktops(): { total: number; online: number } {
    const desktops = [...this.clients.values()].filter((c) => c.role === 'desktop')
    return {
      total: desktops.length,
      online: desktops.filter((c) => c.ws.readyState === 1).length,
    }
  }
}
