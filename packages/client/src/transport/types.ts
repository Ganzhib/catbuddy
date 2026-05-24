export type {
  AgentTransport,
  SessionUpdateScope,
  TransportCallbacks,
  TransportKind,
} from '@learnbuddy/shared'

export interface CreateTransportOptions {
  mode?: 'auto' | 'desktop' | 'web' | 'gateway'
  token: string
  wsPath: string
  gatewayHttpBase?: string
}
