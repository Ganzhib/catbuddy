import { Injectable, Logger } from '@nestjs/common'
import nodemailer from 'nodemailer'
import { gatewayEnv } from '../config/env'

@Injectable()
export class EmailService {
  private readonly log = new Logger(EmailService.name)
  private transporter: nodemailer.Transporter | null = null

  private getTransporter(): nodemailer.Transporter | null {
    if (!gatewayEnv.smtpHost) return null
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: gatewayEnv.smtpHost,
        port: gatewayEnv.smtpPort,
        secure: gatewayEnv.smtpPort === 465,
        auth: gatewayEnv.smtpUser
          ? { user: gatewayEnv.smtpUser, pass: gatewayEnv.smtpPass }
          : undefined,
      })
    }
    return this.transporter
  }

  async sendOtp(email: string, code: string): Promise<void> {
    const subject = 'learnbuddy 登录验证码'
    const text = `您的 learnbuddy 验证码是：${code}\n10 分钟内有效。`
    const transport = this.getTransporter()
    if (!transport) {
      this.log.warn(`[dev] OTP for ${email}: ${code}`)
      return
    }
    await transport.sendMail({
      from: gatewayEnv.smtpFrom,
      to: email,
      subject,
      text,
    })
    this.log.log(`OTP sent to ${email}`)
  }
}
