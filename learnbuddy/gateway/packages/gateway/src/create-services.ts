import { AuthService } from './relay/auth/auth.service.js'
import { EmailService } from './relay/auth/email.service.js'
import { MysqlPool } from './relay/database/mysql-pool.js'
import { GatewayStateService } from './relay/gateway-state.js'
import { MysqlSessionStore } from './relay/storage/mysql/mysql-session-store.js'
import { MysqlUserStore } from './relay/storage/mysql/mysql-user-store.js'

export interface GatewayServices {
  pool: MysqlPool
  state: GatewayStateService
  auth: AuthService
}

export async function createGatewayServices(): Promise<GatewayServices> {
  const pool = new MysqlPool()
  await pool.init()
  const sessionStore = new MysqlSessionStore(pool)
  const userStore = new MysqlUserStore(pool)
  const state = new GatewayStateService(sessionStore)
  const email = new EmailService()
  const auth = new AuthService(state, email, userStore)
  auth.ensureDevViewerRegistered()
  return { pool, state, auth }
}
