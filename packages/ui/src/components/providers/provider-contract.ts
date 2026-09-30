import type {
  ProviderSettingsUpdate,
  SettingsPayload,
} from "@catbuddy/shared";
import {
  deleteProviderCredential,
  fetchSettings,
  hasCatbuddyIpc,
  testProviderConnection,
  updateProviderSettings,
} from "@catbuddy/platform";

export type ProviderInfo = SettingsPayload["providers"][number] & {
  active?: boolean;
  recommended_models?: string[];
  recommendedModels?: string[];
  credential_source?: "secure_store" | "environment" | "none" | string;
  credentialSource?: "secure_store" | "environment" | "none" | string;
  test_status?: "untested" | "testing" | "verified" | "failed" | string;
};

export type ProviderSettingsPayload = SettingsPayload & {
  capabilities?:
    | boolean
    | {
        provider_settings?: boolean;
        providerSettings?: boolean;
        provider_management?: boolean;
        providerManagement?: boolean;
        credential_management?: boolean;
        provider_connection_test?: boolean;
        byok?: boolean;
      };
  credential_storage?:
    | string
    | {
        available?: boolean;
        secure?: boolean;
        backend?: string;
        message?: string;
      };
};

export interface ProviderDraft extends ProviderSettingsUpdate {
  model?: string;
}

export interface ProviderTestResult {
  ok: boolean;
  message?: string;
  models?: string[];
  latencyMs?: number;
}

export function providerManagementAvailable(
  settings: ProviderSettingsPayload,
): boolean {
  const capability = settings.capabilities;
  if (typeof capability === "boolean") return capability;
  if (capability && typeof capability === "object") {
    const declared =
      capability.provider_settings ??
      capability.providerSettings ??
      capability.provider_management ??
      capability.providerManagement ??
      capability.credential_management ??
      capability.byok;
    if (typeof declared === "boolean") return declared;
  }
  return hasCatbuddyIpc();
}

export function activeProvider(
  settings: ProviderSettingsPayload,
): ProviderInfo | null {
  const providers = settings.providers as ProviderInfo[];
  return (
    providers.find((provider) => provider.active) ??
    providers.find((provider) => provider.name === settings.agent.provider) ??
    null
  );
}

export function hasUsableProvider(settings: ProviderSettingsPayload): boolean {
  const provider = activeProvider(settings);
  if (!provider) return false;
  if (settings.agent.has_api_key) return true;
  return provider.configured && provider.api_key_required === false;
}

export function providerModels(provider: ProviderInfo): string[] {
  const values = provider.recommended_models ?? provider.recommendedModels ?? [];
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function credentialStorageLabel(
  settings: ProviderSettingsPayload,
): string | null {
  const storage = settings.credential_storage;
  if (!storage) return null;
  if (typeof storage === "string") return storage;
  if (storage.message) return storage.message;
  if (!storage.available) return null;
  return storage.backend ?? null;
}

export async function testProviderDraft(
  token: string,
  draft: ProviderDraft,
): Promise<ProviderTestResult> {
  const startedAt = performance.now();
  const raw = await testProviderConnection(token, draft);
  const result = (raw ?? {}) as {
    ok?: boolean;
    success?: boolean;
    message?: string;
    error?: string;
    models?: unknown;
    latency_ms?: number;
    latencyMs?: number;
  };
  const ok = result.ok ?? result.success ?? true;
  return {
    ok,
    message: result.message ?? result.error,
    models: Array.isArray(result.models)
      ? result.models.filter((model): model is string => typeof model === "string")
      : undefined,
    latencyMs:
      result.latencyMs ??
      result.latency_ms ??
      Math.max(1, Math.round(performance.now() - startedAt)),
  };
}

export async function saveAndActivateProvider(
  token: string,
  draft: ProviderDraft,
): Promise<ProviderSettingsPayload> {
  return updateProviderSettings(token, {
    provider: draft.provider,
    apiKey: draft.apiKey,
    apiBase: draft.apiBase,
    ...(draft.model?.trim() ? { model: draft.model.trim() } : {}),
  } as ProviderSettingsUpdate) as Promise<ProviderSettingsPayload>;
}

export async function deleteCredential(
  token: string,
  provider: string,
): Promise<ProviderSettingsPayload> {
  const payload = await deleteProviderCredential(token, provider);
  if (payload) return payload as ProviderSettingsPayload;
  return fetchSettings(token) as Promise<ProviderSettingsPayload>;
}
