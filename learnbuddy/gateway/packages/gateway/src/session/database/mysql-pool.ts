import mysql, { type Pool } from 'mysql2/promise'
import { gatewayEnv } from '../config/env.js'
import { GATEWAY_SCHEMA_STATEMENTS } from './schema.js'

export class MysqlPool {
  private pool!: Pool

  getPool(): Pool {
    if (!this.pool) throw new Error('mysql_pool_not_initialized')
    return this.pool
  }

  async init(): Promise<void> {
    const url = gatewayEnv.databaseUrl.trim()
    this.pool = url
      ? mysql.createPool(url)
      : mysql.createPool({
          host: gatewayEnv.mysql.host,
          port: gatewayEnv.mysql.port,
          user: gatewayEnv.mysql.user,
          password: gatewayEnv.mysql.password,
          database: gatewayEnv.mysql.database,
          connectionLimit: 10,
          timezone: 'Z',
        })
    for (const sql of GATEWAY_SCHEMA_STATEMENTS) {
      await this.pool.execute(sql)
    }
  }

  async close(): Promise<void> {
    if (this.pool) await this.pool.end()
  }
}
