# learnbuddy 三端部署

Web（薄客户端）+ Gateway（中转/鉴权）+ Desktop（Agent 宿主）。开发联调见 [README.md](../README.md)。

## 官方域名（用户无需配置）

| 端 | 生产域名 | 开发 |
|----|----------|------|
| **Web**（浏览器打开） | `https://learnbuddy.ganzhibin.icu` | `http://127.0.0.1:5173` |
| **Gateway**（API + WS） | `https://gateway.ganzhibin.icu` | `127.0.0.1:18765` |
| **Desktop**（安装包） | 连 `wss://gateway.ganzhibin.icu/ws` | `ws://127.0.0.1:18765/ws` |

用户只需 **邮箱登录** + Desktop **侧栏远程控制**；路由靠同一邮箱。

服务端 `GATEWAY_SECRET` 须与客户端内置 `learnbuddy-desktop-pair-v1` 一致。常量见 `packages/shared/src/gateway-endpoints.ts`。

## 架构

```text
浏览器 (apps/web)  ──HTTP/WS──►  Gateway (:18765)  ──WS──►  Desktop (Electron)
                                    │
                                 MySQL + SMTP
```

## 环境变量模板

| 端 | 模板 | 复制为 |
|----|------|--------|
| Desktop | `apps/desktop/.env.example` | `apps/desktop/.env` 或 `~/.learnbuddy.env` |
| Web 开发 | `apps/web/.env.development.example` | `apps/web/.env.development` |
| Web 生产 build | `apps/web/.env.production.example` | `apps/web/.env.production` |
| Gateway | `gateway/.env.example` | `gateway/.env` |

## 1. Gateway

### 本地（开发）

```bash
docker compose -f gateway/docker-compose.yml up -d mysql
cp gateway/.env.example gateway/.env   # 首次
pnpm gateway:dev
```

### Docker Compose（Gateway + MySQL）

```bash
cd learnbuddy
cp gateway/.env.example gateway/.env   # 填写 SMTP、JWT、GATEWAY_SECRET
docker compose -f gateway/docker-compose.yml up -d --build
curl http://127.0.0.1:18765/health
```

Compose 会将容器内 `MYSQL_HOST` 设为 `mysql`（覆盖 `.env` 里的 `127.0.0.1`，仅容器内生效）。

### 生产 checklist

- [ ] `GATEWAY_JWT_SECRET` 改为强随机值
- [ ] `GATEWAY_SECRET=learnbuddy-desktop-pair-v1`（与客户端内置一致）
- [ ] DNS：`gateway.ganzhibin.icu` → Gateway 服务器（TLS + WSS）
- [ ] DNS：`learnbuddy.ganzhibin.icu` → Web 静态站（TLS）
- [ ] `GATEWAY_AUTH_REQUIRE_EMAIL=true`、`GATEWAY_AUTH_DEV_BYPASS=false`
- [ ] SMTP 可用（邮箱 OTP）
- [ ] MySQL 持久化卷
- [ ] 前置 TLS 终止（Nginx/Caddy），对外 `wss://`

## 2. Web

```bash
pnpm build:web
# 产出: apps/web/dist/ — 部署到 learnbuddy.ganzhibin.icu；API 默认 gateway.ganzhibin.icu
```

### Web 提供桌面安装包下载

1. 打包桌面：`pnpm build:desktop`（安装包多在 `apps/desktop/release-fresh/`）。
2. 复制到 Web 静态目录（Node，跨平台）：

```bash
pnpm build:web
```

（已包含 `stage:desktop-installer`；仅改前端、安装包已就位时用 `pnpm build:web:only`。）

生产上传：

```bash
pnpm deploy:web:full    # 桌面包 + web 构建 + 上传到服务器（推荐）
# 或已打过桌面包：pnpm deploy:web
```

或本地一键：`pnpm build:release`（desktop → web，不上传）。

可选：`apps/web/.env.production` 中设置 `VITE_DESKTOP_DOWNLOAD_URL` 指向 CDN 完整 URL。

自托管或同域反代时才需要 `apps/web/.env.production`（见 `.env.production.example`）。

### 可选：同域反代

Vite dev 的 `/gateway-api`、`/gateway-ws` 代理**生产不存在**，须由 Nginx 等替代：

```nginx
server {
    listen 443 ssl;
    server_name app.example.com;

    root /var/www/learnbuddy-web/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }

    location /gateway-api/ {
        proxy_pass http://127.0.0.1:18765/;
        proxy_set_header Host $host;
    }

    location /gateway-ws/ {
        proxy_pass http://127.0.0.1:18765/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

`.env.production` 示例：

```env
VITE_USE_GATEWAY=true
VITE_GATEWAY_HTTP_URL=/gateway-api
```

未设置 `VITE_GATEWAY_HTTP_URL` 时，生产构建会默认使用 `${origin}/gateway-api`。

### 跨域直连（备选）

```env
VITE_GATEWAY_HTTP_URL=https://gateway.example.com
```

Gateway 已启用 CORS；WebSocket 须 `wss://`。

## 3. Desktop

```bash
pnpm build:desktop
```

安装后：**登录 → 侧栏打开远程控制**，自动连 `gateway.ganzhibin.icu`。

开发者可选 `apps/desktop/.env`（API Key、本地 Gateway 覆盖）。Gateway 服务端见 `gateway/.env`。

## 一键构建

```bash
pnpm build:release   # desktop + web（含安装包拷贝）
pnpm build:all       # gateway + desktop + web
pnpm build:web:only  # 仅 Vite，不拷贝安装包
pnpm gateway:build
pnpm build:desktop
```

## 上线前自检

- [ ] `curl https://gateway.ganzhibin.icu/health` → `ok: true`
- [ ] 打开 `https://learnbuddy.ganzhibin.icu` 能登录
- [ ] Desktop 远程控制已连接（health 中 `desktops ≥ 1`）
- [ ] Web 发消息有流式回复（非 503）
- [ ] 新建对话同步到 Desktop 侧栏

详见 [GATEWAY.md](./GATEWAY.md)、[CROSS_DEVICE_GATEWAY.md](./CROSS_DEVICE_GATEWAY.md)。
