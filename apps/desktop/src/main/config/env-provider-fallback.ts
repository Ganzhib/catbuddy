import type { catbuddyConfig, SettingsPayload } from '@catbuddy/shared'

/** Env fallbacks for built-in providers (never persisted — see `stripEnvProviderKeys`). */
export function resolveProviderApiKey(providerName: string, stored?: string): string {
  const fromConfig = stored?.trim() ?? ''
  if (fromConfig) return fromConfig
  if (providerName === 'deepseek') {
    return process.env.DEEPSEEK_KEY?.trim() || process.env.DEEPSEEK_API_KEY?.trim() || ''
  }
  if (providerName === 'openai') {
    return process.env.OPENAI_API_KEY?.trim() || ''
  }
  return ''
}

export function resolveProviderApiBase(providerName: string, stored?: string): string | undefined {
  const fromConfig = stored?.trim()
  if (fromConfig) return fromConfig
  if (providerName === 'deepseek') {
    return process.env.DEEPSEEK_BASE?.trim() || 'https://api.deepseek.com/v1'
  }
  if (providerName === 'openai') {
    return process.env.OPENAI_API_BASE?.trim() || 'https://api.openai.com/v1'
  }
  return stored
}

export function isProviderConfigured(providerName: string, stored?: string): boolean {
  return !!resolveProviderApiKey(providerName, stored)
}

/** Remove apiKeys that only mirror env (keep user-entered keys on disk). */
export function stripEnvProviderKeys(config: catbuddyConfig): void {
  for (const [name, provider] of Object.entries(config.providers)) {
    const stored = provider.apiKey?.trim() ?? ''
    if (!stored) continue
    const fromEnv = resolveProviderApiKey(name, '')
    if (stored === fromEnv) provider.apiKey = ''
  }
}

export function buildSettingsPayload(config: catbuddyConfig): SettingsPayload {
  const defaultProvider = config.agents.defaults.provider
  return {
    agent: {
      model: config.agents.defaults.model,
      provider: defaultProvider,
      resolved_provider: defaultProvider,
      has_api_key: isProviderConfigured(
        defaultProvider,
        config.providers[defaultProvider]?.apiKey,
      ),
    },
    providers: Object.entries(config.providers).map(([name, p]) => ({
      name,
      label: name,
      configured: isProviderConfigured(name, p.apiKey),
      api_key_required: true,
      api_key_hint: null,
      api_base: p.apiBase ?? null,
      default_api_base: resolveProviderApiBase(name, p.apiBase) ?? null,
    })),
    web_search: {
      provider: config.tools.web.searchProvider ?? 'ddg',
      providers: [{ name: 'ddg', label: 'DuckDuckGo', credential: 'none' as const }],
    },
    runtime: {
      config_path: (config as catbuddyConfig & { runtime?: { config_path?: string } }).runtime
        ?.config_path
        || '',
    },
    requires_restart: false,
  }
}
