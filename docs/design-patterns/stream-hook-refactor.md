# Stream Hook 拆分：useCatbuddyStream

> **文件**：`packages/ui/src/hooks/useCatbuddyStream.ts` (1082 行)
> **问题类型**：可读性 — 文件做了太多事 / 内聚不足
> **优先级**：P0

---

## 现状分析

当前文件混合了三个层次：

```
useCatbuddyStream.ts (1082 行)
│
├── 纯函数区 (lines 1-470)
│   ├── 消息树查找：findStreamingAssistantIndex() / findActiveAssistantPlaceholderIndex()
│   ├── 消息变换：attachReasoningChunk() / appendAnswerChunk()
│   ├── 文件编辑合并：mergeFileEdits() / mergeFileEditIntoTrace()
│   └── 工具进度合并：appendToolProgressTrace() / appendToolsUsedSummary()
│
├── Buffer + rAF 批处理 (lines 500-700)
│   ├── schedulePendingStreamFlush() — requestAnimationFrame 调度
│   ├── flushPendingStreamEvents() — 消费缓冲区
│   └── applyPendingStreamEvents() — 按类型分发
│
└── Hook body + 事件分发 (lines 503-1082)
    ├── 状态声明 (11 个 useRef + 6 个 useState)
    ├── useEffect: 事件 handler (742-992)，处理 15+ 种 InboundEvent
    ├── send() / stop() 方法
    └── 清理逻辑
```

**问题**：
- 纯函数和 React hook 逻辑混在一起，无法独立测试消息树操作
- 维护者需要在三个抽象层次间频繁跳转
- 任何微小的 buffer 逻辑修改也需要理解整个 1082 行文件

---

## 目标设计

```
hooks/
├── useCatbuddyStream.ts           ← 薄编排层 (~200 行)
└── stream/
    ├── message-tree.ts             ← 纯函数：消息树操作 (~470 行)
    └── stream-buffer.ts            ← 流缓冲管理 (~200 行)
```

---

## 详细设计

### 1. message-tree.ts — 纯函数模块

所有函数均为纯函数：输入 `UIMessage[]`，输出 `UIMessage[]`。

```typescript
// packages/ui/src/hooks/stream/message-tree.ts

// ── 查找函数 ──
export function findStreamingAssistantIndex(prev: UIMessage[], closedStreamIds: ReadonlySet<string>): number | null;
export function findActiveAssistantPlaceholderIndex(prev: UIMessage[]): number | null;
export function isReasoningOnlyPlaceholder(message: UIMessage): boolean;
export function isToolTrace(message: UIMessage | undefined): boolean;

// ── 推理流操作 ──
export function attachReasoningChunk(prev: UIMessage[], chunk: string, segments?: { ensure: () => string }): UIMessage[];

// ── 答案流操作 ──
export interface AnswerAppendContext {
  resolveAssistantIndex: (prev: UIMessage[]) => number | null;
}
export function appendAnswerChunk(prev: UIMessage[], chunk: string, ctx: AnswerAppendContext): UIMessage[];

// ── 流结束标记 ──
export function closeReasoningStream(prev: UIMessage[]): UIMessage[];

// ── 统计标记 ──
export function stampLastAssistantTurnStats(prev: UIMessage[], stats: { latencyMs?: number; tokenUsage?: TokenUsage }): UIMessage[];

// ── 清理 ──
export function pruneReasoningOnlyPlaceholders(prev: UIMessage[]): UIMessage[];
export function absorbCompleteAssistantMessage(prev: UIMessage[], ...): UIMessage[];

// ── 工具/文件编辑合并 ──
export function appendToolProgressTrace(prev: UIMessage[], event: ToolProgressEvent, segmentId: string): UIMessage[];
export function appendToolsUsedSummary(prev: UIMessage[], tools: string[]): UIMessage[];
export function mergeFileEdits(existing: UIFileEdit[] | undefined, incoming: UIFileEdit[]): UIFileEdit[];
export function mergeFileEditIntoTrace(prev: UIMessage[], segmentId: string, edits: UIFileEdit[]): UIMessage[];
export function optimisticFileEditFromToolStart(event: ToolProgressEvent): UIFileEdit[] | null;

// ── 工具 ──
export function replaceMessageAt(prev: UIMessage[], index: number, message: UIMessage): UIMessage[];
```

