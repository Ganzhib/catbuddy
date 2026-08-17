---
name: llm-providers
description: LLM Provider 开发 — 抽象基类、工厂模式、Anthropic/OpenAI/Fallback 适配、重试机制
---

# LLM Provider 开发

Provider 模块位于 [apps/desktop/src/main/providers/](apps/desktop/src/main/providers/)，负责抽象不同 LLM 服务商的 API，为 AgentRunner 提供统一的调用接口。

## 架构

```
AgentRunner
    │
    ▼
LLMProvider (抽象基类)
    │
    ├── AnthropicProvider   ──► @anthropic-ai/sdk
    ├── OpenAICompatProvider ──► openai SDK (DeepSeek 等)
    └── FallbackProvider    ──► 主备切换
```

## 抽象基类 — base-provider.ts

```typescript
abstract class LLMProvider {
  abstract readonly name: string
  defaultModel: string
  generation: GenerationSettings   // { temperature, maxTokens }

  abstract chat(opts): Promise<LLMResponse>          // 非流式
  abstract chatStream(opts): Promise<LLMResponse>    // 流式
  chatStreamWithRetry(opts): Promise<LLMResponse>    // 带重试的流式调用
}
```

### 流式调用参数 (ChatStreamOpts)

| 参数 | 类型 | 说明 |
|------|------|------|
| `messages` | `LLMMessage[]` | 对话消息 |
| `tools` | `ToolDefinition[]` | 可用工具定义 |
| `model` | `string` | 模型名称 |
| `maxTokens` | `number` | 最大输出 Token |
| `temperature` | `number` | 温度参数 |
| `onContentDelta` | `(delta) => void` | 内容流回调 |
| `onThinkingDelta` | `(delta) => void` | 思维链流回调 |
| `signal` | `AbortSignal` | 取消信号 |
| `toolChoice` | `'auto'\|'required'\|'none'` | 工具调用策略 |

### 重试机制 (chatStreamWithRetry)

```typescript
{
  retryMode: 'standard' | 'persistent'  // standard=最多3次, persistent=无限重试
  onRetryWait: (msg) => void            // 重试等待通知
  timeout: number                        // 超时时间
}
```

退避策略：`[1s, 2s, 4s]` 递增延迟。`persistent` 模式会无限重试直到成功。

## Provider 工厂 — factory.ts

`createProvider(config)` 根据配置自动选择合适的 Provider：

```
apiBase 含 "anthropic" → AnthropicProvider
其他                      → OpenAICompatProvider
```

`createProviderWithFallback(config)` 支持主备切换：
- 如果只配了一个模型 → 直接返回对应 Provider
- 如果配了多个 fallback → 创建 `FallbackProvider`

参考 [model_presets.ts](apps/desktop/src/main/agent/model_presets.ts) 了解模型预设配置。

## AnthropicProvider

- SDK：`@anthropic-ai/sdk`
- 支持：Codex 全系列模型
- 特性：思维链（extended thinking）、工具调用
- API Key 要求：`ANTHROPIC_API_KEY` 或 `CLAUDE_CODE_API_KEY`

## OpenAICompatProvider

- SDK：`openai`
- 支持：任何兼容 OpenAI Chat Completions API 的服务
- 当前使用：DeepSeek
- API Key：`DEEPSEEK_KEY` 或通用 `OPENAI_API_KEY`
- 支持自定义 `providerName` 用于日志区分

## FallbackProvider

当主 Provider 失败时自动切换到备用 Provider：

```typescript
class FallbackProvider {
  // 尝试 primary → 失败后切换到 fallback 链
  // 每次切换记录日志
  // 支持 AbortSignal 取消整个链条
}
```

## 新增 Provider 指南

1. 在 `providers/` 中创建新文件（如 `gemini.ts`）
2. 继承 `LLMProvider` 抽象类
3. 实现 `chat()` 和 `chatStream()` 方法
4. 在 `factory.ts` 的 `makeProvider()` 中添加识别逻辑
5. 在 `providers/index.ts` 中导出

```typescript
// 新 Provider 模板
export class MyProvider extends LLMProvider {
  readonly name = "my-provider"

  async chat(opts: ChatStreamOpts): Promise<LLMResponse> {
    // 非流式实现
  }

  async chatStream(opts: ChatStreamOpts): Promise<LLMResponse> {
    // 流式实现
  }
}
```

## 关键文件

| 文件 | 作用 |
|------|------|
| [providers/base-provider.ts](apps/desktop/src/main/providers/base-provider.ts) | 抽象基类 + 重试逻辑 |
| [providers/factory.ts](apps/desktop/src/main/providers/factory.ts) | Provider 工厂 |
| [providers/anthropic.ts](apps/desktop/src/main/providers/anthropic.ts) | Anthropic SDK 适配 |
| [providers/openai-compat.ts](apps/desktop/src/main/providers/openai-compat.ts) | OpenAI 兼容适配 |
| [providers/fallback.ts](apps/desktop/src/main/providers/fallback.ts) | 主备切换 |
| [agent/model_presets.ts](apps/desktop/src/main/agent/model_presets.ts) | 模型预设配置 |
