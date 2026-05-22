/** MessageFrame push client (new protocol). */
export { DesktopClient } from './client.js'
export type { DesktopClientConfig, DesktopClientStatus } from './types.js'

/** Legacy executor relay (Electron desktop). */
export { ExecutorRelayClient } from './executor-relay.js'
export type {
  ExecutorRelayConfig,
  ExecutorRelayStatus,
  ExecutorInboundMessage,
} from './executor-relay.js'
