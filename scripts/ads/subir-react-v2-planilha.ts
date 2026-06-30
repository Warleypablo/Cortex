/**
 * Cadastra na Biblioteca os hooks do lote "60 - Estratégia Peculiar React V2" (pasta 01 - Editados):
 * persona Lucas (h1–h5), b1c1, cada hook PAREADO 9x16(stories)+4x5(feed). 1 linha/TP por hook.
 * Primário (drive_file_id + link_drive) = 9x16; o 4x5 (link + file_id) vai na observação.
 * Dedup por drive_file_id (9x16 e 4x5).
 *
 *   npx tsx subir-react-v2-planilha.ts        # DRY (mostra o plano, não grava)
 *   npx tsx subir-react-v2-planilha.ts --go   # grava
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
const PERSONA = "Lucas";
const go = process.argv.includes("--go");
const link = (id: string) => `https://drive.google.com/file/d/${id}/view`;

// Ordem EXATA de cadastro (Lucas h1..h5). base = nome do arquivo sem o sufixo de formato.
interface Hook { hook: number; base: string; v9: string; v4: string }
const HOOKS: Hook[] = [
  { hook: 1, base: "Estrategia_peculiar_react_v2_Lucas_h1b1c1", v9: "1Nl-OjlVxUbBfwTEbLHL7kfpyBHTobcE-", v4: "1H9gkJPEMSnvHvTwCYyk5URUVE1rKK7sS" },
  { hook: 2, base: "Estrategia_peculiar_react_v2_Lucas_h2b1c1", v9: "1uC0zdQFzZxcA049B1JVh6cgHZxnfJnl8", v4: "1GsMHtBqkRs33XuPcmJ9g7nmaTvtuVKSm" },
  { hook: 3, base: "Estrategia_peculiar_react_v2_Lucas_h3b1c1", v9: "1NCjsQ7P9mFxgsKOJQXUnkdwuKfNOakZD", v4: "1wMzU-qdv1nwQYEa0nZbLdL5CHgyL-Jiu" },
  { hook: 4, base: "Estrategia_peculiar_react_v2_Lucas_h4b1c1", v9: "1DyqSxaJZ4a3l9Q6eknziDPALqWnojOwA", v4: "1TkW9yWG0gaTyHpql9dNI_fszxpPoBk6M" },
  { hook: 5, base: "Estrategia_peculiar_react_v2_Lucas_h5b1c1", v9: "107Fqad1iwgaJYrnT6HOOUXHa008oxQCW", v4: "1rxFSjOxhI2mT9qNLD52meQG_q70ac8dY" },
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

  console.log(`Lote "60 - Estratégia Peculiar React V2" · ${HOOKS.length} hooks pareados (${PERSONA} h1-h5)`);
  console.log(`Produto=${PRODUTO} · Plataforma=${PLATAFORMA} · Tipo=${TIPO_AD} · Funil=(vazio)`);
  console.log(`Já cadastrados: ${existing.length}/${allIds.length} arquivos · A cadastrar: ${toReg.length} hooks`);
  for (const e of existing) console.log(`  ↻ já existe: ${e.tpId} | ${e.nomeFinal}`);
  console.log("");
  toReg.forEach((h, i) => {
    const tp = `TP${startNum + i}`;
    console.log(`  ${tp} ← [${PERSONA}] ${h.base}  9x16=${h.v9.slice(0, 6)}… 4x5=${h.v4.slice(0, 6)}…`);
  });

  console.log(`\nnome_final = "TPxxxx - <base>"  ·  primário=9x16, 4x5 vai na observação`);
  console.log(`modo: ${go ? "🔴 GRAVAR" : "DRY (não grava nada)"}`);
  if (!go) { console.log(`\n(DRY) Rode com --go pra cadastrar.`); process.exit(0); }
  if (!toReg.length) { console.log(`\nNada novo — todos já estão na Biblioteca.`); process.exit(0); }

  const out: { tpId: string; nomeFinal: string }[] = [];
  for (const h of toReg) {
    const observacao = `Lote 60 - Estratégia Peculiar React V2 · ${PERSONA} · h${h.hook} b1 c1 · pareado 9x16+4x5 | 9x16: ${link(h.v9)} (${h.v9}) | 4x5: ${link(h.v4)} (${h.v4})`;
    const row = await createCreative({
      nomeDrive: h.base,
      linkDrive: link(h.v9),
      driveFileId: h.v9,
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
  console.log(`\n✅ ${out.length} hooks cadastrados (${out[0].tpId} … ${out[out.length - 1].tpId}).`);
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });
