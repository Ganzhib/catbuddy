/**
 * Minimal cross-device relay: Web POST → desktop executor WS → ui_event fan-out.
 */
import http from "node:http";
import { randomBytes } from "node:crypto";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.GATEWAY_PORT || process.env.RELAY_PORT || 18765);
const SECRET = process.env.GATEWAY_SECRET || process.env.RELAY_SECRET || "dev-secret";
const DEV_VIEWER_TOKEN =
  process.env.GATEWAY_DEV_VIEWER_TOKEN || process.env.RELAY_DEV_VIEWER_TOKEN || "dev-viewer";
const GATEWAY_WS_PATH =
  process.env.GATEWAY_WS_PATH || process.env.RELAY_GATEWAY_WS_PATH || "/gateway-ws/ws";

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

/** deviceId -> session rows from desktop */
const sessionCatalogByDevice = new Map();
/** @type {Map<string, { resolve: (v: unknown) => void, timer: ReturnType<typeof setTimeout>, deviceId?: string }>} */
const pendingSessions = new Map();
/** @type {Map<string, { resolve: (v: unknown) => void, timer: ReturnType<typeof setTimeout> }>} */
const pendingThreads = new Map();
/** @type {Map<string, Record<string, unknown>>} */
const threadCache = new Map();
const RPC_TIMEOUT_MS = 8000;

function pickOnlineExecutor() {
  const online = [...clients.values()].filter(
    (c) => c.role === "executor" && c.ws.readyState === 1,
  );
  return online[0] ?? null;
}

function fallbackSessionRows() {
  const now = new Date().toISOString();
  return collectSessionKeys().map((key) => ({
    key,
    channel: channelFromSessionKey(key),
    chatId: chatIdFromSessionKey(key),
    createdAt: now,
    updatedAt: now,
    title: "",
    preview: "",
  }));
}

function applySessionsSync(deviceId, sessions, notifyViewers = false) {
  sessionCatalogByDevice.set(deviceId, sessions);
  for (const row of sessions) {
    sessionExecutor.set(row.key, deviceId);
  }
  if (!notifyViewers) return;
  const payload = JSON.stringify({
    type: "ui_event",
    sessionKey: "desktop:",
    chatId: "metadata",
    event: { event: "session_updated", chat_id: "metadata", scope: "metadata" },
  });
  for (const c of clients.values()) {
    if (c.role === "viewer" && c.ws.readyState === 1) c.ws.send(payload);
  }
}

function fetchSessionsFromExecutor() {
  const exec = pickOnlineExecutor();
  if (!exec) return Promise.resolve(fallbackSessionRows());
  const cached = sessionCatalogByDevice.get(exec.deviceId);
  if (cached?.length) return Promise.resolve(cached);
  const requestId = randomBytes(4).toString("hex");
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingSessions.delete(requestId);
      const fallback = sessionCatalogByDevice.get(exec.deviceId);
      resolve(fallback?.length ? fallback : fallbackSessionRows());
    }, RPC_TIMEOUT_MS);
    pendingSessions.set(requestId, {
      resolve: (sessions) => {
        applySessionsSync(exec.deviceId, sessions, false);
        resolve(sessions?.length ? sessions : fallbackSessionRows());
      },
      timer,
      deviceId: exec.deviceId,
    });
    exec.ws.send(JSON.stringify({ type: "request_sessions", requestId }));
  });
}

function fetchThreadFromExecutor(sessionKey) {
  const cached = threadCache.get(sessionKey) ?? null;
  if (cached) return Promise.resolve(cached);
  const exec = pickOnlineExecutor();
  if (!exec) return Promise.resolve(null);
  const requestId = randomBytes(4).toString("hex");
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingThreads.delete(requestId);
      resolve(threadCache.get(sessionKey) ?? cached);
    }, RPC_TIMEOUT_MS);
    pendingThreads.set(requestId, {
      resolve: (payload) => {
        if (payload) threadCache.set(sessionKey, payload);
        resolve(payload ?? cached);
      },
      timer,
    });
    exec.ws.send(JSON.stringify({ type: "request_thread", requestId, sessionKey }));
  });
}

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

