import type { InboundEvent } from "@learnbuddy/shared";
export type RelayChatMessage = {
    id: string;
    role: "user" | "assistant" | "status";
    text: string;
    streaming?: boolean;
};
export declare function loadRelayWebPrefs(): {
    httpBase: string;
    viewerToken: string;
    sessionKey: string;
};
export declare function saveRelayWebPrefs(prefs: {
    httpBase: string;
    viewerToken: string;
    sessionKey: string;
}): void;
export declare function applyRelayInbound(messages: RelayChatMessage[], ev: InboundEvent): RelayChatMessage[];
export declare function useRelayChat(): {
    messages: RelayChatMessage[];
    connected: boolean;
    connecting: boolean;
    sending: boolean;
    error: string | null;
    sessionKey: string;
    connect: (opts: {
        httpBase: string;
        pairingCode: string;
        viewerToken: string;
        sessionKey: string;
    }) => Promise<void>;
    disconnect: () => void;
    send: (content: string) => Promise<void>;
    clearMessages: () => void;
};
//# sourceMappingURL=useRelayChat.d.ts.map