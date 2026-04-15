// scripts/auditoria-crm-erp.ts
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Pool } from 'pg';
import { mkdirSync, writeFileSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { CATALOG, type QuerySpec } from './auditoria/catalog.js';
import { runQueryFile, type QueryResult } from './auditoria/lib/run-query.js';
import { writeCsv } from './auditoria/lib/render-csv.js';
import { renderMarkdown } from './auditoria/lib/render-markdown.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// In a git worktree the working directory is .claude/worktrees/auditoria-crm-erp/.
// The actual Cortex project root (with .env) is 4 levels up from scripts/.
// Try worktree root first, then walk up to project root.
const WORKTREE_ROOT = join(__dirname, '..');
const ENV_PATH_1 = join(WORKTREE_ROOT, '.env');
const ENV_PATH_2 = join(WORKTREE_ROOT, '..', '..', '..', '.env');
loadEnv({ path: ENV_PATH_1 });
if (!process.env.DATABASE_URL) {
  // Walk up: worktrees/ -> .claude/ -> Cortex/
  loadEnv({ path: ENV_PATH_2 });
}
// AUDITORIA_DATABASE_URL tem precedência: a auditoria precisa rodar em prod, mas DATABASE_URL
// no .env padrão aponta pro banco local (cortex_dev). Defina AUDITORIA_DATABASE_URL no .env
// (ou inline: AUDITORIA_DATABASE_URL=postgresql://... npm run auditoria-crm-erp) com a string do prod.
const RESOLVED_DB_URL = process.env.AUDITORIA_DATABASE_URL ?? process.env.DATABASE_URL;
if (!RESOLVED_DB_URL) {
  console.error('[auditoria] Nenhuma URL de banco encontrada. Procurado:');
  console.error('  AUDITORIA_DATABASE_URL (env var, recomendado pra apontar pro prod)');
  console.error('  DATABASE_URL (fallback, geralmente é o banco local)');
  console.error('Arquivos .env consultados:');
  console.error(`  ${ENV_PATH_1}`);
  console.error(`  ${ENV_PATH_2}`);
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const TODAY = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const REPO_ROOT = join(__dirname, '..');
const QUERIES_DIR = join(__dirname, 'auditoria', 'queries');
const REPORT_PATH = join(REPO_ROOT, 'docs', 'auditoria', `${TODAY}-auditoria-crm-erp.md`);
const CSV_DIR = join(REPO_ROOT, 'docs', 'auditoria', TODAY, 'csv');

async function main() {
  const dbUrl = RESOLVED_DB_URL!;
  const isLocal = /localhost|127\.0\.0\.1/.test(dbUrl);
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 4,
  });

  try {
    console.log(`[auditoria] modo: ${DRY_RUN ? 'dry-run' : 'completo'}`);
    console.log(`[auditoria] data: ${TODAY}`);

    // Verificar pg_trgm (já deve estar instalado no banco; CREATE EXTENSION exige superuser).
    const trgm = await pool.query<{ extname: string }>(
      "SELECT extname FROM pg_extension WHERE extname='pg_trgm'",
    );
    if (trgm.rows.length > 0) {
      console.log('[auditoria] pg_trgm ok');
    } else {
      console.warn('[auditoria] pg_trgm não instalada — categorias que usam similarity() (02, 16) vão retornar erro graceful');
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

      // Write CSV per category — only on success
      if (!result.error) {
        const csvPath = join(CSV_DIR, `${spec.id}.csv`);
        writeCsv(csvPath, result.rows);
      }
    }

    const md = renderMarkdown({ date: TODAY, results });
    mkdirSync(join(REPO_ROOT, 'docs', 'auditoria'), { recursive: true });
    writeFileSync(REPORT_PATH, md, 'utf-8');

    console.log(`[auditoria] relatório: ${REPORT_PATH}`);
    console.log(`[auditoria] csvs: ${CSV_DIR}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
