#!/usr/bin/env node
'use strict'

/**
 * Langfuse 一键远程部署
 * 目录: langfuse-docker/
 *
 * 前置:
 *   1. 创建 langfuse-docker/.env（含 DOMAIN/密码等）
 *   2. 填写 deploy/deploy.config.json 的 SSH 信息
 *
 * 用法:
 *   node langfuse-docker/deploy.cjs [--nginx]
 *
 * 选项:
 *   --nginx            Langfuse 启动后配置 Gateway Nginx + SSL
 *   --skip-pull        跳过 docker compose pull
 *   --skip-upload      只校验 .env，不上传
 *   --skip-remote      上传但不 ssh 启动
 *   --config <path>    指定 config.json 路径
 *   -h, --help         帮助
 */

const { execSync, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const DEPLOY_DIR = __dirname
const PROJECT_DIR = DEPLOY_DIR

const DEFAULTS = {
  langfuseRemoteDir: '/opt/catbuddy/langfuse',
}

function log(step, msg) {
  console.log(`\n[langfuse-deploy ${step}] ${msg}`)
}

function fail(msg) {
  console.error(`\n[langfuse-deploy] ERROR: ${msg}`)
  process.exit(1)
}

function run(cmd, cwd) {
  log('run', cmd)
  execSync(cmd, { stdio: 'inherit', cwd, shell: true })
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const flags = {
    config: '',
    nginx: false,
    skipPull: false,
    skipUpload: false,
    skipRemote: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-h' || a === '--help') flags.help = true
    else if (a === '--nginx') flags.nginx = true
    else if (a === '--skip-pull') flags.skipPull = true
    else if (a === '--skip-upload') flags.skipUpload = true
    else if (a === '--skip-remote') flags.skipRemote = true
    else if (a === '--config') flags.config = argv[++i]
    else fail(`未知参数: ${a}`)
  }
  return flags
}

function printHelp() {
  console.log(`Langfuse 一键远程部署

  node langfuse-docker/deploy.cjs [选项]

  前置:
    1. 创建 langfuse-docker/.env
    2. 填写 deploy/deploy.config.json（SSH 信息）

  选项:
    --nginx            Langfuse 启动后配置 Gateway Nginx + SSL
    --skip-pull        跳过 docker compose pull
    --skip-upload      只校验 .env，不上传
    --skip-remote      上传但不 ssh 启动
    --config <path>    指定 config.json 路径
    -h, --help         帮助
`)
}

// ─── 加载配置 ─────────────────────────────────────────────────────────────────

function loadConfig(configPath) {
  const file = configPath
    ? path.resolve(configPath)
    : path.resolve(DEPLOY_DIR, '..', 'deploy', 'deploy.config.json')

  if (!fs.existsSync(file)) {
    fail(
      `缺少配置文件 ${file}\n`
      + '  请先: cp deploy/deploy.config.exmple.json deploy/deploy.config.json'
    )
  }
  return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file, 'utf8')), configFile: file }
}

function loadEnv() {
  log('1/5', '检查 .env 配置...')

  const envPath = path.join(PROJECT_DIR, '.env')
  if (!fs.existsSync(envPath)) {
    fail(
      `缺少 ${envPath}\n`
      + '  请先创建 langfuse-docker/.env'
    )
  }

  const secrets = {}
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const m = trimmed.match(/^([A-Z_]+)=(.*)$/)
    if (m) secrets[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }

  const required = ['DOMAIN', 'ENCRYPTION_KEY', 'NEXTAUTH_SECRET', 'POSTGRES_PASSWORD']
  const missing = required.filter(k => !secrets[k])
  if (missing.length) fail(`.env 缺少必要字段: ${missing.join(', ')}`)

  console.log(`  ✓ 域名: ${secrets.DOMAIN}`)
  console.log('  ✓ .env 配置完整')
  return secrets
}

// ─── SSH / SCP ─────────────────────────────────────────────────────────────────

