import nodemailer from 'nodemailer'
import { gatewayEnv } from '../config/env.js'

export class EmailService {
  private readonly log = { warn: console.warn, log: console.log, error: console.error }
  private transporter: nodemailer.Transporter | null = null

  private smtpSecure(): boolean {
    const raw = gatewayEnv.smtpSecure.trim().toLowerCase()
    if (raw === 'true' || raw === '1' || raw === 'yes') return true
    if (raw === 'false' || raw === '0' || raw === 'no') return false
    return gatewayEnv.smtpPort === 465
  }

  private getTransporter(): nodemailer.Transporter | null {
    if (!gatewayEnv.smtpHost) return null
    if (!gatewayEnv.smtpUser || !gatewayEnv.smtpPass) {
      this.log.warn('SMTP_HOST is set but SMTP_USER/SMTP_PASS missing — OTP will print to console')
      return null
    }
    if (!this.transporter) {
      const secure = this.smtpSecure()
      this.transporter = nodemailer.createTransport({
        host: gatewayEnv.smtpHost,
        port: gatewayEnv.smtpPort,
        secure,
        requireTLS: !secure && gatewayEnv.smtpPort === 587,
        auth: { user: gatewayEnv.smtpUser, pass: gatewayEnv.smtpPass },
        connectionTimeout: 20_000,
        greetingTimeout: 20_000,
        tls: { servername: gatewayEnv.smtpHost },
      })
    }
    return this.transporter
  }

  /** @returns `email` if sent via SMTP; `console` if OTP only logged (dev). */
  async sendOtp(email: string, code: string): Promise<'email' | 'console'> {
    const subject = 'catbuddy 注册验证码'
    const text = `您的 catbuddy 注册验证码是：${code}\n10 分钟内有效。如非本人操作请忽略此邮件。`
    const transport = this.getTransporter()
    if (!transport) {
      this.log.warn(
        `[gateway] SMTP 未配置 — 验证码未发邮件。邮箱 ${email} 验证码: ${code}（请配置根目录 .env 的 SMTP_* 或查看本终端）`,
      )
      return 'console'
    }
    const from = gatewayEnv.smtpFrom.trim() || gatewayEnv.smtpUser
    try {
      await transport.sendMail({
        from,
        to: email,
        subject,
        text,
      })
      this.log.log(`[gateway] OTP sent to ${email}`)
      return 'email'
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const extra =
        err && typeof err === 'object' && 'response' in err
          ? String((err as { response?: string }).response ?? '')
          : ''
      this.log.error(`[gateway] SMTP send failed for ${email}: ${msg} ${extra}`)
      let code = 'smtp_send_failed'
      const blob = `${msg} ${extra}`.toLowerCase()
      if (
        blob.includes('535')
        || blob.includes('invalid login')
        || blob.includes('authentication')
        || blob.includes('auth')
      ) {
        code = 'smtp_auth_failed'
      } else if (blob.includes('etimedout') || blob.includes('timeout') || blob.includes('connect')) {
        code = 'smtp_timeout'
      }
      const smtpErr = new Error(`${code}: ${msg}`)
      smtpErr.name = 'SmtpSendError'
      throw smtpErr
    }
  }
}
