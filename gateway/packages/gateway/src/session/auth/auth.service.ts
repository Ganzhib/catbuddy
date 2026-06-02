import { randomInt } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { gatewayEnv } from '../config/env.js'
import type { GatewayStateService } from '../gateway-state.js'
import { isDevAuthBypass, isWebLoginRequired } from './auth-policy.js'
import { EmailService } from './email.service.js'
import { hashPassword, isPasswordStrongEnough, verifyPassword } from './password.util.js'
import type { UserStore } from '../storage/ports/user-store.port.js'
import { HttpError, conflict, unauthorized } from '../../http-errors.js'

interface PendingRegistration {
  code: string
  expiresAt: number
  passwordHash: string
}

export interface JwtWebPayload {
  sub: string
  role: 'web'
  typ: 'gateway_web'
}

export class AuthService {
  private readonly pendingRegisterByEmail = new Map<string, PendingRegistration>()

  constructor(
    private readonly gateway: GatewayStateService,
    private readonly email: EmailService,
    private readonly users: UserStore,
  ) {}

  loginRequiredBody(): Record<string, unknown> {
    return { ok: false, requires_auth: true, gateway_mode: 'gateway' }
  }

  async resolveWebToken(authorization?: string): Promise<string> {
    const bearer = this.extractBearer(authorization)
    if (!bearer) {
      if (isWebLoginRequired()) unauthorized(this.loginRequiredBody())
      unauthorized()
    }
    if (this.gateway.isWebAuthorized(bearer)) return bearer
    if (await this.registerTokenFromJwt(bearer)) return bearer
    if (isWebLoginRequired()) unauthorized(this.loginRequiredBody())
    unauthorized()
  }

  async resolveBootstrapToken(authorization?: string, secret?: string): Promise<string> {
    if (isWebLoginRequired()) {
      const bearer = this.extractBearer(authorization)
      if (!bearer || !(await this.registerTokenFromJwt(bearer))) {
        unauthorized(this.loginRequiredBody())
      }
      this.gateway.registerWebToken(bearer)
      return bearer
    }
    const token = secret?.trim() || gatewayEnv.devWebToken
    this.gateway.registerWebToken(token)
    return token
  }

  async requestEmailCode(
    email: string,
    password?: string,
  ): Promise<{ ok: true; expiresIn: number; delivery: 'email' | 'console' }> {
    const normalized = this.normalizeEmail(email)
    let pending = this.pendingRegisterByEmail.get(normalized)
    if (!pending) {
      if (password?.trim()) {
        return this.startRegistration(normalized, password)
      }
      unauthorized('no_pending_registration')
    }
    const code = String(randomInt(100_000, 999_999))
    pending.code = code
    pending.expiresAt = Date.now() + gatewayEnv.otpTtlMs
    this.pendingRegisterByEmail.set(normalized, pending)
    const delivery = await this.email.sendOtp(normalized, code)
    return {
      ok: true,
      expiresIn: Math.floor(gatewayEnv.otpTtlMs / 1000),
      delivery,
    }
  }

  private normalizeEmail(email: string): string {
    const normalized = email.trim().toLowerCase()
    if (!normalized.includes('@')) unauthorized('invalid_email')
    return normalized
  }

  private async issueWebToken(
    email: string,
  ): Promise<{ access_token: string; token_type: string; expires_in: number; email: string }> {
    const access_token = jwt.sign(
      { sub: email, role: 'web', typ: 'gateway_web' } satisfies JwtWebPayload,
      gatewayEnv.jwtSecret,
      { expiresIn: gatewayEnv.jwtExpiresIn },
    )
    this.gateway.registerWebToken(access_token, email)
    const expires_in = 7 * 24 * 3600
    return { access_token, token_type: 'bearer', expires_in, email }
  }

  async startRegistration(
    email: string,
    password: string,
  ): Promise<{ ok: true; expiresIn: number; delivery: 'email' | 'console' }> {
    const normalized = this.normalizeEmail(email)
    if (!isPasswordStrongEnough(password)) unauthorized('weak_password')
    if (await this.users.findByEmail(normalized)) conflict('email_taken')
    const code = String(randomInt(100_000, 999_999))
    const passwordHash = await hashPassword(password)
    this.pendingRegisterByEmail.set(normalized, {
      code,
      expiresAt: Date.now() + gatewayEnv.otpTtlMs,
      passwordHash,
    })
    const delivery = await this.email.sendOtp(normalized, code)
    return {
      ok: true,
      expiresIn: Math.floor(gatewayEnv.otpTtlMs / 1000),
      delivery,
    }
  }

  async verifyRegistration(
    email: string,
    code: string,
  ): Promise<{ access_token: string; token_type: string; expires_in: number; email: string }> {
    const normalized = this.normalizeEmail(email)
    const pending = this.pendingRegisterByEmail.get(normalized)
    if (!pending || pending.expiresAt < Date.now()) {
      this.pendingRegisterByEmail.delete(normalized)
      unauthorized('otp_expired')
    }
    if (pending.code !== code.trim()) unauthorized('otp_invalid')
    this.pendingRegisterByEmail.delete(normalized)
    if (await this.users.findByEmail(normalized)) conflict('email_taken')
    try {
      await this.users.create(normalized, pending.passwordHash)
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'email_taken') conflict('email_taken')
      throw err
    }
    return this.issueWebToken(normalized)
  }

  async loginWithPassword(
    email: string,
    password: string,
  ): Promise<{ access_token: string; token_type: string; expires_in: number; email: string }> {
    const normalized = this.normalizeEmail(email)
    const user = await this.users.findByEmail(normalized)
    if (!user) unauthorized('account_not_found')
    if (!(await verifyPassword(password, user.passwordHash))) unauthorized('invalid_password')
    return this.issueWebToken(normalized)
  }

  async registerTokenFromJwt(token: string): Promise<boolean> {
    try {
      const payload = jwt.verify(token, gatewayEnv.jwtSecret) as JwtWebPayload
      const typ = payload.typ
      if (typ !== 'gateway_web' || payload.role !== 'web') {
        return false
      }
      const email = payload.sub?.trim().toLowerCase()
      this.gateway.registerWebToken(token, email?.includes('@') ? email : undefined)
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

  async resolveWebEmail(authorization?: string): Promise<string> {
    const token = await this.resolveWebToken(authorization)
    try {
      const payload = jwt.verify(token, gatewayEnv.jwtSecret) as JwtWebPayload
      const email = payload.sub?.trim().toLowerCase()
      if (email?.includes('@')) return email
    } catch {
      /* dev web token */
    }
    return 'local-web'
  }

  ensureDevWebRegistered(): void {
    if (isDevAuthBypass() || !isWebLoginRequired()) {
      this.gateway.registerWebToken(gatewayEnv.devWebToken)
    }
  }
}
