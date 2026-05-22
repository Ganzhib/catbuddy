import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { randomInt } from 'node:crypto'
import { gatewayEnv } from '../config/env'
import { GatewayStateService } from '../gateway/gateway-state.service'
import { isDevAuthBypass, isViewerLoginRequired } from './auth-policy'
import { EmailService } from './email.service'
import { hashPassword, isPasswordStrongEnough, verifyPassword } from './password.util'
import { UserStore } from './user-store'

interface PendingRegistration {
  code: string
  expiresAt: number
  passwordHash: string
}

export interface JwtViewerPayload {
  sub: string
  role: 'viewer'
  typ: 'gateway_viewer' | 'relay_viewer'
}

@Injectable()
export class AuthService {
  private readonly pendingRegisterByEmail = new Map<string, PendingRegistration>()

  constructor(
    private readonly jwt: JwtService,
    private readonly email: EmailService,
    private readonly gateway: GatewayStateService,
    private readonly users: UserStore,
  ) {}

  isEmailAuthRequired(): boolean {
    return isViewerLoginRequired()
  }

  loginRequiredException(): UnauthorizedException {
    return new UnauthorizedException({
      ok: false,
      requires_auth: true,
      gateway_mode: 'gateway',
    })
  }

  /** Resolve bearer for protected HTTP routes (bootstrap excluded). */
  async resolveViewerToken(authorization?: string): Promise<string> {
    const bearer = this.extractBearer(authorization)
    if (!bearer) {
      if (isViewerLoginRequired()) throw this.loginRequiredException()
      throw new UnauthorizedException({ ok: false, error: 'unauthorized' })
    }
    if (this.gateway.isViewerAuthorized(bearer)) return bearer
    if (await this.registerTokenFromJwt(bearer)) return bearer
    if (isViewerLoginRequired()) throw this.loginRequiredException()
    throw new UnauthorizedException({ ok: false, error: 'unauthorized' })
  }

  /** Bootstrap: JWT when login required; dev viewer token only when bypass enabled. */
  async resolveBootstrapToken(
    authorization?: string,
    secret?: string,
  ): Promise<string> {
    if (isViewerLoginRequired()) {
      const bearer = this.extractBearer(authorization)
      if (!bearer || !(await this.registerTokenFromJwt(bearer))) {
        throw this.loginRequiredException()
      }
      this.gateway.registerViewerToken(bearer)
      return bearer
    }
    const token = secret?.trim() || gatewayEnv.devViewerToken
    this.gateway.registerViewerToken(token)
    return token
  }

  async requestEmailCode(email: string): Promise<{ ok: true; expiresIn: number }> {
    const normalized = this.normalizeEmail(email)
    const pending = this.pendingRegisterByEmail.get(normalized)
    if (!pending) {
      throw new UnauthorizedException('no_pending_registration')
    }
    const code = String(randomInt(100_000, 999_999))
    pending.code = code
    pending.expiresAt = Date.now() + gatewayEnv.otpTtlMs
    this.pendingRegisterByEmail.set(normalized, pending)
    await this.email.sendOtp(normalized, code)
    return { ok: true, expiresIn: Math.floor(gatewayEnv.otpTtlMs / 1000) }
  }

  private normalizeEmail(email: string): string {
    const normalized = email.trim().toLowerCase()
    if (!normalized.includes('@')) {
      throw new UnauthorizedException('invalid_email')
    }
    return normalized
  }

  private async issueViewerToken(
    email: string,
  ): Promise<{ access_token: string; token_type: string; expires_in: number; email: string }> {
    const access_token = await this.jwt.signAsync({
      sub: email,
      role: 'viewer',
      typ: 'gateway_viewer',
    } satisfies JwtViewerPayload)
    this.gateway.registerViewerToken(access_token, email)
    const expires_in = 7 * 24 * 3600
    return { access_token, token_type: 'bearer', expires_in, email }
  }

