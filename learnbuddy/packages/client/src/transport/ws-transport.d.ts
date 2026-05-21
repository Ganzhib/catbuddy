import type { AgentTransport, TransportCallbacks } from "./types";
/**
 * WebSocket transport for a future browser build (gateway / webui protocol).
 * Wire format: JSON InboundEvent inbound, Outbound outbound.
 */
export declare class WsTransport implements AgentTransport {
    private readonly token;
    private readonly baseUrl;
    readonly kind: "websocket";
    private socket;
    private url;
    private reconnectTimer;
    constructor(token: string, wsPath: string, baseUrl?: string);
    attach(callbacks: TransportCallbacks): () => void;
    sendMessage(chatId: string, content: string, mediaUrls?: string[]): void;
    updateUrl(url: string): void;
    private openSocket;
    private scheduleReconnect;
    private sendJson;
    private teardown;
}
//# sourceMappingURL=ws-transport.d.ts.map