# Token 精确计数与上下文治理：js-tiktoken 的四步自愈算法

第 06 章我们讲了三层上下文防线——Hook 防注入、Token 预算检查、ContextBuilder。那是**宏观策略**：当上下文快爆了怎么办。这一章把镜头推到**微观**：AgentLoop 每轮迭代调用 LLM 前，消息数组到底怎么被精确测量、整理、裁切到可控范围？

CatBuddy 的答案在两个地方：`token-counter.ts`（150 行精确 BPE 分词引擎）和 `AgentRunner._governContext()`（4 步治理管道）。两段加起来不过 250 行，但每行都有精确的工程意图。

---

## 26.1 BPE 分词入门：为什么"4 字符 = 1 token"是错的？

在聊 CatBuddy 怎么计数之前，先说说为什么不用 `text.length / 4`。

中文和英文的 token 密度完全不同：

```text
"Hello world"        → 2 tokens（英文约 4 字符/token）
"你好世界"           → 8 tokens（中文约 1.5 字符/token）
"print('hello')"     → ~5 tokens（代码更密）
```

**BPE（Byte Pair Encoding）**是 GPT 系列使用的分词算法。它的核心思想：从字节开始，反复合并最高频的相邻对，形成子词（subword）词表。`"unbelievable"` 可能被切为 `["un", "believ", "able"]`，`"你好"` 可能每个汉字一个 token。

不同模型用不同的编码：

| 模型系列 | 编码名 | 说明 |
|---------|--------|------|
| GPT-4 / GPT-3.5 / text-embedding | `cl100k_base` | 100K 词表，当前最通用 |
| GPT-4o / GPT-4o-mini | `o200k_base` | 200K 词表，更高效 |
| text-davinci-003 | `p50k_base` | 旧版，已很少用 |

Claude 系列没有公开 tokenizer，但实践中 `cl100k_base` 的误差 < 5%，CatBuddy 直接用它近似。

---

## 26.2 `token-counter.ts`：150 行精确计数引擎

### 26.2.1 编码选择：一行 switch 决定行为正确性

```ts
// apps/desktop/src/main/agent/token-counter.ts
export function getEncodingForModel(model: string): TiktokenEncoding {
  const m = model.toLowerCase()
  if (m.includes('gpt-4o')) return 'o200k_base'     // GPT-4o 新编码
  return 'cl100k_base'                               // GPT-4 / Claude / DeepSeek 通用
}
```

注意：DeepSeek 虽然有自己的分词器，但 `cl100k_base` 的 BPE 合并逻辑与 DeepSeek 高度相似。CatBuddy 的立场是"宁可稍微高估，绝不低估"——因为高估会导致过早截断（功能降级），低估会导致超出上下文窗口（API 报错）。

### 26.2.2 单条消息的 Token 计数：OpenAI Cookbook 规范

```ts
export function countMessageTokens(msg: LLMMessage, encoding): number {
  const MESSAGE_OVERHEAD = 4  // role + 分隔符固定开销
  let total = MESSAGE_OVERHEAD

  // content tokens
  if (typeof msg.content === 'string') {
    total += encoder.encode(msg.content).length
  } else if (Array.isArray(msg.content)) {
    // 多模态 content 数组（支持 image_url 混合）
    for (const part of msg.content) {
      if ('text' in part) total += encoder.encode(String(part.text)).length
    }
  }

  // name 字段
  if (msg.name) total += encoder.encode(msg.name).length

  // tool_calls 参数（函数名 + JSON 参数体）
  if (msg.toolCalls) {
    for (const tc of msg.toolCalls) {
      total += encoder.encode(tc.name).length
      const argsStr = typeof tc.arguments === 'string'
        ? tc.arguments : JSON.stringify(tc.arguments)
      total += encoder.encode(argsStr).length
    }
  }
  return total
}
```

这里的 `MESSAGE_OVERHEAD = 4` 来源是 OpenAI Cookbook 的 [How to count tokens with tiktoken](https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb)。每条消息的 ChatML 格式包含 `<|im_start|>role\ncontent<|im_end|>` 这样的标记，约 4 个 token。

重要的是多模态 content 数组分支：当消息包含图片时，`content` 不是字符串而是 `[{type:'text', text:'...'}, {type:'image_url', ...}]`，计时只计文本部分。

### 26.2.3 批量计算与安全回退

