/**
 * Passo 1/3 — Cadastra na Biblioteca os 6 criativos do lote
 * "Captação Creators - Ismael/João" (single-format 9x16).
 * Ordem de cadastro (define os TP): Ismael h1-3, depois João h1-3.
 * IDEMPOTENTE: dedup por driveFileId.
 *
 *   npx tsx scripts/ads/subir-creators-cbo-planilha.ts        # DRY (mostra o plano, não grava)
 *   npx tsx scripts/ads/subir-creators-cbo-planilha.ts --go   # grava
 */
import "dotenv/config";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { inArray } from "drizzle-orm";
import { createCreative, generateNextTpId } from "../../server/services/adsCreation/creativesRepo";
import { ALL_ITEMS, LOTE, PRODUTO, PLATAFORMA, TIPO_AD, driveLink } from "./creators-cbo.data";

const CREATED_BY = process.env.ADS_PIPELINE_CREATED_BY || "ferramentas@turbopartners.com.br";
const go = process.argv.includes("--go");

(async () => {
  const allIds = ALL_ITEMS.map((it) => it.driveId);
  const existing = await db
    .select({ tpId: creativesLibrary.tpId, d: creativesLibrary.driveFileId, nomeFinal: creativesLibrary.nomeFinal })
    .from(creativesLibrary)
    .where(inArray(creativesLibrary.driveFileId, allIds));
  const existingIds = new Set(existing.map((e) => e.d));
  const toReg = ALL_ITEMS.filter((it) => !existingIds.has(it.driveId));

  const startTp = await generateNextTpId();
  const startNum = parseInt(startTp.replace("TP", ""), 10);

  console.log(`Lote "${LOTE}" · ${ALL_ITEMS.length} criativos single-format (9x16)`);
  console.log(`Produto=${PRODUTO} · Plataforma=${PLATAFORMA} · Tipo=${TIPO_AD} · Funil=(vazio)`);
  console.log(`Já cadastrados: ${existing.length}/${allIds.length} · A cadastrar: ${toReg.length}`);
  for (const e of existing) console.log(`  ↻ já existe: ${e.tpId} | ${e.nomeFinal}`);
  console.log("");
  toReg.forEach((it, i) => {
    console.log(`  TP${startNum + i} ← [${it.persona}] ${it.base}  drive=${it.driveId.slice(0, 8)}…`);
  });

  console.log(`\nnome_final = "TPxxxx - <base>"  ·  single-format 9x16`);
  console.log(`modo: ${go ? "🔴 GRAVAR" : "DRY (não grava nada)"}`);
  if (!go) { console.log(`\n(DRY) Rode com --go pra cadastrar.`); process.exit(0); }
  if (!toReg.length) { console.log(`\nNada novo — todos já estão na Biblioteca.`); process.exit(0); }

  const out: { tpId: string; nomeFinal: string }[] = [];
  for (const it of toReg) {
    const observacao = `Lote ${LOTE} · ${it.persona} · single-format 9x16 · pasta: ${it.drivePasta} | 9x16: ${driveLink(it.driveId)} (${it.driveId})`;
    const row = await createCreative({
      nomeDrive: it.base,
      linkDrive: driveLink(it.driveId),
      driveFileId: it.driveId,
      personagem: it.persona,
      produto: PRODUTO,
      plataforma: PLATAFORMA,
      tipoAd: TIPO_AD,
      etapaFunil: null,
      observacao,
      createdBy: CREATED_BY,
    });
    out.push({ tpId: row.tpId, nomeFinal: row.nomeFinal });
    console.log(`  ✅ ${row.tpId} | ${row.nomeFinal}`);
  }
  console.log(`\n✅ ${out.length} criativos cadastrados (${out[0].tpId} … ${out[out.length - 1].tpId}).`);
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });
