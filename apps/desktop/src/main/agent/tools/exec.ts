import { exec as cpExec } from 'child_process'
import { containsInternalUrl } from '../../security/network.js'
import type { Tool, ToolContext } from './types'

export function createExecTool(ctx: ToolContext): Tool {
  return {
    name: 'exec',
    definition: {
      type: 'function',
      function: {
        name: 'exec',
        description:
          'Execute a shell command with timeout. Working directory defaults to the project root (alongside .catbuddy). Output is truncated.',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Shell command to execute' },
            working_dir: { type: 'string', description: 'Working directory (default: project root)' },
            timeout: { type: 'number', description: 'Timeout in seconds (default 30, max 120)' },
          },
          required: ['command'],
        },
      },
    },
    execute: async (call) => {
      const { command, working_dir, timeout = 30 } = call.arguments as Record<string, unknown>
      const cmd = String(command)
      const cwd = working_dir ? ctx.resolvePath(String(working_dir)) : ctx.workRoot
      const to = Math.min(Number(timeout) || 30, 120)

      const dangerous = /\brm\s+-rf\b|\bformat\b|\bdd\b|\bmkfs\b|\b:\(\)\b|\bchmod\s+777\b/i
      if (dangerous.test(cmd)) return 'Error: dangerous command blocked'
      if (containsInternalUrl(cmd)) return 'Error: command contains blocked internal URL'

      return new Promise<string>((resolve) => {
        cpExec(
          cmd,
          { cwd, timeout: to * 1000, maxBuffer: 100 * 1024, windowsHide: true },
          (err, stdout, stderr) => {
            let output = ''
            if (stdout) {
              output += stdout.length > 10000
                ? stdout.slice(0, 10000) + '\n... (stdout truncated)'
                : stdout
            }
            if (stderr) {
              output += '\n[stderr]\n'
              output += stderr.length > 5000
                ? stderr.slice(0, 5000) + '\n... (stderr truncated)'
                : stderr
            }
            if (err) {
              output += `\nExit code: ${(err as NodeJS.ErrnoException).code ?? err.message}`
            }
            resolve(output.trim() || `(executed: ${cmd.slice(0, 80)})`)
          },
        )
      })
    },
  }
}
