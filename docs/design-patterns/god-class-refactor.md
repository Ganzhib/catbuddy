# God Class 拆分：GatewayStateService

> **文件**：`gateway/packages/gateway/src/session/gateway-state.ts` (1056 行)
> **问题类型**：设计模式 — 单一职责原则违反
> **优先级**：P0

---

## 现状分析

`GatewayStateService` 当前管理 **13 个内部 Map/Set**，提供 **40+ 个公开/私有方法**，覆盖以下职责：

```
GatewayStateService
├── 连接管理 (registerDesktop, registerWeb, disconnect)
├── Token/Email 映射 (registerWebToken, getWebEmailForToken)
├── Session 生命周期 (applySessionsSync, deleteSessionRecord)
├── 权限校验 (assertWebOwnsSession, desktopMayPublishSession)
├── 消息路由 (pickDesktopForWebToken, webWsMayReceiveFromDesktop)
├── 订阅管理 (subscribe, unsubscribe, ensureWebSubscribedForToken)
├── UI 事件广播 (broadcastUiEvent, broadcastSessionFocus)
├── RPC 超时管理 (requestSessionsRpc, resolveSessionsRpc)
├── 线程缓存 (putThreadCache, fetchThreadFromDesktop)
└── 删除队列 (queueDesktopDelete, flushPendingDesktopDeletes)
```

**问题**：理解任何单个方法都需要先理解所有 13 个 Map 之间的关系，心智负担极大。

---

## 目标设计

按职责拆分为 4 个独立类 + 1 个 Facade：

```
GatewayStateService (Facade，~150 行)
│
├── ConnectionRegistry          ← 连接生命周期
│   ├── clients: Map<key, GatewayClient>
│   ├── webTokens: Set<string>
│   ├── webEmailByToken: Map<token, email>
│   └── deviceIdByAccountEmail: Map<email, deviceId>
│
├── SessionCatalog              ← Session 到设备映射
│   ├── sessionDesktop: Map<sessionKey, deviceId>
│   ├── sessionWebSockets: Map<sessionKey, Set<WebSocket>>
│   ├── sessionCatalogByDevice: Map<deviceId, rows[]>
│   └── deletedSessions: Map<sessionKey, timestamp>
│
├── RpcBroker                   ← Desktop RPC 请求/响应
│   ├── pendingSessions: Map<requestId, PendingRpc>
│   └── pendingThreads: Map<requestId, PendingRpc>
│
└── ThreadCacheManager          ← 线程数据缓存
    ├── threadCache: Map<sessionKey, payload>
    └── pendingDesktopDeletesByEmail: Map<email, Set<sessionKey>>
```

---

## 详细设计

### 1. ConnectionRegistry

```typescript
// gateway/packages/gateway/src/session/connection-registry.ts

export class ConnectionRegistry {
  private readonly clients = new Map<string, GatewayClient>();
  private readonly webTokens = new Set<string>();
  private readonly webEmailByToken = new Map<string, string>();
  private readonly deviceIdByAccountEmail = new Map<string, string>();

  constructor(private readonly gatewayEnv: GatewayEnv) {}

  // --- Desktop 连接 ---
  registerDesktop(ws: WebSocket, deviceId: string, token: string, accountEmail?: string): RegisterResult;
  disconnect(clientKey: string): DisconnectedClient | null;

  // --- Web 连接 ---
  registerWeb(ws: WebSocket, deviceId: string, token: string, webEmail?: string): RegisterResult;
  registerWebToken(token: string, webEmail?: string): void;
  isWebAuthorized(token: string): boolean;

  // --- 查询 ---
  getDesktopClient(deviceId: string): GatewayClient | null;
  getClient(clientKey: string): GatewayClient | undefined;
  findWebClientByWs(ws: WebSocket): GatewayClient | null;
  getWebEmailForToken(token: string): string | undefined;
  resolveDesktopForEmail(email: string): GatewayClient | null;

  // --- 遍历 ---
  forEachDesktop(fn: (client: GatewayClient) => void): void;
  forEachWeb(fn: (client: GatewayClient) => void): void;
  countDesktops(): { total: number; online: number };

  // --- 工具 ---
  webTokenFromClientKey(clientKey: string): string;
  normalizeEmail(email: string): string;
}
```

**设计要点**：
- 只暴露必要的查询/遍历方法，隐藏内部 Map 结构
- `forEachWeb`/`forEachDesktop` 避免外部直接遍历 `clients` Map
- 工具函数（`webTokenFromClientKey`、`normalizeEmail`）内聚到连接注册表中

### 2. SessionCatalog

