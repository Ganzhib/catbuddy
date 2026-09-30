import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { AgentLoop } from '../agent/loop.js'
import { getDefaultConfig } from '../config/defaults.js'
import {
  EncryptedProviderCredentialStore,
  type CredentialCrypto,
} from '../credentials/provider-credential-store.js'
import { setProviderCredentialResolver } from '../config/env-provider-fallback.js'
import { ProviderSettingsService } from './provider-settings.js'

const fakeCrypto: CredentialCrypto = {
  isAvailable: () => true,
  encrypt: (value) => Buffer.from(value, 'utf8'),
  decrypt: (value) => value.toString('utf8'),
  backend: () => 'test',
  isSecure: () => true,
}

test('provider upsert with model persists and activates one provider/model pair', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'catbuddy-provider-settings-'))
  try {
    const config = getDefaultConfig()
    const store = new EncryptedProviderCredentialStore(
      path.join(dir, 'credentials.json'),
      fakeCrypto,
    )
    setProviderCredentialResolver((providerId) => store.get(providerId))
    const applied: Array<{ name: string; model: string }> = []
    const agentLoop = {
      applyProviderSelection(provider: { name: string }, model: string) {
        applied.push({ name: provider.name, model })
      },
    } as unknown as AgentLoop
    const service = new ProviderSettingsService(
      { agentLoop, config, configFile: path.join(dir, 'config.json') },
      store,
    )

    const payload = service.upsertProvider({
      provider: 'custom',
      protocol: 'openai-compatible',
      apiBase: 'https://llm.example.com/v1',
      apiKey: 'custom-secret',
      model: 'example-model',
    })

    assert.equal(config.agents.defaults.provider, 'custom')
    assert.equal(config.agents.defaults.model, 'example-model')
    assert.deepEqual(applied, [{ name: 'openai_compat', model: 'example-model' }])
    assert.equal(payload.agent.provider, 'custom')
    assert.equal(payload.agent.model, 'example-model')
    assert.equal(fs.readFileSync(path.join(dir, 'config.json'), 'utf8').includes('custom-secret'), false)
    assert.throws(
      () => service.deleteCredential('custom'),
      /Switch to another provider before deleting this credential/,
    )
    assert.equal(store.has('custom'), true)
  } finally {
    setProviderCredentialResolver(null)
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