```ts
// 批量消息 + 回复 priming（约 3 tokens）
export function countMessagesTokens(messages: LLMMessage[], model?: string): number {
  const encoding = model ? getEncodingForModel(model) : 'cl100k_base'
  let total = 0
  for (const msg of messages) total += countMessageTokens(msg, encoding)
  return total + 3  // PRIMING_OVERHEAD
}

// 安全回退：js-tiktoken 初始化失败时 → Math.ceil(text.length / 3)
export function safeCountTokens(text: string): number {
  try {
    return countTokens(text)
  } catch {
    return Math.ceil(text.length / 3)  // 英文 ~4，中文 ~1.5，加权 ~3
  }
}
```

`PRIMING_OVERHEAD = 3` 对应 API 中引导模型开始回复的语法开销（如 `<|im_start|>assistant`）。

`safeCountTokens` 是最后的保险：如果 `js-tiktoken` 在受限 WASM 环境（如某些 Electron 沙箱配置）初始化失败，回退到 `/ 3` 的粗略估算。这种**优雅降级**在 CatBuddy 的各个层面反复出现——功能有边界，但系统不崩溃。

### 26.2.4 Encoder 缓存

```ts
const encoderCache = new Map<TiktokenEncoding, Tiktoken>()

function getEncoder(encodingName: TiktokenEncoding): Tiktoken {
  let enc = encoderCache.get(encodingName)
  if (!enc) {
    enc = getEncoding(encodingName)
    encoderCache.set(encodingName, enc)
  }
  return enc
}
```

`js-tiktoken` 是纯 JS 实现，encoder 对象没有 WASM 资源需要释放。用 `Map` 缓存避免每次计数重载词表，`disposeTokenCounters()` 在进程退出时清理。

---

## 26.3 `_governContext`：四步自愈管道

Token 计数只是"测量"。真正治理上下文的是 `AgentRunner._governContext()`——每次 AgentLoop 迭代调用 LLM **之前**，它要对消息数组执行四个子步骤：

```ts
// apps/desktop/src/main/agent/runner.ts
private _governContext(messages: LLMMessage[], spec: RunSpec) {
  this._dropOrphanToolResults(messages)    // 1. 清理
  this._backfillMissingToolResults(messages) // 2. 修复
  this._microcompact(messages)              // 3. 压缩
  this._snipHistory(messages, spec)         // 4. 截断
}
```

注意这个顺序不是随意的。**清理 → 修复 → 压缩 → 截断**，每一步为下一步准备干净的数据。

### 第一步：`_dropOrphanToolResults` — 删除"无主"工具结果

什么情况会产生孤立的 tool result？子 Agent 结果注入后，主 Agent 的 `dispatch` 可能重新构建消息数组，导致某些 tool_call 被移除但对应的 tool result 残留。另一个场景是 `/stop` 命令中断了一个 tool call 序列。

```ts
private _dropOrphanToolResults(messages: LLMMessage[]) {
  const toolCallIds = new Set<string>()
  for (const m of messages) {
    if (m.toolCalls) {
      for (const tc of m.toolCalls) toolCallIds.add(tc.id)
    }
  }
  // 倒序遍历删除（避免索引偏移）
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === 'tool' && m.toolCallId && !toolCallIds.has(m.toolCallId)) {
      messages.splice(i, 1)
    }
  }
}
```

算法很简单：先收集所有 `tool_call` 的 ID，再倒序删除 role='tool' 但 ID 不在集合中的消息。倒序遍历是关键——`splice` 影响后续索引，正序会跳过元素。

### 第二步：`_backfillMissingToolResults` — 为"无尾"的工具调用打补丁

反过来：tool_call 存在但对应的 tool result 丢失了。这在 Gateway 同步写入不完整导致的 `history.jsonl` 断尾时特别常见。

```ts
private _backfillMissingToolResults(messages: LLMMessage[]) {
  const results = new Map<string, boolean>()
  for (const m of messages) {
    if (m.role === 'tool' && m.toolCallId) results.set(m.toolCallId, true)
  }
  const toInsert: { idx: number; tc: ToolCallRequest }[] = []
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].toolCalls) {
      for (const tc of messages[i].toolCalls) {
        if (!results.has(tc.id)) toInsert.push({ idx: i + 1, tc })
      }
    }
  }
  // 倒序插入（同样避免索引偏移）
  for (let j = toInsert.length - 1; j >= 0; j--) {
    const { idx, tc } = toInsert[j]
    messages.splice(idx, 0, {
      role: 'tool',
      toolCallId: tc.id,
      name: tc.name,
      content: '[Tool result unavailable — call was interrupted or lost]',
    })
  }
}
```

两个聪明的设计决策：
1. **"丢失"的工具结果不空着**——插入一条 `[Tool result unavailable]` 而不是不插。这是因为 LLM 的 tool call / tool result 是**配对协议**，如果 LLM 看到 tool_call 没有对应 result，可能产生幻觉或重复调用。
2. **倒序插入**——同样是为了避免 `splice` 后的索引偏移。收集阶段记录原始索引，插入阶段从后往前处理，前面的索引仍然有效。

