import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { loadRelayWebPrefs, useRelayChat } from "./useRelayChat";
export function RelayChatApp() {
    const prefs = loadRelayWebPrefs();
    const [httpBase, setHttpBase] = useState(prefs.httpBase);
    const [pairingCode, setPairingCode] = useState("");
    const [viewerToken, setViewerToken] = useState(prefs.viewerToken);
    const [sessionKey, setSessionKey] = useState(prefs.sessionKey);
    const [draft, setDraft] = useState("");
    const bottomRef = useRef(null);
    const { messages, connected, connecting, sending, error, sessionKey: activeSession, connect, disconnect, send, clearMessages, } = useRelayChat();
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);
    const onConnect = () => {
        void connect({ httpBase, pairingCode, viewerToken, sessionKey });
    };
    const onSend = () => {
        if (!draft.trim() || sending)
            return;
        const text = draft;
        setDraft("");
        void send(text);
    };
    return (_jsxs("div", { className: "flex h-full flex-col bg-[#0f0f10] text-zinc-100", children: [_jsx("header", { className: "shrink-0 border-b border-zinc-800 px-4 py-3 sm:px-6", children: _jsxs("div", { className: "mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-lg font-semibold tracking-tight", children: "learnbuddy \u8FDC\u7A0B\u5BF9\u8BDD" }), _jsx("p", { className: "text-xs text-zinc-500", children: "\u901A\u8FC7\u4E2D\u7EE7\u63A7\u5236\u684C\u9762 Agent \u00B7 \u914D\u5BF9\u7801\u89C1\u684C\u9762\u300C\u8BBE\u7F6E \u2192 \u8FDC\u7A0B\u63A7\u5236\u300D" })] }), connected ? (_jsx("span", { className: "rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-400", children: "\u5DF2\u8FDE\u63A5" })) : (_jsx("span", { className: "rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400", children: "\u672A\u8FDE\u63A5" }))] }) }), !connected ? (_jsx("div", { className: "flex flex-1 items-start justify-center overflow-y-auto px-4 py-8", children: _jsxs("form", { className: "w-full max-w-md space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6", onSubmit: (e) => {
                        e.preventDefault();
                        onConnect();
                    }, children: [_jsxs("label", { className: "block space-y-1.5 text-sm", children: [_jsx("span", { className: "text-zinc-400", children: "\u4E2D\u7EE7\u5730\u5740" }), _jsx("input", { className: "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-blue-500", value: httpBase, onChange: (e) => setHttpBase(e.target.value), placeholder: "http://localhost:5173/relay-api\uFF08\u5F00\u53D1\u9ED8\u8BA4\uFF09" })] }), _jsxs("label", { className: "block space-y-1.5 text-sm", children: [_jsx("span", { className: "text-zinc-400", children: "\u914D\u5BF9\u7801\uFF086 \u4F4D\uFF0C\u684C\u9762\u8BBE\u7F6E\u91CC\u590D\u5236\uFF09" }), _jsx("input", { className: "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm uppercase tracking-widest outline-none focus:border-blue-500", value: pairingCode, onChange: (e) => setPairingCode(e.target.value.toUpperCase()), placeholder: "\u4F8B\u5982 A1B2C3", autoComplete: "off" })] }), _jsxs("label", { className: "block space-y-1.5 text-sm", children: [_jsx("span", { className: "text-zinc-400", children: "Viewer Token\uFF08\u81EA\u9009\uFF0C\u914D\u5BF9\u540E\u4F5C Bearer\uFF09" }), _jsx("input", { className: "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm outline-none focus:border-blue-500", value: viewerToken, onChange: (e) => setViewerToken(e.target.value) })] }), _jsxs("label", { className: "block space-y-1.5 text-sm", children: [_jsx("span", { className: "text-zinc-400", children: "Session Key\uFF08\u4E0E\u684C\u9762\u5F53\u524D\u5BF9\u8BDD\u4E00\u81F4\uFF09" }), _jsx("input", { className: "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs outline-none focus:border-blue-500", value: sessionKey, onChange: (e) => setSessionKey(e.target.value), placeholder: "desktop:1730_abc" }), _jsx("span", { className: "text-[11px] text-zinc-500", children: "\u5728\u684C\u9762\u6253\u5F00\u76EE\u6807\u5BF9\u8BDD\u540E\uFF0C\u5230\u8BBE\u7F6E \u2192 \u8FDC\u7A0B\u63A7\u5236 \u2192 \u5DF2\u8BA2\u9605\u4F1A\u8BDD \u4E2D\u590D\u5236\u3002" })] }), error ? (_jsx("p", { className: "rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400", children: error })) : null, _jsxs("button", { type: "submit", disabled: connecting || !pairingCode.trim(), className: "flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50", children: [connecting ? (_jsx(Loader2, { className: "h-4 w-4 animate-spin", "aria-hidden": true })) : null, "\u914D\u5BF9\u5E76\u8FDE\u63A5"] })] }) })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "shrink-0 border-b border-zinc-800/80 px-4 py-2 text-center text-[11px] text-zinc-500", children: [_jsx("code", { className: "text-zinc-400", children: activeSession }), _jsx("button", { type: "button", className: "ml-3 text-zinc-500 underline hover:text-zinc-300", onClick: () => {
                                    disconnect();
                                    clearMessages();
                                }, children: "\u65AD\u5F00" })] }), _jsx("div", { className: "flex-1 overflow-y-auto px-4 py-4", children: _jsxs("div", { className: "mx-auto flex max-w-3xl flex-col gap-3", children: [messages.length === 0 ? (_jsx("p", { className: "py-12 text-center text-sm text-zinc-500", children: "\u53D1\u9001\u6D88\u606F\u5C06\u7531\u684C\u9762 Agent \u5904\u7406\uFF0C\u56DE\u590D\u901A\u8FC7 ui_event \u63A8\u9001\u5230\u6B64\u9875\u3002" })) : null, messages.map((m) => (_jsxs("div", { className: m.role === "user"
                                        ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-blue-600 px-4 py-2.5 text-sm text-white"
                                        : m.role === "assistant"
                                            ? "mr-auto max-w-[90%] rounded-2xl rounded-bl-md border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm leading-relaxed text-zinc-100"
                                            : "mx-auto max-w-[95%] rounded-lg bg-zinc-900/80 px-3 py-1.5 text-center text-xs text-zinc-500", children: [m.text, m.streaming ? (_jsx("span", { className: "ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-zinc-500" })) : null] }, m.id))), _jsx("div", { ref: bottomRef })] }) }), error ? (_jsx("p", { className: "shrink-0 px-4 text-center text-xs text-red-400", children: error })) : null, _jsxs("div", { className: "shrink-0 border-t border-zinc-800 px-4 py-4", children: [_jsxs("div", { className: "mx-auto flex max-w-3xl gap-2", children: [_jsx("textarea", { className: "min-h-[44px] flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-blue-500", rows: 1, placeholder: "\u8F93\u5165\u6D88\u606F\uFF0C\u7531\u684C\u9762\u6267\u884C\u2026", value: draft, onChange: (e) => setDraft(e.target.value), onKeyDown: (e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                onSend();
                                            }
                                        } }), _jsx("button", { type: "button", onClick: onSend, disabled: sending || !draft.trim(), className: "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40", "aria-label": "\u53D1\u9001", children: sending ? (_jsx(Loader2, { className: "h-4 w-4 animate-spin" })) : (_jsx(Send, { className: "h-4 w-4" })) })] }), _jsx("p", { className: "mx-auto mt-2 max-w-3xl text-center text-[11px] text-zinc-600", children: "Enter \u53D1\u9001 \u00B7 Shift+Enter \u6362\u884C" })] })] })), connected ? null : (_jsx("footer", { className: "shrink-0 px-4 pb-6 text-center text-[11px] text-zinc-600", children: "\u5148\u542F\u52A8 relay-server \u4E0E\u684C\u9762\uFF08RELAY_ENABLED=true\uFF09\uFF0C\u518D\u6253\u5F00\u6B64\u9875\u3002" }))] }));
}
//# sourceMappingURL=RelayChatApp.js.map