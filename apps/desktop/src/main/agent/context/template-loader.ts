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
    // Jinja2 → Handlebars 条件块
    .replace(/\{%\s*if\s+part\s*==\s*'system'\s*%\}/g, '{{#if is_system}}')
    .replace(/\{%\s*elif\s+part\s*==\s*'user'\s*%\}/g, '{{else}}')
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
      // 子 Agent 模板
      this.templates.subagentSystem = loadTemplate('agent/subagent_system.md')
      this.templates.subagentAnnounce = loadTemplate('agent/subagent_announce.md')
      // Dream 阶段模板
      this.templates.dreamPhase1 = loadTemplate('agent/dream_phase1.md')
      this.templates.dreamPhase2 = loadTemplate('agent/dream_phase2.md')
      // 记忆压缩模板
      this.templates.consolidatorArchive = loadTemplate('agent/consolidator_archive.md')
      // 子 Agent 通知评估器
      this.templates.evaluator = loadTemplate('agent/evaluator.md')
      // 最大迭代次数消息
      this.templates.maxIterationsMessage = loadTemplate('agent/max_iterations_message.md')
    } catch {
      console.warn('Templates not found at', TEMPLATES_DIR, '- using built-in defaults')
    }
  }

  // ── 主 Agent 身份 ────────────────────────────────────────

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

  // ── Dream 记忆提取 ──────────────────────────────────────

  /** Dream Phase 1: 从对话历史中提取结构化事实 */
  renderDreamPhase1(staleThresholdDays: number = 90): string {
    if (this.templates.dreamPhase1) {
      return this.templates.dreamPhase1({ stale_threshold_days: staleThresholdDays })
    }
    return ''
  }

  /** Dream Phase 2: 基于 Phase 1 分析更新记忆文件 */
  renderDreamPhase2(skillCreatorPath: string = ''): string {
    if (this.templates.dreamPhase2) {
      return this.templates.dreamPhase2({ skill_creator_path: skillCreatorPath })
    }
    return ''
  }

  // ── 子 Agent ────────────────────────────────────────────

  /** 子 Agent 系统提示词 */
  renderSubagentSystem(opts: {
    timeCtx: string
    workspace: string
    skillsSummary?: string
  }): string {
    if (this.templates.subagentSystem) {
      return this.templates.subagentSystem({
        time_ctx: opts.timeCtx,
        workspace: opts.workspace,
        skills_summary: opts.skillsSummary ?? '',
      })
    }
    return `You are a subagent working in ${opts.workspace}. Complete the task and return a concise final answer.`
  }

  /** 子 Agent 结果播报 */
  renderSubagentAnnounce(opts: {
    label: string
    statusText: string
    task: string
    result: string
  }): string {
    if (this.templates.subagentAnnounce) {
      return this.templates.subagentAnnounce({
        label: opts.label,
        status_text: opts.statusText,
        task: opts.task,
        result: opts.result,
      })
    }
    return `[Subagent ${opts.label} ${opts.statusText}]\nTask: ${opts.task}\n\n${opts.result}`
  }

  // ── 通知评估器 ──────────────────────────────────────────

  /** 子 Agent 结果是否需要通知用户的评估提示词 */
  renderEvaluatorSystem(): string {
    if (this.templates.evaluator) {
      return this.templates.evaluator({ is_system: true, task_context: '', response: '' })
    }
    return ''
  }

  renderEvaluatorUser(taskContext: string, response: string): string {
    if (this.templates.evaluator) {
      return this.templates.evaluator({
        is_system: false,
        task_context: taskContext,
        response,
      })
    }
    return `## Original task\n${taskContext}\n\n## Agent response\n${response}`
  }

  // ── 记忆压缩 ────────────────────────────────────────────

  /** 对话压缩提取提示词 */
  renderConsolidatorArchive(): string {
    if (this.templates.consolidatorArchive) {
      return this.templates.consolidatorArchive({})
    }
    return `Extract key facts from this conversation. Return ONLY a compact bullet list.`
  }

  // ── 最大迭代次数 ────────────────────────────────────────

  /** 达到最大迭代次数时的消息 */
  renderMaxIterationsMessage(maxIterations: number): string {
    if (this.templates.maxIterationsMessage) {
      return this.templates.maxIterationsMessage({ max_iterations: maxIterations })
    }
    return `I reached the maximum number of tool call iterations (${maxIterations}) without completing the task. You can try breaking the task into smaller steps.`
  }

  // ── 工具方法 ────────────────────────────────────────────

  isDefaultMemory(content: string): boolean {
    try {
      const tmpl = fs.readFileSync(path.join(TEMPLATES_DIR, 'memory', 'MEMORY.md'), 'utf-8')
      return content.trim() === tmpl.trim()
    } catch {
      return false
    }
  }
}
