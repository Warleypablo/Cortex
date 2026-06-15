/**
 * Teste manual do novo incremental de contatos (item 3 do plano de tracking).
 * Replica a lógica do bloco de contatos do runGhlHourlySync e reporta quantos
 * contatos o run pegaria com a marca d'água atual do espelho.
 * Uso: npx tsx scripts/test-ghl-incremental.ts
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { ghlIterateContactsByUpdated, upsertContact } from "../server/services/goHighLevelSync";

(async () => {
  const hwRes = await db.execute(sql`SELECT MAX(date_updated) AS hw FROM cortex_core.ghl_contacts`);
  const hwRaw = (hwRes as any).rows?.[0]?.hw as string | Date | null;
  const watermarkMs = hwRaw
    ? new Date(hwRaw).getTime() - 10 * 60 * 1000
    : Date.now() - 7 * 24 * 60 * 60 * 1000;
  console.log("marca d'água (espelho):", hwRaw, "→ corte:", new Date(watermarkMs).toISOString());

  let n = 0;
  for await (const ct of ghlIterateContactsByUpdated({ pageLimit: 100 })) {
    const ts = Date.parse(ct.dateUpdated || ct.dateAdded || "");
    if (ts && ts < watermarkMs) break;
    await upsertContact(ct);
    n++;
  }
  console.log(`upsertados: ${n} contatos (run idempotente)`);
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
