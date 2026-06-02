# Command 模式重构：ws-session.ts

> **文件**：`gateway/packages/gateway/src/ws-session.ts` (160 行)
> **问题类型**：设计模式 / 可读性 — 无结构的 if-else 分支
> **优先级**：P0

---

## 现状分析

`ws.on('message')` 回调中有 10 个 `if` 分支处理不同消息类型：

```typescript
// ws-session.ts:27-148 — 当前实现
ws.on('message', (raw) => {
  let msg: Record<string, unknown>;
  try { msg = JSON.parse(String(raw)); } catch { ... return }

  if (msg.type === 'ping') { ... return }
  if (msg.type === 'register') { ... return }
  if (!clientKey) { ... return }
  if (msg.type === 'subscribe') { ... return }
  if (msg.type === 'unsubscribe') { ... return }
  if (msg.type === 'ui_event') { ... return }
  if (msg.type === 'sessions_sync' && clientKey.startsWith('desktop:')) { ... }
  if (msg.type === 'thread_response' && clientKey.startsWith('desktop:')) { ... }
  if (msg.type === 'thread_snapshot' && clientKey.startsWith('desktop:')) { ... }
  if (msg.type === 'session_delete' && clientKey.startsWith('desktop:')) { ... }
})
```

**问题**：
- 新增消息类型时需要修改这个函数，违反开闭原则
- 注册逻辑（第 2 个 if）和后续消息处理逻辑混在一起
- `clientKey.startsWith('desktop:')` 的权限检查在每个分支中重复
- 无法对单个消息类型做单元测试

---

## 目标设计：Command 模式

将消息类型映射到独立的 handler 函数/对象：

```typescript
// gateway/packages/gateway/src/ws-session/handlers/ 
//   register-handler.ts
//   subscribe-handler.ts
//   ui-event-handler.ts
//   sessions-sync-handler.ts
//   thread-handler.ts
//   session-delete-handler.ts
```

### 核心结构

```typescript
// gateway/packages/gateway/src/ws-session/ws-session.ts

interface WsSessionContext {
  state: GatewayStateService;
  auth: AuthService;
  log: (msg: string) => void;
}

interface WsMessage {
  type: string;
  [key: string]: unknown;
}

interface SessionClient {
  clientKey: string;
  ws: WebSocket;
}

type MessageHandler = (
  msg: WsMessage,
  client: SessionClient,
  ctx: WsSessionContext,
) => void;

function createHandlerRegistry(): Map<string, MessageHandler> {
  const handlers = new Map<string, MessageHandler>();

  handlers.set('ping', (msg, client) => {
    client.ws.send(JSON.stringify({ type: 'pong' }));
  });

  handlers.set('subscribe', (msg, client, ctx) => {
    void ctx.state.subscribe(
      client.ws,
      String(msg.sessionKey || ''),
      client.clientKey,
    );
  });

  handlers.set('unsubscribe', (msg, client, ctx) => {
    ctx.state.unsubscribe(
      client.ws,
      String(msg.sessionKey || ''),
      client.clientKey,
    );
  });

  handlers.set('ui_event', (msg, client, ctx) => {
    ctx.state.publishUiEventFromDesktop(
      client.clientKey,
      String(msg.sessionKey || ''),
      String(msg.chatId || ''),
      (msg.event as Record<string, unknown>) ?? {},
    );
  });

  // desktop-only handlers
  handlers.set('sessions_sync', handleSessionsSync);
  handlers.set('thread_response', handleThreadResponse);
  handlers.set('thread_snapshot', handleThreadSnapshot);
  handlers.set('session_delete', handleSessionDelete);

  return handlers;
}
```

### 注册逻辑独立处理

注册是一个特殊流程（未认证 → 已认证的状态转换），独立处理：

