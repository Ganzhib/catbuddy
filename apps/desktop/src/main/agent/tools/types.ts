import type { FileEditEvent, DiagramUiEvent, ToolCallRequest, ToolDefinition } from '@catbuddy/shared'
import type { FileStates } from './file_state'

/** A single agent tool: schema + executor. */
export interface Tool {
  readonly name: string
  readonly definition: ToolDefinition
  execute(call: ToolCallRequest): Promise<string>
}

/** Runtime dependencies injected into each tool factory. */
export interface ToolContext {
  /** User project root (siblings of `.catbuddy`). Default cwd / relative paths. */
  readonly workRoot: string
  /** CatBuddy internal dir (`…/.catbuddy/workspace`) — skills, memory, sessions. */
  readonly workspace: string
  /** Fallback when AsyncLocalStorage has no bound session. */
  readonly fileStates: FileStates
  resolvePath(inputPath: string): string
  displayPath(resolved: string): string
  notifyFileEdit(edit: FileEditEvent): Promise<void>
  notifyDiagramEvent?(event: DiagramUiEvent): Promise<void>
  lineDelta(before: string, after: string): { added: number; deleted: number }
}

/** Factory that builds a tool from shared context (Factory pattern). */
export type ToolFactory = (ctx: ToolContext) => Tool
