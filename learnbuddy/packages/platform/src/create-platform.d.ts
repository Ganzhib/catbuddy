import type { BootstrapResponse, ChatSummary, SettingsPayload, SettingsUpdate, SlashCommand, WebuiThreadPersistedPayload, ProviderSettingsUpdate, WebSearchSettingsUpdate } from '@learnbuddy/shared';
export { ApiError } from './ipc-api';
export { loadSavedSecret, saveSecret, clearSavedSecret } from './secrets';
export declare function hasLearnbuddyIpc(): boolean;
export interface PlatformApi {
    fetchBootstrap(baseUrl?: string, secret?: string): Promise<BootstrapResponse>;
    deriveWsUrl(wsPath: string, token: string): string;
    listSessions(token: string, base?: string): Promise<ChatSummary[]>;
    fetchWebuiThread(token: string, key: string, base?: string): Promise<WebuiThreadPersistedPayload | null>;
    deleteSession(token: string, key: string, base?: string): Promise<boolean>;
    fetchSettings(token: string, base?: string): Promise<SettingsPayload>;
    updateSettings(token: string, update: SettingsUpdate, base?: string): Promise<SettingsPayload>;
    updateProviderSettings(token: string, update: ProviderSettingsUpdate, base?: string): Promise<SettingsPayload>;
    updateWebSearchSettings(token: string, update: WebSearchSettingsUpdate, base?: string): Promise<SettingsPayload>;
    listSlashCommands(token: string, base?: string): Promise<SlashCommand[]>;
    readonly mode: 'desktop' | 'web';
}
export declare function createPlatformApi(): PlatformApi;
/** @deprecated Use createPlatformApi().fetchBootstrap */
export declare function fetchBootstrap(baseUrl?: string, secret?: string): Promise<BootstrapResponse>;
//# sourceMappingURL=create-platform.d.ts.map