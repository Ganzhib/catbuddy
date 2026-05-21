import { fetchBootstrapHttp, deriveWsUrlHttp } from './http-bootstrap';
import { fetchBootstrapIpc, deriveWsUrlIpc } from './ipc-bootstrap';
import { listSessionsHttp, fetchWebuiThreadHttp, deleteSessionHttp, fetchSettingsHttp, updateSettingsHttp, updateProviderSettingsHttp, updateWebSearchSettingsHttp, listSlashCommandsHttp, } from './http-api';
import { listSessionsIpc, fetchWebuiThreadIpc, deleteSessionIpc, fetchSettingsIpc, updateSettingsIpc, updateProviderSettingsIpc, updateWebSearchSettingsIpc, listSlashCommandsIpc, } from './ipc-api';
export { ApiError } from './ipc-api';
export { loadSavedSecret, saveSecret, clearSavedSecret } from './secrets';
export function hasLearnbuddyIpc() {
    return typeof window !== 'undefined' && !!window.learnbuddy;
}
export function createPlatformApi() {
    if (hasLearnbuddyIpc()) {
        return {
            mode: 'desktop',
            fetchBootstrap: fetchBootstrapIpc,
            deriveWsUrl: deriveWsUrlIpc,
            listSessions: listSessionsIpc,
            fetchWebuiThread: fetchWebuiThreadIpc,
            deleteSession: deleteSessionIpc,
            fetchSettings: fetchSettingsIpc,
            updateSettings: updateSettingsIpc,
            updateProviderSettings: updateProviderSettingsIpc,
            updateWebSearchSettings: updateWebSearchSettingsIpc,
            listSlashCommands: listSlashCommandsIpc,
        };
    }
    return {
        mode: 'web',
        fetchBootstrap: fetchBootstrapHttp,
        deriveWsUrl: deriveWsUrlHttp,
        listSessions: listSessionsHttp,
        fetchWebuiThread: fetchWebuiThreadHttp,
        deleteSession: deleteSessionHttp,
        fetchSettings: fetchSettingsHttp,
        updateSettings: updateSettingsHttp,
        updateProviderSettings: updateProviderSettingsHttp,
        updateWebSearchSettings: updateWebSearchSettingsHttp,
        listSlashCommands: listSlashCommandsHttp,
    };
}
/** @deprecated Use createPlatformApi().fetchBootstrap */
export async function fetchBootstrap(baseUrl, secret) {
    return createPlatformApi().fetchBootstrap(baseUrl, secret);
}
//# sourceMappingURL=create-platform.js.map