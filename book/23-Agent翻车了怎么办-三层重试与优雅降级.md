# 22｜Agent 翻车了怎么办？三层重试与优雅降级

> 这是 CatBuddy 技术专栏的第 22 篇。上篇讲了 Sub-Agent 系统——怎么批量派小猫并行干活。这篇聊一个更底层的话题：当 LLM API 挂了、工具执行报错了、网络超时了——Agent 怎么不死给你看？

> **核心问题**：CatBuddy 的 Agent 系统有三层防御——Provider 重试、Fallback 链切换、AgentRunner 自恢复，再加一个结构化链路追踪 Logger。这四样东西怎么协同，让 Agent 在任何情况下都能优雅降级而不是崩溃？

---

你用过的 AI 产品里，有没有见过这种错误：

> "An error occurred. Please try again."

然后你刚才的对话全没了。你得重新描述你的需求，重新上传文件，重新等它理解上下文。

LLM 本身就是一个**概率性系统**——API 限流、网络抖动、模型返回空内容、工具执行抛异常，这些都是常态而不是意外。一个生产级的 Agent 系统，必须假设**每一步都可能失败**，并且在每一步都有恢复策略。

CatBuddy 的容错体系分四层。从底到顶：

```
[AgentRunner 自恢复]     ← 空响应重试 / max_tokens 续写 / 工具异常兜底
[Fallback 链切换]        ← 主模型挂了 → 备用模型 #1 → 备用模型 #2
[Provider 重试]           ← 瞬态错误指数退避重试 / AbortError 快速传播
[Logger 链路追踪]         ← 结构化日志，让每一层失败都有迹可循
```

---

## 22.1 第一层：Provider 重试——指数退避，只重试该重试的

最底层的重试发生在 LLM API 调用这一级。`LLMProvider.chatStreamWithRetry()` 是整个系统唯一调用 LLM API 的入口，也是第一道防线。

```typescript:44:84:apps/desktop/src/main/providers/base-provider.ts
  async chatStreamWithRetry(opts: ChatStreamWithRetryOpts): Promise<LLMResponse> {
    const maxAttempts = opts.retryMode === 'persistent' ? Infinity : 3
    const baseDelays = [1, 2, 4]
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await this.chatStream({
          messages: opts.messages,
          tools: opts.tools,
          model: opts.model,
          maxTokens: opts.maxTokens,
          temperature: opts.temperature,
          onContentDelta: opts.onContentDelta,
          onThinkingDelta: opts.onThinkingDelta,
          signal: opts.signal,
        })

        if (response.finishReason !== 'error') return response
        if (!this.isTransientError(response)) return response

        const delay = response.retryAfter ?? baseDelays[Math.min(attempt, baseDelays.length - 1)]
        await opts.onRetryWait?.(
          `Model error, retrying in ${Math.ceil(delay)}s (attempt ${attempt + 1})`,
        )
        await sleep(delay * 1000)
      } catch (err: any) {
        lastError = err
        if (err.name === 'AbortError') throw err
        const delay = baseDelays[Math.min(attempt, baseDelays.length - 1)]
        await sleep(delay * 1000)
      }
    }

    return {
      content: lastError?.message ?? 'Error: max retries exceeded',
      toolCalls: [],
      finishReason: 'error',
      usage: { inputTokens: 0, outputTokens: 0 },
    }
  }
```

这里有两个关键设计决策：

### 区分瞬态错误和永久错误

```typescript:86:92:apps/desktop/src/main/providers/base-provider.ts
  protected isTransientError(response: LLMResponse): boolean {
    if (response.errorShouldRetry !== undefined) return response.errorShouldRetry
    if (response.errorStatusCode === 429) return true
    if (response.errorStatusCode && response.errorStatusCode >= 500) return true
    if (response.errorKind === 'timeout' || response.errorKind === 'connection') return true
    return false
  }
```

**429（限流）→ 重试。** 等几秒钟限流窗口就过去了，重试大概率成功。

**5xx（服务端错误）→ 重试。** 服务器暂时不可用，重试可能换一个实例就成功了。

**timeout / connection → 重试。** 网络抖动，TCP 重连就行。

**4xx（客户端错误，除 429）→ 不重试。** 你的 API Key 错了、请求格式不对，重试 100 次也没用。

这个判断决定了重试的效率。如果对所有错误都重试，不仅浪费时间和 token，还可能触发更严厉的限流。

### AbortError 直接穿透，不重试

```typescript:72
        if (err.name === 'AbortError') throw err
```

用户点了 `/stop`，AbortController 触发。如果你还在重试循环里等指数退避，用户会看到 `/stop` 点下去三秒了还在输出。AbortError 不是"错误"，是"用户想要停下来"——必须立即穿透所有重试层。

### 两种重试模式：standard vs persistent

