/**
 * Minimal cross-device relay: Web POST → desktop executor WS → ui_event fan-out.
 */
import http from "node:http";
import { randomBytes } from "node:crypto";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.RELAY_PORT || 18765);
const SECRET = process.env.RELAY_SECRET || "dev-secret";

/** @type {Map<string, { ws: import('ws').WebSocket, role: string, deviceId: string, sessions: Set<string> }>} */
const clients = new Map();

/** pairingCode -> executor deviceId */
const pairingByCode = new Map();

/** viewer token (from POST /api/pair) -> allowed */
const viewerTokens = new Set();

/** sessionKey -> executor deviceId */
const sessionExecutor = new Map();

/** sessionKey -> Set<viewer ws> */
const sessionViewers = new Map();

function corsHeaders(req) {
  const origin = req.headers.origin;
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }
  return headers;
}

function json(res, status, body, req) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    ...corsHeaders(req),
  });
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function authToken(req) {
  const h = req.headers.authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1]?.trim() || "";
}

function getExecutor(deviceId) {
  for (const [, c] of clients) {
    if (c.role === "executor" && c.deviceId === deviceId) return c;
  }
  return null;
}

function broadcastUiEvent(sessionKey, chatId, event) {
  const payload = JSON.stringify({
    type: "ui_event",
    sessionKey,
    chatId,
    event,
  });
  const viewers = sessionViewers.get(sessionKey);
  if (viewers) {
    for (const ws of viewers) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }
}

function pickExecutorForSession(sessionKey) {
  let deviceId = sessionExecutor.get(sessionKey);
  if (deviceId) return deviceId;
  const online = [...clients.values()].filter(
    (c) => c.role === "executor" && c.ws.readyState === 1,
  );
  if (online.length === 1) {
    deviceId = online[0].deviceId;
    sessionExecutor.set(sessionKey, deviceId);
    return deviceId;
  }
  return null;
}

function forwardInboundToExecutor(sessionKey, chatId, content, media, source) {
  const deviceId = pickExecutorForSession(sessionKey);
  if (!deviceId) {
    return { ok: false, error: "no_executor_for_session" };
  }
  const exec = getExecutor(deviceId);
  if (!exec || exec.ws.readyState !== 1) {
    return { ok: false, error: "executor_offline" };
  }
  exec.ws.send(
    JSON.stringify({
      type: "inbound_message",
      sessionKey,
      chatId,
      content,
      media: media ?? [],
      source,
    }),
  );
  return { ok: true, queued: true };
}

