/** Production Web transport (AgentTransport). */
export { GatewayTransport, type GatewayTransportConfig } from './gateway-transport.js'

/** Shared session WS + HTTP helpers (also used by `@catbuddy/ui`). */
export {
  activeSessionKeyFromChatId,
  dispatchGatewayUiEvent,
  ensureGatewaySessionOnHttp,
  openGatewayWebSocket,
  postGatewayUserMessage,
  resolveGatewayWebToken,
  type GatewayUiDispatch,
  type GatewayWebSocketConfig,
  type GatewayWebSocketHandle,
} from './gateway-web-session.js'
