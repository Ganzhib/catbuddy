# learnbuddy Gateway

`learnbuddy/gateway`（`@learnbuddy/gateway`）是 **Web ↔ 桌面 Executor** 的中转服务（Fastify + WebSocket），兼作 Web 开发期的 **Gateway 垫片**（`/webui/bootstrap`、`/api/*`）。包结构见 [gateway/README.md](../gateway/README.md)。

与 nanobot 自带的 `nanobot gateway`（:8765）不同；learnbuddy Web 默认连 **本服务**（:18765）。

## 架构

```text
apps/web  ──HTTP/WS──►  gateway (Fastify)  ──WS──►  apps/desktop (executor)
                         │
                         ├─ POST /api/sessions/:key/messages  (Web 发消息)
                         ├─ WS ui_event                         (桌面 Agent 回流)
                         └─ GET /webui/bootstrap                (learnbuddy UI)
```

## 快速开始

```bash
# 1) Gateway
pnpm gateway:dev

# 2) 桌面 .env
GATEWAY_ENABLED=true
GATEWAY_URL=ws://127.0.0.1:18765/ws
GATEWAY_SECRET=dev-secret

# 3) Web
pnpm dev:web
# 或一键：pnpm dev:web:full
```

Vite 开发代理：`/gateway-api` → `http://127.0.0.1:18765`，`/gateway-ws` → WebSocket（兼容旧路径 `/relay-api`、`/relay-ws`）。

## 环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| `GATEWAY_PORT` | HTTP/WS 端口 | `18765` |
| `GATEWAY_SECRET` | 桌面 executor 注册密钥 | `dev-secret` |
| `GATEWAY_DEV_VIEWER_TOKEN` | 开发 bootstrap token | `dev-viewer` |
| `GATEWAY_WS_PATH` | bootstrap 返回的 WS 路径 | `/gateway-ws/ws` |
| `GATEWAY_AUTH_REQUIRE_EMAIL` | 强制邮箱 OTP | `false` |
| `GATEWAY_AUTH_DEV_BYPASS` | 开发跳过邮箱登录 | 非 production 为 `true` |

旧名 `RELAY_*` 仍可读（兼容）。

## 邮箱鉴权（NestJS）

```bash
POST /auth/email/request-code  { "email": "you@example.com" }
POST /auth/email/verify        { "email": "...", "code": "123456" }
# → { access_token } 用作 Bearer 与 WS register token
```

未配置 SMTP 时验证码打印在 gateway 控制台。

生产：`GATEWAY_AUTH_REQUIRE_EMAIL=true`，`GATEWAY_AUTH_DEV_BYPASS=false`。

## 脚本

| 命令 | 说明 |
|------|------|
| `pnpm gateway:dev` | tsx watch（`@learnbuddy/gateway`） |
| `pnpm gateway:build` | 编译并运行 |
| `pnpm gateway:test` | HTTP + executor 冒烟 |
| `pnpm gateway:test:acceptance` | §6 `InboundEvent` 清单 |
| `pnpm gateway:test:all` | 全部自动化测试 |
| `pnpm start:legacy` | 旧 `server.mjs`（仅应急） |

§6 验收步骤见 **[GATEWAY_ACCEPTANCE.md](./GATEWAY_ACCEPTANCE.md)**。

## 常见问题：端口 18765 已被占用（EADDRINUSE）

说明 **已有一个 gateway 在跑**（常见是之前终端里的 `node dist/main.js` 或 `gateway:dev` 未关）。

- **不必再起第二个**：直接访问 `http://127.0.0.1:18765/health` 若返回 `ok` 即可继续联调 Web/桌面。
- **需要重启 gateway**（例如改了代码）：先结束旧进程再 `pnpm gateway:dev`。

PowerShell：

```powershell
netstat -ano | findstr ":18765"
# 记下 LISTENING 行的 PID，例如 13716
taskkill /PID 13716 /F
pnpm gateway:dev
```

## 常见问题：Vite 报 `ws proxy error` / `ECONNREFUSED 127.0.0.1:18765`

Web 开发服把 `/gateway-ws` 代理到 Gateway。**Gateway 未启动或刚崩溃重启** 时，Vite 终端会刷 `ECONNREFUSED` 或 `ECONNRESET`，浏览器里侧边栏为空、流式回复也没有。

