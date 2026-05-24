#!/usr/bin/env node
/**
 * 清空 Gateway MySQL 中的注册用户 / 会话，便于重新测试。
 *
 * 用法（在 catbuddy/gateway 目录）:
 *   node scripts/clear-auth-users.mjs
 *   node scripts/clear-auth-users.mjs --email you@example.com
 *   node scripts/clear-auth-users.mjs --sessions
 *   node scripts/clear-auth-users.mjs --email you@example.com --sessions
 *
 * 建议先停止 Gateway（pnpm start），否则内存里可能仍有待验证的注册记录；
 * 重启 Gateway 后 pending 注册也会清空。
 */
import mysql from 'mysql2/promise'
import { loadGatewayEnvFiles, resolveMysqlConfig } from './load-env.mjs'

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
  --sessions       同时清空 gateway_sessions / gateway_session_messages
  --dry-run        只打印将执行的操作，不写入数据库
  -h, --help       显示此说明

pnpm 快捷: pnpm run clear:users`)
  process.exit(0)
}

const mysqlCfg = resolveMysqlConfig()
const dbLabel =
  'url' in mysqlCfg
    ? '(DATABASE_URL)'
    : `${mysqlCfg.host}:${mysqlCfg.port}/${mysqlCfg.database}`

async function createPool() {
  return 'url' in mysqlCfg ? mysql.createPool(mysqlCfg.url) : mysql.createPool(mysqlCfg)
}

async function clearUsers(pool) {
  if (onlyEmail) {
    const [rows] = await pool.execute(
      'SELECT email FROM gateway_users WHERE email = ? LIMIT 1',
      [onlyEmail],
    )
    if (!rows.length) {
      console.log(`[clear] 未找到注册邮箱: ${onlyEmail}`)
      return 0
    }
    if (dryRun) {
      console.log(`[dry-run] 将删除用户: ${onlyEmail}`)
      return 1
    }
    const [result] = await pool.execute('DELETE FROM gateway_users WHERE email = ?', [
      onlyEmail,
    ])
    console.log(`[clear] 已删除用户: ${onlyEmail}`)
    return result.affectedRows ?? 1
  }

  const [rows] = await pool.execute('SELECT email FROM gateway_users')
  if (!rows.length) {
    console.log('[clear] gateway_users 已为空')
    return 0
  }
  if (dryRun) {
    console.log(`[dry-run] 将删除 ${rows.length} 个用户:`)
    for (const r of rows) console.log(`  - ${r.email}`)
    return rows.length
  }
  await pool.execute('TRUNCATE TABLE gateway_users')
  console.log(`[clear] 已清空 ${rows.length} 个注册用户:`)
  for (const r of rows) console.log(`  - ${r.email}`)
  return rows.length
}

async function clearSessions(pool) {
  const [sessionRows] = await pool.execute(
    'SELECT COUNT(*) AS n FROM gateway_sessions',
  )
  const count = Number(sessionRows[0]?.n ?? 0)
  if (count === 0) {
    console.log('[clear] 会话表已为空')
    return 0
  }
  if (dryRun) {
    console.log(`[dry-run] 将清空 ${count} 条会话及关联消息`)
    return count
  }
  await pool.execute('SET FOREIGN_KEY_CHECKS = 0')
  await pool.execute('TRUNCATE TABLE gateway_session_messages')
  await pool.execute('TRUNCATE TABLE gateway_sessions')
  await pool.execute('SET FOREIGN_KEY_CHECKS = 1')
  console.log(`[clear] 已清空 ${count} 条会话及关联消息`)
  return count
}

console.log('[clear] Gateway MySQL')
console.log(`  ${dbLabel}`)
console.log('')

const pool = await createPool()
try {
  const userCount = await clearUsers(pool)
  let sessionCount = 0
  if (clearSessions) sessionCount = await clearSessions(pool)

  console.log('')
  if (dryRun) {
    console.log('[dry-run] 未修改数据库')
  } else {
    console.log('[clear] 完成。请在浏览器/桌面清除本地 token（或退出登录）后重新注册。')
    if (userCount === 0 && (!clearSessions || sessionCount === 0)) {
      console.log('[clear] 没有需要清理的内容。')
    }
  }
} finally {
  await pool.end()
}
