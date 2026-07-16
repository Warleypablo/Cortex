/**
 * Reaponta broadcast_lead_events.bitrix_deal_id após a migração "Synapse" do Bitrix.
 *
 * Contexto (09/07/2026): o pipeline Synapse recriou "Bitrix".crm_deal com IDs novos
 * (1e9+) e contact_id NULO em todos os deals. Os deal_ids gravados nos eventos de
 * atribuição ficaram órfãos → reuniões/vendas/custo zeraram no dash Broadcast.
 *
 * Este script refaz o vínculo evento→deal usando o contato já resolvido
 * (bitrix_contact_id → crm_contact, que continua íntegra) e casando o deal por
 * contact_id OU por nome normalizado (único vínculo que sobrou na tabela nova),
 * pegando o deal mais recente — mesma regra da atribuição em broadcastAttribution.ts.
 *
 * Uso:
 *   npx tsx scripts/relink-broadcast-deals-synapse.ts           # dry-run (só relata)
 *   npx tsx scripts/relink-broadcast-deals-synapse.ts --apply   # grava
 *
 * Idempotente — pode rodar de novo (ex.: se o Synapse repopular contact_id).
 * Lê as credenciais direto do .env (DB_*) pra não depender da ordem de import do dotenv.
 */

import { readFileSync } from "fs";
import pg from "pg";

const APPLY = process.argv.includes("--apply");

function envVal(key: string): string {
  const env = readFileSync(".env", "utf8");
  const m = env.match(new RegExp(`^\\s*${key}=(.*)$`, "m"));
  if (!m) throw new Error(`${key} não encontrado no .env`);
  return m[1].trim();
}

// Mapa contato→deal mais recente (id OU nome), só pros contatos presentes nos eventos.
const MAP_CTE = `
  WITH contatos AS (
    SELECT DISTINCT e.bitrix_contact_id
    FROM cortex_core.broadcast_lead_events e
    WHERE e.bitrix_contact_id IS NOT NULL
  ),
  mapa AS (
    SELECT c.id AS contact_id, m.deal_id
    FROM contatos ct
    JOIN "Bitrix".crm_contact c ON c.id = ct.bitrix_contact_id
    LEFT JOIN LATERAL (
      SELECT d.id AS deal_id
      FROM "Bitrix".crm_deal d
      WHERE d.contact_id = c.id
         OR (c.name IS NOT NULL AND TRIM(c.name) <> ''
             AND LOWER(TRIM(d.contact_name)) = LOWER(TRIM(c.name)))
      ORDER BY d.date_create DESC NULLS LAST
      LIMIT 1
    ) m ON true
  )
`;

async function main() {
  const client = new pg.Client({
    host: envVal("DB_HOST"),
    database: envVal("DB_NAME"),
    user: envVal("DB_USER"),
    password: envVal("DB_PASSWORD"),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const antes = await client.query(`
    SELECT count(*)::int AS eventos,
           count(e.bitrix_deal_id)::int AS com_deal,
           count(*) FILTER (WHERE d.id IS NOT NULL)::int AS deal_existe
    FROM cortex_core.broadcast_lead_events e
    LEFT JOIN "Bitrix".crm_deal d ON d.id = e.bitrix_deal_id
  `);
  console.log("[relink] antes:", antes.rows[0]);

  const previa = await client.query(`
    ${MAP_CTE}
    SELECT count(*)::int AS eventos_com_contato,
           count(mapa.deal_id)::int AS religariam
    FROM cortex_core.broadcast_lead_events e
    JOIN mapa ON mapa.contact_id = e.bitrix_contact_id
  `);
  console.log("[relink] prévia do match:", previa.rows[0]);

  if (!APPLY) {
    console.log("[relink] dry-run — nada gravado. Rode com --apply pra aplicar.");
    await client.end();
    return;
  }

  const upd = await client.query(`
    ${MAP_CTE}
    UPDATE cortex_core.broadcast_lead_events e
    SET bitrix_deal_id = mapa.deal_id
    FROM mapa
    WHERE e.bitrix_contact_id = mapa.contact_id
      AND e.bitrix_deal_id IS DISTINCT FROM mapa.deal_id
  `);
  console.log(`[relink] eventos atualizados: ${upd.rowCount}`);

  const depois = await client.query(`
    SELECT count(*)::int AS eventos,
           count(e.bitrix_deal_id)::int AS com_deal,
           count(*) FILTER (
             WHERE d.data_reuniao_agendada IS NOT NULL
               AND d.data_reuniao_agendada >= e.reply_at::date
           )::int AS reunioes_pos_reply
    FROM cortex_core.broadcast_lead_events e
    LEFT JOIN "Bitrix".crm_deal d ON d.id = e.bitrix_deal_id
  `);
  console.log("[relink] depois:", depois.rows[0]);
  await client.end();
}

main().catch((e) => {
  console.error("[relink] FATAL:", e.message);
  process.exit(1);
});
