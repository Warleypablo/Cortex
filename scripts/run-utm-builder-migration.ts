import 'dotenv/config';
import { pool } from '../server/db.js';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
  const sqlPath = path.join(process.cwd(), 'migrations', '2026-05-19-utm-builder.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  console.log(`Running migration: ${sqlPath}`);
  await pool.query(sql);

  const { rows: vocabRows } = await pool.query(
    `SELECT field, COUNT(*) AS n FROM cortex_core.utm_vocabulary GROUP BY field ORDER BY field`
  );
  console.log('utm_vocabulary seed:', vocabRows);

  const { rows: linksRows } = await pool.query(
    `SELECT COUNT(*) AS n FROM cortex_core.generated_utm_links`
  );
  console.log('generated_utm_links rows:', linksRows[0]);

  await pool.end();
  console.log('Done.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
