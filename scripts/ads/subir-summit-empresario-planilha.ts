/**
 * Cadastra na Biblioteca os hooks do lote "3 - Creators Summit - Empresário" (pasta 01 - Editados):
 * personas Victor (h1-h3) e Lucas (h1-h3), b1c1, cada hook PAREADO 9x16(stories)+4x5(feed).
 * 1 linha/TP por hook. Primário (drive_file_id + link_drive) = 9x16; o 4x5 vai na observação.
 * Ordem: Victor h1..h3 depois Lucas h1..h3. Dedup por drive_file_id (9x16 e 4x5).
 *
 *   npx tsx scripts/ads/subir-summit-empresario-planilha.ts        # DRY (mostra o plano, não grava)
 *   npx tsx scripts/ads/subir-summit-empresario-planilha.ts --go   # grava
 */
import "dotenv/config";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { inArray } from "drizzle-orm";
import { createCreative, generateNextTpId } from "../../server/services/adsCreation/creativesRepo";

const CREATED_BY = process.env.ADS_PIPELINE_CREATED_BY || "ferramentas@turbopartners.com.br";
const PRODUTO = "Creators";
const PLATAFORMA = "Meta";
const TIPO_AD = "Vídeo";
const LOTE = "3 - Creators Summit - Empresário";
const go = process.argv.includes("--go");
const link = (id: string) => `https://drive.google.com/file/d/${id}/view`;

// Ordem EXATA de cadastro. base = nome do arquivo sem o sufixo de formato (_9x16/_4x5).
interface Hook { persona: string; hook: number; base: string; v9: string; v4: string }
const HOOKS: Hook[] = [
  { persona: "Victor", hook: 1, base: "Summit_Empresario_Victor_h1b1c1", v9: "1GvwGZH1kbFOpA6m6aLjs9TtI0cbx8WjN", v4: "1rmuYosP3df_DBDUbC_eD5wLQJm0ecn8l" },
  { persona: "Victor", hook: 2, base: "Summit_Empresario_Victor_h2b1c1", v9: "19aBR_vqzlplrNkztdxYg4B8FOmH-cCTt", v4: "1DSyxLpVzY4Kd2Cuuxf2a4HsplbdeIeEX" },
  { persona: "Victor", hook: 3, base: "Summit_Empresario_Victor_h3b1c1", v9: "1V9En1zAmnpoMBddtPkS2ssy3r12Vi-Zu", v4: "1qWMXnktqSJ6dgP4ycBaiEzgEwBoV6WFG" },
  { persona: "Lucas", hook: 1, base: "Summit_Empresario_Lucas_h1b1c1", v9: "1nwEqsTPGaTvbbv_rq1pMC_7j63ZCwVWa", v4: "1tMedax25wAUVJOoTbDNVZ6Oo-OreiNEr" },
  { persona: "Lucas", hook: 2, base: "Summit_Empresario_Lucas_h2b1c1", v9: "13k8pGdO4j5QwHgWXWv1at1YnV7jm_Fvq", v4: "1Ae2I3fg6Fx5NYyS4q7H4HVdWrn_oHXyI" },
  { persona: "Lucas", hook: 3, base: "Summit_Empresario_Lucas_h3b1c1", v9: "1g1tbOYSHg2odTMz23882oxxcsLwyovQq", v4: "1We5tUqUQ_go0CLiI8SjPTS_PkU6hNquE" },
];

(async () => {
  const allIds = HOOKS.flatMap((h) => [h.v9, h.v4]);
  const existing = await db
    .select({ tpId: creativesLibrary.tpId, d: creativesLibrary.driveFileId, nomeFinal: creativesLibrary.nomeFinal })
    .from(creativesLibrary)
    .where(inArray(creativesLibrary.driveFileId, allIds));
  const existingIds = new Set(existing.map((e) => e.d));
  const toReg = HOOKS.filter((h) => !existingIds.has(h.v9) && !existingIds.has(h.v4));

  const startTp = await generateNextTpId();
  const startNum = parseInt(startTp.replace("TP", ""), 10);

  console.log(`Lote "${LOTE}" · ${HOOKS.length} hooks pareados (Victor h1-h3 + Lucas h1-h3)`);
  console.log(`Produto=${PRODUTO} · Plataforma=${PLATAFORMA} · Tipo=${TIPO_AD} · Funil=(vazio)`);
  console.log(`Já cadastrados: ${existing.length}/${allIds.length} arquivos · A cadastrar: ${toReg.length} hooks`);
  for (const e of existing) console.log(`  ↻ já existe: ${e.tpId} | ${e.nomeFinal}`);
  console.log("");
  toReg.forEach((h, i) => {
    const tp = `TP${startNum + i}`;
    console.log(`  ${tp} ← [${h.persona}] ${h.base}  9x16=${h.v9.slice(0, 6)}… 4x5=${h.v4.slice(0, 6)}…`);
  });

  console.log(`\nnome_final = "TPxxxx - <base>"  ·  primário=9x16, 4x5 vai na observação`);
  console.log(`modo: ${go ? "🔴 GRAVAR" : "DRY (não grava nada)"}`);
  if (!go) { console.log(`\n(DRY) Rode com --go pra cadastrar.`); process.exit(0); }
  if (!toReg.length) { console.log(`\nNada novo — todos já estão na Biblioteca.`); process.exit(0); }

  const out: { tpId: string; nomeFinal: string }[] = [];
  for (const h of toReg) {
    const observacao = `Lote ${LOTE} · ${h.persona} · h${h.hook} b1 c1 · pareado 9x16+4x5 | 9x16: ${link(h.v9)} (${h.v9}) | 4x5: ${link(h.v4)} (${h.v4})`;
    const row = await createCreative({
      nomeDrive: h.base,
      linkDrive: link(h.v9),
      driveFileId: h.v9,
      personagem: h.persona,
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
  console.log(`\n✅ ${out.length} hooks cadastrados (${out[0].tpId} … ${out[out.length - 1].tpId}).`);
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });
