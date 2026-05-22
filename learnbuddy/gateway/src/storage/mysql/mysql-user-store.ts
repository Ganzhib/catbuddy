import { Injectable } from '@nestjs/common'
import type { ResultSetHeader } from 'mysql2/promise'
import { MysqlPoolService } from '../../database/mysql-pool.service'
import type { StoredUser, UserStore } from '../ports/user-store.port'

@Injectable()
export class MysqlUserStore implements UserStore {
  constructor(private readonly db: MysqlPoolService) {}

  async findByEmail(email: string): Promise<StoredUser | null> {
    const key = email.trim().toLowerCase()
    const pool = this.db.getPool()
    const [rows] = await pool.execute(
      `SELECT email, password_hash, created_at
       FROM gateway_users WHERE email = ? LIMIT 1`,
      [key],
    )
    const row = (rows as Array<Record<string, unknown>>)[0]
    if (!row) return null
    return {
      email: String(row.email),
      passwordHash: String(row.password_hash),
      createdAt: new Date(String(row.created_at)).toISOString(),
    }
  }

  async create(email: string, passwordHash: string): Promise<StoredUser> {
    const key = email.trim().toLowerCase()
    const createdAt = new Date().toISOString()
    const pool = this.db.getPool()
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO gateway_users (email, password_hash, created_at)
         VALUES (?, ?, ?)`,
        [key, passwordHash, createdAt.slice(0, 23).replace('T', ' ')],
      )
      if (result.affectedRows !== 1) {
        throw new Error('create_failed')
      }
    } catch (err: unknown) {
      if (this.isDuplicateKey(err)) throw new Error('email_taken')
      throw err
    }
    return { email: key, passwordHash, createdAt }
  }

  private isDuplicateKey(err: unknown): boolean {
    return (
      typeof err === 'object'
      && err !== null
      && 'code' in err
      && (err as { code: string }).code === 'ER_DUP_ENTRY'
    )
  }
}
