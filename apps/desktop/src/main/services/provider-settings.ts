import type {
  ProviderConnectionTestRequest,
  ProviderConnectionTestResult,
  ProviderConfig,
  ProviderSettingsUpdate,
  SettingsPayload,
  SettingsUpdate,
  catbuddyConfig,
} from '@catbuddy/shared'
import type { AgentLoop } from '../agent/loop.js'
import type { ProviderCredentialStore } from '../credentials/index.js'
import { saveConfig } from '../config/persist.js'
import {
  resolveProviderApiBase,
  resolveProviderApiKey,
  resolveProviderEnvApiKey,
} from '../config/env-provider-fallback.js'
import { createProvider, createProviderForProfile } from '../providers/factory.js'
import {
  PROVIDER_CATALOG,
  resolveProviderMetadata,
  resolveProviderProtocol,
} from '../providers/catalog.js'

export interface ProviderSettingsRuntime {
  agentLoop: AgentLoop
  config: catbuddyConfig
  configFile: string
}

const PROVIDER_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/
const BLOCKED_IDS = new Set(['__proto__', 'prototype', 'constructor'])

function validateProviderId(input: string): string {
  const id = input.trim()
  if (!PROVIDER_ID.test(id) || BLOCKED_IDS.has(id)) throw new Error('Invalid provider id')
  return id
}

function validateModel(input: string): string {
  const model = input.trim()
  if (!model || model.length > 200) throw new Error('Model must be a non-empty string')
  return model
}

function validateApiBase(input: string, providerId: string): string {
  const value = input.trim().replace(/\/$/, '')
  if (!value) {
    if (providerId === 'custom') throw new Error('Custom providers require an API base URL')
    return ''
  }
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('API base must be a valid URL')
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('API base must use HTTP or HTTPS')
  }
  if (parsed.username || parsed.password) {
    throw new Error('API base must not contain embedded credentials')
  }
  const host = parsed.hostname.toLowerCase()
  if (host === '169.254.169.254' || host === 'metadata.google.internal') {
    throw new Error('Cloud metadata endpoints are not allowed')
  }
  const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1'
  if (parsed.protocol !== 'https:' && !isLoopback) {
    throw new Error('Remote provider endpoints must use HTTPS')
  }
  return value
}

function cloneConfig(config: catbuddyConfig): catbuddyConfig {
  return JSON.parse(JSON.stringify(config)) as catbuddyConfig
}

