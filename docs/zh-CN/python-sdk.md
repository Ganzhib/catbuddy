# Python SDK

将 nanobot 作为库使用——无需 CLI，无需网关，只需 Python。

## 快速开始

```python
import asyncio

from nanobot import Nanobot


async def main() -> None:
    bot = Nanobot.from_config()
    result = await bot.run("东京现在几点了？")
    print(result.content)


asyncio.run(main())
```

`Nanobot.from_config()` 复用你正常的 `~/.nanobot/config.json`，因此除非显式覆盖，SDK 遵循与 CLI 相同的 provider、模型、工具和工作区默认值。

## 常见模式

### 使用指定的配置或工作区

```python
from nanobot import Nanobot

bot = Nanobot.from_config(
    config_path="~/.nanobot/config.json",
    workspace="/my/project",
)
```

### 使用 `session_key` 隔离对话

不同的 session key 维护独立的对话历史：

```python
await bot.run("hi", session_key="user-alice")
await bot.run("hi", session_key="task-42")
```

### 附加 Hook 以获得可观测性

Hook 让你在不修改 nanobot 内部的情况下检查工具调用、流式传输和迭代状态：

```python
from nanobot.agent import AgentHook, AgentHookContext


class AuditHook(AgentHook):
    async def before_execute_tools(self, context: AgentHookContext) -> None:
        for tc in context.tool_calls:
            print(f"[tool] {tc.name}")


result = await bot.run("审查这个变更", hooks=[AuditHook()])
```

## API 参考

### `Nanobot.from_config(config_path=None, *, workspace=None)`

从配置文件创建 `Nanobot` 实例。

| 参数 | 类型 | 默认值 | 说明 |
|-------|------|---------|-------------|
| `config_path` | `str \| Path \| None` | `None` | `config.json` 路径。默认为 `~/.nanobot/config.json`。 |
| `workspace` | `str \| Path \| None` | `None` | 覆盖配置中的工作区目录。 |

若显式的配置路径不存在则引发 `FileNotFoundError`。

### `await bot.run(message, *, session_key="sdk:default", hooks=None)`

运行 agent 一次并返回 `RunResult`。

| 参数 | 类型 | 默认值 | 说明 |
|-------|------|---------|-------------|
| `message` | `str` | *(required)* | 要处理的用户消息。 |
| `session_key` | `str` | `"sdk:default"` | 会话标识符用于对话隔离。不同 key 获取独立的历史。 |
| `hooks` | `list[AgentHook] \| None` | `None` | 仅用于本次运行的生命周期 Hook。 |

### `RunResult`

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `content` | `str` | agent 的最终文本响应。 |
| `tools_used` | `list[str]` | 预留字段供更丰富的 SDK 自省；当前版本可能为空。 |
| `messages` | `list[dict]` | 预留字段供更丰富的 SDK 自省；当前版本可能为空。 |

## Hook

Hook 让你观察或定制 agent 循环。子类化 `AgentHook` 并覆盖需要的方法。

### Hook 生命周期

| 方法 | 触发时机 |
|--------|------|
| `wants_streaming()` | 返回 `True` 以获取逐个 token 的 `on_stream()` 回调 |
| `before_iteration(context)` | 每次 LLM 调用前 |
| `on_stream(context, delta)` | 流式传输启用时的每个流式 token 到达时 |
| `on_stream_end(context, *, resuming)` | 流式传输完成时 |
| `before_execute_tools(context)` | 工具执行前 |
| `after_iteration(context)` | 每次迭代后 |
| `finalize_content(context, content)` | 转换最终输出文本 |

`AgentHookContext` 上的有用字段：

- `iteration`、`messages`、`response`、`usage`
- `tool_calls`、`tool_results`、`tool_events`
- `final_content`、`stop_reason`、`error`

### 示例：审计工具调用

```python
from nanobot.agent import AgentHook, AgentHookContext


class AuditHook(AgentHook):
    def __init__(self) -> None:
        super().__init__()
        self.calls: list[str] = []

    async def before_execute_tools(self, context: AgentHookContext) -> None:
        for tc in context.tool_calls:
            self.calls.append(tc.name)
            print(f"[audit] {tc.name}({tc.arguments})")
```

```python
hook = AuditHook()
result = await bot.run("列出 /tmp 中的文件", hooks=[hook])
print(result.content)
print(f"观察到的工具: {hook.calls}")
```

### 示例：接收流式 token

```python
from nanobot.agent import AgentHook, AgentHookContext


class StreamingHook(AgentHook):
    def wants_streaming(self) -> bool:
        return True

    async def on_stream(self, context: AgentHookContext, delta: str) -> None:
        print(delta, end="", flush=True)

    async def on_stream_end(self, context: AgentHookContext, *, resuming: bool) -> None:
        print()
```

### 组合多个 Hook

想组合行为时传递多个 Hook：

```python
result = await bot.run("hi", hooks=[AuditHook(), MetricsHook()])
```

异步 Hook 方法是扇出的，带错误隔离。`finalize_content` 是管道式：每个 Hook 接收前一个 Hook 的输出。

### 示例：后处理最终内容

```python
from nanobot.agent import AgentHook


class Censor(AgentHook):
    def finalize_content(self, context, content):
        return content.replace("secret", "***") if content else content
```

## 完整示例

```python
import asyncio
import time

from nanobot import Nanobot
from nanobot.agent import AgentHook, AgentHookContext


class TimingHook(AgentHook):
    def __init__(self) -> None:
        super().__init__()
        self._started_at = 0.0

    async def before_iteration(self, context: AgentHookContext) -> None:
        self._started_at = time.perf_counter()

    async def after_iteration(self, context: AgentHookContext) -> None:
        elapsed_ms = (time.perf_counter() - self._started_at) * 1000
        print(f"[timing] 迭代 {context.iteration} 耗时 {elapsed_ms:.1f}ms")


async def main() -> None:
    bot = Nanobot.from_config(workspace="/my/project")
    result = await bot.run(
        "解释 main 函数",
        session_key="sdk:demo",
        hooks=[TimingHook()],
    )
    print(result.content)


asyncio.run(main())
```
