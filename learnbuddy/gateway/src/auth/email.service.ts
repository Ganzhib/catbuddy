import { Injectable, Logger } from '@nestjs/common'
import nodemailer from 'nodemailer'
import { gatewayEnv } from '../config/env'

@Injectable()
export class EmailService {
  private readonly log = new Logger(EmailService.name)
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
      })
    }
    return this.transporter
  }

  async sendOtp(email: string, code: string): Promise<void> {
    const subject = 'learnbuddy 注册验证码'
    const text = `您的 learnbuddy 注册验证码是：${code}\n10 分钟内有效。如非本人操作请忽略此邮件。`
    const transport = this.getTransporter()
    if (!transport) {
      this.log.warn(`[dev] OTP for ${email}: ${code}`)
      return
    }
    try {
      await transport.sendMail({
        from: gatewayEnv.smtpFrom,
        to: email,
        subject,
        text,
      })
      this.log.log(`OTP sent to ${email}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      this.log.error(`SMTP send failed for ${email}: ${msg}`)
      throw err
    }
  }
}
