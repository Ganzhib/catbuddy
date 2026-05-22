# learnbuddy Monorepo 迁移计划

从当前 **单包 Electron 桌面应用** 迁移到 **Web + 桌面共用 UI/客户端、分应用打包** 的 pnpm monorepo。

**文档版本**: 2026-05-22  
**当前基线**: pnpm monorepo 已落地（`apps/desktop`、`apps/web`、`packages/{shared,client,platform,ui}`）；`pnpm lint` 通过。根目录 `src/`、`electron/` 仍保留作过渡，请以 `apps/*` 与 `packages/*` 为准。  
**目标基线**: `apps/desktop` + `apps/web` + `packages/*`，桌面与 Web 可独立 dev/build，共享同一套 UI 与协议。

---

## 1. 目标架构

```text
learnbuddy/
├── pnpm-workspace.yaml
├── package.json                 # 根 scripts、共享 devDependencies（可选）
├── packages/
│   ├── shared/                  # @learnbuddy/shared — 协议与纯类型
│   ├── client/                  # @learnbuddy/client — learnbuddyClient + transport
│   ├── platform/                # @learnbuddy/platform — bootstrap + REST/IPC API
│   └── ui/                      # @learnbuddy/ui — React 应用主体
└── apps/
    ├── desktop/                 # @learnbuddy/desktop — Electron 主进程 + 本地 Agent
    └── web/                     # @learnbuddy/web — 纯 SPA，连 gateway
```

**依赖规则**

- `ui` → `client`, `platform`, `shared`
- `client` → `shared`
- `platform` → `shared`（运行时选 ipc 或 http 实现）
- `apps/desktop` → `ui`, `client`, `platform`, `shared` + 本地 `electron/agent`
- `apps/web` → `ui`, `client`, `platform`, `shared`（无 electron、无 agent）

**后端边界**

| 运行方式 | Agent 位置 | 传输 |
|----------|------------|------|
| 桌面 | `apps/desktop/electron/agent` | IPC → preload |
| Web | 远端 `nanobot gateway`（或自建服务） | WebSocket + HTTP |

---

## 2. 现状盘点

### 2.1 已完成（有利于迁移）

- [x] `InboundEvent` / `Outbound` 作为 UI 契约（`src/lib/types.ts` + `shared/types.ts`）
- [x] `AgentTransport`：`IpcTransport` / `WsTransport` / `createAgentTransport('auto')`
- [x] `learnbuddyClient` 与传输层解耦，UI 通过 `onChat` 消费事件
- [x] 工具进度、文件编辑、流式 delta 的 IPC 管道已打通

### 2.2 仍绑死 Electron（迁移中要拆）

| 模块 | 文件 | 问题 |
|------|------|------|
| 启动 | `src/lib/bootstrap.ts` | 强制 `waitForIpc()` |
| 会话/设置 API | `src/lib/api.ts` | 全部 `window.learnbuddy.*` |
| 设置页 | `SettingsView.tsx` 等 | 直接调 IPC |
| 应用入口 | `App.tsx` | `restartApp()` 等桌面专属 |
| 构建 | `vite.config.ts` | 仅 electron 插件 |
| 类型入口 | `vite-env.d.ts` | `window.learnbuddy` |

### 2.3 仓库内相关项目（收敛策略）

| 路径 | 角色 | 迁移后 |
|------|------|--------|
| `learnbuddy/` | 主产品（本计划主体） | monorepo 根 |
| `../webui/` | 旧 Web 前端 | **废弃**，由 `apps/web` + `packages/ui` 替代 |
| `../desktop/` | 旧 nanobot Electron 打包 | 不并入；仅参考 gateway 集成 |
| `../nanobot/` (Python) | gateway / agent 服务端 | Web 端外部依赖，不纳入 TS monorepo |

### 2.4 可删除的技术债（迁移各阶段顺带）

