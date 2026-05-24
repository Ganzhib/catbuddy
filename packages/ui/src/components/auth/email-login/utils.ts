function formatExpiry(seconds: number): string {
  if (seconds >= 60 && seconds % 60 === 0) {
    return `${seconds / 60} 分钟`
  }
  if (seconds >= 60) {
    return `${Math.ceil(seconds / 60)} 分钟`
  }
  return `${seconds} 秒`
}

export function otpHint(expiresIn: number, delivery?: 'email' | 'console'): string {
  const expiry = formatExpiry(expiresIn)
  if (delivery === 'console') {
    return `验证码 ${expiry} 内有效。当前为开发环境，验证码不会发到邮箱，请向管理员获取或在服务端日志中查看。`
  }
  return `验证码已发送，请查收邮件（${expiry} 内有效）。没收到？看看垃圾箱，或点击下方重新发送。`
}

export function resolveAuthErrorAction(message: string): 'go_register' | 'go_login' | null {
  if (message.includes('尚未注册')) return 'go_register'
  if (message.includes('已注册')) return 'go_login'
  return null
}
