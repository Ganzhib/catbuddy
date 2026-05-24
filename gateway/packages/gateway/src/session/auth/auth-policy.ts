import { gatewayEnv } from '../config/env.js'

/** Web client must complete email OTP before bootstrap / API / WS (unless dev bypass). */
export function isWebLoginRequired(): boolean {
  return gatewayEnv.authRequireEmail && !gatewayEnv.authDevBypass
}

export function isDevAuthBypass(): boolean {
  return gatewayEnv.authDevBypass
}
