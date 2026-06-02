import type WebSocket from 'ws'
import { isWebLoginRequired } from './auth/auth-policy.js'
import { gatewayEnv } from './config/env.js'
import { ConnectionRegistry } from './connection-registry.js'
import { SessionCatalog } from './session-catalog.js'
import { RpcBroker } from './rpc-broker.js'
import { ThreadCacheManager } from './thread-cache-manager.js'
import type { SessionStore } from './storage/ports/session-store.port.js'
import type { GatewaySessionRow } from './storage/session-types.js'
import { forbidden } from '../http-errors.js'

export const GATEWAY_OFFLINE_REPLY =
  '桌面端未连接或未开启「远程控制」，无法执行 Agent。请启动 catbuddy 桌面应用，在侧栏打开远程控制开关后重试。'

export type { GatewaySessionRow }

export type GatewayClientRole = 'web' | 'desktop'

export interface GatewayClient {
  ws: WebSocket
  role: GatewayClientRole
  deviceId: string
  sessions: Set<string>
  clientKey: string
  webEmail?: string
  /** Desktop WS: account email (must match Web JWT `sub`). */
  accountEmail?: string
}

export class GatewayStateService {
  private readonly connections: ConnectionRegistry
  private readonly catalog: SessionCatalog
  private readonly rpc: RpcBroker
  private readonly threadCache: ThreadCacheManager

  constructor(private readonly store: SessionStore) {
    this.connections = new ConnectionRegistry()
    this.catalog = new SessionCatalog()
    this.rpc = new RpcBroker()
    this.threadCache = new ThreadCacheManager()
  }

  // ── Token ──

  registerWebToken(token: string, webEmail?: string): void {
    this.connections.registerWebToken(token, webEmail)
  }

  getWebEmailForToken(token: string): string | undefined {
    return this.connections.getWebEmailForToken(token)
  }

  isWebAuthorized(token: string): boolean {
    return this.connections.isWebAuthorized(token)
  }

  // ── Desktop resolution ──

  pickDesktopForWebToken(webToken: string): GatewayClient | null {
    return this.connections.resolveDesktopForWebToken(webToken)
  }

  getDesktopSecret(): string {
    return gatewayEnv.desktopSecret
  }

  getDevWebToken(): string {
    return gatewayEnv.devWebToken
  }

  // ── Session key utilities ──

  channelFromSessionKey(sessionKey: string): string {
    const idx = sessionKey.indexOf(':')
    return idx === -1 ? 'desktop' : sessionKey.slice(0, idx)
  }

  chatIdFromSessionKey(sessionKey: string): string {
    const idx = sessionKey.indexOf(':')
    return idx === -1 ? sessionKey : sessionKey.slice(idx + 1)
  }

  collectSessionKeys(): string[] {
    const keys = this.catalog.collectSessionKeys()
    this.connections.forEachDesktop((c) => {
      for (const sk of c.sessions) keys.push(sk)
    })
    return [...new Set(keys)]
  }

  // ── Web subscribe ──

  ensureWebSubscribedForToken(webToken: string, sessionKey: string): void {
    if (!webToken || !sessionKey) return
    const prefix = `web:${webToken}:`
    this.connections.forEachWebByTokenPrefix(prefix, (client) => {
      client.sessions.add(sessionKey)
      this.catalog.addWebSubscriber(sessionKey, client.ws)
    })
  }

  // ── Broadcast ──

  broadcastUiEvent(sessionKey: string, chatId: string, event: Record<string, unknown>): void {
    void this.broadcastUiEventAsync(sessionKey, chatId, event)
  }

