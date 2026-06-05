# 08｜不修改核心代码，只插 Hook：Agent 生命周期扩展

> 这是 CatBuddy 技术专栏的第 8 篇。上篇讲了多 Provider 适配层如何用一套接口接三家 API。这篇聊聊 Agent Hook——在不修改 Agent Loop 核心代码的前提下，怎么插入自定义行为：日志、监控、调试、项目特定逻辑。

---

你有没有改过开源项目的核心代码，然后每次上游更新都要手动 merge 冲突？

CatBuddy 的 Agent Loop 是一个 1000+ 行的状态机。如果每加一个新功能就改一次状态机代码，不出三个月就会变成意大利面条。Hook 系统的设计目标很明确：**给 Agent 的每一次迭代提供"插槽"，让外部代码可以在不修改核心逻辑的前提下观察、干预、转换 Agent 行为。**

---

## 13.1 九个 Hook 插槽

AgentHook 定义了 9 个生命周期方法，覆盖了 Agent 一次迭代的完整流程：

```
一次 Agent 迭代：

  beforeIteration(ctx)        ← 进入迭代，读取上下文
    │
  [LLM 调用中]
  ├── onStream(ctx, delta)    ← 流式输出的每个 token
  ├── emitReasoning(text)     ← DeepSeek 推理输出的每个 chunk
  └── emitReasoningEnd()      ← 推理结束
    │
  [如果有工具调用]
  ├── beforeExecuteTools(ctx) ← 工具执行前，读取工具列表
  │   [执行工具...]
  └── afterIteration(ctx)     ← 工具执行完毕
    │
  [如果是最终回复]
  ├── finalizeContent(content)← 转换最终文本（同步）
  ├── afterIteration(ctx)     ← 最终迭代结束
  └── onStreamEnd(ctx)        ← 流完全结束
```

每个插槽都是可选的——默认实现（`new AgentHook()`）全是空操作，不影响性能。你只 override 你关心的那一个。

---

## 13.2 HookContext：携带完整状态

每个 Hook 方法都接收一个 `AgentHookContext` 对象：

```typescript
interface AgentHookContext {
  iteration: number            // 第几轮迭代
  messages: LLMMessage[]       // 完整对话历史
  response?: {                 // LLM 响应（afterIteration 时可读）
    content: string | null
    toolCalls: ToolCallRequest[]
    finishReason: string
    reasoningContent?: string
    usage: TokenUsage
  }
  usage: TokenUsage            // 累计 token 消耗
  toolCalls: ToolCallRequest[] // 本轮活跃的工具调用
  toolResults: string[]        // 本轮产生的工具结果
  toolEvents: ToolEvent[]      // 全部工具事件历史
  streamedContent: boolean     // 本轮是否有流式输出
  streamedReasoning: boolean   // 本轮是否有推理输出
  finalContent: string | null  // 最终回复（最终迭代时设置）
  stopReason: string | null    // 停止原因
  error: string | null         // 错误信息
}
```

不只是一个简单的状态标记。它携带了 Agent 整轮迭代的完整上下文——消息历史、工具调用链、token 消耗、流式标志。这让 Hook 可以做很有意义的事，比如基于当前对话状态决定下一步行为。

---

## 13.3 SubagentHook：唯一的真实实现

当前代码库里只有一个实际的 Hook 子类——SubagentHook。它用于 CatBuddy 的子代理系统：

```typescript
class SubagentHook extends AgentHook {
  constructor(private readonly status: SubagentStatus) { super() }

  // 记录每个工具调用，方便调试
  override async beforeExecuteTools(ctx: AgentHookContext): Promise<void> {
    for (const tc of ctx.toolCalls) {
      console.debug(`[Subagent ${this.status.taskId}] tool: ${tc.name}`)
    }
  }

  // 同步迭代状态到管理器
  override async afterIteration(ctx: AgentHookContext): Promise<void> {
    this.status.iteration = ctx.iteration
    this.status.toolEvents = [...ctx.toolEvents]
    if (ctx.error) this.status.error = ctx.error
  }
}
```

它只 override 了两个方法：
- `beforeExecuteTools`——打日志，让开发者知道子代理在执行什么工具
- `afterIteration`——把迭代状态（编号、工具事件、错误）同步回 SubagentManager，让管理器能追踪多个子代理的进度

这 10 行代码体现了 Hook 设计的精髓：**不需要知道 AgentRunner 内部怎么跑的，只需要在关键节点插入自己的逻辑。**

---

## 13.4 CompositeHook：把多个 Hook 串起来

有时候你需要不止一个 Hook——比如一个用来打日志，一个用来监控 token 消耗。CompositeHook 就是用来组合多个 Hook 的：

