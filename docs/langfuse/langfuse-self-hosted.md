# Langfuse 自托管部署指南

> 如果你不想用 Langfuse Cloud，或者需要在内网环境中使用，这份文档帮你从零部署 Langfuse 服务端。

## 前置要求

| 依赖 | 最低版本 | 说明 |
|------|---------|------|
| Docker | 20.10+ | 容器运行时 |
| Docker Compose | v2.0+ | `docker compose`（非 `docker-compose`） |
| 内存 | 4GB+ | 生产环境建议 8GB |
| 磁盘 | 20GB+ | PostgreSQL 数据会持续增长 |

---

## 一、快速部署（Docker Compose）

### 1.1 创建部署目录

```bash
mkdir langfuse-server && cd langfuse-server
```

### 1.2 编写 `docker-compose.yml`

```yml
# langfuse-server/docker-compose.yml
version: "3.8"

services:
  # ── PostgreSQL 数据库 ──
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: langfuse
      POSTGRES_PASSWORD: langfuse_postgres_password   # 改掉这个密码
      POSTGRES_DB: langfuse
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U langfuse"]
      interval: 5s
      timeout: 3s
      retries: 5

  # ── Langfuse 服务 ──
  langfuse-web:
    image: ghcr.io/langfuse/langfuse:latest
    restart: unless-stopped
    ports:
      - "3000:3000"       # Web UI 端口
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      # 数据库连接
      DATABASE_URL: postgresql://langfuse:langfuse_postgres_password@postgres:5432/langfuse
      # 加密密钥（生成方式见 1.3）
      NEXTAUTH_SECRET: my_ultra_secret_nextauth_secret_key_change_me
      SALT: my_salt_change_me
      # 服务地址（部署在本机填 localhost，给团队用填 IP 或域名）
      NEXTAUTH_URL: http://localhost:3000
      # 遥测（可以关闭）
      TELEMETRY_ENABLED: "false"
      # 启用实验性功能（可选）
      LANGFUSE_ENABLE_EXPERIMENTAL_FEATURES: "false"

volumes:
  postgres_data:
```

### 1.3 生成安全密钥

```bash
# NEXTAUTH_SECRET（至少 32 位随机字符串）
openssl rand -base64 32

# SALT（至少 16 位随机字符串）
openssl rand -base64 16
```

将生成的值替换掉 `docker-compose.yml` 中的 `my_ultra_secret_...` 和 `my_salt_change_me`。

### 1.4 启动服务

```bash
# 后台启动
docker compose up -d

# 查看日志确认启动成功
docker compose logs -f langfuse-web
```

看到类似输出即成功：
```
langfuse-web-1  | Listening on http://localhost:3000
```

### 1.5 访问 Web UI

浏览器打开 `http://localhost:3000`：

1. 点击 **"Sign up"** 注册管理员账号
2. 登录后进入 **Settings → Projects** → 创建项目（如 `catbuddy-agent-eval`）
3. **Settings → API Keys** → 创建 API Key，拿到：
   ```
   Public Key:  pk-lf-xxxxxxxx
   Secret Key:  sk-lf-xxxxxxxx
   ```

---

## 二、连接 CatBuddy 到自托管实例

### 2.1 修改 `.env`

自托管部署在本机时，Base URL 为 `http://localhost:3000`：

```env
LANGFUSE_ENABLED=true
LANGFUSE_PUBLIC_KEY=pk-lf-xxxxxxxx
LANGFUSE_SECRET_KEY=sk-lf-xxxxxxxx
LANGFUSE_BASE_URL=http://localhost:3000
```

> **注意**：自托管不需要 `/api` 后缀，SDK 自动拼接。

### 2.2 验证连接

启动 CatBuddy Desktop，终端应出现：

```
[langfuse] initialized, baseUrl=http://localhost:3000
[init] Langfuse tracing enabled
```

发送一条测试消息，然后在 Langfuse Web UI `http://localhost:3000` 的 **Tracing** 页面检查数据。

---

## 三、生产环境加固

### 3.1 使用外部 PostgreSQL

将 `docker-compose.yml` 中 `postgres` 服务去掉，改为连接外部数据库：

```yml
environment:
  DATABASE_URL: postgresql://user:password@你的PG地址:5432/langfuse
```

### 3.2 数据持久化

`docker-compose.yml` 中已有 `postgres_data` volume，确保不被误删：

```bash
# 备份数据库
docker exec langfuse-server-postgres-1 \
  pg_dump -U langfuse langfuse > langfuse_backup_$(date +%Y%m%d).sql

# 恢复
docker exec -i langfuse-server-postgres-1 \
  psql -U langfuse langfuse < langfuse_backup_20260607.sql
```

### 3.3 Nginx 反向代理 + HTTPS

