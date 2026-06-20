---
name: catbuddy-dev
description: Monorepo 开发指南 — pnpm workspace 结构、包依赖关系、常见开发工作流
---

# catbuddy Monorepo 开发指南

## 包全景

catbuddy 是一个 pnpm monorepo，包含以下工作空间包：

| 包名 | 路径 | 用途 |
|------|------|------|
| `@catbuddy/desktop` | `apps/desktop/` | Electron 桌面应用 + Agent 引擎 |
| `@catbuddy/web` | `apps/web/` | 浏览器 SPA 入口 |
| `@catbuddy/ui` | `packages/ui/` | 共享 React 应用主体（Tailwind + Radix UI） |
| `@catbuddy/client` | `packages/client/` | 客户端 SDK + 传输层（IPC/WS/HTTP） |
| `@catbuddy/platform` | `packages/platform/` | IPC/HTTP API 抽象层 |
| `@catbuddy/shared` | `packages/shared/` | 公共类型、协议定义、Zod schemas |
| `@catbuddy/gateway` | `gateway/` | 跨端中继服务（Fastify + WebSocket） |
| `@catbuddy/gateway-sdk-desktop` | `gateway/packages/gateway-sdk-desktop/` | 桌面端连接 Gateway 的 SDK |

## 包依赖链

```
@catbuddy/shared  ← 基础类型，被所有包依赖
@catbuddy/client  ← 依赖 shared
@catbuddy/platform ← 依赖 shared, client
@catbuddy/ui      ← 依赖 shared, client, platform
@catbuddy/desktop ← 依赖 shared, client, platform, ui, gateway-sdk-desktop
@catbuddy/web     ← 依赖 shared, client, ui
@catbuddy/gateway ← 依赖 shared
```

**关键约束**：
- 只在 `@catbuddy/shared` 中定义跨包共享的类型和协议
- `packages/ui/` 不能依赖任何 Electron 专用模块
- `@catbuddy/client` 提供传输层抽象，桌面用 IPC，Web 用 HTTP/WS

## 常用开发命令

```bash
# 安装所有依赖
pnpm install

# 桌面应用开发（Electron + Agent + HMR）
pnpm dev:desktop

# Web 端开发（需要先启动 Gateway）
pnpm dev:web

# Gateway + Web 一键启动
pnpm dev:web:full

# 全栈本地开发（三个终端）
pnpm gateway:dev        # 终端1：Gateway
pnpm dev:desktop        # 终端2：桌面应用
pnpm dev:web            # 终端3（可选）：浏览器访问 localhost:5173

# 类型检查所有包
pnpm lint

# 生产构建
pnpm build:desktop      # 桌面安装包（NSIS/DMG/AppImage）
pnpm build:web          # Web 静态资源
pnpm build:release      # 桌面 + Web 一键构建

# 测试
pnpm gateway:test           # Gateway E2E 测试
pnpm gateway:test:acceptance # Gateway 验收测试
```

## 常见开发工作流

### 添加新的共享类型或协议

1. 在 `packages/shared/src/` 中定义 Zod schema 和 TypeScript 类型
2. 从 `packages/shared/src/index.ts` 导出
3. 运行 `pnpm --filter @catbuddy/shared build` 编译
4. 其他包通过 `import { xxx } from "@catbuddy/shared"` 使用

### 添加新的 Agent 工具

1. 在 `apps/desktop/src/main/agent/tools/` 中创建工具文件（如 `my-tool.ts`）
2. 导出 `createMyTool()` 工厂函数，返回 `ToolDefinition`
3. 在 `apps/desktop/src/main/agent/tools/registry.ts` 中注册
4. 工具会自动被发现并注入到 LLM 上下文

### 添加新的消息通道

1. 在 `apps/desktop/src/main/channels/` 中创建通道目录
2. 实现通道接口（入站/出站消息处理）
3. 在通道管理器中注册

### 添加新的 UI 组件

1. 在 `packages/ui/src/components/` 中创建组件
2. 从 barrel 文件导出
3. `apps/desktop` 和 `apps/web` 都能通过 `@catbuddy/ui` 直接引用

## 关键文件索引

| 文件 | 作用 |
|------|------|
| `pnpm-workspace.yaml` | 工作空间配置 |
| `tsconfig.base.json` | 根 TS 配置（所有包继承） |
| `package.json` | 根脚本和 devDependencies |
| `scripts/desktop-build.mjs` | 桌面端构建脚本 |
| `apps/desktop/vite.config.ts` | 桌面端 Vite + Electron 插件配置 |

## 工具脚本

所有脚本位于 [scripts/](scripts/) 目录。

### `clean-package-emit.mjs` — 清理 TS 编译产物

```bash
pnpm clean:packages
# 或直接运行
node scripts/clean-package-emit.mjs
```

删除 `packages/` 和 `apps/` 中意外产生的 `.js`、`.d.ts`、`.js.map` 文件。白名单保留手写的 `.d.ts` 声明文件（如 `brand.d.ts`、`preload-api.d.ts`）。适用于 `tsc --noEmit` 之外的构建工具意外产生的编译产物清理。

### `fix-monorepo-imports.mjs` — 修复导入路径

```bash
node scripts/fix-monorepo-imports.mjs
```

批量将旧的路径别名（`@/lib/types`、`../../shared/types` 等）替换为 monorepo 包名（`@catbuddy/shared`、`@catbuddy/client`、`@catbuddy/platform`）。在重构导入路径时非常实用。

### `load-repo-env.mjs` + `repo-root.mjs` — 环境变量加载

```js
// 在脚本中使用
import { repoRoot } from './scripts/repo-root.mjs'
import { loadRepoEnvFiles } from './scripts/load-repo-env.mjs'

loadRepoEnvFiles()                    // 加载 .env
loadRepoEnvFiles({ production: true }) // 加载 .env + .env.production
```

- `repo-root.mjs`：导出 monorepo 根路径，所有脚本引用根目录的统一入口
- `load-repo-env.mjs`：自动加载 `.env` 文件（生产模式额外加载 `.env.production`）

### `vite-ignore-package-emit.mjs` — Vite 文件监听过滤

```js
// 在 vite.config.ts 中使用
import { ignorePackageEmit } from '../../scripts/vite-ignore-package-emit.mjs'

export default defineConfig({
  server: {
    watch: { ignored: ignorePackageEmit }
  }
})
```

防止 Vite 开发服务器因 `packages/` 中的 TS 编译产物而触发不必要的热重载。

## 注意事项

- 使用 `workspace:*` 协议引用内部包（pnpm 在发布时自动替换为实际版本）
- 不要在 `packages/ui/` 中引用 `electron` 或 Node.js 专用 API
- 修改 `@catbuddy/shared` 后需要重新构建，否则其他包的 `tsc --noEmit` 可能报错
- `dist-electron/` 被 gitignore，`git clean` 后需要重新构建
