/**
 * Web-side helpers for cross-device relay (no Electron required).
 * See docs/CROSS_DEVICE_RELAY.md.
 */
import type { RelayHttpPairResponse, RelayHttpSendResponse } from "@learnbuddy/shared";
import type { InboundEvent } from "@learnbuddy/shared";
export interface RelayWebConfig {
    httpBase: string;
    wsUrl: string;
    viewerToken: string;
    deviceId?: string;
}
/** True when the relay-web page is served by Vite dev (use same-origin proxy). */
export declare function shouldUseRelayDevProxy(): boolean;
/** Prefer Vite `/relay-api` proxy in dev to avoid CORS (localhost vs 127.0.0.1). */
export declare function resolveRelayHttpBase(stored?: string): string;
export declare function relayWsUrlFromHttp(httpBase: string): string;
export declare function relayConfigFromEnv(): RelayWebConfig | null;
export declare function pairRelayViewer(httpBase: string, pairingCode: string, viewerToken: string): Promise<RelayHttpPairResponse>;
export declare function sendRelayMessage(httpBase: string, sessionKey: string, viewerToken: string, content: string, media?: string[]): Promise<RelayHttpSendResponse>;
export type RelayViewerCallbacks = {
    onEvent: (ev: InboundEvent) => void;
    onOpen?: () => void;
    onClose?: () => void;
    onError?: (message: string) => void;
};
/** Subscribe to ui_event stream for a session (Web UI). */
export declare function connectRelayViewer(config: RelayWebConfig, sessionKey: string, callbacks: RelayViewerCallbacks): () => void;
//# sourceMappingURL=relay-api.d.ts.map