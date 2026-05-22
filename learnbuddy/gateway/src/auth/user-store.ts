import { Injectable } from '@nestjs/common'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { gatewayEnv } from '../config/env'

export interface StoredUser {
  email: string
  passwordHash: string
  createdAt: string
}

interface UsersFile {
  users: Record<string, StoredUser>
}

@Injectable()
export class UserStore {
  private readonly filePath: string
  private cache: UsersFile | null = null

  constructor() {
    const base =
      gatewayEnv.dataDir?.trim()
      || path.join(os.homedir(), '.learnbuddy-gateway')
    fs.mkdirSync(base, { recursive: true })
    this.filePath = path.join(base, 'users.json')
  }

  private load(): UsersFile {
    if (this.cache) return this.cache
    if (!fs.existsSync(this.filePath)) {
      this.cache = { users: {} }
      return this.cache
    }
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as UsersFile
      this.cache = parsed?.users ? parsed : { users: {} }
      return this.cache
    } catch {
      this.cache = { users: {} }
      return this.cache
    }
  }

  private save(data: UsersFile): void {
    const tmp = `${this.filePath}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
    fs.renameSync(tmp, this.filePath)
    this.cache = data
  }

  findByEmail(email: string): StoredUser | null {
    const key = email.trim().toLowerCase()
    return this.load().users[key] ?? null
  }

  create(email: string, passwordHash: string): StoredUser {
    const key = email.trim().toLowerCase()
    const data = this.load()
    if (data.users[key]) {
      throw new Error('email_taken')
    }
    const user: StoredUser = {
      email: key,
      passwordHash,
      createdAt: new Date().toISOString(),
    }
    data.users[key] = user
    this.save(data)
    return user
  }
}
