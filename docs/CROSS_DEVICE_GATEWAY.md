# 跨端中继：Web 发消息，桌面执行本地文件

Web 只做输入与展示；**Agent + 本地 workspace 工具只在桌面 Electron 主进程运行**。Gateway 按 **同一登录邮箱** 把 Web 与桌面绑在一起，不再使用配对码。

## 架构

```text
apps/web                 gateway (@catbuddy)      apps/desktop
     │                        │                         │
     │  JWT (email)           │  register(accountEmail)│
     │  POST .../messages     │  inbound_message (WS)   │
     ├───────────────────────►├────────────────────────►│ AgentLoop
     │  WS subscribe          │◄── ui_event (WS) ───────┤
     ◄────────────────────────┤                         │
```

## 快速开始

### 1. 启动 Gateway

```bash
# 在 catbuddy/ 根目录
docker compose -f gateway/docker-compose.yml up -d mysql   # 可选
cp .env.example .env
pnpm gateway:dev    # 或 pnpm gateway:build && pnpm gateway:start
```

`GATEWAY_SECRET` **仅用于桌面 WS 注册**，不能作为 Web 的 Bearer。

### 2. 桌面

```env
GATEWAY_ENABLED=true
GATEWAY_URL=ws://127.0.0.1:18765/ws
GATEWAY_SECRET=your-desktop-secret
# 可选；桌面 App 登录后会通过 IPC 自动同步邮箱
# GATEWAY_ACCOUNT_EMAIL=you@example.com
```

在桌面 App **用邮箱登录**，打开 **设置 → 远程控制**。确认已连接且 **Gateway 账号** 与 Web 一致。

### 3. Web

1. 在 `apps/web` **用同一邮箱登录**（OTP/JWT）。
2. Bearer 自动为登录后的 JWT，**无需** `/api/pair` 或自选 token。
3. 发消息：`POST /api/sessions/{sessionKey}/messages`，`Authorization: Bearer <JWT>`。

### 4. WebSocket

```js
const ws = new WebSocket('ws://127.0.0.1:18765/ws')
ws.onopen = () => ws.send(JSON.stringify({
  type: 'register',
  role: 'web',
  deviceId: 'web-tab-1',
  token: '<JWT from login>',
}))
ws.send(JSON.stringify({ type: 'subscribe', sessionKey: 'desktop:1730_abc' }))
```

桌面注册：

```js
ws.send(JSON.stringify({
  type: 'register',
  role: 'desktop',
  deviceId: 'my-desktop-1',
  token: process.env.GATEWAY_SECRET,
  accountEmail: 'you@example.com', // 与 Web JWT sub 相同
}))
```

## 同账号与会话

| 条件 | 说明 |
|------|------|
| `sessionKey` | 三端统一，如 `desktop:{chatId}` |
| Web JWT `sub` | 须与桌面 `accountEmail` 一致 |
| 远程控制 | 桌面 `gateway.remoteEnabled=true` |
| 会话 owner | MySQL 按邮箱隔离；未认领会话仅同账号桌面可推送 |

`scope: focus`：桌面切换/新建会话时，Gateway 只通知 **同邮箱** 的 Web 连接。

## 协议摘要

| 方向 | 类型 | 说明 |
|------|------|------|
| C→S | `register` | desktop：`token`+`accountEmail`；web：登录 JWT |
| C→S | `subscribe` | 订阅 `sessionKey` |
| S→C | `ui_event` | 流式事件；`session_updated`/`focus` 切换会话 |
| HTTP | `POST .../messages` | Web 发消息 |

## 安全（多用户）

- Web：邮箱登录 + JWT
- 桌面：`GATEWAY_SECRET` + **accountEmail**（与 Web 同邮箱才路由）
- 无配对码；一邮箱对应一台在线 desktop（新连接顶替旧连接）

开发可设 `GATEWAY_AUTH_DEV_BYPASS=true` 关闭邮箱校验（勿用于生产）。

## 代码位置

| 路径 | 说明 |
|------|------|
| `gateway/.../gateway-state.ts` | `deviceIdByAccountEmail` 路由 |
| `gateway/packages/sdk-desktop` | 桌面 `GatewayDesktopClient` |
| `gateway/packages/sdk-web` | Web `GatewayTransport` |
| `packages/ui/.../AuthGate.tsx` | 登录后 `setGatewayAccountEmail` + `createCatbuddyClient` |
