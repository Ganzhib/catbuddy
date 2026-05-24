/**
 * Helpers for runtime model preset selection.
 * 对应 example/agent/model_presets.py
 */
import type { LLMProvider } from '../providers/base-provider'
import type { catbuddyConfig, ModelPresetConfig } from '@catbuddy/shared'
import { createProvider } from '../providers/factory'

export interface ProviderSnapshot {
  provider: LLMProvider
  model: string
  contextWindowTokens: number
  signature: readonly unknown[]
}

export type PresetSnapshotLoader = (name: string) => ProviderSnapshot

export function defaultSelectionSignature(
  signature: readonly unknown[] | null,
): readonly unknown[] | null {
  return signature ? signature.slice(0, 2) : null
}

export function configuredModelPresets(
  config: catbuddyConfig,
): Record<string, ModelPresetConfig> {
  const presets = { ...(config.modelPresets ?? {}) }
  const defaults = config.agents.defaults
  presets.default = {
    model: defaults.model,
    provider: defaults.provider,
    contextWindowTokens: defaults.contextWindowTokens,
    maxTokens: defaults.maxTokens,
    temperature: defaults.temperature,
  }
  return presets
}

export function buildProviderSnapshot(
  config: catbuddyConfig,
  presetName?: string,
): ProviderSnapshot {
  const presets = configuredModelPresets(config)
  const name = presetName ?? 'default'
  const preset = presets[name]
  if (!preset) {
    throw new Error(
      `model_preset ${JSON.stringify(name)} not found. Available: ${
        Object.keys(presets).join(', ') || '(none)'
      }`,
    )
  }
  const providerName = preset.provider ?? config.agents.defaults.provider
  const provider = createProvider({
    ...config,
    agents: {
      ...config.agents,
      defaults: {
        ...config.agents.defaults,
        model: preset.model,
        provider: providerName,
        contextWindowTokens:
          preset.contextWindowTokens ?? config.agents.defaults.contextWindowTokens,
        maxTokens: preset.maxTokens ?? config.agents.defaults.maxTokens,
        temperature: preset.temperature ?? config.agents.defaults.temperature,
      },
    },
  })
  return {
    provider,
    model: preset.model,
    contextWindowTokens:
      preset.contextWindowTokens ?? config.agents.defaults.contextWindowTokens,
    signature: ['model_preset', name, JSON.stringify(preset)] as const,
  }
}

export function makePresetSnapshotLoader(
  config: catbuddyConfig,
): PresetSnapshotLoader {
  return (name) => buildProviderSnapshot(config, name)
}

export function normalizePresetName(
  name: string | null | undefined,
  presets: Record<string, ModelPresetConfig>,
): string {
  if (!name || !name.trim()) {
    throw new Error('model_preset must be a non-empty string')
  }
  const trimmed = name.trim()
  if (!(trimmed in presets)) {
    throw new Error(
      `model_preset ${JSON.stringify(trimmed)} not found. Available: ${
        Object.keys(presets).join(', ') || '(none)'
      }`,
    )
  }
  return trimmed
}
