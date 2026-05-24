/**
 * Session support for long-running exec workflows.
 * 对应 example/agent/tools/exec_session.py
 */
import { spawn } from 'node:child_process'
import type { Tool, ToolContext } from './types'

const DEFAULT_YIELD_MS = 1000
const MAX_YIELD_MS = 30_000
const DEFAULT_MAX_OUTPUT_CHARS = 10_000

interface SessionPoll {
  output: string
  done: boolean
  exitCode: number | null
  elapsedS: number
}

class ExecSession {
  private readonly _chunks: string[] = []
  private readonly _startedAt = performance.now()
  private readonly _deadline: number

  constructor(
    readonly sessionId: string,
    readonly command: string,
    readonly cwd: string,
    private readonly _proc: ReturnType<typeof spawn>,
    timeoutSec: number | null,
  ) {
    this._deadline = timeoutSec
      ? performance.now() + timeoutSec * 1000
      : Number.POSITIVE_INFINITY
    _proc.stdout?.on('data', (buf) => {
      this._chunks.push(buf.toString('utf-8'))
    })
    _proc.stderr?.on('data', (buf) => {
      this._chunks.push(`STDERR:\n${buf.toString('utf-8')}`)
    })
  }

  poll(yieldMs: number, maxOutputChars: number): SessionPoll {
    const elapsedS = (performance.now() - this._startedAt) / 1000
    const output = this._chunks.join('').slice(0, maxOutputChars)
    const done = this._proc.exitCode !== null
    const timedOut = performance.now() > this._deadline
    if (timedOut && !done) {
      this._proc.kill()
    }
    return {
      output,
      done: done || timedOut,
      exitCode: this._proc.exitCode,
      elapsedS,
    }
  }
}

class ExecSessionManager {
  private readonly _sessions = new Map<string, ExecSession>()

  start(
    command: string,
    cwd: string,
    timeoutSec: number | null,
  ): string {
    const sessionId = `exec-${Date.now().toString(36)}`
    const proc = spawn(command, {
      cwd,
      shell: true,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    this._sessions.set(
      sessionId,
      new ExecSession(sessionId, command, cwd, proc, timeoutSec),
    )
    return sessionId
  }

  async pollAsync(
    sessionId: string,
    yieldMs = DEFAULT_YIELD_MS,
    maxOutputChars = DEFAULT_MAX_OUTPUT_CHARS,
  ): Promise<string> {
    const session = this._sessions.get(sessionId)
    if (!session) return `Error: unknown session ${sessionId}`
    const clamped = Math.min(Math.max(yieldMs, 100), MAX_YIELD_MS)
    await new Promise((r) => setTimeout(r, clamped))
    const result = session.poll(clamped, maxOutputChars)
    if (result.done) this._sessions.delete(sessionId)
    return [
      `session_id: ${sessionId}`,
      `done: ${result.done}`,
      `exit_code: ${result.exitCode ?? 'null'}`,
      `elapsed_s: ${result.elapsedS.toFixed(1)}`,
      '',
      result.output || '(no output yet)',
    ].join('\n')
  }
}

const _manager = new ExecSessionManager()

export function createExecSessionTool(ctx: ToolContext): Tool {
  return {
    name: 'exec_session',
    definition: {
      type: 'function',
      function: {
        name: 'exec_session',
        description:
          'Long-running shell session: start (returns session_id), then poll until done.',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['start', 'poll'] },
            command: { type: 'string', description: 'Shell command (start)' },
            session_id: { type: 'string', description: 'Session id (poll)' },
            working_dir: { type: 'string' },
            timeout: { type: 'number', description: 'Timeout seconds (start)' },
            yield_ms: { type: 'number', description: 'Poll wait ms (poll)' },
          },
          required: ['action'],
        },
      },
    },
    execute: async (call) => {
      const args = call.arguments as Record<string, unknown>
      const action = String(args.action)
      if (action === 'start') {
        const command = String(args.command ?? '')
        if (!command) return 'Error: command required'
        const cwd = args.working_dir
          ? ctx.resolvePath(String(args.working_dir))
          : ctx.workspace
        const timeout = args.timeout != null ? Number(args.timeout) : null
        const id = _manager.start(command, cwd, timeout)
        return `Started background exec session: ${id}`
      }
      if (action === 'poll') {
        const sessionId = String(args.session_id ?? '')
        if (!sessionId) return 'Error: session_id required'
        return _manager.pollAsync(
          sessionId,
          args.yield_ms != null ? Number(args.yield_ms) : undefined,
        )
      }
      return 'Error: action must be start or poll'
    },
  }
}
