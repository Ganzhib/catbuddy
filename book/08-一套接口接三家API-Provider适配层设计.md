# 07｜一套接口接三家 API：Provider 适配层设计

> 这是 CatBuddy 技术专栏的第 7 篇。上篇讲了上下文治理的三层防线——怎么让 Agent 在长对话中既不"失忆"又不爆 token。这篇聊一个基础设施问题：CatBuddy 支持 Anthropic、OpenAI、DeepSeek（以及任何 OpenAI 兼容的 API），但它们的数据格式、流式协议、工具调用方式各不相同。怎么用一套接口统一？

---

你有没有遇到过这种情况：用 Claude 写了一段代码，想试试 GPT 能不能给出更好的方案，结果一换模型，整个程序报错了？

不是因为模型能力不行。是因为 API 格式不兼容——Claude 的 system prompt 是顶级参数，GPT 的 system prompt 是一条 message；Claude 的工具调用是 `tool_use` content block，GPT 的是 `tool_calls` 数组字段；Claude 的流式响应是 SSE event 类型，GPT 的是 `data: [DONE]` 结尾……

CatBuddy 不能假设用户只用一款模型。那怎么让 Agent 核心代码不感知这些差异？答案是 **LLMProvider 抽象基类**——两个子类，一个统一接口，换模型只需要改一个配置行。

---

## 12.1 统一接口：LLMProvider 抽象基类

先看核心契约：

```typescript
export abstract class LLMProvider {
  abstract readonly name: string
  defaultModel: string = ''

  /** 非流式 */
  abstract chat(opts: ChatStreamOpts): Promise<LLMResponse>

  /** 流式 — 子类必须实现 */
  abstract chatStream(opts: ChatStreamOpts): Promise<LLMResponse>

  /** 带重试的流式调用 — 模板方法，子类不需要 override */
  async chatStreamWithRetry(opts: ChatStreamWithRetryOpts): Promise<LLMResponse>
}
```

整个 Agent 系统只调用 `chatStreamWithRetry`。它不知道底层是 Anthropic 还是 OpenAI。这就是经典的**策略模式**——Provider 是策略，AgentRunner 是上下文。

入参也是统一的 `ChatStreamOpts`：

```typescript
interface ChatStreamOpts {
  messages: LLMMessage[]       // 统一消息格式
  tools?: ToolDefinition[]     // 统一工具定义
  model?: string
  maxTokens?: number
  onContentDelta?: (delta: string) => Promise<void>  // 流式文本回调
  onThinkingDelta?: (delta: string) => Promise<void> // 推理回调(DeepSeek)
  signal?: AbortSignal         // 取消信号
}
```

不管哪个 Provider，调用方只关心"给消息，给工具定义，收到内容回调"。管你 Claude 怎么在 SSE 里包装 `content_block_delta`，上层代码不 care。

---

## 12.2 Anthropic 适配器：隐藏 message 格式差异

Claude 的消息格式和 GPT 在三个地方不同：

**差异 1：system prompt 是顶级参数，不是一条 message**

```typescript
// GPT 风格
{ role: 'system', content: 'You are a helpful assistant' },
{ role: 'user', content: 'Hello' }

// Anthropic 风格
system: 'You are a helpful assistant',
messages: [
  { role: 'user', content: 'Hello' }
]
```

Anthropic 适配器在构建请求前做提取：

```typescript
private extractSystem(messages: LLMMessage[]): string {
  return messages
    .filter(m => m.role === 'system')
    .map(m => typeof m.content === 'string' ? m.content : '')
    .join('\n\n')
}

private toAnthropicMessages(messages: LLMMessage[]): any[] {
  return messages.filter(m => m.role !== 'system')
  // ... 后续转换
}
```

**差异 2：工具调用是 `tool_use` content block，不是独立字段**

GPT 的工具调用是 `tool_calls` 数组附着在 assistant message 上。Claude 的工具调用是 assistant message 的 `content` 数组中的一个 `type: 'tool_use'` 的 block。

**差异 3：工具结果用 `role: 'user'` 而不是 `role: 'tool'`**

Claude API 不支持 `role: 'tool'`。工具结果必须包装为 user 消息里的 `tool_result` content block：

