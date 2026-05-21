# learnbuddy (pnpm monorepo)

Web + 桌面共用 UI 与客户端协议，分应用打包。详见 [docs/MONOREPO_MIGRATION.md](./docs/MONOREPO_MIGRATION.md)。

## 结构

```text
learnbuddy/
├── apps/
│   ├── desktop/     # @learnbuddy/desktop — Electron + 本地 Agent
│   └── web/         # @learnbuddy/web — 浏览器 SPA（连 nanobot gateway）
├── packages/
│   ├── shared/      # 协议与类型
│   ├── client/      # learnbuddyClient + transport
│   ├── platform/    # bootstrap / REST·IPC API
│   └── ui/          # React UI
├── relay-server/    # 跨端 relay（独立服务）
└── scripts/         # 品牌资源等工具脚本
```

## 开发

在仓库根目录安装依赖：

```bash
pnpm install
```

| 命令 | 说明 |
|------|------|
| `pnpm dev` / `pnpm dev:desktop` | 桌面 Electron（`apps/desktop`） |
| `pnpm dev:web` | Web SPA（需本地 `nanobot gateway`，默认 `http://127.0.0.1:8765`） |
| `pnpm build:desktop` | 桌面安装包 |
| `pnpm build:web` | Web 静态资源 |
| `pnpm lint` | 全 workspace TypeScript 检查 |
| `pnpm relay:dev` | 跨端 relay 服务 |

Web 环境变量（`apps/web`）：`VITE_GATEWAY_URL` 指向 gateway HTTP 根地址。

## 迁移说明

- **canonical 源码**：`packages/*`、`apps/*`
- 根目录遗留的 `src/`、`electron/` 为过渡副本；新改动请只改 monorepo 路径
- `src/lib/{learnbuddy-client,bootstrap,api,types}.ts` 为指向 workspace 包的 shim