function chatIdFromSessionKey(sessionKey) {
  const idx = sessionKey.indexOf(":");
  return idx === -1 ? sessionKey : sessionKey.slice(idx + 1);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    const executors = [...clients.values()].filter((c) => c.role === "executor");
    return json(res, 200, {
      ok: true,
      executors: executors.length,
      online: executors.some((c) => c.ws.readyState === 1),
    }, req);
  }

  if (req.method === "POST" && url.pathname === "/api/pair") {
    try {
      const body = await parseBody(req);
      const code = String(body.pairingCode || "").trim().toUpperCase();
      const token = String(body.token || "").trim();
      if (!code || !token) return json(res, 400, { ok: false, error: "missing_fields" }, req);
      const deviceId = pairingByCode.get(code);
      if (!deviceId) return json(res, 404, { ok: false, error: "invalid_pairing_code" }, req);
      viewerTokens.add(token);
      return json(res, 200, { ok: true, deviceId }, req);
    } catch {
      return json(res, 400, { ok: false, error: "bad_json" }, req);
    }
  }

  const msgMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/messages$/);
  if (req.method === "POST" && msgMatch) {
    const token = authToken(req);
    if (!token || !viewerTokens.has(token)) {
      return json(res, 401, { ok: false, error: "unauthorized" }, req);
    }
    const sessionKey = decodeURIComponent(msgMatch[1]);
    try {
      const body = await parseBody(req);
      const content = String(body.content || "");
      if (!content.trim()) return json(res, 400, { ok: false, error: "empty_content" }, req);
      const chatId = chatIdFromSessionKey(sessionKey);
      const result = forwardInboundToExecutor(
        sessionKey,
        chatId,
        content,
        body.media,
        "web",
      );
      return json(res, result.ok ? 200 : 503, result, req);
    } catch {
      return json(res, 400, { ok: false, error: "bad_json" }, req);
    }
  }

  json(res, 404, { ok: false, error: "not_found" }, req);
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  let clientToken = "";

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "invalid_json" }));
      return;
    }

    if (msg.type === "ping") {
      ws.send(JSON.stringify({ type: "pong" }));
      return;
    }

    if (msg.type === "register") {
      const token = String(msg.token || "");
      const role = msg.role === "executor" ? "executor" : "viewer";
      const deviceId = String(msg.deviceId || randomBytes(8).toString("hex"));
      if (role === "executor") {
        if (token !== SECRET) {
          ws.send(JSON.stringify({ type: "error", message: "unauthorized" }));
          ws.close();
          return;
        }
        clientToken = `executor:${deviceId}`;
      } else {
        if (!viewerTokens.has(token)) {
          ws.send(JSON.stringify({ type: "error", message: "unauthorized" }));
          ws.close();
          return;
        }
        clientToken = `viewer:${token}:${deviceId}`;
      }
      let pairingCode;
      if (role === "executor") {
        pairingCode = randomBytes(3).toString("hex").toUpperCase();
        pairingByCode.set(pairingCode, deviceId);
      }
      clients.set(clientToken, { ws, role, deviceId, sessions: new Set() });
      ws.send(
        JSON.stringify({
          type: "registered",
          deviceId,
          role,
          ...(pairingCode ? { pairingCode } : {}),
        }),
      );
      console.log(`[relay] register ${role} deviceId=${deviceId} pairing=${pairingCode ?? "-"}`);
      return;
    }

    if (!clientToken) {
      ws.send(JSON.stringify({ type: "error", message: "not_registered" }));
      return;
    }

    const client = clients.get(clientToken);

    if (msg.type === "subscribe") {
      const sessionKey = String(msg.sessionKey || "");
      if (!sessionKey) return;
      client?.sessions.add(sessionKey);
      if (client?.role === "viewer") {
        let set = sessionViewers.get(sessionKey);
        if (!set) {
          set = new Set();
          sessionViewers.set(sessionKey, set);
        }
        set.add(ws);
      }
      if (client?.role === "executor") {
        sessionExecutor.set(sessionKey, client.deviceId);
      }
      return;
    }

    if (msg.type === "unsubscribe") {
      const sessionKey = String(msg.sessionKey || "");
      client?.sessions.delete(sessionKey);
      const viewers = sessionViewers.get(sessionKey);
      viewers?.delete(ws);
      return;
    }

    // Executor may publish ui_event to viewers
    if (msg.type === "ui_event" && client?.role === "executor") {
      const sessionKey = String(msg.sessionKey || "");
      const chatId = String(msg.chatId || chatIdFromSessionKey(sessionKey));
      broadcastUiEvent(sessionKey, chatId, msg.event ?? {});
      return;
    }
  });

  ws.on("close", () => {
    if (!clientToken) return;
    const client = clients.get(clientToken);
    if (!client) return;
    if (client.role === "executor") {
      for (const [sk, did] of sessionExecutor) {
        if (did === client.deviceId) sessionExecutor.delete(sk);
      }
      for (const [code, did] of pairingByCode) {
        if (did === client.deviceId) pairingByCode.delete(code);
      }
    }
    for (const sk of client.sessions) {
      sessionViewers.get(sk)?.delete(ws);
    }
    clients.delete(clientToken);
    console.log(`[relay] disconnect ${client.role} ${client.deviceId}`);
  });
});

server.listen(PORT, () => {
  console.log(`[relay] listening http://127.0.0.1:${PORT} ws://127.0.0.1:${PORT}/ws`);
  console.log(`[relay] RELAY_SECRET=${SECRET ? "(set)" : "(default dev-secret)"}`);
});
