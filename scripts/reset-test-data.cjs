#!/usr/bin/env node
'use strict'

const { execFileSync, execSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const GATEWAY_COMPOSE = path.join(ROOT, 'gateway', 'docker-compose.yml')
const ENV_PROD = path.join(ROOT, '.env.production')
const DEPLOY_CONFIG = path.join(ROOT, 'deploy', 'deploy.config.json')

function log(message) {
  console.log(`[reset-test-data] ${message}`)
}

function fail(message) {
  console.error(`[reset-test-data] ERROR: ${message}`)
  process.exit(1)
}

function run(command, args, opts = {}) {
  log(`${command} ${args.join(' ')}`)
  execFileSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    ...opts,
  })
}

function runShell(command, opts = {}) {
  log(command)
  execSync(command, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    ...opts,
  })
}

function exists(file) {
  return fs.existsSync(file)
}

function rmDir(dir) {
  if (!exists(dir)) return
  log(`remove ${dir}`)
  fs.rmSync(dir, { recursive: true, force: true })
}

function killLocalDesktopProcesses() {
  if (process.platform === 'win32') {
    for (const image of ['catbuddy.exe', 'electron.exe']) {
      try {
        run('taskkill', ['/F', '/IM', image], { stdio: 'ignore' })
      } catch {
        log(`${image} not running`)
      }
    }
    return
  }

  for (const name of ['catbuddy', 'electron']) {
    try {
      run('pkill', ['-f', name], { stdio: 'ignore' })
    } catch {
      log(`${name} not running`)
    }
  }
}

function resetDesktop() {
  killLocalDesktopProcesses()
  rmDir(path.join(os.homedir(), '.catbuddy'))
  rmDir(path.join(ROOT, '.catbuddy'))
}

function localComposeArgs() {
  const args = ['compose', '-f', GATEWAY_COMPOSE]
  if (exists(ENV_PROD)) args.push('--env-file', ENV_PROD)
  return args
}

function resetLocalGateway() {
  run('docker', [...localComposeArgs(), 'down', '-v'])
  try {
    run('docker', ['volume', 'rm', 'gateway_gateway_mysql_data'], { stdio: 'ignore' })
  } catch {
    log('gateway_gateway_mysql_data volume already removed')
  }
  run('docker', [...localComposeArgs(), 'up', '-d'])
}

function loadDeployConfig() {
  if (!exists(DEPLOY_CONFIG)) {
    fail('缺少 deploy/deploy.config.json，无法重置线上 Gateway。请先基于 deploy/deploy.config.exmple.json 创建配置。')
  }
  return JSON.parse(fs.readFileSync(DEPLOY_CONFIG, 'utf8'))
}

function sshTarget(config) {
  const host = String(config.host || '').trim()
  if (!host || host === '服务器IP') fail('deploy/deploy.config.json 未配置 host')
  const user = String(config.user || 'root').trim()
  return `${user}@${host}`
}

function sshArgs(config, remoteCommand) {
  const args = []
  if (config.port) args.push('-p', String(config.port))
  if (config.identityFile) args.push('-i', path.resolve(ROOT, config.identityFile))
  args.push(sshTarget(config), remoteCommand)
  return args
}

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

function resetRemoteGateway() {
  const config = loadDeployConfig()
  const remoteDir = config.remoteDir || '/opt/catbuddy/gateway'
  const command = [
    `cd ${shQuote(remoteDir)}`,
    'docker compose --env-file .env.production -f docker-compose.yml down -v',
    '(docker volume rm gateway_gateway_mysql_data 2>/dev/null || true)',
    'docker compose --env-file .env.production -f docker-compose.yml up -d',
  ].join(' && ')
  run('ssh', sshArgs(config, command))
}

function printHelp() {
  console.log(`Usage: node scripts/reset-test-data.cjs <target>\n\nTargets:\n  desktop          清空本机 Desktop 数据（~/.catbuddy 和项目 .catbuddy）\n  gateway:local    清空本地 Docker Gateway/MySQL 数据并重启\n  gateway:remote   按 deploy/deploy.config.json 清空线上 Gateway/MySQL 数据并重启\n  local            desktop + gateway:local\n  all              desktop + gateway:local + gateway:remote\n`)
}

const target = process.argv[2] || 'local'

if (target === '-h' || target === '--help') {
  printHelp()
  process.exit(0)
}

switch (target) {
  case 'desktop':
    resetDesktop()
    break
  case 'gateway:local':
    resetLocalGateway()
    break
  case 'gateway:remote':
    resetRemoteGateway()
    break
  case 'local':
    resetDesktop()
    resetLocalGateway()
    break
  case 'all':
    resetDesktop()
    resetLocalGateway()
    resetRemoteGateway()
    break
  default:
    printHelp()
    fail(`未知目标: ${target}`)
}

log('done')
