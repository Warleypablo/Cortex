/**
 * Backfill cirúrgico das conversões do pixel (actions/action_values) nas linhas
 * das campanhas do Creator Summit em meta_ads.meta_insights_daily.
 *
 * Por que existe: o sync diário do Meta só cobre os últimos ~7 dias. O Summit
 * rodou jun/2026, então as linhas antigas ficaram sem o jsonb actions. Este
 * script busca os eventos na Graph API e faz UPDATE apenas nas linhas do Summit
 * (não cria linhas novas). Idempotente — pode rodar quantas vezes quiser.
 *
 * Uso:
 *   npx tsx scripts/backfill-summit-actions.ts                 # jun/2026
 *   SINCE=2026-06-01 UNTIL=2026-07-31 npx tsx scripts/backfill-summit-actions.ts
 *
 * Depois de rodar, a aba Meta Ads do Creator Summit mostra carrinho, vendas,
 * custo por venda e ROAS reais (sai do estado "pendente").
 */
import "dotenv/config";
import { Client } from "pg";
import {
  SUMMIT_CAMPAIGN_KEYWORD,
  SUMMIT_CART_ACTION,
  SUMMIT_PURCHASE_ACTION,
} from "../shared/produtos";

const TURBO_ACCOUNT_ID = "act_1331413260627780";
const SINCE = process.env.SINCE || "2026-06-01";
const UNTIL = process.env.UNTIL || "2026-06-30";

async function main() {
  const token = process.env.ACCESS_TOKEN_META_SYSTEM;
  if (!token) throw new Error("ACCESS_TOKEN_META_SYSTEM ausente no .env");

  const c = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: false,
  });
  await c.connect();

  const ids = (
    await c.query(
      `SELECT DISTINCT campaign_id::text AS id FROM meta_ads.meta_campaigns WHERE campaign_name ILIKE $1`,
      [`%${SUMMIT_CAMPAIGN_KEYWORD}%`],
    )
  ).rows.map((r: any) => r.id);
  console.log(`Campanhas Summit: ${ids.length} | período ${SINCE} → ${UNTIL}`);

  const timeRange = JSON.stringify({ since: SINCE, until: UNTIL });
  const filtering = JSON.stringify([{ field: "campaign.id", operator: "IN", value: ids }]);
  const fields = "campaign_id,adset_id,ad_id,actions,action_values";
  let url: string | null =
    `https://graph.facebook.com/v18.0/${TURBO_ACCOUNT_ID}/insights?level=ad&time_increment=1` +
    `&time_range=${encodeURIComponent(timeRange)}&filtering=${encodeURIComponent(filtering)}` +
    `&fields=${encodeURIComponent(fields)}&limit=200&access_token=${encodeURIComponent(token)}`;

  let fetched = 0;
  let updated = 0;
  let page = 0;
  while (url) {
    const r = await fetch(url);
    const j: any = await r.json();
    if (j.error) throw new Error(`Graph API: ${j.error.message}`);
    page++;
    for (const row of j.data || []) {
      fetched++;
      const res = await c.query(
        `UPDATE meta_ads.meta_insights_daily
           SET actions = $1::jsonb, action_values = $2::jsonb, data_importacao = NOW()
         WHERE account_id = $3 AND campaign_id = $4 AND adset_id = $5 AND ad_id = $6 AND date_start = $7::date`,
        [
          JSON.stringify(row.actions || []),
          JSON.stringify(row.action_values || []),
          TURBO_ACCOUNT_ID,
          row.campaign_id,
          row.adset_id,
          row.ad_id,
          row.date_start,
        ],
      );
      updated += res.rowCount || 0;
    }
    url = j.paging?.next || null;
  }
  console.log(`Páginas: ${page} | linhas da API: ${fetched} | linhas atualizadas: ${updated}`);

  // Verificação: agregados que a aba Meta vai exibir
  const v = (
    await c.query(
      `WITH base AS (
         SELECT actions, action_values FROM meta_ads.meta_insights_daily
         WHERE campaign_id = ANY($1) AND date_start BETWEEN $2::date AND $3::date
       )
       SELECT
         COALESCE((SELECT SUM((a->>'value')::numeric) FROM base, jsonb_array_elements(base.actions) a
           WHERE jsonb_typeof(base.actions)='array' AND a->>'action_type'=$4),0) AS carrinho,
         COALESCE((SELECT SUM((a->>'value')::numeric) FROM base, jsonb_array_elements(base.actions) a
           WHERE jsonb_typeof(base.actions)='array' AND a->>'action_type'=$5),0) AS vendas,
         COALESCE((SELECT SUM((v->>'value')::numeric) FROM base, jsonb_array_elements(base.action_values) v
           WHERE jsonb_typeof(base.action_values)='array' AND v->>'action_type'=$5),0) AS receita`,
      [ids, SINCE, UNTIL, SUMMIT_CART_ACTION, SUMMIT_PURCHASE_ACTION],
    )
  ).rows[0];
  console.log("Verificação →", v);

  await c.end();
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
