import { ipcMain } from 'electron'
import type {
  ProviderConnectionTestRequest,
  ProviderCredentialDeleteRequest,
  ProviderSettingsUpdate,
  SettingsUpdate,
} from '@catbuddy/shared'
import type { ProviderSettingsService } from '../services/provider-settings.js'

export function registerProviderSettingsHandlers(service: ProviderSettingsService): void {
  ipcMain.handle('settings:get', async () => service.getSettings())
  ipcMain.handle('settings:update', async (_event, update: SettingsUpdate) =>
    service.updateActive(update ?? {}))
  ipcMain.handle(
    'settings:provider-upsert',
    async (_event, update: ProviderSettingsUpdate) => service.upsertProvider(update),
  )
  ipcMain.handle(
    'settings:provider-test',
    async (_event, update: ProviderConnectionTestRequest) => service.testConnection(update),
  )
  ipcMain.handle(
    'settings:provider-delete-credential',
    async (_event, input: ProviderCredentialDeleteRequest) =>
      service.deleteCredential(input.provider),
  )
}