```typescript
// gateway/packages/gateway/src/session/session-catalog.ts

export class SessionCatalog {
  private readonly sessionDesktop = new Map<string, string>();
  private readonly sessionWebSockets = new Map<string, Set<WebSocket>>();
  private readonly sessionCatalogByDevice = new Map<string, GatewaySessionRow[]>();
  private readonly deletedSessions = new Map<string, number>();

  // --- Session-Desktop 映射 ---
  bindSessionToDesktop(sessionKey: string, deviceId: string): void;
  getDesktopForSession(sessionKey: string): string | undefined;
  unbindSessionsForDevice(deviceId: string): void;

  // --- Web 订阅 ---
  addWebSubscriber(sessionKey: string, ws: WebSocket): void;
  removeWebSubscriber(sessionKey: string, ws: WebSocket): void;
  getWebSubscribers(sessionKey: string): Set<WebSocket> | undefined;

  // --- Catalog 缓存 ---
  setCatalogForDevice(deviceId: string, rows: GatewaySessionRow[]): void;
  getCatalogForDevice(deviceId: string): GatewaySessionRow[] | undefined;
  removeCatalogForDevice(deviceId: string): void;
  updateCatalogEntry(deviceId: string, sessionKey: string, updater: (row: GatewaySessionRow) => GatewaySessionRow): void;

  // --- 删除墓碑 ---
  markDeleted(sessionKey: string): void;
  isTombstoned(sessionKey: string): boolean;

  // --- 收集/清理 ---
  collectSessionKeys(): string[];
  removeSessionFromAllCatalogs(sessionKey: string): void;
}
```

**设计要点**：
- 将 `broadcastUiEvent` 中的隐式订阅操作替换为显式 `addWebSubscriber` 调用
- `updateCatalogEntry` 提供原子化的 catalog 行更新
- 墓碑检查自动清理过期条目

### 3. RpcBroker

```typescript
// gateway/packages/gateway/src/session/rpc-broker.ts

type PendingRpc<T> = {
  resolve: (value: T) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class RpcBroker {
  private readonly pendingSessions = new Map<string, PendingRpc<GatewaySessionRow[]>>();
  private readonly pendingThreads = new Map<string, PendingRpc<Record<string, unknown> | null>>();

  constructor(private readonly timeoutMs: number = 8_000) {}

  // --- Session RPC ---
  requestSessions(execWs: WebSocket): Promise<GatewaySessionRow[] | null>;
  resolveSessions(requestId: string, sessions: GatewaySessionRow[]): void;

  // --- Thread RPC ---
  requestThread(execWs: WebSocket, sessionKey: string): Promise<Record<string, unknown> | null>;
  resolveThread(requestId: string, payload: Record<string, unknown> | null, sessionKey?: string): void;
}
```

### 4. ThreadCacheManager

```typescript
// gateway/packages/gateway/src/session/thread-cache-manager.ts

export class ThreadCacheManager {
  private readonly threadCache = new Map<string, Record<string, unknown>>();
  private readonly pendingDesktopDeletesByEmail = new Map<string, Set<string>>();

  put(sessionKey: string, payload: Record<string, unknown> | null): void;
  get(sessionKey: string): Record<string, unknown> | null;

  queueDeleteForDesktop(email: string, sessionKey: string): void;
  flushDeletes(ws: WebSocket, email: string): void;
}
```

### 5. GatewayStateService（Facade）

Facade 只负责**编排**，不再直接操作任何 Map：

```typescript
export class GatewayStateService {
  constructor(
    private readonly connections: ConnectionRegistry,
    private readonly catalog: SessionCatalog,
    private readonly rpc: RpcBroker,
    private readonly threadCache: ThreadCacheManager,
    private readonly store: SessionStore,
  ) {}

  // 对外方法列表 (~15 个)
  registerDesktop(ws, deviceId, token, accountEmail) { /* 委托 connections + push sync */ }
  registerWeb(ws, deviceId, token, email) { /* 委托 connections */ }
  disconnect(clientKey) { /* 委托 connections + catalog */ }
  subscribe(ws, sessionKey, clientKey) { /* 组合 connections + catalog */ }
  // ... 其余编排方法
}
```

---

## 迁移策略

采用**渐进式拆分**，每步可独立验证：

```
Step 1: 提取 ThreadCacheManager（独立，无循环依赖）
  → 将 threadCache + pendingDesktopDeletesByEmail 剥离
  → 验证：Gateway 启动正常，Web UI 历史消息加载正常

Step 2: 提取 RpcBroker（独立，无循环依赖）
  → 将 pendingSessions + pendingThreads + requestXxx/resolveXxx 剥离
  → 验证：Web 端拉取 session 列表超时/正常返回

Step 3: 提取 SessionCatalog
  → 将 sessionDesktop + sessionWebSockets + catalog + 墓碑 剥离
  → 验证：session 同步、删除、UI 事件广播

Step 4: 提取 ConnectionRegistry
  → 将 clients + token 相关 + email 映射剥离
  → 验证：注册/断连/多租户路由

Step 5: GatewayStateService 瘦身为 Facade
  → 移除所有内部 Map，改为组合调用
  → 验证：全链路 E2E 测试
```

每步完成后运行 Gateway 确认功能正常再进入下一步。
