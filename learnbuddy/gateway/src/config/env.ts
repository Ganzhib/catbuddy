function env(name: string, fallbackName?: string, defaultVal = ''): string {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : undefined) || defaultVal
}

export function envInt(name: string, fallback: number, altName?: string): number {
  const v = process.env[name] ?? (altName ? process.env[altName] : undefined)
  if (!v) return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export function envBool(name: string, fallback: boolean, altName?: string): boolean {
  const v = process.env[name] ?? (altName ? process.env[altName] : undefined)
  if (v === undefined || v === '') return fallback
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes'
}

export const gatewayEnv = {
  port: envInt('GATEWAY_PORT', 18765, 'RELAY_PORT'),
  executorSecret: env('GATEWAY_SECRET', 'RELAY_SECRET', 'dev-secret'),
  devViewerToken: env('GATEWAY_DEV_VIEWER_TOKEN', 'RELAY_DEV_VIEWER_TOKEN', 'dev-viewer'),
  /** Path returned in bootstrap; Vite proxies as /gateway-ws + this path */
  publicWsPath: env('GATEWAY_WS_PATH', 'RELAY_GATEWAY_WS_PATH', '/gateway-ws/ws'),
  /** When true, Web UI may use dev viewer token / secret without email OTP. */
  authDevBypass: envBool('GATEWAY_AUTH_DEV_BYPASS', false, 'RELAY_AUTH_DEV_BYPASS'),
  /** When true (default), Web must log in via email before bootstrap/API. */
  authRequireEmail: envBool('GATEWAY_AUTH_REQUIRE_EMAIL', true, 'RELAY_AUTH_REQUIRE_EMAIL'),
  jwtSecret: env('GATEWAY_JWT_SECRET', 'RELAY_JWT_SECRET', 'learnbuddy-gateway-dev-jwt-secret'),
  jwtExpiresIn: env('GATEWAY_JWT_EXPIRES', 'RELAY_JWT_EXPIRES', '7d'),
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: envInt('SMTP_PORT', 587),
  /** ``true`` = SSL (465); ``false`` = STARTTLS (587); empty = auto from port */
  smtpSecure: env('SMTP_SECURE', undefined, ''),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || 'learnbuddy <noreply@learnbuddy.local>',
  otpTtlMs: envInt('GATEWAY_OTP_TTL_MS', 10 * 60 * 1000, 'RELAY_OTP_TTL_MS'),
  /** JSONL workspace root (default ``~/.learnbuddy-gateway/workspace``). */
  dataDir: env('GATEWAY_DATA_DIR', 'RELAY_DATA_DIR', ''),
}

/** @deprecated use gatewayEnv */
export const relayEnv = gatewayEnv
