# CLAUDE.md

本文件为 Claude Code 提供代码仓库的上下文指引。

> 🐱 **新队友？** → 先看 [Claude Code 上手指南](docs/CLAUDE_CODE_ONBOARDING.md)，5 分钟上手。

## 项目概述

catbuddy 是一个桌面优先的 AI 编程助手——包含 Electron 桌面应用、浏览器 SPA（Web 遥控器）和 Fastify 跨端中继网关。桌面应用在本地运行 AI Agent（Anthropic / OpenAI 兼容 provider），拥有完整的文件系统访问权限；Web 端是纯 UI 层，通过网关连接到桌面 Agent。

## 可用技能

在 Claude Code 中使用 `/skill-name` 快速获得特定子系统的上下文：

| 技能 | 命令 | 覆盖范围 |
|------|------|----------|
| Monorepo 开发 | `/catbuddy-dev` | 包结构、依赖链、工作流、通用脚本 |
| Agent 引擎 | `/agent-system` | 状态机、工具系统、上下文、记忆、子代理 |
| 桌面应用 | `/desktop-app` | Electron 主/渲染进程、IPC、打包、品牌 |
| Gateway | `/gateway` | Fastify 中继、认证、部署、数据重置 |
| Langfuse | `/langfuse-tracing` | LLM 追踪、PII 脱敏、自托管 |
| MCP 集成 | `/mcp-integration` | MCP 服务管理、Schema 适配、跨平台 |
| 安全隔离 | `/security-workspace` | PathGuard、SSRF 防护、工作空间策略 |
| Provider | `/llm-providers` | LLM 抽象层、工厂、Anthropic/OpenAI/Fallback |
| 命令系统 | `/command-system` | 三层路由、内置命令、添加新命令 |
| 定时任务 | `/heartbeat-cron` | CronScheduler、Dream 自动巩固、心跳唤醒 |
| 架构守护 | `/architecture-guard` | 设计原则、拆分模式、解耦策略、命名规范、数据流分层 |

## 开发命令

```bash
# 安装所有依赖
pnpm install

# 桌面应用（Electron + Agent）
pnpm dev:desktop          # 开发服务器，支持热重载
pnpm build:desktop         # 生产构建（NSIS/DMG/AppImage）

# Web 端（React SPA）
pnpm dev:web              # 开发服务器（需先启动 Gateway）
pnpm dev:web:full         # 一键启动：Gateway + Web 开发服务器

# Gateway（Fastify + WebSocket）
pnpm gateway:dev           # 启动 Gateway，监听 :18765
pnpm gateway:build         # 编译 TypeScript
pnpm gateway:test          # 运行 E2E 测试

# 全量发布构建
pnpm build:release         # 桌面 + Web

# 类型检查（所有包）
pnpm lint

# 数据库（Gateway 所需的 MySQL）
pnpm build:database        # docker compose up mysql

# 测试数据重置
pnpm reset:data:desktop    # 清除桌面端测试数据
pnpm reset:data:gateway:local  # 清除本地 Gateway 测试数据
```

## Monorepo 结构

```
catbuddy/                   # pnpm workspace 根目录
├── apps/
│   ├── desktop/            # Electron 33 + Vite 5 + Agent 引擎
│   ├── web/                # 浏览器 SPA（React + Vite）
│   └── mobile/             # 移动端占位
├── packages/
│   ├── ui/                 # 共享 React 应用（Tailwind + Radix UI）
│   ├── client/             # catbuddyClient + 传输层（IPC/WS/HTTP）
│   ├── platform/           # IPC/HTTP 启动引导与 API 抽象
│   └── shared/             # 类型、协议定义、Zod schemas
├── gateway/                # 跨端中继（Fastify + WebSocket + MySQL）
├── deploy/                 # Gateway 与 Web 部署脚本
├── scripts/                # 构建、品牌、清理等工具脚本
├── docs/                   # 架构文档、设计模式、Langfuse 文档
├── langfuse-docker/        # Langfuse 自托管部署
└── .catbuddy/              # Agent 运行时配置（SOUL、TOOLS、skills、memory）
```

## 顶层架构

### 数据流

