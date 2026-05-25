# 规划中的模块

以下目录在仓库中多为 README 占位，尚未在桌面端完整实现。实现时可参考 nanobot 对应子系统。

| 模块 | 路径 | 目标能力 |
|------|------|----------|
| **Bridge** | `src/main/bridge/` | WhatsApp 等外部 IM 桥接（TypeScript 服务 + 主进程协调） |
| **Cron** | `src/main/cron/` | ✅ Dream 定时整理（默认 120 分钟，可配置 `dreamIntervalMinutes`） |
| **Heartbeat** | `src/main/heartbeat/` | 周期性唤醒，检查 HEARTBEAT.md、推送主动消息 |
| **Security** | `src/main/security/` | ✅ SSRF 防护、工作区文件访问策略（PathGuard）；详见 [workspace-and-memory.md](./workspace-and-memory.md) |
| **CLI** | `src/main/cli/` | 无 UI 的命令行入口（调试/自动化） |

## Bridge

预期职责：维护与第三方 IM 的长连接，将入站消息转为 `InboundMessage` 发布到 bus，出站由 `ChannelManager` 路由回 Bridge。

## Cron

已实现（`src/main/cron/`）：

- `CronScheduler` 注册 `dream` 任务，间隔 `agents.defaults.dreamIntervalMinutes`（默认 120）
- 应用退出时 `stopAll()` 清理定时器

手动：`/dream`、`/dream-log`。设计说明：[workspace-and-memory.md](./workspace-and-memory.md)

## Heartbeat

预期职责：后台定时器读取 `templates/HEARTBEAT.md` 等上下文，决定是否向用户通道发送提醒（经 bus.outbound）。

## Security

已实现（`src/main/security/`）：

- HTTP(S) 目标校验，阻止内网/localhost SSRF（`network.ts`）
- 工作区文件访问策略与 PathGuard（`workspace-access.ts`、`path-guard.ts`）
- 与 `templates/agent/identity.md` 提示词对齐

Preload 层另有 bridge 键名校验（`src/preload/security/`）。

设计说明：[workspace-and-memory.md](./workspace-and-memory.md) §2

## 实现优先级建议

1. ~~**Security**（工具上网与文件访问）~~ ✅
2. **Heartbeat**（与现有 `templates/HEARTBEAT.md` 配套）
3. **Cron**
4. **Bridge**（依赖独立服务与打包）

更新实现状态时请同步修改本文件与对应目录 README。
