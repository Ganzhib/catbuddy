import { ApiError } from './ipc-api';
async function apiFetch(path, token, base, init) {
    const root = (base || '').replace(/\/$/, '');
    const url = `${root}${path.startsWith('/') ? path : `/${path}`}`;
    const res = await fetch(url, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(init?.headers ?? {}),
        },
        credentials: 'include',
    });
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new ApiError(res.status, text);
    }
    if (res.status === 204)
        return undefined;
    return res.json();
}
export async function listSessionsHttp(token, base = '') {
    return apiFetch('/api/sessions', token, base);
}
export async function fetchWebuiThreadHttp(token, key, base = '') {
    const encoded = encodeURIComponent(key);
    return apiFetch(`/api/webui-thread?key=${encoded}`, token, base);
}
export async function deleteSessionHttp(token, key, base = '') {
    await apiFetch(`/api/sessions/${encodeURIComponent(key)}`, token, base, {
        method: 'DELETE',
    });
    return true;
}
export async function fetchSettingsHttp(token, base = '') {
    return apiFetch('/api/settings', token, base);
}
export async function updateSettingsHttp(token, update, base = '') {
    return apiFetch('/api/settings', token, base, {
        method: 'PATCH',
        body: JSON.stringify(update),
    });
}
export async function updateProviderSettingsHttp(token, update, base = '') {
    return apiFetch('/api/settings/provider', token, base, {
        method: 'PATCH',
        body: JSON.stringify(update),
    });
}
export async function updateWebSearchSettingsHttp(token, update, base = '') {
    return apiFetch('/api/settings/web-search', token, base, {
        method: 'PATCH',
        body: JSON.stringify(update),
    });
}
export async function listSlashCommandsHttp(token, base = '') {
    return apiFetch('/api/slash-commands', token, base);
}
//# sourceMappingURL=http-api.js.map