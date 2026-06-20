---
name: architecture-guard
description: 架构守护 — 设计原则、拆分模式、解耦策略、命名规范、数据流分层
---

# 架构守护

本项目在 [docs/design-patterns/](docs/design-patterns/) 沉淀了基于实际代码审查的架构优化方案。这个技能汇总核心原则和模式，帮助开发者在写新代码和重构时保持架构健康。

## 四大核心原则

开发 catbuddy 任何模块时，请遵循以下原则：

| 原则 | 含义 | 反面案例 |
|------|------|----------|
| **单一职责（SRP）** | 一个类/文件只做一件事 | `GatewayStateService` 管理 13 个 Map + 40+ 方法 |
| **开闭原则（OCP）** | 新增功能无需修改已有代码 | 新消息类型需要改 `ws.on('message')` 的 if-else 链 |
| **最少知识** | 方法只依赖直接相关的数据结构 | 方法签名要求传入整个全局 state 对象 |
| **命名即文档** | 变量/函数名自解释，减少注释依赖 | `pickOnlineDesktop` vs `getFirstOnlineDesktop` |

## 模式一：God Class → Facade + 子类

> 案例：[gateway-state.ts](gateway/packages/gateway/src/session/gateway-state.ts) (1056行 → 目标 ~150行)

**判断标准**：一个类同时满足以下 3 条，就应该拆分：
- 管理 **≥ 5 个内部 Map/Set**
- 提供 **≥ 20 个公开方法**
- 方法覆盖 **≥ 3 个不同职责域**

**拆分模板**：

```
原始 God Class (1000+ 行)
        │
        ▼  按数据所有权拆分
┌───────┼───────┬───────────┬──────────┐
│       │       │           │          │
ConnRegistry  Catalog  RpcBroker  CacheMgr
  (连接)     (会话)    (RPC)     (缓存)
        │       │           │          │
        └───────┴───────────┴──────────┘
                    │
                    ▼
              Facade (~150行)
         只做编排，不直接操作任何 Map
```

**实施步骤**：

```
Step 1: 提取最独立的模块（无循环依赖）→ 验证
Step 2: 提取下一个独立模块 → 验证
Step 3-N: 逐步提取剩余模块 → 验证
Step N+1: 原始类瘦身为 Facade → 全链路 E2E 验证
```

每个 Step 独立可验证，出问题立即回滚，不阻塞开发。

**关键约束**：
- 子类**只暴露必要的查询/遍历方法**，隐藏内部 Map 结构
- 避免外部代码直接 `for (const [k,v] of conn.clients)`，应提供 `forEachDesktop(fn)` 等遍历方法
- 工具函数内聚到数据所在的类中（如 `webTokenFromClientKey` 放到 `ConnectionRegistry`）

## 模式二：if-else 链 → Command/Handler 注册表

> 案例：[ws-session.ts](gateway/packages/gateway/src/ws-session.ts) (160行，10个 if 分支)

**判断标准**：同一个函数中出现 **≥ 5 个 `if (type === 'xxx')`** 分支。

**重构前**：
```typescript
ws.on('message', (raw) => {
  if (msg.type === 'ping') { ... }
  if (msg.type === 'register') { ... }
  if (msg.type === 'subscribe') { ... }
  if (msg.type === 'unsubscribe') { ... }
  // ... 6 more ifs
})
```

**重构后**：
```typescript
const handlers = new Map<string, MessageHandler>([
  ['ping', handlePing],
  ['subscribe', handleSubscribe],
  ['unsubscribe', handleUnsubscribe],
  // ...
])

ws.on('message', (raw) => {
  const handler = handlers.get(msg.type)
  if (handler) {
    try { handler(msg, client, ctx) }
    catch (err) { log(`handler error [${msg.type}]: ${err.message}`) }
  }
})
```

**收益**：

