import './load-env.js'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from '@fastify/cors'
import Fastify from 'fastify'
import { WebSocketServer } from 'ws'
import { createGatewayServices } from './create-services.js'
import { registerHttpRoutes } from './http-routes.js'
import { gatewayEnv } from './session/config/env.js'
import { isWebLoginRequired } from './session/auth/auth-policy.js'
import { attachGatewaySessionWebSocket } from './ws-session.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const gatewayRoot = path.resolve(__dirname, '../../..')

async function main() {
  const { pool, state, auth } = await createGatewayServices()

  const app = Fastify({ logger: true })
  await app.register(cors, { origin: true })
  registerHttpRoutes(app, state, auth)

  const port = gatewayEnv.port
  await app.listen({ port, host: '0.0.0.0' })
  const wss = new WebSocketServer({ server: app.server, path: '/ws' })
  attachGatewaySessionWebSocket(wss, state, auth, (msg) => app.log.info(msg))

  console.log(`[gateway] http://127.0.0.1:${port}  ws://127.0.0.1:${port}/ws`)
  console.log(`[gateway] bootstrap path ${gatewayEnv.publicWsPath}`)
  console.log(`[gateway] GATEWAY_SECRET=${gatewayEnv.desktopSecret ? '(set)' : '(default)'}`)
  console.log(
    `[gateway] auth require_email=${gatewayEnv.authRequireEmail} dev_bypass=${gatewayEnv.authDevBypass} `
    + `web_login_required=${isWebLoginRequired()}`,
  )
  const envPath = path.join(gatewayRoot, '.env')
  console.log(
    `[gateway] env: gateway/.env ${fs.existsSync(envPath) ? '(loaded)' : '(missing — copy .env.example)'}`,
  )
  const db = gatewayEnv.databaseUrl
    ? '(DATABASE_URL)'
    : `${gatewayEnv.mysql.host}:${gatewayEnv.mysql.port}/${gatewayEnv.mysql.database}`
  console.log(`[gateway] storage=mysql ${db}`)
  if (gatewayEnv.smtpHost && gatewayEnv.smtpUser && gatewayEnv.smtpPass) {
    const mode =
      gatewayEnv.smtpPort === 465 || gatewayEnv.smtpSecure === 'true' ? 'SSL' : 'STARTTLS'
    console.log(
      `[gateway] SMTP=${gatewayEnv.smtpHost}:${gatewayEnv.smtpPort} (${mode}, registration codes sent by email)`,
    )
  } else {
    console.log(
      '[gateway] SMTP 未配置 — 注册验证码不会发邮件，仅打印在本终端（请复制 gateway/.env.example → gateway/.env 并填写 SMTP_*）',
    )
  }

  const shutdown = async () => {
    wss.close()
    await app.close()
    await pool.close()
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown())
  process.on('SIGTERM', () => void shutdown())
}

main().catch((err) => {
  console.error('[gateway] failed to start', err)
  process.exit(1)
})
