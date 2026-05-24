function env(name: string, defaultVal = ''): string {
  return process.env[name] ?? defaultVal
}

export function envInt(name: string, fallback: number): number {
  const v = process.env[name]
  if (!v) return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name]
  if (v === undefined || v === '') return fallback
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes'
}

export const gatewayEnv = {
  port: envInt('GATEWAY_PORT', 18765),
  desktopSecret: env('GATEWAY_SECRET', 'dev-secret'),
  devWebToken: env('GATEWAY_DEV_WEB_TOKEN', 'dev-web'),
  /** Path returned in bootstrap; Vite proxies as /gateway-ws + this path */
  publicWsPath: env('GATEWAY_WS_PATH', '/gateway-ws/ws'),
  /** When true, Web UI may use dev web token / secret without email OTP. */
  authDevBypass: envBool('GATEWAY_AUTH_DEV_BYPASS', false),
  /** When true (default), Web must log in via email before bootstrap/API. */
  authRequireEmail: envBool('GATEWAY_AUTH_REQUIRE_EMAIL', true),
  jwtSecret: env('GATEWAY_JWT_SECRET', 'learnbuddy-gateway-dev-jwt-secret'),
  jwtExpiresIn: env('GATEWAY_JWT_EXPIRES', '7d'),
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: envInt('SMTP_PORT', 587),
  /** ``true`` = SSL (465); ``false`` = STARTTLS (587); empty = auto from port */
  smtpSecure: env('SMTP_SECURE', ''),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || 'learnbuddy <noreply@learnbuddy.local>',
  otpTtlMs: envInt('GATEWAY_OTP_TTL_MS', 10 * 60 * 1000),
  databaseUrl: env('DATABASE_URL', ''),
  mysql: {
    host: env('MYSQL_HOST', '127.0.0.1'),
    port: envInt('MYSQL_PORT', 3306),
    user: env('MYSQL_USER', 'learnbuddy'),
    password: env('MYSQL_PASSWORD', 'learnbuddy'),
    database: env('MYSQL_DATABASE', 'learnbuddy_gateway'),
  },
}
