/**
 * Known model definitions per provider.
 * Defined in code — no config.json editing required.
 * When no API key is configured, these defaults are shown in the UI.
 */

export interface KnownModel {
  /** Model ID used in API calls (e.g. "deepseek-v4-flash") */
  value: string
  /** Human-readable display name (e.g. "DeepSeek V4 Flash") */
  label: string
  /** Brief description shown in the model picker */
  description?: string
}

export const PROVIDER_MODELS: Record<string, KnownModel[]> = {
  deepseek: [
    { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', description: 'Best quality' },
    { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', description: 'Fast, cost-effective' },
    { value: 'deepseek-r1', label: 'DeepSeek R1', description: 'Deep reasoning' },
  ],

  openai: [
    { value: 'gpt-4.1', label: 'GPT-4.1', description: 'Latest flagship model' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', description: 'Fast, affordable' },
    { value: 'gpt-4o', label: 'GPT-4o', description: 'Omni model' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Small, fast' },
    { value: 'o4-mini', label: 'O4 Mini', description: 'Reasoning model' },
    { value: 'o3-mini', label: 'O3 Mini', description: 'Fast reasoning' },
  ],

  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', description: 'Best balance' },
    { value: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet', description: 'Fast, capable' },
    { value: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku', description: 'Fastest' },
  ],

  gemini: [
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Most capable' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Fast, efficient' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', description: 'Previous gen fast' },
  ],

  groq: [
    { value: 'llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B', description: 'Fast inference' },
    { value: 'llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick 17B', description: 'Fast, capable' },
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', description: 'Large model' },
    { value: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill 70B', description: 'Reasoning' },
  ],

  moonshot: [
    { value: 'moonshot-v1-auto', label: 'Moonshot V1 Auto', description: 'Auto tier' },
    { value: 'moonshot-v1-8k', label: 'Moonshot V1 8K', description: '8K context' },
    { value: 'moonshot-v1-32k', label: 'Moonshot V1 32K', description: '32K context' },
    { value: 'moonshot-v1-128k', label: 'Moonshot V1 128K', description: '128K context' },
  ],

  zhipu: [
    { value: 'glm-4-flash', label: 'GLM-4 Flash', description: 'Fast, free tier' },
    { value: 'glm-4-plus', label: 'GLM-4 Plus', description: 'High quality' },
    { value: 'glm-4-air', label: 'GLM-4 Air', description: 'Balanced' },
  ],

  dashscope: [
    { value: 'qwen3-max', label: 'Qwen3 Max', description: 'Most capable' },
    { value: 'qwen3-plus', label: 'Qwen3 Plus', description: 'Balanced' },
    { value: 'qwen3-flash', label: 'Qwen3 Flash', description: 'Fast, affordable' },
    { value: 'qwen-coder-plus', label: 'Qwen Coder Plus', description: 'Code generation' },
  ],

  mistral: [
    { value: 'mistral-large-latest', label: 'Mistral Large', description: 'Most capable' },
    { value: 'mistral-small-latest', label: 'Mistral Small', description: 'Fast, affordable' },
    { value: 'codestral-latest', label: 'Codestral', description: 'Code generation' },
  ],

  siliconflow: [
    { value: 'Qwen/Qwen3-235B-A22B', label: 'Qwen3 235B', description: 'Large MoE' },
    { value: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek V3', description: 'Flagship' },
    { value: 'deepseek-ai/DeepSeek-R1', label: 'DeepSeek R1', description: 'Reasoning' },
    { value: 'Pro/Qwen/Qwen3-235B-A22B', label: 'Qwen3 235B Pro', description: 'Speed optimized' },
  ],

  minimax: [
    { value: 'abab7-chat', label: 'ABAB7 Chat', description: 'Latest model' },
    { value: 'abab6.5s-chat', label: 'ABAB6.5s Chat', description: 'Fast model' },
  ],

  openrouter: [
    { value: 'openai/gpt-4.1', label: 'OpenAI GPT-4.1', description: 'Latest flagship' },
    { value: 'openai/gpt-4o', label: 'OpenAI GPT-4o', description: 'Omni model' },
    { value: 'anthropic/claude-sonnet-4-20250514', label: 'Claude Sonnet 4', description: 'Best balance' },
    { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Most capable' },
    { value: 'deepseek/deepseek-v4', label: 'DeepSeek V4', description: 'Fast, capable' },
    { value: 'deepseek/deepseek-r1', label: 'DeepSeek R1', description: 'Reasoning' },
    { value: 'meta-llama/llama-4-maverick', label: 'Llama 4 Maverick', description: 'Open model' },
  ],

  // 腾讯混元
  hunyuan: [
    { value: 'hunyuan-turbos-latest', label: 'Hunyuan TurboS', description: 'Fast inference' },
    { value: 'hunyuan-t1-latest', label: 'Hunyuan T1', description: 'Deep reasoning' },
    { value: 'hunyuan-lite', label: 'Hunyuan Lite', description: 'Lightweight' },
    { value: 'hunyuan-standard', label: 'Hunyuan Standard', description: 'Balanced' },
  ],

  // 百度文心一言
  baidu: [
    { value: 'ernie-4.5-8k', label: 'ERNIE 4.5', description: 'Latest model' },
    { value: 'ernie-4.0-turbo-8k', label: 'ERNIE 4.0 Turbo', description: 'Fast' },
    { value: 'ernie-3.5-8k', label: 'ERNIE 3.5', description: 'Balanced' },
    { value: 'ernie-speed-8k', label: 'ERNIE Speed', description: 'Fast, affordable' },
  ],

  // 字节豆包 (Volc Engine)
  volc: [
    { value: 'doubao-pro-32k', label: 'Doubao Pro 32K', description: 'Best quality' },
    { value: 'doubao-lite-32k', label: 'Doubao Lite 32K', description: 'Fast, affordable' },
    { value: 'deepseek-v3-241226', label: 'DeepSeek V3', description: 'Via Volc Engine' },
    { value: 'deepseek-r1-250120', label: 'DeepSeek R1', description: 'Reasoning via Volc' },
  ],

  // 讯飞星火
  spark: [
    { value: 'Spark4.0-128K', label: 'Spark 4.0', description: 'Latest generation' },
    { value: 'generalv3.5', label: 'Spark 3.5', description: 'General purpose' },
    { value: 'generalv3', label: 'Spark 3.0', description: 'Previous generation' },
  ],

  // 零一万物
  lingyi: [
    { value: 'yi-large', label: 'Yi Large', description: 'Most capable' },
    { value: 'yi-medium', label: 'Yi Medium', description: 'Balanced' },
    { value: 'yi-lightning', label: 'Yi Lightning', description: 'Fast inference' },
  ],

  // 商汤日日新
  sensetime: [
    { value: 'SenseChat-5', label: 'SenseChat 5', description: 'Latest model' },
    { value: 'SenseChat-4', label: 'SenseChat 4', description: 'Previous generation' },
  ],

  // 昆仑万维天工
  tiangong: [
    { value: 'tiangong-4', label: '天工 4', description: 'Latest model' },
    { value: 'tiangong-3.5', label: '天工 3.5', description: 'Previous generation' },
  ],

  // 百川智能
  baichuan: [
    { value: 'Baichuan4', label: 'Baichuan 4', description: 'Latest flagship' },
    { value: 'Baichuan3-Turbo', label: 'Baichuan 3 Turbo', description: 'Fast' },
  ],

  // GitHub Copilot (models via Azure)
  github: [
    { value: 'gpt-4o', label: 'GPT-4o', description: 'GitHub Copilot' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Copilot fast' },
    { value: 'claude-sonnet-4', label: 'Claude Sonnet 4', description: 'Via Copilot' },
  ],
}

/**
 * Get known models for a given provider.
 * Returns an empty array for unlisted providers (user can type a custom model).
 */
export function getKnownModelsForProvider(provider: string): KnownModel[] {
  return PROVIDER_MODELS[provider] ?? []
}