```typescript
if (m.role === 'tool') {
  return {
    role: 'user',
    content: [{
      type: 'tool_result',
      tool_use_id: m.toolCallId,
      content: m.content,
    }]
  }
}
```

这些转换全部封装在 `toAnthropicMessages()` 里。上层 Agent 永远用统一的 `LLMMessage` 格式（包含 `role: 'tool'`），适配器负责转换。

流式处理倒简单——Anthropic SDK 提供了事件驱动 API：

```typescript
stream.on('text', (text) => {
  content += text
  opts.onContentDelta?.(text)
})
const final = await stream.finalMessage()
```

---

## 12.3 OpenAI 兼容适配器：不止 OpenAI 一家

`OpenAICompatProvider` 的名字里带 "Compat" 不是随便起的。它不只是对接 OpenAI——任何遵循 OpenAI chat/completions API 的服务都能用：DeepSeek、Ollama、vLLM、OpenRouter、本地部署的 llama.cpp……

一个类，覆盖半个 AI 生态。

### 12.3.1 能力探测：不是所有 OpenAI 兼容 API 都一样

关键问题：虽然 API 格式兼容，但**功能兼容性**各不相同：

```typescript
// DeepSeek 不支持图片输入
function inferSupportsVision(apiBase?: string): boolean {
  if (apiBase?.includes('deepseek.com')) return false
  return true
}

// DeepSeek / Ollama 不支持流式 usage 统计
function inferStreamUsage(apiBase?: string): boolean {
  if (apiBase?.includes('deepseek.com')) return false
  if (apiBase?.includes('ollama')) return false
  return true
}
```

这些探测结果会影响行为：
- 不支持 vision 时，图片以文字描述的形式附在消息里（"该 Provider 仅支持文本，请描述图片"）
- 不支持流式 usage 时，最后从非流式的 final chunk 获取 token 统计

### 12.3.2 DeepSeek 的 reasoning_content

DeepSeek R1 有一个独特的能力——它会在流式响应中输出 `reasoning_content`（推理过程）。这不是标准的 OpenAI API 字段：

```typescript
// 流式 chunk 解析
for await (const chunk of stream) {
  const delta = chunk.choices?.[0]?.delta
  if (delta?.content) {
    content += delta.content
    await opts.onContentDelta?.(delta.content)
  }
  // DeepSeek 特有的 reasoning_content
  if ((delta as any).reasoning_content) {
    reasoningContent += (delta as any).reasoning_content
    await opts.onThinkingDelta?.((delta as any).reasoning_content)
  }
}
```

这里的 `onThinkingDelta` 回调会一路传到 AgentLoop → StreamBuffer → `ReasoningBubble` 组件——上一篇流式渲染文章里讲的可折叠推理气泡就是这么来的。

与 Anthropic 的 "thinking" 功能（Claude 3.5 的 extended thinking）不同，Anthropic SDK 原生支持 thinking，通过 SDK 方法直接回调。而 DeepSeek 的 reasoning_content 是"借用" OpenAI 格式的扩展字段——两种实现方式，但通过统一的 `onThinkingDelta` 回调汇入同一条流式管线。

---

## 12.4 chatStreamWithRetry：模板方法模式

`chatStreamWithRetry` 是基类实现的方法，子类不需要 override。它封装了重试逻辑：

```typescript
async chatStreamWithRetry(opts): Promise<LLMResponse> {
  const maxAttempts = opts.retryMode === 'persistent' ? Infinity : 3
  const baseDelays = [1, 2, 4]  // 指数退避

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await this.chatStream({...})

      if (response.finishReason !== 'error') return response  // 成功
      if (!this.isTransientError(response)) return response   // 不可恢复

      await sleep(delay * 1000)  // 等待后重试
    } catch (err) {
      if (err.name === 'AbortError') throw err  // 用户取消不重试
      await sleep(delay * 1000)
    }
  }

  return { content: 'Error: max retries exceeded', finishReason: 'error', ... }
}
```

两种重试模式：
- **standard**：最多 3 次。用户主动对话时使用——三次失败通常意味着网络问题，继续等没意义。
- **persistent**：无限重试。后台任务（Dream 记忆处理、Consolidator 压缩）使用——这些任务没有用户等待，多试几次无所谓。

临时错误的判断逻辑也很克制——不是所有错误都值得重试：

