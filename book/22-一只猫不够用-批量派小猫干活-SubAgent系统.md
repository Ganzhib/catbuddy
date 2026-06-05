# 21｜一只猫不够用？批量派小猫干活：Sub-Agent 系统

> 这是 CatBuddy 技术专栏的第 21 篇。上篇讲了 Prompt 工程——怎么让 AI 画架构图。这篇回到 Agent 引擎本身：一个 Agent 不够用的时候，怎么创建子 Agent 帮你并行干活。

> **核心问题**：主 Agent 遇到复杂任务（同时搜索多个资料、批量处理文件、多个独立子任务），怎么把工作分派出去？子 Agent 是怎么创建的？并发上限怎么控制？结果怎么通知回来？

---

你有没有遇到过这种场景：

你让 CatBuddy 同时在 GitHub 上搜三个仓库的 README，对比它们的设计思路。主 Agent 开始一个一个地搜——搜完 repo A，搜 repo B，搜完 repo B，搜 repo C。

每个搜索要调 3-4 次工具，三次搜索加起来十几步迭代。LLM 的上下文里塞满了中间结果，等你看到对比总结的时候，已经过了两分钟。

然后你想：**"它就不能三路同时搜吗？"**

能。这就是 Sub-Agent 系统。

---

## 21.1 为什么需要子 Agent

单个 Agent 有两个根本性限制：

**一是串行瓶颈。** Agent Loop 的每一轮迭代——LLM 思考 → 调工具 → LLM 再思考 → 再调工具——是严格顺序执行的。哪怕三个子任务完全独立，主 Agent 也只能一个一个来。

**二是上下文污染。** 每个子任务的工具调用结果（grep 输出 8000 字符、web_search 返回一堆链接、read_file 返回整个文件）全塞在同一个消息数组里。三个任务混在一起，LLM 很难分清"这段输出属于哪个任务"。

子 Agent 解决的就是这两个问题：**独立上下文 + 并行执行。**

每个子 Agent 有自己的 AgentRunner 实例、自己的消息数组、自己的 ToolRegistry。它像一个独立的小型 Agent Loop，只接收一个任务描述，执行完毕后返回最终结果。

从主 Agent 的视角看，调用 `spawn` 工具就像调任何一个工具——你给任务，它给结果。只不过这个"工具"背后是一个完整的 Agent 在运行。

---

## 21.2 SubagentManager：子 Agent 的"托管所"

整个子 Agent 系统的核心是 `SubagentManager`。它的职责可以用一句话概括：

> **接收主 Agent 的 `spawn` 调用 → 创建独立的 AgentRunner → 执行任务 → 把结果注入回主 Agent 的对话流。**

```typescript:50:83:apps/desktop/src/main/agent/subagent.ts
export class SubagentManager {
  readonly runner: AgentRunner
  private readonly _running = new Map<string, Promise<void>>()
  private readonly _statuses = new Map<string, SubagentStatus>()
  private readonly _sessionTasks = new Map<string, Set<string>>()
  maxConcurrentSubagents = 3

  constructor(
    private provider: LLMProvider,
    workspace: string,
    private readonly bus: MessageBus,
    private model: string,
    private readonly maxToolResultChars: number,
    private readonly maxIterations: number,
    restrictToWorkspace: boolean,
    templates: TemplateLoader,
    projectRoot?: string,
    catbuddyDir?: string,
  ) {
    this._workspace = workspace
    this._projectRoot = projectRoot ?? path.dirname(path.dirname(path.resolve(workspace)))
    this._catbuddyDir = catbuddyDir ?? path.join(this._projectRoot, '.catbuddy')
    this._restrictToWorkspace = restrictToWorkspace
    this.templates = templates
    this.runner = new AgentRunner(provider)
  }
```

三个关键数据结构：

| 数据结构 | 作用 |
|---------|------|
| `_running` | `Map<taskId, Promise>` — 跟踪所有正在运行的子 Agent，并发上限 3 |
| `_statuses` | `Map<taskId, SubagentStatus>` — 每个子 Agent 的实时状态（迭代次数、工具事件、错误） |
| `_sessionTasks` | `Map<sessionKey, Set<taskId>>` — 按会话分组，用于 `/stop` 时批量取消 |

