# Langfuse Agent 监控集成文档

> CatBuddy Desktop Agent 全链路 LLM 可观测性，基于 [Langfuse](https://langfuse.com/)

## 目录

- [架构概述](#架构概述)
- [一、Langfuse 上注册项目](#一langfuse-上注册项目)
- [二、环境变量配置](#二环境变量配置)
- [三、启动追](#三启动追踪)
- [四、Langfuse 仪表盘观测指南](#四langfuse-仪表盘观测指南)
- [五、数据模型详解](#五数据模型详解)
- [六、常见问题排查](#六常见问题排查)

---

## 架构概述

```
┌─────────────────────────────────────────────────────────────┐
│                     CatBuddy AgentLoop                       │
│                                                              │
│  process(msg)                                                │
│    │                                                         │
│    ▼                                                         │
│  _state_run() ───► AgentRunner.run()                         │
│    │                    │                                    │
│    │              ┌─────┴──────┐                             │
│    │              │  AgentHook  │────► LangfuseAgentHook      │
│    │              └─────┬──────┘         │                   │
│    │                    │                │                   │
│    │    beforeIteration ◄────────────────┤ 创建 Generation    │
│    │    beforeExecuteTools ◄─────────────┤ 记录 Token 用量    │
│    │    afterIteration  ◄────────────────┤ 结束 Generation    │
│    │                    │                │ 创建 Tool Span     │
│    │                    │                │ 更新 Trace 输出    │
│    │                    │                │                   │
│    ▼                    ▼                ▼                   │
│  ┌──────────────────────────────────────────────────────────┐│
│  │              LangfuseClient (单例)                        ││
│  │  • 批量上报 (默认 10 条/5秒)                              ││
│  │  • 懒初始化 (enabled=true + key 齐全)                     ││
│  │  • 静默失败 (上报异常不影响 Agent)                        ││
│  └──────────────────────────────────────────────────────────┘│
│                              │                                │
└──────────────────────────────┼────────────────────────────────┘
                               │ HTTPS
                               ▼
               ┌─────────────────────────────┐
               │   Langfuse Cloud / 自托管    │
               │                               │
               │  Trace → Generation → Span   │
               └─────────────────────────────┘
```

---

## 一、Langfuse 上注册项目

### 方式 A：Langfuse Cloud（推荐，免费额度足够个人评测）

1. 打开 [https://cloud.langfuse.com](https://cloud.langfuse.com)
2. 注册账号（支持 GitHub / Google 登录）
3. 登录后，进入 **Settings → Projects**，新建一个项目（如 `catbuddy-agent-eval`）
4. 进入项目后，左侧菜单 **Settings → API Keys**
5. 点击 **"Create API Key"**，你会看到：

```
Public Key:  pk-lf-xxxxxxxxxxxxxxxxxxxxxxxx
Secret Key:  sk-lf-xxxxxxxxxxxxxxxxxxxxxxxx
```

> **注意**：Secret Key 只创建时显示一次，请立即保存。

### 方式 B：自托管部署

```bash
# Docker Compose 快速部署
git clone https://github.com/langfuse/langfuse.git
cd langfuse
cp .env.example .env        # 编辑数据库连接等配置
docker compose up -d
```

自托管后，访问 `http://localhost:3000`，同样在 **Settings → Projects → API Keys** 创建 Key。

---

## 二、环境变量配置

在 CatBuddy 项目根目录创建 `.env` 文件（如果不存在）：

```env
# ── Langfuse 追踪配置 ──

# 总开关：设为 true 启用追踪
LANGFUSE_ENABLED=true

# 从 Langfuse Settings → API Keys 获取
LANGFUSE_PUBLIC_KEY=pk-lf-xxxxxxxxxxxxxxxxxxxxxxxx
LANGFUSE_SECRET_KEY=sk-lf-xxxxxxxxxxxxxxxxxxxxxxxx

# Cloud 用户无需修改；自托管改为你的地址
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

> 配置也可以在 `catbuddy-config.json` 的 `langfuse` 字段中设置（优先级高于环境变量），详情见 [配置字段说明](#配置参考)。

### 启动验证

启动 CatBuddy Desktop 后，查看终端日志：

```
[langfuse] initialized, baseUrl=https://cloud.langfuse.com
[init] Langfuse tracing enabled
```

如果看到这两行，说明集成成功。

---

## 三、启动追踪

### 3.1 追踪发生时机

每次用户在 CatBuddy 中发送一条消息，AgentLoop 自动：

1. **创建 Trace** — 命名为 `agent-turn`，关联到当前 session
2. **每轮 LLM 调用创建 Generation** — 命名为 `llm-iter-1`, `llm-iter-2`...
3. **每个工具调用创建 Span** — 命名为 `tool:read_file`, `tool:exec`...
4. **Turn 结束** — 批量上报到 Langfuse

### 3.2 查看实时指标

终端日志会输出每轮统计：

```
[langfuse] turn complete | iterations=3 tokens(in=12400/out=860) tools=[read_file,write_file,exec] stop=end_turn
```

### 3.3 预热一下

发送几条不同类型的测试消息，确保生成追踪数据：

| 测试消息 | 目的 |
|---------|------|
| `"你好"` | 纯对话，验证 Trace/Generation 基础记录 |
| `"读一下 package.json"` | 工具调用（read_file），验证 Span 记录 |
| `"创建一个 hello.txt，内容为 World"` | 多工具调用（read+write），验证多 Span |
| `"帮我检查 tsconfig.json，如果有问题修复它"` | 复杂多轮，验证多 Generation 完整链路 |

---

## 四、Langfuse 仪表盘观测指南

### 4.1 入口：Traces 列表

登录 Langfuse → 进入项目 → 点击顶部 **"Tracing"** 标签页。

你会看到一个 Traces 列表，每条 Trace 对应 CatBuddy 中一次完整的用户消息处理：

```
┌──────────────────────────────────────────────────────────────────────┐
│  Traces                                                              │
├────────────┬──────────────┬──────────┬──────────┬───────────────────┤
│  ID        │ Name         │ User     │ Duration │ Input             │
├────────────┼──────────────┼──────────┼──────────┼───────────────────┤
│  trace_xxx │ agent-turn   │ desktop… │ 4.2s     │ "帮我检查 tscon…" │
│  trace_yyy │ agent-turn   │ desktop… │ 1.8s     │ "你好"            │
│  trace_zzz │ agent-turn   │ desktop… │ 9.7s     │ "读一下 package…" │
└────────────┴──────────────┴──────────┴──────────┴───────────────────┘
```

**关键列说明**：
| 列 | 含义 |
|---|------|
| **Name** | Trace 名称，固定为 `agent-turn` |
| **User ID** | session key，对应当前会话 |
| **Duration** | 从 LLM 首次响应到最终回复的总耗时 |
| **Input** | 用户原始消息内容 |
| **Observed** | Token 数量（prompt + completion） |

### 4.2 深入：单条 Trace 详情

点击任意 Trace，进入详细视图。这是评测 Agent 最重要的页面：

```
┌─────────────────────────────────────────────────────────────┐
│  Trace: agent-turn                                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Metadata                                               │ │
│  │  • workspace:  /Users/xxx/project                       │ │
│  │  • model:      deepseek-chat                            │ │
│  │  • temperature: 0.7                                     │ │
│  │  • maxTokens:   4096                                    │ │
│  │  Tags: [agent, catbuddy]                                │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Output                                                 │ │
│  │  • finalContent: "tsconfig.json 已按规范修复…"          │ │
│  │  • stopReason:  end_turn                                │ │
│  │  • iterations:  3                                       │ │
│  │  • toolsUsed:   [read_file, write_file, exec]           │ │
│  │  • totalInputTokens:  12400                             │ │
│  │  • totalOutputTokens: 860                               │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ═══════════════════════════════════════════════════════════ │
│  ▼ Generations (3)                                          │
│  ┌────────────────────┬────────┬────────────┬─────────────┐ │
│  │  Name              │ Model  │ Tokens     │ Duration    │ │
│  ├────────────────────┼────────┼────────────┼─────────────┤ │
│  │  llm-iter-1        │ deep…  │ 4200→350   │ 2.1s        │ │
│  │  └─ tool:read_file │  Span  │            │ 0.15s       │ │
│  ├────────────────────┼────────┼────────────┼─────────────┤ │
│  │  llm-iter-2        │ deep…  │ 5200→310   │ 2.8s        │ │
│  │  └─ tool:write_file│  Span  │            │ 0.08s       │ │
│  │  └─ tool:exec      │  Span  │            │ 0.32s       │ │
│  ├────────────────────┼────────┼────────────┼─────────────┤ │
│  │  llm-iter-3        │ deep…  │ 3000→200   │ 1.3s        │ │
│  │  (最终回复)         │        │            │             │ │
│  └────────────────────┴────────┴────────────┴─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 核心观测指标

#### 🔥 按 Trace 看（一轮对话）

| 指标 | 观测方式 | 评测意义 |
|------|---------|---------|
| **迭代次数** (`iterations`) | Trace Output | 越多 = Agent 越"犹豫"，理想值 1-3 |
| **总 Token** (`totalTokens`) | Trace Metadata | 成本指标，越低越好 |
| **工具调用数** (`toolsUsedCount`) | Trace Metadata | 反映 Agent 解决任务的复杂度 |
| **停止原因** (`stopReason`) | Trace Output | `end_turn`=正常, `max_iterations`=超限需调参 |
| **总耗时** | Trace Duration | 用户体验指标 |

#### 🔥 按 Generation 看（每轮 LLM 调用）

| 指标 | 观测方式 | 评测意义 |
|------|---------|---------|
| **Prompt Tokens** | Generation Observed | 上下文膨胀检测 |
| **Completion Tokens** | Generation Observed | 输出长度 |
| **finishReason** | Generation Output | `tool_calls`=还需工具, `stop`=完成 |
| **Duration** | Generation Metadata | 模型响应速度 |

#### 🔥 按 Span 看（工具调用）

| 指标 | 观测方式 | 评测意义 |
|------|---------|---------|
| **Tool Duration** | Span Metadata | 找到慢工具 |
| **Tool Error** | Span Metadata | 哪个工具经常失败 |
| **Tool Output** | Span Output | 工具返回质量 |

### 4.4 Sessions 视图

顶部菜单 **"Sessions"** → 可以看到按 session 分组的 Traces，适合观察同一个会话中 Agent 的长期表现。

### 4.5 自定义评分（Score）

Langfuse 支持给 Trace 手动或 API 打分，用于评测。在 Trace 详情页右侧 **"Scores"** 区域：

1. 点击 **"Add Score"**
2. 填入名称（如 `answer_quality`、`tool_accuracy`）
3. 填入分值（0-1）和备注

之后可以对 Score 做聚合分析（平均值、分布等）。

---

## 五、数据模型详解

### 5.1 Trace 字段

| 字段 | 类型 | 来源 | 说明 |
|------|------|------|------|
| `name` | string | 固定 `"agent-turn"` | Trace 名称 |
| `userId` | string | `sessionKey` | 关联到 CatBuddy 会话 |
| `sessionId` | string | `sessionKey` | 会话 ID，Sessions 视图用 |
| `input` | string | 用户消息内容 | 本轮对话的输入 |
| `output.finalContent` | string | Agent 最终回复 | 完整输出（截断至 2000 字） |
| `output.stopReason` | string | `end_turn` / `max_iterations` / ... | 停止原因 |
| `output.iterations` | number | 实际迭代次数 | LLM 调用轮数 |
| `output.toolsUsed` | string[] | 去重后的工具名 | 本轮使用的所有工具 |
| `output.totalInputTokens` | number | 累加 | Prompt Tokens 总计 |
| `output.totalOutputTokens` | number | 累加 | Completion Tokens 总计 |
| `metadata.workspace` | string | 工作目录路径 | 关联到具体项目 |
| `metadata.iterations` | number | 同 output.iterations | 冗余存储方便筛选 |
| `metadata.toolsUsedCount` | number | 工具种类数 | |
| `metadata.totalTokens` | number | input + output | 总 Token |
| `tags` | string[] | `["agent", "catbuddy"]` | 全局筛选 |

### 5.2 Generation 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | `llm-iter-1`, `llm-iter-2`... |
| `model` | string | 实际使用的模型名 |
| `modelParameters.temperature` | number | 温度参数 |
| `modelParameters.maxTokens` | number | 最大输出 Token |
| `input` | array | 最近 20 条消息摘要（每条截断至 500 字） |
| `output.content` | string | 模型回复内容（截断至 2000 字） |
| `output.finishReason` | string | `stop` / `tool_calls` / ... |
| `output.toolCallCount` | number | 本轮触发的工具数 |
| `output.reasoningContent` | string | 思维链内容（DeepSeek 等支持） |
| `usage.promptTokens` | number | 本轮 Prompt Tokens |
| `usage.completionTokens` | number | 本轮 Completion Tokens |
| `metadata.durationMs` | number | 本轮 LLM 调用耗时（ms） |
| `metadata.streamedContent` | boolean | 是否通过流推送了正文 |
| `metadata.streamedReasoning` | boolean | 是否通过流推送了思维链 |
| `metadata.toolCalls` | string[] | 本轮触发工具列表 |

### 5.3 Span 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | `tool:{工具名}`，如 `tool:read_file` |
| `input` | object | 工具参数摘要（字符串截断至 200 字，对象简化） |
| `output` | string | 工具返回结果（截断至 1000 字） |
| `level` | string | `DEFAULT` / `ERROR` |
| `metadata.status` | string | `started` / `completed` / `error` |
| `metadata.durationMs` | number | 工具执行耗时 |
| `metadata.error` | string | 错误详情（仅 `status=error`） |

---

## 六、常见问题排查

### Q: 终端没看到 `[langfuse] initialized`？

**原因**：环境变量未生效或配置不正确。

**检查清单**：
1. `.env` 文件是否在 CatBuddy 运行目录下？
2. `LANGFUSE_ENABLED=true` 是否拼写正确？
3. Public/Secret Key 格式是否正确？（`pk-lf-...` / `sk-lf-...`）

### Q: 初始化成功但 Langfuse 仪表盘看不到数据？

**排查步骤**：
1. 确认终端有 `[langfuse] turn complete` 日志 — 这说明 Hook 正在工作
2. 等待 5-10 秒（SDK 批量上报间隔内缓存）后刷新
3. 检查 `LANGFUSE_BASE_URL` 是否正确（Cloud 用户应为 `https://cloud.langfuse.com`）
4. 检查网络是否可访问 Langfuse 服务

### Q: 数据量太大 / Token 消耗太多？

**解决方案**：
1. 编辑 `langfuse-hook.ts`，增大 `_truncate` 的截断阈值
2. 在 `beforeIteration` 中 `_summarizeMessages` 减少保留条数（当前 20）
3. 考虑只在 `config.langfuse.enabled=true` 时启用

### Q: Langfuse 影响 Agent 性能吗？

**不会**。集成采用以下策略：
- **异步**：SDK 批量上报，不会阻塞 Agent 主流程
- **静默失败**：所有 Langfuse 操作 try-catch，失败忽略
- **截断**：消息/Tool 结果 /输出均截断，不会发送超大数据
- **仅非心跳**：心跳消息不触发 flush

### Q: 如何关闭追踪？

设置环境变量：
```env
LANGFUSE_ENABLED=false
```

或修改 `config.json`：
```json
{
  "langfuse": {
    "enabled": false
  }
}
```

---

## 配置参考

### 完整配置字段

```json
{
  "langfuse": {
    "enabled": true,
    "publicKey": "pk-lf-xxxxxxxx",
    "secretKey": "sk-lf-xxxxxxxx",
    "baseUrl": "https://cloud.langfuse.com",
    "flushAt": 10,
    "flushInterval": 5000
  }
}
```

| 字段 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | 是 | `false` | 总开关 |
| `publicKey` | 是 | - | Langfuse Public Key |
| `secretKey` | 是 | - | Langfuse Secret Key |
| `baseUrl` | 否 | `https://cloud.langfuse.com` | Cloud 用户无需修改 |
| `flushAt` | 否 | `10` | 累积多少事件后上报 |
| `flushInterval` | 否 | `5000` | 上报间隔（毫秒） |

### 环境变量对应

| 环境变量 | 配置字段 |
|----------|----------|
| `LANGFUSE_ENABLED` | `langfuse.enabled` |
| `LANGFUSE_PUBLIC_KEY` | `langfuse.publicKey` |
| `LANGFUSE_SECRET_KEY` | `langfuse.secretKey` |
| `LANGFUSE_BASE_URL` | `langfuse.baseUrl` |

> 优先级：**config.json > 环境变量**（`enabled` 字段略有不同，只要任一来源为 true 即启用）

---

## 文件索引

| 文件 | 说明 |
|------|------|
| `apps/desktop/src/main/agent/langfuse-client.ts` | Langfuse SDK 单例，初始化/Flush/Shutdown |
| `apps/desktop/src/main/agent/langfuse-hook.ts` | AgentHook 实现，创建 Trace/Generation/Span |
| `apps/desktop/src/main/agent/loop.ts` | AgentLoop 注入 Hook 的位置 |
| `apps/desktop/src/main/services/init-agent.ts` | 启动时初始化 Langfuse |
| `apps/desktop/src/main/config/defaults.ts` | 默认配置 |
| `packages/shared/src/agent-types.ts` | `LangfuseConfig` 类型定义 |
