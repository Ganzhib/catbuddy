# 通道插件指南

三步构建自定义 nanobot 通道：子类化、打包、安装。

> **注意：** 推荐基于 nanobot 的源码检出（`pip install -e .`）而非 PyPI 发行版开发通道插件，以确保始终能访问最新的 base-channel 功能与 API。

## 工作原理

nanobot 通过 Python [entry points](https://packaging.python.org/en/latest/specifications/entry-points/) 发现通道插件。`nanobot gateway` 启动时扫描：

1. `nanobot/channels/` 中的内置通道
2. `nanobot.channels` entry point 组下注册的外部包

若匹配的配置段中 `"enabled": true`，则通道被实例化并启动。

## 快速开始

构建一个通过 HTTP POST 接收消息并回复的最小 webhook 通道。

### 项目结构

```text
nanobot-channel-webhook/
├── nanobot_channel_webhook/
│   ├── __init__.py          # 再导出 WebhookChannel
│   └── channel.py           # 通道实现
└── pyproject.toml
```

### 1. 创建通道

```python
# nanobot_channel_webhook/__init__.py
from nanobot_channel_webhook.channel import WebhookChannel
__all__ = ["WebhookChannel"]
```

```python
# nanobot_channel_webhook/channel.py
import asyncio
from typing import Any
from aiohttp import web
from loguru import logger
from pydantic import Field
from nanobot.channels.base import BaseChannel
from nanobot.bus.events import OutboundMessage
from nanobot.bus.queue import MessageBus
from nanobot.config.schema import Base


class WebhookConfig(Base):
    """Webhook 通道配置。"""
    enabled: bool = False
    port: int = 9000
    allow_from: list[str] = Field(default_factory=list)


class WebhookChannel(BaseChannel):
    name = "webhook"
    display_name = "Webhook"

    def __init__(self, config: Any, bus: MessageBus):
        if isinstance(config, dict):
            config = WebhookConfig(**config)
        super().__init__(config, bus)

    @classmethod
    def default_config(cls) -> dict[str, Any]:
        return WebhookConfig().model_dump(by_alias=True)

    async def start(self) -> None:
        self._running = True
        port = self.config.port
        app = web.Application()
        app.router.add_post("/message", self._on_request)
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "0.0.0.0", port)
        await site.start()
        logger.info("Webhook 监听在 :{}", port)
        while self._running:
            await asyncio.sleep(1)
        await runner.cleanup()

    async def stop(self) -> None:
        self._running = False

    async def send(self, msg: OutboundMessage) -> None:
        logger.info("[webhook] -> {}: {}", msg.chat_id, msg.content[:80])

    async def _on_request(self, request: web.Request) -> web.Response:
        body = await request.json()
        sender = body.get("sender", "unknown")
        chat_id = body.get("chat_id", sender)
        text = body.get("text", "")
        media = body.get("media", [])
        # 关键调用：验证 allowFrom，然后将消息放上消息总线
        await self._handle_message(
            sender_id=sender, chat_id=chat_id,
            content=text, media=media,
        )
        return web.json_response({"ok": True})
```

### 2. 注册 Entry Point

```toml
[project]
name = "nanobot-channel-webhook"
version = "0.1.0"
dependencies = ["nanobot-ai", "aiohttp"]

[project.entry-points."nanobot.channels"]
webhook = "nanobot_channel_webhook:WebhookChannel"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["nanobot_channel_webhook"]
```

### 3. 安装与配置

```bash
pip install -e .
nanobot plugins list      # 验证 "Webhook" 显示为 "plugin"
nanobot onboard           # 自动为检测到的插件添加默认配置
```

### 4. 运行与测试

```bash
nanobot gateway
```

另一终端：

```bash
curl -X POST http://localhost:9000/message \
  -H "Content-Type: application/json" \
  -d '{"sender": "user1", "chat_id": "user1", "text": "Hello!"}'
```

## BaseChannel API

### 必需（抽象）

| 方法 | 说明 |
|--------|-------------|
| `async start()` | **必须永久阻塞。** 连接平台、监听消息、每次调用 `_handle_message()`。若返回则通道死掉。 |
| `async stop()` | 设置 `self._running = False` 并清理。网关关闭时调用。 |
| `async send(msg: OutboundMessage)` | 向平台投递一条外发消息。 |

### 交互式登录

若通道需要交互式认证（如扫码），覆盖 `login(force=False)`。

### Base 提供的方法

| 方法 / 属性 | 说明 |
|-------------------|-------------|
| `_handle_message(...)` | **收到消息时调用此方法。** 检查 `is_allowed()`，然后发布到总线。 |
| `is_allowed(sender_id)` | 对照 `config.allow_from` 检查 |
| `default_config()` | 返回 `nanobot onboard` 的默认配置 dict |
| `supports_streaming` | 当配置有 `streaming: true` **且** 子类覆盖了 `send_delta()` 时返回 `True` |
| `send_reasoning_delta()` / `send_reasoning_end()` | 可选的推理/思考内容 Hook |

### 流式传输

覆盖 `send_delta(chat_id, delta, metadata?)` 以接收流式分块。详见英文原文档 [channel-plugin-guide.md](./channel-plugin-guide.md)。

## 命名约定

| 项目 | 格式 | 示例 |
|------|--------|---------|
| PyPI 包 | `nanobot-channel-{name}` | `nanobot-channel-webhook` |
| Entry point key | `{name}` | `webhook` |
| 配置段 | `channels.{name}` | `channels.webhook` |
| Python 包 | `nanobot_channel_{name}` | `nanobot_channel_webhook` |
