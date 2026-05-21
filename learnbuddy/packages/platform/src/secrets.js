const SECRET_STORAGE_KEY = 'learnbuddy-webui.bootstrap-secret';
export function loadSavedSecret() {
    if (typeof window === 'undefined')
        return '';
    try {
        return window.localStorage.getItem(SECRET_STORAGE_KEY) ?? '';
    }
    catch {
        return '';
    }
}
export function saveSecret(secret) {
    try {
        window.localStorage.setItem(SECRET_STORAGE_KEY, secret);
    }
    catch { }
}
export function clearSavedSecret() {
    try {
        window.localStorage.removeItem(SECRET_STORAGE_KEY);
    }
    catch { }
}
//# sourceMappingURL=secrets.js.map