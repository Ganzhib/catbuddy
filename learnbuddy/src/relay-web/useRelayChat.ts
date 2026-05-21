import { useCallback, useRef, useState } from "react";
import {
  connectRelayViewer,
  pairRelayViewer,
  relayWsUrlFromHttp,
  resolveRelayHttpBase,
  sendRelayMessage,
  type RelayWebConfig,
} from "@/lib/relay-api";
import type { InboundEvent } from "@/lib/types";

export type RelayChatMessage = {
  id: string;
  role: "user" | "assistant" | "status";
  text: string;
  streaming?: boolean;
};

const LS_HTTP = "relay-web.httpBase";
const LS_TOKEN = "relay-web.viewerToken";
const LS_SESSION = "relay-web.sessionKey";

export function loadRelayWebPrefs(): {
  httpBase: string;
  viewerToken: string;
  sessionKey: string;
} {
  return {
    httpBase: resolveRelayHttpBase(localStorage.getItem(LS_HTTP) ?? undefined),
    viewerToken:
      localStorage.getItem(LS_TOKEN)?.trim()
      || `web-${crypto.randomUUID().slice(0, 8)}`,
    sessionKey: localStorage.getItem(LS_SESSION)?.trim() || "desktop:main",
  };
}

export function saveRelayWebPrefs(prefs: {
  httpBase: string;
  viewerToken: string;
  sessionKey: string;
}): void {
  localStorage.setItem(LS_HTTP, prefs.httpBase);
  localStorage.setItem(LS_TOKEN, prefs.viewerToken);
  localStorage.setItem(LS_SESSION, prefs.sessionKey);
}

function findStreamingAssistantIndex(messages: RelayChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role === "user") break;
    if (m.role === "assistant" && m.streaming) return i;
  }
  return -1;
}

export function applyRelayInbound(
  messages: RelayChatMessage[],
  ev: InboundEvent,
): RelayChatMessage[] {
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

export function useRelayChat() {
  const disconnectRef = useRef<(() => void) | null>(null);
  const [messages, setMessages] = useState<RelayChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<RelayWebConfig | null>(null);
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
      viewerToken: string;
      sessionKey: string;
    }) => {
      setError(null);
      setConnecting(true);
      disconnect();
      try {
        const httpBase = resolveRelayHttpBase(opts.httpBase).replace(/\/$/, "");
        const pair = await pairRelayViewer(
          httpBase,
          opts.pairingCode.trim().toUpperCase(),
          opts.viewerToken.trim(),
        );
        if (!pair.ok) {
          throw new Error(pair.error || "pair_failed");
        }
        const cfg: RelayWebConfig = {
          httpBase,
          wsUrl: relayWsUrlFromHttp(httpBase),
          viewerToken: opts.viewerToken.trim(),
          deviceId: `web-${crypto.randomUUID().slice(0, 8)}`,
        };
        const sk = opts.sessionKey.trim();
        saveRelayWebPrefs({
          httpBase,
          viewerToken: cfg.viewerToken,
          sessionKey: sk,
        });
        const stop = connectRelayViewer(cfg, sk, {
          onOpen: () => {
            setConnected(true);
            setConnecting(false);
            setError(null);
          },
          onEvent: (ev) => {
            setMessages((prev) => applyRelayInbound(prev, ev));
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
        const res = await sendRelayMessage(
          config.httpBase,
          sessionKey,
          config.viewerToken,
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
