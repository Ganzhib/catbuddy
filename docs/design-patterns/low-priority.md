# 低优先级优化项汇总

> **影响文件**：多个文件
> **问题类型**：综合
> **优先级**：P2

---

## 1. pickOnlineDesktop 无效逻辑

**文件**：`gateway-state.ts:164-169`

```typescript
private pickOnlineDesktop(): GatewayClient | null {
  const online = [...this.clients.values()].filter(
    (c) => c.role === 'desktop' && c.ws.readyState === 1,
  )
  return online.length === 1 ? online[0] : online[0] ?? null
  //     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //     这两个分支永远返回相同值：online[0] ?? null
}
```

**修复**：

```typescript
private getFirstOnlineDesktop(): GatewayClient | null {
  for (const c of this.clients.values()) {
    if (c.role === 'desktop' && c.ws.readyState === 1) return c;
  }
  return null;
  // TODO: 未来若需显式路由策略（多 desktop 在线），在此处实现
}
```

---

## 2. FileEditEvent / UIFileEdit 类型重复

**文件**：`agent-types.ts:96`、`ui-types.ts:98`

两个接口结构完全相同：

```typescript
// agent-types.ts — 后端协议类型
export interface FileEditEvent {
  call_id: string;
  path: string;
  absolute_path?: string;
  status: 'editing' | 'done' | 'error';
  // ... 所有字段
}

// ui-types.ts — UI 类型，完全相同
export interface UIFileEdit {
  call_id: string;
  path: string;
  absolute_path?: string;
  status: 'editing' | 'done' | 'error';
  // ... 完全相同
}
```

**修复**：

```typescript
// ui-types.ts
import type { FileEditEvent } from './agent-types';

// UI 使用时直接引用协议类型
export type UIFileEdit = FileEditEvent;
```

DiagramUiEvent / UIDiagramEvent 同理。

---

## 3. InboundEvent 大联合类型按语义分组

**文件**：`ui-types.ts:283-366`

当前 20+ 个变体混在一个 union 中。建议分组：

```typescript
// 流式事件
type StreamEvents =
  | InboundDelta
  | InboundStreamEnd
  | InboundReasoningDelta
  | InboundReasoningEnd;

// Session 事件
type SessionEvents =
  | InboundSessionUpdated
  | InboundTurnEnd
  | InboundGoalStatus
  | InboundGoalState;

// Agent 输出事件
type AgentOutputEvents =
  | InboundMessage
  | InboundFileEdit
  | InboundDiagramEvent;

// 合并
export type InboundEvent = StreamEvents | SessionEvents | AgentOutputEvents | InboundError;
```

**收益**：代码中可以使用分组的类型来约束某个函数只处理特定类别事件，如 `useStreamReducer(events: StreamEvents)` 而非 `InboundEvent`。

---

## 4. LLMMessage.content 三态问题

**文件**：`agent-types.ts:61-69`

```typescript
export type LLMMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | ContentBlock[] | null  // 三态：string | ContentBlock[] | null
}
```

**建议**：使用判别联合类型，按 role 区分 content 类型：

```typescript
type LLMMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | ContentBlock[] }
  | { role: 'assistant'; content: string | ContentBlock[] | null; toolCalls?: ToolCallRequest[]; reasoningContent?: string }
  | { role: 'tool'; content: string; toolCallId: string; name?: string };
```

**注意**：这个改动影响面广（AI SDK 返回格式），建议在 God Class 拆分和 Hook 拆分完成后再进行，避免大规模重构。

---

## 5. Record<string, unknown> 过度使用

多个接口中使用 `Record<string, unknown>` 代替精确类型：

```typescript
// agent-types.ts
ToolDefinition.function.parameters: Record<string, unknown>  // ← 应为 JSON Schema 类型
InboundMessage.metadata: Record<string, unknown>
SessionInfo.metadata: Record<string, unknown>
```

**建议**：至少为频繁使用的字段定义具体的类型别名：

```typescript
type JsonSchema = Record<string, unknown>;  // 语义化别名
type SessionMetadata = Record<string, unknown>;  // 预留扩展
```

---

## 6. WebSocket 缺少连接级别保护

**文件**：`gateway/packages/gateway/src/index.ts:26`

```typescript
const wss = new WebSocketServer({ server: app.server, path: '/ws' });
// 缺少 maxPayload, perMessageDeflate, maxConnections 等安全配置
```

**建议**：

```typescript
const wss = new WebSocketServer({
  server: app.server,
  path: '/ws',
  maxPayload: 1024 * 1024,  // 1MB — 防止内存 DoS
  perMessageDeflate: false,  // 无压缩需求时关闭以减小攻击面
});
```

---

## 7. Gateway 进程级错误处理缺失

**文件**：`gateway/packages/gateway/src/index.ts`

桌面端已有 `unhandledRejection` 处理 (`apps/desktop/src/main/index.ts:20-23`)，但 Gateway 没有。

**建议**：在 Gateway 入口加上：

```typescript
process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error('[gateway] unhandledRejection:', msg);
  // 记录但不崩溃 — Node 默认行为会崩溃，保持默认
});

process.on('uncaughtException', (err) => {
  console.error('[gateway] uncaughtException:', err.message);
  // 优雅关闭路径：关闭 WSS → 等待连接排空 → 关闭 MySQL pool
  app.close().finally(() => process.exit(1));
});
```

---

## 实施建议

这些低优先级项属于"改进性优化"，建议在 P0 + P1 完成后，以"渐进式改进"方式逐步实施，避免大规模重构。每项估计 10-30 分钟。
