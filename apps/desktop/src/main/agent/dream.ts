/**
 * Two-phase memory processor (simplified Phase 1 for desktop).
 * 对应 example/agent/memory.py — Dream
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { LLMProvider } from '../providers/base-provider'
import { MemoryStore } from './memory-store'

const STALE_THRESHOLD_DAYS = 14

export class Dream {
  constructor(
    readonly store: MemoryStore,
    private provider: LLMProvider,
    private model: string,
    private readonly maxBatchSize = 20,
  ) {}

  setProvider(provider: LLMProvider, model: string): void {
    this.provider = provider
    this.model = model
  }

  /** Run one Dream cycle: summarize recent history into MEMORY.md. */
  async runOnce(): Promise<string | null> {
    const entries: { cursor: number; content: string }[] = []
    let lastCursor = 0
    try {
      const dreamCursorPath = path.join(this.store.memoryDir, '.dream_cursor')
      lastCursor = parseInt(fs.readFileSync(dreamCursorPath, 'utf-8'), 10) || 0
    } catch {
      lastCursor = 0
    }

    for (const entry of this.store.readEntriesSince(lastCursor)) {
      entries.push(entry)
      if (entries.length >= this.maxBatchSize) break
    }
    if (entries.length === 0) return null

    const batch = entries.map((e) => e.content).join('\n---\n')
    const prompt = `Analyze these conversation history excerpts. Extract durable facts for MEMORY.md.
Mark items older than ${STALE_THRESHOLD_DAYS} days as stale if no longer relevant.
Return bullet points only.

${batch}`

    const response = await this.provider.chat({
      messages: [{ role: 'user', content: prompt }],
      model: this.model,
      maxTokens: 2048,
      temperature: 0.3,
    })

    const summary = response.content?.trim()
    if (!summary || summary === '(nothing)') return null

    const existing = this.store.readMemory()
    const now = new Date().toISOString().slice(0, 10)
    const block = `\n\n## Dream — ${now}\n${summary}\n`
    fs.writeFileSync(this.store.memoryFile, existing + block, 'utf-8')

    const last = entries[entries.length - 1]!.cursor
    fs.writeFileSync(
      path.join(this.store.memoryDir, '.dream_cursor'),
      String(last),
      'utf-8',
    )
    return summary
  }
}
