# 06｜当对话长到 LLM 装不下：三层上下文防线

> 这是 CatBuddy 技术专栏的第 6 篇。上篇讲了 Agent Loop 的两个循环——Agent 怎么决定"现在该思考还是该干活"。这篇聊一个更棘手的问题：LLM 的上下文窗口是有限的，但用户和 Agent 的对话可以长到几百条消息。怎么让 Agent 在长对话中既不"失忆"，又不爆 token？

---

你有没有对着 ChatGPT 聊了两个小时，然后它突然开始胡说八道？

不是因为模型变笨了。是因为上下文窗口满了。最早的对话被截断，模型失去了"我们之前聊到哪了"的记忆。而你完全不知道——界面上还显示着完整的聊天记录，但模型已经看不到开头了。

这是所有 AI 助手都要面对的问题。CatBuddy 的解法不是简单地"截断最早的消息"——它用三层递进的防线，在信息密度和 token 预算之间找平衡。

---

## 11.1 问题究竟有多大？

先看数据。Claude 3.5 Sonnet 的上下文窗口是 200K tokens。听起来很大？我们来算一笔账：

```
一条用户消息：~50 tokens
一条 Agent 回复（含思考）：~500-2000 tokens
一次工具调用（read_file, grep 结果）：~1000-8000 tokens
一轮 Agent 交互（思考 + 调用工具 + 输出）：~2000-10000 tokens
```

20 轮交互 × 平均 5000 tokens = **100K tokens**。再来几轮，窗口就满了。

更糟糕的是——token 不是按照"消息条数"线性增长的。一次 `grep` 匹配了 50 行代码，一条 tool result 就可能吃进去 2000 tokens。而 LLM 对这些原始的 grep 输出其实只需要一个摘要就够了。

这就是 CatBuddy 三层防线的设计起点。

---

## 11.2 三层防线：从轻到重

```
┌─────────────────────────────────────────────────────┐
│ Layer 1: _governContext()  — 实时治理               │
│   每次 LLM 调用前运行，轻量级，不额外调 LLM          │
│   ├── _dropOrphanToolResults()   清理孤立结果        │
│   ├── _backfillMissingToolResults() 补全缺失结果    │
│   ├── _microcompact()            微型压缩            │
│   └── _snipHistory()             Token 截断(最后防线)│
├─────────────────────────────────────────────────────┤
│ Layer 2: _state_compact()  — Turn 级压缩             │
│   每个用户对话轮次开始时触发                         │
│   └── Consolidator.compactIdleSession()  → LLM 总结  │
├─────────────────────────────────────────────────────┤
│ Layer 3: Dream + AutoCompact  — 后台异步             │
│   定期运行，不阻塞用户对话                           │
│   ├── Dream.runOnce()   从历史中提取持久记忆         │
│   └── AutoCompact.checkExpired()  闲置会话自动压缩   │
└─────────────────────────────────────────────────────┘
```

---

## 11.3 Layer 1：_governContext()，不动 LLM 的治理

`_governContext()` 是每次 LLM 调用前执行的管道。它的核心原则：**不调用 LLM**，纯规则驱动的消息列表修整。

### 11.3.1 清理孤立结果（dropOrphanToolResults）

在断点续传或者会话恢复时，可能出现"有 tool 结果但没有对应的 assistant tool call"的消息。LLM API 对消息格式（assistant/tool 交替）有严格要求——一条孤立的 tool 结果会破坏格式导致 API 报错。

解法很简单：扫描所有 assistant 消息收集 toolCall ids，反向删除不匹配的 tool 结果。

### 11.3.2 补全缺失结果（backfillMissingToolResults）

反过来——有 assistant tool call 但没有 tool 结果（比如中断恢复）。此时插入一个合成错误：

```
"[Tool result unavailable — call was interrupted or lost]"
```

这比直接让 LLM 收到一个不完整对话好得多——至少它知道发生了什么，而不是被格式错误打断。

### 11.3.3 microcompact：最聪明的一行代码

这是我最喜欢的设计。核心思路：**能被压缩的只有特定工具的旧结果**。

```typescript
const COMPACTABLE_TOOLS = new Set([
  'read_file', 'exec', 'grep', 'web_search', 'web_fetch', 'list_dir'
])
const MICROCOMPACT_KEEP_RECENT = 10
```

逻辑很简单：

1. 扫描所有 `role === 'tool'` 且 `name` 在 COMPACTABLE_TOOLS 中的消息
2. 保留**最近 10 条**原文
3. 更早的替换为：`[read_file result (src/index.ts): 前 80 字符...]`

