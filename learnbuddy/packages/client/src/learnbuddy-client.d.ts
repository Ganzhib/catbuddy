/**
 * learnbuddyClient — UI-facing agent client (WebSocket-era API, unchanged contract).
 * Transport is injected: Electron IPC today, WebSocket when running in a browser.
 */
import type { ConnectionStatus, InboundEvent, OutboundMedia, OutboundImageGeneration } from "@learnbuddy/shared";
import type { AgentTransport, CreateTransportOptions, SessionUpdateScope } from "./transport/types";
type Unsubscribe = () => void;
type EventHandler = (ev: InboundEvent) => void;
type StatusHandler = (status: ConnectionStatus) => void;
type RuntimeModelHandler = (modelName: string | null, modelPreset?: string | null) => void;
type SessionUpdateHandler = (chatId: string, scope?: SessionUpdateScope) => void;
type GoHomeHandler = () => void;
export type StreamError = {
    kind: "message_too_big";
};
type ErrorHandler = (error: StreamError) => void;
export declare class learnbuddyClient {
    private readonly transport;
    status_: ConnectionStatus;
    /** @deprecated WebSocket socket; always null under IPC. Kept for UI compat. */
    socket: null;
    readyChatId: string;
    private knownChats;
    private chatHandlers;
    private statusHandlers;
    private runtimeModelHandlers;
    private sessionUpdateHandlers;
    private errorHandlers;
    private _goHomeHandlers;
    private _detachTransport;
    private _currentStreamId;
    private _activeChatId;
    private _latencyMs;
    constructor(transport: AgentTransport);
    get status(): ConnectionStatus;
    get defaultChatId(): string | null;
    /** WebSocket transports may implement URL switching; IPC is a no-op. */
    updateUrl(url: string): void;
    getRunStartedAt(_chatId: string): number | null;
    getGoalState(_chatId: string): undefined;
    connect(): void;
    close(): void;
    onStatus(handler: StatusHandler): Unsubscribe;
    onSessionUpdate(handler: SessionUpdateHandler): Unsubscribe;
    onRuntimeModelUpdate(handler: RuntimeModelHandler): Unsubscribe;
    onError(handler: ErrorHandler): Unsubscribe;
    onGoHomeRequest(handler: GoHomeHandler): Unsubscribe;
    onChat(chatId: string, handler: EventHandler): Unsubscribe;
    newChat(_timeoutMs?: number): Promise<string>;
    attach(chatId: string): void;
    sendMessage(chatId: string, content: string, media?: OutboundMedia[], _options?: {
        imageGeneration?: OutboundImageGeneration;
    }): void;
    private _emitSessionHandshake;
    private _dispatch;
    private setStatus;
}
export interface CreateLearnbuddyClientOptions {
    token: string;
    wsPath: string;
    /** Override auto-detected transport (desktop IPC vs web WebSocket). */
    transport?: AgentTransport;
    transportMode?: CreateTransportOptions["mode"];
}
/** Bootstrap entry: pluggable transport, same learnbuddyClient API for UI. */
export declare function createLearnbuddyClient(options: CreateLearnbuddyClientOptions): learnbuddyClient;
export {};
//# sourceMappingURL=learnbuddy-client.d.ts.map