# learnbuddy (pnpm monorepo)



Web + 桌面共用 UI 与客户端协议，分应用打包。详见 [docs/MONOREPO_MIGRATION.md](./docs/MONOREPO_MIGRATION.md)。



旧 nanobot **`webui/`** 前端已废弃，见 [docs/WEBUI_DEPRECATED.md](./docs/WEBUI_DEPRECATED.md)。



## 结构



```text

learnbuddy/

├── apps/

│   ├── desktop/     # @learnbuddy/desktop — Electron + 本地 Agent

│   └── web/         # @learnbuddy/web — 浏览器 SPA

├── packages/

│   ├── shared/      # 协议与类型

│   ├── client/      # learnbuddyClient + transport（IPC / WS / gateway）

│   ├── platform/    # bootstrap / REST·IPC API

│   └── ui/          # React 应用主体

├── gateway/         # Web↔桌面 Gateway（packages: common, gateway, sdk-web, sdk-desktop）

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

| `pnpm dev:web` | Web SPA（需已运行 `pnpm gateway:dev`） |
| `pnpm dev:web:full` | **一键**：gateway + Web 同启 |

| `pnpm gateway:dev` | 启动 `gateway`（`:18765`，Fastify） |

| `pnpm build:desktop` | 桌面安装包 |

| `pnpm build:web` | Web 静态资源 |

| `pnpm lint` | 全 workspace TypeScript 检查 |
| `pnpm clean:packages` | 删除 `packages/*/src` 下误生成的 `.js` / `.map` / `.d.ts` |



### Web 开发（learnbuddy Gateway，推荐）



无需本地 `nanobot gateway`。Web UI 通过 **learnbuddy/gateway** 连桌面 Electron 执行 Agent。详见 [docs/GATEWAY.md](./docs/GATEWAY.md)、[docs/CROSS_DEVICE_GATEWAY.md](./docs/CROSS_DEVICE_GATEWAY.md)。



**三个终端：**



```bash

# 1) 中转 + Gateway 垫片（/webui/bootstrap、/api/*）

pnpm gateway:dev



# 2) 桌面（需开启 gateway）

# apps/desktop/.env 或环境变量：

#   GATEWAY_ENABLED=true

#   RELAY_URL=ws://127.0.0.1:18765/ws

#   GATEWAY_SECRET=dev-secret

pnpm dev:desktop



# 3) Web 前端（apps/web/.env.development 已默认 VITE_USE_GATEWAY=true）

pnpm dev:web

```



浏览器打开 `http://127.0.0.1:5173/`。邮箱登录后由 `AuthGate` + `GatewayTransport` 连 Gateway，消息由桌面 Agent 处理。

- 桌面 **设置 → 远程控制**：须与 Web **同一邮箱** 登录；开启远程控制后自动注册 Gateway



### Web 开发（nanobot gateway，可选）



在 `apps/web/.env.development` 中设置 `VITE_USE_GATEWAY=false`，并启动 nanobot：



```bash

nanobot gateway   # 默认 http://127.0.0.1:8765，且 channels.websocket.enabled=true

pnpm dev:web

```



### 环境变量（`apps/web`）



| 变量 | 说明 |

|------|------|

| `VITE_USE_GATEWAY` | `true`（默认 dev）→ learnbuddy gateway |

| `VITE_USE_GATEWAY` | 同义兼容 |

| `VITE_GATEWAY_URL` | nanobot HTTP（`false` 时，默认 `http://127.0.0.1:8765`） |

| `VITE_GATEWAY_HTTP_URL` | learnbuddy gateway（默认 `http://127.0.0.1:18765`） |

详见 [docs/GATEWAY.md](./docs/GATEWAY.md)。



### 首次上手（约 30 分钟）



1. `pnpm install`（若 `sharp` 安装失败，可 `pnpm install --ignore-scripts`，桌面开发通常仍可运行）

2. 桌面：`pnpm dev:desktop` → 发消息、看流式回复与工具卡

3. Web：`pnpm gateway:dev` + 桌面 `GATEWAY_ENABLED=true` + `pnpm dev:web`



## `packages/` 不要出现编译产物

`packages/*` 只放 **TypeScript 源码**，由 Vite 直接引用（`noEmit: true`）。若在 `src/` 里看到成对的 `Foo.ts` + `Foo.js` + `Foo.js.map`，是误跑了 `tsc`（或 IDE「编译项目」）生成的，可执行：

```bash
pnpm clean:packages
```

**不要**在 `packages` 目录单独执行不带 `--noEmit` 的 `tsc`；构建请用 `apps/desktop` / `apps/web` 的 `pnpm build`。

## 包依赖方向

`ui` → `client`, `platform`, `shared` · `client` → `shared` · `platform` → `shared` · `apps/*` → 上述包

