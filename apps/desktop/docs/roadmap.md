# 规划中的模块

以下目录在仓库中多为 README 占位，尚未在桌面端完整实现。实现时可参考 nanobot 对应子系统。

| 模块 | 路径 | 目标能力 |
|------|------|----------|
| **Bridge** | `src/main/bridge/` | WhatsApp 等外部 IM 桥接（TypeScript 服务 + 主进程协调） |
| **Cron** | `src/main/cron/` | 定时任务存储与触发，经 bus 或 `processDirect` 驱动 Agent |
| **Heartbeat** | `src/main/heartbeat/` | 周期性唤醒，检查 HEARTBEAT.md、推送主动消息 |
| **Security** | `src/main/security/` | SSRF 防护、URL 校验（供 web fetch 类工具使用） |
| **CLI** | `src/main/cli/` | 无 UI 的命令行入口（调试/自动化） |

## Bridge

预期职责：维护与第三方 IM 的长连接，将入站消息转为 `InboundMessage` 发布到 bus，出站由 `ChannelManager` 路由回 Bridge。

## Cron

预期职责：持久化 cron 表达式与任务体；到期后向 bus 发布系统消息或调用 `AgentLoop.processDirect`。

## Heartbeat

预期职责：后台定时器读取 `templates/HEARTBEAT.md` 等上下文，决定是否向用户通道发送提醒（经 bus.outbound）。

## Security

预期职责：

- 校验 HTTP(S) 目标，阻止内网/localhost SSRF
- 供 Agent 工具中的 `web_fetch` 等调用

Preload 层已有基础 bridge 键名校验（`src/preload/security/`）；网络层防护计划在 main `security/` 实现。

## 实现优先级建议

1. **Security**（工具上网前必需）
2. **Heartbeat**（与现有 `templates/HEARTBEAT.md` 配套）
3. **Cron**
4. **Bridge**（依赖独立服务与打包）

更新实现状态时请同步修改本文件与对应目录 README。
