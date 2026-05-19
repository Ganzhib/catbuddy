/**
 * Context Builder — 组装 LLM 输入上下文
 * 对应原版 nanobot/agent/context.py，用 Handlebars 替代 Jinja2
 */
import * as fs from 'fs'
import * as path from 'path'
import Handlebars from 'handlebars'
import { fileURLToPath } from 'url'
import type { LLMMessage, MessageRecord } from '../../shared/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ═══ 模板目录（编译产物中，electron/agent/）；源文件在项目根 templates/ ═══
const TEMPLATES_DIR = path.resolve(__dirname, '../../..', 'templates')
const SKILLS_DIR = path.resolve(__dirname, '../../..', 'skills')

// 对应原版 ContextBuilder.BOOTSTRAP_FILES
const BOOTSTRAP_FILES = ['AGENTS.md', 'SOUL.md', 'USER.md', 'TOOLS.md']

// Handlebars 注册 include 能力
function loadTemplate(relativePath: string): HandlebarsTemplateDelegate {
  const fullPath = path.join(TEMPLATES_DIR, relativePath)
  const raw = fs.readFileSync(fullPath, 'utf-8')
  // 处理 Jinja2 的 {% include ... %} → Handlebars partial
  const withIncludes = raw.replace(
    /\{%\s*include\s+['"]agent\/_snippets\/([^'"]+)['"]\s*%\}/g,
    (_, name) => {
      const snippet = fs.readFileSync(path.join(TEMPLATES_DIR, 'agent', '_snippets', name), 'utf-8')
      return snippet
    }
  )
  // 处理 Jinja2 条件 → Handlebars {{#if}} {{else}} {{/if}}
  let hbs = withIncludes
    .replace(/\{%\s*if\s+(.+?)\s*%\}/g, '{{#if $1}}')
    .replace(/\{%\s*elif\s+(.+?)\s*%\}/g, '{{else if $1}}')
    .replace(/\{%\s*else\s*%\}/g, '{{else}}')
    .replace(/\{%\s*endif\s*%\}/g, '{{/if}}')
    .replace(/\{%\s*endraw\s*%\}/g, '{{/raw}}')
    .replace(/\{%\s*raw\s*%\}/g, '{{{{raw}}}}')
    .replace(/\{\{\s+(\w+(?:\.\w+)*)\s+\}\}/g, '{{$1}}')
  return Handlebars.compile(hbs, { noEscape: true })
}

interface ContextBuilderOpts {
  timezone?: string
  disabledSkills?: string[]
}

export class ContextBuilder {
  readonly workspace: string
  readonly timezone: string
  readonly disabledSkills: Set<string>
  private _templates: Record<string, HandlebarsTemplateDelegate> = {}

  constructor(workspace: string, opts: ContextBuilderOpts = {}) {
    this.workspace = workspace
    this.timezone = opts.timezone ?? 'UTC'
    this.disabledSkills = new Set(opts.disabledSkills ?? [])

    // 预编译所有模板
    try {
      this._templates.identity = loadTemplate('agent/identity.md')
      this._templates.platformPolicy = loadTemplate('agent/platform_policy.md')
      this._templates.skillsSection = loadTemplate('agent/skills_section.md')
    } catch {
      console.warn('Templates not found at', TEMPLATES_DIR, '- using built-in defaults')
    }
  }

  /** 读取 workspace 中的文件 */
  readWorkspaceFile(name: string): string {
    try { return fs.readFileSync(path.join(this.workspace, name), 'utf-8') } catch { return '' }
  }

