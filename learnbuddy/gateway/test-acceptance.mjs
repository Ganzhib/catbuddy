/**
 * §6 Web protocol acceptance — gateway ui_event fan-out (no Electron).
 * Run: pnpm gateway:dev  then  node gateway/test-acceptance.mjs
 */
import { WebSocket } from "ws";

const HTTP = process.env.GATEWAY_HTTP || "http://127.0.0.1:18765";
const WS_URL = process.env.GATEWAY_WS || "ws://127.0.0.1:18765/ws";
const SECRET = process.env.GATEWAY_SECRET || "dev-secret";
const SESSION = "desktop:acceptance-test";
const CHAT_ID = "acceptance-test";

/** @type {Record<string, { required: boolean, label: string }>} */
const CHECKLIST = {
  delta: { required: true, label: "stream delta" },
  stream_end: { required: true, label: "stream end" },
  message: { required: true, label: "message (assistant)" },
  "message:tool_hint": { required: true, label: "tool_hint" },
  turn_end: { required: true, label: "turn complete" },
  file_edit: { required: false, label: "file_edit" },
  reasoning_delta: { required: false, label: "reasoning_delta" },
  session_updated: { required: false, label: "session_updated" },
};

async function httpJson(path, opts = {}) {
  const res = await fetch(`${HTTP}${path}`, opts);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function eventKey(ev) {
  if (ev.event === "message" && ev.kind === "tool_hint") return "message:tool_hint";
  return ev.event;
}

async function connectDesktop() {
  const ws = new WebSocket(WS_URL);
  let pairingCode = "";
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("desktop timeout")), 8000);
    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          type: "register",
          role: "desktop",
          deviceId: "acceptance-desktop",
          token: SECRET,
        }),
      );
    });
    ws.on("message", (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.type === "registered") {
        pairingCode = msg.pairingCode || "";
        ws.send(JSON.stringify({ type: "subscribe", sessionKey: SESSION }));
        clearTimeout(t);
        resolve();
      }
    });
    ws.on("error", reject);
  });
  if (!pairingCode) throw new Error("no pairing code");
  return { ws, pairingCode };
}

async function connectWeb(webToken) {
  const seen = new Set();
  const events = [];
  const ws = new WebSocket(WS_URL);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("web timeout")), 8000);
    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          type: "register",
          role: "web",
          deviceId: "acceptance-web",
          token: webToken,
        }),
      );
    });
    ws.on("message", (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.type === "registered") {
        ws.send(JSON.stringify({ type: "subscribe", sessionKey: SESSION }));
        clearTimeout(t);
        resolve();
      }
      if (msg.type === "ui_event" && msg.event) {
        const key = eventKey(msg.event);
        if (!seen.has(key)) {
          seen.add(key);
          events.push(msg.event);
        }
      }
    });
    ws.on("error", reject);
  });
  return { ws, seen, events };
}

function publishSequence(execWs) {
  const seq = [
    { event: "delta", chat_id: CHAT_ID, text: "Hello ", stream_id: "s1" },
    { event: "delta", chat_id: CHAT_ID, text: "world", stream_id: "s1" },
    { event: "stream_end", chat_id: CHAT_ID, stream_id: "s1" },
    {
      event: "message",
      chat_id: CHAT_ID,
      text: "tool running",
      kind: "tool_hint",
    },
    { event: "message", chat_id: CHAT_ID, text: "Final reply.", kind: "progress" },
    { event: "turn_end", chat_id: CHAT_ID, latency_ms: 120, tools_used: ["list_dir"] },
    {
      event: "file_edit",
      chat_id: CHAT_ID,
      edits: [{ call_id: "c1", tool: "write_file", path: "a.txt", added: 1, deleted: 0, status: "done" }],
    },
    { event: "reasoning_delta", chat_id: CHAT_ID, text: "think", stream_id: "r1" },
    { event: "reasoning_end", chat_id: CHAT_ID, stream_id: "r1" },
    { event: "session_updated", chat_id: CHAT_ID, scope: "metadata" },
  ];
  for (const event of seq) {
    execWs.send(
      JSON.stringify({
        type: "ui_event",
        sessionKey: SESSION,
        chatId: CHAT_ID,
        event,
      }),
    );
  }
}

async function main() {
  console.log("[acceptance] 1. health + bootstrap shim");
  const health = await httpJson("/health");
  if (!health.body.ok || !health.body.gateway_shim) {
    throw new Error(`health failed: ${JSON.stringify(health.body)}`);
  }

  const boot = await httpJson("/webui/bootstrap");
  if (!boot.body.token || boot.body.gateway_mode !== "gateway") {
    throw new Error(`bootstrap failed: ${JSON.stringify(boot.body)}`);
  }
  const webToken = boot.body.token;
  console.log("[acceptance] bootstrap ok", { token: webToken.slice(0, 12) + "…", ws_path: boot.body.ws_path });

  console.log("[acceptance] 2. desktop + web WS");
  const { ws: execWs, pairingCode } = await connectDesktop();
  const { ws: webWs, seen } = await connectWeb(webToken);

  console.log("[acceptance] 3. publish ui_event sequence");
  publishSequence(execWs);
  await new Promise((r) => setTimeout(r, 800));

  console.log("[acceptance] 4. HTTP send (inbound to desktop)");
  const send = await httpJson(`/api/sessions/${encodeURIComponent(SESSION)}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${webToken}`,
    },
    body: JSON.stringify({ content: "acceptance ping via HTTP" }),
  });
  if (!send.body.ok) throw new Error(`HTTP send failed: ${JSON.stringify(send.body)}`);

  webWs.close();
  execWs.close();

  console.log("\n[acceptance] §6 checklist:");
  let failed = false;
  for (const [key, meta] of Object.entries(CHECKLIST)) {
    const ok = seen.has(key);
    const mark = ok ? "✓" : meta.required ? "✗" : "○";
    console.log(`  ${mark} ${meta.label} (${key})`);
    if (meta.required && !ok) failed = true;
  }
  if (failed) {
    console.error("\n[acceptance] FAIL — missing required events. seen:", [...seen]);
    process.exit(1);
  }
  console.log("\n[acceptance] PASS — gateway protocol acceptance");
  console.log("[acceptance] pairingCode (for manual desktop test):", pairingCode);
}

main().catch((err) => {
  console.error("[acceptance] FAIL", err.message || err);
  process.exit(1);
});
