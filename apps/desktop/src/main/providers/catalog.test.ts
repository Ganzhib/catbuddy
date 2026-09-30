import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveProviderProtocol } from './catalog.js'

test('provider protocol is explicit and never inferred from API base text', () => {
  assert.equal(resolveProviderProtocol('anthropic', {}), 'anthropic')
  assert.equal(
    resolveProviderProtocol('custom', {
      protocol: 'openai-compatible',
      apiBase: 'https://anthropic-proxy.example.com/v1',
    }),
    'openai-compatible',
  )
})
