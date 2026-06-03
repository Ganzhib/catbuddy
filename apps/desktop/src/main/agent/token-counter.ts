/**
 * Token 计数器 — 基于 js-tiktoken (OpenAI tiktoken WASM 移植)
 *
 * 工业界主流 Token 计算方案对比：
 * ├── tiktoken (Python)        OpenAI 官方，Rust 实现，最快
 * ├── js-tiktoken (JS/TS)      tiktoken WASM 移植，与 OpenAI 行为完全一致 ← 当前选用
 * ├── gpt-tokenizer (JS/TS)    纯 JS，零原生依赖，速度略慢但更轻量
 * └── @anthropic-ai/tokenizer  Anthropic 官方，专门针对 Claude 模型
 *
 * 编码选择：
 * - cl100k_base: GPT-4 / GPT-3.5-turbo / text-embedding-ada-002
 *   也是 Claude 模型的最佳近似（Claude 使用类似的 BPE 分词器）
 * - o200k_base:  GPT-4o / GPT-4o-mini（更新、更高效）
 * - p50k_base:   text-davinci-003 / code-davinci-002（旧版）
 */

import { getEncoding, type Tiktoken, type TiktokenEncoding } from 'js-tiktoken'
import type { LLMMessage } from '@catbuddy/shared'

// ═══ 缓存 ═══
// 避免每次计数都创建新的 encoder 实例（js-tiktoken 纯 JS 实现，开销很小）
const encoderCache = new Map<TiktokenEncoding, Tiktoken>()

function getEncoder(encodingName: TiktokenEncoding): Tiktoken {
  let enc = encoderCache.get(encodingName)
  if (!enc) {
    enc = getEncoding(encodingName)
    encoderCache.set(encodingName, enc)
  }
  return enc
}

/**
 * 根据模型名选择合适的编码
 *
 * Claude 系列模型使用 cl100k_base 作为近似
 * （Claude 的 tokenizer 与 GPT 系列行为相似，误差 < 5%）
 */
export function getEncodingForModel(model: string): TiktokenEncoding {
  const m = model.toLowerCase()

  // GPT-4o 系列使用 o200k_base（更高效的分词）
  if (m.includes('gpt-4o')) return 'o200k_base'

  // GPT-4 / GPT-3.5 / Claude / DeepSeek 等使用 cl100k_base
  // Claude 的 tokenizer 与 GPT 系列行为相似，误差 < 5%
  return 'cl100k_base'
}

/**
 * 精确计算文本的 token 数
 */
export function countTokens(text: string, encoding: TiktokenEncoding = 'cl100k_base'): number {
  if (!text) return 0
  const encoder = getEncoder(encoding)
  return encoder.encode(text).length
}

/**
 * 精确计算单条 LLM 消息的 token 数
 *
 * 计算规则（遵循 OpenAI token 计算规范）：
 * - 每条消息有固定开销（role + formatting），约 4 tokens
 * - content 文本 token 数
 * - tool_calls 参数 JSON token 数
 * - name 字段 token 数（如果有）
 */
export function countMessageTokens(msg: LLMMessage, encoding: TiktokenEncoding = 'cl100k_base'): number {
  const encoder = getEncoder(encoding)

  // 消息格式固定开销（role + 分隔符等）
  // 参考: https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb
  const MESSAGE_OVERHEAD = 4
  let total = MESSAGE_OVERHEAD

  // content tokens
  if (typeof msg.content === 'string') {
    total += encoder.encode(msg.content).length
  } else if (Array.isArray(msg.content)) {
    // 多模态 content 数组
    for (const part of msg.content) {
      if (typeof part === 'object' && part !== null && 'text' in part) {
        total += encoder.encode(String((part as { text: string }).text)).length
      }
    }
  }

  // name 字段
  if ('name' in msg && msg.name) {
    total += encoder.encode(msg.name).length
  }

  // tool_calls 参数
  if (msg.toolCalls) {
    for (const tc of msg.toolCalls) {
      total += encoder.encode(tc.name).length // function name
      if (tc.arguments) {
        const argsStr = typeof tc.arguments === 'string'
          ? tc.arguments
          : JSON.stringify(tc.arguments)
        total += encoder.encode(argsStr).length
      }
    }
  }

  return total
}

/**
 * 安全估算 token 数（不抛出异常）
 * 如果 js-tiktoken 初始化失败（如某些受限 WASM 环境），
 * 回退到字符/3 的粗略估算
 */
export function safeCountTokens(text: string, encoding?: TiktokenEncoding): number {
  try {
    return countTokens(text, encoding)
  } catch {
    // 回退：英文约 4 字符/token，中文约 1.5 字符/token，取加权平均 ~3
    return Math.ceil(text.length / 3)
  }
}

/**
 * 批量计算消息列表的 token 数
 */
export function countMessagesTokens(
  messages: LLMMessage[],
  model?: string
): number {
  const encoding = model ? getEncodingForModel(model) : 'cl100k_base'
  let total = 0
  for (const msg of messages) {
    total += countMessageTokens(msg, encoding)
  }
  // 加上回复 priming（提示模型开始回复），约 3 tokens
  const PRIMING_OVERHEAD = 3
  return total + PRIMING_OVERHEAD
}

/**
 * 释放所有缓存的 encoder 引用
 *
 * js-tiktoken 是纯 JS 实现，encoder 对象没有需要手动释放的 WASM 资源，
 * 直接清空 Map 让 GC 回收即可。
 * （注意：只有 WASM 版本的 @dqbd/tiktoken 才需要调用 .free()）
 */
export function disposeTokenCounters(): void {
  encoderCache.clear()
}
