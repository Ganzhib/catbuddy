# 命名规范统一

> **影响文件**：多个文件
> **问题类型**：命名语义化
> **优先级**：P1

---

## 规范总则

### 动词选择

| 场景 | 推荐 | 避免 |
|------|------|------|
| 获取单个对象 | `get` / `find` / `fetch` | `pick` |
| 获取列表 | `list` / `collect` | `getAll` |
| 创建 | `create` / `new` | `make` |
| 删除 | `delete` / `remove` | `destroy` → 有歧义（是销毁对象还是销毁数据库记录） |
| 设置值 | `set` | `put` → 与 HTTP PUT 混淆 |
| 解析/推算 | `resolve` | `decide` |
| 同步推送 | `push` / `sync` | `notify` → 太泛化 |

### 否定语义

| 避免 | 建议 |
|------|------|
| `suppressStreamUntilTurnEnd` | `deferStreamDisplay` 或 `suspendStreamRendering` |
| `disabled` (boolean) → 双重否定 | `enabled` (正向语义) |
| `notRegistered` | `unauthenticated` |

### 命名风格

```
类型/接口：PascalCase     — GatewayClient, InboundEvent
变量/函数：camelCase      — chatIdFromSessionKey, findWebClientByWs
常量：     UPPER_SNAKE    — DESKTOP_RPC_TIMEOUT_MS
文件：     kebab-case     — gateway-state.ts, ipc-transport.ts
```

---

## 具体问题及修正

### 1. `suppressStreamUntilTurnEndRef`

```diff
// useCatbuddyStream.ts:851
- const suppressStreamUntilTurnEndRef = useRef(false);
+ const deferStreamDisplayRef = useRef(false);
```

**理由**：`suppress...Until...` 是"抑制直到"的否定语义，需要额外脑力解析。`defer` 直接表达"推迟渲染"。

### 2. `pickOnlineDesktop` / `pickDesktopForWebToken`

```diff
// gateway-state.ts:164, 136
- private pickOnlineDesktop(): GatewayClient | null
+ private getFirstOnlineDesktop(): GatewayClient | null

- pickDesktopForWebToken(webToken: string): GatewayClient | null
+ resolveDesktopForWebToken(webToken: string): GatewayClient | null
```

**理由**：`pick` 暗示随机/策略选择，实际是取第一个或按 token 路由。`resolve` 更准确描述"基于 token 解析出对应 desktop"。

### 3. 变量命名泛化

```diff
// gateway-state.ts:379
- const allowed = await this.filterSessionsForDesktopDevice(deviceId, sessions)
+ const allowedSessions = await this.filterSessionsForDesktopDevice(deviceId, sessions)

// catbuddy-client.ts:263
- const wasOpen = this.status_ === "open"
+ const wasPreviouslyConnected = this.status_ === "open"

// ipc-transport.ts:71
- const unsubs = [ ... ]
+ const cleanupFns = [ ... ]
```

### 4. 命名差异过小的两个方法

```diff
// gateway-state.ts:725, 739
// 当前：两者只差 ForUser，但一个有 ACL 检查，一个没有
- handleWebInboundForUser(email, token, sessionKey, ...)
- handleWebInbound(sessionKey, chatId, ..., webToken?)

// 建议：统一为一个方法，email 必填（内部判断是否需要 ACL）
+ handleWebInbound(params: {
+   ownerEmail: string;
+   webToken: string;
+   sessionKey: string;
+   chatId: string;
+   content: string;
+   media?: unknown[];
+   source: 'web' | 'gateway';
+ }): Promise<SendResult>
```

**理由**：参数对象模式比两个重载更清晰，且消除了 ACL 检查的隐式差异。

### 5. snake_case 残留

```diff
// agent-types.ts 中的类型定义应保持协议一致（snake_case 用于后端协议）
// ui-types.ts 中的 UI 类型应改为 camelCase

// agent-types.ts (协议类型 — 保持 snake_case ✅)
  call_id: string
  absolute_path?: string

// ui-types.ts (UI 类型 — 改为 camelCase)
- call_id: string
+ callId: string

- absolute_path?: string
+ absolutePath?: string
```

---

## 命名自检清单

新增代码时检查：

- [ ] 方法名是否为 `动词 + 名词` 格式
- [ ] 布尔值是否使用正向语义（`enabled` > `disabled`，`visible` > `hidden`）
- [ ] 变量名是否足够具体（避免 `data`、`info`、`temp`、`result` 等泛化名称）
- [ ] 缩写是否被广泛认知（`id`、`url`、`api` 可用；`unsubs`、`exec` 不建议）
- [ ] 私有方法是否加 `private` 修饰符
