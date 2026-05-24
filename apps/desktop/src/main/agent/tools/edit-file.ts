import * as fs from 'fs'
import type { Tool, ToolContext } from './types'
import { currentFileStates } from './file_state'

export function createEditFileTool(ctx: ToolContext): Tool {
  return {
    name: 'edit_file',
    definition: {
      type: 'function',
      function: {
        name: 'edit_file',
        description:
          'Perform exact string replacement in an existing file. Provide old_string and new_string.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File to edit' },
            old_string: { type: 'string', description: 'Exact text to replace' },
            new_string: { type: 'string', description: 'Replacement text' },
          },
          required: ['path', 'old_string', 'new_string'],
        },
      },
    },
    execute: async (call) => {
      const { path: fp, old_string, new_string } = call.arguments as Record<string, unknown>
      const resolved = ctx.resolvePath(String(fp))
      const display = ctx.displayPath(resolved)
      const base = {
        call_id: call.id,
        tool: 'edit_file',
        path: display,
        absolute_path: resolved,
      }
      void ctx.notifyFileEdit({
        ...base,
        version: 1,
        phase: 'start',
        status: 'editing',
        added: 0,
        deleted: 0,
      })
      if (!fs.existsSync(resolved)) {
        await ctx.notifyFileEdit({
          ...base,
          version: 1,
          phase: 'error',
          status: 'error',
          added: 0,
          deleted: 0,
          error: 'file not found',
        })
        return 'Error: file not found'
      }
      try {
        const warning = currentFileStates(ctx.fileStates).checkRead(resolved)
        const content = fs.readFileSync(resolved, 'utf-8')
        const old = String(old_string)
        const neu = String(new_string)
        const count = content.split(old).length - 1
        if (count === 0) {
          await ctx.notifyFileEdit({
            ...base,
            version: 1,
            phase: 'error',
            status: 'error',
            added: 0,
            deleted: 0,
            error: 'old_string not found',
          })
          return 'Error: old_string not found in file'
        }
        if (count > 1) {
          await ctx.notifyFileEdit({
            ...base,
            version: 1,
            phase: 'error',
            status: 'error',
            added: 0,
            deleted: 0,
            error: `matches ${count} times`,
          })
          return `Error: old_string matches ${count} times — must be unique. Provide more context.`
        }
        const updated = content.replace(old, neu)
        fs.writeFileSync(resolved, updated, 'utf-8')
        currentFileStates(ctx.fileStates).recordWrite(resolved)
        const added = neu.split('\n').length
        const deleted = old.split('\n').length
        await ctx.notifyFileEdit({
          ...base,
          version: 1,
          phase: 'end',
          status: 'done',
          added,
          deleted,
          approximate: true,
        })
        const prefix = warning ? `${warning}\n\n` : ''
        return `${prefix}File edited: ${resolved} (1 replacement, ${updated.split('\n').length} lines)`
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        await ctx.notifyFileEdit({
          ...base,
          version: 1,
          phase: 'error',
          status: 'error',
          added: 0,
          deleted: 0,
          error: message,
        })
        return `Error executing edit_file: ${message}`
      }
    },
  }
}
