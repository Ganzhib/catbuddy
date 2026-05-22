# Gateway §6 协议验收

对照 [MONOREPO_MIGRATION.md](./MONOREPO_MIGRATION.md) §6，在 **learnbuddy gateway** 上验收 Web 所需 `InboundEvent`。

## 自动化（无需桌面）

```bash
# 终端 1
pnpm gateway:dev

# 终端 2
pnpm gateway:test:acceptance   # 单测 ui_event 清单
pnpm gateway:test:all          # e2e + ui_event + acceptance
```

`test-acceptance.mjs` 模拟 executor 推送事件序列，经 WS `ui_event` 到 viewer，检查：

| 事件 | 必需 | 自动化 |
|------|------|--------|
| `delta` | ✓ | ✓ |
| `stream_end` | ✓ | ✓ |
| `message`（助手正文） | ✓ | ✓ |
| `message` + `tool_hint` | ✓ | ✓ |
| `turn_end` | ✓ | ✓ |
| `file_edit` | 视产品 | ✓ |
| `reasoning_delta` / `reasoning_end` | 可选 | ✓ |
| `session_updated` | 可选 | ✓ |
| `ready` / `attached` | 客户端本地 | —（`learnbuddyClient` 在 WS open 时发出） |

另含：`GET /webui/bootstrap`、`POST .../messages` HTTP 冒烟。

## 完整 E2E（需桌面 Agent）

```bash
pnpm gateway:dev
# .env: GATEWAY_ENABLED=true, GATEWAY_URL=ws://127.0.0.1:18765/ws, GATEWAY_SECRET=dev-secret
pnpm dev:desktop
pnpm dev:web
```

1. 桌面打开一条对话，记下 `sessionKey`（如 `desktop:1730_abc`）。
2. Web 发消息，确认流式回复、工具卡、`turn_end`。
3. 设置 → 远程控制：配对码 + `POST /api/pair`（或使用 `relay-web.html`）。

## 邮箱鉴权验收

```bash
# gateway 环境
GATEWAY_AUTH_REQUIRE_EMAIL=true
GATEWAY_AUTH_DEV_BYPASS=false
pnpm gateway:dev
```

1. `pnpm dev:web` → 应出现邮箱登录页。
2. `POST /auth/email/request-code` → 控制台 OTP（无 SMTP 时）。
3. 输入验证码 → bootstrap 成功 → 对话可用。

开发默认跳过邮箱（`GATEWAY_AUTH_DEV_BYPASS`）。

## 勾选记录

| 日期 | 环境 | 自动化 | 桌面 E2E | 备注 |
|------|------|--------|----------|------|
| 2026-05-22 | local Nest | ✓ `pnpm gateway:test:all` | 待测 | e2e + ui_event + §6 acceptance |
