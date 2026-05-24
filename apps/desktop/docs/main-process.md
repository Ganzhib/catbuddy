# 主进程模块

主进程在 `src/main/` 内实现本地 Agent 运行时，设计对齐 nanobot/catbuddy Python 版的核心概念，并适配 Electron IPC。

## 启动顺序

`index.ts` → `createMainWindow()` → `initAgent()`（`services/init-agent.ts`）：

1. 读取/创建 `~/.catbuddy-desktop/config/config.json`
2. `SessionManager(workspace)`
3. `MessageBus` + `ChannelManager` + 注册 `DesktopChannel`
4. `applyGatewayRemote()`（若配置与环境允许）
5. `createProvider(config)` → `AgentLoop` 构造
6. `registerIpcHandlers(...)`、`channelManager.start()`、`agentLoop.run()`

## Agent（`agent/`）

| 文件 | 职责 |
|------|------|
| `loop.ts` | 消息状态机、bus 消费循环、斜杠命令调度 |
| `runner.ts` | LLM 多轮对话 + 工具调用 |
| `context.ts` | Handlebars 模板组装 system prompt、skills |
| `memory.ts` | 记忆压缩（Dream 两阶段） |
| `tools/` | 工具注册与执行（`registry.ts` + 各工具模块） |
| `skill.ts` | 内置 skills 目录扫描 |

深度说明见 [reference/agent-loop.md](./reference/agent-loop.md)。

桌面端 **模式 A（bus 驱动）**：用户消息经 IPC 进入 `bus.inbound`，`AgentLoop.run()` 后台消费；响应经 `DesktopChannel` 推送到 Renderer。

## Bus（`bus/`）

解耦「消息来源」与「消息去向」的多对多路由：

```
通道 ── inbound queue ──► AgentLoop ── outbound queue ──► ChannelManager ──► 各 Channel
```

- `queue.ts`：`publishInbound` / `consumeInbound` / `publishOutbound` 等
- `events.ts`：入站/出站类型

无 bus 时，每增加 Gateway、cron、heartbeat 等来源都需在 AgentLoop 内硬编码回调；bus 让消息自带 `channel` + `chatId`，由 `ChannelManager` 路由出站。

## Channels（`channels/`）

| 实现 | 说明 |
|------|------|
| `DesktopChannel` | 消费 `bus.outbound`，`webContents.send` 到 Renderer（流式、工具进度等） |
| `GatewayChannel` | 与 `GatewayDesktopClient` 配合，远程 WebUI 会话同步 |
| `ChannelManager` | 注册/注销、`start()` 时启动各 channel 的 outbound 消费 |

`DesktopChannel` 是桌面 UI 的唯一出站路径；入站由 IPC 写入 bus，不经过 Channel 类。

## Command（`command/`）

斜杠命令从 `AgentLoop._state_command` 拆出为 `CommandRouter`：

- **priority**：如 `/stop`，在会话锁外处理
- **exact**：`/help`、`/new`、`/status` …
- **prefix**：`/model <name>` 等

命中命令则短路，不调用 LLM；未命中进入 `BUILD` → `RUN` 流水线。处理器在 `command/handlers/`。

## Session（`session/`）

`SessionManager`：按 `sessionKey`（如 `desktop:main`）持久化对话历史、导入 WebUI 线程快照（`sync/session-thread.ts`）。

## Providers（`providers/`）

`factory.ts` 根据 `config.json` 创建 Provider（OpenAI 兼容、Anthropic、fallback 链）。配置热更新时 IPC `config:update` 可重建 Provider。

协议差异见 [reference/providers.md](./reference/providers.md)。

## Config（`config/`）

- `defaults.ts`：首次启动默认配置
- `persist.ts`：写回 `config.json`

## Sync（`sync/`）

- `session-thread.ts`：会话 → WebUI thread 结构，供 Gateway 同步
- `tool-event-map.ts`：工具事件 → UI 提示

## 与 Renderer 的边界

- Renderer **不**直接访问文件系统、LLM、会话存储。
- 所有能力经 [ipc.md](./ipc.md) 中的 `window.catbuddy`。
- UI 实现集中在 `@catbuddy/ui`，桌面 `renderer/main.tsx` 仅挂载 `<App />`。
