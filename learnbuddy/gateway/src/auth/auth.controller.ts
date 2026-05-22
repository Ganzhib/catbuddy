import { Body, Controller, Post } from '@nestjs/common'
import { IsEmail, IsString, Length } from 'class-validator'
import { AuthService } from './auth.service'

class RequestCodeDto {
  @IsEmail()
  email!: string
}

class VerifyCodeDto {
  @IsEmail()
  email!: string

  @IsString()
  @Length(4, 8)
  code!: string
}

@Controller('auth/email')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('request-code')
  requestCode(@Body() body: RequestCodeDto) {
    return this.auth.requestEmailCode(body.email)
  }

  @Post('verify')
  verify(@Body() body: VerifyCodeDto) {
    return this.auth.verifyEmailCode(body.email, body.code)
  }
}
