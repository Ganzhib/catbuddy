/** MessageFrame push client (new protocol). */
export { DesktopClient } from './client.js'
export type { DesktopClientConfig, DesktopClientStatus } from './client.js'

/** Desktop session WebSocket client (Electron). */
export { DesktopGatewayClient } from './desktop-client.js'
export type {
  DesktopGatewayConfig,
  DesktopGatewayStatus,
  DesktopInboundMessage,
} from './desktop-client.js'
