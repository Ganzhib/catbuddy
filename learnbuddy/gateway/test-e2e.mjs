/**
 * E2E smoke test: executor WS + viewer HTTP without Electron.
 */
import { WebSocket } from "ws";

const HTTP = process.env.GATEWAY_HTTP || process.env.RELAY_HTTP || "http://127.0.0.1:18765";
const WS_URL = process.env.GATEWAY_WS || process.env.RELAY_WS || "ws://127.0.0.1:18765/ws";
const SECRET = process.env.GATEWAY_SECRET || process.env.RELAY_SECRET || "dev-secret";
const SESSION = "desktop:relay-test";

async function httpJson(path, opts = {}) {
  const res = await fetch(`${HTTP}${path}`, opts);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  console.log("[test] 1. health");
  const health = await httpJson("/health");
  if (!health.body.ok) throw new Error(`health failed: ${JSON.stringify(health)}`);
  console.log("[test] health ok", health.body);

  let pairingCode = "";
  let inboundPromise;
  let inboundResolve;
  let inboundReject;

  console.log("[test] 2. executor connect");
  const ws = new WebSocket(WS_URL);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("executor register timeout")), 8000);
    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          type: "register",
          role: "executor",
          deviceId: "test-executor",
          token: SECRET,
        }),
      );
    });
    ws.on("message", (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.type === "registered") {
        pairingCode = msg.pairingCode || "";
        console.log("[test] executor registered pairing=", pairingCode);
        ws.send(JSON.stringify({ type: "subscribe", sessionKey: SESSION }));
        clearTimeout(t);
        resolve();
      }
      if (msg.type === "inbound_message") {
        console.log("[test] executor got inbound:", msg.content);
        inboundResolve?.(msg);
      }
    });
    ws.on("error", reject);
  });

  if (!pairingCode) throw new Error("no pairing code from server");

  const viewerToken = `test-viewer-${Date.now()}`;
  console.log("[test] 3. pair viewer");
  const pair = await httpJson("/api/pair", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairingCode, token: viewerToken }),
  });
  if (!pair.body.ok) throw new Error(`pair failed: ${JSON.stringify(pair)}`);

  console.log("[test] 3b. reject RELAY_SECRET as HTTP Bearer");
  const badBearer = await httpJson(`/api/sessions/${encodeURIComponent(SESSION)}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET}`,
    },
    body: JSON.stringify({ content: "should fail" }),
  });
  if (badBearer.status !== 401) {
    throw new Error(`expected 401 for executor secret as Bearer, got ${badBearer.status}`);
  }

  inboundPromise = new Promise((resolve, reject) => {
    inboundResolve = resolve;
    inboundReject = reject;
    setTimeout(() => reject(new Error("inbound_message timeout")), 5000);
  });

  console.log("[test] 4. send message via HTTP");
  const encoded = encodeURIComponent(SESSION);
  const send = await httpJson(`/api/sessions/${encoded}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${viewerToken}`,
    },
    body: JSON.stringify({ content: "relay e2e ping from web" }),
  });
  if (!send.body.ok) throw new Error(`send failed: ${JSON.stringify(send)}`);

  await inboundPromise;
  ws.close();

  console.log("[test] PASS — gateway path works");
}

main().catch((err) => {
  console.error("[test] FAIL", err.message || err);
  process.exit(1);
});
