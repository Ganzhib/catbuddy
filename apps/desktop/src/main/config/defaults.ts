/**
 * 默认配置 — 内嵌在 Electron 中，无需外部 config.json
 */
import type { catbuddyConfig } from "@catbuddy/shared"
import {
  resolveProviderApiBase,
  resolveProviderApiKey,
} from './env-provider-fallback.js'

export function getDefaultConfig(): catbuddyConfig {
  const home = process.env.HOME || process.env.USERPROFILE || '.'
  return {
    workspace: `${home}/.catbuddy/workspace`,
    agents: {
      defaults: {
        model: 'deepseek-v4-flash',
        provider: 'deepseek',
        maxToolIterations: 50,
        contextWindowTokens: 128_000,
        maxToolResultChars: 8000,
        maxMessages: 120,
        temperature: 0.7,
        maxTokens: 8192,
        timezone: 'Asia/Shanghai',
        sessionTtlMinutes: 0,
        dreamIntervalMinutes: 120,
        heartbeatIntervalMinutes: 30,
        heartbeatEnabled: true,
        consolidationRatio: 0.5,
        disabledSkills: [],
        unifiedSession: false,
        providerRetryMode: 'standard',
        modelPreset: undefined,
        fallbackModels: [],
      },
    },
    providers: {
      deepseek: {
        apiKey: resolveProviderApiKey('deepseek'),
        apiBase: resolveProviderApiBase('deepseek'),
      },
      openai: {
        apiKey: resolveProviderApiKey('openai'),
        apiBase: resolveProviderApiBase('openai'),
      },
    },
    modelPresets: {},
    channels: {
      sendProgress: true,
      sendToolHints: true,
      showReasoning: true,
      sendMaxRetries: 3,
    },
    gateway: {
      remoteEnabled: false,
    },
    tools: {
      restrictToWorkspace: true,
      exec: { enable: true },
      web: { enable: true },
      my: { enable: false, allowSet: false },
      imageGeneration: { enable: false },
    },
  }
}

export function normalizeConfigWithDefaults(config: catbuddyConfig): boolean {
  const defaults = getDefaultConfig()
  let changed = false

  config.agents ??= defaults.agents
  config.agents.defaults ??= defaults.agents.defaults
  config.providers ??= defaults.providers

  if (!config.agents.defaults.model?.trim()) {
    config.agents.defaults.model = defaults.agents.defaults.model
    changed = true
  }

  const provider = config.agents.defaults.provider?.trim()
  if (!provider || !config.providers[provider]) {
    const inferred = inferProviderFromModel(provider || config.agents.defaults.model)
    const nextProvider = inferred && config.providers[inferred]
      ? inferred
      : defaults.agents.defaults.provider
    if (config.agents.defaults.provider !== nextProvider) {
      console.warn(
        `[config] Provider "${provider || '(empty)'}" is not configured; using "${nextProvider}".`,
      )
      config.agents.defaults.provider = nextProvider
      changed = true
    }
  }

  for (const [name, providerConfig] of Object.entries(defaults.providers)) {
    config.providers[name] ??= providerConfig
  }

  return changed
}

function inferProviderFromModel(model: string): string | undefined {
  const normalized = model.trim().toLowerCase()
  if (normalized.startsWith('deepseek')) return 'deepseek'
  if (normalized.startsWith('gpt-') || normalized.startsWith('o1') || normalized.startsWith('o3') || normalized.startsWith('o4')) return 'openai'
  if (normalized.startsWith('claude')) return 'anthropic'
  return undefined
}

export function getProviderConfig(config: catbuddyConfig, model: string) {
  const defaults = config.agents.defaults
  const providerName = defaults.provider
  const provider = config.providers[providerName]
  if (!provider) throw new Error(`Provider '${providerName}' not configured`)
  return provider
}