`maxConcurrentSubagents = 3` 不是拍脑袋定的。更多的并发意味着更多的 LLM API 调用、更多的 token 消耗、更复杂的错误处理。3 是一个在"实用"和"可控"之间的平衡点——足够并行处理两三个独立子任务，又不会让错误面太大。

---

## 21.3 spawn：把子 Agent 伪装成一个工具

主 Agent 怎么创建子 Agent？它调用一个和 `grep`、`read_file` 看起来一模一样的工具——`spawn`。

```typescript:18:51:apps/desktop/src/main/agent/tools/spawn.ts
export function createSpawnTool(
  manager: SubagentManager,
  getContext: () => SpawnContext,
): Tool {
  return {
    name: 'spawn',
    definition: {
      type: 'function',
      function: {
        name: 'spawn',
        description:
          'Spawn a subagent to handle a task in the background. '
          + 'Use for complex or time-consuming tasks that can run independently.',
        parameters: {
          type: 'object',
          properties: {
            task: { type: 'string', description: 'The task for the subagent to complete' },
            label: { type: 'string', description: 'Optional short label' },
            temperature: { type: 'number', description: 'Optional sampling temperature' },
          },
          required: ['task'],
        },
      },
    },
    execute: async (call) => {
      const { task, label, temperature } = call.arguments as Record<string, unknown>
      const ctx = getContext()
      return manager.spawn({
        task: String(task),
        label: label != null ? String(label) : null,
        originChannel: ctx.originChannel,
        originChatId: ctx.originChatId,
        sessionKey: ctx.sessionKey,
        temperature: temperature != null ? Number(temperature) : undefined,
      })
    },
  }
}
```

注意它的 `description` 里写的是 "in the background"——这是关键。主 Agent 调用 `spawn` 后**立即拿到一个确认消息**（"Subagent [label] started"），然后可以继续干别的事。子 Agent 在后台跑，跑完了通过 MessageBus 把结果推回来。

这意味着主 Agent 可以这样用：

```
用户：帮我看看这三个开源项目的架构设计
Agent：
  1. spawn("分析项目A的架构", label="分析A")
  2. spawn("分析项目B的架构", label="分析B")  
  3. spawn("分析项目C的架构", label="分析C")
  4. [等待...]
  5. 三个子Agent结果回来后，综合对比
```

三个分析同时跑，而不是一个一个来。这就是子 Agent 的核心价值。

---

## 21.4 子 Agent 的内脏：独立的 Runner + ToolRegistry

每个子 Agent 不是简单复用主 Agent 的上下文。它有自己的完整运行环境：

```typescript:183:220:apps/desktop/src/main/agent/subagent.ts
  private async _runSubagent(
    taskId: string,
    task: string,
    label: string,
    origin: { channel: string; chatId: string; sessionKey: string },
    status: SubagentStatus,
    temperature?: number,
  ): Promise<void> {
    try {
      const tools = this._buildTools()
      const fileStates = new FileStates()
      const subagentSystem = this.templates.renderSubagentSystem({
        timeCtx: `Current time: ${new Date().toISOString()}`,
        workspace: this._projectRoot,
      })
      const context: Context = {
        system: subagentSystem,
        messages: [{ role: 'user', content: task }],
        metadata: {},
      }

      const result = await runWithFileStates(fileStates, () =>
        this.runner.run({
          context,
          tools,
          model: this.model,
          maxIterations: this.maxIterations,
          maxToolResultChars: this.maxToolResultChars,
          concurrentTools: true,
          workspace: this.workspace,
          sessionKey: origin.sessionKey,
          contextWindowTokens: 128_000,
          providerRetryMode: 'standard',
          temperature,
          hook: new SubagentHook(status),
          maxIterationsMessage: this.templates.renderMaxIterationsMessage(this.maxIterations),
        }),
      )
      // ...
```

子 Agent 的环境和主 Agent 有三点关键区别：

**1. 精简的 System Prompt。** 主 Agent 的 System Prompt 包含了用户画像、项目上下文、Skill 清单等信息，可能有几千个 token。子 Agent 只需要一个极简的 System Prompt——当前时间 + 工作目录——因为它的任务单一且明确。

