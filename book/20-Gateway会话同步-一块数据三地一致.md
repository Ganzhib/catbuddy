# 19｜Gateway 会话同步：一块数据，三地一致

> 这是 CatBuddy 技术专栏的第 19 篇。上篇讲了传输层抽象——怎么用一套接口同时支持 Electron IPC 和浏览器 WebSocket。这篇看 Gateway 层——你在手机上问 Agent "帮我重构这个函数"，打开电脑后对话已经同步好了，连正在进行的流式输出都能无缝续上。本文拆解 Gateway 会话同步机制的全貌：协议设计、路由策略、多租户隔离、冲突解决。

> **核心问题**：Desktop 的 JSONL 文件 ↔ Gateway 的 MySQL 缓存 ↔ Web 浏览器的内存状态，这三者怎么保持一致？当 Desktop 离线时 Web 端发生了什么？

---

前一篇我们讲了传输层的二层抽象——`AgentTransport` 和 `BaseChannel` 通过 `MessageBus` 解耦。但传输层只解决了"消息怎么发"，没解决"数据怎么同步"。

想象这个场景：你在手机上通过浏览器打开 CatBuddy，看到一个昨天的对话。点进去——消息都还在，甚至能看到当时 Agent 思考的推理过程。这背后是一套完整的 **Desktop ⇄ Gateway ⇄ Web** 三端同步机制。本文逐层拆解。

---

## 18.1 问题域：三角形里的数据一致性

CatBuddy 的"真相源"有三个存储位置：

```text
Desktop JSONL           Gateway MySQL          Web 浏览器内存
    │                        │                      │
    ├── write_file 直接写入   ├── HTTP write 间接写入  ├── 只读展示
    ├── 全量消息历史          ├── 缓存最近消息          ├── 当前会话
    ├── LLM 推理唯一入口      ├── 多设备路由            ├── 订阅接收流式事件
    └── 本地文件系统           └── 云端数据库            └── 会话结束即释放
```

三角同步的核心挑战不是"数据怎么拷贝"——那是 `fetch` + `JSON.parse` 就能做的事。真正的挑战是：

1. **时效性**：Agent 正在流式输出，Web 端要实时看到每个 token
2. **路由正确性**：你的 Web 消息必须送到你的 Desktop，不能送到别人的 Desktop
3. **冲突处理**：Web 端新会话还没同步到 Desktop 就关闭了，重开时怎么办？
4. **离线降级**：Desktop 关机了，Web 端应该优雅提示，而不是白屏报错

下面从最基础的"会话怎么命名"开始，逐步展开这套机制的每一层。

---

## 18.2 Session Key：一套跨三端的命名规范

如果三端各用各的 ID 格式，同步的第一步就卡住了。CatBuddy 定义了统一的 Session Key 格式：`channel:chatId`。

```ts
// packages/shared/src/session-key.ts

// 规范化为 channel:chatId
export function toSessionKey(chatIdOrKey: string, channel = 'desktop'): string {
  const trimmed = chatIdOrKey.trim()
  if (!trimmed) return `${channel}:`
  if (trimmed.includes(':')) return trimmed  // 已经是完整 key
  return `${channel}:${trimmed}`
}

// 去掉 channel 前缀，拿到纯 chatId
export function bareChatId(chatIdOrKey: string): string {
  const trimmed = chatIdOrKey.trim()
  const colon = trimmed.indexOf(':')
  return colon === -1 ? trimmed : trimmed.slice(colon + 1)
}

// 提取 channel 部分
export function channelFromSessionKey(sessionKey: string): string {
  const colon = sessionKey.indexOf(':')
  return colon === -1 ? 'desktop' : sessionKey.slice(0, colon)
}
```

这里有一个容易被忽视的设计决策：**`channel` 不是用来区分 Desktop 和 Web 的，而是为未来的多渠道扩展预留的**。目前所有会话的 channel 都是 `desktop`——因为只有 Desktop 能运行 LLM。但将来如果支持 WhatsApp、Telegram 等渠道，`whatsapp:1730_abc` 这样的 key 就能直接接入现有同步体系。

Gateway 侧用同一个格式，但多了 MySQL 持久化。`GatewaySessionRow` 是协议层的统一会话摘要格式：

