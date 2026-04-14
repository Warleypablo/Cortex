// scripts/auditoria-crm-erp.ts
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { CATALOG, type QuerySpec } from './auditoria/catalog.js';
import { runQueryFile, type QueryResult } from './auditoria/lib/run-query.js';
import { writeCsv } from './auditoria/lib/render-csv.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// In a git worktree the working directory is .claude/worktrees/auditoria-crm-erp/.
// The actual Cortex project root (with .env) is 4 levels up from scripts/.
// Try worktree root first, then walk up to project root.
const WORKTREE_ROOT = join(__dirname, '..');
loadEnv({ path: join(WORKTREE_ROOT, '.env') });
if (!process.env.DATABASE_URL) {
  // Walk up: worktrees/ -> .claude/ -> Cortex/
  loadEnv({ path: join(WORKTREE_ROOT, '..', '..', '..', '.env') });
}

const DRY_RUN = process.argv.includes('--dry-run');
const TODAY = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const REPO_ROOT = join(__dirname, '..');
const QUERIES_DIR = join(__dirname, 'auditoria', 'queries');
const REPORT_PATH = join(REPO_ROOT, 'docs', 'auditoria', `${TODAY}-auditoria-crm-erp.md`);
const CSV_DIR = join(REPO_ROOT, 'docs', 'auditoria', TODAY, 'csv');

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false }, max: 4 });

  console.log(`[auditoria] modo: ${DRY_RUN ? 'dry-run' : 'completo'}`);
  console.log(`[auditoria] data: ${TODAY}`);

  // Habilitar pg_trgm na sessão (graceful)
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    console.log('[auditoria] pg_trgm ok');
  } catch (e) {
    console.warn('[auditoria] pg_trgm indisponível — queries 02 e 16 vão falhar graceful');
  }

  const catalog: QuerySpec[] = DRY_RUN ? CATALOG.slice(0, 3) : CATALOG;
  const results: Array<{ spec: QuerySpec; result: QueryResult }> = [];

  for (const spec of catalog) {
    process.stdout.write(`[${spec.number.toString().padStart(2, '0')}] ${spec.title} ... `);
    const result = await runQueryFile(pool, QUERIES_DIR, spec.id);
    if (result.error) {
      console.log(`⚠️  ERRO (${result.durationMs}ms): ${result.error}`);
    } else {
      console.log(`✓ ${result.total} linhas (${result.durationMs}ms)`);
    }
    results.push({ spec, result });

    // Write CSV per category
    const csvPath = join(CSV_DIR, `${spec.id}.csv`);
    writeCsv(csvPath, result.rows);
  }

  // Placeholder: render markdown — implemented in Task 11
  mkdirSync(join(REPO_ROOT, 'docs', 'auditoria'), { recursive: true });
  writeFileSync(
    REPORT_PATH,
    `# Auditoria CRM → ERP — ${TODAY}\n\n(Render completo em Task 11.)\n\n${results.map(r => `- [${r.spec.number}] ${r.spec.title}: ${r.result.error ? '⚠️ ' + r.result.error : r.result.total + ' linhas'}`).join('\n')}\n`,
    'utf-8',
  );

  console.log(`[auditoria] relatório: ${REPORT_PATH}`);
  console.log(`[auditoria] csvs: ${CSV_DIR}`);

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
