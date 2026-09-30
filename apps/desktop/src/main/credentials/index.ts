import path from 'node:path'
import { safeStorage } from 'electron'
import {
  EncryptedProviderCredentialStore,
  type CredentialCrypto,
} from './provider-credential-store.js'

export * from './provider-credential-store.js'

export function createProviderCredentialStore(configFile: string) {
  const crypto: CredentialCrypto = {
    isAvailable: () => safeStorage.isEncryptionAvailable(),
    encrypt: (value) => safeStorage.encryptString(value),
    decrypt: (value) => safeStorage.decryptString(value),
    backend: () => {
      if (process.platform !== 'linux') return 'safeStorage'
      return safeStorage.getSelectedStorageBackend?.() ?? 'safeStorage'
    },
    isSecure: () => {
      if (!safeStorage.isEncryptionAvailable()) return false
      return process.platform !== 'linux'
        || safeStorage.getSelectedStorageBackend?.() !== 'basic_text'
    },
  }
  return new EncryptedProviderCredentialStore(
    path.join(path.dirname(configFile), 'provider-credentials.json'),
    crypto,
  )
}
