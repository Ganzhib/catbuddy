/**
 * MyTool: runtime state inspection and configuration for the agent loop.
 * 对应 example/agent/tools/self.py
 */
import type { Tool, ToolContext } from './types'
import type { RuntimeState } from './runtime_state'

const BLOCKED = new Set([
  'bus', 'provider', '_running', 'tools', '_runtimeVars',
  'runner', 'sessions', 'consolidator', 'dream', 'autoCompact',
  'context', 'commands', '_mcpServers', '_pendingQueues',
  '_sessionLocks', '_activeTasks', '_backgroundTasks',
  'restrictToWorkspace', 'channelsConfig', '_concurrencyGate',
  '_unifiedSession', '_extraHooks',
])

const READ_ONLY = new Set([
  'subagents', 'currentIteration', 'execConfig', 'webConfig',
])

const RESTRICTED: Record<string, { type: 'number' | 'string'; min?: number; max?: number }> = {
  maxIterations: { type: 'number', min: 1, max: 100 },
  contextWindowTokens: { type: 'number', min: 4096, max: 1_000_000 },
  model: { type: 'string' },
}

export function createMyTool(
  runtime: RuntimeState,
  opts: { modifyAllowed?: boolean } = {},
): Tool {
  const modifyAllowed = opts.modifyAllowed ?? false

  return {
    name: 'my',
    definition: {
      type: 'function',
      function: {
        name: 'my',
        description:
          'Check and set your own runtime state. Actions: check, set. '
          + 'Key values: currentIteration, maxIterations. '
          + (modifyAllowed ? '' : 'READ-ONLY MODE: set is disabled.'),
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['check', 'set'] },
            key: { type: 'string', description: 'Dot-path, e.g. maxIterations, model' },
            value: { description: 'New value for set' },
          },
          required: ['action'],
        },
      },
    },
    execute: async (call) => {
      const { action, key, value } = call.arguments as Record<string, unknown>
      const act = String(action)

      if (act === 'check') {
        if (!key) {
          return [
            `model: ${runtime.model}`,
            `max_iterations: ${runtime.maxIterations}`,
            `current_iteration: ${runtime.currentIteration}`,
            `context_window_tokens: ${runtime.contextWindowTokens}`,
            `tools: ${runtime.toolNames.join(', ')}`,
            `model_preset: ${runtime.modelPreset ?? '(none)'}`,
            `running_subagents: ${runtime.subagents?.getRunningCount() ?? 0}`,
          ].join('\n')
        }
        const k = String(key)
        if (BLOCKED.has(k)) return `Error: cannot inspect blocked key "${k}"`
        return String(
          (runtime as unknown as Record<string, unknown>)[k] ?? `(key "${k}" not found)`,
        )
      }

      if (act === 'set') {
        if (!modifyAllowed) return 'Error: set is disabled (read-only mode)'
        if (!key) return 'Error: key required for set'
        const k = String(key)
        if (BLOCKED.has(k) || READ_ONLY.has(k)) {
          return `Error: cannot modify "${k}"`
        }
        const rule = RESTRICTED[k]
        if (!rule) return `Error: key "${k}" is not settable`
        if (!('setRuntimeValue' in runtime)) {
          return 'Error: runtime does not support set'
        }
        return (runtime as RuntimeState & { setRuntimeValue: (k: string, v: unknown) => string })
          .setRuntimeValue(k, value)
      }

      return 'Error: action must be check or set'
    },
  }
}

/** Unused ctx — MyTool uses RuntimeState, not ToolContext. */
export function createMyToolFromCtx(_ctx: ToolContext): Tool {
  throw new Error('createMyTool requires RuntimeState; register via AgentLoop')
}
