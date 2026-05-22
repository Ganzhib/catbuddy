import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { gatewayEnv } from '../config/env'
import { GatewayCoreModule } from '../gateway/gateway-core.module'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { EmailService } from './email.service'
@Module({
  imports: [
    GatewayCoreModule,
    JwtModule.register({
      secret: gatewayEnv.jwtSecret,
      signOptions: { expiresIn: gatewayEnv.jwtExpiresIn },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, EmailService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
