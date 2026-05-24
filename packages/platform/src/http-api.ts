import type {
  ChatSummary,
  SettingsPayload,
  SettingsUpdate,
  SlashCommand,
  WebuiThreadPersistedPayload,
  ProviderSettingsUpdate,
  WebSearchSettingsUpdate,
} from '@learnbuddy/shared'
import { ApiError } from './ipc-api'
import { resolveGatewayHttpBase } from './gateway-http'

async function apiFetch<T>(
  path: string,
  token: string,
  base: string,
  init?: RequestInit,
): Promise<T> {
  const root = (base || resolveGatewayHttpBase()).replace(/\/$/, '')
  const url = `${root}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    credentials: 'omit',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new ApiError(res.status, text)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export async function listSessionsHttp(
  token: string,
  base: string = '',
): Promise<ChatSummary[]> {
  return apiFetch<ChatSummary[]>('/api/sessions', token, base)
}

export async function createSessionHttp(
  token: string,
  base: string = '',
  chatId?: string,
): Promise<ChatSummary> {
  return apiFetch<ChatSummary>('/api/sessions', token, base, {
    method: 'POST',
    body: JSON.stringify(chatId ? { chatId } : {}),
  })
}

export async function fetchWebuiThreadHttp(
  token: string,
  key: string,
  base: string = '',
): Promise<WebuiThreadPersistedPayload | null> {
  const encoded = encodeURIComponent(key)
  return apiFetch<WebuiThreadPersistedPayload | null>(
    `/api/webui-thread?key=${encoded}`,
    token,
    base,
  )
}

export async function deleteSessionHttp(
  token: string,
  key: string,
  base: string = '',
): Promise<boolean> {
  await apiFetch(`/api/sessions/${encodeURIComponent(key)}`, token, base, {
    method: 'DELETE',
  })
  return true
}

export async function fetchSettingsHttp(
  token: string,
  base: string = '',
): Promise<SettingsPayload> {
  return apiFetch<SettingsPayload>('/api/settings', token, base)
}

export async function updateSettingsHttp(
  token: string,
  update: SettingsUpdate,
  base: string = '',
): Promise<SettingsPayload> {
  return apiFetch<SettingsPayload>('/api/settings', token, base, {
    method: 'PATCH',
    body: JSON.stringify(update),
  })
}

export async function updateProviderSettingsHttp(
  token: string,
  update: ProviderSettingsUpdate,
  base: string = '',
): Promise<SettingsPayload> {
  return apiFetch<SettingsPayload>('/api/settings/provider', token, base, {
    method: 'PATCH',
    body: JSON.stringify(update),
  })
}

export async function updateWebSearchSettingsHttp(
  token: string,
  update: WebSearchSettingsUpdate,
  base: string = '',
): Promise<SettingsPayload> {
  return apiFetch<SettingsPayload>('/api/settings/web-search', token, base, {
    method: 'PATCH',
    body: JSON.stringify(update),
  })
}

export async function listSlashCommandsHttp(
  token: string,
  base: string = '',
): Promise<SlashCommand[]> {
  return apiFetch<SlashCommand[]>('/api/slash-commands', token, base)
}