- `src/lib/ipc-client.ts` — 零引用
- `electron/agent/subagent.ts` — 空文件
- `tool-traces.ts` 中未使用的 `toolTraceLinesFromEvents`、`dedupeToolCallsForUi`
- `App.tsx` 未使用的 `loadSavedSecret` / `saveSecret` import

---

## 3. 阶段总览

| 阶段 | 名称 | 产出 | 桌面可用 | Web 可用 |
|------|------|------|----------|----------|
| **M0** | 准备与冻结 | 分支策略、本计划、基线 CI | ✓ | — |
| **M1** | Workspace 骨架 | pnpm workspace，包目录空壳 + 路径别名 | ✓ | — |
| **M2** | 抽 shared + client | 协议与传输迁入 packages | ✓ | — |
| **M3** | 抽 platform | bootstrap/api 双实现（IPC + HTTP） | ✓ | 部分 |
| **M4** | 抽 ui + apps/desktop | 渲染进程迁入 packages/ui，electron 迁入 apps/desktop | ✓ | — |
| **M5** | apps/web | 纯 Vite Web 应用 + gateway 联调 | ✓ | ✓ |
| **M6** | 收敛与发布 | 弃用 webui、文档、双端 CI/release | ✓ | ✓ |

**预计周期**（1 人兼职）：M0–M2 约 1 周；M3–M4 约 2–3 周；M5–M6 约 2–3 周。可并行项在各阶段内标注。

---

## 4. 分阶段详细任务

### M0 — 准备与冻结（0.5–1 天）

**目标**: 可回滚、可验证的迁移起点。

- [ ] 创建长期分支 `feat/monorepo`（或按里程碑拆 PR）
- [ ] 记录当前 `pnpm dev` / `pnpm build` 通过截图或命令输出（基线）
- [ ] 在 README 注明：迁移期间以 `docs/MONOREPO_MIGRATION.md` 为准
- [ ] 约定 PR 规则：每阶段一个 PR，合并前 `pnpm lint` + 手动冒烟「发消息 → 工具卡 → 流式回复」

**完成标准**: 基线可复现；团队对目标目录结构达成共识。

---

### M1 — Workspace 骨架（1–2 天）

**目标**: 目录存在，**行为不变**（仍从原路径跑通，或仅改根脚本）。

**任务**

- [ ] 新增 `pnpm-workspace.yaml`:

  ```yaml
  packages:
    - 'packages/*'
    - 'apps/*'
  ```

- [ ] 根 `package.json`：`private: true`，scripts 转发到 `@learnbuddy/desktop`
- [ ] 创建空包占位（每包 `package.json` + `tsconfig.json` + `src/index.ts` 导出占位）
- [ ] 保留现有 `src/`、`electron/` 直至 M4（**先不搬文件**，避免大爆炸）

**完成标准**: 根目录 `pnpm install` 成功；`pnpm --filter @learnbuddy/desktop dev` 仍等价于当前 `pnpm dev`（通过 workspace 脚本指向现有 vite 入口）。

**风险**: electron-builder 路径变化 — 在 M4 再动 `files` 配置。

---

### M2 — 抽取 `packages/shared` + `packages/client`（2–4 天）

**目标**: 传输与客户端逻辑独立成包，桌面 app 通过 workspace 依赖引用。

**`packages/shared`**

- [ ] 迁入 `shared/types.ts`（及 `brand.d.ts` 若需要）
- [ ] `package.json`: `"name": "@learnbuddy/shared"`, `"exports": { ".": "./src/index.ts" }`
- [ ] 全仓 `from '../../shared/types'` → `from '@learnbuddy/shared'`

**`packages/client`**

- [ ] 迁入：
  - `src/lib/learnbuddy-client.ts`
  - `src/lib/transport/**`
  - `src/lib/tool-traces.ts`（客户端映射依赖）
- [ ] 依赖 `@learnbuddy/shared`
- [ ] 导出：`learnbuddyClient`, `createLearnbuddyClient`, `createAgentTransport`, transport 类型

**桌面适配**

