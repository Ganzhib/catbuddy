# learnbuddy Gateway

Web ⇄ Gateway ⇄ Desktop 中转服务（Fastify + WebSocket），兼 Web 开发期 bootstrap / 会话 API。

## 目录结构

```text
gateway/
├── packages/
│   ├── gateway/          @learnbuddy/gateway — HTTP + session WebSocket（:18765）
│   ├── sdk-web/          @learnbuddy/gateway-sdk-web — Web 会话协议 + AgentTransport
│   └── sdk-desktop/      占位（桌面实现见 apps/desktop/electron/sync/gateway-ws-client.ts）
├── packages/gateway/src/push/   MessageFrame 实验（未接入生产入口）
└── test-*.mjs            E2E / 验收脚本
```

## 启动

在 monorepo 根目录：

```bash
pnpm gateway:dev          # tsx watch，默认 :18765
pnpm gateway:build && pnpm gateway:start
```

复制 `gateway/.env.example` → `gateway/.env`，配置 MySQL / SMTP / `GATEWAY_SECRET`。

## Web / Desktop 如何使用

| 端 | 推荐依赖 | 协议 |
|----|----------|------|
| **Web UI**（Thread + `@learnbuddy/client`） | `GatewayTransport` from `@learnbuddy/gateway-sdk-web` | `register` role=`web` + HTTP POST 发消息 |
| **Web 简易页**（`gateway-web`） | `connectGatewayWeb` via `@learnbuddy/ui` → sdk-web | 同上 |
| **Desktop** | `electron/sync/gateway-ws-client.ts` | `register` role=`desktop` + `GATEWAY_SECRET` + `accountEmail` |

### Web 示例（完整 Thread UI）

```ts
import { createLearnbuddyClient } from '@learnbuddy/client'

const client = createLearnbuddyClient({
  token: jwt,
  wsPath: '/ws',
  transportMode: 'gateway',
  gatewayHttpBase: '/gateway-api',
})
client.connect()
client.sendMessage('chat-id', 'hello')
```

### 共享会话协议（sdk-web）

```ts
import { openGatewayWebSocket, postGatewayUserMessage } from '@learnbuddy/gateway-sdk-web'
```

详见 monorepo 根目录 `docs/CROSS_DEVICE_GATEWAY.md`。

## 与 monorepo 的关系

`learnbuddy/pnpm-workspace.yaml` 包含 `gateway` 与 `gateway/packages/*`。根脚本 `pnpm gateway:dev` 启动 `@learnbuddy/gateway` 服务包。
