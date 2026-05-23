# 开发与构建

## 环境要求

- Node.js 18+
- pnpm（monorepo 根目录安装依赖）
- Windows / macOS / Linux（当前脚本含 Windows `taskkill` 示例）

## 常用命令

在 `learnbuddy/apps/desktop` 下执行：

| 命令 | 说明 |
|------|------|
| `pnpm run dev` | Vite 开发：热更新 Renderer + 编译 Main |
| `pnpm run lint` | `tsc --noEmit` 类型检查 |
| `pnpm run build` | 类型检查 + Vite 构建 + electron-builder 安装包 |
| `pnpm run build:unpack` | 构建但不打安装包（`release/win-unpacked` 等） |
| `pnpm run rebuild:unpack` | 结束运行中的 exe 后重新 `build:unpack` |
| `pnpm run gateway:dev` | 启动本地 Gateway（`@learnbuddy/gateway`） |
| `pnpm run gateway:test` | Gateway 集成测试脚本 |
| `pnpm run brand:generate` | 从 `public/brand/source/` 生成品牌资源 |
| `pnpm run brand:cutout` | 图标抠图辅助脚本 |

Monorepo 根目录可先执行 `pnpm install`。

## 开发时行为

- **Renderer**：根目录为 `src/renderer/`，静态资源目录为 `public/`（brand 图片等）。
- **Main**：`vite-plugin-electron` 监听 `src/main/index.ts`，输出到 `dist-electron/`。
- **Preload**：`src/preload/` 在构建开始/结束时复制到 `dist-electron/preload/`（不经 Rollup 打包，保持 CommonJS）。
- **Dev Server**：`VITE_DEV_SERVER_URL` 存在时，主窗口加载该 URL；否则加载 `dist/index.html`。

开发服务器代理（`vite.config.ts`）：

| 路径 | 目标 |
|------|------|
| `/gateway-api` | `http://127.0.0.1:18765` |
| `/gateway-ws` | WebSocket → 同上 |

## 构建产物

| 目录 | 内容 |
|------|------|
| `dist/` | Renderer 静态资源 + `index.html` |
| `dist-electron/index.js` | 主进程 bundle |
| `dist-electron/preload/` | 预加载脚本 |
| `dist-electron/assets/` | 图标等 |
| `release/` | electron-builder 输出（安装包或 unpacked） |

## 配置与密钥

- 复制 `learnbuddy/.env.example` 或 `apps/desktop/.env.example`（若存在）为 `.env`。
- **不要**将 `.env`、API Key 提交到 Git。
- 用户级覆盖：`~/.learnbuddy.env`。

Gateway 远程控制相关变量见 `@learnbuddy/gateway-sdk-desktop` 与 `services/gateway-remote.ts`（如 URL、账号邮箱等）。

## 添加 IPC 时的检查清单

1. 在 `src/preload/api/ipc-channels.cjs` 增加通道名（与 main 一致）。
2. 在 `src/preload/api/index.cjs` 暴露方法。
3. 在 `src/main/ipcHandlers/` 或 `services/gateway-remote.ts` 注册 `ipcMain.handle`。
4. 如需类型：更新 `packages/platform/src/preload-api.d.ts`。
5. 文档：更新 [ipc.md](./ipc.md)。

## 添加主进程模块

- 业务逻辑放在 `src/main/<module>/`，从 `services/init-agent.ts` 或 `ipcHandlers/` 接入。
- 避免在 `index.ts` 堆叠过多逻辑；窗口相关放 `windows/`，Gateway 放 `services/gateway-remote.ts`。

## 品牌资源

- 源图：`public/brand/source/icon.png`（建议 ≥512×512）。
- 生成：`pnpm run brand:generate` → `public/brand/*` 与 `src/main/assets/icon.png`。
- 路径常量：`packages/shared/src/brand.mjs` 中的 `electronIcon`。
