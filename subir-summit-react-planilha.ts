/**
 * Cadastra na Biblioteca os hooks do lote "1 - Creators Summit React" (pasta 01 - Editados):
 * personas Esther (h1–h4) e Lucas (h1–h5), b1c1, cada hook PAREADO 9x16(stories)+4x5(feed).
 * 1 linha/TP por hook (igual ao lote Caio). Ordem: Esther h1..h4, depois Lucas h1..h5.
 * Primário (drive_file_id + link_drive) = 9x16; o 4x5 (link + file_id) vai na observação.
 * Dedup por drive_file_id (9x16 e 4x5).
 *
 *   npx tsx subir-summit-react-planilha.ts        # DRY (mostra o plano, não grava)
 *   npx tsx subir-summit-react-planilha.ts --go   # grava
 */
import "dotenv/config";
import { db } from "./server/db";
import { creativesLibrary } from "@shared/schema";
import { inArray } from "drizzle-orm";
import { createCreative, generateNextTpId } from "./server/services/adsCreation/creativesRepo";

const CREATED_BY = process.env.ADS_PIPELINE_CREATED_BY || "ferramentas@turbopartners.com.br";
const PRODUTO = "Creators";
const PLATAFORMA = "Meta";
const TIPO_AD = "Vídeo";
const go = process.argv.includes("--go");
const link = (id: string) => `https://drive.google.com/file/d/${id}/view`;

// Ordem EXATA de cadastro. base = nome do arquivo sem o sufixo de formato.
interface Hook { persona: string; hook: number; base: string; v9: string; v4: string }
const HOOKS: Hook[] = [
  // ---- Esther (h1–h4) ----
  { persona: "Esther", hook: 1, base: "Creator_Summit_React_Esther_h1b1c1", v9: "1yX2gWSSTZpN-dlw2MSTPw2McVugHR4yf", v4: "18V9NzECEbBAjFxT6JrQfDVLRjhHQ_5tt" },
  { persona: "Esther", hook: 2, base: "Creator_Summit_React_Esther_h2b1c1", v9: "1wJfhy6Fy9_84rAeCJHz0jGSKsKqO4G1U", v4: "1eltpU5PBnefHXZVsmcsVEYgsQn_GCE_z" },
  { persona: "Esther", hook: 3, base: "Creator_Summit_React_Esther_h3b1c1", v9: "1ANflV7oHFiJkoSquPYl9jDR5qnJaOytF", v4: "1FDZ_1yYa_Dy5oeNACGgv2qaQM0rW90uk" },
  { persona: "Esther", hook: 4, base: "Creator_Summit_React_Esther_h4b1c1", v9: "1UDlPPo2UVTjG1PHjCgXKwCggIyqGQK0O", v4: "1QmStqp2kaXhFhbm6jTFLmBUeSpKWgl1y" },
  // ---- Lucas (h1–h5) ----
  { persona: "Lucas", hook: 1, base: "Creator_Summit_React_Lucas_h1b1c1", v9: "1CG0YwFRP3B-W7LUJiXVcu9u7eFrbJpEn", v4: "1_ZNMWk5z4qq0E7J5s_P_RqzpQLw3hhKe" },
  { persona: "Lucas", hook: 2, base: "Creator_Summit_React_Lucas_h2b1c1", v9: "1HaGkOw7zm7DLZGes1lqlDFNLQ0b7dYir", v4: "1u0UsTIcCyg88nFk6Fg1HlrN9H8S16L_A" },
  { persona: "Lucas", hook: 3, base: "Creator_Summit_React_Lucas_h3b1c1", v9: "1146hDq5OL0bSxDv6H0jPFy3v8gfwWGYw", v4: "1RsEnIGXiP31r9Jx-2yxKdXMC2DvE4jX-" },
  { persona: "Lucas", hook: 4, base: "Creator_Summit_React_Lucas_h4b1c1", v9: "1ZylruzK27fIZKTZ-3SJiwRN31D5-5Jen", v4: "17RgW9MRT7uAJGYmzySmtIcgWgyoV5lbi" },
  { persona: "Lucas", hook: 5, base: "Creator_Summit_React_Lucas_h5b1c1", v9: "1IiPG88-7iXCAHXNqztJ1Zx5wSY7toG_i", v4: "1F5sldgx3goaZaOfG4w86vwxuSWI4oPEi" },
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

  console.log(`Lote "1 - Creators Summit React" · ${HOOKS.length} hooks pareados (Esther h1-h4 + Lucas h1-h5)`);
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
    const observacao = `Lote 1 - Creators Summit React · ${h.persona} · h${h.hook} b1 c1 · pareado 9x16+4x5 | 9x16: ${link(h.v9)} (${h.v9}) | 4x5: ${link(h.v4)} (${h.v4})`;
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
    console.log(`  ✅ ${row.tpId} | ${row.nomeFinal}  (${h.persona})`);
  }
  console.log(`\n✅ ${out.length} hooks cadastrados (${out[0].tpId} … ${out[out.length - 1].tpId}).`);
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });
