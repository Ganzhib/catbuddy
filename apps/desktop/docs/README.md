# Catbuddy Desktop 技术文档

Electron 桌面客户端：本地 Agent 运行时 + React UI，与 monorepo 内 `@catbuddy/ui`、`@catbuddy/gateway-sdk-desktop` 等包协作。

## 文档索引

| 文档 | 说明 |
|------|------|
| [architecture.md](./architecture.md) | 三层进程架构、目录结构、消息流、依赖关系 |
| [development.md](./development.md) | 开发命令、环境变量、构建产物、本地数据目录 |
| [ipc.md](./ipc.md) | Preload API、IPC 通道清单、安全边界 |
| [main-process.md](./main-process.md) | 主进程模块：Agent、Bus、Channels、Session、Gateway |
| [reference/agent-loop.md](./reference/agent-loop.md) | AgentLoop 状态机与编排（深度） |
| [reference/providers.md](./reference/providers.md) | OpenAI 与 Anthropic 协议差异 |
| [roadmap.md](./roadmap.md) | 规划中模块（Bridge、Cron、Heartbeat、Security） |

## 源码布局（速查）

```
apps/desktop/
├── src/
│   ├── main/           # 主进程：Agent 后端 + IPC + 窗口
│   ├── preload/        # 预加载：contextBridge API
│   └── renderer/       # 渲染进程：React 入口
├── public/             # 静态资源（brand）
├── templates/          # Agent 提示词模板
├── skills/             # 内置 Skill 定义
├── docs/               # 本目录
└── vite.config.ts
```

## 相关仓库路径

- UI 组件：`catbuddy/packages/ui`
- 类型与配置：`catbuddy/packages/shared`
- 平台抽象（preload 类型）：`catbuddy/packages/platform`
- Gateway SDK：`catbuddy/gateway/packages/sdk-desktop`
