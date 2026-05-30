/**
 * Context Builder — 组装 LLM 输入上下文
 * catbuddy/agent/context.py，用 Handlebars 替代 Jinja2
 */
import * as path from 'path'
import type { LLMMessage } from '@catbuddy/shared'
import type { FileAccessMode } from '../../security/index.js'
import { getGlobalProfileWorkspace, isLayeredWorkspace } from '../../services/global-profile.js'
import { WorkspaceFileSystem } from './file-system.js'
import { buildUserContent } from './media-helper.js'
import { PromptBuilder } from './prompt-builder.js'
import { SkillLoader } from './skill-loader.js'
import { TemplateLoader } from './template-loader.js'
import type { BuildOptions, Context, ContextBuilderOpts } from './types.js'

export type { BuildOptions, Context, ContextBuilderOpts } from './types.js'
export { buildUserContent } from './media-helper.js'

export class ContextBuilder {
  readonly workspace: string
  readonly globalWorkspace: string
  readonly workRoot: string
  readonly fileAccessMode: FileAccessMode
  readonly timezone: string
  readonly disabledSkills: Set<string>

  private fs: WorkspaceFileSystem
  private templates: TemplateLoader
  private skills: SkillLoader
  private promptBuilder: PromptBuilder

  get templateLoader(): TemplateLoader {
    return this.templates
  }

  constructor(workspace: string, opts: ContextBuilderOpts = {}) {
    this.workspace = workspace
    this.globalWorkspace = opts.globalWorkspace ?? getGlobalProfileWorkspace()
    this.workRoot =
      opts.workRoot ?? path.dirname(path.dirname(path.resolve(workspace)))
    this.fileAccessMode =
      opts.fileAccessMode ??
      (this.workRoot === path.resolve(workspace) ? 'internal' : 'project')
    this.timezone = opts.timezone ?? 'UTC'
    this.disabledSkills = new Set(opts.disabledSkills ?? [])

    this.fs = new WorkspaceFileSystem(
      this.workspace,
      this.globalWorkspace,
      () => this._usesGlobalProfile(),
    )
    this.templates = new TemplateLoader()
    this.skills = new SkillLoader(this.workspace, this.disabledSkills)
    this.promptBuilder = new PromptBuilder(
      this.fs,
      this.templates,
      this.skills,
      this.workspace,
      this.globalWorkspace,
      this.workRoot,
      this.fileAccessMode,
      () => this._usesGlobalProfile(),
    )
  }

  setDisabledSkills(names: string[]): void {
    this.disabledSkills.clear()
    for (const name of names) this.disabledSkills.add(name)
    this.promptBuilder.invalidateCache()
  }

  invalidateSystemPromptCache(): void {
    this.promptBuilder.invalidateCache()
  }

  readWorkspaceFile(name: string, workspaceDir?: string): string {
    return this.fs.readWorkspaceFile(name, workspaceDir)
  }

  ensureBootstrapFiles(): void {
    this.fs.ensureBootstrapFiles()
  }

  buildSystemPrompt(opts?: { channel?: string; chatId?: string; senderId?: string }): string {
    return this.promptBuilder.buildSystemPrompt(opts)
  }

  build(opts: BuildOptions): Context {
    const system = this.buildSystemPrompt({
      channel: opts.channel,
      chatId: opts.chatId,
      senderId: opts.senderId,
    })
    const messages: LLMMessage[] = []

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
        reasoningContent: m.reasoningContent,
      })
    }

    const runtimeCtx = this.promptBuilder.buildRuntimeContext(
      opts.channel,
      opts.chatId,
      opts.senderId,
      this.timezone,
    )
    const textWithCtx = runtimeCtx
      ? `${opts.currentMessage}\n\n[runtime: ${runtimeCtx}]`
      : opts.currentMessage

    messages.push({ role: 'user', content: buildUserContent(textWithCtx, opts.media ?? []) })

    return {
      messages,
      system,
      attachments: opts.media,
      metadata: {
        channel: opts.channel,
        chatId: opts.chatId,
        senderId: opts.senderId,
        sessionSummary: opts.sessionSummary ?? null,
        ...(opts.sessionMetadata ?? {}),
      },
    }
  }

  buildUserContent(text: string, media: string[]): LLMMessage['content'] {
    return buildUserContent(text, media)
  }

  private _usesGlobalProfile(): boolean {
    return isLayeredWorkspace(this.workspace)
  }
}
