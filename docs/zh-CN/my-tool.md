# My 工具

让 agent 感知并调整自己的运行时状态——就像问一个同事"你忙吗？能换个大一点的显示器吗？"

## 为什么需要它

普通工具让 agent 在外部世界操作（读/写文件、搜索代码）。但 agent 对自己一无所知——它不知道运行在哪个模型上、还剩多少迭代次数或已消耗多少 token。

My 工具填补了这一空白。有了它，agent 可以：

- **了解自己是谁**：我用什么模型？我的工作区在哪里？还有多少迭代？
- **即时适应**：复杂任务？扩大上下文窗口。简单聊天？切换到更快的模型。
- **跨轮次记忆**：在便签本中保存笔记，持续到下一个对话轮次。

## 配置

默认启用（只读模式）。agent 可以检查自身状态但不能设置。

```yaml
tools:
  my:
    enable: true       # 默认: true
    allow_set: false   # 默认: false（只读）
```

要允许 agent 设置其配置（如切换模型、调整参数），设置 `tools.my.allow_set: true`。

---

## check — 检查"我"的当前状态

无参数时，返回关键配置概览：

```text
my(action="check")
# → max_iterations: 40
#   context_window_tokens: 65536
#   model: 'anthropic/claude-sonnet-4-20250514'
#   workspace: PosixPath('/tmp/workspace')
#   provider_retry_mode: 'standard'
#   max_tool_result_chars: 16000
#   _current_iteration: 3
#   _last_usage: {'prompt_tokens': 45000, 'completion_tokens': 8000}
```

带 key 参数时，深入到特定配置：

```text
my(action="check", key="_last_usage.prompt_tokens")
# → 我已使用了多少 prompt token

my(action="check", key="model")
# → 我当前运行在哪个模型上

my(action="check", key="web_config.enable")
# → 网页搜索是否已启用
```

### 实践场景

| 场景 | 方法 |
|----------|-----|
| "你用什么模型？" | `check("model")` |
| "你还能做多少次工具调用？" | `check("max_iterations")` - `check("_current_iteration")` |
| "这次对话用了多少 token？" | `check("_last_usage")` — 所有轮次的累计 |
| "你的工作目录在哪？" | `check("workspace")` |
| "显示你的完整配置" | `check()` |
| "有子 agent 在运行吗？" | `check("subagents")` — 显示阶段、迭代、耗时、工具事件 |

---

## set — 运行时调整

更改立即生效，无需重启。

```text
my(action="set", key="max_iterations", value=80)
# → 将迭代上限从 40 提升到 80

my(action="set", key="model", value="fast-model")
# → 切换到更快的模型

my(action="set", key="context_window_tokens", value=131072)
# → 为长文档扩展上下文窗口
```

你也可以在便签本中存储自定义状态：

```text
my(action="set", key="current_project", value="nanobot")
my(action="set", key="user_style_preference", value="concise")
my(action="set", key="task_complexity", value="high")
# → 这些值持续到下一个对话轮次
```

### 受保护参数

这些参数有类型和范围验证——无效值会被拒绝：

| 参数 | 类型 | 范围 | 用途 |
|-----------|------|-------|---------|
| `max_iterations` | int | 1–100 | 每次对话轮次的最大工具调用数 |
| `context_window_tokens` | int | 4,096–1,000,000 | 上下文窗口大小 |
| `model` | str | 非空 | 使用的 LLM 模型 |

其他参数（如 `workspace`、`provider_retry_mode`、`max_tool_result_chars`）可以自由设置，只要值是 JSON 安全的即可。

---

## 安全机制

核心设计原则：**所有修改仅存在于内存中。重启恢复默认值。** agent 无法造成持久性破坏。

### 禁止区（BLOCKED）

不可检查或修改——完全隐藏：

| 类别 | 属性 | 原因 |
|----------|-----------|--------|
| 核心基础设施 | `bus`、`provider`、`_running` | 更改会崩溃系统 |
| 工具注册表 | `tools` | 不能移除自己的工具 |
| 子系统 | `runner`、`sessions`、`consolidator` 等 | 影响其他用户/会话 |
| 敏感数据 | `_mcp_servers`、`_pending_queues` 等 | 包含凭证和消息路由 |
| 安全边界 | `restrict_to_workspace`、`channels_config` | 绕过会破坏隔离 |
| Python 内部 | `__class__`、`__dict__` 等 | 防止沙箱逃逸 |

### 只读（check only）

可以检查但不能设置：

| 类别 | 属性 | 原因 |
|----------|-----------|--------|
| 子 agent 管理器 | `subagents` | 可观察，但替换会破坏系统 |
| 执行配置 | `exec_config` | 可检查沙箱/启用状态，不可更改 |
| Web 配置 | `web_config` | 可检查启用状态，不可更改 |
| 迭代计数器 | `_current_iteration` | 仅由 runner 更新 |

### 敏感字段保护

匹配敏感名称的子字段（`api_key`、`password`、`secret`、`token` 等）无论其父路径如何，都不可检查和设置。这通过点路径遍历阻止了凭证泄漏（例如 `web_config.search.api_key`）。