```
桌面应用 (Electron)
├── 主进程 (src/main/)
│   ├── Agent 引擎 (agent/)
│   │   ├── AgentLoop — 核心状态机（RESTORE→COMPACT→COMMAND→BUILD→RUN→SAVE→RESPOND）
│   │   ├── AgentRunner — LLM 对话循环 + 工具执行
│   │   ├── ContextBuilder — 组装系统提示词、记忆、技能、MCP 上下文
│   │   ├── ToolRegistry — 自动发现的工具（文件系统、Shell、MCP、搜索等）
│   │   ├── SubagentManager — 派生子代理处理复杂任务
│   │   ├── Memory — 会话历史 + Dream 两阶段记忆巩固
│   │   ├── AutoCompact — 基于 TTL 的上下文自动压缩
│   │   └── Langfuse — LLM 调用追踪与可观测性
│   ├── Providers (providers/) — Anthropic、OpenAI、DeepSeek
│   ├── Channels (channels/) — Telegram、WeCom、WeChat、WebSocket 等
│   ├── Session (session/) — 按通道的会话持久化
│   └── IPC (ipcHandlers/) — Electron IPC 桥接渲染进程
├── 渲染进程 (src/renderer/) — 基于 @catbuddy/ui 的 React SPA
└── 预加载 (src/preload/) — contextBridge 安全桥接
```

### 核心子系统

- **AgentLoop** ([apps/desktop/src/main/agent/loop.ts](apps/desktop/src/main/agent/loop.ts))：核心状态机。通过 MessageBus 消费来自各通道的入站消息，按状态转换执行，将 LLM 轮次分派给 AgentRunner，并发布出站回复。
- **AgentRunner** ([apps/desktop/src/main/agent/runner.ts](apps/desktop/src/main/agent/runner.ts))：管理多轮 LLM 对话——发送消息给 provider、接收工具调用、执行工具、流式返回结果。强制最大轮数限制，防止死循环。
- **工具系统** ([apps/desktop/src/main/agent/tools/](apps/desktop/src/main/agent/tools/))：自动发现的工具实现——`read-file`、`write-file`、`edit-file`、`exec`（沙箱化 Shell）、`grep`、`web-search`、`web-fetch`、`mcp`、`spawn`（子代理）、`generate-image`、图表工具等。
- **上下文构建** ([apps/desktop/src/main/agent/context/](apps/desktop/src/main/agent/context/))：组装完整 LLM 上下文——含 SOUL、TOOLS、skills 的系统提示词；用户/系统/助手消息；MCP 上下文；会话历史。
- **记忆系统** ([apps/desktop/src/main/agent/memory.ts](apps/desktop/src/main/agent/memory.ts))：会话历史 + Dream 两阶段记忆巩固（提取 → 整合到分层记忆）。
- **Langfuse** ([apps/desktop/src/main/agent/langfuse-client.ts](apps/desktop/src/main/agent/langfuse-client.ts), [langfuse-hook.ts](apps/desktop/src/main/agent/langfuse-hook.ts))：LLM 可观测性——追踪生成调用、工具使用、Token 用量。支持自托管部署。
- **MessageBus** ([apps/desktop/src/main/bus/](apps/desktop/src/main/bus/))：异步事件总线，解耦通道与 Agent 核心。
- **Channels** ([apps/desktop/src/main/channels/](apps/desktop/src/main/channels/))：多平台消息来源——WebSocket、Telegram 等。
- **Gateway** ([gateway/](gateway/))：Fastify + WebSocket 中继。处理认证（邮箱配对）、会话持久化（MySQL）、Web 客户端与桌面 Agent 之间的消息路由。
- **共享 UI** ([packages/ui/](packages/ui/))：React 18 SPA + Tailwind CSS 3 + Radix UI + Lucide 图标。桌面渲染进程和 Web 端共用。

### 入口文件

- **桌面主进程**：[apps/desktop/src/main/index.ts](apps/desktop/src/main/index.ts)
- **桌面渲染进程**：[packages/ui/](packages/ui/)
- **Web 应用**：[apps/web/](apps/web/)
- **Gateway**：[gateway/src/](gateway/src/)

## 技术栈

| 层面 | 技术 |
|------|------|
| 桌面 | Electron 33、Vite 5 |
| 前端 | React 18、Tailwind CSS 3、Radix UI、Lucide Icons |
| 后端 | Fastify、WebSocket、MySQL |
| AI | Anthropic SDK、OpenAI SDK、DeepSeek、MCP 协议 |
| 语言 | TypeScript 5.7 |
| 工程 | pnpm workspace、Zod、react-i18next |
| 打包 | electron-builder（NSIS/DMG/AppImage）、Docker Compose |
| 可观测性 | Langfuse（自托管或云端） |

## 代码规范

