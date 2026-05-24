/** Map gateway auth JSON error codes to user-facing Chinese messages. */
export function mapAuthError(body: string, status: number): string {
  try {
    const j = JSON.parse(body) as {
      message?: string | string[]
      error?: string
    }
    const raw = Array.isArray(j.message) ? j.message[0] : j.message ?? j.error
    const code = String(raw ?? '')
    const labels: Record<string, string> = {
      invalid_email: '请输入有效的邮箱地址',
      weak_password: '密码至少需要 8 位',
      email_taken: '该邮箱已注册，请切换到登录',
      account_not_found: '该邮箱尚未注册，请先注册',
      invalid_password: '密码不正确，请重试',
      invalid_credentials: '邮箱或密码不正确',
      otp_expired: '验证码已过期，请重新获取',
      otp_invalid: '验证码不正确，请重试',
      no_pending_registration: '请先填写邮箱与密码并获取验证码；若已填写，请重新点击「获取验证码」',
      smtp_not_configured:
        '邮件服务未配置：请在运行 Gateway 的终端查看 [dev] OTP 验证码，或配置 gateway/.env 中的 SMTP',
      smtp_auth_failed:
        'SMTP 登录失败：请确认 SMTP_PASS 是 QQ 邮箱「授权码」（非 QQ 密码），并在 QQ 邮箱设置里开启 SMTP 服务后重新生成授权码',
      smtp_timeout:
        '连接 SMTP 超时：请检查网络/防火墙，或在 gateway/.env 改用 SMTP_PORT=465 且 SMTP_SECURE=true',
      smtp_send_failed:
        '验证码邮件发送失败，请检查 gateway/.env 的 SMTP 配置（QQ 邮箱需使用授权码）',
      unauthorized: '未授权，请重新登录',
      forbidden: '无权访问该会话，请用 Web 新建对话或确认已登录同一账号',
      ws_error: 'Gateway 连接异常，请确认已运行 pnpm gateway:dev 并刷新页面',
    }
    if (labels[code]) return labels[code]
    if (code) return code
  } catch {
    /* ignore */
  }
  return `请求失败 (${status})`
}