**2. 受限的工具集。** `_buildTools()` 注册了所有内置工具，但**排除了 `generate_image`**。子 Agent 不需要生成图片的能力——它的任务是搜索、读文件、执行分析，这些工具就够了。排除不必要的工具还能减少 tool definition 消耗的 token。

**3. 独立的 FileStates。** 每个子 Agent 有自己的 `FileStates` 实例（基于 `AsyncLocalStorage`），文件读取的去重和缓存不会和主 Agent 或其他子 Agent 混淆。

---

## 21.5 并发控制：最多三只小猫同时干活

`spawn()` 方法的第一行就是并发检查：

```typescript:131:137:apps/desktop/src/main/agent/subagent.ts
  async spawn(opts: { ... }): Promise<string> {
    if (this.getRunningCount() >= this.maxConcurrentSubagents) {
      return (
        `Cannot spawn subagent: concurrency limit reached `
        + `(${this.getRunningCount()}/${this.maxConcurrentSubagents} running).`
      )
    }
```

如果已经有 3 个子 Agent 在跑，`spawn` 不会阻塞等待——它直接返回一条错误消息。这个设计决策很重要：

**为什么不等？** 因为 `spawn` 在主 Agent 的 tool-call 流程里执行。如果 `spawn` 阻塞了，整个 Agent Loop 就停了。主 Agent 会看到"并发已满"的错误消息，然后自己决定是等一等再 `spawn`，还是换个策略。

这又回到了 Agent 设计的核心哲学：**把决策权留给 LLM，代码只负责诚实地报告状态。**

`finally` 块的清理也很细致：

```typescript:170:178:apps/desktop/src/main/agent/subagent.ts
    void runPromise.finally(() => {
      this._running.delete(taskId)
      this._statuses.delete(taskId)
      if (opts.sessionKey) {
        const ids = this._sessionTasks.get(opts.sessionKey)
        ids?.delete(taskId)
        if (ids && ids.size === 0) this._sessionTasks.delete(opts.sessionKey)
      }
    })
```

无论子 Agent 正常完成还是崩溃，`_running`、`_statuses`、`_sessionTasks` 三个 Map 都会被清理干净。不会出现子 Agent 死了但"尸体"还占着并发名额的情况。

---

## 21.6 结果通知：通过 MessageBus 注入对话流

子 Agent 跑完了，结果怎么回到主 Agent 的对话里？

```typescript:241:271:apps/desktop/src/main/agent/subagent.ts
  private async _announceResult(
    taskId: string,
    label: string,
    task: string,
    result: string,
    origin: { channel: string; chatId: string; sessionKey: string },
    status: 'ok' | 'error',
  ): Promise<void> {
    const statusText = status === 'ok' ? 'completed successfully' : 'failed'
    const content = this.templates.renderSubagentAnnounce({
      label,
      statusText,
      task,
      result,
    })

    const msg: InboundMessage = {
      channel: 'system',
      senderId: 'subagent',
      chatId: `${origin.channel}:${origin.chatId}`,
      content,
      timestamp: Date.now(),
      media: [],
      sessionKeyOverride: origin.sessionKey,
      metadata: {
        injected_event: 'subagent_result',
        subagent_task_id: taskId,
      },
    }
    this.bus.publishInbound(msg)
  }
```

它不走 Agent Loop 的正常响应路径——因为子 Agent 跑完的时候，主 Agent 可能正在做别的事，甚至可能处于 IDLE 状态。

它走的是 `MessageBus.publishInbound()`——我们在第 18 篇详细拆解过这个 97 行的单消费者阻塞队列。这里回顾一下关键点：Bus 的入站侧有四种生产者（IPC 处理器、Heartbeat 定时器、Sub-Agent 管理器、Gateway Desktop Client），但只有一个消费者——`AgentLoop.run()` 的 `while` 循环。子 Agent 把结果包装成一条 `InboundMessage`（channel 是 `'system'`，sender 是 `'subagent'`），`publishInbound` 后——如果 AgentLoop 正在空闲等待，就直接 resolve 那个等待中的 Promise；如果 AgentLoop 正在忙，消息进入 `_inbound` 数组排队。无论哪种情况，它最终都会作为下一条 `consumeInbound()` 的返回值，被主 Agent 读到。