  /** Step 1: validate password, send email OTP; account created after verify. */
  async startRegistration(
    email: string,
    password: string,
  ): Promise<{ ok: true; expiresIn: number }> {
    const normalized = this.normalizeEmail(email)
    if (!isPasswordStrongEnough(password)) {
      throw new UnauthorizedException('weak_password')
    }
    if (this.users.findByEmail(normalized)) {
      throw new ConflictException('email_taken')
    }
    const code = String(randomInt(100_000, 999_999))
    const passwordHash = await hashPassword(password)
    this.pendingRegisterByEmail.set(normalized, {
      code,
      expiresAt: Date.now() + gatewayEnv.otpTtlMs,
      passwordHash,
    })
    await this.email.sendOtp(normalized, code)
    return { ok: true, expiresIn: Math.floor(gatewayEnv.otpTtlMs / 1000) }
  }

  /** Step 2: verify OTP, create account, issue JWT (auto login). */
  async verifyRegistration(
    email: string,
    code: string,
  ): Promise<{ access_token: string; token_type: string; expires_in: number; email: string }> {
    const normalized = this.normalizeEmail(email)
    const pending = this.pendingRegisterByEmail.get(normalized)
    if (!pending || pending.expiresAt < Date.now()) {
      this.pendingRegisterByEmail.delete(normalized)
      throw new UnauthorizedException('otp_expired')
    }
    if (pending.code !== code.trim()) {
      throw new UnauthorizedException('otp_invalid')
    }
    this.pendingRegisterByEmail.delete(normalized)
    if (this.users.findByEmail(normalized)) {
      throw new ConflictException('email_taken')
    }
    try {
      this.users.create(normalized, pending.passwordHash)
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'email_taken') {
        throw new ConflictException('email_taken')
      }
      throw err
    }
    return this.issueViewerToken(normalized)
  }

  async loginWithPassword(
    email: string,
    password: string,
  ): Promise<{ access_token: string; token_type: string; expires_in: number; email: string }> {
    const normalized = this.normalizeEmail(email)
    const user = this.users.findByEmail(normalized)
    if (!user) {
      throw new UnauthorizedException('account_not_found')
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('invalid_password')
    }
    return this.issueViewerToken(normalized)
  }

  /** @deprecated Use verifyRegistration — OTP login without password is disabled. */
  async verifyEmailCode(
    email: string,
    code: string,
  ): Promise<{ access_token: string; token_type: string; expires_in: number; email: string }> {
    return this.verifyRegistration(email, code)
  }

  async registerTokenFromJwt(token: string): Promise<boolean> {
    try {
      const payload = await this.jwt.verifyAsync<JwtViewerPayload>(token)
      const typ = payload.typ
      if (
        (typ !== 'gateway_viewer' && typ !== 'relay_viewer')
        || payload.role !== 'viewer'
      ) {
        return false
      }
      const email = payload.sub?.trim().toLowerCase()
      this.gateway.registerViewerToken(
        token,
        email?.includes('@') ? email : undefined,
      )
      return true
    } catch {
      return false
    }
  }

  extractBearer(header?: string): string {
    if (!header) return ''
    const m = /^Bearer\s+(.+)$/i.exec(header)
    return m?.[1]?.trim() || ''
  }

  /** Logged-in user id (email from JWT ``sub``). */
  async resolveViewerEmail(authorization?: string): Promise<string> {
    const token = await this.resolveViewerToken(authorization)
    try {
      const payload = await this.jwt.verifyAsync<JwtViewerPayload>(token)
      const email = payload.sub?.trim().toLowerCase()
      if (email?.includes('@')) return email
    } catch {
      /* dev viewer token etc. */
    }
    return 'local-viewer'
  }

  ensureDevViewerRegistered(): void {
    if (isDevAuthBypass() || !isViewerLoginRequired()) {
      this.gateway.registerViewerToken(gatewayEnv.devViewerToken)
    }
  }
}