```ts
interface GatewaySessionRow {
  key: string              // "desktop:1730_abc"
  channel: string          // "desktop"
  chatId: string           // "1730_abc"
  createdAt: string        // ISO 8601
  updatedAt: string        // ISO 8601 — 用于冲突比较
  title?: string
  preview: string
  workspaceFolderId?: string | null
  workspaceFolderName?: string | null
}
```

注意 `updatedAt` 字段——它是后续冲突解决的关键。三端比较时，谁的时间戳更新，谁就是权威。

---

## 18.3 协议设计：20 种消息类型的角色对话

Gateway 的 WebSocket 不是单一的"推拉"模式，而是一场**角色对话**。协议定义了四种角色和 20 种消息类型：

```ts
// packages/shared/src/gateway-protocol.ts

// ── Desktop → Gateway ──
type GatewayDesktopClientMessage =
  | { type: 'register', role: 'desktop', deviceId, token, accountEmail? }
  | { type: 'subscribe', sessionKey }
  | { type: 'sessions_sync', sessions: GatewaySessionRow[] }   // 全量会话列表
  | { type: 'thread_snapshot', sessionKey, payload }           // 单个会话的完整消息
  | { type: 'ui_event', sessionKey, chatId, event }            // 流式 token / 工具进度
  | { type: 'session_delete', sessionKey }
  | { type: 'thread_response', requestId, sessionKey, payload } // 响应 RPC 请求

// ── Gateway → Desktop ──
type GatewayServerToDesktopMessage =
  | { type: 'registered', deviceId }                           // 注册成功
  | { type: 'sync_push', sessions, threads? }                  // 云端有更新的数据，推送过来
  | { type: 'inbound_message', sessionKey, chatId, content }   // Web 用户发来的消息
  | { type: 'create_session', sessionKey, chatId }             // Web 端创建了新会话
  | { type: 'delete_session', sessionKey }
  | { type: 'request_sessions', requestId }                    // 请求 Desktop 的会话列表
  | { type: 'request_thread', requestId, sessionKey }          // 请求 Desktop 的会话详情
  | { type: 'error', message }
```

但这不是全部。Gateway 还要跟 Web 端说话：

```ts
// ── Gateway → Web ──
type GatewayServerToWebMessage =
  | GatewayServerCommonMessage  // registered / error / pong
  | { type: 'ui_event', sessionKey, chatId, event }  // 转发 Desktop 的流式事件
  | { type: 'desktop_status', online, deviceId? }    // Desktop 上下线通知
```

以及 Web 端可以通过 **HTTP API** 发消息（不经过 WebSocket），避免每次发消息都要维护 WS 连接：

```ts
POST /api/sessions/:sessionKey/messages
Body: { content: "帮我重构这个函数", media: [] }
Header: Authorization: Bearer <webToken>
```

这种 **WS + HTTP 双通道**设计的原因很实用：WS 用来接收流式事件（需要长连接），HTTP 用来发送用户消息（单次请求即可）。Web 端发完消息后可以不保持 WS 连接，但收到回复时必须保持——所以 GatewayTransport 在发消息前总是先 `ensureGatewaySessionOnHttp`，确保会话存在。

---

## 18.4 三条同步链路，逐帧拆解

有了协议，来看看实际的数据怎么流动。

### 18.4.1 链路 A：Desktop → Gateway（主动推送）

这是最频繁的链路。每次 Agent Loop 产生一个事件（delta、tool_progress、file_edit、turn_end），`ChannelDispatcher` 调用 `GatewayChannel` 的对应 `send*()` 方法，最终走到 `emitSession()`：

```ts
// apps/desktop/src/main/channels/gateway.ts
private emitSession(chatId: string, event: Record<string, unknown>): void {
  this.gateway?.publishUiEvent(this.sessionKey(chatId), chatId, event)
}
```

`GatewayDesktopClient.publishUiEvent` 把事件包装成 `ui_event` 消息：

```ts
publishUiEvent(sessionKey, chatId, event): void {
  this.send({
    type: 'ui_event',
    sessionKey,
    chatId,
    event,  // { event: "delta", chat_id: "...", text: "好" }
  })
}
```

