import type { AgentTransport, TransportCallbacks } from "./types";
export declare class IpcTransport implements AgentTransport {
    readonly kind: "ipc";
    attach(callbacks: TransportCallbacks): () => void;
    sendMessage(chatId: string, content: string, mediaUrls?: string[]): void;
}
//# sourceMappingURL=ipc-transport.d.ts.map