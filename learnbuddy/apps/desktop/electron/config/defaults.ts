/**
 * 默认配置 — 内嵌在 Electron 中，无需外部 config.json
 */
import type { learnbuddyConfig } from "@learnbuddy/shared"

export function getDefaultConfig(): learnbuddyConfig {
  const home = process.env.HOME || process.env.USERPROFILE || '.'
  return {
    workspace: `${home}/.learnbuddy-desktop/workspace`,
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
        apiKey: process.env.DEEPSEEK_KEY || process.env.OPENAI_API_KEY || '',
        apiBase: process.env.DEEPSEEK_BASE || 'https://api.deepseek.com/v1',
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        apiBase: process.env.OPENAI_API_BASE || 'https://api.openai.com/v1',
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
      restrictToWorkspace: false,
      exec: { enable: true },
      web: { enable: true },
      my: { enable: false, allowSet: false },
      imageGeneration: { enable: false },
    },
  }
}

export function getProviderConfig(config: learnbuddyConfig, model: string) {
  const defaults = config.agents.defaults
  const providerName = defaults.provider
  const provider = config.providers[providerName]
  if (!provider) throw new Error(`Provider '${providerName}' not configured`)
  return provider
}
