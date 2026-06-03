# 消息数据流全链路参考

> **用途**：做 Session/消息相关需求时，确保不遗漏关键字段和转换链路。
> **最后更新**：2026-06-03（修复 `tokenUsage`/`latencyMs` 历史回放丢失问题后）

---

## 1. 类型定义速查

项目中有 **三层类型**，每层含义不同：

| 层级 | 类型 | 文件 | 用途 |
|------|------|------|------|
| **持久层** | `MessageRecord` | `packages/shared/src/agent-types.ts:150-166` | JSONL 存储 / MySQL 存储的单条消息 |
| **传输层** | `WebuiThreadPersistedPayload` | `packages/shared/src/ui-types.ts:428-433` | IPC/HTTP 返回给前端的完整会话快照，内含 `UIMessage[]` |
| **渲染层** | `UIMessage` | `packages/shared/src/ui-types.ts:35-66` | 前端 React 组件渲染用的消息形状 |

### 1.1 `MessageRecord` — 持久层（Single Source of Truth）

```typescript
// packages/shared/src/agent-types.ts:150-166
interface MessageRecord {
  id: number
  sessionKey: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  toolCalls?: ToolCallRequest[]
  toolCallId?: string
  name?: string
  media?: string[]
  reasoningContent?: string       // ← DeepSeek thinking mode 文本
  timestamp: string
  tokenUsage?: TokenUsage         // ← { inputTokens, outputTokens }
  latencyMs?: number              // ← turn 耗时(ms)
}
```

**关键点**：新增任何需要在历史回放中恢复的字段，**必须**同时更新：
1. `MessageRecord` 类型定义 (agent-types.ts)
2. `SessionManager.addMessage()` 的写入字段 (session-manager.ts)
3. Gateway MySQL 的 `gateway_session_messages` 表结构
4. `buildWebuiThreadPayload` 的转换逻辑 (webui-thread.ts)

### 1.2 `UIMessage` — 渲染层

```typescript
// packages/shared/src/ui-types.ts:35-66
interface UIMessage {
  id: string
  role: Role
  content: string
  kind?: MessageKind              // "message" | "trace"
  isStreaming?: boolean
  createdAt: number
  traces?: string[]
  toolProgress?: Record<string, ToolProgressEvent>  // ← 工具调用卡片数据
  fileEdits?: UIFileEdit[]        // ← 文件编辑摘要
  activitySegmentId?: string     // ← Agent Activity 分组 ID
  images?: UIImage[]
  media?: UIMediaAttachment[]
  reasoning?: string              // ← 推理文本（从 reasoningContent 映射）
  reasoningStreaming?: boolean
  latencyMs?: number              // ← turn 耗时
  tokenUsage?: TokenUsage         // ← token 统计
}
```

### 1.3 字段映射对照表

| MessageRecord | → | UIMessage | 转换位置 |
|---------------|-----|-----------|----------|
| `id` | → | `String(id)` | `assistantMessage()` / `plainMessage()` |
| `role` | → | `role` | 同上 |
| `content` | → | `content` | 同上 |
| `timestamp` | → | `createdAt` (ms) | `timestampMs()` |
| `reasoningContent` | → | `reasoning` | `assistantMessage()` L94 |
| `tokenUsage` | → | `tokenUsage` | `assistantMessage()` L96 |
| `latencyMs` | → | `latencyMs` | `assistantMessage()` L97 |
| `toolCalls` | → | `toolProgress` (合成) | `buildWebuiThreadPayload` L233-238 |
| `toolCalls` + tool results | → | `fileEdits` (合成) | `synthesizeFileEdits()` |
| — | — | `activitySegmentId` | `buildWebuiThreadPayload` (内部生成) |

---

## 2. 四条关键数据链路

### 2.1 链路 A：Agent Loop → JSONL 写入（保存消息）

这是**唯一写入**持久化存储的路径。

```
AgentLoop._state_run()          [loop.ts:828]
  → sessionManager.addMessage(user msg)    // 先存用户消息

  → runner.run(spec)
    → AgentRunResult { messages, usage, finalContent, lastReasoningContent, ... }

AgentLoop._state_save()         [loop.ts:907-950]
  ↓
  for each LLMMessage (tool_call 中间步骤):
    addMessage({ role, content, toolCalls, reasoningContent })
  for each LLMMessage (tool result):
    addMessage({ role, content, toolCallId, name })
  ↓
  最后一条 assistant (纯正文):
    addMessage({ role: "assistant", content: finalContent, tokenUsage, latencyMs })
  ↓
SessionManager.addMessage()     [session-manager.ts:70-103]
  → JSONL 文件原子写入

JSONL 格式:
  第 1 行: {"key":..., "title":..., "created_at":..., ...}  // 元信息
  第 2+ 行: {"id":1,... "role":"user", ...}                  // 每条 MessageRecord 一行
```

