import 'reflect-metadata'
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
}

bootstrap().catch((err) => {
  console.error('[gateway] failed to start', err)
  process.exit(1)
})
