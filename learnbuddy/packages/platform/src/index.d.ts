export { createPlatformApi, fetchBootstrap, hasLearnbuddyIpc, loadSavedSecret, saveSecret, clearSavedSecret, ApiError, type PlatformApi, } from './create-platform';
import { createPlatformApi } from './create-platform';
export declare const listSessions: (...args: Parameters<ReturnType<typeof createPlatformApi>["listSessions"]>) => Promise<import("@learnbuddy/shared").ChatSummary[]>;
export declare const fetchWebuiThread: (...args: Parameters<ReturnType<typeof createPlatformApi>["fetchWebuiThread"]>) => Promise<import("@learnbuddy/shared").WebuiThreadPersistedPayload | null>;
export declare const deleteSession: (...args: Parameters<ReturnType<typeof createPlatformApi>["deleteSession"]>) => Promise<boolean>;
export declare const fetchSettings: (...args: Parameters<ReturnType<typeof createPlatformApi>["fetchSettings"]>) => Promise<import("@learnbuddy/shared").SettingsPayload>;
export declare const updateSettings: (...args: Parameters<ReturnType<typeof createPlatformApi>["updateSettings"]>) => Promise<import("@learnbuddy/shared").SettingsPayload>;
export declare const updateProviderSettings: (...args: Parameters<ReturnType<typeof createPlatformApi>["updateProviderSettings"]>) => Promise<import("@learnbuddy/shared").SettingsPayload>;
export declare const updateWebSearchSettings: (...args: Parameters<ReturnType<typeof createPlatformApi>["updateWebSearchSettings"]>) => Promise<import("@learnbuddy/shared").SettingsPayload>;
export declare const listSlashCommands: (...args: Parameters<ReturnType<typeof createPlatformApi>["listSlashCommands"]>) => Promise<import("@learnbuddy/shared").SlashCommand[]>;
//# sourceMappingURL=index.d.ts.map