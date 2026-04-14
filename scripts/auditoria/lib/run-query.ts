// scripts/auditoria/lib/run-query.ts
import type { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface QueryResult {
  id: string;
  rows: Record<string, unknown>[];
  total: number;
  durationMs: number;
  error?: string;
}

export async function runQueryFile(pool: Pool, queriesDir: string, id: string): Promise<QueryResult> {
  const path = join(queriesDir, `${id}.sql`);
  const start = Date.now();
  try {
    const sql = readFileSync(path, 'utf-8');
    const res = await pool.query(sql);
    return {
      id,
      rows: res.rows,
      total: res.rowCount ?? res.rows.length,
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      id,
      rows: [],
      total: 0,
      durationMs: Date.now() - start,
      error: msg,
    };
  }
}
