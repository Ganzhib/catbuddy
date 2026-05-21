function httpBaseToWs(base) {
    const trimmed = base.replace(/\/$/, "");
    return trimmed.replace(/^http/, "ws") + "/ws";
}
/** True when the relay-web page is served by Vite dev (use same-origin proxy). */
export function shouldUseRelayDevProxy() {
    if (typeof window === "undefined")
        return false;
    const port = window.location.port;
    return import.meta.env.DEV && (port === "5173" || port === "4173");
}
/** Prefer Vite `/relay-api` proxy in dev to avoid CORS (localhost vs 127.0.0.1). */
export function resolveRelayHttpBase(stored) {
    const raw = stored?.trim();
    if (shouldUseRelayDevProxy()) {
        const direct = !raw
            || /^https?:\/\/(127\.0\.0\.1|localhost):18765\/?$/i.test(raw);
        if (direct)
            return `${window.location.origin}/relay-api`;
    }
    return raw || "http://127.0.0.1:18765";
}
export function relayWsUrlFromHttp(httpBase) {
    if (typeof window !== "undefined" && httpBase.includes("/relay-api")) {
        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        return `${proto}//${window.location.host}/relay-ws/ws`;
    }
    return httpBaseToWs(httpBase);
}
export function relayConfigFromEnv() {
    const base = import.meta.env.VITE_RELAY_HTTP_BASE;
    const token = import.meta.env.VITE_RELAY_VIEWER_TOKEN;
    if (!base?.trim() || !token?.trim())
        return null;
    const httpBase = base.replace(/\/$/, "");
    const wsUrl = import.meta.env.VITE_RELAY_WS_URL?.trim()
        || httpBaseToWs(httpBase);
    return {
        httpBase,
        wsUrl,
        viewerToken: token.trim(),
        deviceId: import.meta.env.VITE_RELAY_DEVICE_ID?.trim()
            || `web-${crypto.randomUUID().slice(0, 8)}`,
    };
}
export async function pairRelayViewer(httpBase, pairingCode, viewerToken) {
    const res = await fetch(`${httpBase.replace(/\/$/, "")}/api/pair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairingCode, token: viewerToken }),
    });
    return res.json();
}
export async function sendRelayMessage(httpBase, sessionKey, viewerToken, content, media) {
    const encoded = encodeURIComponent(sessionKey);
    const res = await fetch(`${httpBase.replace(/\/$/, "")}/api/sessions/${encoded}/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${viewerToken}`,
        },
        body: JSON.stringify({ content, media }),
    });
    return res.json();
}
/** Subscribe to ui_event stream for a session (Web UI). */
export function connectRelayViewer(config, sessionKey, callbacks) {
    const ws = new WebSocket(config.wsUrl);
    ws.onopen = () => {
        ws.send(JSON.stringify({
            type: "register",
            role: "viewer",
            deviceId: config.deviceId ?? "web-viewer",
            token: config.viewerToken,
        }));
    };
    ws.onmessage = (raw) => {
        let msg;
        try {
            msg = JSON.parse(String(raw.data));
        }
        catch {
            return;
        }
        if (msg.type === "registered") {
            ws.send(JSON.stringify({ type: "subscribe", sessionKey }));
            callbacks.onOpen?.();
            return;
        }
        if (msg.type === "error") {
            callbacks.onError?.(msg.message);
            return;
        }
        if (msg.type === "ui_event") {
            callbacks.onEvent(msg.event);
        }
    };
    ws.onclose = () => {
        callbacks.onClose?.();
    };
    ws.onerror = () => {
        callbacks.onError?.("websocket_error");
    };
    return () => {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
    };
}
//# sourceMappingURL=relay-api.js.map