---
name: desktop-app
description: Electron 桌面应用开发 — 主进程/渲染进程、IPC 通信、LLM Provider、打包
---

# 桌面应用开发

桌面端是基于 Electron 33 的应用，Agent 引擎运行在主进程，React SPA 运行在渲染进程。

## 目录结构

```
apps/desktop/
├── src/
│   ├── main/                 # Electron 主进程
│   │   ├── index.ts          # 应用入口：创建窗口、初始化服务
│   │   ├── agent/            # Agent 引擎（详见 /agent-system 技能）
│   │   ├── providers/        # LLM provider 适配器（Anthropic、OpenAI、DeepSeek）
│   │   ├── channels/         # 消息通道（WebSocket、Telegram 等）
│   │   ├── session/          # 会话持久化管理器
│   │   ├── bus/              # MessageBus — 异步事件路由
│   │   ├── ipcHandlers/      # Electron IPC 处理器注册
│   │   ├── services/         # 应用服务（全局配置等）
│   │   ├── config/           # 应用配置
│   │   ├── security/         # 安全措施
│   │   ├── windows/          # Electron 窗口管理
│   │   ├── menu/             # 应用菜单
│   │   ├── utils/            # 共享工具、日志
│   │   ├── heartbeat/        # 定时 Agent 唤醒
│   │   ├── cron/             # 定时任务引擎
│   │   └── constant/         # 常量定义
│   ├── preload/              # 预加载脚本（contextBridge）
│   └── renderer/             # 渲染进程入口（启动 @catbuddy/ui）
├── templates/                # Handlebars 模板（打包进安装包）
├── skills/                   # 内置技能包（打包进安装包）
├── public/                   # 静态资源（品牌图片等）
├── vite.config.ts            # Vite + Electron 插件配置
└── package.json              # 含 electron-builder 打包配置
```

## 开发命令

```bash
# 开发模式（主进程 + 渲染进程 HMR）
pnpm dev:desktop

# 全新开发（先清理 dist-electron）
cd apps/desktop && pnpm dev:fresh

# 构建安装包（NSIS/DMG/AppImage）
pnpm build:desktop

# 构建未打包版本（跳过安装包，测试更快）
cd apps/desktop && pnpm build:unpack

# 详细构建（查看编译细节）
cd apps/desktop && pnpm build:verbose

# 杀掉正在运行的 catbuddy 进程（Windows）
cd apps/desktop && pnpm kill-app

# 清理后重新构建
cd apps/desktop && pnpm rebuild:unpack
```

## 主进程 vs 渲染进程

### 主进程（src/main/）
- 拥有完整的 Node.js 权限：文件系统、子进程、OS API
- 运行 Agent 引擎（LLM 调用、工具执行）
- 通过 Electron IPC（`ipcMain.handle`）与渲染进程通信
- 窗口管理、托盘图标、菜单、自动更新
- **不能**直接访问 React/DOM

### 渲染进程（packages/ui/ + src/renderer/）
- 运行 React SPA
- 可访问 DOM，但与 Node.js 隔离（沙箱化）
- 通过预加载脚本暴露的 `window.api` 与主进程通信
- 渲染聊天界面、设置面板、图表查看器

### 预加载脚本（src/preload/）
- 运行在主进程和渲染进程之间的特权上下文
- 通过 `contextBridge.exposeInMainWorld()` 暴露受控 API

## IPC 通信模式

```
渲染进程                  预加载                    主进程
   │                        │                         │
   │── window.api.xxx() ──► │── ipcRenderer.invoke()─►│
   │                        │   ('channel', args)     │
   │                        │                         │── 执行业务逻辑
   │                        │                         │
   │                        │◄── 返回值 ──────────────│
   │◄── Promise resolve ────│                         │
```

**关键约束**：
- 渲染进程只能通过预加载暴露的方法调用主进程
- 不要在预加载中暴露 `ipcRenderer` 本身（安全风险）
- IPC 通信的数据会被序列化（只能传递可序列化的数据）

## LLM Provider

Provider 位于 [src/main/providers/](apps/desktop/src/main/providers/)：

| Provider | SDK | 说明 |
|----------|-----|------|
| Anthropic | `@anthropic-ai/sdk` | Claude 系列模型 |
| OpenAI 兼容 | `openai` SDK | DeepSeek 等兼容 OpenAI 协议的模型 |

Provider 选择基于用户在 `model_presets.ts` 中配置的预设方案。

## Vite 配置要点

