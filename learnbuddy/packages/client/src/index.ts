export {
  learnbuddyClient,
  createLearnbuddyClient,
  type StreamError,
} from './learnbuddy-client'
export {
  createAgentTransport,
  detectTransportMode,
  hasLearnbuddyIpc,
  type CreateTransportOptions,
} from './transport'
export type {
  AgentTransport,
  TransportCallbacks,
  SessionUpdateScope,
} from '@learnbuddy/shared'
export type { GatewayTransportConfig } from '@learnbuddy/gateway-sdk-web'
export * from './tool-traces'
