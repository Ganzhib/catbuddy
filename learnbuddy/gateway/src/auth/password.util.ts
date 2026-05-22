import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)
const KEY_LEN = 64

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scryptAsync(password, salt, KEY_LEN)) as Buffer
  return `${salt}:${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const idx = stored.indexOf(':')
  if (idx <= 0) return false
  const salt = stored.slice(0, idx)
  const expectedHex = stored.slice(idx + 1)
  try {
    const derived = (await scryptAsync(password, salt, KEY_LEN)) as Buffer
    const expected = Buffer.from(expectedHex, 'hex')
    if (derived.length !== expected.length) return false
    return timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}

export function isPasswordStrongEnough(password: string): boolean {
  return password.length >= 8 && password.length <= 128
}
