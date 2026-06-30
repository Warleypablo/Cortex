/**
 * Renumera os 8 criativos da Ana "Estratégia Peculiar" (9x16) na Biblioteca pra TPs
 * sequenciais a partir do último TP da planilha, na ORDEM dos nomes
 * (Hook1 V1→V4, depois Hook2 V1→V4). Atualiza tp_id + nome_final dos registros
 * existentes (UPDATE — não duplica, não cria novos).
 *
 *   npx tsx renumerar-ana.ts        # DRY: mostra o mapa, não grava
 *   npx tsx renumerar-ana.ts --go   # aplica
 */
import "dotenv/config";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { inArray, eq, sql, notInArray, and } from "drizzle-orm";
import { buildNomeFinal } from "../../server/services/adsCreation/creativesRepo";

const CURRENT = ["TP130", "TP131", "TP132", "TP133", "TP134", "TP557", "TP558", "TP1129"];
const go = process.argv.includes("--go");

(async () => {
  // último TP da planilha, IGNORANDO os 8 que vamos renumerar
  const maxRes = await db.execute(sql`
    SELECT MAX(CAST(SUBSTRING(tp_id FROM '^TP([0-9]+)$') AS INTEGER)) AS m
    FROM cortex_core.creatives_library
    WHERE tp_id ~ '^TP[0-9]+$'
      AND tp_id NOT IN ('TP130','TP131','TP132','TP133','TP134','TP557','TP558','TP1129')
  `);
  const max = Number((maxRes as any).rows?.[0]?.m ?? (maxRes as any)[0]?.m ?? 0);
  const start = max + 1;
  console.log(`Último TP da planilha (fora os 8 da Ana): ${max}  →  começa em TP${start}`);

  const rows = await db.select().from(creativesLibrary).where(inArray(creativesLibrary.tpId, CURRENT));
  // ordena pela ordem dos nomes: Hook asc, depois Variação asc
  const parsed = rows
    .map((r) => ({
      r,
      h: parseInt((r.nomeDrive.match(/Hook\s*(\d+)/i) || [])[1] || "0", 10),
      v: parseInt((r.nomeDrive.match(/\bV(\d+)/i) || [])[1] || "0", 10),
    }))
    .sort((a, b) => a.h - b.h || a.v - b.v);

  const plan = parsed.map((p, i) => {
    const newTp = `TP${start + i}`;
    return {
      oldTp: p.r.tpId,
      newTp,
      nomeDrive: p.r.nomeDrive,
      nomeFinal: buildNomeFinal({ tpId: newTp, nomeDrive: p.r.nomeDrive, dataPostagem: p.r.dataPostagem }),
    };
  });

  console.log("\nOrdem dos nomes → TP novo:");
  for (const u of plan) console.log(`  ${u.oldTp.padEnd(7)} → ${u.newTp}  | ${u.nomeDrive}`);

  if (!go) {
    console.log("\n(DRY) Nada gravado. Rode com --go pra aplicar.");
    process.exit(0);
  }

  for (const u of plan) {
    await db
      .update(creativesLibrary)
      .set({ tpId: u.newTp, nomeFinal: u.nomeFinal })
      .where(eq(creativesLibrary.tpId, u.oldTp));
  }
  console.log(`\n✅ ${plan.length} criativos renumerados → TP${start}–TP${start + plan.length - 1}.`);
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
