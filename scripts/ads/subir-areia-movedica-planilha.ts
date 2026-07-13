/**
 * Passo 1/3 — Cadastra na Biblioteca os 12 criativos do lote "Areia Movediça"
 * (Victor Peixoto, Creators, single-format 9x16). Ordem = hook 1..12. IDEMPOTENTE: dedup por driveFileId.
 *
 *   npx tsx scripts/ads/subir-areia-movedica-planilha.ts        # DRY
 *   npx tsx scripts/ads/subir-areia-movedica-planilha.ts --go   # grava
 */
import "dotenv/config";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { inArray } from "drizzle-orm";
import { createCreative, generateNextTpId } from "../../server/services/adsCreation/creativesRepo";
import { ITEMS, LOTE, PRODUTO, PLATAFORMA, TIPO_AD, PERSONA, driveLink } from "./areia-movedica.data";

const CREATED_BY = process.env.ADS_PIPELINE_CREATED_BY || "ferramentas@turbopartners.com.br";
const go = process.argv.includes("--go");

(async () => {
  const ids = ITEMS.map((it) => it.driveId);
  const existing = await db
    .select({ tpId: creativesLibrary.tpId, d: creativesLibrary.driveFileId, nomeFinal: creativesLibrary.nomeFinal })
    .from(creativesLibrary)
    .where(inArray(creativesLibrary.driveFileId, ids));
  const existingIds = new Set(existing.map((e) => e.d));
  const toReg = ITEMS.filter((it) => !existingIds.has(it.driveId));

  const startTp = await generateNextTpId();
  const startNum = parseInt(startTp.replace("TP", ""), 10);

  console.log(`Lote "${LOTE}" · ${ITEMS.length} criativos single-format (9x16)`);
  console.log(`Produto=${PRODUTO} · Plataforma=${PLATAFORMA} · Tipo=${TIPO_AD} · Persona=${PERSONA}`);
  console.log(`Já cadastrados: ${existing.length}/${ids.length} · A cadastrar: ${toReg.length}`);
  for (const e of existing) console.log(`  ↻ já existe: ${e.tpId} | ${e.nomeFinal}`);
  console.log("");
  toReg.forEach((it, i) => console.log(`  TP${startNum + i} ← h${it.hook}  ${it.base}  drive=${it.driveId.slice(0, 8)}…`));

  console.log(`\nnome_final = "TPxxxx - <base>"  ·  single-format 9x16`);
  console.log(`modo: ${go ? "🔴 GRAVAR" : "DRY (não grava nada)"}`);
  if (!go) { console.log(`\n(DRY) Rode com --go pra cadastrar.`); process.exit(0); }
  if (!toReg.length) { console.log(`\nNada novo — todos já estão na Biblioteca.`); process.exit(0); }

  const out: { tpId: string; nomeFinal: string }[] = [];
  for (const it of toReg) {
    const observacao = `Lote ${LOTE} · ${PERSONA} · single-format 9x16 · h${it.hook} | 9x16: ${driveLink(it.driveId)} (${it.driveId})`;
    const row = await createCreative({
      nomeDrive: it.base,
      linkDrive: driveLink(it.driveId),
      driveFileId: it.driveId,
      personagem: PERSONA,
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
