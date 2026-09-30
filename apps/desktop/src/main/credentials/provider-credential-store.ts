import fs from 'node:fs'
import path from 'node:path'
import type { ProviderCredentialStorageStatus, catbuddyConfig } from '@catbuddy/shared'

interface CredentialFile {
  version: 1
  entries: Record<string, string>
}

export interface CredentialCrypto {
  isAvailable(): boolean
  encrypt(value: string): Buffer
  decrypt(value: Buffer): string
  backend(): string
  isSecure(): boolean
}

export interface ProviderCredentialStore {
  get(providerId: string): string | undefined
  has(providerId: string): boolean
  set(providerId: string, apiKey: string): void
  delete(providerId: string): void
  hint(providerId: string): string | null
  status(): ProviderCredentialStorageStatus
}

function assertProviderId(providerId: string): string {
  const value = providerId.trim()
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value)) {
    throw new Error('Invalid provider id')
  }
  if (value === '__proto__' || value === 'prototype' || value === 'constructor') {
    throw new Error('Invalid provider id')
  }
  return value
}

export class EncryptedProviderCredentialStore implements ProviderCredentialStore {
  private data: CredentialFile | null = null

  constructor(
    private readonly filePath: string,
    private readonly crypto: CredentialCrypto,
  ) {}

  get(providerId: string): string | undefined {
    const id = assertProviderId(providerId)
    const encrypted = this.load().entries[id]
    if (!encrypted) return undefined
    if (!this.crypto.isAvailable()) return undefined
    try {
      return this.crypto.decrypt(Buffer.from(encrypted, 'base64'))
    } catch (error) {
      throw new Error(`Unable to decrypt credential for ${id}`, { cause: error })
    }
  }

  has(providerId: string): boolean {
    return !!this.get(providerId)?.trim()
  }

  set(providerId: string, apiKey: string): void {
    const id = assertProviderId(providerId)
    const secret = apiKey.trim()
    if (!secret) throw new Error('API key must not be empty')
    if (!this.crypto.isAvailable()) {
      throw new Error('Secure credential storage is unavailable on this system')
    }
    const data = this.load()
    data.entries[id] = this.crypto.encrypt(secret).toString('base64')
    this.persist(data)
  }

  delete(providerId: string): void {
    const id = assertProviderId(providerId)
    const data = this.load()
    if (!(id in data.entries)) return
    delete data.entries[id]
    this.persist(data)
  }

  hint(providerId: string): string | null {
    const value = this.get(providerId)?.trim()
    if (!value) return null
    return `••••${value.slice(-4)}`
  }

  status(): ProviderCredentialStorageStatus {
    const available = this.crypto.isAvailable()
    return {
      available,
      secure: available && this.crypto.isSecure(),
      backend: this.crypto.backend(),
      ...(!available
        ? { message: 'Secure credential storage is unavailable.' }
        : !this.crypto.isSecure()
          ? { message: 'The operating system is using a reduced-security credential backend.' }
          : {}),
    }
  }

  private load(): CredentialFile {
    if (this.data) return this.data
    if (!fs.existsSync(this.filePath)) {
      this.data = { version: 1, entries: Object.create(null) as Record<string, string> }
      return this.data
    }
    const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Partial<CredentialFile>
    if (parsed.version !== 1 || !parsed.entries || typeof parsed.entries !== 'object') {
      throw new Error('Unsupported provider credential file')
    }
    const entries = Object.create(null) as Record<string, string>
    for (const [key, value] of Object.entries(parsed.entries)) {
      assertProviderId(key)
      if (typeof value === 'string' && value) entries[key] = value
    }
    this.data = { version: 1, entries }
    return this.data
  }

  private persist(data: CredentialFile): void {
    const dir = path.dirname(this.filePath)
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
    const tmp = `${this.filePath}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 })
    fs.renameSync(tmp, this.filePath)
    if (process.platform !== 'win32') fs.chmodSync(this.filePath, 0o600)
  }
}

export function migrateLegacyProviderCredentials(
  config: catbuddyConfig,
  store: ProviderCredentialStore,
  envKeyForProvider: (providerId: string) => string,
): boolean {
  const legacyEntries = Object.entries(config.providers ?? {}).filter(([, provider]) =>
    !!provider.apiKey?.trim(),
  )
  if (legacyEntries.length === 0) return false
  if (!store.status().available) {
    throw new Error(
      'Secure credential storage is unavailable; existing plaintext API keys were not modified.',
    )
  }
  for (const [providerId, provider] of legacyEntries) {
    const legacy = provider.apiKey!.trim()
    if (legacy !== envKeyForProvider(providerId).trim()) store.set(providerId, legacy)
  }
  for (const [, provider] of legacyEntries) delete provider.apiKey
  return true
}
