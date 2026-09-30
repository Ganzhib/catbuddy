import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { getDefaultConfig } from '../config/defaults.js'
import { saveConfig } from '../config/persist.js'
import {
  EncryptedProviderCredentialStore,
  migrateLegacyProviderCredentials,
  type CredentialCrypto,
} from './provider-credential-store.js'

const fakeCrypto: CredentialCrypto = {
  isAvailable: () => true,
  encrypt: (value) => Buffer.from(`encrypted:${value}`, 'utf8'),
  decrypt: (value) => value.toString('utf8').replace(/^encrypted:/, ''),
  backend: () => 'test',
  isSecure: () => true,
}

test('encrypted credential store round-trips without plaintext on disk', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'catbuddy-credentials-'))
  try {
    const file = path.join(dir, 'credentials.json')
    const store = new EncryptedProviderCredentialStore(file, fakeCrypto)
    store.set('openai', 'sk-test-secret')
    assert.equal(store.get('openai'), 'sk-test-secret')
    assert.equal(store.hint('openai'), '••••cret')
    assert.equal(fs.readFileSync(file, 'utf8').includes('sk-test-secret'), false)
    store.delete('openai')
    assert.equal(store.has('openai'), false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('legacy provider keys migrate before config persistence', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'catbuddy-migration-'))
  try {
    const config = getDefaultConfig()
    config.providers.openai.apiKey = 'sk-legacy-value'
    const store = new EncryptedProviderCredentialStore(
      path.join(dir, 'credentials.json'),
      fakeCrypto,
    )
    assert.equal(migrateLegacyProviderCredentials(config, store, () => ''), true)
    assert.equal(store.get('openai'), 'sk-legacy-value')
    assert.equal(config.providers.openai.apiKey, undefined)
    const configFile = path.join(dir, 'config.json')
    saveConfig(configFile, config)
    assert.equal(fs.readFileSync(configFile, 'utf8').includes('sk-legacy-value'), false)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
