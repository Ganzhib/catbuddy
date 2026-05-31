<p align="center">
  <picture>
    <source srcset="apps/desktop/public/brand/logo.webp" type="image/webp">
    <img src="apps/desktop/public/brand/logo.png" alt="catbuddy" width="520">
  </picture>
</p>

<p align="center">
  <strong>🐱 你的本地 AI 伙伴 — 控制文件、调用工具、跨端协同，全部在你的机器上运行。</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Platform"></a>
  <a href="#"><img src="https://img.shields.io/badge/electron-33-9feaf9" alt="Electron"></a>
  <a href="#"><img src="https://img.shields.io/badge/react-18-61dafb" alt="React"></a>
</p>

---

## ✨ 为什么选择 catbuddy？

catbuddy 是一个**桌面优先**的 AI 编程助手。与其他 AI 工具不同：

- 🔒 **Agent 始终在你本地运行** — 文件从不出你的机器
- 🌐 **Web 遥控器模式** — 手机/平板也能控制桌面 Agent
- 📁 **工作空间安全隔离** — 每个文件夹独立授权，AI 不会乱翻文件
- 🧩 **MCP + Skill 双生态** — 连接外部工具，一键安装技能包
- 🔑 **自带 API Key** — 用你自己的 AI 提供商，数据你说了算

---

## 🎯 核心功能

<table>
  <tr>
    <td width="50%">
      <h4>💬 智能对话</h4>
      <p>Plan · Analyze · Brainstorm · Code · Summarize — 六种快速操作，从规划到编码一气呵成。</p>
    </td>
    <td width="50%">
      <h4>🎨 图像生成</h4>
      <p>Icon · Sticker · Poster · Product · Portrait — AI 创作从图标到海报。</p>
    </td>
  </tr>
  <tr>
    <td>
      <h4>🔌 MCP 市场</h4>
      <p>一键接入 GitHub 等 MCP 服务，粘贴 JSON 配置即时生效，无需重启。</p>
    </td>
    <td>
      <h4>🧠 Skill 市场</h4>
      <p>一键安装技能包，启用/禁用热重载，下一条消息即可生效。</p>
    </td>
  </tr>
  <tr>
    <td>
      <h4>📁 工作空间</h4>
      <p>上传文件夹 → 自动创建 <code>.catbuddy</code> 配置 → AI 安全操作该目录。</p>
    </td>
    <td>
      <h4>📱 跨端协同</h4>
      <p>桌面运行 Agent，浏览器/手机远程控制 — 同一邮箱自动配对。</p>
    </td>
  </tr>
</table>

---

## 🚀 快速开始

### 环境要求

- **Node.js** ≥ 20
- **pnpm** ≥ 10（`npm i -g pnpm`）
- **Docker**（仅 Gateway 模式需要 MySQL）

### 安装与启动

```bash
# 1. 克隆仓库
git clone https://github.com/your-org/catbuddy.git
cd catbuddy

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env：填入 AI Key 和邮箱
```

### 启动桌面应用

```bash
# 远程模式（推荐，无需本地 Gateway）
pnpm dev:desktop

# 或本地全栈模式
pnpm gateway:dev    # 终端1：启动 Gateway
pnpm dev:desktop    # 终端2：启动桌面应用
pnpm dev:web        # 终端3（可选）：浏览器访问 http://localhost:5173
```

### 启动 Web 端

```bash
# 一键启动 Gateway + Web
pnpm dev:web:full
```

---

## 🏗️ 架构

```
┌─────────────┐     HTTP/WS      ┌──────────────┐      WS       ┌────────────────┐
│  浏览器/手机  │ ◄─────────────► │   Gateway    │ ◄───────────► │  Desktop App   │
│  (apps/web)  │                 │  (Fastify)   │               │  (Electron)    │
│              │                 │   :18765     │               │                │
│  仅 UI 展示  │                 │  MySQL+SMTP  │               │  Agent Loop    │
│  无本地权限  │                 │  鉴权+中继    │               │  本地文件操作   │
└─────────────┘                 └──────────────┘               └────────────────┘
```

- **Desktop**：Electron 应用，Agent 引擎真正执行推理和文件操作
- **Web**：React SPA，纯 UI 层，通过 Gateway 远程控制桌面
- **Gateway**：Fastify + WebSocket，负责鉴权、消息路由、会话持久化

### Monorepo 结构

```
catbuddy/
├── apps/
│   ├── desktop/        # Electron 主进程 + Agent + 安装包
│   └── web/            # 浏览器 SPA 入口
├── packages/
│   ├── ui/             # React 应用主体（共享 UI）
│   ├── client/         # catbuddyClient + 传输层（IPC/WS/HTTP）
│   ├── platform/       # IPC/HTTP bootstrap & API
│   └── shared/         # 类型与协议定义
├── gateway/            # 跨端中继服务
├── deploy/             # 部署脚本
├── scripts/            # 工具脚本
└── docs/               # 文档
```

---

## 🛠️ 技术栈

| 层面 | 技术 |
|------|------|
| **前端** | React 18 · Tailwind CSS 3 · Radix UI · Lucide Icons |
| **桌面** | Electron 33 · Vite 5 |
| **后端** | Fastify · WebSocket · MySQL |
| **AI** | Anthropic SDK · OpenAI SDK · MCP Protocol |
| **语言** | TypeScript 5.7 |
| **工程** | pnpm workspace · Zod · react-i18next |
| **打包** | electron-builder (NSIS/DMG/AppImage) · Docker Compose |

---

## ⚙️ 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `CATBUDDY_DEV_MODE` | `local` / `remote` | `local` |
| `GATEWAY_ACCOUNT_EMAIL` | 登录邮箱 | — |
| `DEEPSEEK_KEY` | AI 模型 API Key | — |
| `GATEWAY_PORT` | Gateway 端口 | `18765` |

更多配置见 [docs/GATEWAY.md](./docs/GATEWAY.md)。

---

## 📦 打包与部署

```bash
# 桌面安装包（Windows NSIS / macOS DMG / Linux AppImage）
pnpm build:desktop

# Web 静态资源
pnpm build:web

# 一键发布构建
pnpm build:release

# Docker 部署 Gateway
docker compose -f gateway/docker-compose.yml up -d
```

详见 [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)。

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feat/amazing-feature`
3. 提交改动：`git commit -m 'feat: add amazing feature'`
4. 推送分支：`git push origin feat/amazing-feature`
5. 提交 Pull Request

开发前请阅读 [PROJECT_PLAN.md](./PROJECT_PLAN.md) 了解项目现状。

---

## 📄 协议

[MIT License](./LICENSE) © catbuddy

---

<p align="center">
  <sub>Built with ❤️ for developers who want AI on their own terms.</sub>
</p>
