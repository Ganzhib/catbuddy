# Langfuse 自托管部署指南

> 如果你不想用 Langfuse Cloud，或者需要在内网环境中使用，这份文档帮你从零部署 Langfuse 服务端。

## 前置要求

| 依赖 | 最低版本 | 说明 |
|------|---------|------|
| Git | 最新版 | 用于克隆官方仓库 |
| Docker | 20.10+ | 容器运行时 |
| Docker Compose | v2.0+ | `docker compose`（非 `docker-compose`） |
| 内存 | 8GB+ | 开发测试建议 8GB，生产环境建议 16GB |
| 磁盘 | 50GB+ | ClickHouse + PostgreSQL 数据会持续增长，建议 100GB+ |

---

## 一、快速部署（Docker Compose）

### 1.1 克隆官方仓库

```bash
git clone https://github.com/langfuse/langfuse.git
cd langfuse
```

官方仓库中的 `docker-compose.yml` 已包含完整服务栈。

### 1.2 服务栈概览

官方 Docker Compose 包含以下全部服务（v3 架构）：

| 服务 | 功能 | 端口 (宿主机) | 默认凭据（⚠️ 必须修改） |
|------|------|--------------|------------------------|
| `langfuse-web` | Web UI + API | `3000` (全网) | `NEXTAUTH_SECRET` |
| `langfuse-worker` | 后台任务处理（队列、数据写入） | `127.0.0.1:3030` | 共享所有凭据 |
| `postgres` | 元数据存储（用户、项目、配置） | `127.0.0.1:5432` | `postgres/postgres` |
| `clickhouse` | 分析型数据库（Trace/Observation 数据） | `127.0.0.1:8123/9000` | `clickhouse/clickhouse` |
| `redis` | 缓存 & 消息队列 (BullMQ) | `127.0.0.1:6379` | `myredissecret` |
| `minio` | S3 兼容对象存储（事件/媒体/导出） | `9090` (S3 API) | `minio/miniosecret` |

> **安全设计**：除 `langfuse-web` 的 3000 端口和 MinIO 的 9090 端口外，所有服务端口均绑定到 `127.0.0.1`，外部无法直接访问。

### 1.3 生成安全密钥

在启动前，需要生成所有安全密钥：

```bash
# ENCRYPTION_KEY（64 位十六进制，用于数据加密）
openssl rand -hex 32

# NEXTAUTH_SECRET（至少 32 位随机字符串，用于会话签名）
openssl rand -base64 32

# SALT（至少 16 位随机字符串）
openssl rand -base64 16
```

### 1.4 创建 `.env` 文件

在 `langfuse/` 目录下创建 `.env` 文件，覆盖默认的敏感凭据：

```env
# ============ PostgreSQL ============
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<替换为强密码>
POSTGRES_DB=postgres

# ============ ClickHouse ============
CLICKHOUSE_USER=clickhouse
CLICKHOUSE_PASSWORD=<替换为强密码>

# ============ Redis ============
REDIS_AUTH=<替换为强密码>

# ============ MinIO ============
MINIO_ROOT_USER=minio
MINIO_ROOT_PASSWORD=<替换为强密码>

# ============ Langfuse 核心安全 ============
# 用 1.3 步骤中 openssl 生成的值填入
ENCRYPTION_KEY=<openssl rand -hex 32 的输出>
NEXTAUTH_SECRET=<openssl rand -base64 32 的输出>
SALT=<openssl rand -base64 16 的输出>

# ============ Langfuse 服务器地址 ============
NEXTAUTH_URL=http://localhost:3000

# ============ 可选配置 ============
TELEMETRY_ENABLED=false
LANGFUSE_ENABLE_EXPERIMENTAL_FEATURES=false
```

> 官方 `docker-compose.yml` 中所有带 `# CHANGEME` 注释的变量都已通过 `.env` 文件覆盖，无需直接修改 yml 文件。

### 1.5 启动服务

