/**
 * Sincroniza o campo "Motivo de Perda" (UF_CRM_1753388460) do Bitrix
 * para a tabela cortex_core.deal_motivo_perda.
 *
 * O Bitrix armazena apenas o ID do enum (ex.: '188'); este script resolve
 * para o texto ('Fake', 'Dropshipping', etc.) e faz UPSERT.
 *
 * Uso:
 *   npx tsx scripts/sync-bitrix-motivo-perda.ts
 *
 * Idempotente.
 */

import "dotenv/config";
import { pool } from "../server/db";

const FIELD = "UF_CRM_1753388460";
const PAGE_SIZE = 50; // Bitrix default

interface EnumItem {
  ID: string;
  VALUE: string;
}

async function fetchEnumMap(webhookBase: string): Promise<Map<string, string>> {
  const url = `${webhookBase}/crm.deal.userfield.list`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!r.ok) throw new Error(`userfield.list failed: ${r.status}`);
  const data: any = await r.json();
  const items: any[] = data.result || [];
  const target = items.find((i) => i.FIELD_NAME === FIELD);
  if (!target) throw new Error(`Field ${FIELD} not found`);
  const enumList: EnumItem[] = target.LIST || [];
  const map = new Map<string, string>();
  for (const it of enumList) map.set(String(it.ID), String(it.VALUE));
  return map;
}

async function fetchDealsPage(
  webhookBase: string,
  start: number,
): Promise<{ rows: any[]; next: number | null; total: number }> {
  const url = `${webhookBase}/crm.deal.list`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filter: { [`!=${FIELD}`]: "" },
      select: ["ID", FIELD],
      start,
      order: { ID: "ASC" },
    }),
  });
  if (!r.ok) throw new Error(`deal.list failed: ${r.status}`);
  const data: any = await r.json();
  return {
    rows: data.result || [],
    next: typeof data.next === "number" ? data.next : null,
    total: data.total || 0,
  };
}

export async function syncBitrixMotivoPerda(opts: { verbose?: boolean } = {}): Promise<{ totalSynced: number; totalSeen: number }> {
  const log = opts.verbose ? (m: string) => console.log(m) : () => {};
  const base = (process.env.BITRIX_WEBHOOK_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("BITRIX_WEBHOOK_URL não configurada");

  log("→ Carregando mapa de enum...");
  const enumMap = await fetchEnumMap(base);
  log(`  ${enumMap.size} valores possíveis em ${FIELD}`);

  log("→ Buscando deals com motivo de perda...");
  let start = 0;
  let totalSynced = 0;
  let totalSeen = 0;
  let pageNum = 0;
  const client = await pool.connect();
  try {
    while (true) {
      const { rows, next, total } = await fetchDealsPage(base, start);
      if (pageNum === 0) log(`  Total estimado: ${total} deals`);
      pageNum++;
      if (rows.length === 0) break;

      await client.query("BEGIN");
      for (const r of rows) {
        const dealId = parseInt(r.ID, 10);
        const motivoId = r[FIELD] ? parseInt(r[FIELD], 10) : null;
        const motivoText = motivoId != null ? enumMap.get(String(motivoId)) || null : null;
        if (!motivoText) continue;
        await client.query(
          `INSERT INTO cortex_core.deal_motivo_perda (deal_id, motivo_perda, motivo_id, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (deal_id) DO UPDATE SET
             motivo_perda = EXCLUDED.motivo_perda,
             motivo_id = EXCLUDED.motivo_id,
             updated_at = NOW()`,
          [dealId, motivoText, motivoId],
        );
        totalSynced++;
      }
      await client.query("COMMIT");
      totalSeen += rows.length;
      if (pageNum % 10 === 0) log(`  ... ${totalSeen}/${total} deals processados`);
      if (next == null) break;
      start = next;
    }
  } finally {
    client.release();
  }

  return { totalSynced, totalSeen };
}

// CLI entrypoint: só executa quando rodado direto via `tsx scripts/sync-bitrix-motivo-perda.ts`
const isDirectRun = process.argv[1]?.endsWith("sync-bitrix-motivo-perda.ts") || process.argv[1]?.endsWith("sync-bitrix-motivo-perda.js");
if (isDirectRun) {
  syncBitrixMotivoPerda({ verbose: true })
    .then(({ totalSynced, totalSeen }) => {
      console.log(`✅ ${totalSynced} deals com motivo_perda sincronizados (de ${totalSeen} verificados).`);
      return pool.end();
    })
    .catch((err) => {
      console.error("❌", err);
      process.exit(1);
    });
}
