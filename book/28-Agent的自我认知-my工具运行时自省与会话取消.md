# Agent 的自我认知：my 工具、运行时自省与会话取消

CatBuddy 的 Agent 不是一个黑箱。它知道自己在用什么模型、当前是第几轮迭代、上下文窗口还剩多少空间、有几个子 Agent 在跑——而且在配置允许时，它**能自己修改这些参数**。

这种"自我认知"不是哲学概念，而是通过一个 96 行的工具实现的——`my`。

```ts
// Agent 对话中
用户: 你现在用什么模型？
Agent: [调用 my 工具，action=check]
Agent: 我用的是 deepseek-v4-flash，第 3 轮迭代，上下文窗口 128K
```

这一章把 `my` 工具、`RuntimeState` 协议、`AbortController` 会话取消机制串在一起，展示 CatBuddy 怎么给 Agent 装上"自知之明"和"自我控制"。

---

## 28.1 为什么 Agent 需要"认识自己"？

在大多数 AI 编程助手中，LLM 不知道自己的参数。它不知道上下文窗口大小、不知道当前迭代次数、不知道哪些工具可用。如果用户问"你最多能跑多少轮？"，LLM 要么编一个数字，要么说"我不确定"。

CatBuddy 的观点是：**Agent 应该知道自己的运行时状态，并且在安全边界内可以修改它**。

这带来了三个实际价值：

1. **透明调试**：用户问 `/model` 或 "你现在有几个子 Agent 在跑？"，Agent 给出精确答案而非幻觉。
2. **自适应任务**：Agent 在处理复杂任务时可以**自己请求延长 maxIterations**（在允许范围内），而不是在达到上限后硬停止。
3. **工具链的元认知**：Agent 知道自己有哪些工具、当前上下文窗口用量——这些信息帮助它做出更好的工具调用决策。

---

## 28.2 `my` 工具：96 行的自省接口

```ts
// apps/desktop/src/main/agent/tools/self.ts
export function createMyTool(
  runtime: RuntimeState,
  opts: { modifyAllowed?: boolean } = {},
): Tool {
  const modifyAllowed = opts.modifyAllowed ?? false  // 默认只读

  return {
    name: 'my',
    definition: {
      type: 'function',
      function: {
        name: 'my',
        description:
          'Check and set your own runtime state. Actions: check, set.'
          + (modifyAllowed ? '' : 'READ-ONLY MODE: set is disabled.'),
        parameters: {
          properties: {
            action: { type: 'string', enum: ['check', 'set'] },
            key: { type: 'string', description: 'Dot-path, e.g. maxIterations' },
            value: { description: 'New value for set' },
          },
          required: ['action'],
        },
      },
    },
    execute: async (call) => { /* ... */ },
  }
}
```

工具注册由 AgentLoop 在初始化时完成：

```ts
// AgentLoop 构造函数
const allowSet = opts.config.tools?.my?.allowSet ?? false
this.tools.register(createMyTool(this, { modifyAllowed: allowSet }))
```

默认 `allowSet = false`——Agent 只能查看自己的状态，不能修改。这是出于安全考虑：你不希望 Agent 在不受控的情况下把自己切换到另一个模型。

### 28.2.1 action=check：查看状态

```ts
if (act === 'check') {
  if (!key) {
    // 无参数 → 返回概览
    return [
      `model: ${runtime.model}`,
      `max_iterations: ${runtime.maxIterations}`,
      `current_iteration: ${runtime.currentIteration}`,
      `context_window_tokens: ${runtime.contextWindowTokens}`,
      `tools: ${runtime.toolNames.join(', ')}`,
      `model_preset: ${runtime.modelPreset ?? '(none)'}`,
      `running_subagents: ${runtime.subagents?.getRunningCount() ?? 0}`,
    ].join('\n')
  }
  // 有 key → 返回指定字段
  return String((runtime as Record<string, unknown>)[k] ?? `(key not found)`)
}
```

无参数调用返回一个多行文本概览——模型名、迭代状态、上下文窗口、工具清单、子 Agent 数量。这是一份 Agent 的"体检报告"。

有 key 参数时返回单个字段的值。但受 `BLOCKED` 集合限制——内部对象（bus、provider、runner 等）不能查看。

### 28.2.2 action=set：修改状态（受限）

```ts
if (act === 'set') {
  if (!modifyAllowed) return 'Error: set is disabled (read-only mode)'
  if (!key) return 'Error: key required for set'
  const k = String(key)
  if (BLOCKED.has(k) || READ_ONLY.has(k)) return `Error: cannot modify "${k}"`
  const rule = RESTRICTED[k]
  if (!rule) return `Error: key "${k}" is not settable`
  return runtime.setRuntimeValue(k, value)
}
```

