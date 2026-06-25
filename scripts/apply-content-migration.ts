/**
 * Aplica a migration do painel "Orgânico" (tabelas content_*) no banco do Cortex.
 *
 * Roda UMA vez. É aditivo e idempotente (CREATE TABLE IF NOT EXISTS): pode rodar
 * de novo sem risco — não altera nem apaga nenhuma tabela existente.
 *
 * Uso (de um checkout deste branch com as deps instaladas + o .env do Cortex):
 *   npx tsx --env-file=.env scripts/apply-content-migration.ts
 *   # se o seu shell já tem as variáveis do banco exportadas, pode omitir --env-file:
 *   npx tsx scripts/apply-content-migration.ts
 *
 * Credenciais: lê do mesmo lugar que o app — DATABASE_URL, ou
 * DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD (+ DB_SSL opcional).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

const SQL_PATH = resolve(process.cwd(), "migrations/2026-06-24-content-publish.sql");

function makePool(): Pool {
  const ssl = process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false };
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL, ssl });
  }
  if (!process.env.DB_HOST) {
    throw new Error(
      "Sem credenciais do banco. Defina DATABASE_URL, ou DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD. " +
        "Dica: rode com `npx tsx --env-file=.env scripts/apply-content-migration.ts`.",
    );
  }
  return new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl,
  });
}

async function main() {
  const sql = readFileSync(SQL_PATH, "utf8");
  const pool = makePool();
  console.log("→ aplicando migration content_* no banco…");
  await pool.query(sql);
  const { rows } = await pool.query(
    "SELECT platform, agent_enabled AS ativo, dry_run FROM cortex_core.content_publish_settings ORDER BY platform",
  );
  console.log("✓ Pronto. 4 tabelas content_* criadas/garantidas. Seed de settings:");
  console.table(rows);
  await pool.end();
}

main().catch((err) => {
  console.error("✗ Falhou:", err.message);
  process.exit(1);
});
