import Anthropic from '@anthropic-ai/sdk';
import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { buildSystemPrompt } from './schema-context';
import { assertReadOnlySelect, runReadOnlyQuery } from './sql-safety';

// The shape the frontend expects back from POST /query.
export interface QueryResult {
  answer: string; // plain-English answer for the user
  sql: string; // the SQL that was generated and run
  rows: Record<string, unknown>[]; // the raw result rows
}

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;
const MAX_TURNS = 5; // model calls per question (bounds cost; allows SQL self-correction)
const MAX_ROWS_RETURNED = 500; // cap rows sent to the client
const MAX_ROWS_TO_MODEL = 50; // cap rows fed back to the model for summarizing

const EXECUTE_SQL_TOOL: Anthropic.Tool = {
  name: 'execute_sql',
  description:
    'Run a single read-only PostgreSQL SELECT (or WITH ... SELECT) query against ' +
    'the Blueprint database and return the resulting rows as JSON.',
  input_schema: {
    type: 'object',
    properties: {
      sql: {
        type: 'string',
        description:
          'A single read-only SELECT or WITH...SELECT statement. No semicolons ' +
          'separating multiple statements; no INSERT/UPDATE/DELETE/DDL.',
      },
    },
    required: ['sql'],
  },
};

@Injectable()
export class QueryService {
  private readonly anthropic: Anthropic | null;

  // A ready-to-use, connected Postgres pool is injected for us.
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.anthropic = apiKey ? new Anthropic({ apiKey }) : null;
  }

  async answerQuestion(question: string): Promise<QueryResult> {
    if (!this.anthropic) {
      throw new ServiceUnavailableException(
        'ANTHROPIC_API_KEY is not configured on the server. Add it to .env and ' +
          'restart the API to enable natural-language queries.',
      );
    }

    const system = buildSystemPrompt();
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: question },
    ];

    // The most recent successfully-executed query + its rows. We surface these even
    // if the model later fails, so the user always sees what actually ran.
    let lastSql = '';
    let lastRows: Record<string, unknown>[] = [];

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const message = await this.callClaude(system, messages);

      const toolUse = message.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
      );

      // No tool call → the model gave a final answer (a summary of results, or an
      // explanation that the question can't be answered with SQL). We're done.
      if (!toolUse) {
        return {
          answer: textOf(message) || 'I could not produce an answer for that question.',
          sql: lastSql,
          rows: lastRows.slice(0, MAX_ROWS_RETURNED),
        };
      }

      // Record the assistant's turn, then validate + run the SQL it asked for.
      messages.push({ role: 'assistant', content: message.content });

      const requestedSql = String(
        (toolUse.input as { sql?: unknown })?.sql ?? '',
      ).trim();

      let toolResult: string;
      let isError = false;
      try {
        const safeSql = assertReadOnlySelect(requestedSql);
        const rows = await runReadOnlyQuery(this.pool, safeSql);
        lastSql = safeSql;
        lastRows = rows;
        toolResult = JSON.stringify(
          { row_count: rows.length, rows: rows.slice(0, MAX_ROWS_TO_MODEL) },
          jsonSafeReplacer,
        );
      } catch (err) {
        // Feed the error back so the model can correct the query (bad column,
        // syntax error, non-SELECT, etc.) on the next turn.
        isError = true;
        lastSql = requestedSql; // show the user what was attempted
        toolResult =
          `Query failed: ${errorMessage(err)}. ` +
          `Fix the SQL and try again, or explain if it can't be answered.`;
      }

      messages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: toolResult,
            is_error: isError,
          },
        ],
      });
    }

    // Hit the turn limit without a final text answer. Ask once more, tools off, so
    // the model is forced to summarize whatever we have.
    const wrapUp = await this.callClaude(system, [
      ...messages,
      {
        role: 'user',
        content:
          'Give the user a short plain-English answer based on the results so far. ' +
          "If the query kept failing, say briefly that you couldn't answer it.",
      },
    ]);

    return {
      answer:
        textOf(wrapUp) ||
        (lastRows.length
          ? `The query returned ${lastRows.length} row(s).`
          : 'I was unable to answer that question after several attempts.'),
      sql: lastSql,
      rows: lastRows.slice(0, MAX_ROWS_RETURNED),
    };
  }

  /** One call to Claude with the execute_sql tool available. */
  private async callClaude(
    system: string,
    messages: Anthropic.MessageParam[],
    useTool = true,
  ): Promise<Anthropic.Message> {
    try {
      return await this.anthropic!.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages,
        ...(useTool
          ? {
              tools: [EXECUTE_SQL_TOOL],
              tool_choice: { type: 'auto', disable_parallel_tool_use: true },
            }
          : {}),
      });
    } catch (err) {
      throw new ServiceUnavailableException(
        `The AI service could not be reached: ${errorMessage(err)}`,
      );
    }
  }
}

/** Concatenate the text blocks of a Claude message. */
function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

/** JSON replacer that survives BigInt values (e.g. from COUNT in some configs). */
function jsonSafeReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
