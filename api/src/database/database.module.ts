import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';

// Injection token for the shared Postgres connection pool.
export const PG_POOL = 'PG_POOL';

// A connected `pg` Pool, configured from the same POSTGRES_* environment
// variables as the rest of the stack. Marked @Global so any module can inject
// PG_POOL without re-importing this module. The pool is ready to use today —
// the Part 3 stub just doesn't call it yet.
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: () =>
        new Pool({
          host: process.env.POSTGRES_HOST ?? 'db',
          port: process.env.POSTGRES_PORT ? Number(process.env.POSTGRES_PORT) : 5432,
          user: process.env.POSTGRES_USER ?? 'blueprint',
          password: process.env.POSTGRES_PASSWORD ?? 'blueprint',
          database: process.env.POSTGRES_DB ?? 'blueprint',
        }),
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule {}
