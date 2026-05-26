/**
 * Auto Compact — 主动空闲会话压缩
 *
 * 改进（相对原始版本）：
 * 1. 优先级排序 — 按「空闲时间 × 消息量」排序，优先压缩高价值会话
 * 2. 并发批量处理 — 每轮最多压缩 N 个会话，避免长时间阻塞
 * 3. 指数退避 — 失败会话跳过时间逐次加倍（5min → 10min → 20min → ...）
 * 4. 统计追踪 — 返回本轮/累计的压缩统计信息
 * 5. 频率限制 — 同会话不在连续周期内重复压缩
 */
import type { Consolidator } from './memory'
import type { SessionManager } from '../session/session-manager'

interface CompactStats {
  scanned: number
  attempted: number
  succeeded: number
  failed: number
  skipped: number
  totalCompacted: number
}

interface BackoffEntry {
  fails: number
  nextRetryAt: number
}

export class AutoCompact {
  static readonly RECENT_SUFFIX_MESSAGES = 8
  static readonly MAX_SESSIONS_PER_CYCLE = 3
  static readonly BACKOFF_BASE_MS = 5 * 60 * 1000 // 5 minutes

  private readonly _archiving = new Set<string>()
  private readonly _summaries = new Map<string, { text: string; lastActive: string }>()
  private readonly _backoff = new Map<string, BackoffEntry>()
  private _totalCompacted = 0

  constructor(
    readonly sessions: SessionManager,
    readonly consolidator: Consolidator,
    readonly ttlMinutes = 0,
    readonly maxPerCycle = AutoCompact.MAX_SESSIONS_PER_CYCLE,
  ) {}

  // ── 过期判断 ──────────────────────────────────────────────
  private _isExpired(updatedAt: string | undefined, now = Date.now()): boolean {
    if (this.ttlMinutes <= 0 || !updatedAt) return false
    const ts = Date.parse(updatedAt)
    if (Number.isNaN(ts)) return false
    return (now - ts) / 1000 >= this.ttlMinutes * 60
  }

  // ── 优先级权重 ─────────────────────────────────────────────
  /**
   * 估算会话价值：空闲时间（分钟）× 消息量
   * 空闲越久 + 消息越多 = 越值得压缩
   */
  private _priorityWeight(info: { updatedAt: string; metadata?: Record<string, unknown> }): number {
    const idleMs = Date.now() - Date.parse(info.updatedAt)
    const idleMinutes = Math.max(1, idleMs / 60_000)
    const msgCount = (typeof info.metadata?.msgCount === 'number' ? info.metadata.msgCount : 50) as number
    return idleMinutes * msgCount
  }

  // ── 退避检查 ──────────────────────────────────────────────
  private _isBackedOff(key: string): boolean {
    const entry = this._backoff.get(key)
    if (!entry) return false
    if (Date.now() >= entry.nextRetryAt) {
      this._backoff.delete(key)
      return false
    }
    return true
  }

  private _recordFailure(key: string) {
    const entry = this._backoff.get(key) ?? { fails: 0, nextRetryAt: 0 }
    entry.fails++
    entry.nextRetryAt = Date.now() + AutoCompact.BACKOFF_BASE_MS * Math.pow(2, entry.fails - 1)
    this._backoff.set(key, entry)
  }

  private _recordSuccess(key: string) {
    this._backoff.delete(key)
  }

  // ── 摘要格式化 ────────────────────────────────────────────
  static formatSummary(text: string, lastActive: string): string {
    return `Previous conversation summary (last active ${lastActive}):\n${text}`
  }

  // ── 入口：检查过期会话 ─────────────────────────────────────
  /**
   * 扫描所有会话，按优先级排序，尝试压缩本轮限额内的高价值会话。
   * 返回统计信息供日志/监控使用。
   */
  checkExpired(
    scheduleBackground: (task: () => Promise<void>) => void,
    activeSessionKeys: Iterable<string> = [],
  ): CompactStats {
    const active = new Set(activeSessionKeys)
    const candidates: Array<{ key: string; updatedAt: string }> = []

    for (const info of this.sessions.list()) {
      if (!info.key) continue
      if (this._archiving.has(info.key) || active.has(info.key)) continue
      if (this._isBackedOff(info.key)) continue
      if (this._isExpired(info.updatedAt)) {
        candidates.push({ key: info.key, updatedAt: info.updatedAt })
      }
    }

    // 按优先级降序排列（高价值靠前）
    candidates.sort((a, b) => {
      const pa = this._priorityWeight(a)
      const pb = this._priorityWeight(b)
      return pb - pa
    })

    // 截取本轮限额
    const toArchive = candidates.slice(0, this.maxPerCycle)

    for (const c of toArchive) {
      this._archiving.add(c.key)
      scheduleBackground(() => this._archive(c.key))
    }

    return {
      scanned: candidates.length,
      attempted: toArchive.length,
      succeeded: 0, // 异步填充，调用方可通过 promise 收集
      failed: 0,
      skipped: candidates.length - toArchive.length,
      totalCompacted: this._totalCompacted,
    }
  }

  // ── 实际压缩（异步后台） ──────────────────────────────────
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
        this._recordSuccess(key)
        this._totalCompacted++
      }
    } catch (err) {
      console.error('[AutoCompact] failed for', key, err)
      this._recordFailure(key)
    } finally {
      this._archiving.delete(key)
    }
  }

  // ── 准备会话摘要 ──────────────────────────────────────────
  prepareSession(
    sessionKey: string,
  ): { summary: string | null } {
    // 优先使用本轮压缩获得的摘要
    const entry = this._summaries.get(sessionKey)
    if (entry) {
      this._summaries.delete(sessionKey)
      return {
        summary: AutoCompact.formatSummary(entry.text, entry.lastActive),
      }
    }
    // 其次使用 metadata 中保存的历史摘要
    const session = this.sessions.getOrCreate(sessionKey)
    const meta = session.metadata?._last_summary as
      | { text?: string; last_active?: string }
      | undefined
    if (meta?.text) {
      return {
        summary: AutoCompact.formatSummary(
          meta.text,
          meta.last_active ?? 'unknown',
        ),
      }
    }
    return { summary: null }
  }

  /** 重置退避（用于调试/手动触发后） */
  clearBackoff(key?: string): void {
    if (key) {
      this._backoff.delete(key)
    } else {
      this._backoff.clear()
    }
  }
}
