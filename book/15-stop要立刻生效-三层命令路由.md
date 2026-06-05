# 14｜`/stop` 要立刻生效：三层命令路由

> 这是 CatBuddy 技术专栏的第 14 篇。上篇讲了 Agent Hook 生命周期扩展。这篇聊聊斜杠命令系统——`/stop`、`/model`、`/compact` 这些命令怎么在 Agent Loop 里被路由和执行的。

---

你试过对着 AI 助手输入 `/stop`，然后等了 30 秒才停止吗？

这很糟糕。用户输入 `/stop` 时通常是因为 Agent 在干一件错误的事——它可能在读一个 10MB 的日志文件，或者在无限循环工具调用。此时 `/stop` 必须在**毫秒级**响应，而不是等当前工具执行完。

CatBuddy 的命令系统用三层路由解决了这个问题——每层的响应优先级不同，最紧急的命令绕过一切队列直接执行。

---

## 14.1 三层路由：priority > exact > prefix

```typescript
class CommandRouter {
  private _priority = new Map<string, CommandHandler>()  // 第1层
  private _exact = new Map<string, CommandHandler>()     // 第2层
  private _prefix: Array<[string, CommandHandler]> = []   // 第3层
}
```

**第 1 层：priority（优先级命令）**
在 Agent Loop 的消息消费循环中，priority 命令**在会话锁（session lock）外处理**：

```typescript
// loop.ts
async run(): Promise<void> {
  while (this._running) {
    const msg = await this.bus.consumeInbound()

    // 优先命令在锁外处理 —— /stop 必须立即响应
    if (this.commands.isPriority(raw)) {
      const result = await this.commands.dispatchPriority(cmdCtx)
      if (result) await this.bus.publishOutbound(result)
      continue  // 不进入状态机
    }

    // 普通消息走完整状态机
    this._dispatch(msg).catch(...)
  }
}
```

目前唯一的 priority 命令是 `/stop`——取消当前会话的所有活跃任务。

**第 2 层：exact（精确匹配）**
在状态机的 COMMAND 阶段处理：

```typescript
router.exact("/new", cmdNew)       // 新建会话
router.exact("/status", cmdStatus) // 查看 Agent 状态
router.exact("/help", cmdHelp)     // 帮助信息
router.exact("/compact", cmdCompact) // 手动压缩上下文
router.exact("/dream", cmdDream)     // 触发记忆提取
router.exact("/heartbeat", cmdHeartbeat) // 触发心跳检查
```

**第 3 层：prefix（前缀匹配 + 最长前缀优先）**
带参数的命令：

```typescript
router.prefix("/model ", cmdModel)   // /model gpt-4o
router.prefix("/model", cmdModel)    // /model（无参，显示当前模型）
router.prefix("/history ", cmdHistory) // /history 10
router.prefix("/history", cmdHistory)  // /history（无参，显示全部）
```

关键设计：**按前缀长度降序排列**。`/model ` 比 `/model` 长，所以先匹配。这确保 `/model gpt-4o` 不会错误地被 `/model` 当作无参命令匹配。

---

## 14.2 命令在状态机中的位置

在 12 篇讲过的 Agent Loop 状态机中，COMMAND 是第三个状态：

```
RESTORE → COMPACT → COMMAND → BUILD → RUN → SAVE → RESPOND → DONE
                        │
                        ├── 匹配到命令 → DONE（跳过 LLM 调用）
                        └── 不是命令 → BUILD（继续走 LLM 流程）
```

```typescript
// loop.ts _state_command()
private async _state_command(ctx: TurnCtx): Promise<string> {
  const result = await this.commands.dispatch(cmdCtx)

  if (result !== null) {
    ctx.outbound = result
    return "shortcut"  // → DONE，跳过 LLM
  }

  return "dispatch"  // → BUILD，交给 LLM
}
```

这意味着命令的响应是**瞬时**的——不经过 LLM，不消耗 token，不走流式渲染。用户输入 `/status`，Agent 在 `_state_command` 里查一下当前模型、运行时间、活跃会话数，直接返回一条文本消息。

---

## 14.3 CommandLoopAPI：给命令处理器的受限访问

命令处理器需要访问 Agent 的内部状态（当前模型、会话管理、工具注册表）。但直接给处理器传入 `AgentLoop` 实例太危险——一个命令就能调用私有方法破坏状态。

CatBuddy 的解法是 `CommandLoopAPI`——一个只读接口：

```typescript
interface CommandLoopAPI {
  readonly model: string
  readonly modelPresets: Record<string, string>
  readonly uptime: number
  readonly activeSessionCount: number
  readonly workspace: string

  setModelPreset(name: string): void          // 允许修改
  cancelSession(sessionKey: string): Promise<number>  // 允许修改
  runDreamOnce(): Promise<string | null>       // 允许触发

  readonly sessions: { /* 只读查询接口 */ }
  readonly consolidator: { /* 只读接口 */ }
  readonly tools: { readonly toolNames: string[] }
}
```

