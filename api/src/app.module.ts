import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { QueryModule } from './query/query.module';

@Module({
  imports: [DatabaseModule, QueryModule],
  controllers: [AppController],
})
export class AppModule {}
