/**
 * Verify desktop → web ui_event fan-out.
 */
import { WebSocket } from "ws";

const HTTP = "http://127.0.0.1:18765";
const WS_URL = "ws://127.0.0.1:18765/ws";
const SECRET = process.env.GATEWAY_SECRET || "dev-secret";
const SESSION = "desktop:gateway-test";

async function main() {
  let pairingCode = "";
  const desktopWs = new WebSocket(WS_URL);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("desktop register timeout")), 8000);
    desktopWs.onopen = () => {
      desktopWs.send(
        JSON.stringify({
          type: "register",
          role: "desktop",
          deviceId: "test-desktop-ui",
          token: SECRET,
        }),
      );
    };
    desktopWs.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.type === "registered") {
        pairingCode = msg.pairingCode;
        desktopWs.send(JSON.stringify({ type: "subscribe", sessionKey: SESSION }));
        clearTimeout(t);
        resolve();
      }
    };
    desktopWs.onerror = reject;
  });

  const webToken = `web-ui-${Date.now()}`;
  const pairRes = await fetch(`${HTTP}/api/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairingCode, token: webToken }),
  });
  const pair = await pairRes.json();
  if (!pair.ok) throw new Error(`pair failed ${JSON.stringify(pair)}`);

  let uiEvent = null;
  const webWs = new WebSocket(WS_URL);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("web timeout")), 8000);
    webWs.onopen = () => {
      webWs.send(
        JSON.stringify({
          type: "register",
          role: "web",
          deviceId: "test-web",
          token: webToken,
        }),
      );
    };
    webWs.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.type === "registered") {
        webWs.send(JSON.stringify({ type: "subscribe", sessionKey: SESSION }));
        clearTimeout(t);
        resolve();
      }
      if (msg.type === "ui_event") {
        uiEvent = msg.event;
      }
    };
    webWs.onerror = reject;
  });

  desktopWs.send(
    JSON.stringify({
      type: "ui_event",
      sessionKey: SESSION,
      chatId: "gateway-test",
      event: { event: "delta", chat_id: "gateway-test", text: "hello from desktop" },
    }),
  );

  await new Promise((r) => setTimeout(r, 500));
  webWs.close();
  desktopWs.close();

  if (!uiEvent || uiEvent.event !== "delta") {
    throw new Error(`ui_event not received: ${JSON.stringify(uiEvent)}`);
  }
  console.log("[test] PASS ui_event fan-out", uiEvent);
}

main().catch((e) => {
  console.error("[test] FAIL", e.message);
  process.exit(1);
});
