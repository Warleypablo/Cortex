/**
 * Aplica migration de anotações + pricing.
 * Uso: DOTENV_CONFIG_PATH=.env npx tsx -r dotenv/config scripts/ghl-apply-annotations.ts
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

(async () => {
  const sql = readFileSync(join(process.cwd(), "migrations", "2026-05-23-ghl-annotations-pricing.sql"), "utf8");
  await pool.query(sql);
  console.log("OK");
  const pricing = await pool.query(`SELECT channel, message_category, unit_cost_brl, effective_from FROM cortex_core.ghl_pricing ORDER BY channel`);
  console.log(`Pricing rows: ${pricing.rows.length}`);
  for (const row of pricing.rows) console.log(`  ${row.channel} | ${row.message_category ?? "-"} | R$${row.unit_cost_brl} | from ${row.effective_from.toISOString().slice(0,10)}`);
  await pool.end();
})().catch((e) => { console.error(e); pool.end(); process.exit(1); });
