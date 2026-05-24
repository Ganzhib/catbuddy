# catbuddy/deploy — 一键部署 Gateway / Web

Gateway Docker 镜像打包上传 + Web 静态站 scp 部署。

## 首次使用

在 **catbuddy 根目录**：

```powershell
# 1. 生产环境变量（若还没有）
cp .env.production.example .env.production

# 2. 部署配置
cp deploy/deploy.config.example.json deploy/deploy.config.json
# 编辑 host、identityFile、certEmail 等

# 3. 部署
pnpm deploy:gateway
```

## 常用命令

| 命令 | 作用 |
|------|------|
| `pnpm deploy:gateway` | Gateway：build → 打包 → 上传 → 远程启动 |
| `pnpm deploy:gateway:local` | 仅本机 Docker 生产模式 |
| `pnpm deploy:gateway:pack` | 仅 build + 打包到 `deploy/dist-docker/` |
| `pnpm deploy:gateway:nginx` | 仅远程 Nginx + HTTPS |
| `pnpm deploy:web` | Web 静态站 → `catbuddy.ganzhibin.icu` |
| `pnpm deploy:web:full` | 桌面包 + Web 构建 + 上传 |

## deploy.config.json

`deploy.config.json` 含 SSH 与服务器信息，**勿提交 Git**（已在 `.gitignore` 忽略）。

## MySQL 与 `.env.production`

远程部署会在启动 Gateway 前自动同步 MySQL 应用用户（`catbuddy@%` 密码与 `.env` 一致），避免旧数据卷导致 `Access denied`。

- `.env.production` 中带空格/尖括号的值请加引号，例如：`SMTP_FROM="catbuddy <you@qq.com>"`
- 部署脚本**不会** `source` 整个 `.env`，只读取 `MYSQL_*` 变量
- 若需清空数据库：`ssh` 到服务器后 `cd /opt/catbuddy/gateway && docker compose down -v`

详见 [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)。