只有三个 key 可以 set：`maxIterations`、`contextWindowTokens`、`model`。

### 28.2.3 三层安全模型

```ts
const BLOCKED = new Set([
  'bus', 'provider', '_running', 'tools', '_runtimeVars',
  'runner', 'sessions', 'consolidator', 'dream', 'autoCompact',
  'context', 'commands', '_mcpServers', '_pendingQueues',
  '_sessionLocks', '_activeTasks', /* ... */
])

const READ_ONLY = new Set([
  'subagents', 'currentIteration', 'execConfig', 'webConfig',
])

const RESTRICTED: Record<string, { type: string; min?: number; max?: number }> = {
  maxIterations:       { type: 'number', min: 1, max: 100 },
  contextWindowTokens: { type: 'number', min: 4096, max: 1_000_000 },
  model:               { type: 'string' },
}
```

三层安全等级：

| 安全等级 | 集合 | 含义 | 示例 |
|---------|------|------|------|
| **BLOCKED** | 16 个 key | 既不能看也不能改 | `bus`, `provider`, `runner`, `_mcpServers` |
| **READ_ONLY** | 4 个 key | 能看，不能改 | `subagents`, `currentIteration`, `execConfig` |
| **RESTRICTED** | 3 个 key | 能看，能改（带范围校验） | `maxIterations(1-100)`, `contextWindowTokens(4096-1M)`, `model` |

**为什么 `bus` 被 BLOCKED？** 因为 MessageBus 是系统的脊椎神经。Agent 看到 bus 的内部队列后可以推断其他会话的内容，甚至可能尝试 consume 不属于自己的消息。

**为什么 `currentIteration` 是 READ_ONLY？** Agent 需要知道自己在第几轮（有助于工具调用决策），但不应自己修改——这会导致循环终止逻辑混乱。

卡夫卡式的安全哲学：Agent 知道自己在一个循环里，知道循环的最大上限，但不能自己重置计数器。只能请求上限延长。

---

## 28.3 `RuntimeState`：暴露运行时的协议

```ts
// apps/desktop/src/main/agent/tools/runtime_state.ts
export interface RuntimeState {
  readonly model: string
  readonly maxIterations: number
  readonly currentIteration: number
  readonly toolNames: string[]
  readonly workspace: string
  readonly providerRetryMode: string
  readonly maxToolResultChars: number
  readonly contextWindowTokens: number
  readonly modelPreset: string | null
  readonly subagents: SubagentManager | null
  readonly runtimeVars: Record<string, unknown>
  readonly lastUsage: TokenUsage | null
  setRuntimeValue?(key: string, value: unknown): string
}
```

`AgentLoop` **本身就是** `RuntimeState`——它 implements 了所有 getter：

```ts
// AgentLoop
get toolNames(): string[] { return this.tools.toolNames }
get runtimeVars(): Record<string, unknown> { return this._runtimeVars }
get lastUsage(): TokenUsage | null { return this._lastUsage }
```

这种设计意味着 `createMyTool(this, ...)` 传入的 `this` 就是 AgentLoop 实例——工具直接读 AgentLoop 的属性，没有中间层。

### `_runtimeVars`：Agent 的便签簿

```ts
private readonly _runtimeVars: Record<string, unknown> = {}
```

Agent 可以用 `my.set({ key: 'some_scratch', value: 'hello' })` 在 `_runtimeVars` 中存储任意键值对。这不是持久化的——重启后丢失。它是 Agent 在当前会话中的"便签簿"，适合跨 turn 传递临时状态。

---

## 28.4 `setRuntimeValue`：受控的自修改

```ts
// AgentLoop.setRuntimeValue
setRuntimeValue(key: string, value: unknown): string {
  if (key === 'maxIterations') {
    const n = Number(value)
    if (Number.isNaN(n) || n < 1 || n > 100)
      return 'Error: maxIterations out of range (1-100)'
    this.maxIterations = n
    this.subagents?.setProvider(this.provider, this.model)
    return `maxIterations set to ${n}`
  }
  if (key === 'contextWindowTokens') {
    const n = Number(value)
    if (Number.isNaN(n) || n < 4096 || n > 1_000_000)
      return 'Error: contextWindowTokens out of range (4096-1000000)'
    this.contextWindowTokens = n
    return `contextWindowTokens set to ${n}`
  }
  if (key === 'model') {
    const m = String(value).trim()
    if (!m) return 'Error: model must be non-empty'
    this.setModel(m)
    return `model set to ${m}`
  }
  // 任意 key → 写入 runtimeVars 便签簿
  this._runtimeVars[key] = value
  return `${key} stored in runtime scratchpad`
}
```