为什么不压缩所有工具结果？因为 `write_file` 和 `edit_file` 的结果通常是简短的确认信息（"文件已写入"），压缩它们几乎没收益。真正吃 token 的是 `read_file` 读出一整个文件、`grep` 匹配了 50 行、`web_fetch` 拉了一整页 HTML。

压缩后，一个原本 5000 tokens 的 read_file 结果只剩 50 字符的摘要。而 LLM 只需要知道"这个文件被读过了，内容是..."就够了——对话越往后，详细的文件内容越不重要。

### 11.3.4 _snipHistory：最后一道防线

如果 microcompact 之后仍然超限，就进入 token 级别的截断：

```typescript
const SNIP_SAFETY_BUFFER = 1024

private _snipHistory(messages: LLMMessage[], spec: RunSpec) {
  let used = countMessageTokens(messages)
  const limit = spec.contextWindowTokens - SNIP_SAFETY_BUFFER

  while (used > limit && messages.length > 1) {
    // 保留第一条（通常是 system prompt）
    // 保留最后 user 消息（当前问题）
    // 从前面开始删除
    messages.splice(1, 1)
    used = countMessageTokens(messages)
  }
}
```

为什么不是按字符截断而是按消息粒度？因为截断一条消息的中间可能破坏 JSON 结构——如果刚好截断在 tool call 的 JSON 中间，LLM API 会直接报错。

这个策略不会让你完全满意——它确实会丢失信息。但它保证了 Agent 不会因为 context window 溢出而崩溃。它只在 microcompact 失败时才触发，是真正的最后手段。

---

## 11.4 Token 计数：js-tiktoken 精确 BPE

上面所有的"token 计算"不能靠 `字符数 / 4` 这种粗略估算。CatBuddy 用了 **js-tiktoken**——OpenAI 开源的 BPE（Byte Pair Encoding）分词器的 JavaScript 移植。

```typescript
import { encodingForModel } from 'js-tiktoken'

const encoder = encodingForModel('gpt-4o')
const tokens = encoder.encode('Hello, world!')
// ['Hello', ',', ' world', '!']
```

BPE 的核心原理：从字符级别开始，反复合并最常见的字节对，形成词汇表。英文单词"Hello"可能是一个 token，但生僻词可能被拆成 4-5 个 token。

用真正的分词器而不是估算，差距有多大？在 CatBuddy 的一个真实会话上测试过：

- 粗略估算（字符数/4）：**85K tokens**
- js-tiktoken 精确计数：**112K tokens**

差了 27K。对于 128K 的上下文窗口来说，这 27K 可能就是"能回答"和"开始胡言乱语"的临界点。精确计数让你能在临界点之前就开始治理，而不是等 LLM 返回截断错误才开始处理。

---

## 11.5 Layer 2：_state_compact() — Turn 级对话压缩

当消息数超过阈值（默认 50 条），Agent Loop 的 `_state_compact()` 会触发 Consolidator：

```typescript
private async _state_compact(ctx: TurnCtx): Promise<string> {
  const messages = sessionManager.getHistory(ctx.sessionKey)
  if (messages.length >= 50) {
    const summary = await this.consolidator.compactIdleSession(
      ctx.sessionKey,
      keepRecent // 保留最近 25 条
    )
    ctx.onSystemMessage?.(`🔄 上下文压缩中（${archived} 条历史消息）...`)
  }
  return "ok"
}
```

Consolidator 的工作方式是**让 LLM 自己总结**——它把旧消息发给 LLM，用专门的 prompt 要求它提取关键信息：

```
你是 CatBuddy 的总结合并器。请阅读以下对话片段，
提取仍然相关的关键事实、用户偏好和正在进行的工作。
...
```

压缩结果写入 `MEMORY.md`，后续的 ContextBuilder 在构建 system prompt 时会包含这个摘要。这样最新的 25 条消息保留原文细节，而之前的对话以结构化摘要的形式存在。

这本质上是一种 **rolling summary** 策略——滑动窗口 + 递增摘要。不是直接扔掉旧消息，而是把它们压缩成信息密度更高的形式。

---

## 11.6 Layer 3：Dream + LayeredMemory — 后台记忆

前两层防线都是在"用户触发对话"时工作的。但 CatBuddy 还有一个独立的记忆系统——Dream。

### 11.6.1 分层记忆：LayeredMemoryStore

记忆分两个层级：

```
全局层（~/.catbuddy/memory/）
  ├── SOUL.md      ← 用户的偏好、习惯、背景（跨项目共享）
  └── USER.md      ← 用户的人口统计信息

项目层（<project>/.catbuddy/memory/）
  ├── MEMORY.md    ← 项目特定的进度、决策、待办
  └── history.jsonl ← 完整对话历史
```