```nginx
# /etc/nginx/sites-available/langfuse
server {
    listen 443 ssl;
    server_name langfuse.your-domain.com;

    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

然后修改 `docker-compose.yml` 中：

```yml
environment:
  NEXTAUTH_URL: https://langfuse.your-domain.com
```

CatBuddy `.env` 对应改为：

```env
LANGFUSE_BASE_URL=https://langfuse.your-domain.com
```

### 3.4 资源限制

防止 Langfuse 占用过多宿主机资源：

```yml
langfuse-web:
  # ... 其他配置 ...
  deploy:
    resources:
      limits:
        memory: 2G
        cpus: "2"
      reservations:
        memory: 512M
        cpus: "0.5"
```

### 3.5 日志管理

```yml
langfuse-web:
  # ... 其他配置 ...
  logging:
    driver: "json-file"
    options:
      max-size: "50m"
      max-file: "3"
```

---

## 四、日常运维

### 4.1 升级版本

```bash
cd langfuse-server

# 拉取最新镜像
docker compose pull langfuse-web

# 重启服务
docker compose up -d langfuse-web

# 查看迁移日志（数据库 schema 自动迁移）
docker compose logs -f langfuse-web
```

### 4.2 查看状态

```bash
# 所有容器状态
docker compose ps

# 资源占用
docker stats langfuse-server-langfuse-web-1
```

### 4.3 清理旧数据

Langfuse 会持续积累 Trace 数据。如果磁盘空间紧张：

1. Web UI → **Settings → Projects** → 项目设置 → Data Retention
2. 设置自动过期天数（如 30 天）
3. 或者手动删除不需要的 Traces

### 4.4 停止服务

```bash
# 停止但不删除数据
docker compose stop

# 完全清除（包括数据库数据）
docker compose down -v
```

---

## 五、架构说明

```
┌────────────────────────────────────────────────┐
│                Docker Host                       │
│                                                  │
│  ┌──────────────┐     ┌──────────────────────┐  │
│  │  PostgreSQL   │◄────│  Langfuse Web        │  │
│  │  (数据存储)    │     │  (API + Web UI)      │  │
│  │  :5432        │     │  :3000               │  │
│  └──────────────┘     └──────────┬───────────┘  │
│                                   │               │
└───────────────────────────────────┼───────────────┘
                                    │ HTTP
         ┌──────────────────────────┼───────┐
         │  CatBuddy Desktop         │       │
         │  Langfuse SDK  ──────────►│       │
         │  baseUrl: localhost:3000  │       │
         └───────────────────────────┘       │
```

- **PostgreSQL** — 所有 Trace / Generation / Span / Score 数据存储在这里
- **Langfuse Web** — 提供 HTTP API 和 Web UI，接收 SDK 上报并写入 DB
- **Langfuse SDK** — CatBuddy 内嵌的 `langfuse` npm 包，负责收集事件并批量 POST 到 Web 服务

---

## 六、常见问题

### Q: 启动后访问 localhost:3000 打不开？

```bash
# 检查容器是否运行
docker compose ps

# 查看 langfuse-web 日志
docker compose logs langfuse-web
```

常见原因：
- PostgreSQL 还未就绪 → 等 10 秒刷新
- 端口 3000 被占用 → 改 `docker-compose.yml` 中 `ports` 为 `"3001:3000"`
- 内存不足 → 加内存或关闭其他服务

### Q: 数据能存多久？

取决于 PostgreSQL 磁盘空间。按 CatBuddy 日常使用量：
- 每天 50-100 次对话，约产生 5-10 MB 数据
- 100 GB 磁盘 ≈ 可用 10+ 年

### Q: 自托管和 Cloud 版功能有区别吗？

核心功能完全一样（Tracing、Scores、Sessions）。Cloud 版额外有团队协作和企业 SSO，自托管版没有。

### Q: 能否和团队共用？

可以。将 `NEXTAUTH_URL` 设为服务器的 IP 或域名，团队成员各自注册账号，在同一项目下即可共享 Traces 视图。

### Q: 忘记管理员密码怎么办？

自托管版可以通过数据库重置（因为不依赖外部邮件服务）：

```bash
# 进入 PostgreSQL 容器
docker exec -it langfuse-server-postgres-1 psql -U langfuse
```

然后联系 Langfuse 官方文档获取密码重置 SQL。

---

## 与 Cloud 版对比

| 维度 | Langfuse Cloud | 自托管 |
|------|---------------|--------|
| **部署** | 零部署，注册即用 | 需要 Docker 环境 |
| **免费额度** | 50K obs/month | 无限制（取决于磁盘） |
| **数据隐私** | 存储在 Langfuse 服务器 | 存储在自己的机器 |
| **运维** | 官方维护 | 自行维护 |
| **稳定性** | 高可用 | 依赖本地服务器 |
| **适合场景** | 个人评测、小团队 | 内网环境、数据敏感项目 |

> **建议**：个人评测先用 Cloud 免费额度，数据量大了或需要内网部署再考虑自托管。
