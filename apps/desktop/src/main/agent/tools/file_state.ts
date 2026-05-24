/**
 * Track file-read state for read-before-edit warnings and read deduplication.
 * 对应 example/agent/tools/file_state.py
 */
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import { AsyncLocalStorage } from 'node:async_hooks'
import * as path from 'node:path'

export interface ReadState {
  mtime: number
  offset: number
  limit: number | null
  contentHash: string | null
  canDedup: boolean
}

function hashFile(p: string): string | null {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
  } catch {
    return null
  }
}

/** Per-session read/write tracker. */
export class FileStates {
  private readonly _state = new Map<string, ReadState>()

  recordRead(filePath: string, offset = 0, limit: number | null = null): void {
    const p = path.resolve(filePath)
    let mtime: number
    try {
      mtime = fs.statSync(p).mtimeMs
    } catch {
      return
    }
    this._state.set(p, {
      mtime,
      offset,
      limit,
      contentHash: hashFile(p),
      canDedup: true,
    })
  }

  recordWrite(filePath: string): void {
    const p = path.resolve(filePath)
    try {
      const mtime = fs.statSync(p).mtimeMs
      this._state.set(p, {
        mtime,
        offset: 0,
        limit: null,
        contentHash: hashFile(p),
        canDedup: false,
      })
    } catch {
      this._state.delete(p)
    }
  }

  checkRead(filePath: string): string | null {
    const p = path.resolve(filePath)
    const entry = this._state.get(p)
    if (!entry) {
      return 'Warning: file has not been read yet. Read it first to verify content before editing.'
    }
    let currentMtime: number
    try {
      currentMtime = fs.statSync(p).mtimeMs
    } catch {
      return null
    }
    if (currentMtime !== entry.mtime) {
      if (entry.contentHash && hashFile(p) === entry.contentHash) {
        entry.mtime = currentMtime
        return null
      }
      return 'Warning: file has been modified since last read. Re-read to verify content before editing.'
    }
    if (entry.contentHash && hashFile(p) !== entry.contentHash) {
      return 'Warning: file has been modified since last read. Re-read to verify content before editing.'
    }
    return null
  }

  isUnchanged(filePath: string, offset = 0, limit: number | null = null): boolean {
    const p = path.resolve(filePath)
    const entry = this._state.get(p)
    if (!entry || !entry.canDedup) return false
    if (entry.offset !== offset || entry.limit !== limit) return false
    let currentMtime: number
    try {
      currentMtime = fs.statSync(p).mtimeMs
    } catch {
      return false
    }
    if (currentMtime !== entry.mtime) {
      const currentHash = hashFile(p)
      if (currentHash !== entry.contentHash) {
        entry.canDedup = false
        return false
      }
      entry.canDedup = false
      return true
    }
    return true
  }

  get(filePath: string): ReadState | undefined {
    return this._state.get(path.resolve(filePath))
  }

  clear(): void {
    this._state.clear()
  }
}

/** Lookup table for per-session file read/write state. */
export class FileStateStore {
  private readonly _statesByKey = new Map<string, FileStates>()

  forSession(sessionKey: string | null): FileStates {
    const key = sessionKey || '__default__'
    let states = this._statesByKey.get(key)
    if (!states) {
      states = new FileStates()
      this._statesByKey.set(key, states)
    }
    return states
  }

  clear(): void {
    this._statesByKey.clear()
  }
}

const _currentFileStates = new AsyncLocalStorage<FileStates | undefined>()

export function currentFileStates(defaultStates: FileStates): FileStates {
  return _currentFileStates.getStore() ?? defaultStates
}

export function bindFileStates(fileStates: FileStates): void {
  _currentFileStates.enterWith(fileStates)
}

export async function runWithFileStates<T>(
  fileStates: FileStates,
  fn: () => Promise<T>,
): Promise<T> {
  return _currentFileStates.run(fileStates, fn)
}
