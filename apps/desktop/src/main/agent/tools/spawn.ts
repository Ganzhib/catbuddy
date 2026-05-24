/**
 * Spawn tool for creating background subagents.
 * 对应 example/agent/tools/spawn.py
 */
import type { Tool } from './types'
import type { SubagentManager } from '../subagent'

export interface SpawnContext {
  originChannel: string
  originChatId: string
  sessionKey: string
}

export function createSpawnTool(
  manager: SubagentManager,
  getContext: () => SpawnContext,
): Tool {
  return {
    name: 'spawn',
    definition: {
      type: 'function',
      function: {
        name: 'spawn',
        description:
          'Spawn a subagent to handle a task in the background. '
          + 'Use for complex or time-consuming tasks that can run independently.',
        parameters: {
          type: 'object',
          properties: {
            task: { type: 'string', description: 'The task for the subagent to complete' },
            label: { type: 'string', description: 'Optional short label' },
            temperature: { type: 'number', description: 'Optional sampling temperature' },
          },
          required: ['task'],
        },
      },
    },
    execute: async (call) => {
      const { task, label, temperature } = call.arguments as Record<string, unknown>
      const ctx = getContext()
      return manager.spawn({
        task: String(task),
        label: label != null ? String(label) : null,
        originChannel: ctx.originChannel,
        originChatId: ctx.originChatId,
        sessionKey: ctx.sessionKey,
        temperature: temperature != null ? Number(temperature) : undefined,
      })
    },
  }
}
