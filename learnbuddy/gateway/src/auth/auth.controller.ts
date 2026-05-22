import { Body, Controller, Post } from '@nestjs/common'
import { IsEmail, IsString, Length, MinLength } from 'class-validator'
import { AuthService } from './auth.service'

class EmailPasswordDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(8)
  @Length(8, 128)
  password!: string
}

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

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() body: EmailPasswordDto) {
    return this.auth.registerWithPassword(body.email, body.password)
  }

  @Post('login')
  login(@Body() body: EmailPasswordDto) {
    return this.auth.loginWithPassword(body.email, body.password)
  }

  /** @deprecated OTP flow — prefer password login */
  @Post('email/request-code')
  requestCode(@Body() body: RequestCodeDto) {
    return this.auth.requestEmailCode(body.email)
  }

  /** @deprecated OTP flow — prefer password login */
  @Post('email/verify')
  verify(@Body() body: VerifyCodeDto) {
    return this.auth.verifyEmailCode(body.email, body.code)
  }
}