Gateway 服务器收到 `ui_event` 后，调用 `broadcastUiEvent`→`broadcastAndEnsureSubscribed`：

```ts
private async broadcastAndEnsureSubscribed(
  sessionKey, chatId, event
): Promise<void> {
  const payload = JSON.stringify({ type: 'ui_event', sessionKey, chatId, event })

  // 1. 发给已订阅此 session 的 Web 客户端
  const targeted = this.catalog.getWebSubscribers(sessionKey)
  for (const ws of targeted) {
    ws.send(payload)
  }

  // 2. 自动订阅未订阅但同邮箱的 Web 客户端，然后也发给它们
  this.connections.forEachWebOnline(async (client) => {
    if (!(await this.webWsMayReceiveFromDesktop(client.ws, deviceId, sessionKey))) return
    client.ws.send(payload)
    this.autoSubscribeWebClient(client, sessionKey)  // 懒订阅
  })
}
```

这里有一个精妙的设计——**懒订阅（lazy subscription）**。Web 客户端首次连接时可能没有显式调用 `subscribe`，但它/用户的邮箱与 Desktop 的 `accountEmail` 匹配，Gateway 就自动把它加入订阅列表。这样用户刚打开网页就能看到正在进行的对话，不需要任何手动操作。

除了流式事件，Desktop 还会定期推送 **全量会话列表**（`sessions_sync`）和 **单个会话的完整快照**（`thread_snapshot`）：

```ts
// 每轮对话结束后触发
async sendTurnComplete(chatId, data): Promise<void> {
  this.emitSession(chatId, { event: "turn_end", ... })
  this.gateway?.publishSessionsSync()                          // 全量列表
  this.gateway?.publishThreadSnapshot(this.sessionKey(chatId)) // 完整消息快照
}
```

`publishThreadSnapshot` 不是推送流式 token，而是把整个 JSONL 文件转成 `WebuiThreadPersistedPayload` 格式，一次性发给 Gateway。Gateway 把它**写入 MySQL 缓存**——这样即使 Desktop 离线，Web 端也能通过 HTTP API 拉取历史消息。

### 18.4.2 链路 B：Gateway → Desktop（反向同步）

这个方向发生在两种场景：
- **Desktop 刚连接**时，Gateway 把云端存储的会话数据推给它
- **Web 端在 Desktop 离线期间创建了新会话**，Gateway 需要把它同步过来

核心入口是 `pushSyncToDesktop`：

```ts
async pushSyncToDesktop(ws: WebSocket, accountEmail?: string): Promise<void> {
  let sessions, threads
  if (email.includes('@')) {
    sessions = await this.store.listRowsForOwner(email)      // 只拿该用户的会话
    threads = await this.store.collectSyncThreadsForOwner(email) // 只拿该用户的线程快照
  } else {
    sessions = await this.store.listRows()   // 无邮箱隔离时拿全部
    threads = await this.store.collectSyncThreads()
  }
  ws.send(JSON.stringify({ type: 'sync_push', sessions, threads }))
}
```

Desktop 端收到 `sync_push` 后，`GatewayDesktopClient.applySyncPush` 处理：

```ts
private applySyncPush(msg): void {
  // 1. 确保每个 session 在本地存在（getOrCreate，不会覆盖已有数据）
  for (const row of msg.sessions) {
    this.sessionProvider.getOrCreate(row.key)
  }
  // 2. 对于每个线程快照，调用 importWebuiThread 导入消息
  for (const [sessionKey, payload] of Object.entries(msg.threads)) {
    this.sessionProvider.importWebuiThread(sessionKey, payload)
    this.subscribeSession(sessionKey)
  }
  // 3. 推送本地会话列表回去，形成双向同步
  this.publishSessionsSync()
}
```

关键在于 `importWebuiThread` 的实现——它**不是无条件覆盖**，而是比较时间戳：