三段分支，每段都是类型校验 + 范围限制 + 副作用传播：

- **`maxIterations`**：1-100 范围。修改后通知 subagents（子 Agent 也继承迭代限制）。
- **`contextWindowTokens`**：4096-1,000,000 范围（4K 到接近 1M，覆盖从 GPT-3.5 到 Gemini 2.5 Pro 的所有模型）。
- **`model`**：非空字符串，调用 `setModel` 广播到所有子系统（runner, consolidator, dream, subagents）。

第四段是 fallback——任何不在前三段的 key 都写入 `_runtimeVars` 便签簿。这是一种 **extensible design**：未来新增可修改参数不需要改 `self.ts` 的 `RESTRICTED` 集合，只需要在 `setRuntimeValue` 里加一个 if 分支。

---

## 28.5 会话取消：从 `/stop` 到 `AbortController`

Agent 的"自我控制"不只有修改参数——它还能**取消自己的任务**。

第 12 章讲了 `/stop` 命令的三层路由（前缀检测 → 命令分发 → 影响扩散）。这里补充最关键的影响扩散机制：`AbortController`。

### 28.5.1 每个 turn 一个 AbortController

```ts
// AgentLoop._dispatch()
const controller = new AbortController()
const existing = this._activeTasks.get(key) ?? []
existing.push(controller)
this._activeTasks.set(key, existing)
msg._abortSignal = controller.signal

try {
  const response = await this.process(msg, cbs)
  // ... 处理响应
} finally {
  delete msg._abortSignal
  const remaining = (this._activeTasks.get(key) ?? []).filter(c => c !== controller)
  if (remaining.length > 0) this._activeTasks.set(key, remaining)
  else this._activeTasks.delete(key)
}
```

关键细节：

1. **每个会话可以同时有多个 task**——`_activeTasks` 是 `Map<string, AbortController[]>`。一个会话可能同时有主 Agent 任务和子 Agent 任务在跑。
2. **`AbortController.signal` 被传递到 `AgentRunner` 和 `Provider`**——`spec.abortSignal` → `provider.chatStream({ signal })`。当 controller 被 abort，LLM 调用立即中断。
3. **finally 块保证清理**——无论 try 成功还是 catch 异常，controller 都会从 `_activeTasks` 中移除。

### 28.5.2 cancelSession：批量取消

```ts
async cancelSession(sessionKey: string): Promise<number> {
  const controllers = this._activeTasks.get(sessionKey)
  if (!controllers) return 0

  let cancelled = 0
  for (const ctrl of controllers) {
    if (!ctrl.signal.aborted) {
      ctrl.abort()
      cancelled++
    }
  }
  this._activeTasks.delete(sessionKey)
  return cancelled
}
```

`cancelSession` 一次性取消某个会话的**所有**正在运行的 task（主 Agent 推理、子 Agent、心跳任务等）。返回 `cancelled` 数量供调用方确认。

注意这个设计：取消不是"告诉 Agent 请停下来"——是**硬中断**。`AbortController.abort()` 会立即触发 `AbortError`，Provider 层的 `chatStreamWithRetry` 收到 `AbortError` 不会重试，会直接抛出。

### 28.5.3 取消传播链

```text
用户: /stop
  │
  ▼
CommandRouter → handleStop(msg)
  │
  ▼
AgentLoop.cancelSession(sessionKey)
  ├─ _activeTasks.get(sessionKey) → [controller1, controller2]
  ├─ controller1.abort()  → AgentRunner LLM 调用中断
  │   └─ signal.aborted → stopReason = 'cancelled'
  │       → finalContent = 'Task was cancelled.'
  └─ controller2.abort()  → 子 Agent LLM 调用中断

  │
  ▼
AgentRunner.run() 收到 AbortError
  ├─ chatStreamWithRetry → if (err.name === 'AbortError') throw err
  └─ 不重试，直接返回 'cancelled'
```

LLM 调用被中断后，`AgentRunner` 返回 `stopReason: 'cancelled'`，`AgentLoop` 通过 MessageBus 发一条 `_turn_complete` 出站消息，前端显示 "Task was cancelled."

---

## 28.6 设计回顾：为什么"自我认知"很重要

