# 副作用解耦：广播方法与订阅逻辑

> **文件**：`gateway/packages/gateway/src/session/gateway-state.ts`
> **问题类型**：耦合 — 隐式副作用 / 逻辑重复
> **优先级**：P1

---

## 问题 1：broadcastUiEventAsync 隐式修改订阅状态

**位置**：`gateway-state.ts:227-241`

```typescript
private async broadcastUiEventAsync(sessionKey, chatId, event): Promise<void> {
  // ... 发送 payload ...
  for (const client of this.clients.values()) {
    if (client.role !== 'web' || client.ws.readyState !== 1) continue
    if (sent.has(client.ws)) continue
    // ...
    client.ws.send(payload)

    // ❌ 隐式副作用：名为 broadcast 的方法却修改了订阅状态
    client.sessions.add(sessionKey)           // 修改 client 内部状态
    let set = this.sessionWebSockets.get(sessionKey)
    if (!set) {
      set = new Set()
      this.sessionWebSockets.set(sessionKey, set)  // 修改全局映射
    }
    set.add(client.ws)
  }
}
```

**问题**：
- `broadcast` 一词暗示只读操作，实际上静默修改了两个数据结构
- 调用方无法预期到 `client.sessions` 和 `sessionWebSockets` 会被修改
- 同样的逻辑在 `subscribe()` (line 966-974) 和 `ensureWebSubscribedForToken` (line 192-205) 中出现了 3 次

**修复**：

```typescript
// 将订阅逻辑从广播中分离

// Step 1: 广播只管发消息
private async broadcastUiEvent(sessionKey, chatId, event): Promise<void> {
  const payload = JSON.stringify({ type: 'ui_event', sessionKey, chatId, event });

  // 向已知订阅者发送
  const subscribers = this.catalog.getWebSubscribers(sessionKey);
  if (subscribers) {
    for (const ws of subscribers) {
      if (ws.readyState !== 1) continue;
      ws.send(payload);
    }
  }
}

// Step 2: 由调用方显式地先订阅再广播
// 在 subscribe() / ensureWebSubscribedForToken 中显式调用 catalog 的 addWebSubscriber
// 然后在 publishUiEventFromDesktopAsync 中只调用 broadcastUiEvent
```

---

## 问题 2：subscribe 和 ensureWebSubscribedForToken 的重复逻辑

**位置**：`gateway-state.ts:192-205` 和 `gateway-state.ts:966-974`

两段代码完全相同：

```typescript
// ensureWebSubscribedForToken (line 192-205)
client.sessions.add(sessionKey)
let set = this.sessionWebSockets.get(sessionKey)
if (!set) { set = new Set(); this.sessionWebSockets.set(sessionKey, set) }
set.add(client.ws)

// subscribe (line 966-974)
client.sessions.add(sessionKey)
let set = this.sessionWebSockets.get(sessionKey)
if (!set) { set = new Set(); this.sessionWebSockets.set(sessionKey, set) }
set.add(ws)
```

**修复**：提取公共方法到 `SessionCatalog` 中：

```typescript
// SessionCatalog 中
addWebSubscriber(sessionKey: string, ws: WebSocket, client: GatewayClient): void {
  client.sessions.add(sessionKey);
  let set = this.sessionWebSockets.get(sessionKey);
  if (!set) {
    set = new Set();
    this.sessionWebSockets.set(sessionKey, set);
  }
  set.add(ws);
}
```

---

## 问题 3：subscribe() 中重复的条件判断

**位置**：`gateway-state.ts:938, 951`

```typescript
if (client.role === 'web' && isWebLoginRequired()) {  // 第一次
  // desktop 路由检查
}
if (client.role === 'web' && isWebLoginRequired()) {  // 第二次 — 完全相同
  // email 所有权检查
}
```

**修复**：合并为一个守卫块，把 desktop 路由检查和 email 所有权检查放在一起：

```typescript
if (client.role === 'web' && isWebLoginRequired()) {
  // 1. 检查 desktop 在线
  const token = this.webTokenFromClientKey(clientKey);
  const exec = this.pickDesktopForWebToken(token);
  if (!exec) {
    ws.send(JSON.stringify({ type: 'error', message: 'desktop_offline' }));
    return;
  }
  // 2. 检查 session 归属
  const sessDevice = this.sessionDesktop.get(sessionKey);
  if (sessDevice && sessDevice !== exec.deviceId) {
    ws.send(JSON.stringify({ type: 'error', message: 'forbidden' }));
    return;
  }
  // 3. 检查 email 所有权
  const email = client.webEmail || this.getWebEmailForToken(token);
  if (!email?.includes('@')) {
    ws.send(JSON.stringify({ type: 'error', message: 'forbidden' }));
    return;
  }
  try {
    await this.assertWebOwnsSession(email, sessionKey);
  } catch {
    ws.send(JSON.stringify({ type: 'error', message: 'forbidden' }));
    return;
  }
}
```

---

## 问题 4：fetchThreadFromDesktop 中 executor 选择逻辑

**位置**：`gateway-state.ts:643-649`

```typescript
const exec = webToken?.trim()
  ? this.pickDesktopForWebToken(webToken.trim())
  : ownerEmail?.includes('@')
    ? this.getDesktopClient(
        this.deviceIdByAccountEmail.get(this.normalizeEmail(ownerEmail)) ?? '',
      )
    : this.pickOnlineDesktop();
```

三层嵌套三元运算符，阅读时需要追踪三个分支的退路。

**修复**：提取为命名方法：

```typescript
private resolveThreadExecutor(
  webToken?: string,
  ownerEmail?: string,
): GatewayClient | null {
  const token = webToken?.trim();
  if (token) return this.pickDesktopForWebToken(token);

  const email = ownerEmail?.trim().toLowerCase();
  if (email?.includes('@')) {
    const deviceId = this.deviceIdByAccountEmail.get(email);
    if (deviceId) return this.getDesktopClient(deviceId);
  }

  return this.pickOnlineDesktop();
}
```

---

## 实施顺序

以上 4 个问题应在 God Class 拆分（god-class-refactor.md）完成后实施，因为它们依赖于 `SessionCatalog` 中已存在的 `addWebSubscriber` / `getWebSubscribers` 方法。
