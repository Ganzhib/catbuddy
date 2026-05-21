import type { ChatSummary, SettingsPayload, SettingsUpdate, SlashCommand, WebuiThreadPersistedPayload, ProviderSettingsUpdate, WebSearchSettingsUpdate } from '@learnbuddy/shared';
export declare function listSessionsHttp(token: string, base?: string): Promise<ChatSummary[]>;
export declare function fetchWebuiThreadHttp(token: string, key: string, base?: string): Promise<WebuiThreadPersistedPayload | null>;
export declare function deleteSessionHttp(token: string, key: string, base?: string): Promise<boolean>;
export declare function fetchSettingsHttp(token: string, base?: string): Promise<SettingsPayload>;
export declare function updateSettingsHttp(token: string, update: SettingsUpdate, base?: string): Promise<SettingsPayload>;
export declare function updateProviderSettingsHttp(token: string, update: ProviderSettingsUpdate, base?: string): Promise<SettingsPayload>;
export declare function updateWebSearchSettingsHttp(token: string, update: WebSearchSettingsUpdate, base?: string): Promise<SettingsPayload>;
export declare function listSlashCommandsHttp(token: string, base?: string): Promise<SlashCommand[]>;
//# sourceMappingURL=http-api.d.ts.map