function sshArgs(cfg, { tty = false } = {}) {
  const args = [
    '-p', String(cfg.port),
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', 'ConnectTimeout=15',
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=4',
  ]
  if (tty) args.push('-tt')
  if (cfg.identityFile) args.push('-i', cfg.identityFile)
  args.push(`${cfg.user}@${cfg.host}`)
  return args
}

function scpArgs(cfg) {
  const args = [
    '-P', String(cfg.port),
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', 'ConnectTimeout=15',
  ]
  if (cfg.identityFile) args.push('-i', cfg.identityFile)
  return args
}

function sshRun(cfg, remoteCmd, { tty = false } = {}) {
  const preview = remoteCmd.length > 120 ? `${remoteCmd.slice(0, 117)}...` : remoteCmd
  log('ssh', `${cfg.user}@${cfg.host} → ${preview}`)
  const r = spawnSync('ssh', [...sshArgs(cfg, { tty }), remoteCmd], {
    stdio: 'inherit',
    shell: false,
  })
  if (r.status !== 0) fail(`ssh 失败 (code ${r.status})`)
}

function scpFile(cfg, local, remote) {
  const dest = `${cfg.user}@${cfg.host}:${remote}`
  log('scp', `${path.basename(local)} → ${dest}`)
  const r = spawnSync('scp', [...scpArgs(cfg), local, dest], {
    stdio: 'inherit',
    shell: false,
  })
  if (r.status !== 0) fail(`scp 失败: ${local}`)
}

// ─── 远程脚本 ──────────────────────────────────────────────────────────────────

function writeRemoteScript(outPath, cfg, flags) {
  const remoteDir = cfg.langfuseRemoteDir
  const skipPull = flags.skipPull ? '1' : '0'
  const DS = '\x24'   // 字面量 "$"，避免 JS 模板字符串误插值

  const sh = `#!/bin/bash
set -euo pipefail
REMOTE=${JSON.stringify(remoteDir)}
cd "$REMOTE"

# ── 安装 Docker ──
if ! command -v docker >/dev/null 2>&1; then
  echo "==> 安装 Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker && systemctl start docker
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "==> 安装 docker-compose-plugin..."
  apt-get update && apt-get install -y docker-compose-plugin
fi

# ── 清理旧容器 ──
echo "==> 清理旧容器..."
docker compose down --remove-orphans 2>/dev/null || true

# ── 拉取镜像 ──
SKIP_PULL=${JSON.stringify(skipPull)}
if [ "$SKIP_PULL" = "1" ]; then
  echo "==> 跳过镜像拉取 (--skip-pull)"
else
  echo "==> 拉取最新镜像..."
  docker compose pull
fi

# ── 启动 ──
echo "==> 启动服务..."
docker compose up -d

# ── 等待 langfuse-web 就绪 ──
echo "==> 等待 langfuse-web 就绪 (最长 5 分钟)..."
ATTEMPT=0
while [ $ATTEMPT -lt 60 ]; do
  # 1) 先确认容器在运行，没崩溃
  RUNNING=$(docker inspect langfuse-web --format "{{.State.Status}}" 2>/dev/null || echo "missing")
  if [ "$RUNNING" != "running" ]; then
    echo ""
    echo "✗ langfuse-web 容器未运行 (状态: $RUNNING)"
    echo "  最近日志:"
    docker compose logs --tail 30 langfuse-web 2>/dev/null || true
    break
  fi

  # 2) Docker healthcheck 优先（如果有定义）
  HEALTHY=$(docker inspect langfuse-web --format "{{.State.Health.Status}}" 2>/dev/null || echo "")
  if [ "$HEALTHY" = "healthy" ]; then
    echo ""
    echo "✓ langfuse-web 已就绪 (${DS}{ATTEMPT}0s, healthcheck: healthy)"
    break
  fi

  # 3) curl 兜底 — 直接测 HTTP 200
  if curl -sf http://127.0.0.1:3000/api/public/health > /dev/null 2>&1; then
    echo ""
    echo "✓ langfuse-web 已就绪 (${DS}{ATTEMPT}0s, HTTP 200)"
    break
  fi

  printf "."
  ATTEMPT=$((ATTEMPT + 1))
  sleep 10
done

if [ "$ATTEMPT" -ge 60 ]; then
  echo ""
  echo "⚠  5分钟超时！排查方式:"
  echo "   docker compose ps"
  echo "   docker compose logs --tail 50 langfuse-web"
fi

echo ""
echo "==> 容器状态:"
docker compose ps

echo ""
echo "==> HTTP 自检:"
curl -s http://127.0.0.1:3000/api/public/health && echo "" || echo "⚠  langfuse-web 尚未就绪"
`
  fs.writeFileSync(outPath, sh, 'utf8')
}

