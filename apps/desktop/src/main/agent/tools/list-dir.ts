import * as fs from 'fs'
import * as path from 'path'
import type { Tool, ToolContext } from './types'
import { formatFileSize } from './utils'

export function createListDirTool(ctx: ToolContext): Tool {
  return {
    name: 'list_dir',
    definition: {
      type: 'function',
      function: {
        name: 'list_dir',
        description: 'List files and directories in a given path.',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path' },
          },
          required: ['path'],
        },
      },
    },
    execute: async (call) => {
      const dirPath = String((call.arguments as Record<string, unknown>).path)
      const resolved = ctx.resolvePath(dirPath)
      const entries = fs.readdirSync(resolved, { withFileTypes: true })
      if (entries.length === 0) return '(empty directory)'
      return entries
        .map((e) => {
          const prefix = e.isDirectory() ? '[DIR] ' : e.isFile() ? '[FILE]' : '[LINK]'
          const size = e.isFile()
            ? ` ${formatFileSize(fs.statSync(path.join(resolved, e.name)).size)}`
            : ''
          return `${prefix} ${e.name}${size}`
        })
        .join('\n')
    },
  }
}
