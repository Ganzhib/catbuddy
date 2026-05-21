export { createPlatformApi, fetchBootstrap, hasLearnbuddyIpc, loadSavedSecret, saveSecret, clearSavedSecret, ApiError, } from './create-platform';
import { createPlatformApi } from './create-platform';
let _cached = null;
function platform() {
    _cached ??= createPlatformApi();
    return _cached;
}
export const listSessions = (...args) => platform().listSessions(...args);
export const fetchWebuiThread = (...args) => platform().fetchWebuiThread(...args);
export const deleteSession = (...args) => platform().deleteSession(...args);
export const fetchSettings = (...args) => platform().fetchSettings(...args);
export const updateSettings = (...args) => platform().updateSettings(...args);
export const updateProviderSettings = (...args) => platform().updateProviderSettings(...args);
export const updateWebSearchSettings = (...args) => platform().updateWebSearchSettings(...args);
export const listSlashCommands = (...args) => platform().listSlashCommands(...args);
//# sourceMappingURL=index.js.map