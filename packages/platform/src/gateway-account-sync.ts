import { emailFromGatewayToken } from './auth/jwt-email'
import { loadAuthEmail, loadAuthToken } from './auth/session'
import { hasCatbuddyIpc } from './create-platform'

/** Account email for Gateway desktop register (must match Web JWT `sub`). */
export function resolveGatewayAccountEmail(): string | undefined {
  const fromStore = loadAuthEmail()?.trim().toLowerCase()
  if (fromStore?.includes('@')) return fromStore
  const fromJwt = emailFromGatewayToken(loadAuthToken())
  if (fromJwt?.includes('@')) return fromJwt
  return undefined
}

/** Push logged-in email to Electron main for Gateway WS `accountEmail`. */
export async function syncDesktopGatewayAccountEmail(): Promise<string | null> {
  if (!hasCatbuddyIpc()) return null
  const email = resolveGatewayAccountEmail()
  if (!email) return null
  const api = window.catbuddy?.setGatewayAccountEmail
  if (!api) return null
  const res = await api({ email })
  return res.accountEmail
}
