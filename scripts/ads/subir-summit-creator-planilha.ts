/**
 * Cadastra na Biblioteca os hooks do lote "4 - Creators Summit - Creator" (pasta 01 - Editados):
 * personas Victor (h1-h3) e Lucas (h1-h3), b1c1, cada hook PAREADO 9x16(stories)+4x5(feed).
 * 1 linha/TP por hook. Primário (drive_file_id + link_drive) = 9x16; o 4x5 vai na observação.
 * Ordem: Victor h1..h3 depois Lucas h1..h3. Dedup por drive_file_id (9x16 e 4x5).
 *
 *   npx tsx scripts/ads/subir-summit-creator-planilha.ts        # DRY (mostra o plano, não grava)
 *   npx tsx scripts/ads/subir-summit-creator-planilha.ts --go   # grava
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
const LOTE = "4 - Creators Summit - Creator";
const go = process.argv.includes("--go");
const link = (id: string) => `https://drive.google.com/file/d/${id}/view`;

// Ordem EXATA de cadastro. base = nome do arquivo sem o sufixo de formato (_9x16/_4x5).
interface Hook { persona: string; hook: number; base: string; v9: string; v4: string }
const HOOKS: Hook[] = [
  { persona: "Victor", hook: 1, base: "Summit_Creator_Victor_h1b1c1", v9: "1id4h9wNLTJMouXpoV8IQ--SmFwTEzuNF", v4: "1tOaf1MMP_JfH5kKuw43i5hpaVfExF7AQ" },
  { persona: "Victor", hook: 2, base: "Summit_Creator_Victor_h2b1c1", v9: "1-LmPfAjFzNIqhsFSiezjShqARCiMUZ3q", v4: "1HrRl8lM6N9jXN1t5R7zsy2MFPvBoet-V" },
  { persona: "Victor", hook: 3, base: "Summit_Creator_Victor_h3b1c1", v9: "1JePCwp1LqBIPuwbZDio5SCb0FKkz0WDU", v4: "1dCYZc5JTyCZ0Z5QSWY4K9vH9WdQi7Kqs" },
  { persona: "Lucas", hook: 1, base: "Summit_Creator_Lucas_h1b1c1", v9: "1rD5xjg6b770ISZRbnwzCEorIFqDI0auv", v4: "1KRVkvCyqbQya1Z-FNeAFzaku9KqeC9hL" },
  { persona: "Lucas", hook: 2, base: "Summit_Creator_Lucas_h2b1c1", v9: "1jCMPyo8WT8YNiSMgiQU94OoFMbO278vl", v4: "1-osvrSmen8X9oMsO8P1oC0dgrAjPnQwQ" },
  { persona: "Lucas", hook: 3, base: "Summit_Creator_Lucas_h3b1c1", v9: "1w1MgICMAcZ-gYO5Pzvkf1bAhq1QPo6JP", v4: "1W8ZqbBm2LDniMhejj-kBJSX5QEa-NKD2" },
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
