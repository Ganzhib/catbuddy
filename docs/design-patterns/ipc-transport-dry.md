# IpcTransport 事件注册 DRY 改进

> **文件**：`packages/client/src/transport/ipc-transport.ts` (218 行)
> **问题类型**：可读性 — 重复代码
> **优先级**：P2

---

## 现状分析

`attach()` 方法中有 ~140 行几乎相同的模式：

```typescript
// ipc-transport.ts:71-198
attach(callbacks: TransportCallbacks): () => void {
  const api = window.catbuddy;
  const activeChatId = () => callbacks.getActiveChatId();

  const unsubs = [
    api.onStreamDelta((data) => {
      callbacks.onEvent({ event: "delta", chat_id: chatIdFromPayload(data, activeChatId), text: data.content, stream_id: data.streamId });
    }),
    api.onStreamEnd((data) => {
      callbacks.onEvent({ event: "stream_end", chat_id: chatIdFromPayload(data, activeChatId), stream_id: data.streamId });
    }),
    api.onTurnComplete((data) => {
      const chat_id = chatIdFromPayload(data, activeChatId);
      const { chatId: _c, ...turn } = data;
      callbacks.onEvent({ event: "turn_end", chat_id, latency_ms: turn.latencyMs, ... });
    }),
    api.onReasoningDelta((data) => {
      callbacks.onEvent({ event: "reasoning_delta", chat_id: chatIdFromPayload(data, activeChatId), text: data.content });
    }),
    // ... 重复 ~10 次
  ];
  return () => unsubs.forEach(fn => fn?.());
}
```

**问题**：
- 每个事件处理器的模板代码 (chatId 提取 + callbacks.onEvent 调用) 重复了 ~10 次
- 新增事件类型时需要复制粘贴整个模板
- 部分是 `api.onXxx`，部分是 `api.onXxx?.()`（可选链），不一致

---

## 目标设计：通用的订阅注册器

### 方案一：工厂函数（推荐）

```typescript
// packages/client/src/transport/event-subscription.ts

interface EventSubscriptionConfig<T extends { chatId?: string }> {
  /** 返回 unsubscribe 函数，或 undefined（事件不支持时跳过） */
  subscribe: (callback: (data: T) => void) => (() => void) | undefined;
}

function createEventSubscription<T extends { chatId?: string }>(
  api: CatbuddyPreloadApi,
  getActiveChatId: () => string,
  onEvent: (ev: InboundEvent) => void,
): (subscription: EventSubscriptionConfig<T>) => (() => void) {
  return (subscription) => {
    const unsubscribe = subscription.subscribe((data) => {
      onEvent(subscription.mapper(data, getActiveChatId));
    });
    return unsubscribe ?? (() => {});
  };
}
```

### IpcTransport 中简化后的使用

```typescript
// ipc-transport.ts:attach()
attach(callbacks: TransportCallbacks): () => void {
  const api = window.catbuddy;
  if (!api) {
    callbacks.onStatus("error");
    return () => {};
  }

  callbacks.onStatus("connecting");
  const activeChatId = () => callbacks.getActiveChatId();

  const tagChatId = <T extends { chatId?: string }>(fn: (data: T, chatId: string) => InboundEvent) =>
    (data: T) => fn(data, chatIdFromPayload(data, activeChatId));

  const cleanupFns = [
    // 简单一对一映射
    sub(api.onStreamDelta, tagChatId((data, cid) => ({
      event: "delta", chat_id: cid, text: data.content, stream_id: data.streamId,
    }))),
    sub(api.onStreamEnd, tagChatId((data, cid) => ({
      event: "stream_end", chat_id: cid, stream_id: data.streamId,
    }))),
    sub(api.onReasoningDelta, tagChatId((data, cid) => ({
      event: "reasoning_delta", chat_id: cid, text: data.content,
    }))),
    sub(api.onReasoningEnd, tagChatId((data, cid) => ({
      event: "reasoning_end", chat_id: cid,
    }))),

    // 复杂映射 — 使用内联 factory
    api.onTurnComplete((data) => {
      const cid = chatIdFromPayload(data, activeChatId());
      const { chatId: _c, ...turn } = data;
      callbacks.onEvent({ event: "turn_end", chat_id: cid, latency_ms: turn.latencyMs, ... });
      callbacks.onEvent({ event: "goal_status", chat_id: cid, status: "idle" });
    }),

    // ... 其他特殊映射
  ].filter(Boolean);

  callbacks.onStatus("open");
  return () => cleanupFns.forEach(fn => fn?.());
}

// 辅助函数
function sub<T extends { chatId?: string }>(
  subscribe: (cb: (data: T) => void) => (() => void) | undefined,
  mapper: (data: T) => InboundEvent,
): (() => void) | undefined {
  const unsub = subscribe(mapper);
  return unsub ?? undefined;
}
```

### 需要特殊处理的处理器

以下处理器逻辑更复杂，不适合用简单的 mapper 模式，保持内联：

| 处理器 | 原因 |
|--------|------|
| `onTurnComplete` | 一个事件触发两个 InboundEvent (turn_end + goal_status) |
| `onSystemMessage` | 有条件逻辑 (text === "Started a new conversation.") |
| `onGatewayInbound` | 有 null 检查逻辑 |
| `onSessionCreated/Deleted` | 调用的是 `onSessionUpdate` 而非 `onEvent` |

---

## 收益

| 维度 | 重构前 | 重构后 |
|------|--------|--------|
| attach() 行数 | ~140 行 | ~80 行 |
| 重复模板 | ~10 处 | 0 处 |
| 新增事件 | 复制 6 行模板 | 1 行声明 |
| 一致性 | `onXxx` vs `onXxx?.()` 混用 | 统一通过 `sub()` 包装 |