- **语言**：TypeScript 5.7，strict 模式，ESM（`"type": "module"`）
- **注释**：业务逻辑用中文，技术术语保留英文
- **文件命名**：模块用 kebab-case，类/组件用 PascalCase
- **Monorepo**：pnpm workspace，内部包引用用 `workspace:*` 协议
- **类型检查**：每个包单独运行 `tsc --noEmit`（无独立 linter）
- **Agent 工具**：从 `tools/` 目录自动发现，在 `registry.ts` 中注册

## 关键环境变量

| 变量 | 用途 | 默认值 |
|------|------|--------|
| `CATBUDDY_DEV_MODE` | `local` 或 `remote` 模式 | `local` |
| `GATEWAY_ACCOUNT_EMAIL` | 登录配对邮箱 | — |
| `DEEPSEEK_KEY` | AI provider API Key | — |
| `GATEWAY_PORT` | Gateway 监听端口 | `18765` |
| `LANGFUSE_SECRET_KEY` | Langfuse 密钥 | — |
| `LANGFUSE_PUBLIC_KEY` | Langfuse 公钥 | — |
| `LANGFUSE_HOST` | Langfuse 服务地址 | — |

## 脚本速查表

所有脚本位于 [scripts/](scripts/) 目录。

| 脚本 | 命令 | 用途 |
|------|------|------|
| `clean-package-emit.mjs` | `pnpm clean:packages` | 清理 TS 意外编译产物 |
| `desktop-build.mjs` | `pnpm build:desktop` | 桌面端构建入口（Vite + electron-builder） |
| `kill-desktop-processes.mjs` | `cd apps/desktop && pnpm kill-app` | 跨平台停止桌面进程 |
| `unlock-desktop-release.mjs` | — | 清理被锁定的 release 目录 |
| `stage-desktop-installer.mjs` | — | 放置安装包到 Web 下载目录 |
| `generate-brand.mjs` | `cd apps/desktop && pnpm brand:generate` | 生成各尺寸品牌图标 |
| `remove-icon-background.mjs` | `cd apps/desktop && pnpm brand:cutout` | AI 去除图标背景 |
| `gateway-preflight.mjs` | — | Gateway 启动前健康检查（Vite 插件） |
| `reset-test-data.cjs` | `pnpm reset:data:*` | 测试数据重置（本地/远程） |
| `test-langfuse.mjs` | `node scripts/test-langfuse.mjs` | Langfuse 集成验证 |
| `fix-monorepo-imports.mjs` | — | 批量修复 monorepo 导入路径 |
| `load-repo-env.mjs` | — | 加载 .env 环境变量（供其他脚本引用） |
| `repo-root.mjs` | — | 获取 monorepo 根路径（供其他脚本引用） |
| `vite-ignore-package-emit.mjs` | — | Vite 文件监听过滤（忽略包编译产物） |

## 项目参考资料

- 架构决策：[docs/architecture/](docs/architecture/)
- 设计模式：[docs/design-patterns/](docs/design-patterns/)
- Gateway 文档：[docs/GATEWAY.md](docs/GATEWAY.md)
- 部署文档：[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Langfuse 集成：[docs/langfuse/](docs/langfuse/)
- Agent 人格：[.catbuddy/SOUL.md](.catbuddy/SOUL.md)
- Agent 工具指南：[.catbuddy/TOOLS.md](.catbuddy/TOOLS.md)

## 分支与提交规范

- 功能分支：`{author}/feature/{name}`（如 `zhibin/feature/desktop-agentEvaluation`）
- Commit 风格：`feat(scope): 描述` 或 `fix(scope): 描述`
- Claude Code 生成的 commit 会附加 `Co-Authored-By: Claude <noreply@anthropic.com>` 尾注

## .claude/ 配置说明

本项目的 `.claude/` 目录做了完整配置以最大化 Claude Code 效能：

| 配置 | 位置 | 作用 |
|------|------|------|
| 权限白名单 | `settings.json` / `settings.local.json` | 预授权 `pnpm`、`git`、`tsc`、`node scripts` 等常用命令，减少弹窗 |
| Hooks | `settings.json` | `PostToolUse` shared 包变更提醒；`SessionStart` 技能就绪提示 |
| Skills (11个) | `skills/` | 覆盖全部子系统，`/` 唤出 |
| Memory (5个) | `memory/` | 跨会话持久事实：shared 重建、dist-electron、workspace 协议、三层类型、MCP 兼容 |
| Workflows (2个) | `workflows/` | `/review-changes` 三维代码审查；`/type-check-all` 并行全量类型检查 |
