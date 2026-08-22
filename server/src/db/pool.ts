import pg, { type QueryResult, type QueryResultRow } from 'pg';

import type { AppConfig } from '../config.js';

const { Pool } = pg;

export interface SqlExecutor {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

export interface Database extends SqlExecutor {
  transaction<T>(operation: (transaction: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

class PostgreSqlDatabase implements Database {
  readonly #pool: InstanceType<typeof Pool>;

  constructor(config: AppConfig['database']) {
    this.#pool = new Pool({
      connectionString: config.connectionString,
      max: config.maxConnections,
      idleTimeoutMillis: config.idleTimeoutMs,
      connectionTimeoutMillis: config.connectionTimeoutMs,
      statement_timeout: config.statementTimeoutMs,
      application_name: 'for-u-api',
      ssl: config.ssl ? { rejectUnauthorized: true } : undefined,
    });
  }

  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    return this.#pool.query<Row>(text, [...values]);
  }

  async transaction<T>(operation: (transaction: SqlExecutor) => Promise<T>): Promise<T> {
    const client = await this.#pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation({
        query: <Row extends QueryResultRow = QueryResultRow>(
          text: string,
          values: readonly unknown[] = [],
        ) => client.query<Row>(text, [...values]),
      });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  close(): Promise<void> {
    return this.#pool.end();
  }
}

export function createDatabase(config: AppConfig['database']): Database {
  return new PostgreSqlDatabase(config);
}

export function withTransaction<T>(
  database: Database,
  operation: (transaction: SqlExecutor) => Promise<T>,
): Promise<T> {
  return database.transaction(operation);
}

export function closeDatabase(database: Database): Promise<void> {
  return database.close();
}
