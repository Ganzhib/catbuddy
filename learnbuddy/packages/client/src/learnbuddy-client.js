import { createAgentTransport } from "./transport/create-transport";
const DEFAULT_CHAT_ID = `desktop:${Date.now()}_main`;
export class learnbuddyClient {
    transport;
    status_ = "idle";
    /** @deprecated WebSocket socket; always null under IPC. Kept for UI compat. */
    socket = null;
    readyChatId = DEFAULT_CHAT_ID;
    knownChats = new Set();
    chatHandlers = new Map();
    statusHandlers = new Set();
    runtimeModelHandlers = new Set();
    sessionUpdateHandlers = new Set();
    errorHandlers = new Set();
    _goHomeHandlers = new Set();
    _detachTransport = null;
    _currentStreamId = null;
    _activeChatId = DEFAULT_CHAT_ID;
    _latencyMs = null;
    constructor(transport) {
        this.transport = transport;
    }
    get status() {
        return this.status_;
    }
    get defaultChatId() {
        return DEFAULT_CHAT_ID;
    }
    /** WebSocket transports may implement URL switching; IPC is a no-op. */
    updateUrl(url) {
        this.transport.updateUrl?.(url);
    }
    getRunStartedAt(_chatId) {
        return null;
    }
    getGoalState(_chatId) {
        return undefined;
    }
    connect() {
        if (this._detachTransport) {
            this._detachTransport();
            this._detachTransport = null;
        }
        this.knownChats.add(DEFAULT_CHAT_ID);
        this._detachTransport = this.transport.attach({
            getActiveChatId: () => this._activeChatId,
            onEvent: (ev) => {
                if (ev.event === "delta" && ev.stream_id) {
                    this._currentStreamId = ev.stream_id;
                }
                const chatId = "chat_id" in ev && typeof ev.chat_id === "string"
                    ? ev.chat_id
                    : this._activeChatId;
                this._dispatch(chatId, ev);
            },
            onStatus: (status) => this.setStatus(status),
            onSessionUpdate: (chatId, scope) => {
                for (const h of this.sessionUpdateHandlers) {
                    try {
                        h(chatId, scope);
                    }
                    catch {
                        /* isolated */
                    }
                }
            },
            onGoHome: () => {
                for (const h of this._goHomeHandlers) {
                    try {
                        h();
                    }
                    catch {
                        /* isolated */
                    }
                }
            },
        });
    }
    close() {
        this._detachTransport?.();
        this._detachTransport = null;
        this.chatHandlers.clear();
        this.setStatus("closed");
    }
    onStatus(handler) {
        this.statusHandlers.add(handler);
        handler(this.status_);
        return () => this.statusHandlers.delete(handler);
    }
    onSessionUpdate(handler) {
        this.sessionUpdateHandlers.add(handler);
        return () => this.sessionUpdateHandlers.delete(handler);
    }
    onRuntimeModelUpdate(handler) {
        this.runtimeModelHandlers.add(handler);
        return () => this.runtimeModelHandlers.delete(handler);
    }
    onError(handler) {
        this.errorHandlers.add(handler);
        return () => this.errorHandlers.delete(handler);
    }
    onGoHomeRequest(handler) {
        this._goHomeHandlers.add(handler);
        return () => this._goHomeHandlers.delete(handler);
    }
    onChat(chatId, handler) {
        let handlers = this.chatHandlers.get(chatId);
        if (!handlers) {
            handlers = new Set();
            this.chatHandlers.set(chatId, handlers);
        }
        handlers.add(handler);
        return () => {
            handlers?.delete(handler);
            if (handlers?.size === 0)
                this.chatHandlers.delete(chatId);
        };
    }
    newChat(_timeoutMs = 5000) {
        const newId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        this.knownChats.add(newId);
        return Promise.resolve(newId);
    }
    attach(chatId) {
        this.knownChats.add(chatId);
    }
    sendMessage(chatId, content, media, _options) {
        this.knownChats.add(chatId);
        this._activeChatId = chatId;
        const mediaUrls = media?.map((m) => m.data_url) ?? [];
        this.transport.sendMessage(chatId, content, mediaUrls);
    }
    _emitSessionHandshake() {
        const clientId = this.transport.kind === "ipc" ? "desktop" : "web";
        this._dispatch(DEFAULT_CHAT_ID, {
            event: "ready",
            chat_id: DEFAULT_CHAT_ID,
            client_id: clientId,
        });
        this._dispatch(DEFAULT_CHAT_ID, {
            event: "attached",
            chat_id: DEFAULT_CHAT_ID,
        });
    }
    _dispatch(chatId, ev) {
        const handlers = this.chatHandlers.get(chatId);
        if (handlers) {
            for (const h of handlers) {
                try {
                    h(ev);
                }
                catch {
                    /* isolated */
                }
            }
        }
    }
    setStatus(status) {
        if (this.status_ === status)
            return;
        const wasOpen = this.status_ === "open";
        this.status_ = status;
        for (const h of this.statusHandlers)
            h(status);
        if (status === "open" && !wasOpen) {
            this._emitSessionHandshake();
        }
    }
}
/** Bootstrap entry: pluggable transport, same learnbuddyClient API for UI. */
export function createLearnbuddyClient(options) {
    const transport = options.transport
        ?? createAgentTransport({
            mode: options.transportMode ?? "auto",
            token: options.token,
            wsPath: options.wsPath,
        });
    return new learnbuddyClient(transport);
}
//# sourceMappingURL=learnbuddy-client.js.map