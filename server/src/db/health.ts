import type { SqlExecutor } from './pool.js';

export class HealthRepository {
  constructor(private readonly executor: SqlExecutor) {}

  async ready(): Promise<boolean> {
    const result = await this.executor.query<{ ready: boolean }>(
      `SELECT COUNT(*) = 2 AS ready
         FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name IN ('domain_events', 'relationship_commands')`,
    );
    return result.rows[0]?.ready ?? false;
  }
}
