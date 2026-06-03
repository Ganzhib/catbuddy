import type { catbuddyConfig, SettingsPayload } from '@catbuddy/shared'
import { getKnownModelsForProvider } from './model-registry.js'

/** Env fallbacks for built-in providers (never persisted — see `stripEnvProviderKeys`). */
export function resolveProviderApiKey(providerName: string, stored?: string): string {
  const fromConfig = stored?.trim() ?? ''
  if (fromConfig) return fromConfig
  const envMap: Record<string, string[]> = {
    deepseek: ['DEEPSEEK_KEY', 'DEEPSEEK_API_KEY'],
    openai: ['OPENAI_API_KEY'],
    anthropic: ['ANTHROPIC_API_KEY'],
    gemini: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'],
    groq: ['GROQ_API_KEY'],
    moonshot: ['MOONSHOT_API_KEY'],
    zhipu: ['ZHIPU_API_KEY'],
    dashscope: ['DASHSCOPE_API_KEY'],
    mistral: ['MISTRAL_API_KEY'],
    siliconflow: ['SILICONFLOW_API_KEY'],
    minimax: ['MINIMAX_API_KEY'],
    openrouter: ['OPENROUTER_API_KEY'],
    hunyuan: ['HUNYUAN_API_KEY', 'HUNYUAN_SECRET_KEY'],
    baidu: ['BAIDU_API_KEY'],
    volc: ['VOLC_API_KEY', 'VOLC_ACCESS_KEY'],
    spark: ['SPARK_API_KEY', 'SPARK_APP_ID'],
    lingyi: ['LINGYI_API_KEY'],
    sensetime: ['SENSETIME_API_KEY'],
    tiangong: ['TIANGONG_API_KEY'],
    baichuan: ['BAICHUAN_API_KEY'],
    github: ['GITHUB_TOKEN'],
  }
  const keys = envMap[providerName] ?? []
  for (const key of keys) {
    const val = process.env[key]?.trim()
    if (val) return val
  }
  return ''
}

export function resolveProviderApiBase(providerName: string, stored?: string): string | undefined {
  const fromConfig = stored?.trim()
  if (fromConfig) return fromConfig
  const envMap: Record<string, { envKey: string; defaultUrl: string }> = {
    deepseek: { envKey: 'DEEPSEEK_BASE', defaultUrl: 'https://api.deepseek.com/v1' },
    openai: { envKey: 'OPENAI_API_BASE', defaultUrl: 'https://api.openai.com/v1' },
    anthropic: { envKey: 'ANTHROPIC_BASE_URL', defaultUrl: 'https://api.anthropic.com/v1' },
    gemini: { envKey: 'GEMINI_BASE_URL', defaultUrl: 'https://generativelanguage.googleapis.com/v1' },
    groq: { envKey: 'GROQ_BASE_URL', defaultUrl: 'https://api.groq.com/openai/v1' },
    moonshot: { envKey: 'MOONSHOT_BASE_URL', defaultUrl: 'https://api.moonshot.cn/v1' },
    zhipu: { envKey: 'ZHIPU_BASE_URL', defaultUrl: 'https://open.bigmodel.cn/api/paas/v4' },
    dashscope: { envKey: 'DASHSCOPE_BASE_URL', defaultUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
    mistral: { envKey: 'MISTRAL_BASE_URL', defaultUrl: 'https://api.mistral.ai/v1' },
    siliconflow: { envKey: 'SILICONFLOW_BASE_URL', defaultUrl: 'https://api.siliconflow.cn/v1' },
    minimax: { envKey: 'MINIMAX_BASE_URL', defaultUrl: 'https://api.minimax.chat/v1' },
    openrouter: { envKey: 'OPENROUTER_BASE_URL', defaultUrl: 'https://openrouter.ai/api/v1' },
    hunyuan: { envKey: 'HUNYUAN_BASE_URL', defaultUrl: 'https://api.hunyuan.cloud.tencent.com/v1' },
    baidu: { envKey: 'BAIDU_BASE_URL', defaultUrl: 'https://qianfan.baidubce.com/v2' },
    volc: { envKey: 'VOLC_BASE_URL', defaultUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
    spark: { envKey: 'SPARK_BASE_URL', defaultUrl: 'https://spark-api-open.xf-yun.com/v1' },
    lingyi: { envKey: 'LINGYI_BASE_URL', defaultUrl: 'https://api.lingyiwanwu.com/v1' },
    sensetime: { envKey: 'SENSETIME_BASE_URL', defaultUrl: 'https://api.sensetime.com/v1' },
    tiangong: { envKey: 'TIANGONG_BASE_URL', defaultUrl: 'https://api.tiangong.cn/v1' },
    baichuan: { envKey: 'BAICHUAN_BASE_URL', defaultUrl: 'https://api.baichuan-ai.com/v1' },
    github: { envKey: 'GITHUB_BASE_URL', defaultUrl: 'https://api.githubcopilot.com/v1' },
  }
  const entry = envMap[providerName]
  if (entry) {
    return process.env[entry.envKey]?.trim() || entry.defaultUrl
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
  const providerLabels: Record<string, string> = {
    deepseek: 'DeepSeek',
    openai: 'OpenAI',
    anthropic: 'Anthropic Claude',
    gemini: 'Google Gemini',
    groq: 'Groq',
    moonshot: '月之暗面 Moonshot',
    zhipu: '智谱 GLM',
    dashscope: '阿里通义千问',
    mistral: 'Mistral AI',
    siliconflow: '硅基流动 SiliconFlow',
    minimax: 'MiniMax',
    openrouter: 'OpenRouter',
    hunyuan: '腾讯混元',
    baidu: '百度文心一言',
    volc: '字节豆包',
    spark: '讯飞星火',
    lingyi: '零一万物 Yi',
    sensetime: '商汤日日新',
    tiangong: '昆仑万维天工',
    baichuan: '百川智能',
    github: 'GitHub Copilot',
  }
  return {
    agent: {
      model: config.agents.defaults.model,
      provider: defaultProvider,
      resolved_provider: defaultProvider,
      has_api_key: isProviderConfigured(
        defaultProvider,
        config.providers[defaultProvider]?.apiKey,
      ),
      model_options: buildModelOptions(config),
    },
    providers: Object.entries(config.providers).map(([name, p]) => ({
      name,
      label: providerLabels[name] ?? name,
      configured: isProviderConfigured(name, p.apiKey),
      api_key_required: true,
      api_key_hint: null,
      api_base: p.apiBase ?? null,
      default_api_base: resolveProviderApiBase(name, p.apiBase) ?? null,
    })),
    web_search: {
      provider: config.tools?.web?.searchProvider ?? 'ddg',
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

function buildModelOptions(
  config: catbuddyConfig,
): Record<string, Array<{ value: string; label: string; description?: string }>> {
  const options: Record<string, Array<{ value: string; label: string; description?: string }>> = {}
  for (const providerName of Object.keys(config.providers)) {
    const models = getKnownModelsForProvider(providerName)
    if (models.length > 0) {
      options[providerName] = models
    }
  }
  return options
}