  private async broadcastUiEventAsync(
    sessionKey: string,
    chatId: string,
    event: Record<string, unknown>,
  ): Promise<void> {
    const payload = JSON.stringify({ type: 'ui_event', sessionKey, chatId, event })

    // Send to known subscribers
    const targeted = this.catalog.getWebSubscribers(sessionKey)
    const sent = new Set<WebSocket>()
    if (targeted) {
      for (const ws of targeted) {
        if (ws.readyState !== 1 || sent.has(ws)) continue
        if (!(await this.webWsMayReceiveSession(ws, sessionKey))) continue
        ws.send(payload)
        sent.add(ws)
      }
    }

    // Also send to unsubscribed web clients whose email matches
    const deviceId = this.catalog.getDesktopForSession(sessionKey)
    if (!deviceId) return
    this.connections.forEachWebOnline(async (client) => {
      if (sent.has(client.ws)) return
      if (!(await this.webWsMayReceiveFromDesktop(client.ws, deviceId, sessionKey))) return
      client.ws.send(payload)
      client.sessions.add(sessionKey)
      this.catalog.addWebSubscriber(sessionKey, client.ws)
    })
  }

  private isSessionFocusEvent(event: Record<string, unknown>): boolean {
    return event.event === 'session_updated' && event.scope === 'focus'
  }

  private async broadcastSessionFocus(
    deviceId: string,
    sessionKey: string,
    chatId: string,
    event: Record<string, unknown>,
  ): Promise<void> {
    if (!sessionKey) return
    await this.store.getOrCreate(sessionKey)
    this.catalog.bindSessionToDesktop(sessionKey, deviceId)
    const payload = JSON.stringify({ type: 'ui_event', sessionKey, chatId, event })
    this.connections.forEachWebOnline(async (client) => {
      if (!(await this.webWsMayReceiveFromDesktop(client.ws, deviceId, sessionKey))) return
      client.sessions.add(sessionKey)
      this.catalog.addWebSubscriber(sessionKey, client.ws)
      client.ws.send(payload)
    })
    this.notifyWebClientsSessionListChanged(deviceId)
  }

  // ── Permission helpers ──

  private async webWsMayReceiveFromDesktop(
    ws: WebSocket,
    deviceId: string,
    sessionKey: string,
  ): Promise<boolean> {
    const webClient = this.connections.findWebClientByWs(ws)
    if (!webClient) return false

    const token = this.connections.webTokenFromClientKey(webClient.clientKey)
    const desktop = this.connections.getDesktopClient(deviceId)
    if (!desktop) return false

    if (isWebLoginRequired()) {
      const webEmail = this.connections.normalizeEmail(
        webClient.webEmail || this.connections.getWebEmailForToken(token) || '',
      )
      const deskEmail = desktop.accountEmail
        ? this.connections.normalizeEmail(desktop.accountEmail)
        : ''
      if (!webEmail.includes('@') || !deskEmail.includes('@') || webEmail !== deskEmail) {
        return false
      }
      const owner = await this.store.getSessionOwner(sessionKey)
      if (!owner) {
        const bound = this.catalog.getDesktopForSession(sessionKey)
        return !bound || bound === deviceId
      }
      return await this.store.isSessionOwnedBy(sessionKey, webEmail)
    }

    if (desktop.accountEmail) {
      const webEmail = webClient.webEmail || this.connections.getWebEmailForToken(token) || ''
      if (webEmail.includes('@')) {
        return this.connections.normalizeEmail(webEmail) === this.connections.normalizeEmail(desktop.accountEmail)
      }
    }
    return this.countDesktops().online <= 1
  }

  private async webWsMayReceiveSession(ws: WebSocket, sessionKey: string): Promise<boolean> {
    const deviceId = this.catalog.getDesktopForSession(sessionKey)
    if (!deviceId) {
      if (!isWebLoginRequired()) return true
      return false
    }
    return this.webWsMayReceiveFromDesktop(ws, deviceId, sessionKey)
  }

  private async filterSessionsForDesktopDevice(
    deviceId: string,
    sessions: GatewaySessionRow[],
  ): Promise<GatewaySessionRow[]> {
    const desktop = this.connections.getDesktopClient(deviceId)
    const accountEmail = desktop?.accountEmail
    if (!accountEmail?.includes('@')) {
      if (isWebLoginRequired()) return []
      return sessions.filter((row) => !!row.key)
    }
    const normalized = this.connections.normalizeEmail(accountEmail)
    const allowed: GatewaySessionRow[] = []
    for (const row of sessions) {
      if (!row.key) continue
      if (this.catalog.isTombstoned(row.key)) continue
      const existing = await this.store.getSessionOwner(row.key)
      if (existing && existing !== normalized) continue
      allowed.push(row)
    }
    return allowed
  }