- [ ] `learnbuddy` 根或暂存 `src/lib` 改为 re-export（薄 shim，便于过渡）：

  ```ts
  export * from '@learnbuddy/client'
  ```

- [ ] `tsconfig` paths: `@learnbuddy/client` → `packages/client/src`

**测试**

- [ ] `packages/client` 可加 Vitest：mock transport，断言 `_dispatch` / handshake
- [ ] 桌面端到端冒烟不变

**完成标准**: 无 `learnbuddy-client` 实现留在 `src/lib`（仅 re-export）；lint 通过；桌面对话正常。

---

### M3 — 抽取 `packages/platform`（3–5 天）

**目标**: 启动与会话/配置 API 与运行时解耦；Web 在浏览器里能完成 bootstrap（不报错）。

**接口设计**

```ts
// packages/platform/src/index.ts
export interface PlatformApi {
  fetchBootstrap(baseUrl?: string, secret?: string): Promise<BootstrapResponse>
  listSessions(token: string, base?: string): Promise<ChatSummary[]>
  getSession(token: string, key: string, base?: string): Promise<...>
  // ... 与现有 api.ts 对齐
}

export function createPlatformApi(): PlatformApi
```

**实现**

- [ ] `ipc-platform.ts` — 现有 `bootstrap.ts` + `api.ts` 逻辑
- [ ] `http-platform.ts` — 对齐 `../webui` / gateway 的 REST 路径（对照 nanobot 文档）
- [ ] `create-platform.ts` — `hasLearnbuddyIpc() ? ipc : http`

**Web 相关**

- [ ] `deriveWsUrl(wsPath, token)` 在 http 模式下返回真实 `wss://...`
- [ ] `fetchBootstrap` http：`GET /webui/bootstrap`（或项目约定路径）

**消费者改动**

- [ ] `App.tsx`：`fetchBootstrap` → `createPlatformApi().fetchBootstrap`
- [ ] `useSessions.ts`、`SettingsView.tsx`、`ThreadShell.tsx`：改用 `platform` 而非直接 `window.learnbuddy`
- [ ] 桌面专属：`restartApp()` 保留在 `apps/desktop` 薄封装，不放进 `platform`

**完成标准**

- 桌面：会话列表、设置、发消息与 M2 一致
- Web（可用 `vite dev` 临时入口引 platform）：至少 bootstrap 不抛「IPC bridge not available」；能 `createLearnbuddyClient` + 连 WS（gateway 未就绪时可显示连接错误 UI）

---

### M4 — 抽取 `packages/ui` + `apps/desktop`（5–8 天）

**目标**: React 与 Electron 分离；桌面成为「壳 + Agent」。

**`packages/ui`**

- [ ] 迁入：`src/components/**`, `src/hooks/**`, `src/providers/**`, `src/i18n/**`, `src/workers/**`, `src/lib`（除已迁走的 client/platform/media/utils/format 等）
- [ ] 入口：`packages/ui/src/App.tsx`（或 `AppShell` + 平台注入 props）
- [ ] 依赖：`@learnbuddy/client`, `@learnbuddy/platform`, `@learnbuddy/shared`
- [ ] 平台能力通过 props 或 context 注入（如 `onRestartApp?: () => void` 仅 desktop 传入）

**`apps/desktop`**

- [ ] 迁入：`electron/**`, `templates/`, `skills/`, `electron/assets/`
- [ ] `vite.config.ts` — electron 插件，alias 指向 `@learnbuddy/ui`
- [ ] `main.tsx` 在 `apps/desktop/src/main.tsx`：渲染 `@learnbuddy/ui`
- [ ] `preload.cjs` 路径、`electron-builder.files` 更新为 monorepo 相对路径
- [ ] `package.json` name: `@learnbuddy/desktop`

**构建**

- [ ] `shared` 类型仍被 electron 主进程引用 → `apps/desktop` 依赖 `@learnbuddy/shared`
- [ ] Agent 相关依赖（openai、anthropic）只在 `apps/desktop`

**完成标准**

