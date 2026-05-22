export type { LearnbuddyPreloadApi } from './preload-api.d.ts'

export {
  createPlatformApi,
  fetchBootstrap,
  hasLearnbuddyIpc,
  loadSavedSecret,
  saveSecret,
  clearSavedSecret,
  ApiError,
  type PlatformApi,
} from './create-platform'
export { resolveGatewayHttpBase, useLearnbuddyGateway } from './gateway-http'
export {
  BootstrapAuthRequired,
  clearAuthToken,
  hasAuthToken,
  loadAuthToken,
  requestEmailCode,
  requiresEmailLogin,
  requiresWebLogin,
  saveAuthToken,
  verifyEmailCode,
  loginWithPassword,
  registerWithPassword,
  requestRegister,
  verifyRegister,
} from './auth'

import { createPlatformApi } from './create-platform'

let _cached: ReturnType<typeof createPlatformApi> | null = null
function platform() {
  _cached ??= createPlatformApi()
  return _cached
}

export const listSessions = (...args: Parameters<ReturnType<typeof createPlatformApi>['listSessions']>) =>
  platform().listSessions(...args)
export const createSession = (...args: Parameters<ReturnType<typeof createPlatformApi>['createSession']>) =>
  platform().createSession(...args)
export const fetchWebuiThread = (...args: Parameters<ReturnType<typeof createPlatformApi>['fetchWebuiThread']>) =>
  platform().fetchWebuiThread(...args)
export const deleteSession = (...args: Parameters<ReturnType<typeof createPlatformApi>['deleteSession']>) =>
  platform().deleteSession(...args)
export const fetchSettings = (...args: Parameters<ReturnType<typeof createPlatformApi>['fetchSettings']>) =>
  platform().fetchSettings(...args)
export const updateSettings = (...args: Parameters<ReturnType<typeof createPlatformApi>['updateSettings']>) =>
  platform().updateSettings(...args)
export const updateProviderSettings = (...args: Parameters<ReturnType<typeof createPlatformApi>['updateProviderSettings']>) =>
  platform().updateProviderSettings(...args)
export const updateWebSearchSettings = (...args: Parameters<ReturnType<typeof createPlatformApi>['updateWebSearchSettings']>) =>
  platform().updateWebSearchSettings(...args)
export const listSlashCommands = (...args: Parameters<ReturnType<typeof createPlatformApi>['listSlashCommands']>) =>
  platform().listSlashCommands(...args)
