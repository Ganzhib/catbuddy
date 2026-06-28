# 架构总览

## 三层进程模型

桌面应用按 Electron 惯例分为三层，源码位于 `src/`：

```
┌─────────────────────────────────────────────────────────────┐
│  Renderer (src/renderer/)                                   │
│  React + @catbuddy/ui  ·  无 Node 集成                     │
└───────────────────────────┬─────────────────────────────────┘
                            │ contextBridge (window.catbuddy)
┌───────────────────────────▼─────────────────────────────────┐
│  Preload (src/preload/)                                     │
│  index.cjs → api/ + security/  ·  纯 CommonJS，不经 tsc 编译   │
└───────────────────────────┬─────────────────────────────────┘
                            │ ipcRenderer.invoke / on
┌───────────────────────────▼─────────────────────────────────┐
│  Main (src/main/)                                           │
│  index.ts · windows/ · menu/ · ipcHandlers/ · services/      │
│  agent/ · bus/ · channels/ · session/ · providers/ …       │
└─────────────────────────────────────────────────────────────┘
```

| 层 | 入口 | 构建输出 |
|----|------|----------|
| Main | `src/main/index.ts` | `dist-electron/index.js` |
| Preload | `src/preload/index.cjs` | `dist-electron/preload/`（构建时复制） |
| Renderer | `src/renderer/index.html` | `dist/` |

`package.json` 的 `main` 字段指向 `dist-electron/index.js`。

## 主进程目录职责

| 路径 | 职责 |
|------|------|
| `index.ts` | `app.whenReady`：加载 env、创建窗口、初始化 Agent |
| `windows/main-window.ts` | `BrowserWindow`、preload 路径、加载 dev URL / `dist/index.html` |
| `menu/` | 应用菜单（当前隐藏原生菜单栏） |
| `ipcHandlers/` | `ipcMain.handle` 注册（Agent、Session、Config、Skills 等） |
| `services/init-agent.ts` | 配置、Session、Bus、Channel、AgentLoop 启动 |
| `services/gateway-remote.ts` | Gateway WebSocket 远程控制与相关 IPC |
| `agent/` | AgentLoop、Runner、Context、Memory、Tools |
| `bus/` | 入站/出站消息队列 |
| `channels/` | DesktopChannel、GatewayChannel、ChannelManager |
| `session/` | 会话持久化 |
| `providers/` | LLM Provider 工厂与实现 |
| `command/` | 斜杠命令路由 |
| `config/` | 默认配置与持久化 |
| `security/` | SSRF 防护、工作区文件访问策略（PathGuard） |
| `services/global-profile.ts` | 全局用户 profile 锚点（分层记忆） |
| `sync/` | WebUI 线程快照、工具事件映射 |
| `assets/` | 窗口/打包图标 |

## 端到端消息流

用户发送一条聊天消息时的路径：

```
Renderer: catbuddy.sendMessage(chatId, content)
    → Preload: ipcRenderer.invoke('agent:send', …)
    → Main: ipcHandlers → bus.publishInbound(InboundMessage)
    → AgentLoop.run() 消费 inbound → 状态机处理
    → bus.publishOutbound(OutboundMessage)
    → DesktopChannel.sendDelta / sendAssistantMessage / …
    → webContents.send('agent:stream-delta', …)
    → Preload 订阅 → Renderer 更新 UI
```

Gateway 远程开启时，额外注册 `GatewayChannel`：云端会话可通过 WebSocket 注入 `bus.inbound`，出站同步回 Gateway。

```mermaid
sequenceDiagram
  participant UI as Renderer
  participant PL as Preload
  participant IPC as ipcHandlers
  participant Bus as MessageBus
  participant Loop as AgentLoop
  participant Ch as DesktopChannel

  UI->>PL: sendMessage
  PL->>IPC: agent:send
  IPC->>Bus: publishInbound
  Loop->>Bus: consumeInbound
  Loop->>Loop: 状态机 + Runner
  Loop->>Bus: publishOutbound
  Bus->>Ch: route
  Ch->>UI: stream-delta / assistant-message
```

## Monorepo 依赖

| 包 | 用途 |
|----|------|
| `@catbuddy/ui` | 聊天界面、设置、主题（与 Web 共用） |
| `@catbuddy/shared` | 消息类型、`catbuddyConfig`、品牌资源路径 |
| `@catbuddy/platform` | `window.catbuddy` 类型声明 |
| `@catbuddy/client` | 客户端协议（按需） |
| `@catbuddy/gateway-sdk-desktop` | 桌面端 Gateway WebSocket 客户端 |

Vite 在 `vite.config.ts` 中将上述包 alias 到 `packages/*` 源码，便于联调。

## 打包资源

`electron-builder` 的 `files` 包含：

- `dist/`、`dist-electron/`
- `src/main/assets/`
- `templates/`、`skills/`

运行时从 `dist-electron/` 相对路径解析 `templates/`、`skills/`（见 `agent/context.ts`、`agent/skill.ts`）。

## 用户数据目录

首次启动在用户主目录创建 `.catbuddy`。完整说明见 [workspace-and-memory.md](./workspace-and-memory.md)。

| 路径 | 内容 |
|------|------|
| `~/.catbuddy/workspace/` | Agent 工作区；**全局** USER.md 与用户向 MEMORY |
| `~/.catbuddy/config/config.json` | 模型、Provider、Gateway 等配置 |
| `~/.catbuddy/workspace-folders.json` | 已注册的项目文件夹列表 |
| `{project}/.catbuddy/workspace/` | 项目级 workspace（MEMORY、sessions、AGENTS 等） |

环境变量加载顺序（`src/main/index.ts`）：

1. 根目录 `.env`（开发）或 `.env.production`（打包）
2. `~/.catbuddy.env`（可选覆盖）

模板见根目录 `.env.example`。
