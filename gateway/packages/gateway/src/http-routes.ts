import { randomBytes } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import type { AuthService } from './session/auth/auth.service.js'
import type { GatewayStateService } from './session/gateway-state.js'
import { gatewayEnv } from './session/config/env.js'
import { isWebLoginRequired } from './session/auth/auth-policy.js'
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
  runtime: { config_path: '(catbuddy gateway — desktop agent host)' },
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
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('smtp_auth_failed')) {
      return reply.status(503).send({ ok: false, error: 'smtp_auth_failed' })
    }
    if (msg.includes('smtp_timeout')) {
      return reply.status(503).send({ ok: false, error: 'smtp_timeout' })
    }
    if (msg.includes('smtp_send_failed') || msg.includes('smtp_')) {
      return reply.status(503).send({ ok: false, error: 'smtp_send_failed' })
    }
    app.log.error(err)
    return reply.status(500).send({ ok: false, error: 'internal_error' })
  })

  app.get('/health', async () => {
    const ex = state.countDesktops()
    const webLoginRequired = isWebLoginRequired()
    return {
      ok: true,
      gateway: true,
      gateway_shim: true,
      desktops: ex.total,
      online: ex.online > 0,
      desktop_online: ex.online > 0,
      storage: 'mysql',
      auth_require_email: gatewayEnv.authRequireEmail,
      auth_dev_bypass: gatewayEnv.authDevBypass,
      web_login_required: webLoginRequired,
    }
  })

  app.post<{
    Params: { sessionKey: string }
    Body: { content?: string; media?: unknown[] }
  }>('/api/sessions/:sessionKey/messages', async (req, reply) => {
    const email = await auth.resolveWebEmail(authHeader(req))
    const token = await auth.resolveWebToken(authHeader(req))
    const sessionKey = decodeURIComponent(req.params.sessionKey)
    const content = String(req.body?.content || '')
    if (!content.trim()) return reply.status(400).send({ ok: false, error: 'empty_content' })
    const media = Array.isArray(req.body?.media)
      ? req.body.media.filter((item): item is string => typeof item === 'string')
      : undefined
    state.ensureWebSubscribedForToken(token, sessionKey)
    const chatId = state.chatIdFromSessionKey(sessionKey)
    const result = await state.handleWebInboundForUser(
      email,
      token,
      sessionKey,
      chatId,
      content,
      media,
      'web',
    )
    return reply.status(result.ok ? 200 : 503).send(result)
  })

  app.get<{ Querystring: { secret?: string } }>('/webui/bootstrap', async (req) => {
    const token = await auth.resolveBootstrapToken(authHeader(req), req.query.secret)
    const ex = state.countDesktops()
    return {
      token,
      ws_path: gatewayEnv.publicWsPath,
      expires_in: 86_400,
      model_name: null,
      gateway_mode: 'gateway' as const,
      desktop_online: ex.online > 0,
    }
  })

  app.get('/api/sessions', async (req) => {
    const email = await auth.resolveWebEmail(authHeader(req))
    const token = await auth.resolveWebToken(authHeader(req))
    return state.fetchSessionsForWeb(email, token)
  })

  app.post<{ Body: { chatId?: string } }>('/api/sessions', async (req, reply) => {
    const email = await auth.resolveWebEmail(authHeader(req))
    const token = await auth.resolveWebToken(authHeader(req))
    const raw = String(req.body?.chatId || '').trim()
    const bare = raw.startsWith('desktop:') ? raw.slice('desktop:'.length) : raw
    const chatId = bare || `${Date.now()}_${randomBytes(3).toString('hex')}`
    const sessionKey = `desktop:${chatId}`
    const result = await state.forwardCreateSessionToDesktop(
      sessionKey,
      chatId,
      email,
      token,
    )
    if (!result.ok) return reply.status(503).send({ ok: false, error: result.error })
    const now = new Date().toISOString()
    return reply.status(result.offline ? 202 : 201).send({
      key: sessionKey,
      channel: 'desktop',
      chatId,
      createdAt: now,
      updatedAt: now,
      title: '',
      preview: '',
      offline: result.offline === true,
    })
  })

  app.get<{ Querystring: { key?: string } }>('/api/webui-thread', async (req) => {
    const email = await auth.resolveWebEmail(authHeader(req))
    const token = await auth.resolveWebToken(authHeader(req))
    const sessionKey = decodeURIComponent(String(req.query.key || '').trim())
    if (!sessionKey) return null
    return state.fetchThreadForWeb(email, sessionKey, token)
  })

  app.delete<{ Params: { sessionKey: string } }>('/api/sessions/:sessionKey', async (req) => {
    const email = await auth.resolveWebEmail(authHeader(req))
    const token = await auth.resolveWebToken(authHeader(req))
    const sessionKey = decodeURIComponent(req.params.sessionKey)
    await state.deleteSessionForWeb(email, sessionKey, token)
    return { ok: true }
  })

  app.get('/api/settings', async (req) => {
    await auth.resolveWebToken(authHeader(req))
    return SETTINGS_STUB
  })

  app.post('/api/settings/update', async (req) => {
    await auth.resolveWebToken(authHeader(req))
    return SETTINGS_STUB
  })

  app.post('/api/settings/provider/update', async (req) => {
    await auth.resolveWebToken(authHeader(req))
    return SETTINGS_STUB
  })

  app.post('/api/settings/web-search/update', async (req) => {
    await auth.resolveWebToken(authHeader(req))
    return SETTINGS_STUB
  })

  app.get('/api/commands', async (req) => {
    await auth.resolveWebToken(authHeader(req))
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

  app.post<{ Body: { email?: string; password?: string } }>(
    '/auth/email/request-code',
    async (req) => {
      return auth.requestEmailCode(
        String(req.body?.email || ''),
        String(req.body?.password || ''),
      )
    },
  )

  app.post<{ Body: { email?: string; code?: string } }>('/auth/email/verify', async (req) => {
    return auth.verifyRegistration(String(req.body?.email || ''), String(req.body?.code || ''))
  })
}