- `pnpm dev:desktop` 全功能与迁移前一致
- 根目录旧 `src/`、`electron/` 可删除或仅留 README 指向新路径
- `pnpm build:desktop` 产出安装包

---

### M5 — 新建 `apps/web`（5–10 天）

**目标**: 浏览器可访问的 learnbuddy，连 gateway。

**`apps/web`**

- [ ] `vite.config.ts`：仅 `@vitejs/plugin-react`，**无** electron 插件
- [ ] `index.html` + `src/main.tsx` 挂载 `@learnbuddy/ui`
- [ ] devServer.proxy：
  - `/api` → `http://127.0.0.1:8765`（或配置项）
  - `/webui` → gateway
  - WebSocket → `ws://127.0.0.1:8765/...`
- [ ] 环境变量：`VITE_GATEWAY_URL` 等
- [ ] `createLearnbuddyClient({ transportMode: 'web' })` 或 `auto`

**协议对齐**

- [ ] 对照 gateway 实际帧格式，调整 `WsTransport` 或增加 `gateway-adapter.ts`
- [x] 事件清单验收表（见 §6）：自动化 `pnpm gateway:test:acceptance` 已通过（[GATEWAY_ACCEPTANCE.md](./GATEWAY_ACCEPTANCE.md)）；真机桌面 E2E 待手动勾选

**UI 差异处理**

- [ ] 隐藏/禁用：重启应用、本地 workspace 选择（或改为远端概念）
- [ ] 文件编辑：仅展示 gateway 下发的 `file_edit`（若有）

**完成标准**

- `pnpm dev:web` + 本地 `nanobot gateway`：可登录/bootstrap、发消息、收流式回复、工具事件展示
- `pnpm build:web` 产出静态资源可部署

---

### M6 — 收敛、文档与 CI（3–5 天）

**目标**: monorepo 成为唯一前端主线。

- [x] 根 README：双端 dev/build 说明
- [x] 标记 `../webui/` deprecated，链到新文档（[WEBUI_DEPRECATED.md](./WEBUI_DEPRECATED.md)）
- [ ] CI（可选）：`pnpm -r lint`；`build:web`；`build:desktop` 矩阵（仓库根为 `nanobot` 时需在根 `.github` 配置 `working-directory: learnbuddy`）
- [x] 清理 dead code（§2.4）：移除 `ipc-client`、空 `subagent.ts`、未使用 trace 辅助函数
- [x] 更新 `PROJECT_PLAN.md` 或归档
- [x] 版本号策略：`@learnbuddy/*` 内部 `0.0.0` workspace 协议即可
- [x] 删除根目录遗留 `src/`、`electron/`、`shared/` 等单包副本

**完成标准**: 新成员按 README 可在 30 分钟内跑起 desktop 或 web 其一；webui 目录不再更新。

---

## 5. 文件迁移对照表

| 当前路径 | 目标路径 |
|----------|----------|
| `shared/types.ts` | `packages/shared/src/types.ts` |
| `src/lib/learnbuddy-client.ts` | `packages/client/src/learnbuddy-client.ts` |
| `src/lib/transport/**` | `packages/client/src/transport/**` |
| `src/lib/tool-traces.ts` | `packages/client/src/tool-traces.ts` 或 `packages/ui` 若仅 UI 用 |
| `src/lib/bootstrap.ts` | `packages/platform/src/ipc-bootstrap.ts` + `http-bootstrap.ts` |
| `src/lib/api.ts` | `packages/platform/src/ipc-api.ts` + `http-api.ts` |
| `src/**`（其余） | `packages/ui/src/**` |
| `electron/**` | `apps/desktop/electron/**` |
| `vite.config.ts`（electron） | `apps/desktop/vite.config.ts` |
| — | `apps/web/vite.config.ts`（新建） |
| `templates/`, `skills/` | `apps/desktop/templates`, `apps/desktop/skills` |

---

## 6. Web 协议验收清单（M5 门禁）