| 维度 | 重构前 | 重构后 |
|------|--------|--------|
| 新增消息类型 | 修改主文件 + 加 if | 新建 handler 文件 + 注册一行 |
| 单元测试 | 无法单独测试一个类型 | 每个 handler 独立测试 |
| 错误隔离 | 一个抛错影响整条连接 | try/catch 隔离 |
| 开闭原则 | 违反 | 遵守 |

## 模式三：隐式副作用 → 显式调用

> 案例：[gateway-state.ts](gateway/packages/gateway/src/session/gateway-state.ts) `broadcastUiEvent` 方法

**判断标准**：方法名暗示只读操作，但实际修改了内部状态。

**坏味道**：
```typescript
// 方法名叫 broadcast，却悄悄修改了 client.sessions 和 sessionWebSockets
private async broadcastUiEvent(sessionKey, chatId, event) {
  // ... 发送消息 ...
  client.sessions.add(sessionKey)           // ❌ 隐式副作用
  this.sessionWebSockets.set(sessionKey, set) // ❌ 隐式副作用
}
```

**修复**：将副作用从方法中抽离，由调用方显式执行：
```typescript
// 广播只管发消息 — 纯函数
private broadcastUiEvent(sessionKey, chatId, event) {
  for (const ws of this.catalog.getWebSubscribers(sessionKey)) {
    ws.send(payload)
  }
}

// 调用方显式先订阅再广播
this.catalog.addWebSubscriber(sessionKey, ws, client)  // 显式副作用
this.broadcastUiEvent(sessionKey, chatId, event)       // 纯广播
```

## 模式四：重复代码 → 工厂函数 / 公共方法

> 案例：[ipc-transport.ts](packages/client/src/transport/ipc-transport.ts) 10个重复的事件处理器

**重构前**：10 个处理器，每个 4-6 行几乎相同的模板代码。

**重构后**：工厂函数消除重复
```typescript
function sub<T>(
  subscribe: (cb: (data: T) => void) => (() => void) | undefined,
  mapper: (data: T) => InboundEvent,
): (() => void) | undefined {
  const unsub = subscribe(mapper)
  return unsub ?? undefined
}

// 使用：1 行声明
sub(api.onStreamDelta, tagChatId((data, cid) => ({
  event: "delta", chat_id: cid, text: data.content, stream_id: data.streamId,
})))
```

## 模式五：嵌套三元 → 命名方法

**坏味道**：
```typescript
const exec = webToken?.trim()
  ? this.pickDesktopForWebToken(webToken.trim())
  : ownerEmail?.includes('@')
    ? this.getDesktopClient(this.deviceIdByAccountEmail.get(email) ?? '')
    : this.pickOnlineDesktop()
```

**修复**：提取为命名方法 `resolveThreadExecutor(webToken, ownerEmail)`，用 early return 替代嵌套。

## 命名规范

### 动词选择

| 场景 | 推荐 | 避免 |
|------|------|------|
| 获取单个对象 | `get` / `find` / `fetch` | `pick` — 不明确 |
| 获取列表 | `list` / `collect` | `getAll` — 啰嗦 |
| 同步推送 | `push` / `sync` | `notify` — 太泛化 |
| 解析/推算 | `resolve` | `decide` — 不精确 |
| 设置值 | `set` | `put` — 与 HTTP PUT 混淆 |

### 命名风格

```
类型/接口：  PascalCase      — GatewayClient, InboundEvent
变量/函数：  camelCase       — chatIdFromSessionKey, findWebClientByWs
常量：       UPPER_SNAKE     — DESKTOP_RPC_TIMEOUT_MS
文件：       kebab-case      — gateway-state.ts, ipc-transport.ts
布尔值前缀： is/has/can/may  — isWebAuthorized, hasActiveTasks
```

### 否定语义避免

| 避免 | 建议 | 理由 |
|------|------|------|
| `suppressStreamUntilTurnEnd` | `deferStreamDisplay` | `defer` 直接表达"推迟" |
| `disabled` (boolean) | `enabled` (正向) | 避免 `if (!disabled)` 双重否定 |
| `notRegistered` | `unauthenticated` | 语义更精确 |