### 第三步：`_microcompact` — 微压缩旧工具输出

随着迭代进行，`read_file`、`grep`、`exec` 等工具的原始输出会堆积大量 token。但旧的结果通常只需要摘要：

```ts
const MICROCOMPACT_KEEP_RECENT = 10
const COMPACTABLE_TOOLS = new Set([
  'read_file', 'exec', 'grep', 'web_search', 'web_fetch', 'list_dir'
])

private _microcompact(messages: LLMMessage[]) {
  const compactable: number[] = []
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]
    if (m.role === 'tool' && m.name && COMPACTABLE_TOOLS.has(m.name)) {
      compactable.push(i)
    }
  }
  if (compactable.length <= MICROCOMPACT_KEEP_RECENT) return  // 不够多，不压缩

  const keepFrom = compactable[compactable.length - MICROCOMPACT_KEEP_RECENT]
  for (const idx of compactable) {
    if (idx >= keepFrom) break      // 最近 10 条保留原文
    const m = messages[idx]
    const preview = typeof m.content === 'string' ? m.content.slice(0, 80) : ''
    messages[idx] = { ...m, content: `[${m.name} result: ${preview}...]` }
  }
}
```

关键设计：
- **保留最近 10 条原文**（`MICROCOMPACT_KEEP_RECENT = 10`）——因为最新的工具输出最可能被后续推理引用
- **旧结果只留 80 字符预览 + 工具名**——从几万字符压缩到几十个 token
- **不是 LLM 摘要**——只是字符串截断。这是故意的：微压缩发生在每轮迭代的 `_governContext` 中，不能有 LLM 调用开销

### 第四步：`_snipHistory` — Token 预算截断

当所有优化都做了，上下文仍然超预算，就要"断头"——从最早的消息开始删除：

```ts
const SNIP_SAFETY_BUFFER = 1024  // 为模型回复预留的空间

private _snipHistory(messages: LLMMessage[], spec: RunSpec) {
  const budget = spec.contextWindowTokens - (spec.maxTokens ?? 4096) - SNIP_SAFETY_BUFFER
  if (budget <= 0) return

  const encoding = getEncodingForModel(spec.model)

  // 从后往前累加 token 数
  let total = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    total += countMessageTokens(messages[i], encoding)
    if (total > budget) {
      // 从 i+1 位置截断
      let start = i + 1
      // 但要从一条 user 消息开始（保持 system → user 交替）
      for (let j = start; j < messages.length; j++) {
        if (messages[j].role === 'user') {
          start = j
          // 如果前一条是 assistant 带着 tool_calls，保留它
          if (j > start && messages[j - 1]?.role === 'assistant'
                        && messages[j - 1]?.toolCalls?.length) {
            start = j - 1
          }
          break
        }
      }
      messages.splice(0, start)
      return
    }
  }
}
```

预算公式：`contextWindowTokens - maxTokens - 1024`
- `contextWindowTokens`：模型上下文窗口上限（如 DeepSeek 128K）
- `maxTokens`：本次生成的最大 token 数（如 8192）
- `SNIP_SAFETY_BUFFER = 1024`：额外安全边界，防止估算误差

截断的精细之处在**保持消息流有效**：
1. **从后往前累加** token——最新的消息最重要
2. **截断位置必须是 user 消息**——ChatML 协议要求 user/system/assistant 交替，以 system 或 tool 开头会破坏 provider 的角色交替检查
3. **保留截断点前的 assistant + tool_calls**——如果用户发了一条消息，但前一条 assistant 消息有未处理的 tool_calls，LLM 会困惑

这个"断头"算法比看起来复杂得多。它不是简单地从索引 0 开始删 N 条——它在保护 LLM 协议的正确性。

### 四步协同全景

把四步放回 `AgentRunner.run()` 的主循环：

```ts
async run(spec: RunSpec): Promise<AgentRunResult> {
  const messages: LLMMessage[] = []
  messages.push({ role: 'system', content: spec.context.system })
  messages.push(...spec.context.messages)

  for (let iteration = 0; iteration < spec.maxIterations; iteration++) {
    this._governContext(messages, spec)  // ← 每轮迭代前做一次治理

    const response = await this.provider.chatStreamWithRetry({ messages, ... })
    // ... 处理 tool calls，追加 assistant / tool 消息到 messages
    // ... 如果 LLM 返回 finalContent，退出循环
  }
}
```

