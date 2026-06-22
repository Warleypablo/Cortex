/**
 * Reordena os 36 criativos CRM Recompra (TP1630–TP1665) na Biblioteca pra ordem
 * BODY → CTA → HOOK (b1c1 h1..h9, b1c2 h1..h9, b2c1 h1..h9, b2c2 h1..h9).
 * UPDATE in-place em 2 fases (tp_id temporário → final) pra não colidir no unique.
 *
 *   npx tsx reordenar-crm.ts        # DRY: mostra o remapeamento
 *   npx tsx reordenar-crm.ts --go   # aplica
 */
import "dotenv/config";
import { db } from "./server/db";
import { creativesLibrary } from "@shared/schema";
import { inArray, eq } from "drizzle-orm";
import { buildNomeFinal } from "./server/services/adsCreation/creativesRepo";

const START = 1630;
const COUNT = 36;
const TPS = Array.from({ length: COUNT }, (_, i) => `TP${START + i}`);
const parse = (n: string) => ({
  h: parseInt((n.match(/h(\d+)/i) || [])[1] || "0", 10),
  b: parseInt((n.match(/b(\d+)/i) || [])[1] || "0", 10),
  c: parseInt((n.match(/c(\d+)/i) || [])[1] || "0", 10),
});
const go = process.argv.includes("--go");

(async () => {
  const rows = await db.select().from(creativesLibrary).where(inArray(creativesLibrary.tpId, TPS));
  if (rows.length !== COUNT) console.log(`⚠️  achei ${rows.length} linhas (esperava ${COUNT})`);

  // ordena BODY → CTA → HOOK
  const sorted = rows
    .map((r) => ({ r, ...parse(r.nomeDrive) }))
    .sort((a, b) => a.b - b.b || a.c - b.c || a.h - b.h);
  const plan = sorted.map((s, i) => ({
    fid: s.r.driveFileId!,
    oldTp: s.r.tpId,
    newTp: `TP${START + i}`,
    nomeDrive: s.r.nomeDrive,
    dataPostagem: s.r.dataPostagem,
  }));

  console.log("Nova ordem (body → cta → hook):\n");
  for (const p of plan) console.log(`  ${p.oldTp.padEnd(7)} → ${p.newTp}  | ${p.nomeDrive}`);
  if (!go) {
    console.log("\n(DRY) Nada gravado. Rode com --go pra aplicar.");
    process.exit(0);
  }

  // fase 1: tp_id temporário (libera a faixa 1630–1665)
  for (let i = 0; i < plan.length; i++) {
    await db.update(creativesLibrary).set({ tpId: `TMPCRM${i}` }).where(eq(creativesLibrary.driveFileId, plan[i].fid));
  }
  // fase 2: tp_id final + nome_final
  for (const p of plan) {
    const nomeFinal = buildNomeFinal({ tpId: p.newTp, nomeDrive: p.nomeDrive, dataPostagem: p.dataPostagem });
    await db.update(creativesLibrary).set({ tpId: p.newTp, nomeFinal }).where(eq(creativesLibrary.driveFileId, p.fid));
  }
  console.log(`\n✅ ${plan.length} reordenados → TP${START}–TP${START + COUNT - 1} (body → cta → hook).`);
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
