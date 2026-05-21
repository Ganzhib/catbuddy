# 跨端中继：Web 发消息，桌面执行本地文件

Web 只做输入与展示；**Agent + 本地 workspace 工具只在桌面 Electron 主进程运行**。中转服务负责把用户消息推到桌面，并把 `InboundEvent` 流广播给 Web（及桌面 UI）。

## 架构

```text
apps/web (未来)          relay-server              apps/desktop
     │                        │                         │
     │  POST /api/.../messages│                         │
     ├───────────────────────►│  inbound_message (WS)   │
     │                        ├────────────────────────►│ bus.publishInbound
     │                        │                         │ AgentLoop + tools
     │  WS subscribe          │◄── ui_event (WS) ───────┤ bus.outbound (fan-out)
     ◄────────────────────────┤                         │ DesktopChannel → 本机 UI
```

## 快速开始

### 1. 启动中转

```bash
cd learnbuddy/relay-server
pnpm install
RELAY_SECRET=your-executor-secret pnpm start
# 默认 http://127.0.0.1:18765  WS ws://127.0.0.1:18765/ws
```

`RELAY_SECRET` **仅用于桌面 executor 注册 WS**，不能作为 Web HTTP/viewer WS 的 Bearer。

### 2. 配置桌面 `.env`

```env
RELAY_ENABLED=true
RELAY_URL=ws://127.0.0.1:18765/ws
RELAY_SECRET=your-executor-secret
# 可选：固定设备 ID
# RELAY_DEVICE_ID=my-desktop-1
# 勿再写 RELAY_DEFAULT_SESSIONS=desktop:main — 会话 key 随侧边栏对话变化
```

重启 `pnpm dev`。主进程日志应出现 `[relay] connected`。在 **设置 → 远程控制（中继）** 可查看配对码与已订阅的 `sessionKey`。

### 3. Web 配对 + 发消息

1. 在桌面打开要远程控制的**那条对话**（记下侧边栏对应的会话，格式为 `desktop:{chatId}`，例如 `desktop:1730_abc`，不是固定的 `desktop:main`）。
2. 复制设置里的 **配对码**，调用：

```bash
curl -X POST http://127.0.0.1:18765/api/pair \
  -H "Content-Type: application/json" \
  -d '{"pairingCode":"XXXXXX","token":"my-web-viewer-token"}'
```

3. 用 **viewer token**（上一步的 `token`）发消息：

```bash
curl -X POST "http://127.0.0.1:18765/api/sessions/desktop%3A1730_abc/messages" \
  -H "Authorization: Bearer my-web-viewer-token" \
  -H "Content-Type: application/json" \
  -d '{"content":"列出工作区里的文件"}'
```

若使用 `Authorization: Bearer` 与 `RELAY_SECRET` 相同，HTTP 会返回 `401`（开发测试请走配对流程）。

桌面应开始跑 Agent；Web 用 WS 订阅同一 `sessionKey` 可收到 `ui_event`。

### 4. WebSocket 订阅（浏览器 / 未来 apps/web）

```js
// 1) 先 pair，得到 viewer token
const viewerToken = 'my-web-viewer-token'

const ws = new WebSocket('ws://127.0.0.1:18765/ws')
ws.onopen = () => ws.send(JSON.stringify({
  type: 'register',
  role: 'viewer',
  deviceId: 'web-tab-1',
  token: viewerToken,
}))
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data)
  if (msg.type === 'ui_event') {
    // msg.event 即 InboundEvent
  }
}
// 注册成功后 — sessionKey 与桌面当前对话一致
ws.send(JSON.stringify({ type: 'subscribe', sessionKey: 'desktop:1730_abc' }))
```

### 5. 浏览器对话页（开发用）

Vite 开发时打开：

```text
http://localhost:5173/relay-web.html
```

开发时 HTTP/WS 走 Vite 同源代理（`/relay-api`、`/relay-ws`），避免浏览器对 `localhost:5173` → `127.0.0.1:18765` 的跨域拦截（表现为 **Failed to fetch**）。中继地址可留空默认或填 `http://localhost:5173/relay-api`。

或：

```bash
pnpm run relay:web
```

填写配对码、`sessionKey`（与桌面当前对话一致）、自选 viewer token → **配对并连接** → 发消息。回复由桌面 Agent 经 `ui_event` 推送到该页。

**桌面实时流式**：Web 发消息时，请在桌面**打开同一条对话**（`sessionKey` 对应的会话）。流式 delta 会按 `chatId` 投递到该会话，而不是误发到上次在桌面本地发送过的会话。

**双向同步（实时）**：

| 方向 | 机制 |
|------|------|
| Web → 桌面 | HTTP `inbound_message` + `agent:relay-inbound` |
| 桌面 → Web | `agent:send` 时 `ui_event`（`user_inbound`）+ Agent 出站经 `RelayChannel` |

历史消息不会自动回填到 Web；仅连接后新产生的消息会同步。打开 Web 前在桌面已发的内容需刷新会话或后续再做 history API。

前端可复用 `src/lib/relay-api.ts` 的 `pairRelayViewer` / `sendRelayMessage` / `connectRelayViewer`。环境变量示例：

```env
VITE_RELAY_HTTP_BASE=http://127.0.0.1:18765
VITE_RELAY_VIEWER_TOKEN=my-web-viewer-token
```

## 协议摘要

| 方向 | 类型 | 说明 |
|------|------|------|
| C→S | `register` | `executor`（桌面，token=RELAY_SECRET）或 `viewer`（Web，token=配对后的 viewer token） |
| C→S | `subscribe` | executor / viewer 订阅 `sessionKey` |
| S→C | `inbound_message` | 仅 executor 收到，触发本地 Agent |
| S→C | `ui_event` | 该 session 所有 viewer 收到 |
| HTTP | `POST .../messages` | Web 发用户消息（Bearer = viewer token） |
| HTTP | `POST /api/pair` | 用配对码绑定 viewer token 到 executor |

完整类型见 `shared/relay.ts`。

## 代码位置

| 路径 | 说明 |
|------|------|
| `relay-server/server.mjs` | 最小中转服务 |
| `electron/sync/relay-client.ts` | 桌面 WS 客户端 |
| `electron/channels/relay.ts` | 出站 fan-out → `ui_event` |
| `electron/channels/manager.ts` | `desktop` 出站同时投递 `relay` |
| `src/lib/relay-api.ts` | Web 侧 HTTP + WS 辅助 |
| `src/lib/relay-desktop.ts` | 桌面 IPC 辅助 |

## 安全（生产前必做）

当前为 **开发级**：executor 共享 `RELAY_SECRET`、配对码明文。Web 已禁止用 `RELAY_SECRET` 当 Bearer。上线前需要：HTTPS/WSS、短期 JWT、用户账号绑定、桌面「允许远程控制」开关、会话 ACL。

## 与 Monorepo 的关系

完成 `MONOREPO_MIGRATION.md` 后：

- `apps/web` 使用 `relay-api` + `WsTransport`（或专用 `RelayTransport`）连同一中转；
- `apps/desktop` 保持本方案，无需在服务器跑 Agent。
