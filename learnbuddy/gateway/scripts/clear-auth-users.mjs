#!/usr/bin/env node
/**
 * 清空 Gateway 注册账号（users.json），便于重新注册测试。
 *
 * 用法（在 learnbuddy/gateway 目录）:
 *   node scripts/clear-auth-users.mjs
 *   node scripts/clear-auth-users.mjs --email you@example.com
 *   node scripts/clear-auth-users.mjs --sessions
 *   node scripts/clear-auth-users.mjs --email you@example.com --sessions
 *
 * 建议先停止 Gateway（pnpm start），否则内存里可能仍有待验证的注册记录；
 * 重启 Gateway 后 pending 注册也会清空。
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { loadGatewayEnvFiles, resolveGatewayDataPaths } from './load-env.mjs'

loadGatewayEnvFiles()

const args = process.argv.slice(2)
const emailFlag = args.indexOf('--email')
const onlyEmail =
  emailFlag >= 0 && args[emailFlag + 1]
    ? args[emailFlag + 1].trim().toLowerCase()
    : ''
const clearSessions = args.includes('--sessions')
const dryRun = args.includes('--dry-run')

if (args.includes('--help') || args.includes('-h')) {
  console.log(`用法: node scripts/clear-auth-users.mjs [选项]

选项:
  --email <addr>   只删除指定邮箱（默认删除全部注册用户）
  --sessions       同时删除 Gateway 会话 JSONL（workspace/sessions）
  --dry-run        只打印将删除的内容，不写入磁盘
  -h, --help       显示此说明

pnpm 快捷: pnpm run clear:users`)
  process.exit(0)
}

const { usersFile, sessionsDir, dataDir } = resolveGatewayDataPaths()

function clearUsers() {
  if (!fs.existsSync(usersFile)) {
    console.log(`[clear] 无 users.json: ${usersFile}`)
    return 0
  }

  let data
  try {
    data = JSON.parse(fs.readFileSync(usersFile, 'utf-8'))
  } catch (err) {
    console.error(`[clear] 无法解析 ${usersFile}:`, err instanceof Error ? err.message : err)
    process.exit(1)
  }

  const users = data?.users && typeof data.users === 'object' ? data.users : {}
  const keys = Object.keys(users)

  if (onlyEmail) {
    if (!users[onlyEmail]) {
      console.log(`[clear] 未找到注册邮箱: ${onlyEmail}`)
      return 0
    }
    if (dryRun) {
      console.log(`[dry-run] 将删除用户: ${onlyEmail}`)
      return 1
    }
    delete users[onlyEmail]
    const tmp = `${usersFile}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify({ users }, null, 2), 'utf-8')
    fs.renameSync(tmp, usersFile)
    console.log(`[clear] 已删除用户: ${onlyEmail}`)
    return 1
  }

  if (keys.length === 0) {
    console.log(`[clear] users.json 已为空: ${usersFile}`)
    return 0
  }

  if (dryRun) {
    console.log(`[dry-run] 将删除 ${keys.length} 个用户:`)
    for (const k of keys) console.log(`  - ${k}`)
    return keys.length
  }

  const tmp = `${usersFile}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify({ users: {} }, null, 2), 'utf-8')
  fs.renameSync(tmp, usersFile)
  console.log(`[clear] 已清空 ${keys.length} 个注册用户:`)
  for (const k of keys) console.log(`  - ${k}`)
  return keys.length
}

function clearSessionFiles() {
  if (!fs.existsSync(sessionsDir)) {
    console.log(`[clear] 无会话目录: ${sessionsDir}`)
    return 0
  }

  const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith('.jsonl'))
  if (files.length === 0) {
    console.log(`[clear] 会话目录已空: ${sessionsDir}`)
    return 0
  }

  if (dryRun) {
    console.log(`[dry-run] 将删除 ${files.length} 个会话文件 (${sessionsDir})`)
    return files.length
  }

  for (const f of files) {
    fs.unlinkSync(path.join(sessionsDir, f))
  }
  console.log(`[clear] 已删除 ${files.length} 个会话文件: ${sessionsDir}`)
  return files.length
}

console.log('[clear] Gateway 数据路径')
console.log(`  GATEWAY_DATA_DIR: ${dataDir ?? '(默认 ~/.learnbuddy-gateway)'} `)
console.log(`  users.json:       ${usersFile}`)
if (clearSessions) console.log(`  sessions:         ${sessionsDir}`)
console.log('')

const userCount = clearUsers()
let sessionCount = 0
if (clearSessions) sessionCount = clearSessionFiles()

console.log('')
if (dryRun) {
  console.log('[dry-run] 未修改任何文件')
} else {
  console.log('[clear] 完成。请在浏览器/桌面清除本地 token（或退出登录）后重新注册。')
  if (userCount === 0 && (!clearSessions || sessionCount === 0)) {
    console.log('[clear] 没有需要清理的内容。')
  }
}