function writeNginxScript(outPath, cfg, secrets) {
  const domain = secrets.DOMAIN
  const certEmail = cfg.certEmail || 'admin@example.com'

  const sh = `#!/bin/bash
set -euo pipefail
DOMAIN=${JSON.stringify(domain)}
EMAIL=${JSON.stringify(certEmail)}

# ── 安装 Nginx + Certbot ──
if ! command -v nginx >/dev/null 2>&1; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx
fi

# ── 写入 Nginx 配置（HTTP，含占位符，sed 替换为实际域名）──
cat > /etc/nginx/sites-available/$DOMAIN << 'NGINX_EOF'
server {
    listen 80;
    server_name __DOMAIN__;
    client_max_body_size 32m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
NGINX_EOF
sed -i "s/__DOMAIN__/$DOMAIN/g" /etc/nginx/sites-available/$DOMAIN

ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# ── SSL 证书 ──
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo "✓ SSL 证书已存在: /etc/letsencrypt/live/$DOMAIN"
else
  echo "==> 申请 SSL 证书..."
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect || {
    echo "⚠  certbot 失败，尝试 acme.sh TLS-ALPN..."
    if [ ! -x /root/.acme.sh/acme.sh ]; then
      curl -fsSL https://get.acme.sh | sh -s email="$EMAIL"
    fi
    systemctl stop nginx
    /root/.acme.sh/acme.sh --issue -d "$DOMAIN" --alpn --server letsencrypt --force
    mkdir -p "/etc/letsencrypt/live/$DOMAIN"
    /root/.acme.sh/acme.sh --install-cert -d "$DOMAIN" --ecc \
      --key-file "/etc/letsencrypt/live/$DOMAIN/privkey.pem" \
      --fullchain-file "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" \
      --reloadcmd "systemctl reload nginx"
    systemctl start nginx

    # 写入 HTTPS server block（占位符 → sed）
    cat > /etc/nginx/sites-available/$DOMAIN << 'NGINX_HTTPS_EOF'
server {
    listen 80;
    server_name __DOMAIN__;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name __DOMAIN__;
    client_max_body_size 32m;

    ssl_certificate /etc/letsencrypt/live/__DOMAIN__/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/__DOMAIN__/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
NGINX_HTTPS_EOF
    sed -i "s/__DOMAIN__/$DOMAIN/g" /etc/nginx/sites-available/$DOMAIN
    nginx -t && systemctl reload nginx
  }
fi

echo ""
echo "==> 验证:"
curl -sf "https://$DOMAIN/api/public/health" && echo "" || echo "⚠  HTTPS 尚未就绪，等待 DNS/证书生效"
`
  fs.writeFileSync(outPath, sh, 'utf8')
}

// ─── 步骤 ─────────────────────────────────────────────────────────────────────

function checkCompose() {
  log('2/5', '检查 docker-compose.yml...')
  const composePath = path.join(PROJECT_DIR, 'docker-compose.yml')
  if (!fs.existsSync(composePath)) {
    fail(`缺少 ${composePath}`)
  }
  console.log('  ✓ docker-compose.yml 就绪')
}

