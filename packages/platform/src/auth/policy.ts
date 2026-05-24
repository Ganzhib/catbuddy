import { useCatbuddyGateway } from '../gateway-http'

function hasDesktopIpc(): boolean {
  return typeof window !== 'undefined' && !!window.catbuddy
}

/**
 * Email OTP required before using the app.
 * Desktop (Electron) and Web (catbuddy gateway) both gate here; Web-only nanobot mode skips.
 */
export function requiresEmailLogin(): boolean {
  if (hasDesktopIpc()) return true
  return useCatbuddyGateway()
}

/** @deprecated Use requiresEmailLogin */
export const requiresWebLogin = requiresEmailLogin
