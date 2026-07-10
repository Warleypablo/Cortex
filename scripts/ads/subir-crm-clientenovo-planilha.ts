/**
 * Passo 1/3 — Cadastra na Biblioteca os 18 criativos PAREADOS do lote
 * "Cliente Novo x Cliente da Base" (Lucas, CRM). 1 TP por par (9x16 primário + 4x5 na observação).
 * Ordem de cadastro (define os TP): b1 h1-9, depois b2 h1-9. IDEMPOTENTE: dedup por driveFileId (9x16).
 *
 *   npx tsx scripts/ads/subir-crm-clientenovo-planilha.ts        # DRY (mostra o plano, não grava)
 *   npx tsx scripts/ads/subir-crm-clientenovo-planilha.ts --go   # grava
 */
import "dotenv/config";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { inArray } from "drizzle-orm";
import { createCreative, generateNextTpId } from "../../server/services/adsCreation/creativesRepo";
import { PAIRS, LOTE, PRODUTO, PLATAFORMA, TIPO_AD, PERSONA, driveLink } from "./crm-clientenovo.data";

const CREATED_BY = process.env.ADS_PIPELINE_CREATED_BY || "ferramentas@turbopartners.com.br";
const go = process.argv.includes("--go");

(async () => {
  const ids9 = PAIRS.map((p) => p.drive9x16);
  const existing = await db
    .select({ tpId: creativesLibrary.tpId, d: creativesLibrary.driveFileId, nomeFinal: creativesLibrary.nomeFinal })
    .from(creativesLibrary)
    .where(inArray(creativesLibrary.driveFileId, ids9));
  const existingIds = new Set(existing.map((e) => e.d));
  const toReg = PAIRS.filter((p) => !existingIds.has(p.drive9x16));

  const startTp = await generateNextTpId();
  const startNum = parseInt(startTp.replace("TP", ""), 10);

  console.log(`Lote "${LOTE}" · ${PAIRS.length} criativos PAREADOS (9x16 + 4x5)`);
  console.log(`Produto=${PRODUTO} · Plataforma=${PLATAFORMA} · Tipo=${TIPO_AD} · Persona=${PERSONA}`);
  console.log(`Já cadastrados: ${existing.length}/${ids9.length} · A cadastrar: ${toReg.length}`);
  for (const e of existing) console.log(`  ↻ já existe: ${e.tpId} | ${e.nomeFinal}`);
  console.log("");
  toReg.forEach((p, i) => console.log(`  TP${startNum + i} ← b${p.body}h${p.hook}  ${p.base}  9x16=${p.drive9x16.slice(0, 8)}… 4x5=${p.drive4x5.slice(0, 8)}…`));

  console.log(`\nnome_final = "TPxxxx - <base>"  ·  pareado (9x16 primário, 4x5 na observação)`);
  console.log(`modo: ${go ? "🔴 GRAVAR" : "DRY (não grava nada)"}`);
  if (!go) { console.log(`\n(DRY) Rode com --go pra cadastrar.`); process.exit(0); }
  if (!toReg.length) { console.log(`\nNada novo — todos já estão na Biblioteca.`); process.exit(0); }

  const out: { tpId: string; nomeFinal: string }[] = [];
  for (const p of toReg) {
    const observacao = `Lote ${LOTE} · ${PERSONA} · pareado · b${p.body}h${p.hook} | 9x16: ${driveLink(p.drive9x16)} (${p.drive9x16}) | 4x5: ${driveLink(p.drive4x5)} (${p.drive4x5})`;
    const row = await createCreative({
      nomeDrive: p.base,
      linkDrive: driveLink(p.drive9x16),
      driveFileId: p.drive9x16,
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
