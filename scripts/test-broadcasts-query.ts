/**
 * Sanity check da query de broadcasts (aba Biblioteca em /ghl-marketing).
 * Roda o mesmo SQL do handler /api/ghl/broadcasts contra o banco real.
 *
 * Uso: DOTENV_CONFIG_PATH=.env npx tsx -r dotenv/config scripts/test-broadcasts-query.ts
 */

import { Pool } from "pg";

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
});

async function main() {
  const from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const to = new Date();

  console.time("query unificada");
  const r = await pool.query(
    `
    WITH email_broadcasts AS (
      SELECT
        c.id,
        'Email' AS channel,
        COALESCE(c.scheduled_at, c.date_added) AS date,
        c.status,
        c.name,
        c.subject,
        LEFT(COALESCE(c.subject, ''), 240) AS preview,
        c.campaign_type,
        NULL::text AS source,
        NULL::text AS body_hash,
        c.total_count::int AS list_size,
        COALESCE(c.success_count, 0)::int AS delivered
      FROM cortex_core.ghl_email_campaigns c
      WHERE COALESCE(c.scheduled_at, c.date_added) BETWEEN $1 AND $2
    ),
    wa_grouped AS (
      SELECT
        DATE_TRUNC('day', date_added) AS bday,
        source,
        MD5(COALESCE(body, '')) AS body_hash,
        MIN(date_added) AS first_date,
        MIN(body) AS sample_body,
        COUNT(DISTINCT contact_id)::int AS distinct_contacts
      FROM cortex_core.ghl_messages
      WHERE direction = 'outbound'
        AND source IN ('workflow', 'bulk_actions', 'campaign')
        AND date_added BETWEEN $1 AND $2
        AND body IS NOT NULL AND body <> ''
      GROUP BY DATE_TRUNC('day', date_added), source, MD5(COALESCE(body, ''))
      HAVING COUNT(DISTINCT contact_id) >= 10
    ),
    wa_broadcasts AS (
      SELECT
        'wa-' || TO_CHAR(bday, 'YYYYMMDD') || '-' || source || '-' || SUBSTR(body_hash, 1, 8) AS id,
        'WhatsApp' AS channel,
        first_date AS date,
        'concluido' AS status,
        NULL::text AS name,
        NULL::text AS subject,
        LEFT(COALESCE(sample_body, ''), 240) AS preview,
        NULL::text AS campaign_type,
        source,
        body_hash,
        distinct_contacts AS list_size,
        distinct_contacts AS delivered
      FROM wa_grouped
    ),
    all_b AS (
      SELECT * FROM email_broadcasts
      UNION ALL
      SELECT * FROM wa_broadcasts
    )
    SELECT *, COUNT(*) OVER ()::int AS total_count
    FROM all_b
    ORDER BY date DESC NULLS LAST
    LIMIT 10
  `,
    [from, to],
  );
  console.timeEnd("query unificada");

  console.log(`\nTotal broadcasts em 365d: ${r.rows[0]?.total_count ?? 0}`);
  console.log(`\nPrimeiros 10 (ordenados por data DESC):`);
  for (const row of r.rows) {
    console.log(
      `  ${row.channel.padEnd(8)} | ${new Date(row.date).toISOString().slice(0, 10)} | size=${row.list_size} | del=${row.delivered} | ${(row.name ?? row.preview ?? "").slice(0, 60)}`,
    );
  }

  // Open rate dos 10 broadcasts da página
  const emailIds = r.rows.filter((r: any) => r.channel === "Email").map((r: any) => r.id);
  if (emailIds.length) {
    console.time("\nquery open rate");
    const e = await pool.query(
      `
      SELECT campaign_id,
        COUNT(*) FILTER (WHERE event_type='EmailDelivered')::int AS delivered_events,
        COUNT(DISTINCT contact_id) FILTER (WHERE event_type='EmailOpened')::int AS unique_opens
      FROM cortex_core.ghl_email_events
      WHERE campaign_id = ANY($1::text[])
      GROUP BY campaign_id
    `,
      [emailIds],
    );
    console.timeEnd("\nquery open rate");
    console.log(`Open rate de ${e.rows.length} campaigns com eventos:`);
    for (const row of e.rows) {
      const pct = row.delivered_events > 0 ? ((row.unique_opens / row.delivered_events) * 100).toFixed(1) : "—";
      console.log(`  ${row.campaign_id} | delivered=${row.delivered_events} | opens=${row.unique_opens} | open_pct=${pct}%`);
    }
  }

  // Conversas geradas em 7d pros email broadcasts
  if (emailIds.length) {
    console.time("\nquery conversations email");
    const c = await pool.query(
      `
      WITH recipients AS (
        SELECT DISTINCT campaign_id, contact_id
        FROM cortex_core.ghl_email_events
        WHERE campaign_id = ANY($1::text[])
          AND event_type='EmailDelivered'
          AND contact_id IS NOT NULL
      ),
      campaign_dates AS (
        SELECT id, COALESCE(scheduled_at, date_added) AS broadcast_ts
        FROM cortex_core.ghl_email_campaigns
        WHERE id = ANY($1::text[])
      )
      SELECT
        r.campaign_id,
        COUNT(DISTINCT r.contact_id)::int AS conversations
      FROM recipients r
      JOIN campaign_dates cd ON cd.id = r.campaign_id
      JOIN cortex_core.ghl_messages m
        ON m.contact_id = r.contact_id
        AND m.direction = 'inbound'
        AND m.date_added > cd.broadcast_ts
        AND m.date_added <= cd.broadcast_ts + INTERVAL '7 days'
      GROUP BY r.campaign_id
    `,
      [emailIds],
    );
    console.timeEnd("\nquery conversations email");
    console.log(`Conversas geradas em 7d (email):`);
    for (const row of c.rows) console.log(`  ${row.campaign_id} | conv=${row.conversations}`);
  }
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    pool.end();
    process.exit(1);
  });
