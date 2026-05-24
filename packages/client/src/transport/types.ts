export type {
  AgentTransport,
  SessionUpdateScope,
  TransportCallbacks,
  TransportKind,
} from '@catbuddy/shared'

export interface CreateTransportOptions {
  mode?: 'auto' | 'desktop' | 'web' | 'gateway'
  token: string
  wsPath: string
  gatewayHttpBase?: string
}