  /** 确保 workspace 中存在引导文件（首次运行时创建） */
  ensureBootstrapFiles() {
    fs.mkdirSync(this.workspace, { recursive: true })
    for (const name of BOOTSTRAP_FILES) {
      const dest = path.join(this.workspace, name)
      if (!fs.existsSync(dest)) {
        const src = path.join(TEMPLATES_DIR, name)
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest)
        }
      }
    }
    // memory/MEMORY.md
    const memDir = path.join(this.workspace, 'memory')
    fs.mkdirSync(memDir, { recursive: true })
    const memDest = path.join(memDir, 'MEMORY.md')
    if (!fs.existsSync(memDest)) {
      const src = path.join(TEMPLATES_DIR, 'memory', 'MEMORY.md')
      if (fs.existsSync(src)) fs.copyFileSync(src, memDest)
    }
  }

  /** 构建系统提示词 */
  buildSystemPrompt(opts?: {
    channel?: string
    chatId?: string
    senderId?: string
  }): string {
    const parts: string[] = []
    const channel = opts?.channel ?? 'desktop'

    // 1. identity.md 核心身份
    const identity = this._renderIdentity(channel)
    if (identity) parts.push(identity)

    // 2. Bootstrap Files: AGENTS.md / SOUL.md / USER.md / TOOLS.md
    for (const name of BOOTSTRAP_FILES) {
      const content = this.readWorkspaceFile(name)
      if (content) parts.push(`## ${name}\n\n${content}`)
    }

    // 3. Memory
    const memory = this.readWorkspaceFile('memory/MEMORY.md')
    if (memory && !this._isDefaultMemory(memory)) {
      parts.push(`## Long-Term Memory\n\n${memory}`)
    }

    // 4. Always Skills (memory + my)
    const alwaysSkills = this._loadAlwaysSkills()
    if (alwaysSkills) parts.push(alwaysSkills)

    // 5. Skills Summary
    const skillsSummary = this._buildSkillsSummary()
    if (skillsSummary) parts.push(skillsSummary)

    if (parts.length === 0) {
      parts.push(`You are nanobot 🐈, a helpful AI assistant. Reply concisely.`)
    }

    return parts.join('\n\n---\n\n')
  }

  /** 构建完整消息列表 */
  buildMessages(opts: {
    history: MessageRecord[]
    currentMessage: string
    media?: string[]
    channel?: string
    chatId?: string
    senderId?: string
    sessionSummary?: string | null
    sessionMetadata?: Record<string, unknown>
  }): LLMMessage[] {
    const systemPrompt = this.buildSystemPrompt({
      channel: opts.channel,
      chatId: opts.chatId,
      senderId: opts.senderId,
    })
    const messages: LLMMessage[] = []

    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })

    if (opts.sessionSummary) {
      messages.push({ role: 'user', content: `[Previous conversation summary]:\n${opts.sessionSummary}` })
    }

    for (const m of opts.history) {
      messages.push({
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls,
        toolCallId: m.toolCallId,
        name: m.name,
      })
    }

    // 当前消息 + Runtime Context
    const runtimeCtx = this._buildRuntimeContext(opts.channel, opts.chatId, opts.senderId)
    const textWithCtx = runtimeCtx
      ? `${opts.currentMessage}\n\n[runtime: ${runtimeCtx}]`
      : opts.currentMessage

    const userContent = this.buildUserContent(textWithCtx, opts.media ?? [])
    messages.push({ role: 'user', content: userContent })

    return messages
  }

  buildUserContent(text: string, media: string[]): LLMMessage['content'] {
    if (media.length === 0) return text
    const blocks: any[] = []
    if (text) blocks.push({ type: 'text', text })
    for (const m of media) {
      if (m.startsWith('data:') || m.startsWith('http')) {
        blocks.push({ type: 'image_url', image_url: { url: m } })
      } else {
        try {
          const data = fs.readFileSync(m)
          const b64 = data.toString('base64')
          const ext = path.extname(m).slice(1) || 'png'
          blocks.push({ type: 'image_url', image_url: { url: `data:image/${ext};base64,${b64}` } })
        } catch {
          blocks.push({ type: 'text', text: `[image: ${m}]` })
        }
      }
    }
    return blocks
  }

  // ═══ 私有方法 ═══

  private _renderIdentity(channel: string): string {
    if (!this._templates.identity) return ''
    const platformPolicy = this._templates.platformPolicy
      ? this._templates.platformPolicy({ system: process.platform === 'win32' ? 'Windows' : 'Linux' })
      : ''
    const runtime = `OS: ${process.platform} / Node.js ${process.version}`

    return this._templates.identity({
      runtime,
      workspace_path: this.workspace,
      platform_policy: platformPolicy,
      channel,
    })
  }

  private _isDefaultMemory(content: string): boolean {
    // 如果 MEMORY.md 内容等于模板默认值，说明用户未自定义
    try {
      const tmpl = fs.readFileSync(path.join(TEMPLATES_DIR, 'memory', 'MEMORY.md'), 'utf-8')
      return content.trim() === tmpl.trim()
    } catch {
      return false
    }
  }

  private _loadAlwaysSkills(): string {
    const alwaysSkills = ['memory', 'my']
    const parts: string[] = []
    for (const name of alwaysSkills) {
      const content = this._readSkill(name)
      if (content) parts.push(content)
    }
    return parts.join('\n\n')
  }

  private _readSkill(name: string): string {
    // 先读 workspace/skills（用户自定义覆盖内置）
    const workspaceSkill = path.join(this.workspace, 'skills', name, 'SKILL.md')
    const builtinSkill = path.join(SKILLS_DIR, name, 'SKILL.md')

    for (const p of [workspaceSkill, builtinSkill]) {
      try {
        const raw = fs.readFileSync(p, 'utf-8')
        return this._stripFrontmatter(raw)
      } catch {}
    }
    return ''
  }

  private _stripFrontmatter(md: string): string {
    const match = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    return match ? match[2].trim() : md.trim()
  }

  private _buildSkillsSummary(): string {
    const skills: { name: string; description: string; available: boolean }[] = []
    const alwaysSkills = new Set(['memory', 'my'])

    // 扫描内置 skills
    try {
      for (const dir of fs.readdirSync(SKILLS_DIR)) {
        if (alwaysSkills.has(dir)) continue
        if (this.disabledSkills.has(dir)) continue
        const skillPath = path.join(SKILLS_DIR, dir, 'SKILL.md')
        if (!fs.existsSync(skillPath)) continue
        const raw = fs.readFileSync(skillPath, 'utf-8')
        const frontmatter = this._parseFrontmatter(raw)
        skills.push({
          name: dir,
          description: frontmatter.description ?? '',
          available: true,
        })
      }
    } catch {}

    if (skills.length === 0) return ''

    const skillsSummary = skills
      .map(s => `- **${s.name}**: ${s.description}` + (!s.available ? ' *(unavailable)*' : ''))
      .join('\n')

    if (this._templates.skillsSection) {
      return this._templates.skillsSection({ skills_summary: skillsSummary })
    }
    return `# Skills\n\n${skillsSummary}`
  }

  private _parseFrontmatter(md: string): Record<string, string> {
    const match = md.match(/^---\n([\s\S]*?)\n---/)
    if (!match) return {}
    const result: Record<string, string> = {}
    for (const line of match[1].split('\n')) {
      const kv = line.match(/^(\w[\w\s]*?):\s*(.+)$/)
      if (kv) result[kv[1].trim()] = kv[2].trim()
    }
    return result
  }

  private _buildRuntimeContext(channel?: string, chatId?: string, senderId?: string): string {
    const now = new Date().toISOString()
    const parts = [`Time: ${now} (${this.timezone})`]
    if (channel) parts.push(`Channel: ${channel}`)
    if (chatId) parts.push(`Chat ID: ${chatId}`)
    if (senderId) parts.push(`Sender: ${senderId}`)
    return parts.length > 1 ? parts.join(' | ') : ''
  }
}
