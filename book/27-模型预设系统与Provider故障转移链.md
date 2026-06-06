# 模型预设系统与 Provider 故障转移链

第 07 章讲了 CatBuddy 怎么用一套接口接三家 API——Provider 适配层的抽象设计。但有一个问题没展开：**Agent 是怎么选择"用哪个模型"的？** 答案不在适配层，在模型管理全链路——从 YAML 配置到 Provider 实例化，从 API Key 环境变量回退到运行时热切换。

这条链路跨了 **7 个文件、600+ 行代码**，但核心理念非常简单：**用 signature 比较避免重复初始化，用 fallback 链容忍故障**。

---

## 27.1 问题：选模型比看起来复杂

问一个看似简单的问题：CatBuddy 怎么决定用 DeepSeek V4 还是 GPT-4o？

一个朴素方案是写进配置文件：

```yaml
model: deepseek-v4-flash
provider: deepseek
```

但这不够。真实场景有这些需求：

1. **预定义的模型组合（presets）**：用户想一键切换"快速回复模式"和"深度推理模式"，切换 trigger 包括模型、provider、温度、上下文窗口。不是只改 `model` 字符串。
2. **运行时热切换**：用户和 Agent 对话框里输了 `/model gpt-4o`——Agent 不能重启，要立刻切换到新 Provider。
3. **Provider 故障转移**：DeepSeek API 挂了怎么办？自动尝试 OpenAI，再不行尝试本地 Ollama。
4. **API Key 的多来源优先级**：用户写在配置文件里的 key → 环境变量里的 `DEEPSEEK_KEY` → 内置默认值（无 key 时 silent fail）。
5. **Provider 推断**：用户只写了 `model: deepseek-v4`，但没写 `provider`——系统要从模型名推断 provider。

CatBuddy 的解法是三层结构：**配置层（defaults.ts）→ 预设层（model_presets.ts）→ 实例层（factory.ts + fallback.ts）**。

---

## 27.2 配置层：`defaults.ts` 的合并与推断

### 27.2.1 内置默认值

`getDefaultConfig()` 返回一个完整的 `catbuddyConfig` 对象。它不是"推荐配置"，而是**最小可行配置**——用户可以不提供任何配置文件，Electron 内嵌的默认值就能启动 Agent：

```ts
// apps/desktop/src/main/config/defaults.ts
export function getDefaultConfig(): catbuddyConfig {
  return {
    agents: {
      defaults: {
        model: 'deepseek-v4-flash',
        provider: 'deepseek',
        maxToolIterations: 50,
        contextWindowTokens: 128_000,
        maxTokens: 8192,
        temperature: 0.7,
        // ...
        fallbackModels: [],           // 默认无故障转移
        providerRetryMode: 'standard', // standard: 最多重试 3 次
      },
    },
    providers: {
      deepseek: {
        apiKey: resolveProviderApiKey('deepseek'),  // 从环境变量读取
        apiBase: resolveProviderApiBase('deepseek'),
      },
      openai: {
        apiKey: resolveProviderApiKey('openai'),
        apiBase: resolveProviderApiBase('openai'),
      },
    },
  }
}
```

### 27.2.2 `normalizeConfigWithDefaults`：配置合并

用户提供的配置会与默认值深度合并。合并逻辑里有一个精巧的细节——**Provider 自动推断**：

```ts
export function normalizeConfigWithDefaults(config: catbuddyConfig): boolean {
  const defaults = getDefaultConfig()
  // ... 合并 agents.defaults, providers ...

  const provider = config.agents.defaults.provider?.trim()
  if (!provider || !config.providers[provider]) {
    // Provider 没配或者没 API key → 从模型名推断
    const inferred = inferProviderFromModel(
      provider || config.agents.defaults.model
    )
    const nextProvider = inferred && config.providers[inferred]
      ? inferred : defaults.agents.defaults.provider
    config.agents.defaults.provider = nextProvider
  }
}

function inferProviderFromModel(model: string): string | undefined {
  const normalized = model.trim().toLowerCase()
  if (normalized.startsWith('deepseek')) return 'deepseek'
  if (normalized.startsWith('gpt-') || startsWith('o1/o3/o4')) return 'openai'
  if (normalized.startsWith('claude')) return 'anthropic'
}
```