**关键变化**：
- `appendAnswerChunk` 通过 `AnswerAppendContext` 接口接收索引解析逻辑，解耦 buffer 状态
- 所有函数暴露为具名导出，支持独立单元测试

### 2. stream-buffer.ts — 流缓冲管理

```typescript
// packages/ui/src/hooks/stream/stream-buffer.ts

interface StreamBuffer {
  messageId: string;
}

interface StreamBufferController {
  flushEvents(closeCurrentSegment: boolean): void;
  schedulePendingFlush(): void;
  cancelPendingFlush(): void;
}

export function createStreamBuffer(applyEvents: (events: PendingStreamEvent[]) => void): StreamBufferController;

// 或者，使用 useStreamBuffer hook：
export function useStreamBuffer(
  applyPendingEvents: (prev: UIMessage[], events: PendingStreamEvent[]) => UIMessage[]
): {
  buffer: React.MutableRefObject<StreamBuffer | null>;
  schedulePendingStreamFlush: () => void;
  flushPendingStreamEvents: (options?: { closeAnswerSegment?: boolean }) => void;
  clearPendingStreamWork: () => void;
  pendingStreamEvents: PendingStreamEvent[];
};
```

**关键变化**：
- buffer 逻辑独立为 hook/工厂函数
- 不再直接依赖 `setMessages`，通过回调注入
- 可独立测试批处理、rAF 调度、事件合并逻辑

### 3. useCatbuddyStream.ts — 薄编排层

```typescript
// packages/ui/src/hooks/useCatbuddyStream.ts (~200 行)

export function useCatbuddyStream(params: UseCatbuddyStreamParams) {
  const { client, chatId, initialMessages, ... } = params;
  const [messages, setMessages] = useState(initialMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [goalState, setGoalState] = useState<...>(undefined);
  const [streamError, setStreamError] = useState<StreamError | null>(null);

  // 使用拆分后的模块
  const {
    schedulePendingStreamFlush,
    flushPendingStreamEvents,
    clearPendingStreamWork,
    buffer,
  } = useStreamBuffer((events) => {
    setMessages(prev => applyPendingStreamEvents(prev, events));
  });

  const activitySegment = useActivitySegmentManager();

  // 事件分发逻辑（精简后 ~150 行）
  useEffect(() => {
    if (!chatId) return;
    const handle = (ev: InboundEvent) => {
      if (ev.event === "delta") {
        schedulePendingStreamFlush(ev.text);
        return;
      }
      // ... 其他事件类型
    };
    return client.onChat(chatId, handle);
  }, [chatId, client, ...]);

  const send = useCallback(...);
  const stop = useCallback(...);

  return { messages, isStreaming, runStartedAt, goalState, send, stop, ... };
}
```

---

## 迁移策略

```
Step 1: 纯函数提取
  → 将 lines 1-470 的纯函数移到 stream/message-tree.ts
  → 修改 useCatbuddyStream.ts 中的 import 路径
  → 验证：编译通过 + 流式文本正常显示

Step 2: Buffer 逻辑提取
  → 将 rAF 批处理逻辑移到 stream/stream-buffer.ts
  → useCatbuddyStream 中引入 useStreamBuffer
  → 验证：高速流式文本不闪烁，批处理正常

Step 3: Activity Segment 提取（可选）
  → 将 segment 管理逻辑移出，如果要进一步精简
  → 验证：工具调用折叠/展开正常
```

每步只移动代码，不修改逻辑，确保行为完全不变。
