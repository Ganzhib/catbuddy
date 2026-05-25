export type { CatbuddyPreloadApi } from './preload-api.d.ts'

export {
  createPlatformApi,
  fetchBootstrap,
  hasCatbuddyIpc,
  loadSavedSecret,
  saveSecret,
  clearSavedSecret,
  ApiError,
  type PlatformApi,
} from './create-platform'
export { resolveGatewayHttpBase, useCatbuddyGateway } from './gateway-http'
export {
  resolveDesktopDownloadUrl,
  shouldOfferDesktopDownload,
} from './desktop-download'
export { openWorkspaceFile } from './workspace-file'
export {
  resolveGatewayAccountEmail,
  syncDesktopGatewayAccountEmail,
} from './gateway-account-sync'
export {
  BootstrapAuthRequired,
  clearAuthToken,
  emailPrefixFromEmail,
  hasAuthToken,
  loadAuthEmail,
  loadAuthToken,
  requestEmailCode,
  requiresEmailLogin,
  requiresWebLogin,
  resolveAuthEmail,
  resolveAuthEmailPrefix,
  saveAuthEmail,
  saveAuthToken,
  verifyEmailCode,
  loginWithPassword,
  registerWithPassword,
  requestRegister,
  verifyRegister,
  emailFromGatewayToken,
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
export const fetchMcpSettings = (...args: Parameters<ReturnType<typeof createPlatformApi>['fetchMcpSettings']>) =>
  platform().fetchMcpSettings(...args)
export const updateMcpServers = (...args: Parameters<ReturnType<typeof createPlatformApi>['updateMcpServers']>) =>
  platform().updateMcpServers(...args)
export const fetchMcpMarketplace = (...args: Parameters<ReturnType<typeof createPlatformApi>['fetchMcpMarketplace']>) =>
  platform().fetchMcpMarketplace(...args)
export const addMcpFromMarketplace = (...args: Parameters<ReturnType<typeof createPlatformApi>['addMcpFromMarketplace']>) =>
  platform().addMcpFromMarketplace(...args)
export {
  fetchSkillMarketplaceIpc as fetchSkillMarketplace,
  installSkillFromMarketplaceIpc as installSkillFromMarketplace,
  listSkillsIpc as listSkills,
  toggleSkillIpc as toggleSkill,
} from './ipc-api'
export const listSlashCommands = (...args: Parameters<ReturnType<typeof createPlatformApi>['listSlashCommands']>) =>
  platform().listSlashCommands(...args)