**处理：**

1. 先起 Gateway，再起 Web（顺序不要反）：
   ```bash
   pnpm gateway:dev          # 终端 A，看到 [gateway] http://127.0.0.1:18765
   pnpm dev:web              # 终端 B
   ```
   或一条命令：`pnpm dev:web:full`（同时起 gateway + web）。
2. 自检：`curl http://127.0.0.1:18765/health` 应返回 `"ok":true`。
3. 若 `EADDRINUSE`，说明已有旧 Gateway 占端口，见上文「端口已被占用」；不要重复起第二个进程。
4. 改完 Gateway 代码后需**重启** `gateway:dev`，否则 Web 仍会连到旧进程或连不上。

HTTP 列表（`GET /api/sessions`）在 Gateway 在线时仍可走代理；**实时同步与流式**依赖 WebSocket，Gateway 必须稳定监听。

## 常见问题：Web 发消息 503

`POST /gateway-api/api/sessions/.../messages` 返回 **503** 表示 gateway **没有在线的桌面 executor**（不是 Vite 代理坏了）。

1. 终端 A：`pnpm gateway:dev`（监听 `18765`）
2. 复制 `.env.example` → `.env`，设置：
   ```env
   GATEWAY_ENABLED=true
   GATEWAY_URL=ws://127.0.0.1:18765/ws
   GATEWAY_SECRET=dev-secret
   ```
3. 终端 B：`pnpm dev:desktop`，侧栏打开 **「远程控制」**（日志：`[main] Gateway remote enabled:`）
4. 终端 C：`pnpm dev:web` 或 `pnpm dev:web:full`
5. 自检：`curl http://127.0.0.1:18765/health` → `"online":true`、`executors` ≥ 1

Web UI 在 503 时会显示「桌面端未连接 Gateway」提示条，并停止「模型正在回复…」转圈。

## Web 新建对话同步桌面

Web 侧「新建对话」会 `POST /api/sessions`，Gateway 经 WS 向桌面 executor 发送 `create_session`，桌面创建 JSONL 会话并刷新侧边栏。需桌面已连接 Gateway（`GATEWAY_ENABLED=true`）。

## 会话数据同步（列表 + 历史）

| API | 行为 |
|-----|------|
| `GET /api/sessions` | Gateway 向桌面 RPC `request_sessions`，返回真实 title/preview/时间 |
| `GET /api/webui-thread?key=desktop:…` | Gateway 向桌面 RPC `request_thread`，返回 JSONL 消息回放 |
| 桌面 `sessions_sync` | 连接后、回合结束、新建会话时主动推送列表；Web 收 `session_updated` 刷新侧边栏 |

实时流式仍走 WS `ui_event`（`delta` / `turn_end` 等）。

**存储分工（双端 JSONL）**：

| 位置 | 路径 |
|------|------|
| Gateway | `~/.learnbuddy-gateway/workspace/sessions/*.jsonl` |
| 桌面 | `~/.learnbuddy-desktop/workspace/sessions/*.jsonl` |

- Web 的 `GET /api/sessions`、`GET /api/webui-thread` **优先读 Gateway 本地 JSONL**（桌面未启动也有数据）。
- 用户发消息会先写入 Gateway，再转发桌面；**桌面离线**时 Gateway 通过 WS 返回系统提示（不 503）。
- 桌面连接且开启「远程控制」后，Gateway 发送 `sync_push` 把本地会话合并到桌面；桌面 `sessions_sync` 再写回 Gateway。
- 环境变量 `GATEWAY_DATA_DIR` 可改 Gateway 数据目录。

**桌面远程控制**：侧栏「新建对话」上方开关。关闭时不连 Gateway，仅本机；开启且 `.env` 配置 `GATEWAY_*` 时连接并双向同步。

若侧边栏已有大量空的「新建对话」，可手动删除 workspace 下仅有一行元数据的 `.jsonl` 文件，或发一条消息后刷新列表。

> **注意**：仓库中若仍存在 `relay-server/` 目录，为迁移遗留副本，**仅维护 `gateway/`**。可安全删除 `relay-server/` 以免混淆。

详见 [CROSS_DEVICE_RELAY.md](./CROSS_DEVICE_RELAY.md)、[MONOREPO_MIGRATION.md](./MONOREPO_MIGRATION.md) §6。
