# learnbuddy (pnpm monorepo)

Web + 桌面共用 UI 与客户端协议，分应用打包。详见 [docs/MONOREPO_MIGRATION.md](./docs/MONOREPO_MIGRATION.md)。

旧 nanobot **`webui/`** 前端已废弃，见 [docs/WEBUI_DEPRECATED.md](./docs/WEBUI_DEPRECATED.md)。

## 结构

```text
learnbuddy/
├── apps/
│   ├── desktop/     # @learnbuddy/desktop — Electron + 本地 Agent
│   └── web/         # @learnbuddy/web — 浏览器 SPA（连 gateway）
├── packages/
│   ├── shared/      # 协议与类型
│   ├── client/      # learnbuddyClient + transport
│   ├── platform/    # bootstrap / REST·IPC API
│   └── ui/          # React 应用主体
├── relay-server/    # 跨端 relay（独立服务）
└── scripts/         # 品牌资源等工具脚本
```

## 开发

在 `learnbuddy/` 目录安装依赖：

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

### Web 环境变量

在 `apps/web` 下可通过 `.env` 设置：

- `VITE_GATEWAY_URL` — gateway HTTP 根地址（默认 `http://127.0.0.1:8765`）

### 首次上手（约 30 分钟）

1. `pnpm install`（若 `sharp` 安装失败，可 `pnpm install --ignore-scripts`，桌面开发通常仍可运行）
2. 桌面：`pnpm dev:desktop` → 发消息、看流式回复与工具卡
3. Web：启动 `nanobot gateway` 后 `pnpm dev:web`

## 包依赖方向

`ui` → `client`, `platform`, `shared` · `client` → `shared` · `platform` → `shared` · `apps/*` → 上述包
