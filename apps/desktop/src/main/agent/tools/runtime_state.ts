/**
 * RuntimeState protocol: agent loop state exposed to MyTool.
 * 对应 example/agent/tools/runtime_state.py
 */
import type { SubagentManager } from '../subagent'
import type { TokenUsage } from '@catbuddy/shared'

export interface RuntimeState {
  readonly model: string
  readonly maxIterations: number
  readonly currentIteration: number
  readonly toolNames: string[]
  readonly workspace: string
  readonly providerRetryMode: string
  readonly maxToolResultChars: number
  readonly contextWindowTokens: number
  readonly modelPreset: string | null
  readonly subagents: SubagentManager | null
  readonly runtimeVars: Record<string, unknown>
  readonly lastUsage: TokenUsage | null
  setRuntimeValue?(key: string, value: unknown): string
}
