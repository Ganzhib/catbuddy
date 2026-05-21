
# `nanobot/agent/loop.py` 架构引擎深度解读

## 一、总体定位

`loop.py` 是 `nanobot` 项目的**核心编排引擎**，约 1600 行代码。它承接来自各通道（CLI / WebSocket / Telegram / Slack等）的消息，经过一个 **7 阶段状态机** 处理后返回响应。可以理解为一个 **Agent 的操作系统内核** ——它不直接做具体工作，而是调度所有子系统协同运作。

---

## 二、状态机：消息处理的七阶段流水线

```
InboundMessage
    │
    ▼
RESTORE ──ok──▶ COMPACT ──ok──▶ COMMAND ─┬─shortcut──▶ DONE
                                          │
                                          └─dispatch──▶ BUILD ──ok──▶ RUN ──ok──▶ SAVE ──ok──▶ RESPOND ──ok──▶ DONE
                                                                                                          │
                                                                                                   OutboundMessage
```

每个状态对应 `_state_xxx()` 方法：

| 状态        | 方法                 | 核心职责                                                                                |
| ----------- | -------------------- | --------------------------------------------------------------------------------------- |
| `RESTORE` | `_state_restore()` | 恢复崩溃时的检查点；提取文档附件；确保 session 存在                                     |
| `COMPACT` | `_state_compact()` | 检查是否需要触发记忆压缩（`AutoCompact.prepare_session()`）                           |
| `COMMAND` | `_state_command()` | 匹配斜杠命令（`/stop`, `/new`, `/model` 等），命令命中则**短路**到 `DONE` |
| `BUILD`   | `_state_build()`   | 组装 LLM 上下文：拉取历史、构建 system prompt、解析工具上下文                           |
| `RUN`     | `_state_run()`     | **核心执行**：调用 LLM + 工具调用循环（通过 `AgentRunner`）                     |
| `SAVE`    | `_state_save()`    | 将本轮消息持久化到 session；清理检查点；触发后台 consolidation                          |
| `RESPOND` | `_state_respond()` | 组装最终的 `OutboundMessage`（含媒体、延迟元数据）                                    |

---

## 三、模块串联：全链路拓扑

```
                          ┌──────────────────────────────────────────────┐
                          │                 AgentLoop                    │
                          │                                              │
    MessageBus ──────────▶│  run()  ──▶ _dispatch() ──▶ _process_message│
    (bus/queue.py)        │                │                 │           │
                          │                │                 ▼           │
                          │                │       7-Stage State Machine │
                          │                │                 │           │
                          │                │    ┌────────────┼───────┐   │
                          │                │    │            │       │   │
                          │                │    ▼            ▼       ▼   │
                          │         ┌──────┴──────────────────────────┐  │
                          │         │   _run_agent_loop()              │  │
                          │         │   ┌──────────────────────────┐  │  │
                          │         │   │    AgentRunner.run()      │  │  │
                          │         │   │   (agent/runner.py)       │  │  │
                          │         │   │   ├─ LLMProvider.chat()   │  │  │
                          │         │   │   ├─ ToolRegistry.exec()  │  │  │
                          │         │   │   └─ 迭代直到 stop/max    │  │  │
                          │         │   └──────────────────────────┘  │  │
                          │         └─────────────────────────────────┘  │
                          │                     │                        │
                          └─────────────────────┼────────────────────────┘
                                                ▼
                                         OutboundMessage
                                                │
                                                ▼
                                          MessageBus
                                                │
                                    ┌───────────┼───────────┐
                                    ▼           ▼           ▼
                                  CLI      WebSocket    Telegram...
```

---

## 四、关键子系统详解

### 4.1 消息总线 (`bus/`)

```
InboundMessage                  OutboundMessage
┌──────────────┐               ┌──────────────┐
│ channel      │               │ channel      │
│ sender_id    │               │ chat_id      │
│ chat_id      │               │ content      │
│ content      │               │ media        │
│ media        │               │ metadata     │
│ metadata     │               └──────────────┘
│ session_key  │
└──────────────┘
        │                              ▲
        ▼                              │
   MessageBus.inbound          MessageBus.outbound
   (asyncio.Queue)             (asyncio.Queue)
```

- **解耦设计**：通道（Telegram/Discord/Slack/WebSocket/CLI）只需往 `bus` 丢消息，AgentLoop 消费后把结果丢回 `bus`，各通道再推送出去。
- **WebSocket 流式**：通过 `metadata["_wants_stream"]` 标记，`_dispatch()` 动态创建 `on_stream/on_stream_end` 回调，发到 `bus.outbound` 带 `_stream_delta` / `_stream_end` 元数据。

### 4.2 工具系统 (`agent/tools/`)

```
ToolLoader.load() ──pkgutil遍历──▶ 工具发现 ──▶ ToolRegistry.register()
                                                    │
                    ┌───────────────────────────────┤
                    ▼                               ▼
            Tool.execute()                   Tool.to_schema()
            (具体工具逻辑)                    (OpenAI function schema)
```

- **`ToolRegistry`**：工具注册中心，提供 `get_definitions()` 给 LLM，提供 `execute()` 给 runner
- **`ToolLoader`**：通过 `pkgutil.iter_modules` 自动发现 `agent/tools/` 下所有工具类
- **`ToolContext`**：注入 workspace、bus、session、cron_service 等运行时依赖
- **`FileStateStore`**：基于 contextvars 的跨轮次文件读写追踪，防止不同 session 互相干扰
- **`MyTool`**：特殊的自省工具，持有 `AgentLoop` 引用以访问运行时状态

### 4.3 LLM Provider 层 (`providers/`)

