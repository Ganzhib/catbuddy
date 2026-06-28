import * as fs from 'fs'
import type { Tool, ToolContext } from './types'
import { currentFileStates } from './file_state'

export function createReadFileTool(ctx: ToolContext): Tool {
  return {
    name: 'read_file',
    definition: {
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read the contents of a file. Supports offset/limit for partial reads.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path (relative to project root alongside .catbuddy, or absolute)' },
            offset: { type: 'number', description: 'Line number to start reading from (0-indexed)' },
            limit: { type: 'number', description: 'Maximum number of lines to read' },
          },
          required: ['path'],
        },
      },
    },
    execute: async (call) => {
      const { path: fp, offset = 0, limit } = call.arguments as Record<string, unknown>
      if (!fp) return 'Error: path required'
      const resolved = ctx.resolvePath(String(fp))
      const off = Number(offset) || 0
      const lim = limit != null ? Number(limit) : null
      const states = currentFileStates(ctx.fileStates)

      if (states.isUnchanged(resolved, off, lim)) {
        return 'File unchanged since last read at the same offset/limit.'
      }

      const content = fs.readFileSync(resolved, 'utf-8')
      const lines = content.split('\n')
      const slice = lines.slice(off, lim != null ? off + lim : undefined)
      states.recordRead(resolved, off, lim)
      return slice.join('\n')
    },
  }
}
