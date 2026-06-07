# Langfuse 代码架构文档

> CatBuddy Desktop Agent 全链路 LLM 可观测性 — 代码架构全景

---

## 目录

- [一、架构总览](#一架构总览)
- [二、分层详解](#二分层详解)
  - [配置层](#配置层)
  - [初始化层](#初始化层)
  - [运行时层](#运行时层)
  - [Runner 调度层](#runner-调度层)
  - [Hook 实现层](#hook-实现层)
  - [客户端上报层](#客户端上报层)
- [三、完整调用链路](#三完整调用链路)
- [四、数据模型](#四数据模型)
- [五、安全与性能设计](#五安全与性能设计)
- [六、文件索引](#六文件索引)

---

## 一、架构总览

```
┌──────────────────────────────────────────────────────────────────────┐
│                       配置层                                          │
│  agent-types.ts    → LangfuseConfig 类型定义                          │
│  defaults.ts       → 默认值 enabled=false, flushAt=10, interval=5s   │
│  来源: .env / catbuddy-config.json                                    │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     初始化层 (init-agent.ts)                           │
│  ① getLangfuseClient()              ← 全局单例                        │
│  ② LangfuseClient.buildOptions()    ← 拼装 config + env              │
│  ③ langfuseClient.initialize()      ← new Langfuse SDK               │
│  ④ agentLoop.setLangfuseClient()    ← 注入 AgentLoop                  │
│  ⑤ app.on('will-quit') shutdown()   ← 退出清理                       │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     运行时层 (loop.ts)                                 │
│  AgentLoop._state_run():                                              │
│    new LangfuseAgentHook({ client, sessionKey, model, workspace })    │
│    runner.run({ ..., hook: langfuseHook })   ← 注入 Hook              │
│    langfuseClient.flush()                    ← 异步上报               │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│               Runner 调度层 (runner.ts + hook.ts)                      │
│  AgentRunner.run() 循环:                                              │
│    hook.beforeIteration()       → 每轮 LLM 前                         │
│    llm.chat()                   → 调用 LLM                            │
│    hook.beforeExecuteTools()    → 工具执行前                          │
│    runTool()...                 → 执行工具                            │
│    hook.afterIteration()        → 每轮结束后                          │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│              Hook 实现层 (langfuse-hook.ts)                            │
│  beforeIteration:     懒创建 Trace + Generation                        │
│  beforeExecuteTools:  累加 token 用量 + 记录工具列表                    │
│  afterIteration:      创建 Span + 结束 Generation + 更新 Trace         │
└───────────────────────────────┬──────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│           客户端上报层 (langfuse-client.ts)                             │
│  LangfuseClient (单例):                                               │
│    createTrace() / createErrorTrace()  → Trace                        │
│    createScore()                       → REST API                     │
│    flush() / shutdown()                → 批量上报/优雅关闭             │
│    maskSensitiveData()                 → PII 脱敏                     │
│                          │ HTTPS                                      │
│                          ▼                                            │
│          Langfuse Cloud / 自托管                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 二、分层详解

### 配置层

**类型定义** — `packages/shared/src/agent-types.ts` (第199-212行)：

```typescript
export interface LangfuseConfig {
  enabled: boolean           // 总开关
  publicKey: string          // pk-lf-...
  secretKey: string          // sk-lf-...
  baseUrl: string            // 默认 https://cloud.langfuse.com
  flushAt?: number           // 批量上报阈值，默认 10
  flushInterval?: number     // 批量上报间隔(ms)，默认 5000
}
```

作为 `catbuddyConfig.langfuse` 可选字段（第248行）。

**默认值** — `apps/desktop/src/main/config/defaults.ts` (第64-71行)：

```typescript
langfuse: {
  enabled: false,                          // 默认关闭
  publicKey: process.env.LANGFUSE_PUBLIC_KEY?.trim() || '',
  secretKey: process.env.LANGFUSE_SECRET_KEY?.trim() || '',
  baseUrl: process.env.LANGFUSE_BASE_URL?.trim() || 'https://cloud.langfuse.com',
  flushAt: 10,
  flushInterval: 5000,
},
```

配置优先级：**config.json > 环境变量**。

---

### 初始化层

**文件**：`apps/desktop/src/main/services/init-agent.ts` (第94-127行)

```typescript
// ① 获取全局单例
const langfuseClient = getLangfuseClient();
// ② 从 config + env 拼装配置
const lfOpts = LangfuseClient.buildOptions(config.langfuse);
// ③ 初始化 SDK (new Langfuse({...}))
langfuseClient.initialize(lfOpts);
// ④ 注入 AgentLoop
if (langfuseClient.enabled) {
  agentLoop.setLangfuseClient(langfuseClient);
}
// ⑤ 退出时优雅关闭
app.on("will-quit", () => {
  langfuseClient.shutdown().catch(...);
});
```

---

### 运行时层

**文件**：`apps/desktop/src/main/agent/loop.ts`

关键字段和方法：

```typescript
// 第172行
private _langfuseClient: LangfuseClient | null = null;

// 第284行
setLangfuseClient(client: LangfuseClient): void { this._langfuseClient = client }
```

每次消息处理 (`_state_run()`, 第892-954行)：

```typescript
// ① 创建 LangfuseAgentHook（仅当 langfuse 已启用）
const langfuseHook = this._langfuseClient?.enabled
  ? new LangfuseAgentHook({
      client: this._langfuseClient,
      sessionKey: ctx.sessionKey,
      workspace: this.workspace,
      model: this.model,
      temperature: ..., maxTokens: ...,
      userMessage: ctx.msg.content,   // 用户消息作为 trace input
    })
  : undefined;

// ② 注入 Runner
const result = await runner.run({ ..., hook: langfuseHook });

// ③ 终端统计 + 异步上报
if (langfuseHook) {
  const metrics = langfuseHook.getMetrics();
  logger.info(`[langfuse] turn complete | iterations=... tokens=... tools=...`);
  if (!isHeartbeatMessage(ctx.msg)) {
    this._langfuseClient?.flush();    // 非心跳消息 flush
  }
}
```

异常捕获（第579-586行）：

```typescript
// dispatch 错误也创建 Trace
if (this._langfuseClient?.enabled) {
  this._langfuseClient.createErrorTrace({
    name: 'dispatch-error', sessionId: key, error: detail,
    metadata: { channel, chatId },
  });
}
```

---

### Runner 调度层

**AgentHook 基类** — `apps/desktop/src/main/agent/hook.ts`：

```typescript
export class AgentHook {
  // 生命周期方法（空实现，由子类重写）
  async beforeIteration(ctx): Promise<void> {}        // 每轮 LLM 前
  async beforeExecuteTools(ctx): Promise<void> {}     // 工具执行前
  async afterIteration(ctx): Promise<void> {}         // 每轮结束后
  wantsStreaming(): boolean { return false }
  finalizeContent(ctx, content) { return content }
}
```

**CompositeHook** 支持组合多个 Hook（第54-117行）。

**Runner 调度** — `apps/desktop/src/main/agent/runner.ts`：

```typescript
const hook = spec.hook ?? new AgentHook();           // 无 Hook 用空实现

for (let iteration = 0; iteration < maxIterations; iteration++) {
  await hook.beforeIteration(hookCtx);               // ① 创建 Trace/Generation
  const response = await llm.chat(messages);         // ② LLM 调用
  if (response.toolCalls.length > 0) {
    await hook.beforeExecuteTools(hookCtx);          // ③ 记录 Token/Tools
    // ... 执行工具 ...
  }
  await hook.afterIteration(hookCtx);                // ④ 创建 Span/结束 Generation
}
```

---

### Hook 实现层

**文件**：`apps/desktop/src/main/agent/langfuse-hook.ts`

**核心状态**：

```typescript
private trace: LangfuseTraceClient | null = null          // Trace
private currentGeneration: LangfuseGenerationClient        // 当前 Generation
private iterationCount = 0                                 // 迭代计数
private totalInputTokens = 0                               // 累计 Token
private totalOutputTokens = 0
private allToolsUsed: Set<string> = new Set()             // 去重工具集
```

**三个生命周期方法**：

| 方法 | 关键操作 |
|------|---------|
| `beforeIteration` | ① `ensureTrace()` 懒创建 Trace `"agent-turn"`（首轮）<br>② `trace.generation("llm-iter-N")` 创建 Generation |
| `beforeExecuteTools` | ① 累加 `totalInputTokens / totalOutputTokens`<br>② `generation.update({ toolCalls })` 记录工具列表 |
| `afterIteration` | ① `trace.span("tool:xxx")` + `span.end()` 为每个工具创建 Span<br>② `generation.end({ output, usage, metadata })` 结束 Generation<br>③ 如有 `finalContent`，则 `trace.update({ output, metadata })` 最终化 Trace |

**数据删减策略**：

- 消息摘要：只保留最近 20 条，单条截断 500 字
- 工具参数：字符串截断 200 字，对象/数组替换为 `[array(N)]` / `[object]`
- 工具输出：截断 1000 字
- 模型回复：截断 2000 字
- 关键字脱敏：`maskSensitiveData()` 处理所有 input/output

---

### 客户端上报层

**文件**：`apps/desktop/src/main/agent/langfuse-client.ts`

**单例模式**（第17、258-263行）：

```typescript
let _instance: LangfuseClient | null = null;
export function getLangfuseClient(): LangfuseClient {
  if (!_instance) _instance = new LangfuseClient();
  return _instance;
}
```

**初始化**（第83-123行）：`new Langfuse({ publicKey, secretKey, baseUrl, flushAt, flushInterval })`。

**配置拼装**（第126-141行）：`config.json > 环境变量`。

**核心 API**：

| 方法 | 功能 |
|------|------|
| `createTrace()` | 创建 Trace，注入 `v:*` / `env:*` 标签 |
| `createErrorTrace()` | 错误 Trace，tags 加 `error` |
| `createScore()` | 通过 REST `POST /api/public/scores` 打分 |
| `flush()` | `client.flushAsync()` 批量上报 |
| `shutdown()` | `client.shutdownAsync()` 优雅关闭（防重入） |

**数据脱敏**（第272-317行）：自动遮蔽 API Key (`sk-*`/`pk-*`)、JWT Token、常见 secret 格式。

---

## 三、完整调用链路

以用户发送 `"读一下 package.json"` 为例：

```
1. AgentLoop.process("读一下 package.json")
     → new LangfuseAgentHook({ client, sessionKey, workspace, model, userMessage })
     → runner.run({ hook: langfuseHook })

2. llm-iter-1:
   hook.beforeIteration() → Trace "agent-turn" 懒创建 + Generation "llm-iter-1"
   LLM 返回 tool_call: read_file
   hook.beforeExecuteTools() → 累加 token + 记录 toolCalls
   执行 read_file 工具
   hook.afterIteration() → Span "tool:read_file" + Generation.end()

3. llm-iter-2 (最终回复):
   hook.beforeIteration() → Generation "llm-iter-2"
   LLM 返回最终文本
   hook.afterIteration() → Generation.end() + Trace.update(output+metadata)

4. 回到 loop.ts:
   langfuseClient.flush() → 批量上报到 Langfuse
   终端: [langfuse] turn complete | iterations=2 | tokens(in=9400/out=660)
```

上报后数据模型：

```
Trace "agent-turn"                ← 一次用户消息
├─ Generation "llm-iter-1"        ← 第1轮 LLM (tool_calls)
│   └─ Span "tool:read_file"      ← 工具调用
└─ Generation "llm-iter-2"        ← 第2轮 LLM (最终回复)
```

---

## 四、数据模型

### Trace

| 字段 | 来源 | 说明 |
|------|------|------|
| `name` | 固定 | `"agent-turn"` |
| `userId` / `sessionId` | `sessionKey` | 关联会话 |
| `input` | 用户消息 | 脱敏后 |
| `output.finalContent` | Agent 回复 | 截断 2000 字 |
| `output.stopReason` | Runner | `end_turn` / `max_iterations` |
| `output.iterations` | Hook 计数 | LLM 调用轮数 |
| `output.toolsUsed` | Hook 去重 | 工具列表 |
| `output.totalInputTokens` / `totalOutputTokens` | Hook 累加 | Prompt/Completion Token |
| `metadata.toolSuccessRate` | Hook 计算 | 工具成功率 |
| `tags` | 固定 + env/version | `["agent","catbuddy","env:*","v:*"]` |

### Generation

| 字段 | 说明 |
|------|------|
| `name` | `"llm-iter-1"`, `"llm-iter-2"`... |
| `model` | 实际模型名 |
| `modelParameters` | `{ temperature, maxTokens }` |
| `input` | 最近 20 条消息摘要 |
| `output.content` | 模型回复（截断 2000 字） |
| `output.finishReason` | `stop` / `tool_calls` |
| `output.toolCallCount` | 本轮工具数 |
| `usage` | `{ promptTokens, completionTokens }` |
| `metadata.durationMs` | 本轮耗时 |

### Span

| 字段 | 说明 |
|------|------|
| `name` | `"tool:read_file"` / `"tool:write_file"` |
| `input` | 工具参数摘要 |
| `output` | 工具返回（截断 1000 字） |
| `metadata.status` | `started` / `completed` / `error` |
| `metadata.durationMs` | 工具耗时 |
| `metadata.error` | 错误详情（仅 error） |

---

## 五、安全与性能设计

| 设计 | 说明 |
|------|------|
| **异步不阻塞** | SDK 批量上报（默认 10条/5秒），不影响 Agent 主流程 |
| **静默失败** | 所有 Langfuse 操作 try-catch，异常忽略 |
| **PII 脱敏** | `maskSensitiveData()` 递归遮蔽 API Key、JWT、密码 |
| **数据截断** | 消息 500字、工具输出 1000字、最终回复 2000字 |
| **心跳豁免** | `isHeartbeatMessage()` 检查，心跳不触发 flush |
| **懒初始化** | Trace 只在首次 `beforeIteration` 时创建 |
| **优雅关闭** | `app.on('will-quit')` 中 `shutdown()` flush 剩余数据 |
| **版本标签** | 每条 Trace 携带 `v:*` + `env:*` 标签，支持多版本对比 |

---

## 六、文件索引

| 文件 | 职责 |
|------|------|
| `packages/shared/src/agent-types.ts` | `LangfuseConfig` 类型定义 |
| `apps/desktop/src/main/config/defaults.ts` | 默认 langfuse 配置 |
| `apps/desktop/src/main/services/init-agent.ts` | 启动时初始化 + 注入 AgentLoop |
| `apps/desktop/src/main/agent/loop.ts` | 每轮消息创建 Hook + 注入 Runner + flush |
| `apps/desktop/src/main/agent/runner.ts` | 按 AgentHook 生命周期调度 |
| `apps/desktop/src/main/agent/hook.ts` | AgentHook 基类 + CompositeHook |
| `apps/desktop/src/main/agent/langfuse-hook.ts` | LangfuseAgentHook（Trace/Gen/Span 创建核心） |
| `apps/desktop/src/main/agent/langfuse-client.ts` | LangfuseClient 单例（SDK 封装+脱敏+Score） |
