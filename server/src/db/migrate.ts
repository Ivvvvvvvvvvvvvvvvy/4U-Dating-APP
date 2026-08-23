import 'dotenv/config';

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadDatabaseConfig } from '../config.js';
import { createDatabase, type Database, type SqlExecutor } from './pool.js';

export interface AppliedMigration {
  name: string;
  checksum: string;
}

export interface MigrationResult {
  applied: AppliedMigration[];
  skipped: string[];
}

function defaultMigrationsDirectory(): string {
  const sourceDirectory = dirname(fileURLToPath(import.meta.url));
  return resolve(sourceDirectory, '../../migrations');
}

export async function migrate(
  database: Database,
  migrationsDirectory = defaultMigrationsDirectory(),
): Promise<MigrationResult> {
  await database.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      checksum char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
    )
  `);

  const names = (await readdir(migrationsDirectory))
    .filter((name) => /^\d+_[a-z0-9_]+\.sql$/.test(name))
    .sort();
  const result: MigrationResult = { applied: [], skipped: [] };

  for (const name of names) {
    const sql = await readFile(join(migrationsDirectory, name), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    await database.transaction(async (transaction: SqlExecutor) => {
      await transaction.query('LOCK TABLE schema_migrations IN EXCLUSIVE MODE');
      const existing = await transaction.query<{ checksum: string }>(
        'SELECT checksum FROM schema_migrations WHERE name = $1',
        [name],
      );
      const row = existing.rows[0];
      if (row) {
        if (row.checksum !== checksum) {
          throw new Error(`Applied migration ${name} has changed`);
        }
        result.skipped.push(name);
        return;
      }
      await transaction.query(sql);
      await transaction.query(
        'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
        [name, checksum],
      );
      result.applied.push({ name, checksum });
    });
  }
  return result;
}

async function main(): Promise<void> {
  const database = createDatabase(loadDatabaseConfig());
  try {
    const result = await migrate(database);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await database.close();
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown migration failure';
    process.stderr.write(`Migration failed: ${message}\n`);
    process.exitCode = 1;
  });
}
