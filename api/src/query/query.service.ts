import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// The shape the frontend expects back from POST /query.
export interface QueryResult {
  answer: string; // plain-English answer for the user
  sql: string; // the SQL that was generated and run
  rows: any[]; // the raw result rows
}

@Injectable()
export class QueryService {
  // A ready-to-use, connected Postgres pool is injected for you. Run queries with:
  //   const result = await this.pool.query(sql);
  //   return result.rows;
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async answerQuestion(question: string): Promise<QueryResult> {
    // ───────────────────────────────────────────────────────────────────────
    // TODO (Part 3): Implement natural language -> SQL -> answer.
    //
    // Expected implementation:
    //   1. Build a system prompt that includes the full DB schema. The four
    //      tables are organizations, clinicians, sessions, notes — see
    //      db/migrations/001_initial_schema.sql for exact columns.
    //   2. Send the user's question to Claude with instructions to return SQL
    //      only, e.g. with the Anthropic SDK (already a dependency):
    //
    //        import Anthropic from '@anthropic-ai/sdk';
    //        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    //        const message = await anthropic.messages.create({
    //          model: 'claude-sonnet-4-6',
    //          max_tokens: 1024,
    //          system: schemaAwareSystemPrompt,
    //          messages: [{ role: 'user', content: question }],
    //        });
    //
    //   3. Execute the returned SQL against Postgres (READ-ONLY — enforce this).
    //      The pool is already wired up: `await this.pool.query(generatedSql)`.
    //   4. Return { answer, sql, rows } — the SQL must be visible to the user.
    //
    // Error cases to handle:
    //   - LLM returns invalid SQL
    //   - Query returns zero rows
    //   - Query references columns/tables that don't exist
    //   - User asks something that can't be answered with SQL
    //
    // Read-only safety ideas: reject anything that isn't a single SELECT, run
    // inside a `BEGIN TRANSACTION READ ONLY`, set a `statement_timeout`, and/or
    // connect with a Postgres role that only has SELECT privileges.
    // ───────────────────────────────────────────────────────────────────────

    // Referenced so the stub compiles cleanly; remove when you implement this.
    void question;
    void this.pool;

    throw new NotImplementedException(
      'POST /query is not implemented yet. Implement QueryService.answerQuestion(): ' +
        'turn the question into SQL with the Anthropic SDK, run it read-only against ' +
        'Postgres, and return { answer, sql, rows }. See the TODO in ' +
        'api/src/query/query.service.ts.',
    );
  }
}