推断规则非常简单——**检查模型名前缀**。`deepseek-v4-flash` → `deepseek`，`gpt-4o` → `openai`，`claude-sonnet-4` → `anthropic`。

这个函数只在 `config.providers[inferred]` 确实有 API key 时才返回推断值，否则回退到默认的 `deepseek`。这避免了"推断出 openai 但没有 openai key"的情况。

### 27.2.3 API Key 的三级回退

```ts
// apps/desktop/src/main/config/env-provider-fallback.ts
export function resolveProviderApiKey(providerName: string, stored?: string): string {
  const fromConfig = stored?.trim() ?? ''
  if (fromConfig) return fromConfig                        // 1. 配置文件中的 key

  if (providerName === 'deepseek') {
    return process.env.DEEPSEEK_KEY?.trim()                // 2. 环境变量
        || process.env.DEEPSEEK_API_KEY?.trim()
        || ''
  }
  if (providerName === 'openai') {
    return process.env.OPENAI_API_KEY?.trim() || ''
  }
  return ''                                                // 3. 无可用的 key
}
```

**三个来源，按优先级**：配置文件 → 环境变量 → 空字符串。环境变量不需要持久化到磁盘（`stripEnvProviderKeys` 在保存配置时移除与 env 等价的 key）。

---

## 27.3 预设层：`model_presets.ts` 的 ProviderSnapshot 模式

### 27.3.1 预设的结构

用户可以在 `catbuddy.config.yaml` 中定义多个预设：

```yaml
modelPresets:
  fast:
    model: deepseek-v4-flash
    provider: deepseek
    contextWindowTokens: 64000
    maxTokens: 4096
    temperature: 0.3
  think:
    model: deepseek-v4
    provider: deepseek
    contextWindowTokens: 128000
    maxTokens: 8192
    temperature: 0.7
```

CatBuddy 会自动注入一个 `"default"` 预设（从 `agents.defaults` 取值），所以即使用户不定义任何预设，系统也有一个可用的预设。

```ts
export function configuredModelPresets(config): Record<string, ModelPresetConfig> {
  const presets = { ...(config.modelPresets ?? {}) }
  presets.default = {
    model: config.agents.defaults.model,
    provider: config.agents.defaults.provider,
    // ...
  }
  return presets
}
```

### 27.3.2 ProviderSnapshot：配置的"快照"

这是 CatBuddy 模型管理的核心抽象：

```ts
export interface ProviderSnapshot {
  provider: LLMProvider      // 实例化的 Provider 对象
  model: string
  contextWindowTokens: number
  signature: readonly unknown[]  // 用于去重比较
}
```

`ProviderSnapshot` 不只是把配置字段打包——它**实例化了 Provider 对象**。`buildProviderSnapshot` 会调用 `createProvider(config)` 创建一个真正的 `LLMProvider` 实例：

```ts
export function buildProviderSnapshot(config, presetName?: string): ProviderSnapshot {
  const presets = configuredModelPresets(config)
  const preset = presets[presetName ?? 'default']
  const providerName = preset.provider ?? config.agents.defaults.provider
  const provider = createProvider({ ...mergedConfig })
  return {
    provider,
    model: preset.model,
    contextWindowTokens: preset.contextWindowTokens ?? defaults.contextWindowTokens,
    signature: ['model_preset', name, JSON.stringify(preset)] as const,
  }
}
```

`signature` 是一个元组：`['model_preset', preset名称, JSON序列化的preset配置]`。它有两个用途：
1. **去重比较**——如果两次切换的 signature 相同，跳过重复初始化
2. **调试追踪**——日志中可以打印 signature 来确认当前生效的预设

### 27.3.3 Signature 比较：热切换的核心优化

```ts
// apps/desktop/src/main/agent/loop.ts
private _applyProviderSnapshot(snapshot: ProviderSnapshot): void {
  const sig = JSON.stringify(snapshot.signature)
  const prev = this._providerSnapshot
    ? JSON.stringify(this._providerSnapshot.signature)
    : null
  if (sig === prev) return   // ← 签名没变，什么都不做

  // 签名变了 → 广播到所有子系统
  this._providerSnapshot = snapshot
  this.provider = snapshot.provider
  this.model = snapshot.model
  this.contextWindowTokens = snapshot.contextWindowTokens
  this.runner.setProvider(snapshot.provider)          // Agent 执行器
  this.consolidator.setProvider(snapshot.provider,    // 记忆合并器
    snapshot.model, snapshot.contextWindowTokens)
  this.dream?.setProvider(snapshot.provider, snapshot.model)  // 后台学习
  this.subagents?.setProvider(snapshot.provider, snapshot.model) // 子 Agent
}
```

