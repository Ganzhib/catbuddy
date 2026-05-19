/**
 * FallbackProvider — 主模型故障时自动切换到备用模型
 * 对应原版 nanobot/providers/fallback_provider.py
 */
import { LLMProvider, type ChatStreamOpts, type ChatStreamWithRetryOpts } from './base-provider'
import type { LLMResponse } from '../../shared/types'

export class FallbackProvider extends LLMProvider {
  readonly name = 'fallback'
  readonly defaultModel: string

  private primary: LLMProvider
  private fallbacks: LLMProvider[]

  constructor(opts: {
    primary: LLMProvider
    fallbacks: LLMProvider[]
  }) {
    super()
    this.primary = opts.primary
    this.fallbacks = opts.fallbacks ?? []
    this.defaultModel = opts.primary.defaultModel

    // 继承主 provider 的 generation settings
    this.generation = { ...opts.primary.generation }
  }

  async chat(opts: ChatStreamOpts): Promise<LLMResponse> {
    return this._tryWithFallback('chat', opts)
  }

  async chatStream(opts: ChatStreamOpts): Promise<LLMResponse> {
    return this._tryWithFallback('chatStream', opts)
  }

  async chatStreamWithRetry(opts: ChatStreamWithRetryOpts): Promise<LLMResponse> {
    // fallback 自己管重试，不走 primary 的 retry
    return this._tryWithFallback('chatStream', opts)
  }

  private async _tryWithFallback(
    method: 'chat' | 'chatStream',
    opts: ChatStreamOpts,
  ): Promise<LLMResponse> {
    const providers = [this.primary, ...this.fallbacks]

    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i]
      const label = i === 0 ? 'primary' : `fallback #${i}`

      try {
        const response = await provider[method]({
          ...opts,
          model: opts.model ?? provider.defaultModel,
        })

        // 成功 → 返回
        if (response.finishReason !== 'error') {
          if (i > 0) console.log(`[fallback] Switched to ${label}: ${provider.name}/${provider.defaultModel}`)
          return response
        }

        // provider 返回了 error，判断是否是 transient
        if (this.isTransientError(response)) {
          console.warn(`[fallback] ${label} (${provider.name}) transient error, trying next...`)
          continue
        }

        // 非 transient，可能是计费/配额问题等，也值得试下一个
        console.warn(`[fallback] ${label} (${provider.name}) error: ${(response.content ?? '').slice(0, 120)}`)
        continue
      } catch (err: any) {
        console.warn(`[fallback] ${label} (${provider.name}) threw: ${err.message}`)
        continue
      }
    }

    return {
      content: 'All providers failed. Please check your API keys and network connection.',
      toolCalls: [],
      finishReason: 'error',
      usage: { inputTokens: 0, outputTokens: 0 },
    }
  }
}
