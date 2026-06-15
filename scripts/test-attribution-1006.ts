/**
 * Teste manual do fallback de telefone (item 1 do plano de tracking do funil).
 * Roda a atribuição do disparo de 10/06 e mostra o antes/depois do match com Bitrix.
 * Uso: npx tsx scripts/test-attribution-1006.ts
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, pool } from "../server/db";
import { attributeBroadcastReplies } from "../server/services/broadcastAttribution";

const ID = "wa-20260610-bulk_actions-8566a27b";

async function snapshot(label: string) {
  const r = await db.execute(sql`
    WITH fr AS (
      SELECT DISTINCT ON (COALESCE(ghl_contact_id, lead_phone, reply_message_id))
        lead_phone, bitrix_contact_id, bitrix_deal_id
      FROM cortex_core.broadcast_lead_events
      WHERE broadcast_id = ${ID}
      ORDER BY COALESCE(ghl_contact_id, lead_phone, reply_message_id), reply_at ASC
    )
    SELECT COUNT(*)::int AS respondedores,
      COUNT(*) FILTER (WHERE lead_phone IS NOT NULL)::int AS com_telefone,
      COUNT(*) FILTER (WHERE bitrix_deal_id IS NOT NULL)::int AS casou_deal
    FROM fr`);
  console.log(label, JSON.stringify((r as any).rows[0]));
}

(async () => {
  await snapshot("ANTES :");
  const result = await attributeBroadcastReplies({
    from: new Date("2026-06-10T00:00:00.000Z"),
    to: new Date(),
    broadcastId: ID,
  });
  console.log("attribution:", JSON.stringify(result));
  await snapshot("DEPOIS:");
  await pool.end();
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
