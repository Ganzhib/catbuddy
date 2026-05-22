import './load-env'
import 'reflect-metadata'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { WsAdapter } from '@nestjs/platform-ws'
import { AppModule } from './app.module'
import { gatewayEnv } from './config/env'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true })
  app.useWebSocketAdapter(new WsAdapter(app))
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  await app.listen(gatewayEnv.port)
  console.log(
    `[gateway] http://127.0.0.1:${gatewayEnv.port}  ws://127.0.0.1:${gatewayEnv.port}/ws`,
  )
  console.log(`[gateway] bootstrap path ${gatewayEnv.publicWsPath}`)
  console.log(
    `[gateway] GATEWAY_SECRET=${gatewayEnv.executorSecret ? '(set)' : '(default)'}`,
  )
  const envPath = path.join(__dirname, '..', '.env')
  console.log(
    `[gateway] env: gateway/.env ${fs.existsSync(envPath) ? '(loaded)' : '(missing — copy .env.example)'}`,
  )
  const db = gatewayEnv.databaseUrl
    ? '(DATABASE_URL)'
    : `${gatewayEnv.mysql.host}:${gatewayEnv.mysql.port}/${gatewayEnv.mysql.database}`
  console.log(`[gateway] storage=mysql ${db}`)
  if (gatewayEnv.smtpHost && gatewayEnv.smtpUser && gatewayEnv.smtpPass) {
    const mode = gatewayEnv.smtpPort === 465 || gatewayEnv.smtpSecure === 'true' ? 'SSL' : 'STARTTLS'
    console.log(
      `[gateway] SMTP=${gatewayEnv.smtpHost}:${gatewayEnv.smtpPort} (${mode}, registration codes sent by email)`,
    )
  } else {
    console.log(
      '[gateway] SMTP not configured — registration OTP prints HERE only (set SMTP_* in gateway/.env)',
    )
  }
}

bootstrap().catch((err) => {
  console.error('[gateway] failed to start', err)
  process.exit(1)
})
