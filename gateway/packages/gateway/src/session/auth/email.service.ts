import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import nodemailer from 'nodemailer'
import { gatewayEnv } from '../config/env.js'

export class EmailService {
  private readonly log = { warn: console.warn, log: console.log, error: console.error }
  private transporter: nodemailer.Transporter | null = null
  private readonly logoPath = resolve(process.cwd(), '../../apps/web/public/brand/catbuddy_logo.png')

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  private buildOtpHtml(code: string): string {
    const safeCode = this.escapeHtml(code)
    return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>catbuddy 注册验证码</title>
  </head>
  <body style="margin:0; padding:0; background:#eaf7ff; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif; color:#11324d;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%; background:linear-gradient(180deg,#d9f2ff 0%,#f6fbff 54%,#ffffff 100%);">
      <tr>
        <td align="center" style="padding:28px 14px 36px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%; max-width:520px;">
            <tr>
              <td align="center" style="padding:0 0 18px;">
                <img src="cid:catbuddy-logo" width="132" alt="catbuddy" style="display:block; width:132px; max-width:46%; height:auto; border:0; outline:none; text-decoration:none;">
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff; border:1px solid #bfe9ff; border-radius:28px; box-shadow:0 18px 48px rgba(36,159,221,0.18); overflow:hidden;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding:30px 24px 8px; text-align:center;">
                      <div style="display:inline-block; padding:7px 12px; border-radius:999px; background:#e7f7ff; color:#1687c4; font-size:13px; font-weight:700; letter-spacing:.02em;">邮箱验证</div>
                      <h1 style="margin:18px 0 10px; color:#0f5f91; font-size:25px; line-height:1.25; font-weight:800;">欢迎来到 catbuddy</h1>
                      <p style="margin:0 0 8px; color:#2d8fca; font-size:17px; line-height:1.65; font-weight:700;">从现在开始，你可以领养一只属于自己的猫咪伙伴了。</p>
                      <p style="margin:0; color:#5a7590; font-size:15px; line-height:1.75;">请在手机或电脑端输入下面的验证码，完成注册登录，开启你的陪伴之旅。</p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding:22px 24px 12px;">
                      <div style="box-sizing:border-box; width:100%; max-width:330px; padding:18px 16px; border-radius:22px; background:linear-gradient(135deg,#e2f6ff 0%,#f5fcff 100%); border:1px solid #a9e2ff; box-shadow:inset 0 1px 0 rgba(255,255,255,.9);">
                        <div style="color:#5491b7; font-size:12px; font-weight:700; letter-spacing:.18em; text-transform:uppercase;">Verification Code</div>
                        <div style="margin-top:8px; color:#075a8d; font-size:36px; line-height:1; font-weight:900; letter-spacing:.22em; font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;">${safeCode}</div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 24px 26px; text-align:center;">
                      <p style="margin:0; color:#638099; font-size:14px; line-height:1.75;">验证码 <strong style="color:#137fb8;">10 分钟内有效</strong>。如果不是你本人操作，可以安全忽略这封邮件。</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 24px 26px;">
                      <div style="height:1px; background:#d9f1ff; line-height:1px; font-size:1px;">&nbsp;</div>
                      <p style="margin:16px 0 0; text-align:center; color:#8ba5b8; font-size:12px; line-height:1.6;">这是一封自动发送的邮件，请勿直接回复。</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
  }

  private logoAttachment(): nodemailer.SendMailOptions['attachments'] {
    if (!existsSync(this.logoPath)) return []
    return [
      {
        filename: 'catbuddy-logo.png',
        path: this.logoPath,
        cid: 'catbuddy-logo',
      },
    ]
  }

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
        html: this.buildOtpHtml(code),
        attachments: this.logoAttachment(),
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
