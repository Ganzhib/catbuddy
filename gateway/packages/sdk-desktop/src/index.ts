/** Desktop session WebSocket client (Node). */
export {
  GatewayDesktopClient,
  loadGatewayConfigFromEnv,
  loadGatewayConfigFromSources,
  type GatewayCreateSessionHandler,
  type GatewayDesktopClientConfig,
  type GatewayDesktopClientOptions,
  type GatewayDesktopClientStatus,
  type GatewayInboundHandler,
  type GatewaySessionProvider,
  type ThreadSnapshotBuilder,
} from './gateway-desktop-client.js'

export {
  GATEWAY_DESKTOP_RECONNECT_MS,
  type GatewayInboundMessage,
} from './gateway-desktop-session.js'
