import './load-env.js'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from '@fastify/cors'
import Fastify from 'fastify'
import { WebSocketServer } from 'ws'
import { createGatewayServices } from './create-services.js'
import { registerHttpRoutes } from './http-routes.js'
import { gatewayEnv } from './relay/config/env.js'
import { attachRelayWebSocket } from './ws-relay.js'

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
  attachRelayWebSocket(wss, state, (msg) => app.log.info(msg))

  console.log(`[gateway] http://127.0.0.1:${port}  ws://127.0.0.1:${port}/ws`)
  console.log(`[gateway] bootstrap path ${gatewayEnv.publicWsPath}`)
  console.log(`[gateway] GATEWAY_SECRET=${gatewayEnv.executorSecret ? '(set)' : '(default)'}`)
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
      '[gateway] SMTP not configured — registration OTP prints HERE only (set SMTP_* in gateway/.env)',
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