桌面端使用 `vite-plugin-electron`，其工作流程：
1. 将 `src/main/` 编译到 `dist-electron/`
2. 将 `src/preload/` 编译到 `dist-electron/preload/`
3. 开发模式下启动 Electron 并指向 Vite 开发服务器

**注意**：`dist-electron/` 被 gitignore，`git clean` 后必须重新构建。

## 打包（electron-builder）

配置在 `apps/desktop/package.json` 的 `build` 字段：

| 平台 | 格式 | 安装选项 |
|------|------|----------|
| Windows | NSIS 安装器 | 非一键安装，允许选择安装目录 |
| macOS | DMG | — |
| Linux | AppImage | — |

打包内容包括：`dist/`、`dist-electron/`、`templates/`、`skills/`、`src/main/assets/`

## 品牌资源生成

```bash
# 生成带 cat 文字叠加的应用图标
cd apps/desktop && pnpm brand:generate

# 移除图标背景
cd apps/desktop && pnpm brand:cutout
```

## 构建与工具脚本

### `desktop-build.mjs` — 桌面端构建入口

```bash
# 通过 package.json 脚本（推荐）
pnpm build:desktop
pnpm build:desktop:verbose     # 详细输出

# 直接调用
node scripts/desktop-build.mjs
node scripts/desktop-build.mjs --verbose          # 显示 electron-builder 调试信息
node scripts/desktop-build.mjs --dir              # 仅 unpacked，不生成安装包
node scripts/desktop-build.mjs --no-kill          # 跳过杀进程步骤
node scripts/desktop-build.mjs -- --win nsis      # 传递参数给 electron-builder
```

**构建流程**：
1. 生成时间戳构建 ID（`apps/desktop/src/main/constant/build.ts`）
2. 杀掉占用 release 目录的进程（跨平台：`taskkill` / `pkill` / `killall`）
3. 清理旧的 release 构建目录
4. 运行 `vite build` + `electron-builder`

**环境变量**：
| 变量 | 作用 |
|------|------|
| `CATBUDDY_BUILD_VERBOSE=1` | 等同 `--verbose` |
| `CATBUDDY_BUILD_NO_KILL=1` | 等同 `--no-kill` |
| `CATBUDDY_DESKTOP_RELEASE_DIR` | 指定 release 输出目录（`release` / `release-fresh`） |

### `kill-desktop-processes.mjs` — 停止桌面进程

```bash
cd apps/desktop && pnpm kill-app
# 或直接
node scripts/kill-desktop-processes.mjs
```

跨平台杀掉 catbuddy / Electron 进程，解除对 `release/` 目录的文件锁定。Windows 用 `taskkill`，macOS 用 `pkill`，Linux 用 `killall`。

### `unlock-desktop-release.mjs` — 清理 release 目录

```bash
node scripts/unlock-desktop-release.mjs
```

- 删除 `win-unpacked` 等解包目录（可能被进程锁定）
- 清理带时间戳的旧构建目录（`release-build-*`）
- 保留当前构建输出目录

### `stage-desktop-installer.mjs` — 放置安装包供 Web 下载

```bash
node scripts/stage-desktop-installer.mjs
node scripts/stage-desktop-installer.mjs --source path/to/installer.exe
node scripts/stage-desktop-installer.mjs --dry-run
```

将桌面 NSIS 安装器复制到 `apps/web/public/downloads/`，并打包成 `.zip`。Web 端通过 `/downloads/catbuddy-setup-win-x64.zip` 提供下载。

## 品牌资源脚本

### `generate-brand.mjs` — 生成品牌图标

```bash
cd apps/desktop && pnpm brand:generate
# 自定义参数
node scripts/generate-brand.mjs -- --icon path/to/icon.png --logo path/to/logo.png
node scripts/generate-brand.mjs -- --compose-logo --logo-text catbuddy --logo-split 3
```

从 `public/brand/source/icon.png` 生成各尺寸的图标（16×16 → 512×512），并合成横向 logo（图标 + 文字）。

### `remove-icon-background.mjs` — AI 去除图标背景

```bash
cd apps/desktop && pnpm brand:cutout
# 自定义输入输出
node scripts/remove-icon-background.mjs -- --input photo.png --output icon.png
node scripts/remove-icon-background.mjs -- --no-backup   # 不保留原文件备份
```

使用 `@imgly/background-removal-node` 基于 AI 自动去除图标背景，输出透明 PNG。

## 调试技巧

- 主进程日志输出到终端（从终端启动才能看到）
- 渲染进程：开发模式下 F12 打开 DevTools
- Electron DevTools：应用窗口内 `Ctrl+Shift+I`
- IPC 消息可通过 `utils/logger.ts` 中的日志工具追踪