把 `my` 工具、`RuntimeState`、`AbortController` 串在一起，它们构成了 Agent 的**自省与控制闭环**：

```text
                 ┌─────────────────────┐
                 │   my 工具 (self.ts) │
                 │   check / set       │
                 └──────┬──────────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼              ▼              ▼
   ┌──────────┐  ┌────────────┐  ┌──────────┐
   │ check    │  │ set        │  │ scratch  │
   │ 查看状态 │  │ 修改参数   │  │ 便签簿   │
   └────┬─────┘  └─────┬──────┘  └──────────┘
        │              │
        ▼              ▼
   ┌──────────┐  ┌──────────────────┐
   │RuntimeState│  │setRuntimeValue   │
   │ protocol  │  │  ├─ maxIterations │
   └──────────┘  │  ├─ contextWindow │
                 │  ├─ model         │
                 │  └─ _runtimeVars  │
                 └──────────────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼              ▼              ▼
   ┌──────────┐  ┌──────────┐  ┌──────────────┐
   │ Runner   │  │Consolidator│ │SubagentManager│
   │ setProvider│ │setProvider│ │ setProvider   │
   └──────────┘  └──────────┘  └──────────────┘

        自我控制（独立于自我认知）
                 │
                 ▼
          ┌──────────────┐
          │AbortController│
          │ cancelSession │
          └──────────────┘
```

`my` 工具让 Agent 知道自己在哪、能做什么、还剩多少空间。`RuntimeState` 定义了暴露什么、隐藏什么。`AbortController` 让外部能中断 Agent——不依赖 Agent 的合作。

这三个组件共享一个设计哲学：**暴露接口，约束能力**。Agent 能看很多东西，但只能改三个经过严格校验的参数。外部能取消任何任务，但不能修改 Agent 的内部状态。

---

## 28.7 一个真实的使用场景

用户在处理一个复杂重构任务，Agent 已经跑了 40 轮迭代：

```text
Agent: [调用 my.check()]
Agent: 当前状态:
  model: deepseek-v4-flash
  max_iterations: 50
  current_iteration: 40
  context_window_tokens: 128000
  running_subagents: 2

Agent: 我还有 10 轮迭代。这个重构可能需要更多轮，让我延长上限。
Agent: [调用 my.set({ key: 'maxIterations', value: 70 })]

Agent: 上限已提高到 70 轮。继续重构。
```

这个场景里，Agent 没有等待用户手动调整配置——它**自己发现**了潜在问题（迭代即将耗尽），**自己决定**了解决方案（延长上限），**在安全边界内**执行（最多 100 轮）。这就是自我认知的价值：Agent 不是被动的工具调用器，而是主动的任务管理者。

---

## 28.8 总结

| 组件 | 行数 | 职责 |
|------|------|------|
| `self.ts` | 96 | `my` 工具：check/set 操作 + 三层安全模型 |
| `runtime_state.ts` | 23 | `RuntimeState` 协议：Agent 暴露什么给自身 |
| `loop.ts` (self-related) | ~80 | `setRuntimeValue` + `_runtimeVars` + `cancelSession` + `_activeTasks` |

三个独特的设计决策：

1. **三层安全模型（BLOCKED / READ_ONLY / RESTRICTED）**——不是简单的"能看/不能看"，而是精确控制到字段级别。`bus` 不能看，`currentIteration` 能看不能改，`maxIterations` 能看能改但有范围。

2. **AgentLoop 即 RuntimeState**——没有单独的 "state manager" 对象。AgentLoop 本身就是 state，工具直接读它的属性。这避免了状态同步问题。

3. **`_runtimeVars` 便签簿**——一个 `Record<string, unknown>` 兜底。不在 RESTRICTED 里的 key 不会被拒绝，而是写入 scratchpad。这种扩展性意味着新参数不需要改 `self.ts` 的安全集合。

加上 `AbortController` 的硬中断取消机制——Agent 的自我认知与自我控制形成了完整的闭环。

> 这是 CatBuddy 技术专栏的最后一篇。从 Agent Loop 的双循环引擎，到 MessageBus 的脊椎神经，到 Skill/Tool/MCP 的能力系统，到 ContextBuilder 五层流水线，到 Dream/Consolidator 的记忆管道，到模型预设的故障转移链，再到 my 工具的自我认知——24 篇文章覆盖了 CatBuddy 36,000 行 TypeScript 中每一个有设计价值的部分。每篇文章都在问同一个问题：这块代码为什么这样写？换一种写法会怎样？答案都在代码里，也在这些文字里。