```bash
# 后台启动所有服务
docker compose up -d

# 查看所有容器状态（等待所有服务 healthy）
docker compose ps

# 查看 langfuse-web 启动日志
docker compose logs -f langfuse-web
```

启动过程约 2-3 分钟，`langfuse-web-1` 容器日志出现 `"Ready"` 即表示启动完成。

### 1.6 访问 Web UI

浏览器打开 `http://localhost:3001`：

1. 点击 **"Sign up"** 注册管理员账号
2. 登录后进入 **Settings → API Keys** → 创建 API Key，拿到：
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

### 3.1 使用外部数据库服务

如果已有外部 PostgreSQL / ClickHouse / Redis 实例，可以通过 `.env` 文件指向外部服务，并注释掉 `docker-compose.yml` 中对应的服务。

```env
# 外部 PostgreSQL
DATABASE_URL=postgresql://user:password@你的PG地址:5432/postgres

# 外部 ClickHouse
CLICKHOUSE_MIGRATION_URL=clickhouse://你的CH地址:9000
CLICKHOUSE_URL=http://你的CH地址:8123
CLICKHOUSE_USER=clickhouse
CLICKHOUSE_PASSWORD=你的密码

# 外部 Redis
REDIS_HOST=你的Redis地址
REDIS_PORT=6379
REDIS_AUTH=你的密码
```

### 3.2 数据持久化

`docker-compose.yml` 中已定义以下命名卷，确保不被误删：

| Volume | 用途 |
|--------|------|
| `langfuse_postgres_data` | PostgreSQL 元数据 |
| `langfuse_clickhouse_data` | ClickHouse Trace 数据 |
| `langfuse_clickhouse_logs` | ClickHouse 日志 |
| `langfuse_redis_data` | Redis 持久化 |
| `langfuse_minio_data` | MinIO 对象存储 |

```bash
# 备份 PostgreSQL（元数据）
docker exec langfuse-postgres-1 \
  pg_dump -U postgres postgres > langfuse_pg_backup_$(date +%Y%m%d).sql

# 恢复 PostgreSQL
docker exec -i langfuse-postgres-1 \
  psql -U postgres postgres < langfuse_pg_backup_20260607.sql

# ⚠️ ClickHouse 数据量较大，建议用 clickhouse-backup 工具或直接备份卷目录
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

然后在 `.env` 中修改：

```env
NEXTAUTH_URL=https://langfuse.your-domain.com
```

CatBuddy `.env` 对应改为：

```env
LANGFUSE_BASE_URL=https://langfuse.your-domain.com
```

### 3.4 资源限制

防止 Langfuse 占用过多宿主机资源。在 `docker-compose.yml` 中为关键服务添加资源限制：

```yml
langfuse-web:
  deploy:
    resources:
      limits:
        memory: 2G
        cpus: "2"
      reservations:
        memory: 512M
        cpus: "0.5"

langfuse-worker:
  deploy:
    resources:
      limits:
        memory: 2G
        cpus: "2"

clickhouse:
  deploy:
    resources:
      limits:
        memory: 4G
        cpus: "2"
```

### 3.5 日志管理

为避免 Docker 日志占满磁盘，在 `docker-compose.yml` 中为各服务添加日志限制：

```yml
langfuse-web:
  logging:
    driver: "json-file"
    options:
      max-size: "50m"
      max-file: "3"

langfuse-worker:
  logging:
    driver: "json-file"
    options:
      max-size: "50m"
      max-file: "3"

clickhouse:
  logging:
    driver: "json-file"
    options:
      max-size: "100m"
      max-file: "3"
```

---

## 四、日常运维

### 4.1 升级版本

```bash
cd langfuse

# 停止服务
docker compose down

# 拉取最新镜像并重启
docker compose up --pull always -d

# 查看迁移日志（数据库 schema 自动迁移）
docker compose logs -f langfuse-web
```

> 详细升级流程参考 [官方升级指南](https://langfuse.com.cn/self-hosting/upgrade)

### 4.2 查看状态

```bash
# 所有容器状态
docker compose ps