  private async desktopMayPublishSession(
    deviceId: string,
    sessionKey: string,
  ): Promise<boolean> {
    const key = sessionKey.trim()
    if (!key) return true
    const desktop = this.connections.getDesktopClient(deviceId)
    const accountEmail = desktop?.accountEmail
    if (!accountEmail?.includes('@')) {
      return !isWebLoginRequired()
    }
    const normalized = this.connections.normalizeEmail(accountEmail)
    const owner = await this.store.getSessionOwner(key)
    if (!owner) return true
    return owner === normalized
  }

  // ── Sessions sync ──

  async applySessionsSync(
    deviceId: string,
    sessions: GatewaySessionRow[],
    options?: { notifyWebClients?: boolean },
  ): Promise<void> {
    const allowed = await this.filterSessionsForDesktopDevice(deviceId, sessions)
    this.catalog.setCatalog(deviceId, allowed)
    await this.store.mergeSessionRows(allowed)
    const ownerEmail = this.connections.getDesktopClient(deviceId)?.accountEmail
    if (ownerEmail?.includes('@')) {
      const normalized = this.connections.normalizeEmail(ownerEmail)
      for (const row of allowed) {
        if (!row.key) continue
        const existing = await this.store.getSessionOwner(row.key)
        if (existing && existing !== normalized) continue
        if (!existing) await this.store.setSessionOwner(row.key, normalized)
      }
    }
    for (const row of allowed) {
      this.catalog.bindSessionToDesktop(row.key, deviceId)
    }
    if (options?.notifyWebClients) this.notifyWebClientsSessionListChanged(deviceId)
  }

  private notifyWebClientsSessionListChanged(deviceId?: string): void {
    const payload = JSON.stringify({
      type: 'ui_event',
      sessionKey: 'desktop:',
      chatId: 'metadata',
      event: { event: 'session_updated', chat_id: 'metadata', scope: 'metadata' },
    })
    this.connections.forEachWebOnline((client) => {
      if (deviceId) {
        const desktop = this.connections.getDesktopClient(deviceId)
        const want = desktop?.accountEmail
        if (want) {
          const token = this.connections.webTokenFromClientKey(client.clientKey)
          const webEmail = this.connections.normalizeEmail(
            client.webEmail || this.connections.getWebEmailForToken(token) || '',
          )
          if (webEmail !== this.connections.normalizeEmail(want)) return
        }
      }
      client.ws.send(payload)
    })
  }

  // ── RPC ──

  resolveSessionsRpc(requestId: string, sessions: GatewaySessionRow[]): void {
    this.rpc.resolveSessions(requestId, sessions)
  }

  resolveThreadRpc(
    requestId: string,
    payload: Record<string, unknown> | null,
    sessionKey?: string,
  ): void {
    this.rpc.resolveThread(requestId, payload, sessionKey, (sk, p) =>
      this.threadCache.put(sk, p),
    )
  }

  // ── Fetch sessions ──

  async fetchSessionsFromDesktop(): Promise<GatewaySessionRow[]> {
    return this.fetchSessionsForWeb('')
  }

