import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { ensureGlobalProfileBootstrap } from '../../services/global-profile.js'
import { BOOTSTRAP_FILES } from './types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const TEMPLATES_DIR = path.resolve(__dirname, '../templates')

export interface FileSystem {
  readWorkspaceFile(name: string, workspaceDir?: string): string
  ensureBootstrapFiles(): void
}

export class WorkspaceFileSystem implements FileSystem {
  constructor(
    readonly workspace: string,
    readonly globalWorkspace: string,
    private usesGlobalProfile: () => boolean,
  ) {}

  readWorkspaceFile(name: string, workspaceDir?: string): string {
    const root = workspaceDir ?? this.workspace
    try {
      return fs.readFileSync(path.join(root, name), 'utf-8')
    } catch {
      return ''
    }
  }

  ensureBootstrapFiles(): void {
    ensureGlobalProfileBootstrap()
    fs.mkdirSync(this.workspace, { recursive: true })
    for (const name of BOOTSTRAP_FILES) {
      if (name === 'USER.md' && this.usesGlobalProfile()) continue
      const dest = path.join(this.workspace, name)
      if (!fs.existsSync(dest)) {
        const src = path.join(TEMPLATES_DIR, name)
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest)
        }
      }
    }
    const memDir = path.join(this.workspace, 'memory')
    fs.mkdirSync(memDir, { recursive: true })
    const memDest = path.join(memDir, 'MEMORY.md')
    if (!fs.existsSync(memDest)) {
      const src = path.join(TEMPLATES_DIR, 'memory', 'MEMORY.md')
      if (fs.existsSync(src)) fs.copyFileSync(src, memDest)
    }
    const heartbeatDest = path.join(this.workspace, 'HEARTBEAT.md')
    if (!fs.existsSync(heartbeatDest)) {
      const src = path.join(TEMPLATES_DIR, 'HEARTBEAT.md')
      if (fs.existsSync(src)) fs.copyFileSync(src, heartbeatDest)
    }
  }
}
