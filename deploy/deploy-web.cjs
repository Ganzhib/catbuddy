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
const TAR_NAME = 'catbuddy-web.tar'

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
  log('ssh', `${cfg.user}@${cfg.host}`)
  const r = spawnSync('ssh', [...sshArgs(cfg), remoteCmd], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (r.status !== 0) fail(`ssh 失败 (code ${r.status ?? 'unknown'})`)
}

function scpFile(cfg, local, remote) {
  log('scp', `${path.basename(local)} -> ${cfg.user}@${cfg.host}:${remote}`)
  const r = spawnSync('scp', [...scpArgs(cfg), local, `${cfg.user}@${cfg.host}:${remote}`], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (r.status !== 0) fail(`scp 失败: ${local}`)
}

function writeRemoteScript(outPath, cfg) {
  const domain = cfg.webDomain
  const remoteDir = cfg.webRemoteDir
  const email = cfg.certEmail
  if (!email) fail('deploy.config.json 缺少 certEmail')

  const sh = `#!/bin/bash
set -euo pipefail

DOMAIN=${JSON.stringify(domain)}
REMOTE=${JSON.stringify(remoteDir)}
EMAIL=${JSON.stringify(email)}

mkdir -p "$REMOTE"
cd "$REMOTE"
tar xf ${TAR_NAME}
rm -f ${TAR_NAME}

if ! command -v nginx >/dev/null 2>&1; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx
fi

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

ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
nginx -t
systemctl enable nginx
systemctl reload nginx

certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL --redirect

echo "==> HTTPS check"
curl -sf "https://$DOMAIN/" >/dev/null && echo "OK https://$DOMAIN/" || (echo "HTTPS check failed"; exit 1)
`
  fs.writeFileSync(outPath, sh, 'utf8')
}

function main() {
  const configArg = process.argv.includes('--config')
    ? process.argv[process.argv.indexOf('--config') + 1]
    : ''
  const skipBuild = process.argv.includes('--skip-build')
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
  run(`tar -cf "${tarPath}" -C apps/web dist`, root)

  writeRemoteScript(remoteScript, cfg)

  sshRun(cfg, `mkdir -p ${cfg.webRemoteDir}`)
  scpFile(cfg, tarPath, `${cfg.webRemoteDir}/${TAR_NAME}`)
  scpFile(cfg, remoteScript, `${cfg.webRemoteDir}/remote-web-deploy.sh`)
  sshRun(cfg, `chmod +x ${cfg.webRemoteDir}/remote-web-deploy.sh && ${cfg.webRemoteDir}/remote-web-deploy.sh`)

  log('done', `https://${cfg.webDomain}/`)
  console.log('\n[web-deploy] 完成')
}

main()
