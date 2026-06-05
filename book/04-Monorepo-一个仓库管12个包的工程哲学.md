# 03｜Monorepo：一个仓库管 12 个包的工程哲学

> 这是 CatBuddy 技术专栏的第 3 篇。上篇聊了三层物理架构，这篇看代码层面怎么组织的——12 个包在一个 pnpm monorepo 里，严格单向依赖，三个入口（Desktop/Web/Gateway）共享核心代码。以及：为什么不是 12 个独立仓库？

---

上一篇我们看到了 CatBuddy 的三层——Desktop、Gateway、Web。现在把镜头拉近，看它们在代码层面怎么组织的。

打开仓库，你会看到典型的 **pnpm monorepo** 结构——12 个包放在同一个 Git 仓库里，`pnpm-workspace.yaml` 统一管理。但为什么是 12 个？为什么不一个大包？为什么要拆分？

---

## 拆分的动机：不是设计出来的，是长出来的

CatBuddy 第一版只有一个包——一个 Electron 应用，所有代码全在 `apps/desktop` 里。Agent Loop、UI 组件、IPC 通信、配置管理揉在一起。

运行起来没问题，但三个痛点很快就暴露了。

### 痛点一：想做 Web 版，发现 UI 代码拷不过去

Desktop 里有完整的 React 聊天界面——消息气泡、Markdown 渲染、流式输出动画。做 Web 版时，最自然的想法是"把 UI 代码拿过去用"。但 Desktop 的 UI 代码和 Electron 的 IPC 调用、文件对话框、系统托盘逻辑混在一起。你想复用 `ChatPanel` 组件，它 import 了 `window.catbuddy.readFile`——这 API 只在 Electron 环境里才有，浏览器里根本没有。

### 痛点二：类型定义散落各处

`MessageRecord` 的类型定义在 `desktop/src/types.ts` 里。Gateway 也需要这个类型——它要校验 Web 传过来的消息格式。怎么办？复制一份。然后某天 Desktop 那边给 `MessageRecord` 加了个字段，Gateway 的"复制品"没同步更新——线上炸了。

### 痛点三：构建配置各自为政

两个入口（Electron + Vite SPA）都需要构建，但 Vite 配置不同、Tailwind 配置不同、入口文件不同。每次想加一个共享的 Vite 插件，要在两个地方改。

三个痛点指向同一个根因：**代码的职责边界和复用边界不重合。** 一个包里同时有"只跟 Electron 相关的代码"和"任何前端框架都能复用的代码"——它们是不同职责，但被放在了同一个物理边界里。

---

## 12 个包：按职责切分，按依赖排序

拆分原则很简单：**能被多个入口复用的，抽出来；只属于某一个入口的，留在原地。**

经过几轮迭代，稳定在 12 个包。它们不是 12 个独立小项目，而是一条**严格单向的依赖链**：

```
                    包依赖拓扑图（箭头 = "依赖"）
                    ════════════════════════════

                        ┌──────────────┐
                        │   @catbuddy   │
                        │   /shared     │  ← 纯类型定义 + 工具函数
                        │   (0 个依赖)   │     不依赖任何其他包
                        └──────┬───────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼──────┐  ┌──────▼───────┐       │
    │  @catbuddy     │  │  gateway/    │       │
    │  /client       │  │  packages/   │       │
    │                │  │  common      │       │
    │  (依赖 shared)  │  │  (依赖 shared)│       │
    └────────┬───────┘  └──────────────┘       │
             │                                  │
    ┌────────▼───────┐                         │
    │  @catbuddy     │                         │
    │  /platform     │                         │
    │                │                         │
    │ (依赖 shared   │                         │
    │  + client)     │                         │
    └────────┬───────┘                         │
             │                                  │
    ┌────────▼───────┐                         │
    │  @catbuddy     │                         │
    │  /ui           │                         │
    │                │                         │
    │ (依赖 shared   │                         │
    │  + client      │                         │
    │  + platform)   │                         │
    └────────┬───────┘                         │
             │                                  │
    ┌────────┴──────────────────────────┐       │
    │                                   │       │
    ▼                                   ▼       ▼
┌───────────┐  ┌──────────┐  ┌─────────────┐
│  apps/    │  │  apps/   │  │  gateway/    │
│  desktop  │  │  web     │  │  packages/   │
│           │  │          │  │  gateway     │
│ Electron  │  │ Vite SPA │  │  + sdk-web   │
│ + Agent   │  │          │  │  + sdk-desktop│
└───────────┘  └──────────┘  └─────────────┘
   ▲               ▲               ▲
   └───────────────┴───────────────┘
   三个"入口"包——各自引入 ui + client + platform
   但启动方式、构建配置、传输层完全不同
```

关键发现：**箭头只往下指，从不往上。** 这就是"严格单向依赖"——`shared` 不知道 `ui` 的存在，`ui` 可以放心引用 `shared`，但绝不会出现 `shared` 引用 `ui`。

