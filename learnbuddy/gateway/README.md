# learnbuddy Gateway

Web ⇄ Gateway ⇄ Desktop 中转服务（Fastify + WebSocket），兼 Web 开发期 bootstrap / 会话 API。

## 目录结构

```text
gateway/
├── packages/
│   ├── common/           @learnbuddy/gateway-common — 转发 @learnbuddy/shared 协议
│   ├── gateway/          @learnbuddy/gateway — HTTP + session WebSocket（:18765）
│   ├── sdk-web/          @learnbuddy/gateway-sdk-web — 浏览器 SDK
│   └── sdk-desktop/      @learnbuddy/gateway-sdk-desktop — 桌面 SDK
├── config/               推送网关 YAML（MessageFrame 实验配置）
├── docs/技术文档.md       MessageFrame 推送设计
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
| **Web UI**（`apps/web` + `@learnbuddy/client`） | `GatewayTransport` 或 `WebGatewayClient` | `register` role=`web` + HTTP |
| **Desktop**（`apps/desktop`） | `DesktopGatewayClient` 或 `electron/sync/gateway-ws-client.ts` | `register` role=`desktop` |
| **新推送实验** | `WebSocketClient` / `DesktopClient`（MessageFrame） | `auth` / `push` / `ack` / `ping` |

### Web 示例（SDK）

```ts
import { WebGatewayClient } from '@learnbuddy/gateway-sdk-web'

const client = new WebGatewayClient({
  httpBase: '/gateway-api',
  webToken: bootstrap.token,
})
client.onEvent = (ev) => { /* InboundEvent */ }
client.connect()
await client.sendMessage('desktop:chat-id', 'hello')
```

### Desktop 示例（SDK）

```ts
import { DesktopGatewayClient } from '@learnbuddy/gateway-sdk-desktop'

const gw = new DesktopGatewayClient({
  url: 'ws://127.0.0.1:18765/ws',
  secret: process.env.GATEWAY_SECRET!,
})
gw.onInbound = (msg) => { /* 跑 Agent */ }
gw.start()
```

## 与 monorepo 的关系

`learnbuddy/pnpm-workspace.yaml` 包含 `gateway` 与 `gateway/packages/*`。根脚本 `pnpm gateway:dev` 启动 `@learnbuddy/gateway` 服务包。
