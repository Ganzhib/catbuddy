/**
 * Verify desktop → web ui_event fan-out (dev / single-desktop mode).
 */
import { WebSocket } from "ws";

const HTTP = "http://127.0.0.1:18765";
const WS_URL = "ws://127.0.0.1:18765/ws";
const SECRET = process.env.GATEWAY_SECRET || "dev-secret";
const SESSION = "desktop:gateway-test";

async function main() {
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
        desktopWs.send(JSON.stringify({ type: "subscribe", sessionKey: SESSION }));
        clearTimeout(t);
        resolve();
      }
    };
    desktopWs.onerror = reject;
  });

  const webToken = `web-ui-${Date.now()}`;
  let uiEvent = null;
  const webWs = new WebSocket(WS_URL);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("web timeout")), 8000);
    webWs.onopen = () => {
      webWs.send(
        JSON.stringify({
          type: "register",
          role: "web",
          deviceId: "test-web-ui",
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
      if (msg.type === "ui_event") uiEvent = msg;
    };
    webWs.onerror = reject;
  });

  desktopWs.send(
    JSON.stringify({
      type: "ui_event",
      sessionKey: SESSION,
      chatId: "gateway-test",
      event: { event: "delta", chat_id: "gateway-test", text: "hi", stream_id: "1" },
    }),
  );

  await new Promise((r) => setTimeout(r, 300));
  if (!uiEvent) throw new Error("web did not receive ui_event");
  console.log("[test-ui-event] ok", uiEvent.event?.event);
  desktopWs.close();
  webWs.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
