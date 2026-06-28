import * as fs from 'fs'
import * as path from 'path'
import type { Tool, ToolContext } from './types'
import { isBinaryFile, matchGlob } from './utils'

export function createGrepTool(ctx: ToolContext): Tool {
  return {
    name: 'grep',
    definition: {
      type: 'function',
      function: {
        name: 'grep',
        description:
          'Search file contents using literal or regex patterns. Supports glob filtering and context lines.',
        parameters: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Search pattern (literal or regex)' },
            path: { type: 'string', description: 'Directory or file to search in (defaults to project root)' },
            glob: { type: 'string', description: 'Optional glob filter (e.g. "*.ts", "*.md")' },
            output_mode: {
              type: 'string',
              enum: ['content', 'files_with_matches', 'count'],
              description: 'Output mode',
            },
            fixed_strings: { type: 'boolean', description: 'Treat pattern as literal string, not regex' },
            context_before: { type: 'number', description: 'Lines of context before each match' },
            context_after: { type: 'number', description: 'Lines of context after each match' },
            head_limit: { type: 'number', description: 'Max number of matches to return' },
          },
          required: ['pattern'],
        },
      },
    },
    execute: async (call) => {
      const a = call.arguments as Record<string, unknown>
      const pattern = String(a.pattern)
      const baseDir = ctx.resolvePath(String(a.path || ctx.workRoot))
      const glob = String(a.glob || '*')
      const fixedStrings = !!a.fixed_strings
      const outputMode = String(a.output_mode || 'content')
      const ctxBefore = Number(a.context_before) || 0
      const ctxAfter = Number(a.context_after) || 0
      const headLimit = Number(a.head_limit) || 50

      let regex: RegExp
      try {
        regex = fixedStrings
          ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
          : new RegExp(pattern, 'gi')
      } catch {
        return `Error: invalid pattern "${pattern}"`
      }

      const results: string[] = []

      const walkDir = (dir: string) => {
        if (results.length >= headLimit) return
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (results.length >= headLimit) break
          const fp = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
            walkDir(fp)
          } else if (entry.isFile()) {
            if (!matchGlob(entry.name, glob)) continue
            if (isBinaryFile(fp)) continue
            try {
              const content = fs.readFileSync(fp, 'utf-8')
              const lines = content.split('\n')
              let matches = 0
              for (let i = 0; i < lines.length && results.length < headLimit; i++) {
                if (regex.test(lines[i])) {
                  regex.lastIndex = 0
                  matches++
                  if (outputMode === 'files_with_matches') {
                    results.push(`[FILE] ${fp}`)
                    break
                  } else if (outputMode === 'count') {
                    continue
                  } else {
                    const start = Math.max(0, i - ctxBefore)
                    const end = Math.min(lines.length, i + ctxAfter + 1)
                    for (let j = start; j < end; j++) {
                      results.push(`${fp}:${j + 1}: ${lines[j]}`)
                    }
                  }
                }
              }
              if (outputMode === 'count' && matches > 0) results.push(`${fp}: ${matches} matches`)
            } catch {
              // skip unreadable files
            }
          }
        }
      }

      if (fs.statSync(baseDir).isFile()) {
        const content = fs.readFileSync(baseDir, 'utf-8')
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            regex.lastIndex = 0
            results.push(`${baseDir}:${i + 1}: ${lines[i]}`)
          }
        }
      } else {
        walkDir(baseDir)
      }

      return results.length > 0 ? results.slice(0, headLimit).join('\n') : '(no matches)'
    },
  }
}