**ProviderSnapshot 的切换会传播到 5 个子系统**。Runner、Consolidator、Dream、Sub-Agent——每个都需要知道新的 Provider 和模型名。`_applyProviderSnapshot` 是唯一的切换入口，保证了状态一致性。

### 27.3.4 `/model` 命令：运行时热切换

```ts
// AgentLoop.setModelPreset()
setModelPreset(name: string | null, publishUpdate = true): void {
  const presets = configuredModelPresets(this._config)
  if (name) normalizePresetName(name, presets)  // 校验名称
  this.modelPreset = name
  this._refreshProviderSnapshot()               // 重建 snapshot → 广播
}

// AgentLoop.setModel() — 只换模型不换 provider
setModel(model: string) {
  this.model = model
  this.runner.setProvider(this.provider)         // 保持 provider，更新 model 参数
  this.consolidator.setProvider(this.provider, model, this.contextWindowTokens)
  this.subagents?.setProvider(this.provider, model)
  this.dream?.setProvider(this.provider, model)
}
```

注意 `setModelPreset` 和 `setModel` 的区别：
- `setModelPreset("think")` → 重新实例化 Provider（可能是不同的 provider），广播到所有子系统
- `setModel("gpt-4o")` → Provider 不变，只更新 model 参数，广播到所有子系统

---

## 27.4 实例层：Provider 工厂与故障转移链

### 27.4.1 工厂：协议检测 + 自动路由

```ts
// apps/desktop/src/main/providers/factory.ts
function makeProvider(params): LLMProvider {
  const { model, apiKey, apiBase } = params
  if (apiBase?.includes('anthropic')) {
    return new AnthropicProvider({ apiKey, apiBase, defaultModel: model })
  }
  return new OpenAICompatProvider({ apiKey, apiBase, defaultModel: model })
}
```

CatBuddy 根据 `apiBase` URL 自动判断协议族——`api.anthropic.com` → Anthropic native API，其余全部走 OpenAI-compatible 协议。这意味着 Ollama、vLLM、DeepSeek、通义千问、Moonshot 等所有兼容 OpenAI API 的服务，都通过同一个 `OpenAICompatProvider` 接入。

### 27.4.2 故障转移链的装配

```ts
export function createProvider(config: catbuddyConfig): LLMProvider {
  const defaults = config.agents.defaults
  const primary = buildProvider(config, defaults.model, defaults.provider)

  const fallbackModels = config.agents.defaults.fallbackModels ?? []
  if (fallbackModels.length === 0) return primary  // 无需故障转移

  const fallbacks: LLMProvider[] = []
  for (const fb of fallbackModels) {
    try {
      if (typeof fb === 'string') {
        // 引用 model_presets 中的预设名
        const preset = config.modelPresets?.[fb]
        if (preset) {
          fallbacks.push(buildProvider(config, preset.model,
            preset.provider ?? defaults.provider))
        }
      } else {
        // 内联模型配置 { model: 'gpt-4o', provider: 'openai' }
        fallbacks.push(buildProvider(config, fb.model, fb.provider))
      }
    } catch (err) {
      console.warn(`[factory] Failed to init fallback: ${err.message}`)
    }
  }

  if (fallbacks.length === 0) return primary
  return new FallbackProvider({ primary, fallbacks })
}
```

`fallbackModels` 支持两种格式：
- **字符串**：引用 `modelPresets` 中的 preset 名。如 `"fast"` → 读取 `modelPresets.fast`。
- **对象**：`{ model: 'gpt-4o', provider: 'openai' }` 直接指定。

如果某个 fallback 初始化失败（比如没有 API key），`catch` 块会吞掉错误并跳过，不阻塞其他 fallback。如果没有成功初始化的 fallback，返回 bare `primary`。

### 27.4.3 FallbackProvider：按序尝试

