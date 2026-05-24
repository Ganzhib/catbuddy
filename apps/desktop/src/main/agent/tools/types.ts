import type { FileEditEvent, ToolCallRequest, ToolDefinition } from '@catbuddy/shared'

/** A single agent tool: schema + executor. */
export interface Tool {
  readonly name: string
  readonly definition: ToolDefinition
  execute(call: ToolCallRequest): Promise<string>
}

/** Runtime dependencies injected into each tool factory. */
export interface ToolContext {
  readonly workspace: string
  resolvePath(inputPath: string): string
  displayPath(resolved: string): string
  notifyFileEdit(edit: FileEditEvent): Promise<void>
  lineDelta(before: string, after: string): { added: number; deleted: number }
}

/** Factory that builds a tool from shared context (Factory pattern). */
export type ToolFactory = (ctx: ToolContext) => Tool
