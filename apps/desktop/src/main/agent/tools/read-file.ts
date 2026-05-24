import * as fs from 'fs'
import type { Tool, ToolContext } from './types'

export function createReadFileTool(_ctx: ToolContext): Tool {
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
            path: { type: 'string', description: 'File path (relative to workspace or absolute)' },
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
      const resolved = _ctx.resolvePath(String(fp))
      const content = fs.readFileSync(resolved, 'utf-8')
      const lines = content.split('\n')
      return lines
        .slice(Number(offset) || 0, limit ? Number(offset) + Number(limit) : undefined)
        .join('\n')
    },
  }
}
