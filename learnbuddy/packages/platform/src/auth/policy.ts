import { useLearnbuddyGateway } from '../gateway-http'

function hasDesktopIpc(): boolean {
  return typeof window !== 'undefined' && !!window.learnbuddy
}

/** Browser against learnbuddy gateway: login before any bootstrap/API usage. */
export function requiresWebLogin(): boolean {
  if (hasDesktopIpc()) return false
  return useLearnbuddyGateway()
}
