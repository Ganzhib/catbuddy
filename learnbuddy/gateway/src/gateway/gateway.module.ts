import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { GatewayRelayController } from './gateway-relay.controller'
import { GatewayShimController } from './gateway-shim.controller'
import { GatewayCoreModule } from './gateway-core.module'
import { GatewayWsGateway } from './gateway-ws.gateway'

@Module({
  imports: [GatewayCoreModule, AuthModule],
  controllers: [GatewayRelayController, GatewayShimController],
  providers: [GatewayWsGateway],
})
export class GatewayModule {}
