# WebSocket 服务器通道

nanobot 可以作为 WebSocket 服务器运行，使外部客户端（Web 应用、CLI、脚本）通过持久连接与 agent 实时交互。

## 功能

- 通过 WebSocket 进行双向实时通信
- 流式传输支持——逐个 token 接收 agent 响应
- 基于 Token 的认证（静态 token 和短期签发 token）
- 多聊天复用——一个连接可承载多个并发的 `chat_id`
- TLS/SSL 支持（WSS），强制最低 TLSv1.2
- 通过 `allowFrom` 进行客户端白名单控制
- 死连接自动清理

## 快速开始

### 1. 配置

在 `config.json` 的 `channels.websocket` 下添加：

```json
{
  "channels": {
    "websocket": {
      "enabled": true,
      "host": "127.0.0.1",
      "port": 8765,
      "path": "/",
      "websocketRequiresToken": false,
      "allowFrom": ["*"],
      "streaming": true
    }
  }
}
```

### 2. 启动 nanobot

```bash
nanobot gateway
```

你会看到：

```text
WebSocket server listening on ws://127.0.0.1:8765/
```

### 3. 连接客户端

```python
import asyncio, json, websockets

async def main():
    async with websockets.connect("ws://127.0.0.1:8765/?client_id=alice") as ws:
        ready = json.loads(await ws.recv())
        print(ready)  # {"event": "ready", "chat_id": "...", "client_id": "alice"}
        await ws.send(json.dumps({"content": "Hello nanobot!"}))
        reply = json.loads(await ws.recv())
        print(reply["text"])

asyncio.run(main())
```

## 连接 URL

```text
ws://{host}:{port}{path}?client_id={id}&token={token}
```

| 参数 | 必需 | 说明 |
|-----------|----------|-------------|
| `client_id` | 否 | 用于 `allowFrom` 授权的标识符。未指定时自动生成为 `anon-xxxxxxxxxxxx`。最长 128 字符。 |
| `token` | 条件性 | 认证 token。当 `websocketRequiresToken` 为 `true` 或配置了 `token`（静态密钥）时必须提供。 |

## 线协议

所有帧为 JSON 文本。每条消息包含 `event` 字段。

### 服务器 → 客户端

**`ready`** — 连接建立后立即发送：

```json
{"event": "ready", "chat_id": "uuid-v4", "client_id": "alice"}
```

**`message`** — 完整 agent 响应：

```json
{"event": "message", "chat_id": "uuid-v4", "text": "你好！有什么可以帮你的？", "media": ["/tmp/image.png"]}
```

**`delta`** — 流式文本分块（仅 `streaming: true` 时）：

```json
{"event": "delta", "chat_id": "uuid-v4", "text": "你好", "stream_id": "s1"}
```

**`stream_end`** — 流式段结束：

```json
{"event": "stream_end", "chat_id": "uuid-v4", "stream_id": "s1"}
```

**`reasoning_delta`** — 模型推理/思考增量分块：

```json
{"event": "reasoning_delta", "chat_id": "uuid-v4", "text": "让我来分解 ", "stream_id": "r1"}
```

**`reasoning_end`** — 推理流关闭标记：

```json
{"event": "reasoning_end", "chat_id": "uuid-v4", "stream_id": "r1"}
```

**`runtime_model_updated`** — 网关运行时模型变更时广播（如 `/model <preset>` 后）：

```json
{"event": "runtime_model_updated", "model_name": "openai/gpt-4.1-mini", "model_preset": "fast"}
```

### 客户端 → 服务器

**传统模式（默认聊天）：** 发送纯文本字符串或带识别文本字段的 JSON 对象：

```json
"Hello nanobot!"
```

```json
{"content": "Hello nanobot!"}
```

识别的字段：`content`、`text`、`message`（按此顺序检查）。这些帧路由到连接的默认 `chat_id`。

**类型化信封（多聊天）：** 任何带字符串 `type` 字段的 JSON 对象：

| `type` | 字段 | 效果 |
|--------|--------|--------|
| `new_chat` | — | 服务器创建新的 `chat_id`，订阅此连接，回复 `attached` |
| `attach` | `chat_id` | 订阅已有的 `chat_id`。回复 `attached` |
| `message` | `chat_id`、`content` | 在 `chat_id` 上发送内容。首次使用时自动附加，无需单独 `attach` |

## 多聊天复用

单个 WebSocket 可承载多个并发聊天。服务器将 `chat_id -> {connections}` 作为扇出集合跟踪。

### 典型流程

```text
客户端                                  服务器
  | --- connect -------------------->  |
  | <-- {"event":"ready",              |
  |      "chat_id":"d3..."}    (默认)   |
  |                                     |
  | --- {"type":"new_chat"} --------->  |
  | <-- {"event":"attached",            |
  |      "chat_id":"a1..."}             |
  |                                     |
  | --- {"type":"message",              |
  |      "chat_id":"a1...",             |
  |      "content":"hi"} ------------>  |
  | <-- {"event":"delta", ...}          |
  | <-- {"event":"stream_end", ...}     |
```

### 规则

- 每条外发事件均携带 `chat_id`。客户端必须按此字段分发。
- `chat_id` 格式：`^[A-Za-z0-9_:-]{1,64}$`。不匹配的值返回 `error`。
- `message` 在首次使用时自动附加。
- 错误是软性的：服务器回复 `{"event":"error","detail":"..."}` 并保持连接开启。

## 配置参考

### 连接

| 字段 | 类型 | 默认值 | 说明 |
|-------|------|---------|-------------|
| `enabled` | bool | `false` | 启用 WebSocket 服务器 |
| `host` | string | `"127.0.0.1"` | 绑定地址。使用 `"0.0.0.0"` 接受外部连接 |
| `port` | int | `8765` | 监听端口 |
| `path` | string | `"/"` | WebSocket 升级路径 |
| `maxMessageBytes` | int | `37748736` | 最大入站消息大小（字节） |

### 认证

| 字段 | 说明 |
|-------|-------------|
| `token` | 静态共享密钥。设置后客户端必须提供匹配的 `?token=<value>` |
| `websocketRequiresToken` | 默认 `true`。设为 `false` 以允许未认证连接 |
| `tokenIssuePath` | 签发短期 token 的 HTTP 路径 |
| `tokenIssueSecret` | 获取 token 所需的密钥 |
| `tokenTtlS` | 签发 token 的 TTL，默认 300 秒 |

### 流式传输

| 字段 | 类型 | 默认值 | 说明 |
|-------|------|---------|-------------|
| `streaming` | bool | `true` | 启用流式模式 |

### 安全说明

- **时间安全比较**：静态 token 验证使用 `hmac.compare_digest`
- **纵深防御**：`allowFrom` 在 HTTP 握手和消息层面均检查
- **TLS 强制**：启用 SSL 时，TLSv1.2 为最低允许版本