**⚠️ 当前 `addMessage()` 写入的所有字段** (`session-manager.ts:77-90`)：
```typescript
{ id, sessionKey, role, content, toolCalls, toolCallId,
  name, media, reasoningContent, timestamp, tokenUsage, latencyMs }
```

**新增字段检查点**：如果你在 `_state_save()` 中传了新字段给 `addMessage()`，必须在 `session-manager.ts:77-90` 中把它加到 push 对象里。

### 2.2 链路 B：JSONL → IPC → 前端（加载历史，Desktop 路径）

```
前端 useSessionHistory()
  → fetchWebuiThread(token, key)       [packages/platform/src/ipc-api.ts:52-61]
    → ipcRenderer.invoke('session:get')
    → ipcMain handler
      → getDesktopSessionDetail()
        → SessionManager.getDetail(key)  // 读 JSONL
          → SessionDetail { ...info, messages: MessageRecord[] }
    ← 返回 SessionDetail（完整 MessageRecord[]）
  → buildWebuiThreadPayload(session)    [packages/shared/src/webui-thread.ts:216-269]
    → 遍历 messages:
      - assistant + toolCalls → assistantMessage() + traceMessage()
      - 孤立 tool 结果 → traceMessage()
      - user/assistant/system → plainMessage()
    → 返回 WebuiThreadPersistedPayload { messages: UIMessage[] }
```

**⚠️ 关键点**：Desktop IPC 路径**已经统一使用 `buildWebuiThreadPayload()`**（2026-06-03 修复）。
之前 `ipc-api.ts` 有一段独立的粗陋循环，只复制了 `role + content + createdAt`，导致所有富字段丢失。
**不要再在 IPC 层手工拼 UIMessage**。

### 2.3 链路 C：JSONL → Gateway WS → Web 前端（Gateway 路径）

```
Web 前端 fetchWebuiThread(token, key)
  → GET /api/webui-thread?key=...
  → GatewayStateService.fetchThreadForWeb()
    ├─ [Desktop 在线] RPC → Desktop WS → 返回完整 payload
    │    └─ Desktop 侧: buildWebuiThreadPayload(session)
    │       → 序列化 → WS 发给 Gateway → 返回给 Web
    │
    ├─ [缓存命中] ThreadCache → 直接返回
    │
    └─ [Desktop 离线] MySQL 回退
         → MysqlSessionStore.buildWebuiThread()
         → getDetail(key) → Gateway 版 MessageRecord[]
         → buildWebuiThreadFromDetail()
           → toSharedSessionDetail() → 普通 MessageRecord[]
           → buildWebuiThreadPayload()
       
       ⚠️ Gateway MySQL 表缺少列: reasoningContent, tokenUsage, latencyMs
       从 MySQL 回退时这些字段为 undefined，前端需处理好缺失情况
```

### 2.4 链路 D：反向同步（Gateway → Desktop 回写）

```
Gateway 收到 Desktop WS 的 thread snapshot
  → persistThreadSnapshot()
    → sessionRecordsFromWebuiMessages() [webui-thread.ts:307-357]
      → UIMessage[] → MessageRecord[]
        注意: reasoning → reasoningContent, tokenUsage/latencyMs 正确回写
    → importWebuiPayload() → MySQL INSERT
      ⚠️ MySQL insertMessage 只写 9 列，reasoningContent/tokenUsage/latencyMs 仍然被丢弃


Desktop 从 Gateway 同步回来:
  SessionManager.importWebuiThread()   [session-manager.ts:171-193]
    → sessionRecordsFromWebuiMessages() → MessageRecord[]
    → 写入本地 JSONL（完整 12 字段）
```

---

## 3. `buildWebuiThreadPayload` 内部逻辑

这是**所有历史回放路径的最终汇聚点**，位于 `packages/shared/src/webui-thread.ts:216-269`。

### 3.1 消息类型处理策略

```
遍历 session.messages (MessageRecord[]):

┌─ role=assistant + toolCalls?.length > 0
│   → 有 reasoning/content → assistantMessage(message, segmentId)
│   → 遍历 toolCalls → mergeToolEvent(start)
│   → 找紧随的 tool 结果 → mergeToolEvent(end)
│   → synthesizeFileEdits() 合成文件编辑摘要
│   → traceMessage(progress, fileEdits, segmentId)
│   → 跳过已消费的 tool 结果
│
├─ role=tool (孤立工具结果，没有对应 assistant toolCalls)
│   → 从 toolCall 记录中提取 toolCalls 信息
│   → synthesizeFileEdits()
│   → traceMessage(progress, fileEdits, segmentId)
│
└─ 其他 (user / assistant无toolCalls / system)
    → plainMessage()
      - user/system: 纯 { id, role, content, createdAt }
      - assistant: assistantMessage() → 含 reasoning/tokenUsage/latencyMs
```

### 3.2 关键辅助函数

