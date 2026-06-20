---
name: gateway
description: Gateway 后端开发指南 — Fastify 服务器、WebSocket 中继、认证、部署
---

# Gateway 开发指南

Gateway 是基于 Fastify + WebSocket 的中继服务器，负责连接 Web/移动端客户端与桌面 Agent。

## 架构

```
浏览器/手机  ←HTTP/WS→  Gateway (:18765)  ←WS→  桌面 Agent
                              |
                           MySQL
                    （认证码、会话持久化）
```

## 目录结构

```
gateway/
├── src/                    # TypeScript 源码
│   ├── index.ts            # 入口
│   ├── server.ts           # Fastify 服务器配置
│   ├── ws/                 # WebSocket 消息路由
│   ├── auth/               # 基于邮箱的认证
│   ├── db/                 # MySQL 数据库层
│   └── routes/             # HTTP API 路由
├── config/                 # 运行时配置文件
├── test/                   # E2E 和验收测试
├── packages/
│   └── gateway-sdk-desktop/ # 桌面端连接 Gateway 的 SDK
├── docker-compose.yml      # MySQL + Gateway 容器编排
├── Dockerfile              # Gateway 容器镜像
└── vitest.config.ts        # 测试配置
```

## 开发命令

```bash
# 启动 MySQL（Docker）
pnpm build:database

# 启动 Gateway 开发服务器
pnpm gateway:dev

# 编译 TypeScript
pnpm gateway:build

# 启动生产服务
pnpm gateway:start

# 运行测试
pnpm gateway:test              # E2E 测试
pnpm gateway:test:acceptance   # 验收测试
pnpm gateway:test:all          # 全部测试
```

## 核心概念

### 认证流程
1. 用户在 Web 端输入邮箱 → Gateway 生成配对码
2. 桌面 Agent 用相同邮箱连接 → 校验配对码
3. Gateway 签发会话 Token，用于后续 WS 连接

### WebSocket 消息路由
- Gateway 维护已连接桌面 Agent 的注册表
- Web 客户端发送消息 → Gateway 路由到配对的桌面 Agent
- 桌面 Agent 回复 → Gateway 转发回 Web 客户端
- 会话持久化在 MySQL 中，断线重连不丢状态

### Desktop SDK（@catbuddy/gateway-sdk-desktop）
- 桌面应用连接 Gateway 时使用的客户端库
- 处理 WS 连接生命周期、自动重连、消息序列化

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `GATEWAY_PORT` | HTTP/WS 端口 | `18765` |
| `GATEWAY_ACCOUNT_EMAIL` | 认证邮箱 | — |
| `DB_HOST` | MySQL 地址 | — |
| `DB_PORT` | MySQL 端口 | — |
| `DB_USER` | MySQL 用户名 | — |
| `DB_PASSWORD` | MySQL 密码 | — |
| `DB_NAME` | MySQL 数据库名 | — |

## 部署

### 本地部署（Docker Compose）
```bash
docker compose -f gateway/docker-compose.yml up -d
```

### 远程部署
```bash
# 完整部署（含 Docker 镜像推送）
pnpm deploy:gateway

# 本地打包测试（跳过上传）
pnpm deploy:gateway:pack

# 仅更新 Nginx 配置
pnpm deploy:gateway:nginx
```

### 部署脚本（deploy/deploy.cjs）

执行以下步骤：
1. 构建 Gateway Docker 镜像
2. 推送到 Docker Registry
3. 生成 Nginx 配置
4. SCP 到远程服务器并重启服务

## 工具脚本

### `gateway-preflight.mjs` — Gateway 启动前健康检查

```js
// 在 vite.config.ts 中作为插件使用
import { gatewayPreflightPlugin } from '../../scripts/gateway-preflight.mjs'

export default defineConfig({
  plugins: [
    gatewayPreflightPlugin(/* enabled */ true, /* target */ 'http://127.0.0.1:18765'),
  ]
})
```

Web 端开发服务器启动时自动检查 Gateway 是否就绪。检查逻辑：
1. 请求 `http://127.0.0.1:18765/health`
2. 验证返回体含 `gateway` 或 `gateway_shim` 字段
3. 未就绪时打印提示：`gateway 未就绪，请重启: pnpm gateway:dev`

也支持手动调用 `checkGateway(url)` 函数。

### `reset-test-data.cjs` — 测试数据重置

```bash
pnpm reset:data:desktop         # 清除桌面端测试数据
pnpm reset:data:gateway:local   # 清除本地 Gateway + MySQL 数据
pnpm reset:data:gateway:remote  # 清除远程 Gateway 数据
pnpm reset:data:all             # 清除所有数据
```

**reset:data:desktop**：清除 `~/.catbuddy/` 下的会话历史、记忆、心跳任务等本地数据。

**reset:data:gateway:local**：重建 Gateway MySQL 数据库（docker compose down → up）。

**reset:data:gateway:remote**：通过 SSH + mysql CLI 远程清理。

## 部署脚本

### `deploy/deploy.cjs` — Gateway 远程部署

```bash
pnpm deploy:gateway             # 完整部署
pnpm deploy:gateway:pack        # 仅打包（跳过上传）
pnpm deploy:gateway:nginx       # 仅更新 Nginx 配置
pnpm deploy:gateway:local       # 本地部署
```

流程：
1. 构建 Docker 镜像（`gateway/Dockerfile`）
2. 推送到 Docker Registry
3. 通过 `deploy/deploy.config.json` 读取远程服务器配置
4. SCP nginx 配置和 docker-compose 文件到远程
5. SSH 远程执行 `docker compose up -d`

### `deploy/deploy-web.cjs` — Web 端部署

```bash
pnpm deploy:web                 # 部署 Web SPA
pnpm deploy:web:full            # Web + 桌面安装包一起部署
```

## 测试

```bash
# 运行单个测试文件
pnpm --dir gateway vitest run test/some-file.test.ts

# Watch 模式
pnpm --dir gateway vitest
```

测试工具位于 `gateway/test/`。验收测试使用真实 WebSocket 连接，确保端到端功能正常。
