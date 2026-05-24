/**
 * Run from repo: pnpm exec node gateway/scripts/test-smtp-run.mjs [to-email]
 * Uses repo root `.env` (loads via load-env.mjs).
 */
import nodemailer from 'nodemailer'
import { loadGatewayEnvFiles } from './load-env.mjs'

loadGatewayEnvFiles()

const to = process.argv[2]?.trim() || process.env.SMTP_USER
const host = process.env.SMTP_HOST || ''
const port = Number(process.env.SMTP_PORT || 587)
const user = process.env.SMTP_USER || ''
const pass = process.env.SMTP_PASS || ''
const from = process.env.SMTP_FROM || user
const secureRaw = (process.env.SMTP_SECURE || '').trim().toLowerCase()
const secure =
  secureRaw === 'true' || secureRaw === '1'
    ? true
    : secureRaw === 'false' || secureRaw === '0'
      ? false
      : port === 465

if (!host || !user || !pass) {
  console.error('[smtp-test] 请配置根目录 .env: SMTP_HOST, SMTP_USER, SMTP_PASS')
  process.exit(1)
}

console.log(`[smtp-test] ${host}:${port} secure=${secure} user=${user} from=${from}`)

const transport = nodemailer.createTransport({
  host,
  port,
  secure,
  requireTLS: !secure && port === 587,
  auth: { user, pass },
  connectionTimeout: 20_000,
  greetingTimeout: 20_000,
  tls: { servername: host },
})

try {
  await transport.verify()
  console.log('[smtp-test] 连接成功')
  const info = await transport.sendMail({
    from,
    to,
    subject: 'catbuddy SMTP 测试',
    text: '若收到此邮件，SMTP 配置正确。',
  })
  console.log(`[smtp-test] 已发送至 ${to} messageId=${info.messageId}`)
} catch (err) {
  console.error('[smtp-test] 失败:', err instanceof Error ? err.message : err)
  if (err && typeof err === 'object' && 'code' in err) console.error('[smtp-test] code:', err.code)
  if (err && typeof err === 'object' && 'response' in err) console.error('[smtp-test] response:', err.response)
  process.exit(1)
}