# 资源占用
docker stats
```

### 4.3 清理旧数据

Langfuse 会持续积累 ClickHouse 中的 Trace 数据。如果磁盘空间紧张：

1. Web UI → **Settings → Projects** → 项目设置 → Data Retention
2. 设置自动过期天数（如 30 天）
3. 或者手动删除不需要的 Traces

### 4.4 停止服务

```bash
# 停止但不删除数据
docker compose stop

# 停止并删除容器（保留数据卷）
docker compose down

# ⚠️ 完全清除（包括所有数据库数据）
docker compose down -v
```

---

## 五、架构说明

```
┌──────────────────────────────────────────────────────────────┐
│                       Docker Host                              │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │  PostgreSQL   │  │  ClickHouse  │  │  Redis           │    │
│  │  (元数据)      │  │  (Trace数据)  │  │  (队列/缓存)      │    │
│  │  127.0.0.1    │  │  127.0.0.1   │  │  127.0.0.1       │    │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘    │
│         │                 │                    │               │
│  ┌──────┴─────────────────┴────────────────────┴─────────┐    │
│  │              langfuse-web / langfuse-worker             │    │
│  │              :3000 (Web UI + API)                       │    │
│  └────────────────────────┬───────────────────────────────┘    │
│                           │                                     │
│  ┌────────────────────────┴───────────────────────────────┐    │
│  │  MinIO (S3 兼容对象存储)                                  │    │
│  │  :9090 — 事件 / 媒体 / 批量导出                           │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                │
└────────────────────────────────┬───────────────────────────────┘
                                 │ HTTP
         ┌───────────────────────┼──────────┐
         │  CatBuddy Desktop     │          │
         │  Langfuse SDK  ──────►│          │
         │  baseUrl: localhost:3000          │
         └──────────────────────────────────┘
```

- **PostgreSQL** — 用户、项目、API Key 等元数据
- **ClickHouse** — 所有 Trace / Observation / Score 的大规模时序数据存储
- **Redis** — BullMQ 消息队列，Worker 异步消费 SDK 上报的数据写入 ClickHouse
- **MinIO** — S3 兼容存储，存放事件日志、媒体文件和批量导出
- **langfuse-web** — HTTP API + Web UI，接收 SDK 上报
- **langfuse-worker** — 后台 Worker，将数据从队列写入 ClickHouse

---

## 六、常见问题

### Q: 启动后访问 localhost:3000 打不开？

```bash
# 检查所有容器是否运行且 healthy
docker compose ps

# 查看 langfuse-web 日志
docker compose logs langfuse-web
```

常见原因：
- 依赖服务（ClickHouse/Redis/Postgres/MinIO）还未就绪 → 等待 2-3 分钟刷新
- 端口 3000 被占用 → 改 `.env` 中 `NEXTAUTH_URL` 并在 `docker-compose.yml` 中修改 `langfuse-web` 的 `ports` 映射
- 内存不足（ClickHouse 消耗较大）→ 加内存至 8GB+

### Q: 数据能存多久？

取决于 ClickHouse 和 PostgreSQL 的磁盘空间。按 CatBuddy 日常使用量：
- 每天 50-100 次对话，约产生 10-30 MB 数据（含 ClickHouse 索引）
- 100 GB 磁盘 ≈ 可用 5-10 年

### Q: 自托管和 Cloud 版功能有区别吗？

核心功能完全一样（Tracing、Scores、Sessions）。Cloud 版额外有团队协作和企业 SSO，自托管版没有。

### Q: 能否和团队共用？

可以。将 `NEXTAUTH_URL` 设为服务器的 IP 或域名，团队成员各自注册账号，即可共享项目视图。

### Q: 忘记管理员密码怎么办？

自托管版可以通过数据库重置：

```bash
# 进入 PostgreSQL 容器
docker exec -it langfuse-postgres-1 psql -U postgres
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
