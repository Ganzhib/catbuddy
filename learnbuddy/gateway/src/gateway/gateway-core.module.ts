import { Global, Module } from '@nestjs/common'
import { GatewayStateService } from './gateway-state.service'

@Global()
@Module({
  providers: [GatewayStateService],
  exports: [GatewayStateService],
})
export class GatewayCoreModule {}