```ts
// apps/desktop/src/main/providers/fallback.ts
export class FallbackProvider extends LLMProvider {
  private primary: LLMProvider
  private fallbacks: LLMProvider[]

  private async _tryWithFallback(method, opts): Promise<LLMResponse> {
    const providers = [this.primary, ...this.fallbacks]

    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i]
      try {
        const response = await provider[method]({ ...opts,
          model: opts.model ?? provider.defaultModel,
        })
        if (response.finishReason !== 'error') {
          if (i > 0) console.log(`[fallback] Switched to fallback #${i}`)
          return response
        }
        // 错误响应 → 判断是否 transient → 继续下一个
        if (this.isTransientError(response)) {
          console.warn(`[fallback] ${provider.name} transient error, trying next...`)
          continue
        }
        continue  // 非 transient 也继续（可能是计费/配额问题）
      } catch (err) {
        console.warn(`[fallback] ${provider.name} threw: ${err.message}`)
        continue
      }
    }

    // 所有 provider 都失败
    return {
      content: 'All providers failed. Please check your API keys and network.',
      finishReason: 'error', ...
    }
  }
}
```

关键设计：**不区分 transient 和 permanent 错误**。CatBuddy 采取了"能试就试"的策略——即使错误看起来是配额问题（非 transient），也继续尝试下一个 provider。这是因为：
- `isTransientError` 的判断是启发式的（429 / 5xx / timeout），不可靠
- 用户的预算可能在不同 provider 上有不同表现
- 多试一次的成本远低于错过一个可用 provider

---

## 27.5 重试模式：Standard vs Persistent

`LLMProvider` 基类提供了 `chatStreamWithRetry`——在单个 provider 级别做指数退避重试：

```ts
// apps/desktop/src/main/providers/base-provider.ts
async chatStreamWithRetry(opts: ChatStreamWithRetryOpts): Promise<LLMResponse> {
  const maxAttempts = opts.retryMode === 'persistent' ? Infinity : 3
  const baseDelays = [1, 2, 4]  // 1秒 → 2秒 → 4秒

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await this.chatStream({ ... })
      if (response.finishReason !== 'error') return response
      if (!this.isTransientError(response)) return response  // 非瞬时错误不重试

      const delay = response.retryAfter ?? baseDelays[attempt]
      await sleep(delay * 1000)
    } catch (err) {
      if (err.name === 'AbortError') throw err  // 用户取消，不重试
      await sleep(baseDelays[attempt] * 1000)
    }
  }
  return { content: 'max retries exceeded', finishReason: 'error', ... }
}
```

两种模式：

| 模式 | `retryMode` | 最大尝试次数 | 使用场景 |
|------|------------|-------------|---------|
| Standard（默认） | `'standard'` | 3 次 | 正常 Agent 对话 |
| Persistent | `'persistent'` | 无限次 | 后台任务（Dream / Consolidator） |

Persistent 模式用于 Dream 和 Consolidator——后台任务没有用户在等，多等几次无所谓。但 `AbortError` 在任何模式下都不重试——这是用户主动取消的信号。

`isTransientError` 的判断：
```ts
protected isTransientError(response: LLMResponse): boolean {
  if (response.errorStatusCode === 429) return true        // Rate limit
  if (response.errorStatusCode >= 500) return true         // Server error
  if (response.errorKind === 'timeout') return true        // 超时
  if (response.errorKind === 'connection') return true     // 连接错误
  return false
}
```

---

## 27.6 OpenAICompatProvider：流式解析与视觉能力推断

虽然 `OpenAICompatProvider` 是适配层细节，但有两个设计值得一提：

### 流式 Tool Call 拼接

```ts
// openai-compat.ts chatStream()
const toolCallMap = new Map<number, { id: string; name: string; args: string }>()

