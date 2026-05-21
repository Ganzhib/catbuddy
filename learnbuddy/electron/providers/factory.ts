/**
 * Provider 工厂 — 根据配置创建 LLM Provider 实例
 */
import { OpenAICompatProvider } from './openai-compat'
import { AnthropicProvider } from './anthropic'
import { FallbackProvider } from './fallback'
import type { LLMProvider } from './base-provider'
import type { learnbuddyConfig } from '../../shared/types'
/**
 * 
 * @param params    创建 Provider 的参数
 * @returns 
 */
function makeProvider(params: {
  model: string
  providerName?: string
  apiKey: string
  apiBase?: string
}): LLMProvider {
  const { model, apiKey, apiBase } = params
  if (apiBase?.includes('anthropic')) {
    return new AnthropicProvider({ apiKey, apiBase, defaultModel: model })
  }
  return new OpenAICompatProvider({ apiKey, apiBase, defaultModel: model })
}

export function createProvider(config: learnbuddyConfig): LLMProvider {
  const defaults = config.agents.defaults
  const primary = buildProvider(config, defaults.model, defaults.provider)

  // Fallback 链
  const fallbackModels = config.agents.defaults.fallbackModels ?? []
  if (fallbackModels.length === 0) return primary

  const fallbacks: LLMProvider[] = []
  for (const fb of fallbackModels) {
    try {
      if (typeof fb === 'string') {
        // 引用 model_presets 中的 preset
        const preset = config.modelPresets?.[fb]
        if (preset) {
          fallbacks.push(buildProvider(config, preset.model, preset.provider ?? defaults.provider))
        }
      } else {
        // InlineFallbackConfig
        fallbacks.push(buildProvider(config, fb.model, fb.provider))
      }
    } catch (err: any) {
      console.warn(`[factory] Failed to init fallback "${typeof fb === 'string' ? fb : fb.model}": ${err.message}`)
    }
  }

  if (fallbacks.length === 0) return primary

  return new FallbackProvider({ primary, fallbacks })
}

function buildProvider(config: learnbuddyConfig, model: string, providerName: string): LLMProvider {
  const providerCfg = config.providers[providerName]
  if (!providerCfg) {
    throw new Error(
      `Provider "${providerName}" not configured. ` +
      `Set API keys in Settings or config file.`,
    )
  }
  return makeProvider({
    model,
    providerName,
    apiKey: providerCfg.apiKey,
    apiBase: providerCfg.apiBase,
  })
}