function ensureViewerSubscribedForToken(viewerToken, sessionKey) {
  if (!viewerToken || !sessionKey) return;
  const prefix = `viewer:${viewerToken}:`;
  for (const [clientKey, client] of clients) {
    if (client.role !== "viewer" || !clientKey.startsWith(prefix)) continue;
    client.sessions.add(sessionKey);
    let set = sessionViewers.get(sessionKey);
    if (!set) {
      set = new Set();
      sessionViewers.set(sessionKey, set);
    }
    set.add(client.ws);
  }
}

function broadcastUiEvent(sessionKey, chatId, event) {
  const payload = JSON.stringify({
    type: "ui_event",
    sessionKey,
    chatId,
    event,
  });
  const sent = new Set();
  const targeted = sessionViewers.get(sessionKey);
  if (targeted) {
    for (const ws of targeted) {
      if (ws.readyState === 1) {
        ws.send(payload);
        sent.add(ws);
      }
    }
  }
  for (const [, client] of clients) {
    if (client.role !== "viewer" || client.ws.readyState !== 1) continue;
    if (sent.has(client.ws)) continue;
    client.ws.send(payload);
    client.sessions.add(sessionKey);
    let set = sessionViewers.get(sessionKey);
    if (!set) {
      set = new Set();
      sessionViewers.set(sessionKey, set);
    }
    set.add(client.ws);
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

function forwardCreateSessionToExecutor(sessionKey, chatId) {
  const deviceId = pickExecutorForSession(sessionKey);
  if (!deviceId) {
    return { ok: false, error: "no_executor_for_session" };
  }
  const exec = getExecutor(deviceId);
  if (!exec || exec.ws.readyState !== 1) {
    return { ok: false, error: "executor_offline" };
  }
  exec.sessions.add(sessionKey);
  sessionExecutor.set(sessionKey, deviceId);
  exec.ws.send(JSON.stringify({ type: "create_session", sessionKey, chatId }));
  return { ok: true };
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

function channelFromSessionKey(sessionKey) {
  const idx = sessionKey.indexOf(":");
  return idx === -1 ? "desktop" : sessionKey.slice(0, idx);
}

function requireViewer(req, res) {
  const token = authToken(req);
  if (!token || !viewerTokens.has(token)) {
    json(res, 401, { ok: false, error: "unauthorized" }, req);
    return null;
  }
  return token;
}

function collectSessionKeys() {
  const keys = new Set(sessionExecutor.keys());
  for (const c of clients.values()) {
    if (c.role === "executor") {
      for (const sk of c.sessions) keys.add(sk);
    }
  }
  return [...keys];
}

const RELAY_SETTINGS_STUB = {
  agent: {
    model: "desktop",
    provider: "relay",
    resolved_provider: "relay",
    has_api_key: true,
  },
  providers: [],
  web_search: {
    provider: "none",
    providers: [],
  },
  runtime: {
    config_path: "(relay — desktop executor)",
  },
  requires_restart: false,
};

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
      gateway_shim: true,
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

  // --- learnbuddy gateway shim (apps/web dev via relay + desktop executor) ---

  if (req.method === "GET" && url.pathname === "/webui/bootstrap") {
    const secret = url.searchParams.get("secret")?.trim();
    const token = secret || DEV_VIEWER_TOKEN;
    viewerTokens.add(token);
    return json(
      res,
      200,
      {
        token,
        ws_path: GATEWAY_WS_PATH,
        expires_in: 86_400,
        model_name: null,
        gateway_mode: "gateway",
      },
      req,
    );
  }

  if (req.method === "GET" && url.pathname === "/api/sessions") {
    if (!requireViewer(req, res)) return;
    fetchSessionsFromExecutor().then((sessions) => json(res, 200, sessions, req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/sessions") {
    if (!requireViewer(req, res)) return;
    try {
      const body = await parseBody(req);
      const raw = String(body.chatId || "").trim();
      const bare = raw.startsWith("desktop:") ? raw.slice("desktop:".length) : raw;
      const chatId = bare || `${Date.now()}_${randomBytes(3).toString("hex")}`;
      const sessionKey = `desktop:${chatId}`;
      const result = forwardCreateSessionToExecutor(sessionKey, chatId);
      if (!result.ok) {
        return json(res, 503, { ok: false, error: result.error }, req);
      }
      const now = new Date().toISOString();
      return json(
        res,
        201,
        {
          key: sessionKey,
          channel: "desktop",
          chatId,
          createdAt: now,
          updatedAt: now,
          title: "",
          preview: "",
        },
        req,
      );
    } catch {
      return json(res, 400, { ok: false, error: "bad_json" }, req);
    }
  }

  if (req.method === "GET" && url.pathname === "/api/webui-thread") {
    if (!requireViewer(req, res)) return;
    const sessionKey = decodeURIComponent(url.searchParams.get("key") || "").trim();
    if (!sessionKey) return json(res, 200, null, req);
    fetchThreadFromExecutor(sessionKey).then((payload) =>
      json(res, 200, payload, req),
    );
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/sessions/")) {
    if (!requireViewer(req, res)) return;
    return json(res, 200, { ok: true }, req);
  }

  if (req.method === "GET" && url.pathname === "/api/settings") {
    if (!requireViewer(req, res)) return;
    return json(res, 200, RELAY_SETTINGS_STUB, req);
  }

  if (
    req.method === "POST"
    && (url.pathname === "/api/settings/update"
      || url.pathname === "/api/settings/provider/update"
      || url.pathname === "/api/settings/web-search/update")
  ) {
    if (!requireViewer(req, res)) return;
    return json(res, 200, RELAY_SETTINGS_STUB, req);
  }

  if (req.method === "GET" && url.pathname === "/api/commands") {
    if (!requireViewer(req, res)) return;
    return json(res, 200, [], req);
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
      ensureViewerSubscribedForToken(token, sessionKey);
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

    if (msg.type === "sessions_sync" && client?.role === "executor") {
      const sessions = Array.isArray(msg.sessions) ? msg.sessions : [];
      const requestId = msg.requestId ? String(msg.requestId) : "";
      applySessionsSync(client.deviceId, sessions, !requestId);
      const pending = requestId ? pendingSessions.get(requestId) : null;
      if (pending) {
        clearTimeout(pending.timer);
        pendingSessions.delete(requestId);
        pending.resolve(sessions);
      }
      return;
    }

    if (msg.type === "thread_response" && client?.role === "executor") {
      const requestId = String(msg.requestId || "");
      const pending = pendingThreads.get(requestId);
      if (pending) {
        clearTimeout(pending.timer);
        pendingThreads.delete(requestId);
        pending.resolve(msg.payload ?? null);
      }
      return;
    }

    if (msg.type === "thread_snapshot" && client?.role === "executor") {
      const sessionKey = String(msg.sessionKey || "");
      if (sessionKey && msg.payload) threadCache.set(sessionKey, msg.payload);
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
      sessionCatalogByDevice.delete(client.deviceId);
    }
    for (const sk of client.sessions) {
      sessionViewers.get(sk)?.delete(ws);
    }
    clients.delete(clientToken);
    console.log(`[relay] disconnect ${client.role} ${client.deviceId}`);
  });
});

server.listen(PORT, () => {
  console.log(`[gateway] listening http://127.0.0.1:${PORT} ws://127.0.0.1:${PORT}/ws`);
  console.log(`[gateway] shim: GET/POST /webui/bootstrap, /api/sessions, …`);
  console.log(`[gateway] GATEWAY_SECRET=${SECRET ? "(set)" : "(default dev-secret)"}`);
});
