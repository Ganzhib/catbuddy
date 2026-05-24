/**
 * Auto compact: proactive compression of idle sessions.
 * 对应 example/agent/autocompact.py
 */
import type { Consolidator } from './memory'
import type { SessionManager } from '../session/session-manager'

export class AutoCompact {
  private static readonly RECENT_SUFFIX_MESSAGES = 8

  private readonly _archiving = new Set<string>()
  private readonly _summaries = new Map<string, { text: string; lastActive: string }>()

  constructor(
    readonly sessions: SessionManager,
    readonly consolidator: Consolidator,
    private readonly _ttlMinutes = 0,
  ) {}

  private _isExpired(updatedAt: string | undefined, now = Date.now()): boolean {
    if (this._ttlMinutes <= 0 || !updatedAt) return false
    const ts = Date.parse(updatedAt)
    if (Number.isNaN(ts)) return false
    return (now - ts) / 1000 >= this._ttlMinutes * 60
  }

  private static _formatSummary(text: string, lastActive: string): string {
    return `Previous conversation summary (last active ${lastActive}):\n${text}`
  }

  /** Schedule archival for idle sessions, skipping in-flight keys. */
  checkExpired(
    scheduleBackground: (task: () => Promise<void>) => void,
    activeSessionKeys: Iterable<string> = [],
  ): void {
    const active = new Set(activeSessionKeys)
    const now = Date.now()
    for (const info of this.sessions.list()) {
      const key = info.key
      if (!key || this._archiving.has(key) || active.has(key)) continue
      if (this._isExpired(info.updatedAt, now)) {
        this._archiving.add(key)
        scheduleBackground(() => this._archive(key))
      }
    }
  }

  private async _archive(key: string): Promise<void> {
    try {
      const summary = await this.consolidator.compactIdleSession(
        key,
        AutoCompact.RECENT_SUFFIX_MESSAGES,
      )
      if (summary && summary !== '(nothing)') {
        const session = this.sessions.getOrCreate(key)
        const meta = session.metadata?._last_summary as
          | { text?: string; last_active?: string }
          | undefined
        if (meta?.text && meta.last_active) {
          this._summaries.set(key, { text: meta.text, lastActive: meta.last_active })
        }
      }
    } catch (err) {
      console.error('[AutoCompact] failed for', key, err)
    } finally {
      this._archiving.delete(key)
    }
  }

  prepareSession(
    sessionKey: string,
  ): { summary: string | null } {
    const entry = this._summaries.get(sessionKey)
    if (entry) {
      this._summaries.delete(sessionKey)
      return {
        summary: AutoCompact._formatSummary(entry.text, entry.lastActive),
      }
    }
    const session = this.sessions.getOrCreate(sessionKey)
    const meta = session.metadata?._last_summary as
      | { text?: string; last_active?: string }
      | undefined
    if (meta?.text) {
      return {
        summary: AutoCompact._formatSummary(
          meta.text,
          meta.last_active ?? 'unknown',
        ),
      }
    }
    return { summary: null }
  }
}