- **standard**：最多 3 次，延迟 `[1s, 2s, 4s]`。适用于普通 Agent 调用。
- **persistent**：无上限重试。适用于关键操作（比如 Dream 在后台提取记忆，失败了大不了等下一轮）。

---

## 22.2 第二层：Fallback 链——主模型挂了自动切备用

Provider 重试三次都失败了？下一道防线是 `FallbackProvider`——把主模型和备用模型串成一条链：

```typescript:41:85:apps/desktop/src/main/providers/fallback.ts
  private async _tryWithFallback(
    method: 'chat' | 'chatStream',
    opts: ChatStreamOpts,
  ): Promise<LLMResponse> {
    const providers = [this.primary, ...this.fallbacks]

    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i]
      const label = i === 0 ? 'primary' : `fallback #${i}`

      try {
        const response = await provider[method]({
          ...opts,
          model: opts.model ?? provider.defaultModel,
        })

        if (response.finishReason !== 'error') {
          if (i > 0) console.log(`[fallback] Switched to ${label}: ${provider.name}/${provider.defaultModel}`)
          return response
        }

        if (this.isTransientError(response)) {
          console.warn(`[fallback] ${label} (${provider.name}) transient error, trying next...`)
          continue
        }

        console.warn(`[fallback] ${label} (${provider.name}) error: ${(response.content ?? '').slice(0, 120)}`)
        continue
      } catch (err: any) {
        console.warn(`[fallback] ${label} (${provider.name}) threw: ${err.message}`)
        continue
      }
    }

    return {
      content: 'All providers failed. Please check your API keys and network connection.',
      toolCalls: [],
      finishReason: 'error',
      usage: { inputTokens: 0, outputTokens: 0 },
    }
  }
```

FallbackProvider 的哲学是：**永远把错误吞掉，给用户一个有意义的兜底消息。** 最坏的情况是所有 Provider 都挂了，返回 `"All providers failed..."` 而不是 `undefined` 或崩溃。

典型的 Fallback 配置：

```
主模型: DeepSeek-V3 (便宜、够用)
↓ 挂了？
备用1: Claude-3.5-Sonnet (更贵但更可靠)
↓ 也挂了？
备用2: GPT-4o (最后防线)
↓ 全挂了？
→ "All providers failed. Please check your API keys and network connection."
```

注意 FallbackProvider 覆盖了 `chatStreamWithRetry()`——它不调用 primary 的重试，而是自己管链式切换。这避免了"primary 重试 3 次 × fallback 重试 3 次 = 9 次 API 调用"的指数膨胀。

---

## 22.3 第三层：AgentRunner 自恢复——三件事可以在迭代循环里补救

Provider 层和 Fallback 层管的是"LLM 能不能响应"。但 LLM 响应了之后，还有三种错误需要 AgentRunner 自己兜底：

### 空响应重试

```typescript:291:300:apps/desktop/src/main/agent/runner.ts
      if (!finalContent?.trim() && emptyRetries < MAX_EMPTY_RETRIES) {
        emptyRetries++
        messages.push({
          role: 'user',
          content: 'Please provide your response to the user based on the conversation above.',
        })
        continue
      }
```

LLM 偶尔会返回一个空响应——没有 text，没有 tool_calls。通常是因为模型"卡住了"，或者上一个 tool result 让它困惑。`AgentRunner` 不直接报错，而是推一条引导消息进 messages，让 LLM 再试一次。最多 2 次。

### max_tokens 截断续写

```typescript:303:310:apps/desktop/src/main/agent/runner.ts
      if (response.finishReason === 'max_tokens' && lengthRecoveries < MAX_LENGTH_RECOVERIES) {
        lengthRecoveries++
        messages.push({
          role: 'user',
          content: 'Output limit reached. Continue exactly where you left off — no recap, no apology.',
        })
        continue
      }
```

LLM 输出被 `max_tokens` 截断了（比如生成一个长文件写到一半）。AgentRunner 告诉它"继续，不要复盘，不要道歉"，然后把续写内容追加到之前的输出后面。最多 3 次——超过 3 次还没写完，大概率是 LLM 陷入了一个无限的重复模式。

注意这条引导消息的措辞："no recap, no apology"。不加这句话，LLM 的典型反应是："好的，让我继续刚才的内容。首先回顾一下我之前做了什么..."——然后浪费一半 token 在复盘上。

### 工具执行异常兜底

```typescript:252:258:apps/desktop/src/main/agent/runner.ts
          try {
            result = await spec.tools.execute(toolCall)
          } catch (err: any) {
            failed = true
            result = `Error: ${err.message}`
            toolEvents.push({ ...base, status: 'error', detail: result })
            spec.progressCallback?.({ ...base, status: 'error', detail: result })
          }
