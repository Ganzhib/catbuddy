/**
 * Anthropic Provider — 使用 @anthropic-ai/sdk
 */
import Anthropic from '@anthropic-ai/sdk'
import { LLMProvider, type ChatStreamOpts } from './base-provider'
import type { LLMResponse, ToolCallRequest } from '../../shared/types'

export class AnthropicProvider extends LLMProvider {
  readonly name = 'anthropic'

  private client: Anthropic

  constructor(opts: { apiKey: string; apiBase?: string; defaultModel?: string }) {
    super()
    this.defaultModel = opts.defaultModel ?? 'claude-sonnet-4-20250514'
    this.client = new Anthropic({
      apiKey: opts.apiKey,
      baseURL: opts.apiBase,
    })
  }

  async chat(opts: ChatStreamOpts): Promise<LLMResponse> {
    try {
      const msgs = this.toAnthropicMessages(opts.messages)
      const systemMsg = this.extractSystem(opts.messages)

      const response = await this.client.messages.create({
        model: opts.model ?? this.defaultModel,
        max_tokens: opts.maxTokens ?? this.generation.maxTokens,
        system: systemMsg,
        messages: msgs,
        tools: opts.tools?.map(this.toAnthropicTool),
      })

      return this.parseResponse(response)
    } catch (err: any) {
      return this.errorResponse(err)
    }
  }

  async chatStream(opts: ChatStreamOpts): Promise<LLMResponse> {
    try {
      const msgs = this.toAnthropicMessages(opts.messages)
      const systemMsg = this.extractSystem(opts.messages)

      const stream = await this.client.messages.stream({
        model: opts.model ?? this.defaultModel,
        max_tokens: opts.maxTokens ?? this.generation.maxTokens,
        system: systemMsg,
        messages: msgs,
        tools: opts.tools?.map(this.toAnthropicTool),
      })

      let content = ''
      const toolCalls: ToolCallRequest[] = []

      stream.on('text', (text) => {
        content += text
        opts.onContentDelta?.(text)
      })

      const final = await stream.finalMessage()
      return this.parseResponse(final)
    } catch (err: any) {
      return this.errorResponse(err)
    }
  }

  private extractSystem(messages: import('../../shared/types').LLMMessage[]): string {
    return messages
      .filter(m => m.role === 'system')
      .map(m => (typeof m.content === 'string' ? m.content : ''))
      .join('\n\n')
  }

  private toAnthropicMessages(messages: import('../../shared/types').LLMMessage[]): any[] {
    return messages
      .filter(m => m.role !== 'system')
      .map(m => {
        if (m.role === 'assistant' && m.toolCalls?.length) {
          return {
            role: 'assistant',
            content: m.toolCalls.map(tc => ({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            })),
          }
        }
        if (m.role === 'tool') {
          return {
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: m.toolCallId,
              content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
            }],
          }
        }
        return { role: m.role, content: m.content }
      })
  }

  private toAnthropicTool(tool: any) {
    return {
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters,
    }
  }

  private parseResponse(response: any): LLMResponse {
    const blocks = response.content ?? []
    const textBlocks = blocks.filter((b: any) => b.type === 'text')
    const toolBlocks = blocks.filter((b: any) => b.type === 'tool_use')

    return {
      content: textBlocks.map((b: any) => b.text).join('\n') || null,
      toolCalls: toolBlocks.map((b: any) => ({
        id: b.id,
        name: b.name,
        arguments: b.input ?? {},
      })),
      finishReason: toolBlocks.length > 0 ? 'tool_calls' : 'stop',
      usage: {
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
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
