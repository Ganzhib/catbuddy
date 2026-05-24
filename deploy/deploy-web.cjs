#!/usr/bin/env node
'use strict'

/**
 * catbuddy Web 静态站一键部署 → catbuddy.ganzhibin.icu
 *
 *   pnpm deploy:web
 *   pnpm deploy:web:full   # 含桌面包 build:release
 *
 * API 默认连 https://gateway.ganzhibin.icu（见 packages/shared gateway-endpoints.ts）
 */

const { execSync, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const DEPLOY_DIR = __dirname
const TAR_NAME = 'catbuddy-web.tar.gz'

const DEFAULTS = {
  host: '',
  user: 'root',
  port: 22,
  identityFile: '',
  certEmail: '',
  webDomain: 'catbuddy.ganzhibin.icu',
  webRemoteDir: '/opt/catbuddy/web',
}

function log(step, msg) {
  console.log(`\n[web-deploy ${step}] ${msg}`)
}

function fail(msg) {
  console.error(`\n[web-deploy] ERROR: ${msg}`)
  process.exit(1)
}

function formatBytes(n) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function findRoot() {
  const root = path.resolve(DEPLOY_DIR, '..')
  if (fs.existsSync(path.join(root, 'gateway', 'docker-compose.yml'))) return root
  fail('找不到 catbuddy 根目录（需含 gateway/docker-compose.yml）')
}

function loadConfig(configPath) {
  const file = configPath
    ? path.resolve(configPath)
    : path.join(DEPLOY_DIR, 'deploy.config.json')
  if (!fs.existsSync(file)) {
    fail(
      `缺少 ${file}\n`
      + '  请执行: cp deploy/deploy.config.example.json deploy/deploy.config.json',
    )
  }
  return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file, 'utf8')), configFile: file }
}

function run(cmd, cwd) {
  log('run', cmd)
  execSync(cmd, { stdio: 'inherit', cwd, shell: true, env: process.env })
}

function sshArgs(cfg) {
  const args = ['-p', String(cfg.port), '-o', 'StrictHostKeyChecking=accept-new']
  if (cfg.identityFile) args.push('-i', cfg.identityFile)
  args.push(`${cfg.user}@${cfg.host}`)
  return args
}

function scpArgs(cfg) {
  const args = ['-P', String(cfg.port), '-o', 'StrictHostKeyChecking=accept-new']
  if (cfg.identityFile) args.push('-i', cfg.identityFile)
  return args
}

function sshRun(cfg, remoteCmd) {
  const preview = remoteCmd.length > 120 ? `${remoteCmd.slice(0, 117)}...` : remoteCmd
  log('ssh', `${cfg.user}@${cfg.host} → ${preview}`)
  // shell:false — on Windows, shell:true makes cmd.exe treat `&&` in remoteCmd as local chaining
  const r = spawnSync('ssh', [...sshArgs(cfg), remoteCmd], {
    stdio: 'inherit',
    shell: false,
  })
  if (r.status !== 0) fail(`ssh 失败 (code ${r.status ?? 'unknown'})`)
}

function scpFile(cfg, local, remote) {
  log('scp', `${path.basename(local)} -> ${cfg.user}@${cfg.host}:${remote}`)
  const r = spawnSync('scp', [...scpArgs(cfg), local, `${cfg.user}@${cfg.host}:${remote}`], {
    stdio: 'inherit',
    shell: false,
  })
  if (r.status !== 0) fail(`scp 失败: ${local}`)
}

