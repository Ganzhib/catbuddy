import { gatewayEnv } from '../config/env'

/** Web viewer must complete email OTP before bootstrap / API / WS (unless dev bypass). */
export function isViewerLoginRequired(): boolean {
  return gatewayEnv.authRequireEmail && !gatewayEnv.authDevBypass
}

export function isDevAuthBypass(): boolean {
  return gatewayEnv.authDevBypass
}