```ts
// apps/desktop/src/main/session/session-manager.ts
importWebuiThread(sessionKey, payload): void {
  const local = this.getDetail(sessionKey)
  const localUpdated = local?.updatedAt ?? ''
  const incomingAt = typeof payload.savedAt === 'string' ? payload.savedAt : ''

  // 如果本地数据比远端新，不做任何导入
  if (local && localUpdated && incomingAt && incomingAt <= localUpdated) {
    return  // ← 冲突解决：本地优先
  }

  // 本地没有或远端更新 → 用远端数据覆盖
  const { info, messages } = this._initSession(sessionKey)
  messages.push(...sessionRecordsFromWebuiMessages(sessionKey, raw))
  info.updatedAt = incomingAt || messages[messages.length - 1].timestamp
  this._save(info, messages)
}
```

这个"最后写入胜出"（Last-Write-Wins）策略虽然简单，但在 CatBuddy 的场景下足够有效——因为**Desktop 是唯一的写入源**。Web 端只能读取，不能直接修改消息历史（只能追加用户消息和助理回复）。真正的冲突只发生在：Web 端创建了一个新会话但还没同步到 Desktop，同时 Desktop 上也创建了同名会话——概率极低。

### 18.4.3 链路 C：Web → Gateway → Desktop（用户消息路由）

用户在浏览器里输入 "帮我重构这个函数" 后，发生了什么？完整链路：

```
1. 浏览器: postGatewayUserMessage(httpBase, webToken, sessionKey, content)
      ↓ HTTP POST /api/sessions/desktop:1730_abc/messages
      ↓ Body: { content: "帮我重构这个函数" }
      ↓ Header: Authorization: Bearer <jwt_token>

2. Gateway: handleWebInbound(ownerEmail, webToken, sessionKey, chatId, content)
      ├─ assertWebOwnsSession(ownerEmail, sessionKey)  // 权限检查
      │   └─ 不是你的会话 → 403 Forbidden
      ├─ store.getOrCreate(sessionKey)                  // 确保 MySQL 中有这条记录
      ├─ store.addUserMessage(sessionKey, content)      // 写入用户消息到 MySQL
      └─ resolveDesktopForWebToken(webToken)            // 找到用户的 Desktop
           └─ 找到了 → exec.ws.send({ type: 'inbound_message', ... })
           └─ 没找到 → 返回 GATEWAY_OFFLINE_REPLY ("桌面端未连接...")

3. Desktop: GatewayDesktopClient._handleServerMessageImpl
      └─ msg.type === 'inbound_message'
           ├─ subscribeSession(msg.sessionKey)
           └─ publishInbound({ channel, chatId, content, ... })
                └─ MessageBus.publishInbound(msg)
                     └─ AgentLoop 消费，启动 LLM 推理
```

**权限检查**是这条链路的精髓。`assertWebOwnsSession` 确保：
- 只有会话的创建者（`ownerEmail`）能往里面发消息
- 如果会话还没有 owner，第一个访问者自动成为 owner

```ts
async assertWebOwnsSession(ownerEmail: string, sessionKey: string): Promise<void> {
  const owner = await this.store.getSessionOwner(key)
  if (!owner) {
    // 首次访问，自动认领
    await this.store.setSessionOwner(key, email)
    return
  }
  if (!(await this.store.isSessionOwnedBy(key, email))) {
    throw forbidden()  // 403 — 不是你的会话
  }
}
```

---

## 18.5 多租户隔离：accountEmail 如何成为"身份证"

Gateway 服务同时连接着多个用户的 Desktop 和 Web 客户端。怎么保证 luli@email.com 的消息不会误发给 zhangsan@email.com？

核心机制是 **accountEmail 路由**。分两层：

**第一层：连接注册阶段**。Desktop 连接 Gateway 时发送 `register` 消息：

```ts
ws.send({
  type: 'register',
  role: 'desktop',
  deviceId: 'desktop-a1b2c3d4',
  token: '<shared_secret>',
  accountEmail: 'luli@email.com',  // ← 身份标识
})
```

Web 端通过 JWT 登录，Gateway 从 JWT 中解析出 `sub`（邮箱地址）。两个邮箱字符串归一化后做精确匹配。

**第二层：事件路由阶段**。每次 `broadcastUiEvent` 都要经过 `webWsMayReceiveFromDesktop` 检查：

