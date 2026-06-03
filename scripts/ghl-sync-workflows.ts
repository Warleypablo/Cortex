/**
 * Cria tabela ghl_workflows + faz sync inicial via GHL API.
 *
 * Uso: DOTENV_CONFIG_PATH=.env npx tsx -r dotenv/config scripts/ghl-sync-workflows.ts
 */
import { Pool } from "pg";
import { readFileSync } from "fs";
import { join } from "path";

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
});

const PIT = process.env.GHL_PIT_TOKEN!;
const LOC = process.env.GHL_LOCATION_ID!;
const VERSION = process.env.GHL_API_VERSION || "2021-07-28";

(async () => {
  const sqlText = readFileSync(join(process.cwd(), "migrations", "2026-05-23-ghl-workflows.sql"), "utf8");
  await pool.query(sqlText);
  console.log("Tabela ghl_workflows OK");

  const res = await fetch(`https://services.leadconnectorhq.com/workflows/?locationId=${LOC}`, {
    headers: { Authorization: `Bearer ${PIT}`, Version: VERSION, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`GHL ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { workflows: any[] };
  console.log(`GHL retornou ${data.workflows.length} workflows`);

  for (const w of data.workflows) {
    await pool.query(
      `INSERT INTO cortex_core.ghl_workflows
        (id, location_id, name, status, version, created_at, updated_at, raw, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         status = EXCLUDED.status,
         version = EXCLUDED.version,
         created_at = EXCLUDED.created_at,
         updated_at = EXCLUDED.updated_at,
         raw = EXCLUDED.raw,
         synced_at = NOW()`,
      [
        w.id,
        w.locationId,
        w.name ?? null,
        w.status ?? null,
        w.version ?? null,
        w.createdAt ? new Date(w.createdAt) : null,
        w.updatedAt ? new Date(w.updatedAt) : null,
        JSON.stringify(w),
      ],
    );
  }

  const counts = await pool.query(
    "SELECT status, COUNT(*)::int AS n FROM cortex_core.ghl_workflows GROUP BY status ORDER BY n DESC",
  );
  console.log("Sync concluído:");
  for (const row of counts.rows) console.log(`  ${row.status ?? "null"}: ${row.n}`);

  await pool.end();
})().catch((e) => {
  console.error(e);
  pool.end();
  process.exit(1);
});