`metadata.injected_event: 'subagent_result'` 这个标记让前端可以区分"用户发的消息"和"子 Agent 注入的结果"，在 UI 上做差异化展示（比如一个特殊的卡片样式）。

---

## 21.7 SubagentHook：10 行代码的监控

回顾一下之前 Hook 章节提到的 `SubagentHook`——它实际上只有 10 行有效代码：

```typescript:30:48:apps/desktop/src/main/agent/subagent.ts
class SubagentHook extends AgentHook {
  constructor(
    private readonly status: SubagentStatus,
  ) {
    super()
  }

  override async beforeExecuteTools(context: AgentHookContext): Promise<void> {
    for (const tc of context.toolCalls) {
      console.debug(`[Subagent ${this.status.taskId}] tool: ${tc.name}`)
    }
  }

  override async afterIteration(context: AgentHookContext): Promise<void> {
    this.status.iteration = context.iteration
    this.status.toolEvents = [...context.toolEvents]
    if (context.error) this.status.error = context.error
  }
}
```

它的价值不在于代码量，而在于它证明了 Hook 系统的设计是对的——**9 个 Hook 插槽，子 Agent 只需要用 2 个。** 不需要侵入 AgentRunner 代码，不需要在核心循环里加 `if (isSubagent)` 判断。

`afterIteration` 把每一轮迭代的状态同步回 `SubagentStatus` 对象。这意味着外部代码（比如 UI）可以随时读取 `_statuses` Map，知道每个子 Agent 当前在第几轮、调了什么工具、有没有报错。不需要等子 Agent 跑完才知道状态。

---

## 21.8 cancelBySession：`/stop` 也管子 Agent

`/stop` 命令取消主 Agent 的同时，也应该取消它派出去的子 Agent。`cancelBySession` 做的事情很简单：

```typescript:273:281:apps/desktop/src/main/agent/subagent.ts
  cancelBySession(sessionKey: string): number {
    const ids = this._sessionTasks.get(sessionKey)
    if (!ids) return 0
    let n = 0
    for (const id of ids) {
      if (this._running.has(id)) n += 1
    }
    return n
  }
```

注意它**只返回数量，不实际取消**。真正的取消发生在 Agent Loop 的 `/stop` 处理流程中——`cancelSession()` 会遍历所有活跃的 `AbortController`，逐个 `abort()`。子 Agent 的 `AgentRunner.run()` 也接收 `abortSignal`，LLM 调用检查到信号后会立刻返回 `stopReason='cancelled'`。

---

## 21.9 总结

> **这篇讲了什么？**
>
> 1. **Sub-Agent 的设计动机**：单个 Agent 面临串行瓶颈和上下文污染。子 Agent 通过独立上下文 + 并行执行解决这两个问题。
>
> 2. **SubagentManager 架构**：三个核心数据结构——`_running`（并发追踪）、`_statuses`（实时状态）、`_sessionTasks`（会话分组）。每个子 Agent 有独立的 AgentRunner + ToolRegistry + FileStates，和主 Agent 完全隔离。
>
> 3. **spawn 工具设计**：把子 Agent 伪装成一个普通工具——主 Agent 调用 `spawn(task, label)`，立即拿到确认消息。子 Agent 在后台执行，完成后通过 `MessageBus.publishInbound()` 注入结果。并发上限 3，超限直接报错不阻塞。
>
> 4. **Hook 监控**：SubagentHook 只用了 9 个 Hook 插槽中的 2 个（`beforeExecuteTools` + `afterIteration`），10 行代码实现了实时状态同步。这验证了 Hook 系统的设计——不侵入核心代码就能扩展。
>
> 5. **生命周期管理**：`finally` 保证资源清理，`cancelBySession` 支持 `/stop` 时批量取消子 Agent。

> 下一篇聊 Agent 的错误处理与自愈——LLM 调用失败了怎么办？工具执行报错了怎么办？整个 Agent 怎么优雅降级而不是崩溃？三层重试 + Fallback 链 + 可观测性 Logger 是如何协同工作的？
