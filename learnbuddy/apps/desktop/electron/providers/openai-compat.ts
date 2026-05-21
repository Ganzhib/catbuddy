/**
 * OpenAI 鍏煎 Provider 鈥?鏀寔 OpenAI / DeepSeek / Ollama / vLLM 绛?
 */
import OpenAI from 'openai'
import { LLMProvider, type ChatStreamOpts } from './base-provider'
import type { LLMResponse, ToolCallRequest } from "@learnbuddy/shared"

export class OpenAICompatProvider extends LLMProvider {
  readonly name = 'openai_compat'

  private client: OpenAI

  constructor(opts: { apiKey: string; apiBase?: string; defaultModel?: string }) {
    super()
    this.defaultModel = opts.defaultModel ?? 'gpt-4o'
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
        messages: this.toOpenAIMessages(opts.messages),
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
      const stream = await this.client.chat.completions.create({
        model: opts.model ?? this.defaultModel,
        messages: this.toOpenAIMessages(opts.messages),
        tools: opts.tools?.map(t => ({ type: 'function' as const, function: t.function })),
        tool_choice: opts.toolChoice as any,
        max_tokens: opts.maxTokens ?? this.generation.maxTokens,
        temperature: opts.temperature ?? this.generation.temperature,
        stream: true,
      })

      let content = ''
      const toolCallMap = new Map<number, { id: string; name: string; args: string }>()

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta
        if (!delta) continue

        if (delta.content) {
          content += delta.content
          await opts.onContentDelta?.(delta.content)
        }

        // 绱Н tool_calls delta
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
        usage: { inputTokens: 0, outputTokens: 0 },
      }
    } catch (err: any) {
      return this.errorResponse(err)
    }
  }

  private toOpenAIMessages(messages: import('@learnbuddy/shared').LLMMessage[]) {
    return this.enforceRoleAlternation(messages).map(m => ({
      role: m.role as any,
      content: m.content as any,
      tool_calls: m.toolCalls?.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      })),
      tool_call_id: m.toolCallId,
      name: m.name,
    }))
  }

  private parseResponse(response: any): LLMResponse {
    const choice = response.choices?.[0]
    const msg = choice?.message

    const toolCalls: ToolCallRequest[] = (msg?.tool_calls ?? []).map((tc: any) => ({
      id: tc.id,
      name: tc.function?.name ?? '',
      arguments: safeParseJSON(tc.function?.arguments ?? '{}', {}),
    }))

    return {
      content: msg?.content ?? null,
      toolCalls,
      finishReason: choice?.finish_reason ?? 'stop',
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
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