function writeRemoteScript(outPath, cfg, { skipCert = false } = {}) {
  const domain = cfg.webDomain
  const remoteDir = cfg.webRemoteDir
  const email = cfg.certEmail
  if (!email && !skipCert) fail('deploy.config.json 缺少 certEmail')

  const sh = `#!/bin/bash
set -euo pipefail

DOMAIN=${JSON.stringify(domain)}
REMOTE=${JSON.stringify(remoteDir)}
EMAIL=${JSON.stringify(email || '')}
SKIP_CERT=${skipCert ? '1' : '0'}

mkdir -p "$REMOTE"
cd "$REMOTE"
tar xzf ${TAR_NAME}
rm -f ${TAR_NAME}

if ! command -v nginx >/dev/null 2>&1; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx
fi

if ! command -v dig >/dev/null 2>&1; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y dnsutils
fi

write_nginx_http_only() {
  cat > /etc/nginx/sites-available/$DOMAIN << NGINX_EOF
server {
    listen 80;
    server_name ${domain};
    root ${remoteDir}/dist;
    index index.html;
    client_max_body_size 32m;

    location / {
        try_files \\$uri \\$uri/ /index.html;
    }
}
NGINX_EOF
}

write_nginx_https() {
  cat > /etc/nginx/sites-available/$DOMAIN << NGINX_EOF
server {
    listen 80;
    server_name ${domain};
    return 301 https://\\$host\\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${domain};
    root ${remoteDir}/dist;
    index index.html;
    client_max_body_size 32m;

    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        try_files \\$uri \\$uri/ /index.html;
    }
}
NGINX_EOF
}

if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  write_nginx_https
else
  write_nginx_http_only
fi

ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
nginx -t
systemctl enable nginx
systemctl reload nginx

echo "==> nginx local smoke test"
curl -sf -H "Host: $DOMAIN" "http://127.0.0.1/" >/dev/null
echo "OK http://127.0.0.1/ (Host: $DOMAIN)"

SERVER_IP=$(curl -4 -fsS https://ifconfig.me 2>/dev/null || curl -4 -fsS https://api.ipify.org)
DOMAIN_IP=$(dig +short "$DOMAIN" A 2>/dev/null | grep -E '^[0-9.]+$' | tail -n1 || true)
echo "==> DNS: $DOMAIN -> \${DOMAIN_IP:-<none>}, server public IP: $SERVER_IP"

if [ "$SKIP_CERT" = "1" ]; then
  echo "SKIP certbot (--skip-cert)"
elif [ -z "$DOMAIN_IP" ] || [ "$DOMAIN_IP" != "$SERVER_IP" ]; then
  echo ""
  echo "WARN: 公网 DNS 未指向本机，跳过 certbot（静态站已部署在 HTTP）"
  echo "  1. DNSPod：$DOMAIN 的 A 记录 -> $SERVER_IP"
  echo "  2. 关闭 DNSPod「违规拦截 / 网站封禁」等（否则会返回 dnspod.qcloud.com/webblock）"
  echo "  3. 生效后 SSH 执行: certbot --nginx -d $DOMAIN"
  echo ""
  SKIP_CERT=1
fi

install_cert_acme_alpn() {
  if [ ! -x /root/.acme.sh/acme.sh ]; then
    curl -fsSL https://get.acme.sh | sh -s email="$EMAIL"
  fi
  echo "==> acme.sh TLS-ALPN（绕过 DNSPod HTTP 拦截）"
  systemctl stop nginx
  /root/.acme.sh/acme.sh --issue -d "$DOMAIN" --alpn --server letsencrypt --force
  mkdir -p "/etc/letsencrypt/live/$DOMAIN"
  /root/.acme.sh/acme.sh --install-cert -d "$DOMAIN" --ecc \
    --key-file "/etc/letsencrypt/live/$DOMAIN/privkey.pem" \
    --fullchain-file "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" \
    --reloadcmd "systemctl reload nginx"
  systemctl start nginx
  write_nginx_https
  nginx -t && systemctl reload nginx
}

if [ "$SKIP_CERT" != "1" ]; then
  if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "SKIP certbot（已有证书: /etc/letsencrypt/live/$DOMAIN）"
  elif certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect 2>/dev/null; then
    echo "OK certbot"
  else
    echo "WARN: certbot 失败，尝试 acme.sh TLS-ALPN..."
    install_cert_acme_alpn || echo "WARN: 证书申请失败，可手动: bash deploy/install-catbuddy-ssl.sh"
  fi
fi

echo "==> HTTP check"
if curl -sf "http://$DOMAIN/" >/dev/null; then
  echo "OK http://$DOMAIN/"
else
  echo "HTTP check pending (DNS 传播中或未指向本机)"
fi

echo "==> HTTPS check"
if curl -sf "https://$DOMAIN/" >/dev/null; then
  echo "OK https://$DOMAIN/"
else
  echo "HTTPS pending — 修复 DNS 后运行 certbot"
fi
`
  fs.writeFileSync(outPath, sh, 'utf8')
}

function main() {
  const configArg = process.argv.includes('--config')
    ? process.argv[process.argv.indexOf('--config') + 1]
    : ''
  const skipBuild = process.argv.includes('--skip-build')
  const skipCert = process.argv.includes('--skip-cert')
  const withDesktop = process.argv.includes('--with-desktop')

  const root = findRoot()
  process.chdir(root)
  const cfg = loadConfig(configArg)
  if (!cfg.host) fail('deploy.config.json 缺少 host')

  log('root', root)
  log('target', `https://${cfg.webDomain}`)

  const distDir = path.join(root, 'apps', 'web', 'dist')
  if (!skipBuild) {
    run(withDesktop ? 'pnpm build:release' : 'pnpm build:web', root)
  }
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    fail('未找到 apps/web/dist/index.html，请先 pnpm build:web')
  }

  const outDir = path.join(DEPLOY_DIR, 'dist-web')
  fs.mkdirSync(outDir, { recursive: true })
  const tarPath = path.join(outDir, TAR_NAME)
  const remoteScript = path.join(outDir, 'remote-web-deploy.sh')

  if (fs.existsSync(tarPath)) fs.unlinkSync(tarPath)
  log('pack', `tar.gz apps/web/dist → ${TAR_NAME}`)
  run(`tar -czf "${tarPath}" -C apps/web dist`, root)
  const { size: tarSize } = fs.statSync(tarPath)
  log('pack', `archive ${formatBytes(tarSize)}`)

  writeRemoteScript(remoteScript, cfg, { skipCert })

  sshRun(cfg, `mkdir -p ${cfg.webRemoteDir}`)
  scpFile(cfg, tarPath, `${cfg.webRemoteDir}/${TAR_NAME}`)
  scpFile(cfg, remoteScript, `${cfg.webRemoteDir}/remote-web-deploy.sh`)
  sshRun(cfg, `chmod +x ${cfg.webRemoteDir}/remote-web-deploy.sh && ${cfg.webRemoteDir}/remote-web-deploy.sh`)

  log('done', skipCert ? `http://${cfg.webDomain}/ (未申请证书)` : `https://${cfg.webDomain}/`)
  console.log('\n[web-deploy] 完成')
}

main()
