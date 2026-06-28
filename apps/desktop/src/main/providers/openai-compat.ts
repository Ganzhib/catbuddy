/**
 * OpenAI 鍏煎 Provider 鈥?鏀寔 OpenAI / DeepSeek / Ollama / vLLM 绛?
 */
import OpenAI from 'openai'
import { LLMProvider, type ChatStreamOpts } from './base-provider'
import type { ContentBlock, LLMMessage, LLMResponse, ToolCallRequest } from "@catbuddy/shared"

/** DeepSeek chat/completions only accepts string content (text), not OpenAI image_url parts. */
function inferSupportsVision(apiBase?: string, providerName?: string): boolean {
  const base = (apiBase ?? '').toLowerCase()
  const name = (providerName ?? '').toLowerCase()
  if (name === 'deepseek' || base.includes('deepseek.com')) return false
  return true
}

/** Whether the upstream API accepts ``stream_options.include_usage`` on chat completions. */
function inferStreamUsage(apiBase?: string, providerName?: string): boolean {
  const base = (apiBase ?? '').toLowerCase()
  const name = (providerName ?? '').toLowerCase()
  if (name === 'deepseek' || base.includes('deepseek.com')) return false
  if (base.includes('localhost') || base.includes('127.0.0.1') || base.includes('ollama')) return false
  return true
}

function formatContentForApi(
  content: LLMMessage['content'],
  supportsVision: boolean,
): string | ContentBlock[] | null {
  if (content == null) return null
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return null

  const textParts: string[] = []
  let imageCount = 0
  for (const block of content) {
    if (block.type === 'text' && block.text) textParts.push(block.text)
    else if (block.type === 'image_url') imageCount++
  }

  if (imageCount === 0) return textParts.join('\n\n') || null
  if (supportsVision) return content

  textParts.push(
    `[${imageCount} attached image(s) not sent: this provider only accepts text. ` +
      `Describe the image in your message, or switch to a vision-capable model.]`,
  )
  return textParts.join('\n\n')
}

export class OpenAICompatProvider extends LLMProvider {
  readonly name = 'openai_compat'

  private client: OpenAI
  private readonly supportsVision: boolean
  private readonly supportsStreamUsage: boolean

  constructor(opts: {
    apiKey: string
    apiBase?: string
    defaultModel?: string
    providerName?: string
    supportsVision?: boolean
  }) {
    super()
    this.defaultModel = opts.defaultModel ?? 'gpt-4o'
    this.supportsVision =
      opts.supportsVision ?? inferSupportsVision(opts.apiBase, opts.providerName)
    this.supportsStreamUsage = inferStreamUsage(opts.apiBase, opts.providerName)
    this.client = new OpenAI({
      apiKey: opts.apiKey || 'sk-placeholder',
      baseURL: opts.apiBase || 'https://api.openai.com/v1',
      maxRetries: 0, // 鑷繁绠＄悊閲嶈瘯
    })
  }

  async chat(opts: ChatStreamOpts): Promise<LLMResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: opts.model ?? this.defaultModel,
        messages: this.toOpenAIMessages(opts.messages) as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        tools: opts.tools?.map(t => ({ type: 'function' as const, function: t.function })),
        tool_choice: opts.toolChoice as any,
        max_tokens: opts.maxTokens ?? this.generation.maxTokens,
        temperature: opts.temperature ?? this.generation.temperature,
      })
      return this.parseResponse(response)
    } catch (err: any) {
      return this.errorResponse(err)
    }
  }

  async chatStream(opts: ChatStreamOpts): Promise<LLMResponse> {
    try {
      let content = ''
      let reasoningContent = ''
      let inputTokens = 0
      let outputTokens = 0
      const toolCallMap = new Map<number, { id: string; name: string; args: string }>()

      const stream = await this.client.chat.completions.create({
        model: opts.model ?? this.defaultModel,
        messages: this.toOpenAIMessages(opts.messages) as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        tools: opts.tools?.map(t => ({ type: 'function' as const, function: t.function })),
        tool_choice: opts.toolChoice as any,
        max_tokens: opts.maxTokens ?? this.generation.maxTokens,
        temperature: opts.temperature ?? this.generation.temperature,
        stream: true,
        ...(this.supportsStreamUsage ? { stream_options: { include_usage: true } } : {}),
      })

      for await (const chunk of stream) {
        const usage = chunk.usage
        if (usage) {
          inputTokens = usage.prompt_tokens ?? inputTokens
          outputTokens = usage.completion_tokens ?? outputTokens
        }
        const delta = chunk.choices?.[0]?.delta
        if (!delta) continue

        const reasoningDelta = (delta as { reasoning_content?: string }).reasoning_content
        if (reasoningDelta) {
          reasoningContent += reasoningDelta
          await opts.onThinkingDelta?.(reasoningDelta)
        }

        if (delta.content) {
          content += delta.content
          await opts.onContentDelta?.(delta.content)
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index
            if (!toolCallMap.has(idx)) {
              toolCallMap.set(idx, { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' })
            }
            const entry = toolCallMap.get(idx)!
            if (tc.id) entry.id = tc.id
            if (tc.function?.name) entry.name = tc.function.name
            if (tc.function?.arguments) entry.args += tc.function.arguments
          }
        }
      }

      const toolCalls: ToolCallRequest[] = [...toolCallMap.values()]
        .filter(tc => tc.name)
        .map(tc => ({
          id: tc.id,
          name: tc.name,
          arguments: safeParseJSON(tc.args, {}),
        }))

      return {
        content: content || null,
        toolCalls,
        finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
        usage: { inputTokens, outputTokens },
        reasoningContent: reasoningContent || undefined,
      }
    } catch (err: any) {
      return this.errorResponse(err)
    }
  }

  private toOpenAIMessages(messages: LLMMessage[]) {
    return this.enforceRoleAlternation(messages).map((m) => {
      const row: Record<string, unknown> = {
        role: m.role,
        content: formatContentForApi(m.content, this.supportsVision),
        tool_calls: m.toolCalls?.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
        tool_call_id: m.toolCallId,
        name: m.name,
      }
      if (m.role === 'assistant') {
        const hasTools = (m.toolCalls?.length ?? 0) > 0
        const reasoning = m.reasoningContent ?? ''
        if (hasTools || reasoning) {
          row.reasoning_content = reasoning
        }
      }
      return row
    })
  }

  private parseResponse(response: any): LLMResponse {
    const choice = response.choices?.[0]
    const msg = choice?.message

    const toolCalls: ToolCallRequest[] = (msg?.tool_calls ?? []).map((tc: any) => ({
      id: tc.id,
      name: tc.function?.name ?? '',
      arguments: safeParseJSON(tc.function?.arguments ?? '{}', {}),
    }))

    const reasoningContent =
      typeof (msg as { reasoning_content?: string })?.reasoning_content === 'string'
        ? (msg as { reasoning_content: string }).reasoning_content
        : undefined

    return {
      content: msg?.content ?? null,
      toolCalls,
      finishReason: choice?.finish_reason ?? 'stop',
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
      reasoningContent: reasoningContent || undefined,
    }
  }

  private errorResponse(err: any): LLMResponse {
    const status = err.status ?? err.response?.status
    return {
      content: err.message ?? String(err),
      toolCalls: [],
      finishReason: 'error',
      usage: { inputTokens: 0, outputTokens: 0 },
      errorStatusCode: status,
      errorKind: status === 429 ? 'rate_limit' : status >= 500 ? 'server_error' : undefined,
    }
  }
}

function safeParseJSON(raw: string, fallback: any) {
  try { return JSON.parse(raw) } catch { return fallback }
}
