import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

const SQL_FILES = ["migrations/2026-07-14-central-custos.sql"];

function makePool(): Pool {
  const ssl = process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false };
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL, ssl });
  }
  if (!process.env.DB_HOST) {
    throw new Error(
      "Sem credenciais do banco. Defina DATABASE_URL, ou DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD. " +
        "Dica: rode com `npx tsx --env-file=.env scripts/apply-custos-migration.ts`.",
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
  const pool = makePool();
  console.log("→ aplicando migration central-custos…");
  for (const rel of SQL_FILES) {
    const sql = readFileSync(resolve(process.cwd(), rel), "utf8");
    process.stdout.write(`   • ${rel} … `);
    await pool.query(sql);
    console.log("ok");
  }
  const { rows } = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='cortex_core' AND table_name LIKE 'custo\\_%' ORDER BY table_name",
  );
  console.log("✓ Pronto. Tabelas custo_*:");
  console.table(rows);
  await pool.end();
}

main().catch((err) => {
  console.error("✗ Falhou:", err.message);
  process.exit(1);
});
