/**
 * Consolidator — 对话压缩 + 记忆持久化
 * 对应原版 catbuddy/agent/memory.py 中的 Consolidator + MemoryStore
 */
import * as fs from 'fs'
import * as path from 'path'
import { LLMProvider } from '../providers'
import { SessionManager } from '../session/session-manager'
import type { MessageRecord, LLMMessage } from "@catbuddy/shared"

export interface ConsolidatorOpts {
  provider: LLMProvider
  model: string
  sessions: SessionManager
  workspace: string
  contextWindowTokens: number
  consolidationRatio?: number
  maxCompletionTokens?: number
}

export class Consolidator {
  private provider: LLMProvider
  private model: string
  private sessions: SessionManager
  private workspace: string
  private contextWindowTokens: number
  private consolidationRatio: number
  private maxCompletionTokens: number
  private _compacting = new Set<string>()

  constructor(opts: ConsolidatorOpts) {
    this.provider = opts.provider
    this.model = opts.model
    this.sessions = opts.sessions
    this.workspace = opts.workspace
    this.contextWindowTokens = opts.contextWindowTokens
    this.consolidationRatio = opts.consolidationRatio ?? 0.5
    this.maxCompletionTokens = opts.maxCompletionTokens ?? 2048
  }

  setProvider(provider: LLMProvider, model: string, contextWindowTokens: number) {
    this.provider = provider
    this.model = model
    this.contextWindowTokens = contextWindowTokens
  }

  /** 压缩闲置 session 的旧消息到 MEMORY.md */
  async compactIdleSession(sessionKey: string, keepRecent: number = 8): Promise<string | null> {
    if (this._compacting.has(sessionKey)) return null
    this._compacting.add(sessionKey)

    try {
      const allMessages = this.sessions.getHistory(sessionKey, { maxMessages: 9999 })
      process.stderr.write(`[consolidator] STEP1: session=${sessionKey} totalMsgs=${allMessages.length} keepRecent=${keepRecent}\n`)
      
      if (allMessages.length <= keepRecent) {
        process.stderr.write(`[consolidator] SKIP: ${allMessages.length} <= ${keepRecent}\n`)
        return null
      }

      const toArchive = allMessages.slice(0, allMessages.length - keepRecent)
      process.stderr.write(`[consolidator] STEP2: toArchive=${toArchive.length} msgs\n`)
      
      const userMessages = toArchive.filter(m => m.role === 'user')
      if (userMessages.length === 0) {
        process.stderr.write(`[consolidator] SKIP: no user msgs to archive\n`)
        return null
      }

      const conversationText = toArchive
        .map(m => `[${m.role}] ${(m.content || '').slice(0, 300)}`)
        .join('\n')

      const compactPrompt = `Extract key facts from this conversation. Return ONLY a compact bullet list of:
- Important decisions made
- User preferences discovered
- Facts / information learned
- Tasks completed
- Pending / unresolved items

Conversation:
${conversationText}`

      process.stderr.write(`[consolidator] STEP3: calling LLM...\n`)
      const response = await this.provider.chat({
        messages: [{ role: 'user', content: compactPrompt }],
        model: this.model,
        maxTokens: 1024,
        temperature: 0.3,
      })

      process.stderr.write(`[consolidator] STEP4: LLM response finishReason=${response.finishReason} contentLen=${response.content?.length || 0}\n`)

      const summary = response.content?.trim()
      if (!summary || summary === '(nothing)') {
        process.stderr.write(`[consolidator] SKIP: empty summary\n`)
        return null
      }

      const memDir = path.join(this.workspace, 'memory')
      fs.mkdirSync(memDir, { recursive: true })
      const memPath = path.join(memDir, 'MEMORY.md')
      const now = new Date().toISOString().slice(0, 10)

      let existing = ''
      try { existing = fs.readFileSync(memPath, 'utf-8') } catch {}

      const entry = `\n\n## Archived — ${now}\n${summary}\n`
      fs.writeFileSync(memPath, existing + entry, 'utf-8')
      process.stderr.write(`[consolidator] DONE: wrote to ${memPath} (${Buffer.byteLength(entry)} bytes)\n`)

      const session = this.sessions.getOrCreate(sessionKey)
      session.lastConsolidated = (session.lastConsolidated || 0) + toArchive.length
      session.metadata = { ...session.metadata, _last_summary: { text: summary, last_active: now } }

      return summary
    } catch (err: any) {
      process.stderr.write(`[consolidator] FAIL: ${err.message}\n`)
      return null
    } finally {
      this._compacting.delete(sessionKey)
    }
  }
}