  async fetchSessionsForWeb(
    ownerEmail: string,
    webToken?: string,
  ): Promise<GatewaySessionRow[]> {
    const exec = webToken?.trim()
      ? this.connections.resolveDesktopForWebToken(webToken.trim())
      : this.connections.getFirstOnlineDesktop()

    if (!isWebLoginRequired()) {
      if (exec) {
        const cached = this.catalog.getCatalog(exec.deviceId)
        if (cached?.length) {
          await this.applySessionsSync(exec.deviceId, cached, { notifyWebClients: false })
        } else {
          const rows = await this.rpc.requestSessions(exec.ws)
          if (rows?.length) {
            await this.applySessionsSync(exec.deviceId, rows, { notifyWebClients: false })
          }
        }
      }
      return this.store.listRows()
    }

    const owner = ownerEmail.trim().toLowerCase()
    if (!owner.includes('@')) return []
    if (!exec) return this.store.listRowsForOwner(owner)

    let catalog = this.catalog.getCatalog(exec.deviceId)
    if (catalog?.length) {
      await this.applySessionsSync(exec.deviceId, catalog, { notifyWebClients: false })
      catalog = this.catalog.getCatalog(exec.deviceId)
    } else {
      const rows = await this.rpc.requestSessions(exec.ws)
      if (rows?.length) {
        await this.applySessionsSync(exec.deviceId, rows, { notifyWebClients: false })
        catalog = this.catalog.getCatalog(exec.deviceId)
      }
    }

    const byKey = new Map<string, GatewaySessionRow>()
    for (const row of catalog ?? []) {
      if (!row.key) continue
      const existingOwner = await this.store.getSessionOwner(row.key)
      if (existingOwner && existingOwner !== owner) continue
      if (!existingOwner) await this.store.setSessionOwner(row.key, owner)
      byKey.set(row.key, row)
    }
    for (const row of await this.store.listRowsForOwner(owner)) {
      byKey.set(row.key, row)
    }
    return [...byKey.values()].sort((a, b) =>
      (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
    )
  }

  // ── Ownership ──

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

  // ── Delete ──

  async deleteSessionRecord(sessionKey: string): Promise<void> {
    const key = sessionKey.trim()
    if (!key) return
    this.catalog.markDeleted(key)
    await this.store.deleteSession(key)
    this.catalog.removeSessionFromRuntime(key)
    this.threadCache.delete(key)
    this.connections.forEachDesktop((c) => {
      c.sessions.delete(key)
    })
  }

  private forwardDeleteToDesktop(
    sessionKey: string,
    options?: { webToken?: string; deviceId?: string },
  ): boolean {
    const key = sessionKey.trim()
    if (!key) return false
    const exec = options?.webToken?.trim()
      ? this.connections.resolveDesktopForWebToken(options.webToken.trim())
      : options?.deviceId
        ? this.connections.getDesktopClient(options.deviceId)
        : this.connections.getFirstOnlineDesktop()
    if (!exec || exec.ws.readyState !== 1) return false
    exec.sessions.delete(key)
    exec.ws.send(JSON.stringify({ type: 'delete_session', sessionKey: key }))
    return true
  }

  async deleteSessionForWeb(
    ownerEmail: string,
    sessionKey: string,
    webToken?: string,
  ): Promise<void> {
    const key = sessionKey.trim()
    const email = ownerEmail.trim().toLowerCase()
    if (isWebLoginRequired()) {
      if (!key || !email.includes('@')) forbidden()
      const owner = await this.store.getSessionOwner(key)
      if (owner && owner !== email) forbidden()
    }
    const deviceId = this.catalog.getDesktopForSession(key)
    await this.deleteSessionRecord(key)
    const forwarded = this.forwardDeleteToDesktop(key, { webToken, deviceId })
    if (!forwarded && email.includes('@')) {
      this.threadCache.queueDeleteForDesktop(email, key)
    }
    this.notifyWebClientsSessionListChanged(deviceId)
  }

  async deleteSessionFromDesktop(
    deviceId: string,
    sessionKey: string,
  ): Promise<boolean> {
    const key = sessionKey.trim()
    if (!key) return false
    if (!(await this.desktopMayPublishSession(deviceId, key))) return false
    await this.deleteSessionRecord(key)
    this.notifyWebClientsSessionListChanged(deviceId)
    return true
  }

  // ── Thread cache ──

  putThreadCache(sessionKey: string, payload: Record<string, unknown> | null): void {
    this.threadCache.put(sessionKey, payload)
  }

  getCachedThread(sessionKey: string): Record<string, unknown> | null {
    return this.threadCache.get(sessionKey)
  }

  async fetchThreadForWeb(
    ownerEmail: string,
    sessionKey: string,
    webToken?: string,
  ): Promise<Record<string, unknown> | null> {
    await this.assertWebOwnsSession(ownerEmail, sessionKey)
    return this.fetchThreadFromDesktop(sessionKey, ownerEmail, webToken)
  }

  async fetchThreadFromDesktop(
    sessionKey: string,
    ownerEmail?: string,
    webToken?: string,
  ): Promise<Record<string, unknown> | null> {
    const persisted = await this.store.buildWebuiThread(sessionKey)
    if (persisted && Array.isArray(persisted.messages) && persisted.messages.length > 0) {
      return persisted
    }
    const cached = this.threadCache.get(sessionKey)
    if (cached) return cached

    const exec = this.resolveThreadExecutor(webToken, ownerEmail)
    if (!exec) return persisted

    const fresh = await this.rpc.requestThread(exec.ws, sessionKey)
    if (fresh) {
      this.threadCache.put(sessionKey, fresh)
      await this.store.importWebuiPayload(sessionKey, fresh)
      return fresh
    }
    return cached ?? persisted
  }

  private resolveThreadExecutor(
    webToken?: string,
    ownerEmail?: string,
  ): GatewayClient | null {
    const token = webToken?.trim()
    if (token) return this.connections.resolveDesktopForWebToken(token)

    const email = ownerEmail?.trim().toLowerCase()
    if (email?.includes('@')) {
      const deviceId = this.connections.getDesktopDeviceIdByEmail(email)
      if (deviceId) return this.connections.getDesktopClient(deviceId)
    }

    return this.connections.getFirstOnlineDesktop()
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

  // ── Create session ──

  async forwardCreateSessionToDesktop(
    sessionKey: string,
    chatId: string,
    ownerEmail?: string,
    webToken?: string,
    workspaceFolderId?: string | null,
  ): Promise<{ ok: boolean; error?: string; offline?: boolean }> {
    await this.store.getOrCreate(sessionKey)
    if (workspaceFolderId) {
      await this.store.mergeSessionRow({
        key: sessionKey,
        channel: this.channelFromSessionKey(sessionKey),
        chatId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        title: '',
        preview: '',
        workspaceFolderId,
      })
    }
    if (ownerEmail?.trim()) {
      await this.store.setSessionOwner(sessionKey, ownerEmail)
    }
    const exec = webToken?.trim()
      ? this.connections.resolveDesktopForWebToken(webToken.trim())
      : this.connections.getFirstOnlineDesktop()
    if (!exec) return { ok: true, offline: true }
    exec.sessions.add(sessionKey)
    this.catalog.bindSessionToDesktop(sessionKey, exec.deviceId)
    exec.ws.send(JSON.stringify({
      type: 'create_session',
      sessionKey,
      chatId,
      workspaceFolderId: workspaceFolderId ?? null,
    }))
    return { ok: true }
  }

  // ── Inbound messages ──

  async handleWebInboundForUser(
    ownerEmail: string,
    webToken: string,
    sessionKey: string,
    chatId: string,
    content: string,
    media: unknown[] | undefined,
    source: 'web' | 'gateway',
  ): Promise<{ ok: boolean; queued?: boolean; offline?: boolean; error?: string }> {
    await this.assertWebOwnsSession(ownerEmail, sessionKey)
    return this.handleWebInbound(sessionKey, chatId, content, media, source, webToken)
  }

  async handleWebInbound(
    sessionKey: string,
    chatId: string,
    content: string,
    media: unknown[] | undefined,
    source: 'web' | 'gateway',
    webToken?: string,
  ): Promise<{ ok: boolean; queued?: boolean; offline?: boolean; error?: string }> {
    await this.store.getOrCreate(sessionKey)
    await this.store.addUserMessage(sessionKey, content)

    const exec = webToken?.trim()
      ? this.connections.resolveDesktopForWebToken(webToken.trim())
      : this.connections.getFirstOnlineDesktop()
    if (!exec) {
      await this.emitOfflineAssistantReply(sessionKey, chatId)
      return { ok: true, offline: true, queued: false }
    }

    this.catalog.bindSessionToDesktop(sessionKey, exec.deviceId)
    exec.sessions.add(sessionKey)
    const info = await this.store.get(sessionKey)
    const workspaceFolderId = typeof info?.metadata?.workspaceFolderId === 'string'
      ? info.metadata.workspaceFolderId
      : null
    const workspaceFolderName = typeof info?.metadata?.workspaceFolderName === 'string'
      ? info.metadata.workspaceFolderName
      : null
    exec.ws.send(
      JSON.stringify({
        type: 'inbound_message',
        sessionKey,
        chatId,
        content,
        media: media ?? [],
        workspaceFolderId,
        workspaceFolderName,
        source,
      }),
    )
    return { ok: true, queued: true }
  }

  private async emitOfflineAssistantReply(sessionKey: string, chatId: string): Promise<void> {
    const text = GATEWAY_OFFLINE_REPLY
    await this.store.addAssistantMessage(sessionKey, text)
    this.broadcastUiEvent(sessionKey, chatId, {
      event: 'message', chat_id: chatId, text,
    })
    this.broadcastUiEvent(sessionKey, chatId, {
      event: 'turn_end', chat_id: chatId, latency_ms: 0,
    })
    const deviceId = this.catalog.getDesktopForSession(sessionKey)
    this.notifyWebClientsSessionListChanged(deviceId)
  }

  // ── Sync push ──

  async pushSyncToDesktop(ws: WebSocket, accountEmail?: string): Promise<void> {
    if (ws.readyState !== 1) return
    const email = accountEmail ? this.connections.normalizeEmail(accountEmail) : ''
    let sessions: GatewaySessionRow[]
    let threads: Record<string, Record<string, unknown>>
    if (email.includes('@')) {
      sessions = await this.store.listRowsForOwner(email)
      threads = await this.store.collectSyncThreadsForOwner(email)
    } else if (isWebLoginRequired()) {
      sessions = []
      threads = {}
    } else {
      sessions = await this.store.listRows()
      threads = await this.store.collectSyncThreads()
    }
    ws.send(JSON.stringify({ type: 'sync_push', sessions, threads }))
  }

  async persistThreadSnapshot(
    sessionKey: string,
    payload: Record<string, unknown> | null,
    deviceId?: string,
  ): Promise<void> {
    if (!sessionKey || !payload) return
    if (this.catalog.isTombstoned(sessionKey)) return
    const ownerEmail = deviceId
      ? this.connections.getDesktopClient(deviceId)?.accountEmail
      : undefined
    if (ownerEmail?.includes('@')) {
      const normalized = this.connections.normalizeEmail(ownerEmail)
      const existing = await this.store.getSessionOwner(sessionKey)
      if (existing && existing !== normalized) return
      if (!existing) await this.store.setSessionOwner(sessionKey, normalized)
    }
    this.threadCache.put(sessionKey, payload)
    await this.store.importWebuiPayload(sessionKey, payload)
    const boundDevice = this.catalog.getDesktopForSession(sessionKey) ?? deviceId
    this.notifyWebClientsSessionListChanged(boundDevice)
  }

  // ── Desktop status ──

  sendDesktopStatus(
    online: boolean,
    options?: { ws?: WebSocket; deviceId?: string; accountEmail?: string },
  ): void {
    const payload = JSON.stringify({
      type: 'desktop_status',
      online,
      ...(options?.deviceId ? { deviceId: options.deviceId } : {}),
    })
    if (options?.ws) {
      if (options.ws.readyState === 1) options.ws.send(payload)
      return
    }
    const wantEmail = options?.accountEmail
      ? this.connections.normalizeEmail(options.accountEmail)
      : ''
    this.connections.forEachWebOnline((client) => {
      if (wantEmail) {
        const token = this.connections.webTokenFromClientKey(client.clientKey)
        const webEmail = this.connections.normalizeEmail(
          client.webEmail || this.connections.getWebEmailForToken(token) || '',
        )
        if (webEmail !== wantEmail) return
      }
      client.ws.send(payload)
    })
  }

  // ── Register / Disconnect ──

  registerDesktop(
    ws: WebSocket,
    deviceId: string,
    token: string,
    accountEmail?: string,
  ): { ok: boolean; error?: string } {
    const result = this.connections.registerDesktop(ws, deviceId, token, accountEmail)
    if (!result.ok) return result

    const email = accountEmail
      ? this.connections.normalizeEmail(accountEmail)
      : ''
    void this.pushSyncToDesktop(ws, email || undefined)
    if (email) this.threadCache.flushDeletes(ws, email)
    this.sendDesktopStatus(true, { deviceId, accountEmail: email || undefined })
    return { ok: true }
  }

  registerWeb(ws: WebSocket, deviceId: string, token: string, webEmail?: string): {
    ok: boolean
    error?: string
  } {
    return this.connections.registerWeb(ws, deviceId, token, webEmail)
  }

  async subscribe(ws: WebSocket, sessionKey: string, clientKey: string): Promise<void> {
    const client = this.connections.getClient(clientKey)
    if (!client || !sessionKey) return
    if (client.role === 'web' && isWebLoginRequired()) {
      const token = this.connections.webTokenFromClientKey(clientKey)
      const exec = this.connections.resolveDesktopForWebToken(token)
      if (!exec) {
        ws.send(JSON.stringify({ type: 'error', message: 'desktop_offline' }))
        return
      }
      const sessDevice = this.catalog.getDesktopForSession(sessionKey)
      if (sessDevice && sessDevice !== exec.deviceId) {
        ws.send(JSON.stringify({ type: 'error', message: 'forbidden' }))
        return
      }
      const email =
        client.webEmail || this.connections.getWebEmailForToken(token)
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
      this.catalog.addWebSubscriber(sessionKey, ws)
    }
    if (client.role === 'desktop') {
      if (!(await this.desktopMayPublishSession(client.deviceId, sessionKey))) return
      this.catalog.bindSessionToDesktop(sessionKey, client.deviceId)
    }
  }

  unsubscribe(ws: WebSocket, sessionKey: string, clientKey: string): void {
    const client = this.connections.getClient(clientKey)
    if (!client) return
    client.sessions.delete(sessionKey)
    this.catalog.removeWebSubscriber(sessionKey, ws)
  }

  // ── Publish from desktop ──

  publishUiEventFromDesktop(
    clientKey: string,
    sessionKey: string,
    chatId: string,
    event: Record<string, unknown>,
  ): void {
    const client = this.connections.getClient(clientKey)
    if (!client || client.role !== 'desktop') return
    void this.publishUiEventFromDesktopAsync(client, sessionKey, chatId, event)
  }

  private async publishUiEventFromDesktopAsync(
    client: GatewayClient,
    sessionKey: string,
    chatId: string,
    event: Record<string, unknown>,
  ): Promise<void> {
    const sk = sessionKey.trim()
    if (sk && !(await this.desktopMayPublishSession(client.deviceId, sk))) return
    if (sk) {
      this.catalog.bindSessionToDesktop(sk, client.deviceId)
      client.sessions.add(sk)
    }
    const cid = chatId || this.chatIdFromSessionKey(sessionKey)
    if (this.isSessionFocusEvent(event)) {
      await this.broadcastSessionFocus(client.deviceId, sessionKey, cid, event)
      return
    }
    this.broadcastUiEvent(sessionKey, cid, event)
  }

  disconnect(clientKey: string): void {
    const disconnected = this.connections.disconnect(clientKey)
    if (!disconnected) return

    if (disconnected.role === 'desktop') {
      this.catalog.unbindSessionsForDevice(disconnected.deviceId)
      this.catalog.deleteCatalog(disconnected.deviceId)
      this.sendDesktopStatus(false, {
        deviceId: disconnected.deviceId,
        accountEmail: disconnected.accountEmail,
      })
    }

    const client = this.connections.getClient(clientKey) ?? null
    if (client) {
      for (const sk of client.sessions) {
        this.catalog.removeWebSubscriber(sk, client.ws)
      }
    }
  }

  countDesktops(): { total: number; online: number } {
    return this.connections.countDesktops()
  }
}
