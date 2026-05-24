import { useLearnbuddyGateway } from '../gateway-http'

function hasDesktopIpc(): boolean {
  return typeof window !== 'undefined' && !!window.learnbuddy
}

/**
 * Email OTP required before using the app.
 * Desktop (Electron) and Web (learnbuddy gateway) both gate here; Web-only nanobot mode skips.
 */
export function requiresEmailLogin(): boolean {
  if (hasDesktopIpc()) return true
  return useLearnbuddyGateway()
}

/** @deprecated Use requiresEmailLogin */
export const requiresWebLogin = requiresEmailLogin
