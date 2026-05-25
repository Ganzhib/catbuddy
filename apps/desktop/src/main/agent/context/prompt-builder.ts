import * as fs from 'fs'
import * as path from 'path'
import type { FileAccessMode } from '../../security/index.js'
import type { FileSystem } from './file-system.js'
import { SystemPromptCache } from './prompt-cache.js'
import type { SkillLoader } from './skill-loader.js'
import type { TemplateLoader } from './template-loader.js'
import type { BuildSystemPromptOptions } from './types.js'
import { BOOTSTRAP_FILES } from './types.js'

export class PromptBuilder {
  private cache = new SystemPromptCache()

  constructor(
    private fs: FileSystem,
    private templates: TemplateLoader,
    private skills: SkillLoader,
    private workspace: string,
    private globalWorkspace: string,
    private workRoot: string,
    private fileAccessMode: FileAccessMode,
    private usesGlobalProfile: () => boolean,
  ) {}

  invalidateCache(): void {
    this.cache.clear()
  }

  buildSystemPrompt(opts?: BuildSystemPromptOptions): string {
    const channel = opts?.channel ?? 'desktop'
    const key = `${channel}:${this._fingerprint()}`
    const cached = this.cache.get(key)
    if (cached !== undefined) return cached

    const prompt = this._assembleSystemPrompt(channel)
    this.cache.set(key, prompt)
    return prompt
  }

  buildRuntimeContext(channel?: string, chatId?: string, senderId?: string, timezone?: string): string {
    const now = new Date().toISOString()
    const parts = [`Time: ${now} (${timezone ?? 'UTC'})`]
    if (channel) parts.push(`Channel: ${channel}`)
    if (chatId) parts.push(`Chat ID: ${chatId}`)
    if (senderId) parts.push(`Sender: ${senderId}`)
    return parts.length > 1 ? parts.join(' | ') : ''
  }

  private _fingerprint(): string {
    const parts = [
      this.workspace,
      this.globalWorkspace,
      this.workRoot,
      this.fileAccessMode,
    ]
    for (const name of BOOTSTRAP_FILES) {
      const root = name === 'USER.md' && this.usesGlobalProfile()
        ? this.globalWorkspace
        : this.workspace
      parts.push(`${name}:${this._mtime(path.join(root, name))}`)
    }
    parts.push(`global-memory:${this._mtime(path.join(this.globalWorkspace, 'memory/MEMORY.md'))}`)
    if (this.usesGlobalProfile()) {
      parts.push(`project-memory:${this._mtime(path.join(this.workspace, 'memory/MEMORY.md'))}`)
    }
    parts.push(`skills:${this.skills.fingerprint()}`)
    return parts.join('\0')
  }

  private _mtime(filePath: string): string {
    try {
      return String(fs.statSync(filePath).mtimeMs)
    } catch {
      return '0'
    }
  }

  private _assembleSystemPrompt(channel: string): string {
    const parts: string[] = []

    const identity = this.templates.renderIdentity(
      channel,
      this.workRoot,
      this.workspace,
      this.fileAccessMode,
    )
    if (identity) parts.push(identity)

    for (const name of BOOTSTRAP_FILES) {
      if (name === 'USER.md' && this.usesGlobalProfile()) {
        const content = this.fs.readWorkspaceFile('USER.md', this.globalWorkspace)
        if (content) parts.push(`## ${name}\n\n${content}`)
        continue
      }
      const content = this.fs.readWorkspaceFile(name)
      if (content) parts.push(`## ${name}\n\n${content}`)
    }

    const globalMemory = this.fs.readWorkspaceFile('memory/MEMORY.md', this.globalWorkspace)
    if (globalMemory && !this.templates.isDefaultMemory(globalMemory)) {
      const title = this.usesGlobalProfile() ? 'Long-Term Memory (You)' : 'Long-Term Memory'
      parts.push(`## ${title}\n\n${globalMemory}`)
    }
    if (this.usesGlobalProfile()) {
      const projectMemory = this.fs.readWorkspaceFile('memory/MEMORY.md')
      if (projectMemory && !this.templates.isDefaultMemory(projectMemory)) {
        parts.push(`## Project Memory\n\n${projectMemory}`)
      }
    }

    const alwaysSkills = this.skills.loadAlwaysSkills()
    if (alwaysSkills) parts.push(alwaysSkills)

    const skillsSummary = this.skills.buildSkillsSummary()
    if (skillsSummary) parts.push(this.templates.renderSkillsSection(skillsSummary))

    if (parts.length === 0) {
      parts.push(
        `You are catbuddy 🐱, a smart and caring cat-spirit AI assistant. Reply in Chinese (简体中文) by default. Keep functional output accurate; show cat personality in natural language only; keep code and technical docs professional.`,
      )
    }

    return parts.join('\n\n---\n\n')
  }
}