```typescript
// gateway/packages/gateway/src/ws-session/register-handler.ts

export async function handleRegister(
  msg: WsMessage,
  ws: WebSocket,
  ctx: WsSessionContext,
): Promise<SessionClient | null> {
  const token = String(msg.token || '');
  const role: GatewaySessionRole = msg.role === 'desktop' ? 'desktop' : 'web';
  const deviceId = String(msg.deviceId || randomBytes(8).toString('hex'));

  if (role === 'desktop') {
    return handleDesktopRegister(ws, deviceId, token, msg.accountEmail, ctx);
  }
  return handleWebRegister(ws, deviceId, token, ctx);
}
```

### 主流程简化

```typescript
// gateway/packages/gateway/src/ws-session/ws-session.ts

export function attachGatewaySessionWebSocket(
  server: WebSocketServer,
  state: GatewayStateService,
  auth: AuthService,
  log: (msg: string) => void,
): void {
  const ctx: WsSessionContext = { state, auth, log };
  const handlerRegistry = createHandlerRegistry();

  server.on('connection', (ws) => {
    let client: SessionClient | null = null;

    ws.on('message', (raw) => {
      let msg: WsMessage;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'invalid_json' }));
        return;
      }

      // 注册流程
      if (msg.type === 'register') {
        handleRegister(msg, ws, ctx).then((c) => {
          if (c) client = c;
        }).catch((err) => {
          log(`register error: ${err.message}`);
          ws.close();
        });
        return;
      }

      // 未注册
      if (!client) {
        ws.send(JSON.stringify({ type: 'error', message: 'not_registered' }));
        return;
      }

      // 已注册 — 命令分发
      const handler = handlerRegistry.get(msg.type);
      if (handler) {
        try {
          handler(msg, client, ctx);
        } catch (err) {
          log(`handler error [${msg.type}]: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    });

    ws.on('close', () => {
      if (!client) return;
      state.disconnect(client.clientKey);
      log(`disconnect ${client.clientKey}`);
    });
  });
}
```

---

## Desktop-Only Handler 示例

```typescript
// gateway/packages/gateway/src/ws-session/handlers/sessions-sync-handler.ts

export function handleSessionsSync(
  msg: WsMessage,
  client: SessionClient,
  ctx: WsSessionContext,
): void {
  if (!client.clientKey.startsWith('desktop:')) return;
  
  const deviceId = client.clientKey.slice('desktop:'.length);
  const sessions = (msg.sessions as Array<Record<string, unknown>>) ?? [];
  const rows = sessions.map(normalizeSessionRow);
  const requestId = msg.requestId ? String(msg.requestId) : '';

  void ctx.state.applySessionsSync(deviceId, rows, { notifyWebClients: !requestId });
  if (requestId) ctx.state.resolveSessionsRpc(requestId, rows);
}

function normalizeSessionRow(s: Record<string, unknown>): GatewaySessionRow {
  return {
    key: String(s.key || ''),
    channel: String(s.channel || 'desktop'),
    chatId: String(s.chatId || ''),
    createdAt: String(s.createdAt || new Date().toISOString()),
    updatedAt: String(s.updatedAt || new Date().toISOString()),
    title: s.title != null ? String(s.title) : '',
    preview: String(s.preview || ''),
    workspaceFolderId: typeof s.workspaceFolderId === 'string' && s.workspaceFolderId.trim()
      ? s.workspaceFolderId.trim() : null,
    workspaceFolderName: typeof s.workspaceFolderName === 'string' && s.workspaceFolderName.trim()
      ? s.workspaceFolderName.trim() : null,
  };
}
```

---

## 收益

| 维度 | 重构前 | 重构后 |
|------|--------|--------|
| 文件行数 | 160 行单文件 | ~60 行主文件 + 每个 handler ~20-40 行 |
| 可测试性 | 无法单独测试一个消息类型 | 每个 handler 可独立单元测试 |
| 扩展性 | 需修改主文件 | 新增 handler 文件 + 注册一行 |
| 开闭原则 | 违反 | 遵守 |
| 错误隔离 | 一个 handler 抛错影响整条连接 | try/catch 隔离 |
