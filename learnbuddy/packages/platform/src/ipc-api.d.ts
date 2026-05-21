import type { ChatSummary, SettingsPayload, SettingsUpdate, SlashCommand, WebuiThreadPersistedPayload, ProviderSettingsUpdate, WebSearchSettingsUpdate } from '@learnbuddy/shared';
export declare class ApiError extends Error {
    status: number;
    constructor(status: number, message: string);
}
export declare function listSessionsIpc(_token: string, _base?: string): Promise<ChatSummary[]>;
export declare function fetchWebuiThreadIpc(_token: string, key: string, _base?: string): Promise<WebuiThreadPersistedPayload | null>;
export declare function deleteSessionIpc(_token: string, key: string, _base?: string): Promise<boolean>;
export declare function fetchSettingsIpc(_token: string, _base?: string): Promise<SettingsPayload>;
export declare function updateSettingsIpc(_token: string, update: SettingsUpdate, _base?: string): Promise<SettingsPayload>;
export declare function updateProviderSettingsIpc(_token: string, update: ProviderSettingsUpdate, _base?: string): Promise<SettingsPayload>;
export declare function updateWebSearchSettingsIpc(_token: string, _update: WebSearchSettingsUpdate, _base?: string): Promise<SettingsPayload>;
export declare function listSlashCommandsIpc(_token: string, _base?: string): Promise<SlashCommand[]>;
//# sourceMappingURL=ipc-api.d.ts.map