/**
 * E2E smoke test: desktop WS + web HTTP without Electron.
 * Requires gateway on :18765. Restart gateway after changing root `.env`.
 */
const HTTP = process.env.GATEWAY_HTTP || "http://127.0.0.1:18765";
const WS_URL = process.env.GATEWAY_WS || "ws://127.0.0.1:18765/ws";
const SECRET = process.env.GATEWAY_SECRET || "dev-secret";
const SESSION = "desktop:gateway-test";

function authHint(health) {
  return (
    "当前 Gateway 进程: "
    + `web_login_required=${health.web_login_required} `
    + `(require_email=${health.auth_require_email}, dev_bypass=${health.auth_dev_bypass}). `
    + "请确认根目录 `.env` 后 **重启** `pnpm gateway:dev`（仅改文件不会生效）。"
    + "E2E 需要 web_login_required=false。"
  );
}

async function main() {
  const { default: WebSocket } = await import("ws");

  console.log("[test] 1. health");
  const health = await fetch(`${HTTP}/health`).then((r) => r.json());
  if (!health.ok) throw new Error("health not ok");
  console.log("[test] health", health);

  if (health.web_login_required === true) {
    throw new Error(authHint(health));
  }

  console.log("[test] 1b. bootstrap (dev token)");
  const bootRes = await fetch(
    `${HTTP}/webui/bootstrap?secret=${encodeURIComponent(SECRET)}`,
  );
  const bootBody = await bootRes.json().catch(() => ({}));
  if (!bootRes.ok) {
    if (bootBody.requires_auth) {
      throw new Error(
        `${authHint(health)} bootstrap 仍返回 requires_auth — 几乎一定是未重启 Gateway。`,
      );
    }
    throw new Error(`bootstrap failed (${bootRes.status}): ${JSON.stringify(bootBody)}`);
  }
  const webToken = String(bootBody.token || "");
  if (!webToken) throw new Error("bootstrap missing token");

  const testEmail = "e2e@test.local";
  console.log("[test] 2. desktop connect (accountEmail)");
  const desktopWs = new WebSocket(WS_URL);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("desktop register timeout")), 8000);
    desktopWs.onopen = () => {
      desktopWs.send(
        JSON.stringify({
          type: "register",
          role: "desktop",
          deviceId: "test-desktop",
          token: SECRET,
          accountEmail: testEmail,
        }),
      );
    };
    desktopWs.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.type === "registered") {
        clearTimeout(t);
        console.log("[test] desktop registered");
        resolve();
      }
    };
    desktopWs.onerror = reject;
  });

  desktopWs.on("message", (raw) => {
    const msg = JSON.parse(String(raw));
    if (msg.type === "inbound_message") {
      console.log("[test] desktop got inbound:", msg.content);
    }
  });

  const badBearer = await fetch(`${HTTP}/api/sessions/${encodeURIComponent(SESSION)}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer e2e-unregistered-token",
    },
    body: JSON.stringify({ content: "should fail" }),
  });
  if (badBearer.status !== 401) {
    throw new Error(`expected 401 for unregistered Bearer, got ${badBearer.status}`);
  }

  console.log("[test] 4. HTTP send");
  const sendRes = await fetch(`${HTTP}/api/sessions/${encodeURIComponent(SESSION)}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${webToken}`,
    },
    body: JSON.stringify({ content: "gateway e2e ping from web" }),
  });
  const sendBody = await sendRes.json();
  if (!sendBody.ok) throw new Error(`send failed: ${JSON.stringify(sendBody)}`);
  console.log("[test] send ok", sendBody);

  await new Promise((r) => setTimeout(r, 500));
  desktopWs.close();
  console.log("[test] done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
