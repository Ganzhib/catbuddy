/** Production Web transport (AgentTransport). */
export { GatewayTransport, type GatewayTransportConfig } from './gateway-transport.js'

/** MessageFrame push client (experimental). */
export {
  WebSocketClient,
  type WebClientConfig,
  type WebClientStatus,
} from './client.js'

/** Lower-level Web client without AgentTransport callbacks. */
export { WebGatewayClient } from './web-client.js'
export type { WebGatewayConfig, WebGatewayStatus } from './web-client.js'
