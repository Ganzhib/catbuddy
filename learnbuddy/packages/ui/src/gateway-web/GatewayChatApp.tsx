import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { loadGatewayWebPrefs, useGatewayChat } from "./useGatewayChat";

export function GatewayChatApp() {
  const prefs = loadGatewayWebPrefs();
  const [httpBase, setHttpBase] = useState(prefs.httpBase);
  const [pairingCode, setPairingCode] = useState("");
  const [webToken, setWebToken] = useState(prefs.webToken);
  const [sessionKey, setSessionKey] = useState(prefs.sessionKey);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    connected,
    connecting,
    sending,
    error,
    sessionKey: activeSession,
    connect,
    disconnect,
    send,
    clearMessages,
  } = useGatewayChat();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onConnect = () => {
    void connect({ httpBase, pairingCode, webToken, sessionKey });
  };

  const onSend = () => {
    if (!draft.trim() || sending) return;
    const text = draft;
    setDraft("");
    void send(text);
  };

  return (
    <div className="flex h-full flex-col bg-[#0f0f10] text-zinc-100">
      <header className="shrink-0 border-b border-zinc-800 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">learnbuddy 远程对话</h1>
            <p className="text-xs text-zinc-500">
              通过中继控制桌面 Agent · 配对码见桌面「设置 → 远程控制」
            </p>
          </div>
          {connected ? (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-400">
              已连接
            </span>
          ) : (
            <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
              未连接
            </span>
          )}
        </div>
      </header>

      {!connected ? (
        <div className="flex flex-1 items-start justify-center overflow-y-auto px-4 py-8">
          <form
            className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              onConnect();
            }}
          >
            <label className="block space-y-1.5 text-sm">
              <span className="text-zinc-400">中继地址</span>
              <input
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={httpBase}
                onChange={(e) => setHttpBase(e.target.value)}
                placeholder="http://localhost:5173/gateway-api（开发默认）"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-zinc-400">配对码（6 位，桌面设置里复制）</span>
              <input
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm uppercase tracking-widest outline-none focus:border-blue-500"
                value={pairingCode}
                onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
                placeholder="例如 A1B2C3"
                autoComplete="off"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-zinc-400">Web Token（自选，配对后作 Bearer）</span>
              <input
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm outline-none focus:border-blue-500"
                value={webToken}
                onChange={(e) => setWebToken(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-zinc-400">Session Key（与桌面当前对话一致）</span>
              <input
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs outline-none focus:border-blue-500"
                value={sessionKey}
                onChange={(e) => setSessionKey(e.target.value)}
                placeholder="desktop:1730_abc"
              />
              <span className="text-[11px] text-zinc-500">
                在桌面打开目标对话后，到设置 → 远程控制 → 已订阅会话 中复制。
              </span>
            </label>
            {error ? (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={connecting || !pairingCode.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              配对并连接
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="shrink-0 border-b border-zinc-800/80 px-4 py-2 text-center text-[11px] text-zinc-500">
            <code className="text-zinc-400">{activeSession}</code>
            <button
              type="button"
              className="ml-3 text-zinc-500 underline hover:text-zinc-300"
              onClick={() => {
                disconnect();
                clearMessages();
              }}
            >
              断开
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="mx-auto flex max-w-3xl flex-col gap-3">
              {messages.length === 0 ? (
                <p className="py-12 text-center text-sm text-zinc-500">
                  发送消息将由桌面 Agent 处理，回复通过 ui_event 推送到此页。
                </p>
              ) : null}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.role === "user"
                      ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-blue-600 px-4 py-2.5 text-sm text-white"
                      : m.role === "assistant"
                        ? "mr-auto max-w-[90%] rounded-2xl rounded-bl-md border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm leading-relaxed text-zinc-100"
                        : "mx-auto max-w-[95%] rounded-lg bg-zinc-900/80 px-3 py-1.5 text-center text-xs text-zinc-500"
                  }
                >
                  {m.text}
                  {m.streaming ? (
                    <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-zinc-500" />
                  ) : null}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </div>

          {error ? (
            <p className="shrink-0 px-4 text-center text-xs text-red-400">{error}</p>
          ) : null}

          <div className="shrink-0 border-t border-zinc-800 px-4 py-4">
            <div className="mx-auto flex max-w-3xl gap-2">
              <textarea
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                rows={1}
                placeholder="输入消息，由桌面执行…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
              />
              <button
                type="button"
                onClick={onSend}
                disabled={sending || !draft.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40"
                aria-label="发送"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-zinc-600">
              Enter 发送 · Shift+Enter 换行
            </p>
          </div>
        </>
      )}

      {connected ? null : (
        <footer className="shrink-0 px-4 pb-6 text-center text-[11px] text-zinc-600">
          先启动 gateway-legacy-removed 与桌面（GATEWAY_ENABLED=true），再打开此页。
        </footer>
      )}
    </div>
  );
}