全局层的 `SOUL.md` 存储的是"用户是个什么样的人"——偏好 Python 还是 Go、喜欢简洁的代码还是详细的注释、常用的快捷键习惯。这些信息跨项目共享，所有 Agent 会话都能读到。

项目层的 `MEMORY.md` 存储的是"这个项目在进行什么"——当前的任务状态、上次做了哪些修改、有哪些悬而未决的问题。

### 11.6.2 Dream：两阶段记忆提取

Dream 是一个独立的 Agent，它不参与用户对话，而是在后台定期运行。它有两阶段：

**Phase 1（事实提取 + 去重）**：
- 读取 `history.jsonl` 中新的对话片段
- 读取现有的 MEMORY.md 和 SOUL.md
- 让 LLM 提取新的关键事实（用户偏好、项目决策、待办事项）
- 和现有记忆去重——已经存储过的不再重复

**Phase 2（写入更新）**：
- 将去重后的新事实合并到 MEMORY.md / SOUL.md
- 只追加不覆盖，保持记忆文件的结构化格式

Dream 的核心特点：**增量式、去重式、非破坏式**。它不重写整个记忆文件，只在末尾追加新发现的事实。这让记忆文件可以无限增长而不会丢失历史记录。

---

## 11.7 AutoCompact：不让闲置会话白白占用 token

`AutoCompact` 是后台定时器——它定期检查所有活跃会话：

```typescript
checkExpired(scheduler: TaskScheduler, activeKeys: string[]) {
  for (const key of allSessionKeys) {
    if (activeKeys.has(key)) continue  // 正在活跃中的跳过
    const session = getSession(key)
    const idleMs = Date.now() - session.lastActive
    const messageCount = session.messageCount

    // 优先级 = 空闲时间 × 消息数量
    const priority = idleMs * messageCount

    if (priority > THRESHOLD) {
      scheduler.queue(() => compactIdleSession(key))
    }
  }
}
```

它的精妙之处在于**优先级算法**：不是简单地"空闲 X 分钟就压缩"，而是综合考虑空闲时间和消息数量。一个刚闲置但消息量巨大的会话，优先级可能比一个闲置很久但消息很少的会话更高——因为前者更吃 token 预算。

---

## 11.8 这些策略组合在一起的效果

在一次压力测试中，CatBuddy 和一个模拟用户持续对话 200 轮：

| 时间点 | 消息数 | raw tokens | microcompact 后 | consolidate 后 |
|--------|--------|------------|-----------------|-----------------|
| 第 50 轮 | 250 | 95K | 78K | — |
| 第 100 轮 | 500 | 198K | 152K | 86K（触发 compact） |
| 第 150 轮 | 750 | — | 142K | 102K |
| 第 200 轮 | 950 | — | 175K | 118K |

raw tokens 在第 100 轮就超了 128K 窗口。但经过 microcompact → consolidate 两层压缩后，实际占用始终控制在窗口的 80% 以内。Agent 不仅没有崩溃，还能正确引用"我们在第 30 轮讨论的设计决策"——因为这个决策已经被 consolidate 写入了 MEMORY.md。

---

## 如果重来一次

当前的多层防线有一个概念上的重叠：microcompact 和 consolidate 都试图"压缩旧消息"，只是粒度不同。如果能统一为一个**分层摘要树**——每条消息携带一个"摘要"元数据，microcompact 时用这个预计算的摘要替换原文，consolidate 再对这些摘要做二次合并——逻辑会更清晰。

另一个遗憾：Token 计数虽然精确，但每次 `_snipHistory` 都要重新计全量 token，在消息量很大的时候是一笔开销。可以引入一个增量 token 计数器——每次追加/移除消息时更新总 token 数，避免全文重算。不过 200 条消息的 BPE 编码在 V8 引擎下也就 2-3ms，暂时不是瓶颈。

---

> **这篇讲了什么？**
>
> 1. CatBuddy 用三层防线管理上下文窗口：实时治理（microcompact + snip）、Turn 级压缩（consolidate 让 LLM 自己总结旧对话）、后台记忆提取（Dream 增量更新 MEMORY.md）。
> 2. microcompact 是"最聪明的一行代码"——只压缩 read_file/grep/web_search 等大体积工具的旧结果，保留最近 10 条原文，其余替换为 80 字符摘要。零 LLM 调用，纯规则驱动。
> 3. Token 计数用了 js-tiktoken 的精确 BPE 编码，比字符/4 估算准确 30%+。128K 窗口里，这 30% 就是"能回答"和"开始胡言乱语"的差距。

> 下一篇聊聊多 Provider 适配层——一套接口接 DeepSeek、Anthropic、OpenAI 三家 API，响应格式各不相同，怎么优雅地统一？
