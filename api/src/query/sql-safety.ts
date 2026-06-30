import { Pool } from 'pg';

// Read-only enforcement for LLM-generated SQL. Two independent layers:
//   1. Static validation (this is a single SELECT, no writes, no statement chaining).
//   2. Execution inside a READ ONLY transaction with a statement timeout, so even if
//      validation is somehow fooled, the database itself rejects any write.

// Write / DDL / transaction-control keywords that must never appear.
const FORBIDDEN_KEYWORDS = [
  'insert', 'update', 'delete', 'merge', 'truncate', 'drop', 'alter', 'create',
  'grant', 'revoke', 'comment', 'copy', 'call', 'do', 'vacuum', 'analyze',
  'reindex', 'cluster', 'lock', 'listen', 'notify', 'refresh', 'begin', 'commit',
  'rollback', 'savepoint', 'prepare', 'execute', 'deallocate', 'set', 'reset',
];

/** Strip SQL comments so they can't hide forbidden keywords from the checks. */
function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // /* block */
    .replace(/--[^\n]*/g, ' '); // -- line
}

/**
 * Throws if `sql` is not a single, read-only SELECT statement.
 * Returns the cleaned SQL (trailing semicolon removed) when valid.
 */
export function assertReadOnlySelect(sql: string): string {
  const cleaned = stripComments(sql).trim().replace(/;\s*$/, '');

  if (!cleaned) {
    throw new Error('No SQL was provided.');
  }

  // Single statement only — no chaining via embedded semicolons.
  if (cleaned.includes(';')) {
    throw new Error('Only a single statement is allowed (no ";").');
  }

  // Must be a read query.
  if (!/^\s*(select|with)\b/i.test(cleaned)) {
    throw new Error('Only read-only SELECT (or WITH ... SELECT) queries are allowed.');
  }

  const lowered = cleaned.toLowerCase();
  for (const kw of FORBIDDEN_KEYWORDS) {
    if (new RegExp(`\\b${kw}\\b`).test(lowered)) {
      throw new Error(`Disallowed keyword "${kw.toUpperCase()}" — only read-only queries are permitted.`);
    }
  }

  return cleaned;
}

export interface RunOptions {
  timeoutMs?: number;
}

/**
 * Runs an already-validated SELECT inside a READ ONLY transaction with a statement
 * timeout, then rolls back. Any attempt to write fails at the database level.
 */
export async function runReadOnlyQuery(
  pool: Pool,
  sql: string,
  { timeoutMs = 8000 }: RunOptions = {},
): Promise<Record<string, unknown>[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    // timeoutMs is server-controlled; coerce to an integer before inlining.
    await client.query(`SET LOCAL statement_timeout = ${Math.floor(timeoutMs)}`);
    const result = await client.query(sql);
    return result.rows ?? [];
  } finally {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore rollback failure */
    }
    client.release();
  }
}