```typescript
protected isTransientError(response: LLMResponse): boolean {
  if (response.errorStatusCode === 429) return true       // 限流，等一等
  if (response.errorStatusCode >= 500) return true        // 服务端故障
  if (response.errorKind === 'timeout') return true       // 超时
  if (response.errorKind === 'connection') return true    // 连接失败
  return false  // 401认证错误、400参数错误不重试
}
```

---

## 12.5 工厂函数：根据配置创建 Provider

决定用哪个 Provider 的逻辑在 `factory.ts`：

```typescript
export function createProvider(config: ProviderConfig): LLMProvider {
  if (config.provider === 'anthropic') {
    return new AnthropicProvider({
      apiKey: config.apiKey,
      apiBase: config.apiBase,
      defaultModel: config.model,
    })
  }
  return new OpenAICompatProvider({
    apiKey: config.apiKey,
    apiBase: config.apiBase,
    defaultModel: config.model,
    providerName: config.provider,  // 'deepseek', 'openai', 'ollama' 等
  })
}
```

整个工厂函数只有几十行。Anthropic 走专用适配器，其他全部走 `OpenAICompatProvider`。这不是偷懒——这是对"OpenAI 兼容 API 已成为事实标准"这一现实的承认。

---

## 12.6 Model Presets：让用户无感切换

最上层是模型预设系统。用户在界面里选"DeepSeek V3"，背后做的事是：

```typescript
// model_presets.ts
const MODEL_PRESETS = {
  "deepseek-v3": {
    provider: "deepseek",
    model: "deepseek-chat",
    contextWindowTokens: 128_000,
  },
  "claude-sonnet-4": {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    contextWindowTokens: 200_000,
  },
  "gpt-4o": {
    provider: "openai",
    model: "gpt-4o",
    contextWindowTokens: 128_000,
  },
}
```

切换模型时：
1. 根据 preset 创建新的 `LLMProvider` 实例
2. 更新 `AgentRunner` 的 provider 引用
3. 同步更新 `Consolidator` 和 `Dream`（它们也用同一套 Provider）
4. 新的 `contextWindowTokens` 应用到上下文治理

**Agent 核心代码不需要重启，不需要重新加载。** `AgentRunner.setProvider(newProvider)` 一行搞定。

---

## 12.7 这套设计的代价

没有设计是完美的。Provider 适配层有两个已知的代价：

**1. 最小公分母效应**：统一接口只能暴露所有 Provider 都支持的能力。Anthropic 的 extended thinking 有 `budget_tokens` 参数，DeepSeek 的 reasoning 有 `reasoning_effort`。这些差异被 `ChatStreamOpts` 的 `reasoningEffort?: string` 字段"软承载"——子类各自解析，但类型系统无法保证一个 Provider 的独有参数不被另一个 Provider 的调用方误用。

**2. 错误信息的损失**：不同 Provider 的错误格式差异巨大。Anthropic 返回 `{ type: 'error', error: { type: 'overloaded_error', message: '...' } }`，OpenAI 返回 `{ error: { code: 'rate_limit_exceeded', message: '...' } }`。适配器统一成 `LLMResponse.finishReason = 'error'` + 一个简化的 `errorStatusCode`。对于调试来说，原始错误信息更有价值。

---

> **这篇讲了什么？**
>
> 1. CatBuddy 用 `LLMProvider` 抽象基类统一了多模型接入——两个子类（`AnthropicProvider` 和 `OpenAICompatProvider`），Agent 代码只调用 `chatStreamWithRetry`，不感知底层差异。
> 2. 适配器的核心工作是消息格式转换——Anthropic 的 system 是顶级参数、tool 结果必须是 `role: 'user'`，OpenAI 的 system 是 message、tool 结果用 `role: 'tool'`。这些差异全部封装在适配器内部。
> 3. 重试机制用模板方法模式实现——`chatStreamWithRetry` 在基类中定义，支持 standard（最多3次）和 persistent（无限重试）两种模式。用户取消（AbortError）和不可恢复错误（401、400）不重试。

> 下一篇聊 Agent Hook 系统——怎么在不修改 Agent Loop 核心代码的前提下，插入自定义行为：日志、监控、调试、项目特定逻辑？