```ts
private async webWsMayReceiveFromDesktop(ws, deviceId, sessionKey): Promise<boolean> {
  const webEmail = this.connections.normalizeEmail(getWebEmail(ws))
  const deskEmail = this.connections.normalizeEmail(getDesktopEmail(deviceId))

  // 两边都有邮箱 → 必须完全一致
  if (webEmail.includes('@') && deskEmail.includes('@')) {
    return webEmail === deskEmail
  }

  // 没有邮箱（开发模式）→ 只有一个 Desktop 在线时可以
  return this.countDesktops().online <= 1
}
```

这里有一个贴心的降级设计：**开发模式下如果只有一个 Desktop 在线，不做邮箱校验**。这让本地开发不需要配置 JWT 和邮箱——连上就能用。

更进一层，Gateway 的 MySQL 中还有 `session_ownership` 表。当 `isWebLoginRequired()` 为 `true`（生产环境），只有会话的 owner 能看到和操作这个会话。`applySessionsSync` 中处理 Desktop 推送的会话列表时，Gateway 会过滤掉不属于该 accountEmail 的会话：

```ts
async filterSessionsForDesktopDevice(deviceId, sessions): Promise<GatewaySessionRow[]> {
  for (const row of sessions) {
    const existing = await this.store.getSessionOwner(row.key)
    if (existing && existing !== normalized) continue  // 不属于这个用户，跳过
    allowed.push(row)
  }
  return allowed
}
```

这套隔离机制保证了：即使你知道了别人的 session key，你也没办法在 Gateway 上读取或操作那个会话。

---

## 18.6 离线处理与重连恢复

当 Desktop 离线时，Web 端的体验不能崩。Gateway 有一整套离线降级策略：

**1. 用户发消息时 Desktop 离线 → 返回友好提示**

```ts
async routeInboundToDesktop(...): Promise<...> {
  if (!exec) {
    await this.emitOfflineAssistantReply(sessionKey, chatId)
    return { ok: true, offline: true }
  }
}

private async emitOfflineAssistantReply(sessionKey, chatId): Promise<void> {
  // 写入一条 assistant 消息："桌面端未连接或未开启远程控制..."
  await this.store.addAssistantMessage(sessionKey, GATEWAY_OFFLINE_REPLY)
  // 广播给所有 Web 客户端
  this.broadcastUiEvent(sessionKey, chatId, {
    event: 'message', chat_id: chatId, text: GATEWAY_OFFLINE_REPLY,
  })
  this.broadcastUiEvent(sessionKey, chatId, {
    event: 'turn_end', chat_id: chatId, latency_ms: 0,
  })
}
```

Web 端看到的不再是白屏或网络错误，而是一条清晰的提示信息。

**2. Desktop 断线重连 → 指数退避 + 会话恢复**

```ts
// 3s * 2^attempt，上限 60s
const delay = Math.min(3000 * 2 ** this.reconnectAttempt, 60000)

// 重连成功后
ws.on('open', () => {
  this.send({ type: 'register', role: 'desktop', deviceId, token, accountEmail })
  // Gateway 回复 'registered' 后 → 重新订阅所有 session，重新推送 sessions_sync
})
```

Gateway 在 `registerDesktop` 成功后立即调用 `pushSyncToDesktop`，把 Desktop 离线期间 Web 端创建的新会话和消息推送过来。

**3. Web 端重连 → 重新订阅，拉取最新会话列表**

`GatewayTransport.openSocket` 中重连后：
```ts
onOpen: () => {
  const activeKey = activeSessionKeyFromChatId(callbacks.getActiveChatId())
  if (activeKey) this.trackSubscription(activeKey)  // 重新 subscribe
  for (const sk of this.subscribed) {
    if (sk !== activeKey) this.trackSubscription(sk)
  }
}
```

**4. Desktop 离线期间的删除操作 → 队列暂存**

```ts
// GatewayDesktopClient
private readonly pendingDeletes = new Set<string>()

publishSessionDelete(sessionKey): void {
  if (!this._connected) {
    this.pendingDeletes.add(key)  // 暂存，等重连后批量发送
    return
  }
  this.send({ type: 'session_delete', sessionKey: key })
}

// 重连后
ws.on('registered', () => {
  for (const key of this.pendingDeletes) {
    this.send({ type: 'session_delete', sessionKey: key })
  }
  this.pendingDeletes.clear()
})
```

---

## 18.7 全景时序：从手机发消息到 Desktop 执行

