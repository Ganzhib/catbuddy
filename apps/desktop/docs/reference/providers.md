# OpenAI 与 Anthropic 协议差异

> **桌面端实现**：`src/main/providers/anthropic.ts`、`openai-compat.ts`、`factory.ts`。  
> **文档索引**：[../README.md](../README.md)

---

# openai和anthropic模型接口协议的区别


从之前读取的文件内容来看，主要区别在于：

1. **API 协议不同**：

   - Anthropic 使用 `@anthropic-ai/sdk`，有自己的消息格式
   - OpenAI 兼容使用 `openai` SDK，遵循 OpenAI 的 chat completions API
2. **消息格式不同**：

   - Anthropic 需要单独提取 system 消息作为 `system` 字段
   - OpenAI 兼容把所有消息（包括 system）放在 `messages` 数组中
3. **Tool 格式不同**：

   - Anthropic: `{ name, description, input_schema }`
   - OpenAI: `{ type: 'function', function: { name, description, parameters } }`
4. **响应格式不同**：

   - Anthropic: `response.content` 是 blocks 数组
   - OpenAI: `response.choices[0].message`
5. **Token 统计字段不同**：

   - Anthropic: `input_tokens`, `output_tokens`
   - OpenAI: `prompt_tokens`, `completion_tokens`
6. **流式处理不同**：

   - Anthropic 使用 `stream.finalMessage()` 获取最终响应
   - OpenAI 兼容通过遍历 chunks 获取内容

这些都是由于底层 API 的差异导致的，需要分别处理。

## 为什么分开实现

这两个 Provider 底层 API 协议不同，无法统一封装，必须分开处理：

### 核心差异对比

| 差异点                | Anthropic                                  | OpenAI 兼容                               |
| --------------------- | ------------------------------------------ | ----------------------------------------- |
| **SDK**         | `@anthropic-ai/sdk`                      | `openai`                                |
| **System 消息** | 单独 `system` 字段                       | 放在 `messages` 数组中                  |
| **Tool 格式**   | `{ name, description, input_schema }`    | `{ type: 'function', function: {...} }` |
| **响应结构**    | `content: [{ type: 'text'/'tool_use' }]` | `choices[0].message`                    |
| **Token 字段**  | `input_tokens`, `output_tokens`        | `prompt_tokens`, `completion_tokens`  |
| **流式处理**    | `stream.finalMessage()`                  | 遍历 `for await (chunk of stream)`      |
| **角色交替**    | Anthropic 强制要求                         | 非强制                                    |

### 具体代码差异

**System 消息处理：**

```typescript
// Anthropic — 单独提取
const systemMsg = this.extractSystem(opts.messages)  // → system: systemMsg
const msgs = this.toAnthropicMessages(opts.messages) // → messages: msgs

// OpenAI — 保留在 messages 中
messages: this.toOpenAIMessages(opts.messages)  // system 会作为 role: 'system' 的一项
```

**Tool 格式：**

```typescript
// Anthropic
{ name: tool.function.name, description, input_schema: tool.function.parameters }

// OpenAI  
{ type: 'function', function: { name, description, parameters } }
```

**流式响应：**

```typescript
// Anthropic — 事件监听 + finalMessage
stream.on('text', (text) => content += text)
const final = await stream.finalMessage()
return this.parseResponse(final)

// OpenAI — 迭代器遍历 chunks
for await (const chunk of stream) {
  content += chunk.choices?.[0]?.delta?.content
}
```

### 工厂函数判断逻辑

```typescript
// factory.ts
if (apiBase?.includes('anthropic')) {
  return new AnthropicProvider(...)
}
return new OpenAICompatProvider(...)
```

### 总结

分开的原因是 **API 协议本质不同**：

- Anthropic 有自己的闭源协议
- OpenAI 兼容是一个开放标准（被 DeepSeek、Ollama、vLLM 等广泛采用）

虽然都能完成"聊天 + 函数调用"的功能，但请求/响应的序列化格式完全不同，无法用同一套代码处理。