```

工具执行抛异常了？不崩溃。把异常信息格式化成 `"Error: ${err.message}"`，作为 tool result 返回给 LLM。LLM 看到这个错误消息后，通常会自动调整策略——换个参数重试，或者换个工具。

这和 `spawn` 的并发满了直接返回错误消息一样——**把决策权留给 LLM，代码只负责如实报告。**

---

## 22.4 第四层：Logger 链路追踪——让你知道哪一层挂了

这么多层错误处理，真出了问题怎么排查？

CatBuddy 有一个极简的结构化 Logger：

```typescript:7:67:apps/desktop/src/main/utils/logger.ts
export class Logger {
  private id = 'system';
  private phase = 'start';
  private started = Date.now();
  private enter = Date.now();

  init(id: string): this {
    this.id = id;
    this.started = Date.now();
    this.enter = this.started;
    return this;
  }

  step(phase: string): this {
    if (this.phase !== phase) {
      this.log('DEBUG', `-> ${phase}`, { ms: Date.now() - this.enter });
      this.phase = phase;
      this.enter = Date.now();
    }
    return this;
  }

  transition(from: string, to: string, event: string): this {
    this.log('DEBUG', `${from}:${event} -> ${to}`);
    return this;
  }

  end(msg = 'completed'): this {
    this.log('INFO', `[DONE] ${msg}`, { totalMs: Date.now() - this.started });
    return this;
  }
```

输出格式长这样：

```
[14:23:01] [DEBUG] [turn:a1b2c3d4] [inbound] -> dispatch
[14:23:01] [DEBUG] [turn:a1b2c3d4] [dispatch] RESTORE:ok -> COMPACT
[14:23:01] [DEBUG] [turn:a1b2c3d4] [compact] COMPACT:skipped -> BUILD  
[14:23:02] [DEBUG] [turn:a1b2c3d4] [build] BUILD:context_ready -> RUN
[14:23:05] [WARN] [turn:a1b2c3d4] [run] [fallback] primary (deepseek) transient error, trying next...
[14:23:05] [INFO] [turn:a1b2c3d4] [run] [fallback] Switched to fallback #1: anthropic/claude-3.5-sonnet
[14:23:15] [INFO] [turn:a1b2c3d4] [respond] [DONE] turn completed {totalMs: 14000}
```

每一行都有 `traceId`、`phase`、`状态转换` 和 `耗时`。出问题时，从日志里可以精准定位到：哪个 turn 的哪个阶段，主模型挂了，切到了哪个备用模型，总共花了多少毫秒。

它不是 OpenTelemetry 那种重量级方案——就 70 行代码，但覆盖了 Agent 调试 90% 的场景。

---

## 22.5 为什么最坏情况也返回一个有意义的消息

纵观四层防线，有一个共同的设计原则：**永远不要在用户面前崩溃。**

最坏情况下（所有 Provider 都挂了），返回的是：

```
"All providers failed. Please check your API keys and network connection."
```

这不是随便写的。它告诉用户三件事：
1. **发生了什么**：API 调用失败
2. **可能的原因**：API Key 或网络问题
3. **用户可以做什么**：检查 API Key 和网络

对比一下如果什么都没返回——用户看到的就是一片空白，不知道发生了什么，也不知道该怎么办。这条兜底消息虽然不能解决根本问题，但至少让用户**知道发生了什么，并且有下一步行动方向。**

---

## 22.6 总结

> **这篇讲了什么？**
>
> 1. **Provider 重试层**：`chatStreamWithRetry()` 区分瞬态错误（429/5xx/timeout）和永久错误（4xx 非 429），瞬态用指数退避重试。AbortError 直接穿透不重试——用户的 `/stop` 指令优先级最高。
>
> 2. **Fallback 链层**：`FallbackProvider` 把主模型和备用模型串成链。任一 Provider 失败自动切下一个，最终兜底返回 "All providers failed"。覆盖了 `chatStreamWithRetry()` 避免双重重试的指数膨胀。
>
> 3. **AgentRunner 自恢复层**：空响应重试（最多 2 次）、max_tokens 截断续写（最多 3 次）、工具异常兜底（返回 `Error: ${err.message}` 让 LLM 自己调整策略）。
>
> 4. **Logger 链路追踪**：70 行的结构化 Logger，每次 turn 记录完整的阶段转换、状态变化和耗时。出问题时从日志能精准定位到哪一层、哪个 Provider、花了多少毫秒。
>
> 5. **设计哲学**：四层防线的共同原则是"永远不在用户面前崩溃"。每一层都吞掉自己能处理的错误，处理不了的传给下一层。最坏情况下返回一条有意义的消息，而不是 `undefined` 或白屏。

> 下一篇是专栏的最后一篇——三端部署与发布。Gateway 用 Docker Compose，Web 是静态文件 + CDN，Desktop 用 electron-builder 打包成三平台安装包。三者怎么协同发版？CI/CD 流水线怎么设计？
