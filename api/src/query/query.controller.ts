import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { QueryService, QueryResult } from './query.service';

// POST /query
// Accepts: { question: string }
// Returns: { answer: string, sql: string, rows: any[] }
// TODO: Implement NL-to-SQL using the Anthropic SDK (the logic lives in
//       query.service.ts — this controller just validates input and delegates).
//       The database schema is available in db/migrations/001_initial_schema.sql.
//       Use ANTHROPIC_API_KEY from environment.
@Controller('query')
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  @Post()
  async query(@Body('question') question: string): Promise<QueryResult> {
    if (!question || typeof question !== 'string' || !question.trim()) {
      throw new BadRequestException(
        'Request body must include a non-empty "question" string.',
      );
    }

    return this.queryService.answerQuestion(question.trim());
  }
}
