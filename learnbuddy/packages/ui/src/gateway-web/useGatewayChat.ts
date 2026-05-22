import { useCallback, useRef, useState } from "react";
import {
  connectGatewayWeb,
  pairGatewayWeb,
  gatewayWsUrlFromHttp,
  resolveGatewayHttpBase,
  sendGatewayMessage,
  type GatewayWebConfig,
} from "@/lib/gateway-api";
import type { InboundEvent } from "@learnbuddy/shared";

export type GatewayChatMessage = {
  id: string;
  role: "user" | "assistant" | "status";
  text: string;
  streaming?: boolean;
};

const LS_HTTP = "gateway-web.httpBase";
const LS_TOKEN = "gateway-web.webToken";
const LS_SESSION = "gateway-web.sessionKey";

export function loadGatewayWebPrefs(): {
  httpBase: string;
  webToken: string;
  sessionKey: string;
} {
  return {
    httpBase: resolveGatewayHttpBase(localStorage.getItem(LS_HTTP) ?? undefined),
    webToken:
      localStorage.getItem(LS_TOKEN)?.trim()
      || `web-${crypto.randomUUID().slice(0, 8)}`,
    sessionKey: localStorage.getItem(LS_SESSION)?.trim() || "desktop:main",
  };
}

export function saveGatewayWebPrefs(prefs: {
  httpBase: string;
  webToken: string;
  sessionKey: string;
}): void {
  localStorage.setItem(LS_HTTP, prefs.httpBase);
  localStorage.setItem(LS_TOKEN, prefs.webToken);
  localStorage.setItem(LS_SESSION, prefs.sessionKey);
}

function findStreamingAssistantIndex(messages: GatewayChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role === "user") break;
    if (m.role === "assistant" && m.streaming) return i;
  }
  return -1;
}

export function applyGatewayInbound(
  messages: GatewayChatMessage[],
  ev: InboundEvent,
): GatewayChatMessage[] {
  switch (ev.event) {
    case "user_inbound": {
      const text = ev.text?.trim() ?? "";
      if (!text) return messages;
      const last = messages[messages.length - 1];
      if (last?.role === "user" && last.text === text) return messages;
      return [
        ...messages,
        { id: crypto.randomUUID(), role: "user", text },
      ];
    }
    case "delta": {
      const chunk = ev.text ?? "";
      if (!chunk) return messages;
      const idx = findStreamingAssistantIndex(messages);
      if (idx >= 0) {
        const row = messages[idx];
        const next = [...messages];
        next[idx] = {
          ...row,
          text: row.text + chunk,
          streaming: true,
        };
        return next;
      }
      return [
        ...messages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: chunk,
          streaming: true,
        },
      ];
    }
    case "message": {
      const text = ev.text ?? "";
      if (!text) return messages;
      if (ev.kind === "progress" || ev.kind === "tool_hint") {
        return [
          ...messages,
          { id: crypto.randomUUID(), role: "status", text },
        ];
      }
      const idx = findStreamingAssistantIndex(messages);
      if (idx >= 0) {
        const next = [...messages];
        next[idx] = {
          ...next[idx],
          text,
          streaming: false,
        };
        return next;
      }
      return [
        ...messages,
        { id: crypto.randomUUID(), role: "assistant", text, streaming: false },
      ];
    }
    case "stream_end":
    case "turn_end": {
      const idx = findStreamingAssistantIndex(messages);
      if (idx < 0) return messages;
      const next = [...messages];
      next[idx] = { ...next[idx], streaming: false };
      return next;
    }
    case "reasoning_delta": {
      const chunk = ev.text ?? "";
      if (!chunk) return messages;
      return [
        ...messages,
        {
          id: crypto.randomUUID(),
          role: "status",
          text: `[推理] ${chunk}`,
        },
      ];
    }
    default:
      return messages;
  }
}

export function useGatewayChat() {
  const disconnectRef = useRef<(() => void) | null>(null);
  const [messages, setMessages] = useState<GatewayChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<GatewayWebConfig | null>(null);
  const [sessionKey, setSessionKey] = useState("");

  const disconnect = useCallback(() => {
    disconnectRef.current?.();
    disconnectRef.current = null;
    setConnected(false);
    setConfig(null);
  }, []);

  const connect = useCallback(
    async (opts: {
      httpBase: string;
      pairingCode: string;
      webToken: string;
      sessionKey: string;
    }) => {
      setError(null);
      setConnecting(true);
      disconnect();
      try {
        const httpBase = resolveGatewayHttpBase(opts.httpBase).replace(/\/$/, "");
        const pair = await pairGatewayWeb(
          httpBase,
          opts.pairingCode.trim().toUpperCase(),
          opts.webToken.trim(),
        );
        if (!pair.ok) {
          throw new Error(pair.error || "pair_failed");
        }
        const cfg: GatewayWebConfig = {
          httpBase,
          wsUrl: gatewayWsUrlFromHttp(httpBase),
          webToken: opts.webToken.trim(),
          deviceId: `web-${crypto.randomUUID().slice(0, 8)}`,
        };
        const sk = opts.sessionKey.trim();
        saveGatewayWebPrefs({
          httpBase,
          webToken: cfg.webToken,
          sessionKey: sk,
        });
        const stop = connectGatewayWeb(cfg, sk, {
          onOpen: () => {
            setConnected(true);
            setConnecting(false);
            setError(null);
          },
          onSessionFocus: (key) => {
            setSessionKey(key);
            setMessages([]);
            saveGatewayWebPrefs({
              httpBase,
              webToken: cfg.webToken,
              sessionKey: key,
            });
          },
          onEvent: (ev) => {
            setMessages((prev) => applyGatewayInbound(prev, ev));
          },
          onError: (msg) => {
            setError(msg);
            setConnecting(false);
          },
          onClose: () => {
            setConnected(false);
          },
        });
        disconnectRef.current = stop;
        setConfig(cfg);
        setSessionKey(sk);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setConnecting(false);
        setConnected(false);
      }
    },
    [disconnect],
  );

  const send = useCallback(
    async (content: string) => {
      if (!config || !sessionKey || !content.trim()) return;
      setSending(true);
      setError(null);
      const text = content.trim();
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", text },
      ]);
      try {
        const res = await sendGatewayMessage(
          config.httpBase,
          sessionKey,
          config.webToken,
          text,
        );
        if (!res.ok) {
          throw new Error(res.error || "send_failed");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      } finally {
        setSending(false);
      }
    },
    [config, sessionKey],
  );

  return {
    messages,
    connected,
    connecting,
    sending,
    error,
    sessionKey,
    connect,
    disconnect,
    send,
    clearMessages: () => setMessages([]),
  };
}
