# catbuddy (pnpm monorepo)

Web + 桌面共用 UI 与客户端协议，分应用打包。详见 [docs/MONOREPO_MIGRATION.md](./docs/MONOREPO_MIGRATION.md)。

旧 nanobot `**webui/**` 前端已废弃，见 [docs/WEBUI_DEPRECATED.md](./docs/WEBUI_DEPRECATED.md)。

## 结构

```text

catbuddy/

├── apps/

│   ├── desktop/     # @catbuddy/desktop — Electron + 本地 Agent

│   └── web/         # @catbuddy/web — 浏览器 SPA

├── packages/

│   ├── shared/      # 协议与类型

│   ├── client/      # catbuddyClient + transport（IPC / WS / gateway）

│   ├── platform/    # bootstrap / REST·IPC API

│   └── ui/          # React 应用主体

├── gateway/         # Web↔桌面 Gateway（packages: common, gateway, sdk-web, sdk-desktop）

└── scripts/         # 品牌资源等工具脚本

```

## 开发

在 `catbuddy/` 目录安装依赖并配置环境：

```bash
pnpm install
cp .env.example .env          # 本地开发（Gateway + Desktop + Web）
# cp .env.production.example .env.production   # 生产 / Docker / 打包
```

| 命令 | 说明 |

|------|------|

| `pnpm dev` / `pnpm dev:desktop` | 桌面 Electron（`apps/desktop`） |

| `pnpm dev:web` | Web SPA（需已运行 `pnpm gateway:dev`） |
| `pnpm dev:web:full` | **一键**：gateway + Web 同启 |

| `pnpm gateway:dev` | 启动 `gateway`（`:18765`，Fastify） |

| `pnpm build:desktop` | 桌面 NSIS 安装包 |
| `pnpm build:desktop:verbose` | 同上，分阶段 + electron-builder 详细日志 |
| `pnpm build:web` | 拷贝桌面安装包 + Web 静态资源（需先 `build:desktop`） |
| `pnpm build:web:only` | 仅 Vite 构建 Web（不拷贝安装包） |
| `pnpm build:release` | 桌面安装包 + Web 一键发布构建 |
| `pnpm build:all` | Gateway + Desktop + Web |

| `pnpm lint` | 全 workspace TypeScript 检查 |
| `pnpm clean:packages` | 删除 `packages/*/src`、`apps/*/src` 下误生成的 `.js` / `.map` / `.d.ts` |

### Web 开发（catbuddy Gateway，推荐）

无需本地 `nanobot gateway`。Web UI 通过 **catbuddy/gateway** 连桌面 Electron 执行 Agent。详见 [docs/GATEWAY.md](./docs/GATEWAY.md)、[docs/CROSS_DEVICE_GATEWAY.md](./docs/CROSS_DEVICE_GATEWAY.md)、[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)。

#### `CATBUDDY_DEV_MODE=remote`（连线上 Gateway，最简单）

根目录 `.env` 设 `CATBUDDY_DEV_MODE=remote`，**无需** `pnpm gateway:dev`：

```bash
pnpm dev:desktop    # 桌面 + 内置 UI（http://localhost:5173）
# 可选：pnpm dev:web   # 单独浏览器开 Web
```

启动日志应含：`[catbuddy/desktop] dev_mode=remote gateway → https://gateway.ganzhibin.icu`

桌面 **设置 → 远程控制** 打开；须与 Web **同一邮箱** 登录。

若出现 `ENOTFOUND gateway.ganzhibin.icu`：本机 DNS/网络问题（非配置错误）。可试 `ipconfig /flushdns`、关 VPN，或改回 `local` 模式。

#### `CATBUDDY_DEV_MODE=local`（本机 Gateway，三终端）

```bash
# 1) Gateway
pnpm gateway:dev

# 2) 桌面
pnpm dev:desktop

# 3) Web（可选）
pnpm dev:web
```

浏览器打开 `http://127.0.0.1:5173/`。邮箱登录后由 `AuthGate` + `GatewayTransport` 连 Gateway，消息由桌面 Agent 处理。

### Web 开发（nanobot gateway，可选）

在 `apps/web/.env.development` 中设置 `VITE_USE_GATEWAY=false`，并启动 nanobot：

```bash

nanobot gateway   # 默认 http://127.0.0.1:8765，且 channels.websocket.enabled=true

pnpm dev:web

```

### 环境变量

根目录 **一个开关** 控制三端（Gateway / Desktop / Web）：


| `CATBUDDY_DEV_MODE` | 说明                                                     |
| ------------------- | ------------------------------------------------------ |
| `local`             | 本机 `pnpm gateway:dev`，Desktop/Web 走 `127.0.0.1:18765`  |
| `remote`            | Desktop/Web 连 `gateway.ganzhibin.icu`，**无需**本地 Gateway |


```bash
cp .env.example .env
# 改 CATBUDDY_DEV_MODE、GATEWAY_ACCOUNT_EMAIL、DEEPSEEK_KEY 即可
```


| 用途      | 模板                        | 复制为               |
| ------- | ------------------------- | ----------------- |
| 开发      | `.env.example`            | `.env`            |
| 生产 / 打包 | `.env.production.example` | `.env.production` |


### 环境变量（`apps/web`）


| 变量                      | 说明                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `VITE_USE_GATEWAY`      | 根目录 `.env`；`true`（dev 默认）→ catbuddy gateway                                        |
| `VITE_GATEWAY_URL`      | nanobot HTTP（`VITE_USE_GATEWAY=false` 时，默认 `http://127.0.0.1:8765`）                |
| `VITE_GATEWAY_HTTP_URL` | catbuddy gateway HTTP（dev 默认 `http://127.0.0.1:18765`；生产建议 `/gateway-api` 或公网 URL） |


详见 [docs/GATEWAY.md](./docs/GATEWAY.md)。

### 首次上手（约 30 分钟）

1. `pnpm install` 后 `cp .env.example .env`（若 `sharp` 安装失败，可 `pnpm install --ignore-scripts`，桌面开发通常仍可运行）
2. **remote 模式（推荐先试）**：`.env` 设 `CATBUDDY_DEV_MODE=remote` + `GATEWAY_ACCOUNT_EMAIL` + `DEEPSEEK_KEY` → `pnpm dev:desktop`
3. **local 模式**：`.env` 设 `CATBUDDY_DEV_MODE=local` → `pnpm gateway:dev` + `pnpm dev:desktop` +（可选）`pnpm dev:web`

## `packages/` 与 `apps/*/src/` 不要出现编译产物

`packages/`* 与 `apps/web` 等只放 **TypeScript 源码**，由 Vite 直接引用（`noEmit: true`）。若在 `src/` 里看到成对的 `Foo.ts` + `Foo.js` + `Foo.js.map`，是误跑了 `tsc`（或 IDE「编译项目」）生成的，可执行： 

```bash
pnpm clean:packages
```

**不要**在 `packages` 目录单独执行不带 `--noEmit` 的 `tsc`；构建请用 `apps/desktop` / `apps/web` 的 `pnpm build`。

## 包依赖方向

`ui` → `client`, `platform`, `shared` · `client` → `shared` · `platform` → `shared` · `apps/`* → 上述包