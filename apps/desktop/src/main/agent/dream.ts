/**
 * Dream — 两阶段记忆处理器
 *
 * 周期性地从历史记录中提取结构化记忆。
 *
 * 改进（相对原始版本）：
 * 1. 格式验证 — LLM 输出必须包含 ## User Profile / ## Project Context 头部
 * 2. 自动重试 — 格式不合法时重试 1 次，附带模板指令
 * 3. 优雅降级 — 重试仍失败时存储原始输出而非丢弃
 * 4. 空内容防护 — 不覆盖已有记忆为空
 * 5. 内容熵检测 — 过滤纯空占位符的输出
 */

import type { LLMProvider } from '../providers'
import { LayeredMemoryStore } from './layered-memory.js'
import { memoryExtractionPrompt } from './layered-memory.js'

// ── 格式常量 ────────────────────────────────────────────────
const REQUIRED_HEADERS = ['## User Profile', '## Project Context']
const MIN_CONTENT_LENGTH = 20

// ── 格式验证 ────────────────────────────────────────────────
interface ValidationResult {
  valid: boolean
  reason?: string
}

function validateFormat(output: string): ValidationResult {
  const trimmed = output.trim()
  if (!trimmed) return { valid: false, reason: 'empty output' }
  if (trimmed.length < MIN_CONTENT_LENGTH)
    return { valid: false, reason: `too short (${trimmed.length} chars)` }

  for (const header of REQUIRED_HEADERS) {
    if (!trimmed.includes(header))
      return { valid: false, reason: `missing header: "${header}"` }
  }

  const sections = trimmed.split(/\n(?=## )/)
  for (const section of sections) {
    const lines = section.split('\n').filter(l => l.trim())
    const body = lines.slice(1)
    if (body.length === 0)
      return { valid: false, reason: `empty section: "${lines[0]?.trim() ?? 'unknown'}"` }

    const meaningful = body.filter(l => {
      const t = l.trim().replace(/^[-*]\s*/, '')
      return t && !/^(\(nothing\)|none|n\/a)$/i.test(t)
    })
    if (meaningful.length === 0)
      return { valid: false, reason: `no meaningful content in "${lines[0]?.trim()}"` }
  }

  return { valid: true }
}

function buildRetryPrompt(raw: string): string {
  return `Your previous output did not follow the required format.

REQUIRED FORMAT (use exactly these headers):
## User Profile
(put user information here as bullet points)

## Project Context
(put project context here as bullet points)

Your previous output (which was rejected):
${raw.slice(0, 2000)}

Now please regenerate with BOTH headers and meaningful content.`
}

export class Dream {
  private _cursor = 0
  private _processedCursor = 0

  constructor(
    private store: LayeredMemoryStore,
    private provider: LLMProvider,
    private model: string,
  ) {
    // 初始化时读取项目游标，避免重复处理
    this._cursor = this._loadCursorFromEntries()
    this._processedCursor = this._cursor
  }

  setProvider(provider: LLMProvider, model: string) {
    this.provider = provider
    this.model = model
  }

  // ── 游标管理 ────────────────────────────────────────────
  private _loadCursorFromEntries(): number {
    // 从 project store 的历史条目中读取最新游标
    const entries = [...this.store.project.readEntriesSince(0)]
    if (entries.length === 0) return 0
    return Math.max(...entries.map(e => e.cursor))
  }

  // ── LLM 调用包装 ──────────────────────────────────────
  private async _callLLM(prompt: string): Promise<string> {
    try {
      const response = await this.provider.chat({
        messages: [{ role: 'user', content: prompt }],
        model: this.model,
        maxTokens: 2048,
        temperature: 0.3,
      })
      return response.content?.trim() ?? ''
    } catch (err) {
      process.stderr.write(`[Dream] LLM call failed: ${err}\n`)
      return ''
    }
  }

  // ── 入口 ──────────────────────────────────────────────
  /** Process one Dream cycle. Returns the summary string or null. */
  async runOnce(): Promise<string | null> {
    // 阶段 1：收集新条目
    const newEntries = [...this.store.project.readEntriesSince(this._processedCursor)]
    if (newEntries.length === 0) {
      return null // 无新消息，跳过
    }

    // 更新游标
    this._processedCursor = Math.max(...newEntries.map(e => e.cursor), this._processedCursor)

    // 读取现有记忆
    const existingMemory = this.store.project.readMemory() || '(none)'
    const existingUser = this.store.project.readUser() || '(none)'
    const existingSoul = this.store.project.readSoul() || '(none)'

    // 构建提示词
    const prompt = memoryExtractionPrompt(
      `Extract and update memory from the following conversation history.

Existing MEMORY.md:
${existingMemory.slice(0, 3000)}

Existing USER.md:
${existingUser.slice(0, 1000)}

Existing SOUL.md:
${existingSoul.slice(0, 1000)}

New conversation entries (up to 30):
${newEntries.slice(-30).map(e => `- ${e.content.slice(0, 1000)}`).join('\n')}

Return updated structured memory with these sections:
## User Profile
- Important decisions made
- User preferences discovered
- Facts / information learned

## Project Context
- Ongoing projects and their status
- Technical stack and architecture notes
- Important events or changes

Fill in with meaningful content. If nothing new to add, state what is already known.`,
    )

    // ── 首次调用 ────────────────────────────────────────
    let raw = await this._callLLM(prompt)
    let validation = validateFormat(raw)
    let retried = false

    // ── 重试（格式不合法时） ────────────────────────────
    if (!validation.valid) {
      process.stderr.write(`[Dream] format invalid (${validation.reason}), retrying...\n`)
      const retryRaw = await this._callLLM(buildRetryPrompt(raw))
      retried = true
      const retryValidation = validateFormat(retryRaw)
      if (retryValidation.valid) {
        raw = retryRaw
        validation = retryValidation
      } else {
        process.stderr.write(`[Dream] retry also invalid (${retryValidation.reason}), using raw fallback\n`)
        raw = retryRaw
      }
    }

    // ── 空内容防护 ─────────────────────────────────────
    if (raw.trim().length < MIN_CONTENT_LENGTH) {
      process.stderr.write(`[Dream] skipped storage: content too short\n`)
      return null
    }

    // ── 阶段 2：写入记忆 ───────────────────────────────
    try {
      this.store.appendMemorySummary(raw, 'Dream')
      process.stderr.write(`[Dream] memory updated (retried=${retried}, validated=${validation.valid})\n`)
    } catch (err) {
      process.stderr.write(`[Dream] appendMemorySummary failed: ${err}\n`)
      return null
    }

    return raw
  }
}
