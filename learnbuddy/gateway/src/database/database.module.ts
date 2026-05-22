import { Module } from '@nestjs/common'
import { MysqlPoolService } from './mysql-pool.service'

@Module({
  providers: [MysqlPoolService],
  exports: [MysqlPoolService],
})
export class DatabaseModule {}
