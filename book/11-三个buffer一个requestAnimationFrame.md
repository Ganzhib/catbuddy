# 10｜三个 buffer，一个 requestAnimationFrame：让 AI 打字像真的在打字

> 这是 CatBuddy 技术专栏的第 10 篇。上篇讲了 JSONL 会话持久化。这篇聊聊 CatBuddy 最"所见即所得"的部分——流式渲染。当 LLM 还在一个字一个字往外蹦的时候，UI 怎么做到不卡顿、不闪烁、不让用户觉得"卡住了"？

---

你有没有盯着一个 AI 聊天界面等了 30 秒，然后一下子蹦出 500 字的经历？

那 30 秒是最焦虑的。你不知道它在想什么，不知道它有没有在建文件，不知道它是死机了还是正在干活。刷新？不敢——万一它正好快算完了呢。

CatBuddy 要解决的，就是这 30 秒。

这篇聊一个看似简单的问题：**当 LLM 以每秒几十个 token 的速度流式输出，UI 怎么实时渲染而不掉帧？**

答案藏在三个 buffer 和一个 `requestAnimationFrame` 里。

---

## 10.1 一个字符的一生：从 LLM 神经元到屏幕像素

先拉一张全局图。一个字符从 LLM 产出到渲染在屏幕上，经过了这些环节：

```
DeepSeek/Anthropic API
  │  SSE chunk: {"delta": {"content": "你"}}
  ▼
Provider (anthropic.ts / openai-compat.ts)
  │  onContentDelta("你")
  ▼
AgentRunner.run()
  │  onStream?.(delta)
  ▼
AgentLoop._dispatch()
  │  StreamCallbacks.onStreamDelta("你")
  │  → bus.publishOutbound({ metadata: { _stream_delta: true } })
  ▼
ChannelManager → GatewayChannel.sendDelta()
  │  emitSession(chatId, { event: "delta", text: "你" })
  ▼
WebSocket / IPC
  │  JSON frame → renderer process
  ▼
useCatbuddyStream 事件处理器
  │  ev.event === "delta" → pushPendingEvent({ kind: "delta", text: "你" })
  │  schedulePendingStreamFlush()  ← requestAnimationFrame
  ▼
StreamBuffer 批量 flush
  │  setMessages(prev => appendAnswerChunk(prev, "你好世界..."))
  ▼
React reconciliation
  │  MessageBubble → MarkdownText (streaming=true → 闪烁光标)
  ▼
用户看到："你好世界█"
```

你没看错——**一个字符经过了 8 层**。但用户几乎感觉不到延迟，因为最关键的一层——StreamBuffer——用 `requestAnimationFrame` 把秒级几十次的 `setState` 压缩成了 60fps。

---

## 10.2 StreamBuffer：不是你想的那种 buffer

先看看 StreamBuffer 的核心数据结构：

```typescript
const pendingStreamEventsRef = useRef<PendingStreamEvent[]>([]);
// PendingStreamEvent = { kind: "delta", text: string } | { kind: "reasoning", text: string }

const streamFrameRef = useRef<number | null>(null);
```

它的设计哲学只有一句话：**攒够一帧再渲染**。

### 10.2.1 入队，不出队

每次收到 `delta` 或 `reasoning_delta` 事件，调用 `pushPendingEvent`：

```typescript
const pushPendingEvent = (event: PendingStreamEvent) => {
  pendingStreamEventsRef.current.push(event);
};
```

注意：这里什么都没干。没有 `setState`，没有 `concat`。只是把事件塞进数组。

### 10.2.2 requestAnimationFrame：关键的一行

紧接着调用 `schedulePendingStreamFlush`：

```typescript
const schedulePendingStreamFlush = () => {
  if (streamFrameRef.current !== null) return; // 已经有待处理的帧了，不重复调度
  streamFrameRef.current = window.requestAnimationFrame(() => {
    streamFrameRef.current = null;
    const events = pendingStreamEventsRef.current;
    if (events.length === 0) return;
    pendingStreamEventsRef.current = [];       // 清空
    setMessages((prev) => applyPendingStreamEvents(prev, events)); // 一次性应用
  });
};
```

这里有两个精妙的设计：

**1. 去重调度**：如果当前帧还没执行，新来的事件不会再调度一个新的 `requestAnimationFrame`。它们会被自动攒到同一个帧里。这意味着 1 秒内 LLM 产出的 30 个 token，在 UI 上只会触发最多 60 次渲染（你的屏幕刷新率），而不是 30 次。

**2. 同类型合并**：`applyPendingStreamEvents` 不仅是一次性应用所有事件，它还会把连续的同类事件合并：

```typescript
for (let i = 0; i < events.length; ) {
  const kind = events[i].kind;
  let text = "";
  while (i < events.length && events[i].kind === kind) {
    text += events[i].text;  // 合并所有连续的 delta
    i += 1;
  }
  // 然后一次性 append
}
```

这意味着如果攒了 5 个 `delta` 事件，它们会被合并成一个 `appendAnswerChunk(prev, "你好，我来帮你")`——减少 React reconciliation 的 diff 开销。