| 函数 | 位置 | 作用 |
|------|------|------|
| `assistantMessage()` | L88-99 | MessageRecord → UIMessage，保留 reasoning/tokenUsage/latencyMs |
| `traceMessage()` | L69-86 | 生成 tool trace 行，含 toolProgress + fileEdits |
| `plainMessage()` | L101-112 | 简单转换，user/system 无额外字段 |
| `synthesizeFileEdits()` | L156-193 | 从 toolCalls + results 合成 FileEditEvent[] |
| `mergeToolEvent()` | L49-67 | 合并同一 tool_call 的 start/end 事件 |

---

## 4. 新需求开发检查清单

当你需要给消息增加新字段时，按此清单逐项检查：

### 4.1 类型定义

- [ ] `packages/shared/src/agent-types.ts` — `MessageRecord` 增加新字段（可选 `?`）
- [ ] `packages/shared/src/ui-types.ts` — `UIMessage` 增加对应字段
- [ ] 如需 WS 实时推送：`InboundAgentMessage` / `InboundTurnEnd` 等事件类型

### 4.2 写入链（Agent Loop → 持久化）

- [ ] `apps/desktop/src/main/agent/loop.ts` — `_state_save()` 中 `addMessage()` 调用传入新字段
- [ ] `apps/desktop/src/main/session/session-manager.ts` — `addMessage()` L77-90 push 对象中包含新字段
- [ ] Gateway MySQL 表结构 + `insertMessage` SQL 语句

### 4.3 读取链（持久化 → 前端渲染）

- [ ] `packages/shared/src/webui-thread.ts` — `assistantMessage()` / `traceMessage()` / `plainMessage()` 中映射新字段
- [ ] Gateway 侧 `toSharedSessionDetail()` 如有缺失需补充
- [ ] `sessionRecordsFromWebuiMessages()` 如有反向转换需处理新字段

### 4.4 不要做的事

- ❌ **不要在 `packages/platform/src/ipc-api.ts` 里手工拼 UIMessage** — 统一走 `buildWebuiThreadPayload()`
- ❌ **不要只修一边** — 写入和读取必须配对修改
- ❌ **不要忘了 Gateway MySQL schema** — Desktop JSONL 全但 MySQL 列不全，离线回退会丢字段

---

## 5. 常见陷阱

### 5.1 "改了 webui-thread.ts 但 Desktop 还是不对"

Desktop IPC 路径过去有两套独立的转换逻辑（`ipc-api.ts` 手工拼 + `webui-thread.ts` 正式转换），现在已统一。如果将来又有人在 `ipc-api.ts` 写独立的转换循环，就会重现这个 bug。

**规则**：所有 MessageRecord → UIMessage 的转换必须通过 `buildWebuiThreadPayload()`。

### 5.2 "新增了 MessageRecord 字段但历史回放没有"

三步缺一不可：
1. `_state_save()` 传入该字段
2. `addMessage()` 存盘包含该字段
3. `buildWebuiThreadPayload()` → `assistantMessage()` / `traceMessage()` 读取并映射该字段

### 5.3 "tokenUsage 只在最后一条 assistant 消息上"

这是**设计如此**。`_state_save()` L937-944 只有最终的不带 toolCalls 的 `assistant` 消息才附带 `tokenUsage/latencyMs`。中间带 toolCalls 的 assistant 消息不带这两个字段。前端应只取最后一条 assistant 的 tokenUsage 显示。

### 5.4 "Gateway Web 离线时缺少某字段"

Gateway MySQL 的 `gateway_session_messages` 表只有 9 列，缺少 `reasoning_content`、`token_usage`、`latency_ms`。当 Desktop 离线、Gateway 从 MySQL 回退时，这些字段为 `undefined`。如需在离线场景也展示这些信息，需要：
1. 给 MySQL 表加列
2. 更新 `insertMessage` / `rowToMessage` 
3. 更新 Gateway 版 `MessageRecord` 类型

---

## 6. 文件索引

| 文件 | 角色 |
|------|------|
| `packages/shared/src/agent-types.ts` | `MessageRecord`、`AgentRunResult`、`TokenUsage` 等核心类型 |
| `packages/shared/src/ui-types.ts` | `UIMessage`、`WebuiThreadPersistedPayload`、WS 事件类型 |
| `packages/shared/src/webui-thread.ts` | `buildWebuiThreadPayload()` — 所有 MessageRecord→UIMessage 转换的汇聚点 |
| `apps/desktop/src/main/session/session-manager.ts` | JSONL 存储，`addMessage()` / `getDetail()` |
| `apps/desktop/src/main/agent/loop.ts` | Agent 状态机，`_state_save()` 写入入口 |
| `apps/desktop/src/main/agent/runner.ts` | LLM 调用，返回 `AgentRunResult` |
| `packages/platform/src/ipc-api.ts` | Desktop IPC 入口，`fetchWebuiThreadIpc()` |
| `gateway/packages/gateway/src/http-routes.ts` | Gateway HTTP API，`/api/webui-thread` |