Gateway / `WsTransport` 需支持或与 IPC 映射等价的 `InboundEvent`：

| 事件 | 桌面 IPC | Web 必需 |
|------|----------|----------|
| `ready` / `attached` | client 本地发 | 客户端发或服务端发（统一一种） |
| `delta` | stream-delta | ✓ |
| `stream_end` | stream-end | ✓ |
| `reasoning_delta` / `reasoning_end` | ✓ | 可选 |
| `message` + `kind: tool_hint` | tool-progress | ✓ |
| `file_edit` | file-edit | 视产品 |
| `message` progress / 完整回复 | system / assistant | ✓ |
| `turn_end` | turn-complete | ✓ |
| `goal_status` / `goal_state` | 部分 stub | 视 gateway |
| `session_updated` | system 副作用 | ✓（/new） |

出站 `Outbound`：`attach`, `message`（含 `webui: true`）最低限度。

---

## 7. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| 大爆炸搬目录 | 长时间无法 dev | 分 M2→M4 小步；每步 re-export shim |
| electron-builder 路径错误 | 打包失败 | M4 专门验证；CI build:unpack |
| gateway 协议与 `InboundEvent` 不一致 | Web 白屏/乱序 | M5 前做协议对照表；adapter 层 |
| `webui` 与 `ui` 双维护 | 功能分叉 | M6 冻结 webui |
| TypeScript 路径/循环依赖 | lint 失败 | 严格单向依赖（§1） |
| 双端 CSS/资源路径 | 静态资源 404 | `packages/ui` 统一 `public/` 或 vite `base` |

---

## 8. 回滚策略

- 每阶段合并前打 tag：`monorepo-m2`, `monorepo-m3`, …
- M4 前旧目录可保留为 `src.legacy/` 一周
- 单阶段回滚 = revert 该 PR，不影响已完成的 shared/client 包（若已发布内部版本）

---

## 9. 成功定义（Done）

满足以下全部条件视为 **monorepo 迁移成功**：

1. **结构**: `apps/desktop` + `apps/web` + `packages/{shared,client,platform,ui}` 存在且依赖方向正确  
2. **桌面**: `pnpm dev:desktop` / `pnpm build:desktop` 与迁移前功能等价（会话、设置、流式、工具卡、文件编辑）  
3. **Web**: `pnpm dev:web` 在 gateway 运行时完成完整对话闭环  
4. **共享**: UI 与 client 代码无复制；仅 `platform` 与 `apps/*` 有平台差异  
5. **文档**: README + 本计划 M6 勾选完成；`webui/` 标明废弃  
6. **质量**: `pnpm -r lint` 通过  

---

## 10. 跨端执行（Web 发消息 → 桌面本地文件）

已实现，见 **[CROSS_DEVICE_GATEWAY.md](./CROSS_DEVICE_GATEWAY.md)**（`gateway-legacy-removed` + 桌面 `GatewayChannel`）。与 monorepo 各阶段可并行。

---

## 11. 建议 PR 切分（可直接当 Issue 列表）

1. `chore: add pnpm workspace skeleton (M1)`  
2. `refactor: extract @learnbuddy/shared and @learnbuddy/client (M2)`  
3. `feat: @learnbuddy/platform with ipc + http (M3)`  
4. `refactor: extract @learnbuddy/ui and apps/desktop (M4)`  
5. `feat: apps/web with gateway proxy (M5)`  
6. `chore: deprecate webui, docs and cleanup (M6)`  

---

## 11. 与当前代码的衔接说明

你们已完成的 **transport 重构** 对应本计划的 **M2 大半**：

- 不必重做 `IpcTransport` / `WsTransport`
- M2 主要是 **物理搬迁 + workspace 依赖**
- M3 才是 Web 能跑起来的关键（`bootstrap` + `api`）

下一步若开始执行，建议从 **M1 → M2** 动手，单 PR 控制在可 review 规模（< 80 文件为宜，必要时 M2 拆 shared 与 client 两个 PR）。
