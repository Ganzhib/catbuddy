# catbuddy — 项目计划（Monorepo）

> 历史单包结构说明已归档；当前以 **pnpm workspace** 为准。详见 [README.md](./README.md)、[docs/MONOREPO_MIGRATION.md](./docs/MONOREPO_MIGRATION.md)。

## 概述

Web + 桌面共用 UI（`@catbuddy/ui`）与客户端协议（`@catbuddy/client`），桌面内置本地 Agent，Web 连接 nanobot gateway。

## 技术栈

- **Monorepo**: pnpm workspace
- **桌面**: Electron 33 + Vite 5（`apps/desktop`）
- **Web**: Vite + React 18（`apps/web`）
- **UI**: Tailwind CSS + Radix UI
- **AI**: Anthropic / OpenAI SDK（桌面 Agent）

## 目录结构

```text
catbuddy/
├── apps/desktop/       # Electron 主进程 + Agent + 打包
├── apps/web/           # 浏览器 SPA
├── packages/
│   ├── shared/         # 类型与协议
│   ├── client/         # catbuddyClient + transport
│   ├── platform/       # IPC / HTTP bootstrap & API
│   └── ui/             # React 应用
├── gateway-legacy-removed/       # 跨端 relay
└── docs/
```

## 当前状态

- [x] Monorepo 骨架（M1–M5）
- [x] `@catbuddy/platform` IPC + HTTP 双实现
- [x] `pnpm -r lint`
- [ ] Web 与 gateway 端到端验收（见迁移文档 §6）
- [ ] 根目录 `webui/` 废弃说明（见 [docs/WEBUI_DEPRECATED.md](./docs/WEBUI_DEPRECATED.md)）

## 开发命令

```bash
pnpm install
pnpm dev:desktop
pnpm dev:web
pnpm lint
```
