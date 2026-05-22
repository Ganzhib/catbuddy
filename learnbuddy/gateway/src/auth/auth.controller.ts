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

  /** Register step 1: send email verification code (account created after verify). */
  @Post('register')
  register(@Body() body: EmailPasswordDto) {
    return this.auth.startRegistration(body.email, body.password)
  }

  /** Register step 2: verify code → create account and return JWT. */
  @Post('register/verify')
  registerVerify(@Body() body: VerifyCodeDto) {
    return this.auth.verifyRegistration(body.email, body.code)
  }

  @Post('login')
  login(@Body() body: EmailPasswordDto) {
    return this.auth.loginWithPassword(body.email, body.password)
  }

  /** Resend registration OTP (same body as register). */
  @Post('email/request-code')
  requestCode(@Body() body: RequestCodeDto) {
    return this.auth.requestEmailCode(body.email)
  }

  /** Alias of register/verify for older clients. */
  @Post('email/verify')
  verify(@Body() body: VerifyCodeDto) {
    return this.auth.verifyRegistration(body.email, body.code)
  }
}