```typescript
class CompositeHook extends AgentHook {
  constructor(private children: AgentHook[]) { super() }

  // 任一子 Hook 想接收流式数据，就开启
  override wantsStreaming(): boolean {
    return this.children.some(h => h.wantsStreaming())
  }

  // 安全委托：子 Hook 出错不中断其他 Hook
  private async forEachHookSafe(
    fn: (h: AgentHook) => Promise<void>
  ): Promise<void> {
    for (const h of this.children) {
      try { await fn(h) }
      catch (err) {
        if (h.reraise) throw err
        console.error('[AgentHook] child error:', err)
      }
    }
  }

  // finalizeContent 走管道模式：每个 Hook 依次转换内容
  override finalizeContent(content: string | null): string | null {
    let result = content
    for (const h of this.children) {
      result = h.finalizeContent(result)
    }
    return result
  }
}
```

两个设计细节：
- **错误隔离**：子 Hook 出错默认不会影响其他子 Hook。但如果某个 Hook 的 `reraise` 设为 true（关键 Hook），异常会向上抛出——因为它的失败意味着系统状态不可靠。
- **链式转换**：`finalizeContent` 不走 forEach 模式，而是管道模式——Hook A 转换后传给 Hook B，类似 Express 中间件。

CompositeHook 目前还没有被实例化使用，但它的设计已经为"日志 Hook + 监控 Hook + 内容过滤 Hook"的组合准备好了。

---

## 13.5 Hook 和显式回调：两种扩展方式的分工

AgentRunner 有两套扩展机制：

| 机制 | 使用方式 | 适合什么 |
|------|----------|----------|
| **Hook** | `spec.hook` 传入 AgentHook 实例 | 观察性、干预性逻辑——日志、监控、状态同步 |
| **显式回调** | `spec.onStream`, `spec.onReasoning`, `spec.progressCallback` | 数据管道逻辑——把 LLM 输出推送到 UI |

为什么不用 Hook 替代所有显式回调？因为角色不同：
- **显式回调**是"用户层的接口"——`AgentRunner` 的使用者（`AgentLoop`）通过它把数据导流到 MessageBus，最终到达 UI。
- **Hook** 是"框架层的扩展点"——第三方或内部子系统通过它观察 Agent 内部状态，不影响主数据流。

如果 Hook 承载了所有流式输出，那每次加一个"日志 Hook"都会影响 UI 渲染的延迟。让 Hook 只做"轻量观察"，显式回调做"数据管道"，两者各司其职。

---

## 13.6 目前没在用但已经设计好的扩展点

Hook 系统有 9 个方法，SubagentHook 只用了 2 个。剩下的 7 个不是设计冗余——它们是给未来的需求留的"插座"：

**`wantsStreaming()` + `onStream()`**
当你想在 Hook 里分析 LLM 的实时输出（比如检测"Agent 是否在重复自己的话"，触发早期中断），可以 override 这两个方法。

**`finalizeContent()`**
当你想在 Agent 回复用户之前过一遍自定义的处理——比如自动翻译、敏感信息脱敏、注入项目特有的规则提醒——用这个方法比改 AgentRunner 安全得多。

**`beforeIteration()`**
当你想在每轮 LLM 调用之前检查条件——比如"累计 token 已经超过预算，强制终止"——不需要在 `_governContext()` 里加代码。

这些扩展点目前是"空插座"。但插座的存在本身就是架构意图——我知道未来会有东西要插进来，所以现在就把位置留好。

---

## 如果重来一次

Hook 系统的一个局限：Hook 方法都是 `async`，但它们是顺序执行的——每个 Hook 方法返回后，AgentRunner 才继续下一步。如果把 `beforeExecuteTools` 设计成可以返回一个 `Promise<boolean>`（返回 false 跳过工具执行），就能让 Hook 拥有"否决权"——不仅仅是观察，还能干预。不过这也引入了 Hook 的责任边界问题——如果 Hook 否决了工具执行，Agent 应该怎么应对？目前的"只观察不干预"其实是一种清晰的边界。

---

> **这篇讲了什么？**
>
> 1. AgentHook 提供了 9 个生命周期插槽，覆盖 Agent 一次迭代的完整流程——迭代前置、流式监听、推理监听、工具执行前置、迭代后置、内容转换、流结束。默认实现全是空操作。
> 2. AgentHookContext 携带了 Agent 迭代的完整状态——消息历史、工具调用链、token 消耗、错误信息。Hook 不需要知道 AgentRunner 内部实现就能做出有意义的决策。
> 3. CompositeHook 支持组合多个 Hook，带错误隔离和链式转换。显式回调和 Hook 各司其职——回调是"数据管道"，Hook 是"观察插槽"。

> 下一篇聊 MCP——Agent 有了大脑，还需要手脚。MCP 协议怎么让 Agent 读文件、跑命令、操作浏览器？为什么选 MCP 而不是自己定义一套工具接口？