每轮迭代做一次四步治理。这是一个**渐进式**的过程：
- 前几轮迭代，上下文很干净，`_snipHistory` 不会触发
- 随着对话增长，`_microcompact` 开始压缩旧工具输出
- 如果仍然超预算，`_snipHistory` 断头
- 如果历史 JSONL 加载时有问题，`_dropOrphanToolResults` 和 `_backfillMissingToolResults` 自愈

---

## 26.4 迭代内的两种恢复

`AgentRunner.run()` 除了四步治理，还有两种"原位恢复"机制：

### 空响应重试

```ts
const MAX_EMPTY_RETRIES = 2

// 如果 LLM 返回空内容（没有 tool_calls 也没有 final content）
if (!finalContent?.trim() && emptyRetries < MAX_EMPTY_RETRIES) {
  emptyRetries++
  messages.push({
    role: 'user',
    content: 'Please provide your response to the user based on the conversation above.',
  })
  continue  // 回到循环头，再跑一轮
}
```

`MAX_EMPTY_RETRIES = 2` 是一个谨慎的数字：给 LLM 两次机会，但拒绝无限循环。空响应常见于模型认为"当前不需要回复"的情况。

### `max_tokens` 截断续写

```ts
const MAX_LENGTH_RECOVERIES = 3

if (response.finishReason === 'max_tokens' && lengthRecoveries < MAX_LENGTH_RECOVERIES) {
  lengthRecoveries++
  messages.push({
    role: 'user',
    content: 'Output limit reached. Continue exactly where you left off — no recap, no apology.',
  })
  continue
}
```

当 LLM 的输出被 `max_tokens` 截断（`finishReason === 'max_tokens'`），CatBuddy 不是放弃——它追加一条特殊 user 消息让模型续写。prompt 措辞 "no recap, no apology" 是关键——如果不加这个约束，LLM 可能花大量 token 道歉和复述上下文。

---

## 26.5 上下文治理的边界

CatBuddy 的四步治理是一个**纯工程算法**——没有 LLM 调用，没有外部依赖。这有明确的取舍：

**优势**：
- **确定性**：同样的消息数组 → 同样的治理结果。不依赖 LLM 的随机性。
- **零延迟**：四步全在内存中完成，微秒级。
- **安全边距**：`SNIP_SAFETY_BUFFER = 1024` 和 `PRIMING_OVERHEAD = 3` 提供了缓冲。

**局限**：
- `_microcompact` 只做字符串截断，不会语义摘要——大文件 `read_file` 的输出丢掉 99% 内容后，LLM 可能丢失关键信息。
- `_snipHistory` 的断头是**不可逆的**——切断的早期上下文永久消失。如果想保留，应该配合第 24 章的 Consolidator 手动压缩。

这也是为什么第 24 章的 Consolidator 和本章的 `_governContext` 是两套互补的机制：
- **Consolidator**：离线、异步、LLM 驱动——把长对话压缩为结构化记忆（MEMORY.md）
- **_governContext**：在线、同步、纯算法——在 LLM 推理前即时整理消息数组

两者各司其职，不互相替换。

---

## 26.6 总结

`token-counter.ts`（150 行）给出了精确的 BPE 分词引擎：`getEncodingForModel` 选编码 → `countMessageTokens` 累加 role/content/tool_calls → `countMessagesTokens` 批量计算 + priming overhead → `safeCountTokens` 安全回退。

`AgentRunner._governContext`（100 行）给出了四步治理管道：

| 步骤 | 做什么 | 为什么 |
|------|--------|--------|
| `_dropOrphanToolResults` | 删除无主 tool result | 历史 JSONL 断尾自愈 |
| `_backfillMissingToolResults` | 补全缺失 tool result | 维护 tool_call/result 配对协议 |
| `_microcompact` | 旧输出截断为 80 字符摘要 | 节省 token，保留最近 10 条原文 |
| `_snipHistory` | 从最早消息断头 | 控制总 token 预算，保持 user 开头 |

加上 `MAX_EMPTY_RETRIES=2` 空响应恢复和 `MAX_LENGTH_RECOVERIES=3` 截断续写，构成了一个**完整的原位自愈系统**——不依赖外部干预，每次 LLM 调用前自动治理，让 Agent 在超长对话中持续运行。

> 下一篇聊 CatBuddy 怎么管理"用哪个模型"这个看似简单实则复杂的问题：`model_presets.ts` 的 ProviderSnapshot 签名比较怎么避免重复初始化？`defaults.ts` 怎么从模型名推断 Provider？`factory.ts` 怎么把主要 Provider 和 `fallbackModels` 串成故障转移链？`/model` 命令怎么运行时热切换模型而不中断当前任务？
