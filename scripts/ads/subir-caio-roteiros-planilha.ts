/**
 * Cadastra na Biblioteca os 9 hooks do lote "59 - 3x ads validados re-escritos"
 * (apresentador Caio): roteiros 1-3 × hooks 1-3. Cada hook = 1 criativo PAREADO
 * (9x16 stories + 4x5 feed) → 1 linha / 1 TP, igual ao Creator Summit.
 *
 * Ordem de cadastro (= ordem dos TPs): R1H1, R1H2, R1H3, R2H1, R2H2, R2H3, R3H1, R3H2, R3H3.
 * Primário (drive_file_id + link_drive) = o 9x16; o 4x5 fica registrado na observação
 * (com o file_id, pra não perder o match). Dedup por drive_file_id do 9x16.
 *
 *   npx tsx subir-caio-roteiros-planilha.ts        # DRY (mostra o plano, não grava)
 *   npx tsx subir-caio-roteiros-planilha.ts --go   # grava de verdade
 */
import "dotenv/config";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { inArray } from "drizzle-orm";
import { createCreative, generateNextTpId } from "../../server/services/adsCreation/creativesRepo";

const CREATED_BY = process.env.ADS_PIPELINE_CREATED_BY || "ferramentas@turbopartners.com.br";
const PERSONAGEM = "Caio";
const PRODUTO = "Creators";
const PLATAFORMA = "Meta";
const TIPO_AD = "Vídeo";
const go = process.argv.includes("--go");

const link = (id: string) => `https://drive.google.com/file/d/${id}/view`;

// Ordem EXATA de cadastro (roteiro → hook). base = nome do hook sem o sufixo de formato.
interface Hook { base: string; roteiro: number; hook: number; v9: string; v4: string }
const HOOKS: Hook[] = [
  { base: "R1H1-Caio", roteiro: 1, hook: 1, v9: "1QwzBQWRkR6nHzMDeAY6MK0A1o4Yuo93F", v4: "1vtCSXC5XzDuobJLgkHa191G44WQfWrYa" },
  { base: "R1H2-Caio", roteiro: 1, hook: 2, v9: "1yBEt-yn7SFmxf1yclhBML-epR_tQbJAF", v4: "1xfXBmHR2ILHS2n-dIRzhNe36RbN88K8z" },
  { base: "R1H3-Caio", roteiro: 1, hook: 3, v9: "1_V2BIsi_RHYGSpx_TSg-ZRJ_rEj3Dmtz", v4: "1RepPnmjd3X_xQUzobvjB4Xmqv3l6vQSW" },
  { base: "R2H1-Caio", roteiro: 2, hook: 1, v9: "1FUlWORqcuT8rJt7Wbhv2UUTlrUHsN5Te", v4: "11K9v5P4R1SYiYmqGQ_HRjE84ayxCVCo8" },
  { base: "R2H2-Caio", roteiro: 2, hook: 2, v9: "1tDmdfCPYI52wvpdZv3UWpHx5FLT84463", v4: "12X_7O40Tq0cpvanxHxxDqT7kX1TMranh" },
  { base: "R2H3-Caio", roteiro: 2, hook: 3, v9: "1d2s5-HMj2OP0oZJQf0rP05_lhiKRUMsi", v4: "1BDboE_lxw8Wj8D8qkXbVVuzYrAPthoo-" },
  { base: "R3H1-Caio", roteiro: 3, hook: 1, v9: "1NwFEJQ488RSDgF6s7HUlnYB9EtWBo1t2", v4: "1LsdEKv6-aue1lIwW7w0eC08W7VOeo3T8" },
  { base: "R3H2-Caio", roteiro: 3, hook: 2, v9: "10gki9eFhSsw66tv8tQMU23ZXaegMuH47", v4: "1xr6zN7ho6OXvs8R0A8fYQ4McKCHzRSm9" },
  { base: "R3H3-Caio", roteiro: 3, hook: 3, v9: "1TWfO-_PHr_YJobWjlicx4jAd1NGLXqxy", v4: "18wWVABZUjkY5ex_qm7Z2Ag9miy7Uqcmg" },
];

(async () => {
  // dedup por drive_file_id (9x16 e 4x5)
  const allIds = HOOKS.flatMap((h) => [h.v9, h.v4]);
  const existing = await db
    .select({ tpId: creativesLibrary.tpId, d: creativesLibrary.driveFileId, nomeFinal: creativesLibrary.nomeFinal })
    .from(creativesLibrary)
    .where(inArray(creativesLibrary.driveFileId, allIds));
  const existingIds = new Set(existing.map((e) => e.d));

  const toReg = HOOKS.filter((h) => !existingIds.has(h.v9) && !existingIds.has(h.v4));
  const startTp = await generateNextTpId();
  const startNum = parseInt(startTp.replace("TP", ""), 10);

  console.log(`Lote "59 - 3x ads validados re-escritos" · ${HOOKS.length} hooks pareados (Caio)`);
  console.log(`Produto=${PRODUTO} · Plataforma=${PLATAFORMA} · Tipo=${TIPO_AD} · Funil=(vazio)`);
  console.log(`Já cadastrados: ${existing.length}/${allIds.length} arquivos · A cadastrar: ${toReg.length} hooks`);
  for (const e of existing) console.log(`  ↻ já existe: ${e.tpId} | ${e.nomeFinal}`);
  console.log("");
  toReg.forEach((h, i) => {
    const tp = `TP${startNum + i}`;
    console.log(`  ${tp} ← ${h.base}  (R${h.roteiro}H${h.hook})  9x16=${h.v9.slice(0, 6)}… 4x5=${h.v4.slice(0, 6)}…`);
  });

  console.log(`\nnome_final = "TPxxxx - <base>"  ·  primário=9x16, 4x5 vai na observação`);
  console.log(`modo: ${go ? "🔴 GRAVAR" : "DRY (não grava nada)"}`);
  if (!go) {
    console.log(`\n(DRY) Rode com --go pra cadastrar.`);
    process.exit(0);
  }
  if (!toReg.length) {
    console.log(`\nNada novo — todos já estão na Biblioteca.`);
    process.exit(0);
  }

  const out: { tpId: string; nomeFinal: string }[] = [];
  for (const h of toReg) {
    const observacao = `Lote 59 - 3x ads validados re-escritos · Roteiro ${h.roteiro} · Hook ${h.hook} · pareado 9x16+4x5 | 9x16: ${link(h.v9)} (${h.v9}) | 4x5: ${link(h.v4)} (${h.v4})`;
    const row = await createCreative({
      nomeDrive: h.base,
      linkDrive: link(h.v9),
      driveFileId: h.v9,
      personagem: PERSONAGEM,
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
})().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