## 消息数据流三层模型

理解消息在各层之间的转换，是避免数据丢失的关键：

```
持久层 (MessageRecord)      传输层 (ThreadPayload)      渲染层 (UIMessage)
packages/shared/             packages/shared/            packages/shared/
agent-types.ts               ui-types.ts                 ui-types.ts
      │                            │                          │
      │  SessionManager             │  buildWebuiThread        │  useCatbuddyStream
      │  .addMessage()              │  .buildPayload()         │  transformMessage()
      │                            │                          │
      ▼                            ▼                          ▼
  JSONL / MySQL               IPC / WebSocket             React 组件树
```

**关键约束**：新增任何需要在历史回放中恢复的字段，必须同时更新：
1. `MessageRecord` 类型定义（`agent-types.ts`）
2. `SessionManager.addMessage()` 的写入字段
3. Gateway MySQL 的 `gateway_session_messages` 表结构
4. `buildWebuiThreadPayload` 的转换逻辑
5. `useCatbuddyStream` 的渲染转换

## Stream Hook 分层模式

> 案例：[useCatbuddyStream.ts](packages/ui/src/hooks/useCatbuddyStream.ts) (1082行 → 目标 ~200行 + 两个纯模块)

```
重构前（1082行单文件混合三层）:
├── 纯函数区 — 消息树操作 (~470行)
├── Buffer 批处理 — rAF 调度 (~200行)
└── Hook body — 事件分发 (~400行)

重构后（按层分离）:
hooks/
├── useCatbuddyStream.ts      ← 薄编排层 (~200行)
└── stream/
    ├── message-tree.ts        ← 纯函数，可独立单测 (~470行)
    └── stream-buffer.ts       ← 流缓冲管理，可独立单测 (~200行)
```

**收益**：纯函数层脱离 React 环境独立测试；修改 buffer 逻辑不影响消息树操作。

## 代码审查检查清单

写作或审查代码时，逐项检查：

- [ ] 类/文件是否只负责一个职责域？（≥ 3 个职责域 → 拆分）
- [ ] 是否有 ≥ 5 个 if-else 分支可用 Map/Handler 替代？
- [ ] 方法名是否准确描述其行为？（`broadcast` 不能悄悄改状态）
- [ ] 是否有 ≥ 3 次重复的代码块可提取为工厂函数？
- [ ] 是否有嵌套三元运算符可用命名方法替代？
- [ ] 命名是否符合动词规范？（`pick` → `get`/`find`）
- [ ] 布尔值是否正向命名？（`isEnabled` 而非 `isDisabled`）
- [ ] 新增字段是否更新了全部三层类型？
- [ ] 纯函数是否与 React/框架逻辑分离？

## 关键参考文件

| 文件 | 内容 |
|------|------|
| [docs/design-patterns/README.md](docs/design-patterns/README.md) | 总览 + 实施顺序 |
| [docs/design-patterns/god-class-refactor.md](docs/design-patterns/god-class-refactor.md) | God Class → Facade 拆分（P0） |
| [docs/design-patterns/command-pattern.md](docs/design-patterns/command-pattern.md) | Command 模式重构（P0） |
| [docs/design-patterns/stream-hook-refactor.md](docs/design-patterns/stream-hook-refactor.md) | Stream Hook 分层（P0） |
| [docs/design-patterns/side-effect-decoupling.md](docs/design-patterns/side-effect-decoupling.md) | 副作用解耦（P1） |
| [docs/design-patterns/naming-convention.md](docs/design-patterns/naming-convention.md) | 命名规范（P1） |
| [docs/design-patterns/ipc-transport-dry.md](docs/design-patterns/ipc-transport-dry.md) | DRY 改进（P2） |
| [docs/architecture/message-data-flow.md](docs/architecture/message-data-flow.md) | 消息数据流三层模型 |
