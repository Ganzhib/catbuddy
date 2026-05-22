import { Module } from '@nestjs/common'
import { GatewayModule } from './gateway/gateway.module'
import { StorageModule } from './storage/storage.module'

@Module({
  imports: [StorageModule, GatewayModule],
})
export class AppModule {}
