/**
 * Cura retroativa da atribuição de broadcasts: reprocessa respostas dos últimos
 * 60 dias que ficaram sem telefone (agora resolvível via fallback da conversa).
 * Uso: npx tsx scripts/heal-attribution.ts
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, pool } from "../server/db";
import { attributeBroadcastReplies } from "../server/services/broadcastAttribution";

async function snapshot(label: string) {
  const r = await db.execute(sql`
    SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE lead_phone IS NULL)::int AS sem_telefone,
      COUNT(*) FILTER (WHERE bitrix_deal_id IS NOT NULL)::int AS com_deal
    FROM cortex_core.broadcast_lead_events`);
  console.log(label, JSON.stringify((r as any).rows[0]));
}

(async () => {
  await snapshot("ANTES :");
  const result = await attributeBroadcastReplies({
    from: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });
  console.log("attribution:", JSON.stringify(result));
  await snapshot("DEPOIS:");
  await pool.end();
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
