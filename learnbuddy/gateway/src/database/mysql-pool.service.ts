import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import mysql, { type Pool } from 'mysql2/promise'
import { gatewayEnv } from '../config/env'
import { GATEWAY_SCHEMA_STATEMENTS } from './schema'

@Injectable()
export class MysqlPoolService implements OnModuleInit, OnModuleDestroy {
  private pool!: Pool

  getPool(): Pool {
    if (!this.pool) {
      throw new Error('mysql_pool_not_initialized')
    }
    return this.pool
  }

  async onModuleInit(): Promise<void> {
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

  async onModuleDestroy(): Promise<void> {
    if (this.pool) await this.pool.end()
  }

}