function copyConfig(target: catbuddyConfig, source: catbuddyConfig): void {
  for (const key of Object.keys(target) as Array<keyof catbuddyConfig>) delete target[key]
  Object.assign(target, source)
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function redactError(error: unknown, secrets: string[]): string {
  let message = error instanceof Error ? error.message : String(error)
  for (const secret of secrets) {
    if (secret) message = message.split(secret).join('[redacted]')
  }
  return message.slice(0, 500)
}

export class ProviderSettingsService {
  constructor(
    private readonly runtime: ProviderSettingsRuntime,
    private readonly credentials: ProviderCredentialStore,
  ) {}

  getSettings(): SettingsPayload {
    const config = this.runtime.config
    const activeProvider = config.agents.defaults.provider
    const providerIds = unique([
      ...PROVIDER_CATALOG.map((entry) => entry.id),
      ...Object.keys(config.providers),
    ])
    const providers = providerIds.map((id) => {
      const providerConfig = config.providers[id]
      const metadata = resolveProviderMetadata(id, providerConfig)
      const secureKey = this.credentials.get(id)?.trim() ?? ''
      const envKey = resolveProviderEnvApiKey(id)
      const configured = !!(secureKey || envKey)
      return {
        name: id,
        label: metadata.label,
        configured,
        active: id === activeProvider,
        api_key_required: metadata.apiKeyRequired,
        api_key_hint: secureKey
          ? this.credentials.hint(id)
          : envKey
            ? `Environment ••••${envKey.slice(-4)}`
            : null,
        api_base: providerConfig?.apiBase ?? null,
        default_api_base: metadata.defaultApiBase || null,
        protocol: metadata.protocol,
        recommended_models: unique([
          ...(id === activeProvider ? [config.agents.defaults.model] : []),
          ...metadata.recommendedModels,
        ]),
        capabilities: metadata.capabilities,
        credential_source: secureKey
          ? 'secure_store' as const
          : envKey
            ? 'environment' as const
            : 'none' as const,
      }
    })

    return {
      agent: {
        model: config.agents.defaults.model,
        provider: activeProvider,
        resolved_provider: activeProvider,
        has_api_key: providers.find((provider) => provider.name === activeProvider)?.configured ?? false,
      },
      providers,
      web_search: {
        provider: config.tools.web.searchProvider ?? 'ddg',
        providers: [{ name: 'ddg', label: 'DuckDuckGo', credential: 'none' }],
      },
      runtime: {
        config_path: (config as catbuddyConfig & { runtime?: { config_path?: string } }).runtime
          ?.config_path ?? '',
      },
      requires_restart: false,
      credential_storage: this.credentials.status(),
      capabilities: {
        credential_management: true,
        provider_connection_test: true,
      },
    }
  }

  updateActive(update: SettingsUpdate): SettingsPayload {
    const current = this.runtime.config.agents.defaults
    const providerId = validateProviderId(update.provider ?? current.provider)
    const providerConfig = this.runtime.config.providers[providerId]
    if (!providerConfig) throw new Error(`Provider "${providerId}" is not configured`)
    validateApiBase(providerConfig.apiBase ?? '', providerId)
    const model = validateModel(update.model ?? current.model)
    const apiKey = resolveProviderApiKey(providerId, providerConfig.apiKey)
    if (!apiKey) throw new Error(`Provider "${providerId}" does not have an API key`)

    const candidate = cloneConfig(this.runtime.config)
    candidate.agents.defaults.provider = providerId
    candidate.agents.defaults.model = model
    const provider = createProvider(candidate)
    this.commit(candidate, provider, model)
    return this.getSettings()
  }

  upsertProvider(update: ProviderSettingsUpdate): SettingsPayload {
    const providerId = validateProviderId(update.provider)
    const beforeConfig = cloneConfig(this.runtime.config)
    const previousSecret = this.credentials.get(providerId)
    const candidate = cloneConfig(this.runtime.config)
    const previous = candidate.providers[providerId] ?? {}
    const protocol = update.protocol ?? resolveProviderProtocol(providerId, previous)
    const next: ProviderConfig = {
      ...previous,
      protocol,
      ...(update.label !== undefined ? { label: update.label.trim() || providerId } : {}),
      ...(update.apiBase !== undefined
        ? { apiBase: validateApiBase(update.apiBase, providerId) }
        : {}),
      ...(update.recommendedModels !== undefined
        ? { recommendedModels: unique(update.recommendedModels) }
        : {}),
    }
    candidate.providers[providerId] = next

    try {
      if (update.apiKey?.trim()) this.credentials.set(providerId, update.apiKey)
      let activeProvider = null
      let activeModel = candidate.agents.defaults.model
      const activatesProvider = update.model !== undefined
      if (activatesProvider) {
        activeModel = validateModel(update.model!)
        validateApiBase(next.apiBase ?? '', providerId)
        candidate.agents.defaults.provider = providerId
        candidate.agents.defaults.model = activeModel
      }
      if (activatesProvider || candidate.agents.defaults.provider === providerId) {
        if (!resolveProviderApiKey(providerId, next.apiKey)) {
          throw new Error(`Provider "${providerId}" does not have an API key`)
        }
        activeProvider = createProvider(candidate)
      }
      this.commit(candidate, activeProvider, activeModel)
      return this.getSettings()
    } catch (error) {
      copyConfig(this.runtime.config, beforeConfig)
      if (previousSecret) this.credentials.set(providerId, previousSecret)
      else this.credentials.delete(providerId)
      throw error
    }
  }

  async testConnection(
    update: ProviderConnectionTestRequest,
  ): Promise<ProviderConnectionTestResult> {
    const providerId = validateProviderId(update.provider)
    const current = this.runtime.config.providers[providerId] ?? {}
    const providerConfig: ProviderConfig = {
      ...current,
      protocol: update.protocol ?? resolveProviderProtocol(providerId, current),
      ...(update.apiBase !== undefined
        ? { apiBase: validateApiBase(update.apiBase, providerId) }
        : {}),
    }
    const metadata = resolveProviderMetadata(providerId, providerConfig)
    const model = validateModel(
      update.model
      ?? (this.runtime.config.agents.defaults.provider === providerId
        ? this.runtime.config.agents.defaults.model
        : metadata.recommendedModels[0] ?? ''),
    )
    const apiKey = update.apiKey?.trim() || resolveProviderApiKey(providerId, current.apiKey)
    if (!apiKey) throw new Error(`Provider "${providerId}" does not have an API key`)
    const provider = createProviderForProfile({ providerName: providerId, providerConfig, model, apiKey })
    const startedAt = Date.now()
    try {
      const response = await provider.chat({
        messages: [{ role: 'user', content: 'Reply with OK.' }],
        model,
        maxTokens: 8,
        temperature: 0,
      })
      const latencyMs = Date.now() - startedAt
      if (response.finishReason === 'error') {
        return {
          ok: false,
          provider: providerId,
          model,
          latencyMs,
          error: redactError(response.content ?? 'Provider connection failed', [apiKey]),
          statusCode: response.errorStatusCode,
        }
      }
      return { ok: true, provider: providerId, model, latencyMs }
    } catch (error) {
      return {
        ok: false,
        provider: providerId,
        model,
        latencyMs: Date.now() - startedAt,
        error: redactError(error, [apiKey]),
      }
    }
  }

  deleteCredential(providerInput: string): SettingsPayload {
    const providerId = validateProviderId(providerInput)
    if (this.runtime.config.agents.defaults.provider === providerId) {
      throw new Error('Switch to another provider before deleting this credential')
    }
    const previousSecret = this.credentials.get(providerId)
    try {
      this.credentials.delete(providerId)
      saveConfig(this.runtime.configFile, this.runtime.config)
      return this.getSettings()
    } catch (error) {
      if (previousSecret) this.credentials.set(providerId, previousSecret)
      throw error
    }
  }

  private commit(
    candidate: catbuddyConfig,
    provider: ReturnType<typeof createProvider> | null,
    model: string,
  ): void {
    const before = cloneConfig(this.runtime.config)
    try {
      saveConfig(this.runtime.configFile, candidate)
      copyConfig(this.runtime.config, candidate)
      if (provider) this.runtime.agentLoop.applyProviderSelection(provider, model)
    } catch (error) {
      copyConfig(this.runtime.config, before)
      throw error
    }
  }
}
