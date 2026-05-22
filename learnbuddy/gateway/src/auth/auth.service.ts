import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { randomInt } from 'node:crypto'
import { gatewayEnv } from '../config/env'
import { GatewayStateService } from '../gateway/gateway-state.service'
import { isDevAuthBypass, isViewerLoginRequired } from './auth-policy'
import { EmailService } from './email.service'

interface OtpEntry {
  code: string
  expiresAt: number
}

export interface JwtViewerPayload {
  sub: string
  role: 'viewer'
  typ: 'gateway_viewer' | 'relay_viewer'
}

@Injectable()
export class AuthService {
  private readonly otpByEmail = new Map<string, OtpEntry>()

  constructor(
    private readonly jwt: JwtService,
    private readonly email: EmailService,
    private readonly gateway: GatewayStateService,
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
    const normalized = email.trim().toLowerCase()
    if (!normalized.includes('@')) {
      throw new UnauthorizedException('invalid_email')
    }
    const code = String(randomInt(100_000, 999_999))
    this.otpByEmail.set(normalized, {
      code,
      expiresAt: Date.now() + gatewayEnv.otpTtlMs,
    })
    await this.email.sendOtp(normalized, code)
    return { ok: true, expiresIn: Math.floor(gatewayEnv.otpTtlMs / 1000) }
  }

  async verifyEmailCode(
    email: string,
    code: string,
  ): Promise<{ access_token: string; token_type: string; expires_in: number; email: string }> {
    const normalized = email.trim().toLowerCase()
    const entry = this.otpByEmail.get(normalized)
    if (!entry || entry.expiresAt < Date.now()) {
      throw new UnauthorizedException('otp_expired')
    }
    if (entry.code !== code.trim()) {
      throw new UnauthorizedException('otp_invalid')
    }
    this.otpByEmail.delete(normalized)
    const access_token = await this.jwt.signAsync({
      sub: normalized,
      role: 'viewer',
      typ: 'gateway_viewer',
    } satisfies JwtViewerPayload)
    this.gateway.registerViewerToken(access_token)
    const expires_in = 7 * 24 * 3600
    return { access_token, token_type: 'bearer', expires_in, email: normalized }
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
      this.gateway.registerViewerToken(token)
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

  ensureDevViewerRegistered(): void {
    if (isDevAuthBypass() || !isViewerLoginRequired()) {
      this.gateway.registerViewerToken(gatewayEnv.devViewerToken)
    }
  }
}
