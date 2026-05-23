# learnbuddy Gateway

Web ⇄ Gateway ⇄ Desktop 中转服务（Fastify + WebSocket），兼 Web 开发期 bootstrap / 会话 API。

## 目录结构

```text
gateway/
├── packages/
│   ├── gateway/           @learnbuddy/gateway — HTTP + session WebSocket（:18765）
│   ├── sdk-web/           @learnbuddy/gateway-sdk-web — Web（GatewayTransport）
│   └── sdk-desktop/       @learnbuddy/gateway-sdk-desktop — Desktop（GatewayDesktopClient）
└── test-*.mjs             E2E / 验收脚本
```

## 启动

```bash
pnpm gateway:dev          # tsx watch，默认 :18765
pnpm gateway:build && pnpm gateway:start
```

复制 `gateway/.env.example` → `gateway/.env`，配置 MySQL / SMTP / `GATEWAY_SECRET`。

Docker（Gateway + MySQL）：在 `learnbuddy/` 根目录执行 `docker compose -f gateway/docker-compose.yml up -d --build`。详见 [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)。

## SDK 对称设计

| 包 | 角色 | 主入口 |
|----|------|--------|
| `@learnbuddy/gateway-sdk-web` | `register` role=`web` + HTTP 发消息 | `GatewayTransport`（`AgentTransport`） |
| `@learnbuddy/gateway-sdk-desktop` | `register` role=`desktop` + `ui_event` 回传 | `GatewayDesktopClient` |

### Web（Thread UI）

```ts
import { createLearnbuddyClient } from '@learnbuddy/client'

const client = createLearnbuddyClient({
  token: jwt,
  wsPath: '/ws',
  transportMode: 'gateway',
  gatewayHttpBase: '/gateway-api',
})
client.connect()
```

### Desktop（Electron 主进程）

```ts
import { GatewayDesktopClient, loadGatewayConfigFromEnv } from '@learnbuddy/gateway-sdk-desktop'

const client = new GatewayDesktopClient(loadGatewayConfigFromEnv()!, {
  sessionProvider: { list, getDetail, getOrCreate, importWebuiThread },
  buildThreadSnapshot: buildWebuiThreadFromSession,
  publishInbound: (msg) => bus.publishInbound(msg),
})
client.start()
```

详见 `docs/CROSS_DEVICE_GATEWAY.md`。
