import * as fs from 'fs'
import * as path from 'path'
import type { Tool, ToolContext } from './types'
import { currentFileStates } from './file_state'

export function createWriteFileTool(ctx: ToolContext): Tool {
  return {
    name: 'write_file',
    definition: {
      type: 'function',
      function: {
        name: 'write_file',
        description: 'Write or overwrite a file with the given content.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' },
            content: { type: 'string', description: 'Content to write' },
          },
          required: ['path', 'content'],
        },
      },
    },
    execute: async (call) => {
      const { path: fp, content } = call.arguments as Record<string, unknown>
      if (typeof fp !== 'string' || !fp.trim()) return 'Error: path required'
      const resolved = ctx.resolvePath(fp)
      const display = ctx.displayPath(resolved)
      const base = {
        call_id: call.id,
        tool: 'write_file',
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
      const after = String(content ?? '')
      if (display.toLowerCase().endsWith('.drawio')) {
        void ctx.notifyDiagramEvent?.({
          type: 'display',
          path: display,
          absolutePath: resolved,
          xml: after,
          callId: call.id,
        })
      }
      try {
        const before = fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf-8') : ''
        fs.mkdirSync(path.dirname(resolved), { recursive: true })
        fs.writeFileSync(resolved, after, 'utf-8')
        currentFileStates(ctx.fileStates).recordWrite(resolved)
        const { added, deleted } = ctx.lineDelta(before, after)
        await ctx.notifyFileEdit({
          ...base,
          version: 1,
          phase: 'end',
          status: 'done',
          added: before === '' ? after.split('\n').length : added,
          deleted: before === '' ? 0 : deleted,
          approximate: before !== '',
        })
        return `File written: ${resolved} (${Buffer.byteLength(after)} bytes)`
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
        return `Error executing write_file: ${message}`
      }
    },
  }
}