有查有改——`setModelPreset` 可以切换模型，`cancelSession` 可以停止任务。但不会暴露 `_activeTasks` 的内部 Map，不会暴露状态机的私有方法。这是一种"最小权限原则"——命令处理器能做什么就给它什么，多的一点不给。

---

## 14.4 三个命令看设计哲学

### `/stop`：唯一的高优先级命令

```typescript
export async function cmdStop(ctx: CommandContext): Promise<OutboundMessage> {
  const total = await ctx.loop.cancelSession(ctx.sessionKey)
  return {
    content: total ? `Stopped ${total} task(s).` : "No active task to stop.",
    ...
  }
}
```

为什么 `/stop` 需要最高优先级？因为 `cancelSession` 调用 `AbortController.abort()`——它会触发 Agent Runner 的 `AbortSignal`，中止正在进行的 LLM 调用和工具执行。如果这个调用需要排队等当前工具执行完，那 `/stop` 就失去了"紧急刹车"的意义。

### `/model`：前缀匹配处理参数

```typescript
export function cmdModel(ctx: CommandContext): OutboundMessage {
  const presetName = ctx.args.trim()

  if (!presetName) {
    // 无参数 → 显示当前模型和可用预设
    return { content: `Current model: \`${loop.model}\`\nAvailable: ${presets}` }
  }

  if (loop.modelPresets[presetName]) {
    loop.setModelPreset(presetName)  // 切换模型
    return { content: `Model switched to: ${loop.model}` }
  }

  return { content: `Unknown preset: \`${presetName}\`` }
}
```

注意 `ctx.args`——这是 CommandRouter 在匹配到前缀后自动切出来的。用户输入 `/model gpt-4o`，Router 匹配到前缀 `/model ` 后，`ctx.args = "gpt-4o"`。命令处理器不需要自己解析参数。

### `/compact`：把状态机的自动压缩变成手动触发

```typescript
export async function cmdCompact(ctx: CommandContext): Promise<OutboundMessage> {
  const msgs = ctx.loop.sessions.getAllMessages(ctx.sessionKey, { maxMessages: 9999 })
  if (msgs.length <= KEEP_RECENT) {
    return { content: `消息不足：至少需要 ${KEEP_RECENT + 1} 条才会压缩` }
  }

  const summary = await ctx.loop.consolidator.compactIdleSession(
    ctx.sessionKey, KEEP_RECENT
  )
  return { content: `已压缩到 MEMORY.md。\n\n${summary.slice(0, 800)}` }
}
```

这和状态机里自动触发的 `_state_compact()` 逻辑完全一样，区别只是触发方式——一个是消息数超过阈值时自动执行，一个是用户主动下达命令。共享同一个 `Consolidator.compactIdleSession()`，不重复实现。

---

## 14.5 命令即函数，不是消息

这套命令系统有一个核心设计原则：**命令不是"发给 LLM 的消息"，命令是"对 Agent 引擎的直接调用"**。

这体现在两个地方：

1. **命令不影响对话历史**。输入 `/stop` 不会在 JSONL 里记录一条"用户发了 /stop"。命令被拦截在 COMMAND 状态中，直接短路到 DONE，不经过 BUILD → RUN → SAVE 的消息持久化路径。

2. **命令不占用上下文窗口**。每一条发给 LLM 的消息都要计 token。但命令走的是 Router → Handler → OutboundMessage 的路径，全程不调用 LLM，零 token 消耗。

---

## 如果重来一次

当前命令系统的局限：命令不支持异步长任务。如果 `/compact` 需要 30 秒（在大量历史消息时），用户会看到 30 秒的等待。理想情况下，命令应该立即返回一个"正在执行"的确认，然后异步完成。但这需要命令系统支持 outbound 消息的"状态更新"——先发一个 `content: "正在压缩..."`，压缩完成后再发 `content: "已压缩"`。目前的返回模型是 `OutboundMessage` 单次返回，不支持这种模式。

另一个潜在需求：**命令中间件**。目前的命令处理器是纯函数，如果你想在所有命令执行前做统一的权限检查或日志记录，只能手动在每个处理器里加代码。如果在 Router 上支持 before/after 拦截器，会更加灵活——但这又回到了 Hook 那一篇讨论的"扩展点设计"问题。

---

> **这篇讲了什么？**
>
> 1. 命令系统有三层路由：priority（`/stop`，会话锁外处理）、exact（`/new`、`/status` 等，精确匹配）、prefix（`/model`、`/history`，支持参数，最长前缀优先）。
> 2. 命令在状态机的 COMMAND 状态被拦截——匹配到则直接返回 DONE，跳过 LLM 调用。不消耗 token，不写入对话历史。
> 3. 命令处理器通过 `CommandLoopAPI` 访问 Agent 内部状态——最小权限原则，只暴露命令真正需要的 API，不暴露内部实现细节。

> 下一篇聊 CatBuddy 的文件编辑工具——`write_file`、`edit_file` 怎么实现安全、可撤销的文件操作？
