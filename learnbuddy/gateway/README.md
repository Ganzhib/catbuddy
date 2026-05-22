# learnbuddy Gateway

Web ⇄ Gateway ⇄ Desktop 中转服务（Fastify + WebSocket），兼 Web 开发期 bootstrap / 会话 API。

## 目录结构

```text
gateway/
├── packages/
│   ├── common/           @learnbuddy/gateway-common — MessageFrame 类型与工具
│   ├── gateway/          @learnbuddy/gateway — HTTP + 旧版 relay WS（:18765）
│   ├── sdk-web/          @learnbuddy/gateway-sdk-web — 浏览器 SDK
│   └── sdk-desktop/      @learnbuddy/gateway-sdk-desktop — 桌面 executor SDK
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
| **Web UI**（`apps/web` + `@learnbuddy/client`） | 继续用内置 `RelayTransport`，或 `@learnbuddy/gateway-sdk-web` 的 `RelayViewerClient` | 旧版 `register` / `subscribe` / `ui_event` + HTTP |
| **Desktop**（`apps/desktop`） | `@learnbuddy/gateway-sdk-desktop` 的 `ExecutorRelayClient`，或现有 `electron/sync/relay-client.ts` | 同上 executor 角色 |
| **新推送实验** | `WebSocketClient` / `DesktopClient`（MessageFrame） | `auth` / `push` / `ack` / `ping` — 见 `docs/技术文档.md` |

### Web 示例（SDK）

```ts
import { RelayViewerClient } from '@learnbuddy/gateway-sdk-web'

const client = new RelayViewerClient({
  httpBase: '/gateway-api',   // Vite 代理
  viewerToken: bootstrap.token,
})
client.onEvent = (ev) => { /* InboundEvent */ }
client.connect()
await client.sendMessage('desktop:chat-id', 'hello')
```

### Desktop 示例（SDK）

```ts
import { ExecutorRelayClient } from '@learnbuddy/gateway-sdk-desktop'

const relay = new ExecutorRelayClient({
  url: 'ws://127.0.0.1:18765/ws',
  secret: process.env.GATEWAY_SECRET!,
})
relay.onInbound = (msg) => { /* 跑 Agent */ }
relay.start()
```

## 与 monorepo 的关系

`learnbuddy/pnpm-workspace.yaml` 包含 `gateway` 与 `gateway/packages/*`。根脚本 `pnpm gateway:dev` 启动 `@learnbuddy/gateway` 服务包。
