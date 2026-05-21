/**
 * Verify executor → viewer ui_event fan-out.
 */
import { WebSocket } from "ws";

const HTTP = "http://127.0.0.1:18765";
const WS_URL = "ws://127.0.0.1:18765/ws";
const SECRET = process.env.RELAY_SECRET || "dev-secret";
const SESSION = "desktop:relay-test";

async function main() {
  let pairingCode = "";
  const exec = new WebSocket(WS_URL);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("exec register timeout")), 8000);
    exec.onopen = () => {
      exec.send(
        JSON.stringify({
          type: "register",
          role: "executor",
          deviceId: "test-exec-ui",
          token: SECRET,
        }),
      );
    };
    exec.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.type === "registered") {
        pairingCode = msg.pairingCode;
        exec.send(JSON.stringify({ type: "subscribe", sessionKey: SESSION }));
        clearTimeout(t);
        resolve();
      }
    };
    exec.onerror = reject;
  });

  const viewerToken = `viewer-ui-${Date.now()}`;
  const pairRes = await fetch(`${HTTP}/api/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairingCode, token: viewerToken }),
  });
  const pair = await pairRes.json();
  if (!pair.ok) throw new Error(`pair failed ${JSON.stringify(pair)}`);

  let uiEvent = null;
  const viewer = new WebSocket(WS_URL);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("viewer timeout")), 8000);
    viewer.onopen = () => {
      viewer.send(
        JSON.stringify({
          type: "register",
          role: "viewer",
          deviceId: "test-viewer",
          token: viewerToken,
        }),
      );
    };
    viewer.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.type === "registered") {
        viewer.send(JSON.stringify({ type: "subscribe", sessionKey: SESSION }));
        clearTimeout(t);
        resolve();
      }
      if (msg.type === "ui_event") {
        uiEvent = msg.event;
      }
    };
    viewer.onerror = reject;
  });

  exec.send(
    JSON.stringify({
      type: "ui_event",
      sessionKey: SESSION,
      chatId: "relay-test",
      event: { event: "delta", chat_id: "relay-test", text: "hello from executor" },
    }),
  );

  await new Promise((r) => setTimeout(r, 500));
  viewer.close();
  exec.close();

  if (!uiEvent || uiEvent.event !== "delta") {
    throw new Error(`ui_event not received: ${JSON.stringify(uiEvent)}`);
  }
  console.log("[test] PASS ui_event fan-out", uiEvent);
}

main().catch((e) => {
  console.error("[test] FAIL", e.message);
  process.exit(1);
});
