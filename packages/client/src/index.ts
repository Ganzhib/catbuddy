export {
  catbuddyClient,
  createCatbuddyClient,
  type StreamError,
} from './catbuddy-client'
export {
  createAgentTransport,
  detectTransportMode,
  hasCatbuddyIpc,
  type CreateTransportOptions,
} from './transport'
export type {
  AgentTransport,
  TransportCallbacks,
  SessionUpdateScope,
} from '@catbuddy/shared'
export type { GatewayTransportConfig } from '@catbuddy/gateway-sdk-web'
export * from './tool-traces'
