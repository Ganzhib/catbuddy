import type { LLMMessage, MessageRecord } from '@catbuddy/shared'
import type { FileAccessMode } from '../../security/index.js'

export const BOOTSTRAP_FILES = ['AGENTS.md', 'SOUL.md', 'USER.md', 'TOOLS.md'] as const

export interface ContextBuilderOpts {
  timezone?: string
  disabledSkills?: string[]
  /** User project root (file tools / exec cwd). Defaults to parent of `.catbuddy`. */
  workRoot?: string
  /** Mirrors PathGuard mode — drives identity.md file-access wording. */
  fileAccessMode?: FileAccessMode
  /** Global user profile workspace (`~/.catbuddy/workspace`). */
  globalWorkspace?: string
}

export interface BuildSystemPromptOptions {
  channel?: string
  chatId?: string
  senderId?: string
}

export interface BuildOptions {
  history: MessageRecord[]
  currentMessage: string
  media?: string[]
  channel?: string
  chatId?: string
  senderId?: string
  sessionSummary?: string | null
  sessionMetadata?: Record<string, unknown>
}

/** Full LLM runtime context produced by ContextBuilder.build(). */
export interface Context {
  messages: LLMMessage[]
  system: string
  metadata: Record<string, unknown>
  attachments?: string[]
}