把这些拼起来，一个完整的跨设备消息流是这样的：

```text
时间轴：Web 浏览器                    Gateway 服务器                  Desktop 应用
─────────────────────────────────────────────────────────────────────────────
T+0    │ 用户在输入框打字                  │                              │
       │                                  │                              │
T+1    │ POST /api/sessions/.../messages  │                              │
       │  ──────────────────────────────→ │                              │
       │                                  │ handleWebInbound()           │
       │                                  │ ├─ assertWebOwnsSession()    │
       │                                  │ ├─ addUserMessage()→MySQL    │
       │                                  │ └─ resolveDesktop()          │
       │                                  │                              │
T+2    │                                  │ inbound_message ───────────→ │
       │                                  │   WS: { type:'inbound_      │
       │                                  │     message', content, ... } │
       │                                  │                           ┌──┤
       │                                  │                           │  │ MessageBus
       │                                  │                           │  │ .publishInbound()
       │                              ←── 200 OK ──                  │  │
       │                                  │                           └──┤ AgentLoop.process()
       │                                  │                              │ └─ LLM 推理开始
T+3    │                                  │                              │
       │                                  │    ← ui_event (delta: "好")  │
T+4    │          ← ui_event ──────────── │ ←────────────────────────── │
       │   WS: { event:"delta",          │                              │
       │         text:"好" }              │  broadcastUiEvent()          │
       │                                  │  → 发给所有匹配 email 的     │
       │                                  │    Web 客户端                │
       │                                  │                              │
T+5    │  StreamBuffer 合并 → setState   │                              │
       │  页面显示 "好"                   │                              │
       │                                  │                              │
...    │  (更多 delta 事件逐帧推送...)     │                              │
       │                                  │                              │
T+N    │          ← ui_event ──────────── │ ←────────────────────────── │
       │   WS: { event:"turn_end",       │   "turn_end"                 │
       │         latency_ms, usage }      │   + publishSessionsSync()    │
       │                                  │   + publishThreadSnapshot()  │
       │                                  │                              │
T+N+1  │          ← ui_event ──────────── │ ←────────────────────────── │
       │   WS: { event:"session_updated",│   threads 写入 MySQL 缓存     │
       │         scope:"metadata" }       │                              │
       │                                  │                              │
T+N+2  │  侧栏刷新会话列表               │                              │
       │  对话完成                        │                              │
```

注意几个关键时机：
- T+2 时刻，Gateway **在把消息发给 Desktop 之前就已经返回了 200 OK 给 Web 端**——因为消息已经存入 MySQL，即使 Desktop 处理失败也不会丢失
- T+N 时刻的 `publishThreadSnapshot` 不是每个 delta 都触发，而是**每轮对话结束后触发一次**——这避免了频繁的全量序列化
- `session_updated` 事件（scope: `metadata`）在会话列表变化时广播，Web 端收到后自动刷新侧栏

---

## 18.8 总结

> **这篇讲了什么？**
>
> 1. Gateway 会话同步的协议层定义了 **4 种角色**（Desktop/Web/Gateway→Desktop/Gateway→Web）、**20 种消息类型**、**WS + HTTP 双通道**。Session Key 统一格式 `channel:chatId` 是三端识别的基石。
> 2. 三条同步链路协作运转：Desktop 主动推送流式事件 + 全量快照（`publishSessionsSync`/`publishThreadSnapshot`），Gateway 反向推送云端缓存（`sync_push`），Web 用户消息通过 HTTP 经 Gateway 路由到 Desktop（`inbound_message`）。`importWebuiThread` 通过时间戳比较实现 Last-Write-Wins 冲突解决。
> 3. 多租户隔离的核心是 **accountEmail 归一化精确匹配** + **session_ownership 表**。离线降级涵盖友好提示文案、指数退避重连（3s→60s）、删除操作暂存队列。懒订阅（lazy subscription）让用户首次打开网页就能看到正在进行的对话。

> 下一篇聊 CatBuddy 的架构图生成功能——你描述系统，它自动生成 Draw.io 架构图。这个功能背后的 Prompt 是怎么设计的？"反向剔除"哲学是什么？从 40% 到 90% 可用率的四轮迭代经历了什么？