---

## 10.3 消息树：五个状态管理函数的协奏曲

StreamBuffer 只管"什么时候更新"，而"更新成什么样"由 `message-tree.ts` 里的五个函数负责。它们共同维护一个复杂的消息树，每个都在处理不同的流式事件：

| 函数 | 触发事件 | 做了什么 |
|------|----------|----------|
| `appendAnswerChunk` | `content_delta` | 找到当前 assistant 消息，追加 content |
| `attachReasoningChunk` | `reasoning_delta` | 找到最近的 assistant，追加 reasoning |
| `appendToolProgressTrace` | `tool_progress` | 创建/更新 trace 消息的 toolProgress |
| `mergeFileEditIntoTrace` | `file_edit` | 把文件变更合并到 trace 消息 |
| `closeReasoningStream` | `reasoning_end` | 关闭 reasoning 的 streaming 状态 |

### 10.3.1 谁是"当前 assistant"？

这比听起来复杂。因为流式过程中，消息列表在动态变化。索引可能失效。一个初始设置为 `null` 的 `activeAssistantRef` 需要在四种 fallback 策略中找到一个合法的目标：

```typescript
const resolveActiveAssistantIndex = (prev: UIMessage[]): number | null => {
  // 1. 先按 cursor (id+index) 找
  const cursor = activeAssistantRef.current;
  if (cursor && prev[cursor.index]?.id === cursor.id) return cursor.index;

  // 2. 按 id 搜索
  const idx = prev.findIndex((m) => m.id === cursor.id);

  // 3. 找 active placeholder (reasoning 创建的空白 assistant)
  return findActiveAssistantPlaceholderIndex(next);

  // 4. 找最后一个 isStreaming 的 assistant
  return findStreamingAssistantIndex(next, closedStreamIdsRef.current);
};
```

这四种 fallback 对应了四种真实场景：
- **场景 1**：连续 delta，索引没变（最常见，O(1) 命中）
- **场景 2**：中间插入了 trace 消息，索引偏移了（O(n) 查 id）
- **场景 3**：DeepSeek 先产出了 reasoning，创建了一个空白 assistant 占位符——后续的 text delta 应该填入这个占位符而不是新建
- **场景 4**：历史回放或跨 segment 的 streaming

### 10.3.2 closedStreamIdsRef：流分段的关键

CatBuddy 的 Agent 是分 segment 运行的——它可能输出一段文字 → 调用工具 → 再输出一段文字。每个 `stream_end` 事件标志一个 segment 结束。

问题来了：`stream_end` 之后，UI 上那个 assistant 消息应该保持 `isStreaming: true`（为了视觉连续性——闪烁光标还在），但不能接收后续 segment 的 delta 追加到它身上。

解决方案：`closedAssistantStreamIdsRef`——一个 `Set<string>`，记录哪些 assistant 的流已经关闭。查找目标 assistant 时会跳过这些 id。

---

## 10.4 useCatbuddyStream：五种事件的编排器

`useCatbuddyStream` 是胶水层——它订阅 WebSocket 事件，决定每个事件应该怎么影响消息树。核心是一个巨大的 `handle` 函数，处理 8 种事件类型：

```
delta             → pushPendingEvent → schedulePendingStreamFlush (攒帧)
reasoning_delta   → pushPendingEvent → schedulePendingStreamFlush (攒帧)
stream_end        → flushPendingStreamEvents (立即清空，关闭当前 segment)
reasoning_end     → closeReasoningStream (折叠 reasoning 区域)
message/progress  → 追加 progress trace 行
message/tool_hint → appendToolProgressTrace (更新工具进度)
file_edit         → mergeFileEditIntoTrace (合并文件变更)
turn_end          → 关闭所有 streaming，打时间戳和 token 统计
```

有意思的是 `delta` 和 `reasoning_delta` 走延迟批量渲染，而其他事件全部立即 `flushPendingStreamEvents()` 然后执行。为什么？

因为文字流式是高频的（每秒几十次），需要攒帧。但 tool_progress 和 file_edit 是低频事件，且用户关心的是"它正在做什么"——延迟不可接受。

---

## 10.5 渲染层的四个视觉状态

到了 React 组件层，每个消息有四种视觉表达：

### 10.5.1 打字中：闪烁光标

```tsx
<MarkdownText streaming={!!message.isStreaming}>
  {message.content}
</MarkdownText>
```

当 `streaming=true` 时，MarkdownText 在文末追加一个 CSS 动画的闪烁光标。Token 到了就追加，光标永远在最后。

### 10.5.2 等待中：跳动的点

当 assistant 消息的 `content` 为空但 `isStreaming=true` 时（LLM 还没产出第一个 token），渲染三个跳动的点：

```tsx
{empty && message.isStreaming && !hasReasoning ? (
  <TypingDots />  // ● ● ● 弹跳动画
) : null}
```

这三个点消除了"卡住了吗？"的焦虑——它在动，说明活着。

### 10.5.3 Reasoning：可折叠的思考气泡

