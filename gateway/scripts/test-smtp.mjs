#!/usr/bin/env node
/**
 * 测试根目录 `.env` 中的 SMTP 能否发信。
 * 用法: node scripts/test-smtp.mjs you@example.com
 */
import nodemailer from 'nodemailer'
import { loadGatewayEnvFiles } from './load-env.mjs'

loadGatewayEnvFiles()

const to = process.argv[2]?.trim()
if (!to || !to.includes('@')) {
  console.error('用法: node scripts/test-smtp.mjs <收件邮箱>')
  process.exit(1)
}

const host = process.env.SMTP_HOST || ''
const port = Number(process.env.SMTP_PORT || 587)
const user = process.env.SMTP_USER || ''
const pass = process.env.SMTP_PASS || ''
const from = process.env.SMTP_FROM || `catbuddy <${user}>`
const secureRaw = (process.env.SMTP_SECURE || '').trim().toLowerCase()
const secure =
  secureRaw === 'true' || secureRaw === '1'
    ? true
    : secureRaw === 'false' || secureRaw === '0'
      ? false
      : port === 465

if (!host || !user || !pass) {
  console.error('[smtp-test] 请在根目录 .env 配置 SMTP_HOST、SMTP_USER、SMTP_PASS')
  process.exit(1)
}

const transport = nodemailer.createTransport({
  host,
  port,
  secure,
  requireTLS: !secure && port === 587,
  auth: { user, pass },
})

const code = String(Math.floor(100000 + Math.random() * 900000))

try {
  await transport.verify()
  console.log(`[smtp-test] 连接 ${host}:${port} OK (${secure ? 'SSL' : 'STARTTLS'})`)
  const info = await transport.sendMail({
    from,
    to,
    subject: 'catbuddy SMTP 测试',
    text: `测试验证码：${code}\n若收到此邮件，注册验证码邮件配置正确。`,
  })
  console.log(`[smtp-test] 已发送至 ${to} messageId=${info.messageId}`)
} catch (err) {
  console.error('[smtp-test] 发送失败:', err instanceof Error ? err.message : err)
  process.exit(1)
}
