import { randomBytes } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import type { AuthService } from './relay/auth/auth.service.js'
import type { GatewayStateService } from './relay/gateway-state.js'
import { gatewayEnv } from './relay/config/env.js'
import { HttpError } from './http-errors.js'

const SETTINGS_STUB = {
  agent: {
    model: 'desktop',
    provider: 'gateway',
    resolved_provider: 'gateway',
    has_api_key: true,
  },
  providers: [],
  web_search: { provider: 'none', providers: [] },
  runtime: { config_path: '(learnbuddy gateway — desktop executor)' },
  requires_restart: false,
}

function authHeader(req: { headers: { authorization?: string } }): string | undefined {
  return req.headers.authorization
}

export function registerHttpRoutes(
  app: FastifyInstance,
  state: GatewayStateService,
  auth: AuthService,
): void {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.status).send(err.body)
    }
    app.log.error(err)
    return reply.status(500).send({ ok: false, error: 'internal_error' })
  })

  app.get('/health', async () => {
    const ex = state.countExecutors()
    return {
      ok: true,
      gateway: true,
      gateway_shim: true,
      executors: ex.total,
      online: ex.online > 0,
      executor_online: ex.online > 0,
      storage: 'mysql',
    }
  })

  app.post<{ Body: { pairingCode?: string; token?: string } }>('/api/pair', async (req) => {
    const pairingCode = String(req.body?.pairingCode || '').trim()
    const token = String(req.body?.token || '').trim()
    if (!pairingCode || !token) return { ok: false, error: 'missing_fields' }
    return state.pairViewer(pairingCode, token)
  })

  app.post<{
    Params: { sessionKey: string }
    Body: { content?: string; media?: unknown[] }
  }>('/api/sessions/:sessionKey/messages', async (req, reply) => {
    const email = await auth.resolveViewerEmail(authHeader(req))
    const token = await auth.resolveViewerToken(authHeader(req))
    const sessionKey = decodeURIComponent(req.params.sessionKey)
    const content = String(req.body?.content || '')
    if (!content.trim()) return reply.status(400).send({ ok: false, error: 'empty_content' })
    state.ensureViewerSubscribedForToken(token, sessionKey)
    const chatId = state.chatIdFromSessionKey(sessionKey)
    const result = await state.handleWebInboundForViewer(
      email,
      sessionKey,
      chatId,
      content,
      req.body?.media,
      'web',
    )
    return reply.status(result.ok ? 200 : 503).send(result)
  })

  app.get<{ Querystring: { secret?: string } }>('/webui/bootstrap', async (req) => {
    const token = await auth.resolveBootstrapToken(authHeader(req), req.query.secret)
    const ex = state.countExecutors()
    return {
      token,
      ws_path: gatewayEnv.publicWsPath,
      expires_in: 86_400,
      model_name: null,
      gateway_mode: 'gateway' as const,
      executor_online: ex.online > 0,
    }
  })

  app.get('/api/sessions', async (req) => {
    const email = await auth.resolveViewerEmail(authHeader(req))
    return state.fetchSessionsForViewer(email)
  })

  app.post<{ Body: { chatId?: string } }>('/api/sessions', async (req, reply) => {
    const email = await auth.resolveViewerEmail(authHeader(req))
    const raw = String(req.body?.chatId || '').trim()
    const bare = raw.startsWith('desktop:') ? raw.slice('desktop:'.length) : raw
    const chatId = bare || `${Date.now()}_${randomBytes(3).toString('hex')}`
    const sessionKey = `desktop:${chatId}`
    const result = await state.forwardCreateSessionToExecutor(sessionKey, chatId, email)
    if (!result.ok) return reply.status(503).send({ ok: false, error: result.error })
    const now = new Date().toISOString()
    return reply.status(201).send({
      key: sessionKey,
      channel: 'desktop',
      chatId,
      createdAt: now,
      updatedAt: now,
      title: '',
      preview: '',
    })
  })

  app.get<{ Querystring: { key?: string } }>('/api/webui-thread', async (req) => {
    const email = await auth.resolveViewerEmail(authHeader(req))
    const sessionKey = decodeURIComponent(String(req.query.key || '').trim())
    if (!sessionKey) return null
    return state.fetchThreadForViewer(email, sessionKey)
  })

  app.delete<{ Params: { sessionKey: string } }>('/api/sessions/:sessionKey', async (req) => {
    const email = await auth.resolveViewerEmail(authHeader(req))
    const sessionKey = decodeURIComponent(req.params.sessionKey)
    await state.assertViewerOwnsSession(email, sessionKey)
    return { ok: true }
  })

  app.get('/api/settings', async (req) => {
    await auth.resolveViewerToken(authHeader(req))
    return SETTINGS_STUB
  })

  app.post('/api/settings/update', async (req) => {
    await auth.resolveViewerToken(authHeader(req))
    return SETTINGS_STUB
  })

  app.post('/api/settings/provider/update', async (req) => {
    await auth.resolveViewerToken(authHeader(req))
    return SETTINGS_STUB
  })

  app.post('/api/settings/web-search/update', async (req) => {
    await auth.resolveViewerToken(authHeader(req))
    return SETTINGS_STUB
  })

  app.get('/api/commands', async (req) => {
    await auth.resolveViewerToken(authHeader(req))
    return []
  })

  app.post<{ Body: { email?: string; password?: string } }>('/auth/register', async (req) => {
    return auth.startRegistration(String(req.body?.email || ''), String(req.body?.password || ''))
  })

  app.post<{ Body: { email?: string; code?: string } }>('/auth/register/verify', async (req) => {
    return auth.verifyRegistration(String(req.body?.email || ''), String(req.body?.code || ''))
  })

  app.post<{ Body: { email?: string; password?: string } }>('/auth/login', async (req) => {
    return auth.loginWithPassword(String(req.body?.email || ''), String(req.body?.password || ''))
  })

  app.post<{ Body: { email?: string } }>('/auth/email/request-code', async (req) => {
    return auth.requestEmailCode(String(req.body?.email || ''))
  })

  app.post<{ Body: { email?: string; code?: string } }>('/auth/email/verify', async (req) => {
    return auth.verifyRegistration(String(req.body?.email || ''), String(req.body?.code || ''))
  })
}
