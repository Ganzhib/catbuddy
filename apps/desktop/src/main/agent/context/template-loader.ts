import * as fs from 'fs'
import * as path from 'path'
import Handlebars from 'handlebars'
import type { FileAccessMode } from '../../security/index.js'
import { TEMPLATES_DIR } from './file-system.js'

function loadTemplate(relativePath: string): HandlebarsTemplateDelegate {
  const fullPath = path.join(TEMPLATES_DIR, relativePath)
  const raw = fs.readFileSync(fullPath, 'utf-8')
  const withIncludes = raw.replace(
    /\{%\s*include\s+['"]agent\/_snippets\/([^'"]+)['"]\s*%\}/g,
    (_, name) => {
      const snippet = fs.readFileSync(path.join(TEMPLATES_DIR, 'agent', '_snippets', name), 'utf-8')
      return snippet
    },
  )
  let hbs = withIncludes
    .replace(/\{%\s*else\s*%\}/g, '{{else}}')
    .replace(/\{%\s*endif\s*%\}/g, '{{/if}}')
    .replace(/\{\{\s+(\w+(?:\.\w+)*)\s+\}\}/g, '{{$1}}')
  return Handlebars.compile(hbs, { noEscape: true })
}

function channelFlags(channel: string) {
  const ch = channel.toLowerCase()
  return {
    isMessagingApp: ch === 'telegram' || ch === 'qq' || ch === 'discord',
    isPlainMessaging: ch === 'whatsapp' || ch === 'sms',
    isEmail: ch === 'email',
    isTerminalChannel: ch === 'cli' || ch === 'mochat',
  }
}

export class TemplateLoader {
  private templates: Record<string, HandlebarsTemplateDelegate> = {}

  constructor() {
    try {
      this.templates.identity = loadTemplate('agent/identity.md')
      this.templates.platformPolicy = loadTemplate('agent/platform_policy.md')
      this.templates.skillsSection = loadTemplate('agent/skills_section.md')
    } catch {
      console.warn('Templates not found at', TEMPLATES_DIR, '- using built-in defaults')
    }
  }

  renderIdentity(
    channel: string,
    workRoot: string,
    workspace: string,
    fileAccessMode: FileAccessMode,
  ): string {
    if (!this.templates.identity) return ''
    const isWindows = process.platform === 'win32'
    const platformPolicy = this.templates.platformPolicy
      ? this.templates.platformPolicy({ isWindows })
      : ''
    const runtime = `OS: ${process.platform} / Node.js ${process.version}`

    return this.templates.identity({
      runtime,
      work_root: workRoot.replace(/\\/g, '/'),
      workspace_path: workspace.replace(/\\/g, '/'),
      file_access_project: fileAccessMode === 'project',
      file_access_internal: fileAccessMode === 'internal',
      platform_policy: platformPolicy,
      channel,
      ...channelFlags(channel),
    })
  }

  renderSkillsSection(skillsSummary: string): string {
    if (this.templates.skillsSection) {
      return this.templates.skillsSection({ skills_summary: skillsSummary })
    }
    return `# Skills\n\n${skillsSummary}`
  }

  isDefaultMemory(content: string): boolean {
    try {
      const tmpl = fs.readFileSync(path.join(TEMPLATES_DIR, 'memory', 'MEMORY.md'), 'utf-8')
      return content.trim() === tmpl.trim()
    } catch {
      return false
    }
  }
}