为什么单向依赖这么重要？想象一下如果 `shared` 引用了 `ui`——那么每次你修改一个 UI 组件的内部实现，`shared` 的类型推断可能变化，进而影响所有依赖 `shared` 的包。一个 UI 改动能引起全网重新构建，这就是循环依赖的恐怖之处。

---

## 每个包干什么

| 包名 | 一句话职责 | 谁用到它 |
|------|-----------|----------|
| **@catbuddy/shared** | 所有包共用的类型定义和纯函数。零副作用。 | 所有人 |
| **@catbuddy/client** | Agent 通信的客户端封装 + 传输层抽象。不管底层是 IPC 还是 WebSocket，上层调用一致。 | ui, platform, desktop, web |
| **@catbuddy/platform** | 业务逻辑层——REST API、Gateway 同步、Auth、Secrets 管理。 | ui, desktop, web |
| **@catbuddy/ui** | React 应用主体——聊天面板、消息列表、快捷操作、Markdown 渲染、i18n。 | desktop, web |
| **@catbuddy/desktop** | Electron 入口 + Agent Loop + Session Manager + MCP 集成。 | 只有自己 |
| **@catbuddy/web** | Vite + React SPA 入口。 | 只有自己 |
| **@catbuddy/gateway** | Fastify 服务器 + WebSocket + 鉴权 + MySQL。 | 只有自己 |
| **@catbuddy/gateway-sdk-web** | Web 端 Gateway WS 传输实现。 | web |
| **@catbuddy/gateway-sdk-desktop** | Desktop 端 Gateway WS 客户端。 | desktop |
| **@catbuddy/gateway-common** | Gateway 生态共享工具。 | gateway, sdk-web, sdk-desktop |

要点：**desktop、web、gateway 三个入口包是"叶子节点"**——它们依赖所有中间包，但没人依赖它们。而 **shared 是"根节点"**——所有人都依赖它，它不依赖任何人。

---

## 三个入口，三套启动方式

虽然 desktop 和 web 共享同一套 UI 组件（`@catbuddy/ui`），启动方式完全不同：

```
                    @catbuddy/ui
              (共享的 React 组件和 Hook)
            ┌────────────┴───────────┐
            ▼                        ▼
  ┌─────────────────────┐  ┌──────────────────────┐
  │  apps/desktop        │  │  apps/web             │
  │                     │  │                       │
  │  启动: Electron      │  │  启动: Vite Dev Server  │
  │  传输: IPC 或        │  │  传输: Gateway WS      │
  │       Gateway WS     │  │  文件系统: ❌ 没有      │
  │  文件: 真实 fs        │  │  Agent: ❌ 不运行       │
  │  Agent: ✅ 在这里     │  │  API Key: ❌ 不持有     │
  │  API Key: 本地存储    │  │                       │
  └─────────────────────┘  └──────────────────────┘
```

Desktop 通过 Electron 启动。Vite 构建主进程（Agent Loop + Session Manager）和渲染进程（加载 `@catbuddy/ui`），主进程与渲染进程间通过 IPC 通信。

Web 是纯粹的 Vite SPA，一行 `vite` 就起来。但它不能独立工作——必须连上 Gateway 或本地 Desktop 才有数据传输。

---

## 为什么不是 12 个独立仓库？

你可能会想：既然职责都拆清楚了，为什么不做成 12 个独立的 npm 包？

答案是**跨包改动的成本**。

在 CatBuddy 开发中，最常见的改动是"给 `MessageRecord` 加一个字段"。这会同时影响：

- `shared`（类型定义）
- `platform`（API 响应处理）
- `ui`（渲染逻辑）
- `gateway`（MySQL 存储字段）

如果是 12 个独立仓库：

1. `catbuddy-shared` 改类型 → 发版 → npm publish
2. `catbuddy-platform` 升级 shared → 改代码 → 发版
3. `catbuddy-ui` 升级两个依赖 → 改代码 → 发版
4. `catbuddy-gateway` 同样操作
5. `catbuddy-desktop` 升级所有依赖

5 个 PR，5 次发版，中间有一环版本没对上就炸。

在 Monorepo 里，你在 `shared` 改一个类型，保存文件，所有依赖它的包在同一工作区里立刻得到类型更新。一次提交，一次构建，全部同步。

**Monorepo 的核心价值不是"把所有代码放一起"，而是"让跨包的原子改动成为可能"。**

---

> **这篇讲了什么？**
>
> 1. 12 个包按严格单向依赖组织：`shared`（根）→ `client` → `platform` → `ui` → `desktop/web/gateway`（叶）。
> 2. 拆分的动机是复用——UI 组件被 Desktop 和 Web 共享，类型定义被所有包共享。
> 3. Monorepo 让跨包改动能原子提交——一次改类型，全局生效，不会版本不同步。

> 下一篇：进入核心——"Agent 内容引擎"到底是什么意思？它在整个系统里扮演什么角色？
