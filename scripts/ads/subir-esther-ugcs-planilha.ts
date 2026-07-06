/**
 * Cadastra na Biblioteca os hooks do lote "Esther - UGCs x Anuncios" (Drive: ADS 04-07 › Esther):
 * 2 bodies (B1/B2) × 10 hooks (H1-H10), c1 fixo, cada hook PAREADO 9x16(stories)+4x5(feed).
 * 1 linha/TP por (body,hook). Primário (drive_file_id + link_drive) = 9x16; o 4x5 vai na observação.
 * Ordem: b1 h1..h10 depois b2 h1..h10. Dedup por drive_file_id (9x16 e 4x5).
 * Lucas fica FORA deste lote (aguardando confirmação de prontidão).
 *
 *   npx tsx scripts/ads/subir-esther-ugcs-planilha.ts        # DRY (mostra o plano, não grava)
 *   npx tsx scripts/ads/subir-esther-ugcs-planilha.ts --go   # grava
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
const LOTE = "Esther - UGCs x Anuncios";
const go = process.argv.includes("--go");
const link = (id: string) => `https://drive.google.com/file/d/${id}/view`;

// Ordem EXATA de cadastro. base = nome do arquivo sem extensão (idêntico nos 2 formatos, muda só a pasta).
interface Hook { body: number; hook: number; base: string; v9: string; v4: string }
const HOOKS: Hook[] = [
  { body: 1, hook: 1,  base: "B1H1 - Esther - UGCs x Anuncios",  v9: "1a1pswVDU2aHicDZm8mPy8voD3jIUoKAh", v4: "15ouhdCFTg88cA97Qcd59FgoiZuVSEiZS" },
  { body: 1, hook: 2,  base: "B1H2 - Esther - UGCs x Anuncios",  v9: "1Li99jxQXCCk_sJmFNp06YEauh9H5yDfs", v4: "15-zIt6sBwlp93ThAI-vlpYc95gLEh7Jm" },
  { body: 1, hook: 3,  base: "B1H3 - Esther - UGCs x Anuncios",  v9: "1JihT8lsiS0rFYPEuoHQ80uL8JiCWs95L", v4: "1y4f0flDggMSNHPpIsdN7bdAuvBrxexd9" },
  { body: 1, hook: 4,  base: "B1H4 - Esther - UGCs x Anuncios",  v9: "1_pn67YPTjCSGrmwNuPEHMcwJ-q4nJ2FF", v4: "1ZtJ6d8jYTiU8lTF0Z5MimYyFcYxfpraM" },
  { body: 1, hook: 5,  base: "B1H5 - Esther - UGCs x Anuncios",  v9: "1CA7z9M4noqoLO7FngmgqymJilJ7LKMI_", v4: "1tm1R7Vmy5L40zWZV-iPn3haL_HqjCDgn" },
  { body: 1, hook: 6,  base: "B1H6 - Esther - UGCs x Anuncios",  v9: "1ddPCbsBGJ1NUc_N-uC6aQSl_9D1NRd8e", v4: "1ONoj5O82K1DTTVC07AXyelkFP7tTMkge" },
  { body: 1, hook: 7,  base: "B1H7 - Esther - UGCs x Anuncios",  v9: "1PaJdjIHSutgSVCSwzNHQo0Lv7YFT_YI0", v4: "1O9wVmf1aSaCSdyOdlXenV-Or1Qc2l62b" },
  { body: 1, hook: 8,  base: "B1H8 - Esther - UGCs x Anuncios",  v9: "1THcxePG-EOEVuEw8xGeA4AJypQ0tRo9A", v4: "1LKRJhBe83ZW2xPLJWbElGoXRf7p3cBOl" },
  { body: 1, hook: 9,  base: "B1H9 - Esther - UGCs x Anuncios",  v9: "1rR9V-Y4aOQGi0kdR2lq_kEzM5Lv_ReqK", v4: "1vggFJnzRmdEEQMe_Ab4XptkRbllCctxV" },
  { body: 1, hook: 10, base: "B1H10 - Esther - UGCs x Anuncios", v9: "1lYfxkz1YM_5aYKn-VleEOPNxGAoaqgNc", v4: "1-7xVK9ZNMIHyM1mlfJe3s-g1B5etoRyh" },
  { body: 2, hook: 1,  base: "B2H1 - Esther - UGCs x Anuncios",  v9: "10NidaMyd1WgPImFZr4xsyt4l-aIafFf1", v4: "1buSv3v2dSWslsT0nRwUUd58eXv1UVASZ" },
  { body: 2, hook: 2,  base: "B2H2 - Esther - UGCs x Anuncios",  v9: "1rpL8nw7z8cqUYLjNeJpdClGd58VWV3Rz", v4: "137nykgbDVpwg3UwtbLX4GFWwDgqsdIEV" },
  { body: 2, hook: 3,  base: "B2H3 - Esther - UGCs x Anuncios",  v9: "1jnBWDYds51cAU5KBaY2ZFr60IJRWVQaO", v4: "1MQmxR1TnQ06r4vWZFGV3St44vwltUTzu" },
  { body: 2, hook: 4,  base: "B2H4 - Esther - UGCs x Anuncios",  v9: "10PnIo6WgL1vSdPI_QP5rTt29T3dRN4XE", v4: "1pNVdlob90zMRCDLHNe0HnTD8oWahDkO7" },
  { body: 2, hook: 5,  base: "B2H5 - Esther - UGCs x Anuncios",  v9: "13gd67KQaqECBDm2bYB46E8dvClBUxMQa", v4: "1Up21XIMM-9DA7ITBeHUi81Uu29oTwgYJ" },
  { body: 2, hook: 6,  base: "B2H6 - Esther - UGCs x Anuncios",  v9: "1jOvjerWTHiQDBgueKW9dbjuwmXk62N8h", v4: "1XQRyIGwUYIQPmyRh9j_b8AzjFyWxKLL7" },
  { body: 2, hook: 7,  base: "B2H7 - Esther - UGCs x Anuncios",  v9: "1r3FWOQg4OKxlxH77xQcasjyMMkTvzBww", v4: "1uZM5rcBqcaMXn7UqHbEBQM6yxZhWEulg" },
  { body: 2, hook: 8,  base: "B2H8 - Esther - UGCs x Anuncios",  v9: "1m9k7itX9pBmc_xT6CZ1UO0dy7U9OetIP", v4: "1LnToeRXmsm_prtyhbhx03CFaCgRv_aIr" },
  { body: 2, hook: 9,  base: "B2H9 - Esther - UGCs x Anuncios",  v9: "1Z3ZmTBraDJoQ92tljCMnHdzjNWI7J9UJ", v4: "1QxRvdZHBTD225zATM5_qf3BgoA3Z1iFU" },
  { body: 2, hook: 10, base: "B2H10 - Esther - UGCs x Anuncios", v9: "1QbiM_K8-A1AENKtyP8d7y2q0ftgGK_or", v4: "1BwzOpCt3HC9tbb66F15uEfmK_UvieNrw" },
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

  console.log(`Lote "${LOTE}" · ${HOOKS.length} hooks pareados (b1 h1-h10 + b2 h1-h10)`);
  console.log(`Produto=${PRODUTO} · Plataforma=${PLATAFORMA} · Tipo=${TIPO_AD} · Funil=(vazio)`);
  console.log(`Já cadastrados: ${existing.length}/${allIds.length} arquivos · A cadastrar: ${toReg.length} hooks`);
  for (const e of existing) console.log(`  ↻ já existe: ${e.tpId} | ${e.nomeFinal}`);
  console.log("");
  toReg.forEach((h, i) => {
    const tp = `TP${startNum + i}`;
    console.log(`  ${tp} ← b${h.body} h${h.hook}  ${h.base}  9x16=${h.v9.slice(0, 6)}… 4x5=${h.v4.slice(0, 6)}…`);
  });

  console.log(`\nnome_final = "TPxxxx - <base>"  ·  primário=9x16, 4x5 vai na observação`);
  console.log(`modo: ${go ? "🔴 GRAVAR" : "DRY (não grava nada)"}`);
  if (!go) { console.log(`\n(DRY) Rode com --go pra cadastrar.`); process.exit(0); }
  if (!toReg.length) { console.log(`\nNada novo — todos já estão na Biblioteca.`); process.exit(0); }

  const out: { tpId: string; nomeFinal: string }[] = [];
  for (const h of toReg) {
    const observacao = `Lote ${LOTE} · Esther · h${h.hook} b${h.body} c1 · pareado 9x16+4x5 | 9x16: ${link(h.v9)} (${h.v9}) | 4x5: ${link(h.v4)} (${h.v4})`;
    const row = await createCreative({
      nomeDrive: h.base,
      linkDrive: link(h.v9),
      driveFileId: h.v9,
      personagem: "Esther",
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