```
LLMProvider (abstract)
├── AnthropicProvider        (Anthropic API)
├── OpenAICompatProvider     (OpenAI-compatible API)
├── OpenAICodexProvider      (OpenAI Codex)
├── GitHubCopilotProvider    (GitHub Copilot)
├── AzureOpenAIProvider      (Azure OpenAI)
├── BedrockProvider          (AWS Bedrock)
└── FallbackProvider         (故障转移包装器)
```

- **`ProviderSnapshot`**：冻结 provider + model + context_window_tokens 的不可变快照，用于运行时比较和热切换
- **`_refresh_provider_snapshot()`**：每轮开始时检查配置是否变更，支持**无感热切换**模型
- **模型预设 (Model Preset)**：通过 `set_model_preset()` 一键切换整套模型参数（provider + model + context_window）

### 4.4 记忆系统 (`agent/memory.py`)

```
              ┌─────────────────────────────┐
              │       MemoryStore            │
              │  ├─ MEMORY.md (长期记忆)     │
              │  ├─ history.jsonl (日志)     │
              │  ├─ SOUL.md / USER.md        │
              │  └─ GitStore (版本控制)       │
              └──────────┬──────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼                             ▼
   Consolidator                      Dream
   (轻量压缩：摘要              (深层整合：Phase 1 分析
    写入 MEMORY.md)               + Phase 2 工具调用)
```

- **`Consolidator`**：当 token 预算紧张或会话空闲时，将长历史摘要到 `MEMORY.md`
- **`Dream`**：后台定期运行 LLM 驱动的记忆整合（默认 2 小时间隔），做更深层的知识提取
- **`AutoCompact`**：监控空闲会话的 TTL，自动触发压缩

### 4.5 上下文构建 (`agent/context.py`)

```
ContextBuilder.build_messages()
    │
    ├── System Prompt 组装:
    │   ├── Identity (SOUL.md)
    │   ├── Bootstrap files (AGENTS.md / TOOLS.md / USER.md)
    │   ├── Memory (MEMORY.md)
    │   ├── Skills (SKILL.md)
    │   └── Runtime context (时间/平台/约束)
    │
    ├── History messages (从 Session 拉取)
    │
    └── Current message (用户输入 + 媒体 + 图片生成提示)
```

### 4.6 子Agent系统 (`agent/subagent.py`)

```
SubagentManager
    │
    ├── spawn() ──▶ 创建子Agent任务
    │               (独立的 AgentRunner 实例)
    │
    ├── 通过 MessageBus 通信
    │   (子Agent结果注入为 系统消息)
    │
    └── cancel_by_session() ──▶ 取消某会话下所有子Agent
```

子Agent用于执行 `spawn` 工具触发的后台任务，结果通过 `_process_system_message()` 处理。

### 4.7 命令系统 (`command/`)

```
CommandRouter
    │
    ├── dispatch_priority()  ← /stop, /restart (优先执行，阻塞队列)
    ├── dispatch()           ← 常规命令 (最长前缀匹配)
    │   ├── /new /reset /compact /undo
    │   ├── /model /skills /help
    │   └── 自定义命令...
    │
    └── is_priority() / is_dispatchable_command()
```

### 4.8 会话管理 (`session/`)

```
SessionManager
    │
    ├── get_or_create(key) ──▶ Session { messages, metadata, updated_at }
    ├── save(session)        ──▶ JSONL 文件持久化
    ├── list_sessions()      ──▶ 列出所有会话
    └── 僵尸会话清理
```

---

## 五、并发与背压控制

```
NANOBOT_MAX_CONCURRENT_REQUESTS (默认 3)
        │
        ▼
asyncio.Semaphore ──▶ 限制同时进行的 LLM 调用数

会话级锁 (asyncio.Lock)
        │
        ▼
同一 session 的消息串行处理，防止竞态

注入队列 (asyncio.Queue, maxsize=20)
        │
        ▼
当前轮次进行中，新消息注入 pending queue，在下次 iteration 被 drain
```

---

## 六、关键数据流时序

```
1. MessageBus.consume_inbound()     ← 消费消息
2. _effective_session_key(msg)      ← 确定 session key (统一/独立)
3. 如果 session 有 pending queue → 注入队列，等待当前轮次
4. 否则 asyncio.create_task(_dispatch(msg))  ← 并发调度
       │
5.     _dispatch: 获取 per-session lock + 全局 semaphore
       │
6.     _process_message: 状态机驱动
       │   RESTORE → COMPACT → COMMAND → BUILD → RUN → SAVE → RESPOND
       │
7.     _run_agent_loop: 核心执行
       │   AgentRunner.run(AgentRunSpec(...))
       │   ├─ LLMProvider.chat()     ← 调用 LLM
       │   ├─ ToolRegistry.execute() ← 执行工具
       │   └─ 循环直到 stop_reason
       │
8.     _save_turn: 持久化到 Session
       │
9.     bus.publish_outbound(response)  ← 发送响应
```

---

## 七、总结：设计亮点

1. **状态机模式**：7 阶段流水线清晰分离关注点，每个状态方法职责单一
2. **事件驱动 + 并发控制**：`asyncio.Queue` 解耦通道和核心逻辑，`Semaphore` + `Lock` 控制资源
3. **注入机制**：当前轮次中的新消息通过 `pending_queue` 注入而非新建任务，保证对话连续性
4. **检查点恢复**：运行时 checkpoint 在 `/stop` 或崩溃后能恢复未完成的工具调用结果
5. **热切换模型**：`ProviderSnapshot` 签名比较实现无感模型/Provider 切换
6. **记忆三层架构**：`AutoCompact`（主动）→ `Consolidator`（轻量）→ `Dream`（深层），渐进式压缩
