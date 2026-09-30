import assert from 'node:assert/strict'
import test from 'node:test'
import { getDefaultConfig } from './defaults.js'
import { sanitizeConfigForRenderer } from './persist.js'

test('renderer config snapshot clears every known secret family', () => {
  const config = getDefaultConfig()
  config.providers.openai.apiKey = 'provider-secret'
  config.providers.openai.extraHeaders = { Authorization: 'Bearer header-secret' }
  config.gateway = { secret: 'gateway-secret' }
  config.langfuse = {
    enabled: true,
    publicKey: 'public',
    secretKey: 'langfuse-secret',
    baseUrl: 'https://example.com',
  }
  config.tools.mcpServers = {
    demo: { command: 'demo', env: { TOKEN: 'mcp-secret' } },
  }

  const safe = sanitizeConfigForRenderer(config)
  assert.equal(safe.providers.openai.apiKey, undefined)
  assert.equal(safe.providers.openai.extraHeaders, undefined)
  assert.equal(safe.gateway?.secret, '')
  assert.equal(safe.langfuse?.secretKey, '')
  assert.deepEqual(safe.tools.mcpServers?.demo.env, {})
  assert.equal(config.providers.openai.apiKey, 'provider-secret')
})
