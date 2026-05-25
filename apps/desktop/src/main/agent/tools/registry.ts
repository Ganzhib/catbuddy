/**
 * Tool Registry — register, lookup, and execute agent tools.
 *
 * To add a tool: create `tools/my-tool.ts`, export `createMyTool`, append to `builtinToolFactories`.
 */
import * as path from 'path'
import type { FileEditEvent, ToolCallRequest, ToolDefinition } from '@catbuddy/shared'
import { createPathGuard, PathGuard } from '../../security/index.js'
import { CATBUDDY_DIR_NAME } from '../../services/workspace-project.js'
import { builtinToolFactories } from './builtin'
import { FileStates } from './file_state'
import type { Tool, ToolContext } from './types'

export class ToolRegistry {
  private readonly _tools = new Map<string, Tool>()
  private _workspace: string = ''
  private _projectRoot: string = ''
  private _catbuddyDir: string = ''
  private _restrictWorkspace: boolean = false
  private _pathGuard?: PathGuard
  private _fileEditCallback?: (edit: FileEditEvent) => Promise<void>
  private readonly _defaultFileStates = new FileStates()

  setWorkspace(dir: string, restrict: boolean = false): void {
    this._workspace = path.resolve(dir)
    this._restrictWorkspace = restrict
    if (!this._projectRoot) {
      this._projectRoot = path.dirname(path.dirname(this._workspace))
    }
    this._rebuildPathGuard()
  }

  /** File tools resolve relative paths against project root (siblings of `.catbuddy`). */
  setProjectRoot(root: string, catbuddyDir?: string): void {
    this._projectRoot = path.resolve(root)
    this._catbuddyDir = catbuddyDir
      ? path.resolve(catbuddyDir)
      : path.join(this._projectRoot, CATBUDDY_DIR_NAME)
    this._rebuildPathGuard()
  }

  setPathGuard(guard: PathGuard): void {
    this._pathGuard = guard
    this._workspace = guard.workspace
    this._projectRoot = guard.projectRoot
    this._catbuddyDir = guard.catbuddyDir
    this._restrictWorkspace = guard.policy.restrictToWorkspace
  }

  setFileEditCallback(cb?: (edit: FileEditEvent) => Promise<void>): void {
    this._fileEditCallback = cb
  }

  /** Shared runtime passed into each tool factory. */
  createToolContext(): ToolContext {
    const guard = this._pathGuard!
    return {
      workRoot: guard.workRoot,
      workspace: guard.workspace,
      fileStates: this._defaultFileStates,
      resolvePath: (input) => this.resolvePath(input),
      displayPath: (resolved) => guard.displayPath(resolved),
      notifyFileEdit: (edit) => this.notifyFileEdit(edit),
      lineDelta: (before, after) => this.lineDelta(before, after),
    }
  }

  register(tool: Tool): void {
    this._tools.set(tool.name, tool)
  }

  unregister(name: string): boolean {
    return this._tools.delete(name)
  }

  /** Remove tools whose names start with *prefix* (e.g. `mcp_` on reload). */
  unregisterByPrefix(prefix: string): string[] {
    const removed: string[] = []
    for (const name of [...this._tools.keys()]) {
      if (name.startsWith(prefix)) {
        this._tools.delete(name)
        removed.push(name)
      }
    }
    return removed
  }

  get(name: string): Tool | undefined {
    return this._tools.get(name)
  }

  getDefinitions(): ToolDefinition[] {
    return [...this._tools.values()].map((t) => t.definition)
  }

  get toolNames(): string[] {
    return [...this._tools.keys()]
  }

  async execute(call: ToolCallRequest): Promise<string> {
    const tool = this._tools.get(call.name)
    if (!tool) return `Error: unknown tool "${call.name}"`
    try {
      return await tool.execute(call)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return `Error executing ${call.name}: ${message}`
    }
  }

  registerBuiltinTools(): void {
    const ctx = this.createToolContext()
    for (const factory of builtinToolFactories) {
      this.register(factory(ctx))
    }
    console.log(
      '[tools] Registered %d tools: %s',
      this.toolNames.length,
      this.toolNames.join(', '),
    )
  }

  resolvePath(inputPath: string): string {
    if (!this._pathGuard) {
      throw new Error('PathGuard not initialized — call setWorkspace/setProjectRoot first')
    }
    return this._pathGuard.resolve(inputPath)
  }

  private _rebuildPathGuard(): void {
    if (!this._workspace) return
    const projectRoot = this._projectRoot || path.dirname(path.dirname(this._workspace))
    const catbuddyDir =
      this._catbuddyDir || path.join(projectRoot, CATBUDDY_DIR_NAME)
    this._pathGuard = createPathGuard({
      workspace: this._workspace,
      projectRoot,
      catbuddyDir,
      policy: {
        restrictToWorkspace: this._restrictWorkspace,
        hasSelectedFolder: !this._restrictWorkspace,
        isSensitiveRegion: this._restrictWorkspace,
      },
    })
  }

  private lineDelta(before: string, after: string): { added: number; deleted: number } {
    const beforeLines = before === '' ? 0 : before.split('\n').length
    const afterLines = after === '' ? 0 : after.split('\n').length
    return {
      added: Math.max(0, afterLines - beforeLines),
      deleted: Math.max(0, beforeLines - afterLines),
    }
  }

  private async notifyFileEdit(edit: FileEditEvent): Promise<void> {
    await this._fileEditCallback?.(edit)
  }
}
