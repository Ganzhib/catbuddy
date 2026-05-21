function isInboundEvent(value) {
    return (!!value
        && typeof value === "object"
        && "event" in value
        && typeof value.event === "string");
}
/**
 * WebSocket transport for a future browser build (gateway / webui protocol).
 * Wire format: JSON InboundEvent inbound, Outbound outbound.
 */
export class WsTransport {
    token;
    baseUrl;
    kind = "websocket";
    socket = null;
    url = "";
    reconnectTimer = null;
    constructor(token, wsPath, baseUrl = "") {
        this.token = token;
        this.baseUrl = baseUrl;
        this.url = joinWsUrl(baseUrl, wsPath, token);
    }
    attach(callbacks) {
        callbacks.onStatus("connecting");
        this.openSocket(callbacks);
        return () => this.teardown();
    }
    sendMessage(chatId, content, mediaUrls) {
        const outbound = {
            type: "message",
            chat_id: chatId,
            content,
            webui: true,
            ...(mediaUrls?.length
                ? {
                    media: mediaUrls.map((data_url) => ({ data_url })),
                }
                : {}),
        };
        this.sendJson(outbound);
    }
    updateUrl(url) {
        this.url = url;
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.teardown();
        }
    }
    openSocket(callbacks) {
        this.teardown(false);
        try {
            this.socket = new WebSocket(this.url);
        }
        catch {
            callbacks.onStatus("error");
            return;
        }
        this.socket.onopen = () => {
            callbacks.onStatus("open");
        };
        this.socket.onmessage = (msg) => {
            try {
                const parsed = JSON.parse(String(msg.data));
                if (!isInboundEvent(parsed))
                    return;
                callbacks.onEvent(parsed);
                if (parsed.event === "session_updated") {
                    callbacks.onSessionUpdate?.(parsed.chat_id, parsed.scope);
                }
            }
            catch {
                /* ignore malformed frames */
            }
        };
        this.socket.onerror = () => {
            callbacks.onStatus("error");
        };
        this.socket.onclose = () => {
            callbacks.onStatus("closed");
            this.scheduleReconnect(callbacks);
        };
    }
    scheduleReconnect(callbacks) {
        if (this.reconnectTimer)
            return;
        callbacks.onStatus("reconnecting");
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.openSocket(callbacks);
        }, 2000);
    }
    sendJson(payload) {
        if (this.socket?.readyState !== WebSocket.OPEN)
            return;
        this.socket.send(JSON.stringify(payload));
    }
    teardown(clearReconnect = true) {
        if (clearReconnect && this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.socket) {
            this.socket.onopen = null;
            this.socket.onmessage = null;
            this.socket.onerror = null;
            this.socket.onclose = null;
            this.socket.close();
            this.socket = null;
        }
    }
}
function joinWsUrl(baseUrl, wsPath, token) {
    const path = wsPath.startsWith("/") ? wsPath : `/${wsPath}`;
    const q = token ? `?token=${encodeURIComponent(token)}` : "";
    if (baseUrl) {
        const httpBase = baseUrl.replace(/\/$/, "");
        const wsBase = httpBase.replace(/^http/, "ws");
        return `${wsBase}${path}${q}`;
    }
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}${path}${q}`;
}
//# sourceMappingURL=ws-transport.js.map