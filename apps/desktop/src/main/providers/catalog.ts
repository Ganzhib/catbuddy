import type {
  ProviderCapabilities,
  ProviderConfig,
  ProviderProtocol,
} from '@catbuddy/shared'

export interface ProviderCatalogEntry {
  id: string
  label: string
  protocol: ProviderProtocol
  defaultApiBase: string
  recommendedModels: string[]
  capabilities: ProviderCapabilities
  apiKeyRequired: boolean
}

const OPENAI_CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  toolCalling: true,
  vision: true,
  reasoning: true,
}

export const PROVIDER_CATALOG: readonly ProviderCatalogEntry[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    protocol: 'anthropic',
    defaultApiBase: 'https://api.anthropic.com',
    recommendedModels: ['claude-sonnet-4-6', 'claude-sonnet-5'],
    capabilities: { ...OPENAI_CAPABILITIES },
    apiKeyRequired: true,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    protocol: 'openai-compatible',
    defaultApiBase: 'https://api.openai.com/v1',
    recommendedModels: ['gpt-4.1', 'gpt-5.6-terra', 'gpt-5.6-sol'],
    capabilities: { ...OPENAI_CAPABILITIES },
    apiKeyRequired: true,
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    protocol: 'openai-compatible',
    defaultApiBase: 'https://api.deepseek.com',
    recommendedModels: ['deepseek-flash', 'deepseek-v4-pro'],
    capabilities: {
      streaming: true,
      toolCalling: true,
      vision: false,
      reasoning: true,
    },
    apiKeyRequired: true,
  },
  {
    id: 'custom',
    label: 'Custom OpenAI Compatible',
    protocol: 'openai-compatible',
    defaultApiBase: '',
    recommendedModels: [],
    capabilities: { ...OPENAI_CAPABILITIES },
    apiKeyRequired: true,
  },
] as const

export function findProviderCatalogEntry(id: string): ProviderCatalogEntry | undefined {
  return PROVIDER_CATALOG.find((entry) => entry.id === id)
}

export function resolveProviderProtocol(
  providerName: string,
  config?: ProviderConfig,
): ProviderProtocol {
  return config?.protocol
    ?? findProviderCatalogEntry(providerName)?.protocol
    ?? 'openai-compatible'
}

export function resolveProviderMetadata(
  providerName: string,
  config?: ProviderConfig,
): ProviderCatalogEntry {
  const catalog = findProviderCatalogEntry(providerName)
  const protocol = resolveProviderProtocol(providerName, config)
  return {
    id: providerName,
    label: config?.label?.trim() || catalog?.label || providerName,
    protocol,
    defaultApiBase: catalog?.defaultApiBase ?? '',
    recommendedModels: config?.recommendedModels ?? catalog?.recommendedModels ?? [],
    capabilities: {
      ...(catalog?.capabilities ?? OPENAI_CAPABILITIES),
      ...(config?.capabilities ?? {}),
    },
    apiKeyRequired: catalog?.apiKeyRequired ?? true,
  }
}
