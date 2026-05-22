import { Global, Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { MysqlSessionStore } from './mysql/mysql-session-store'
import { MysqlUserStore } from './mysql/mysql-user-store'
import { SESSION_STORE, USER_STORE } from './storage.tokens'

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    MysqlSessionStore,
    MysqlUserStore,
    { provide: SESSION_STORE, useExisting: MysqlSessionStore },
    { provide: USER_STORE, useExisting: MysqlUserStore },
  ],
  exports: [SESSION_STORE, USER_STORE],
})
export class StorageModule {}