for await (const chunk of stream) {
  const delta = chunk.choices?.[0]?.delta
  for (const tc of delta.tool_calls ?? []) {
    if (!toolCallMap.has(tc.index)) {
      toolCallMap.set(tc.index, { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' })
    }
    const entry = toolCallMap.get(tc.index)!
    if (tc.id) entry.id = tc.id
    if (tc.function?.name) entry.name = tc.function.name
    if (tc.function?.arguments) entry.args += tc.function.arguments  // 流式拼接
  }
}
```

OpenAI 的流式 API 会把一个 tool call 的参数拆成多个 chunk 发送——每个 chunk 只带一部分 JSON 字符串。CatBuddy 用 `Map<index, {...}>` 按 `chunk.index` 聚合，最后 `safeParseJSON` 解析。

### 视觉能力自动推断

```ts
function inferSupportsVision(apiBase?: string, providerName?: string): boolean {
  if (name === 'deepseek' || base.includes('deepseek.com')) return false
  return true  // OpenAI / Anthropic / Ollama vLLM: 假定支持视觉
}
```

DeepSeek 明确不支持多模态 image_url，CatBuddy 自动将图片转为文本提示 `[1 attached image not sent...]`，避免 400 错误。

---

## 27.7 全链路一览

从用户输入 `/model think` 到 LLM 开始用新模型推理：

```text
用户: /model think
  │
  ▼
CommandRouter → handleModelPreset("think")
  │
  ▼
AgentLoop.setModelPreset("think")
  ├─ configuredModelPresets(config) → 确认 "think" 预设存在
  ├─ normalizePresetName("think", presets) → 校验 + 友好错误
  │
  ▼
_refreshProviderSnapshot()
  ├─ buildProviderSnapshot(config, "think")
  │   ├─ configuredModelPresets(config) → { default, fast, think }
  │   ├─ createProvider(config_merged_with_think)
  │   │   ├─ buildProvider(config, "deepseek-v4", "deepseek")
  │   │   │   ├─ resolveProviderApiKey("deepseek") → DEEPSEEK_KEY env
  │   │   │   └─ makeProvider({ apiBase: "api.deepseek.com" })
  │   │   │       └─ OpenAICompatProvider (apiBase 不含 anthropic)
  │   │   ├─ fallbackModels: [] → 无故障转移
  │   │   └─ return OpenAICompatProvider instance
  │   └─ return ProviderSnapshot { provider, model, contextWindowTokens, signature }
  │
  ▼
_applyProviderSnapshot(snapshot)
  ├─ JSON.stringify(signature) === prev? → 否 → 执行切换
  ├─ this.provider = snapshot.provider
  ├─ this.model = "deepseek-v4"
  ├─ this.contextWindowTokens = 128000
  ├─ runner.setProvider(snapshot.provider)
  ├─ consolidator.setProvider(snapshot.provider, "deepseek-v4", 128000)
  ├─ dream?.setProvider(snapshot.provider, "deepseek-v4")
  └─ subagents?.setProvider(snapshot.provider, "deepseek-v4")
```

**全程同步、零重启、零中断**。正在运行的 Agent 对话继续用旧 provider 完成当前 turn，下一个 turn 自动使用新 provider。

---

## 27.8 总结

模型管理系统三层结构：

| 层 | 文件 | 职责 |
|----|------|------|
| 配置层 | `defaults.ts` + `env-provider-fallback.ts` | 默认值合并、provider 推断、API key 三级回退 |
| 预设层 | `model_presets.ts` + `loop.ts` 热切换 | ProviderSnapshot 签名比较、5 子系统广播 |
| 实例层 | `factory.ts` + `fallback.ts` + `base-provider.ts` | Factory 协议检测、FallbackProvider 链、Standard/Persistent 重试 |

设计决策回顾：
- **Signature 比较避免重复初始化**——`JSON.stringify(signature)` 只在真正变化时才重建 Provider 对象。
- **FallbackProvider 不区分 transient/permanent**——能试就试，多试一次的成本远低于错过可用 Provider。
- **Persistent 重试只给后台任务**——Dream / Consolidator 可以无限重试，用户交互用 Standard 3 次。
- **API Key 不落盘**——`stripEnvProviderKeys` 保证环境变量中的 key 不被持久化到配置文件。
- **视觉能力自动推断**——DeepSeek 自动降级为纯文本模式。

> 下一篇聊 CatBuddy 的最后一个 Agent 主题：Agent 怎么"认识"自己？`my` 工具的运行时自省设计——Agent 能查看自己的模型名、当前迭代次数、上下文窗口大小、正在运行的子 Agent 数量，甚至在配置允许下修改 `maxIterations`。`AbortController` 怎么实现 `/stop` 的无痛取消？AgentLoop 的"自我认知"与"自我控制"如何通过 `RuntimeState` 协议解耦？