DeepSeek 的推理过程（"嗯，用户想重构这个文件，我先看看…"）被渲染成一个蓝色左侧边框的折叠区域。在流式输出时默认展开（让用户看到它"在想"），推理结束后自动折叠（保持界面整洁）。用户手动切换后，不再自动折叠——尊重用户选择。

```typescript
const [userToggled, setUserToggled] = useState(false);
const open = userToggled ? openLocal : streaming; // 流式时展开，结束后自动折叠
```

### 10.5.4 Trace：工具调用的可折叠组

工具调用被聚合成两种形态：
- **ToolCallCards**：可视化的工具卡片（读文件、写文件、执行命令），带着名称、参数预览、执行状态和耗时
- **ProgressTraceLines**：纯文本的进度行（"🔄 分析代码结构中…"、"✅ 已修改 3 个文件"）

---

## 10.6 AgentActivityCluster：让"干活过程"不抢戏

当 Agent 在执行工具时，消息列表可能会被大量的 trace 消息淹没——read_file、grep、write_file、edit_file……每条都占一行的话，用户的聊天记录瞬间变成调试日志。

`AgentActivityCluster` 的设计思路：**把连续的"干活步骤"折叠成一个可展开的区块**。

```
┌─ Working… · 2 steps · 5 tool calls ─────── [+22 -3] ▼ ─┐
│  ┌ Thinking ──────────────────────────────────── ▶ ─┐  │
│  │  用户想重构 utils.ts，需要先了解当前结构...     │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌ 1 tool call ──────────────────────────────── ▶ ─┐  │
│  │  read_file  utils.ts                    ✓ 120ms  │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌ Editing utils.ts ─────────────── [+22 -3] ────────┘  │
│  │  ✅ utils.ts                                      │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

它的折叠逻辑：
- **流式进行中**：自动展开，且自动滚动到底部（`ResizeObserver` + `scrollTop`）
- **流式结束后**：自动折叠
- **用户手动操作后**：不再自动切换

还有一个很细节的动画：文件变更的行数差量（+22, -3）用了数字滚动动画。`AnimatedNumber` 组件让数字从旧值平滑过渡到新值——这在流式编辑中特别关键，因为 Agent 可能先创建文件（+50），再修改（+22, -3），用户看到数字跳动但不突兀。

---

## 10.7 性能：四个不卡顿的关键决策

整个流式渲染管线能达到 60fps，靠的是四个决策：

**1. requestAnimationFrame 批量渲染**

不在每个 delta 事件上 `setState`。攒满一帧再渲染。从可能的每秒 100+ 次渲染降到 60 次。

**2. 同类型合并**

连续的 5 个 `delta` 事件不触发 5 次 React reconciliation。合并成 1 个字符串拼接。

**3. activeAssistantRef 索引缓存**

最常见的场景（同一消息连续追加内容）走 O(1) 的数组索引访问，不遍历完整消息列表。

**4. closedStreamIdsRef 跳过策略**

分段流式时，已关闭的 segment 对应的消息直接跳过查找，不参与每次 delta 的 fallback 搜索。

---

## 如果重来一次

当前 StreamBuffer 只能攒 `delta` 和 `reasoning_delta` 两种事件。`tool_progress` 和 `file_edit` 是立即处理的。虽然它们是低频事件，但在极端情况下（Agent 执行了 10+ 个工具调用），仍然可能造成一帧内的多次 `setState`。

一个更彻底的方案可能是：所有事件都走 StreamBuffer 的攒帧机制，最终用一个统一的 `applyStreamEvents` 函数在一次 `setState` 里完成所有消息树变更。这样无论什么频率的事件，都是 O(1) 次 React reconciliation。但这要求所有事件类型必须互不依赖——`tool_progress` 和 `file_edit` 之间有关联，需要仔细设计合并顺序。

另一个遗憾：`reasoningStreaming` 的"流式结束自动折叠"逻辑，依赖 `useState` 的 `userToggled` 标记。如果用户在流式结束后 0.5 秒内恰好点击了展开按钮，由于 React 的异步状态更新，偶尔会出现"你点了展开但它又自己折叠了"的竞态。大规模用户还没报告过这个 bug，但理论上存在。

---

> **这篇讲了什么？**
>
> 1. 流式渲染的核心是 StreamBuffer——用 `requestAnimationFrame` 把高频 `content_delta` 事件攒帧渲染，同类事件自动合并，保证 60fps 不卡顿。
> 2. 消息树由五个函数维护：`appendAnswerChunk`、`attachReasoningChunk`、`appendToolProgressTrace`、`mergeFileEditIntoTrace`、`closeReasoningStream`。每个函数对应一种流式事件，各司其职。
> 3. UI 层有四种视觉状态：打字光标、跳点等待、可折叠推理气泡、可折叠工具调用组。`AgentActivityCluster` 把"干活步骤"折叠成统一区块，不淹没用户的主对话。

> 下一篇聊聊上下文治理——当一段对话超过 100 条消息后，Agent 怎么不疯掉？
