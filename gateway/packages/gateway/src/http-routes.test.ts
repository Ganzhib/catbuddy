import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { registerHttpRoutes } from './http-routes.js'
import type { AuthService } from './session/auth/auth.service.js'
import type { GatewayStateService } from './session/gateway-state.js'

const apps: ReturnType<typeof Fastify>[] = []

function createTestApp() {
  const app = Fastify()
  apps.push(app)

  const resolveWebToken = vi.fn(async () => 'test-web-token')
  const auth = { resolveWebToken } as unknown as AuthService
  const state = {} as GatewayStateService
  registerHttpRoutes(app, state, auth)

  return { app, resolveWebToken }
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

describe('settings HTTP contract', () => {
  it('returns an authenticated, redacted, read-only settings payload', async () => {
    const { app, resolveWebToken } = createTestApp()

    const response = await app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: { authorization: 'Bearer web-token' },
    })

    expect(response.statusCode).toBe(200)
    expect(resolveWebToken).toHaveBeenCalledWith('Bearer web-token')
    expect(response.json()).toEqual({
      agent: {
        model: 'desktop',
        provider: 'gateway',
        resolved_provider: 'gateway',
        has_api_key: false,
      },
      providers: [],
      web_search: { provider: 'none', providers: [] },
      runtime: { config_path: '' },
      requires_restart: false,
      capabilities: {
        credential_management: false,
        provider_connection_test: false,
      },
    })
    expect(response.body).not.toContain('"apiKey"')
  })

  it.each([
    ['/api/settings', { model: 'gpt-4.1' }],
    ['/api/settings/provider', { provider: 'openai', apiKey: 'must-not-be-echoed' }],
    ['/api/settings/web-search', { provider: 'brave', apiKey: 'must-not-be-echoed' }],
  ])('rejects PATCH %s without storing or echoing credentials', async (url, payload) => {
    const { app, resolveWebToken } = createTestApp()

    const response = await app.inject({
      method: 'PATCH',
      url,
      headers: { authorization: 'Bearer web-token' },
      payload,
    })

    expect(response.statusCode).toBe(403)
    expect(resolveWebToken).toHaveBeenCalledWith('Bearer web-token')
    expect(response.json()).toEqual({
      ok: false,
      error: 'credential_management_desktop_only',
      message: 'Provider credentials can only be managed in the desktop app.',
      capabilities: {
        credential_management: false,
        provider_connection_test: false,
      },
    })
    expect(response.body).not.toContain('must-not-be-echoed')
  })

  it.each([
    '/api/settings/update',
    '/api/settings/provider/update',
    '/api/settings/web-search/update',
  ])('does not keep the legacy write endpoint %s', async (url) => {
    const { app } = createTestApp()

    const response = await app.inject({ method: 'POST', url, payload: {} })

    expect(response.statusCode).toBe(404)
  })
})