function uploadFiles(cfg, flags, secrets) {
  if (flags.skipUpload) {
    log('3/5', '跳过上传 (--skip-upload)')
    return
  }

  log('3/5', '上传文件...')

  const remoteDir = cfg.langfuseRemoteDir
  sshRun(cfg, `mkdir -p ${remoteDir}`)

  const envPath = path.join(PROJECT_DIR, '.env')
  const composePath = path.join(PROJECT_DIR, 'docker-compose.yml')

  scpFile(cfg, envPath, `${remoteDir}/.env`)
  scpFile(cfg, composePath, `${remoteDir}/docker-compose.yml`)

  // 生成并上传远程脚本
  const outDir = path.join(DEPLOY_DIR, 'dist')
  fs.mkdirSync(outDir, { recursive: true })

  const remoteScript = path.join(outDir, 'remote-deploy.sh')
  writeRemoteScript(remoteScript, cfg, flags)
  scpFile(cfg, remoteScript, `${remoteDir}/remote-deploy.sh`)

  // Nginx 配置脚本
  if (flags.nginx) {
    const nginxScript = path.join(outDir, 'remote-nginx.sh')
    writeNginxScript(nginxScript, cfg, secrets)
    scpFile(cfg, nginxScript, `${remoteDir}/remote-nginx.sh`)
  }
}

function deployRemote(cfg, flags, secrets) {
  if (flags.skipRemote) {
    log('4/5', '跳过远程启动 (--skip-remote)')
    return
  }

  log('4/5', '远程启动 Langfuse...')

  const remoteDir = cfg.langfuseRemoteDir
  sshRun(
    cfg,
    `chmod +x ${remoteDir}/remote-deploy.sh && ${remoteDir}/remote-deploy.sh`,
    { tty: true }
  )

  // Nginx 配置
  if (flags.nginx) {
    log('5/5', '配置 Nginx + SSL...')
    sshRun(
      cfg,
      `chmod +x ${remoteDir}/remote-nginx.sh && ${remoteDir}/remote-nginx.sh`,
      { tty: true }
    )
  } else {
    log('info', '跳过 Nginx 配置（使用 --nginx 自动配置）')
  }

  printResult(cfg, secrets, flags)
}

// ─── 结果输出 ─────────────────────────────────────────────────────────────────

function printResult(cfg, secrets, flags) {
  const line = '='.repeat(60)
  console.log(`\n${line}`)
  console.log('  🎉 Langfuse 部署完成！')
  console.log(line)
  console.log()
  console.log(`  🌐 地址:      https://${secrets.DOMAIN}`)
  console.log()
  if (!flags.nginx) {
    console.log('  ⚠  尚未配置 Nginx/SSL')
    console.log('     请在 Gateway Nginx 中添加反向代理:')
    console.log(`       proxy_pass http://127.0.0.1:3000;`)
    console.log('     或重新运行: pnpm deploy:langfuse -- --nginx')
    console.log()
  }
  console.log('  📝 配置 catbuddy 上报:')
  console.log('     1. 登录 Langfuse → 项目设置 → API Keys → 创建 Key')
  console.log('     2. 粘贴到 catbuddy/.env:')
  console.log(`        LANGFUSE_PUBLIC_KEY=pk-lf-<Key>`)
  console.log(`        LANGFUSE_SECRET_KEY=sk-lf-<Key>`)
  console.log(`        LANGFUSE_BASE_URL=https://${secrets.DOMAIN}`)
  console.log()
  console.log('  🔧 运维命令:')
  console.log(`     ssh ${cfg.user}@${cfg.host}`)
  console.log(`     cd ${cfg.langfuseRemoteDir}`)
  console.log('     docker compose logs -f')
  console.log('     docker compose restart')
  console.log('     docker compose down')
  console.log(line)
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────

function main() {
  const flags = parseArgs(process.argv.slice(2))

  if (flags.help) {
    printHelp()
    return
  }

  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║       Langfuse 远程部署                              ║')
  console.log('╚══════════════════════════════════════════════════╝')

  const cfg = loadConfig(flags.config)
  if (!cfg.host) fail('deploy.config.json 缺少 host')

  const secrets = loadEnv()

  log('config', cfg.configFile)
  log('target', `${cfg.user}@${cfg.host}:${cfg.langfuseRemoteDir}`)

  checkCompose()
  uploadFiles(cfg, flags, secrets)
  deployRemote(cfg, flags, secrets)

  console.log('\n[langfuse-deploy] 完成')
}

main()
