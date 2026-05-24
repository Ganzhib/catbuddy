/**
 * Pure file I/O for memory files: MEMORY.md, history.jsonl, SOUL.md, USER.md.
 * 对应 example/agent/memory.py — MemoryStore
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

export class MemoryStore {
  static readonly DEFAULT_MAX_HISTORY = 1000

  readonly workspace: string
  readonly memoryDir: string
  readonly memoryFile: string
  readonly historyFile: string
  readonly soulFile: string
  readonly userFile: string

  private _cursor = 0

  constructor(workspace: string, maxHistoryEntries = MemoryStore.DEFAULT_MAX_HISTORY) {
    this.workspace = workspace
    const memDir = path.join(workspace, 'memory')
    fs.mkdirSync(memDir, { recursive: true })
    this.memoryDir = memDir
    this.memoryFile = path.join(memDir, 'MEMORY.md')
    this.historyFile = path.join(memDir, 'history.jsonl')
    this.soulFile = path.join(workspace, 'SOUL.md')
    this.userFile = path.join(workspace, 'USER.md')
    void maxHistoryEntries
    this._loadCursor()
  }

  static readFile(filePath: string): string {
    try {
      return fs.readFileSync(filePath, 'utf-8')
    } catch {
      return ''
    }
  }

  readMemory(): string {
    return MemoryStore.readFile(this.memoryFile)
  }

  readSoul(): string {
    return MemoryStore.readFile(this.soulFile)
  }

  readUser(): string {
    return MemoryStore.readFile(this.userFile)
  }

  appendHistory(entry: string, maxChars = 64_000): number {
    const raw = entry.trimEnd()
    const content = raw.length > maxChars ? raw.slice(0, maxChars) : raw
    this._cursor += 1
    const row = { cursor: this._cursor, content, at: new Date().toISOString() }
    fs.appendFileSync(this.historyFile, `${JSON.stringify(row)}\n`, 'utf-8')
    fs.writeFileSync(path.join(this.memoryDir, '.cursor'), String(this._cursor), 'utf-8')
    return this._cursor
  }

  *readEntriesSince(cursor: number): Generator<{ cursor: number; content: string }, void> {
    if (!fs.existsSync(this.historyFile)) return
    const lines = fs.readFileSync(this.historyFile, 'utf-8').split('\n')
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const row = JSON.parse(line) as { cursor?: number; content?: string }
        if (typeof row.cursor === 'number' && row.cursor > cursor && row.content) {
          yield { cursor: row.cursor, content: row.content }
        }
      } catch {
        // skip corrupt line
      }
    }
  }

  private _loadCursor(): void {
    const cursorPath = path.join(this.memoryDir, '.cursor')
    try {
      const n = parseInt(fs.readFileSync(cursorPath, 'utf-8'), 10)
      if (!Number.isNaN(n)) this._cursor = n
    } catch {
      this._cursor = 0
    }
  }
}
