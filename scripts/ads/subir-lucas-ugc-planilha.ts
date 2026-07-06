/**
 * Cadastra na Biblioteca os hooks do lote "Lucas - UGC x Anuncios" (Drive: ADS 04-07 › Lucas):
 * 2 bodies (B1/B2) × 11 hooks (H1-H11), c1 fixo, cada hook PAREADO 9x16(stories)+4x5(feed).
 * 1 linha/TP por (body,hook). Primário (drive_file_id + link_drive) = 9x16; o 4x5 vai na observação.
 * Ordem: b1 h1..h11 depois b2 h1..h11. Dedup por drive_file_id (9x16 e 4x5).
 * Obs: nome dos arquivos é "UGC" (singular) — diferente do lote da Esther ("UGCs").
 *
 *   npx tsx scripts/ads/subir-lucas-ugc-planilha.ts        # DRY (mostra o plano, não grava)
 *   npx tsx scripts/ads/subir-lucas-ugc-planilha.ts --go   # grava
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
const LOTE = "Lucas - UGC x Anuncios";
const go = process.argv.includes("--go");
const link = (id: string) => `https://drive.google.com/file/d/${id}/view`;

// Ordem EXATA de cadastro. base = nome do arquivo sem extensão (idêntico nos 2 formatos, muda só a pasta).
interface Hook { body: number; hook: number; base: string; v9: string; v4: string }
const HOOKS: Hook[] = [
  { body: 1, hook: 1,  base: "B1H1 - Lucas - UGC x Anuncios",  v9: "1NkEp1bygwXPNyM6lKb8P2k-DKuoCdVQq", v4: "11OyaNquykz6ANvKyhsW64aS8yBiezeC7" },
  { body: 1, hook: 2,  base: "B1H2 - Lucas - UGC x Anuncios",  v9: "1VnY5BM6UJd530lg4IO-9dgWZ9QKRp42_", v4: "1eWS7qM5jKdMdaYnfLwG-T8Nna7izgam8" },
  { body: 1, hook: 3,  base: "B1H3 - Lucas - UGC x Anuncios",  v9: "1J0XRrndOnFysNfVwtUxDQky9nffZ5E_m", v4: "1-zd8sHtng5F4Qxo4mGX4fvwDLL8G73t4" },
  { body: 1, hook: 4,  base: "B1H4 - Lucas - UGC x Anuncios",  v9: "1TVvfrIQV038N4colAIM9Sej790AzmUpr", v4: "16rDFtCG6CIPIoYkDyYSDk2L8UtAefDNP" },
  { body: 1, hook: 5,  base: "B1H5 - Lucas - UGC x Anuncios",  v9: "1wfsQv00fGNfY4B9biScyqp6WQaASKA98", v4: "1PaBgjD9hyBLFDOnV-ArD-wBRI03dKnF7" },
  { body: 1, hook: 6,  base: "B1H6 - Lucas - UGC x Anuncios",  v9: "1pznWkXrwZUJFa1b5obDmyNegQrdC8vO9", v4: "1GZqVc4rVi0gpGbQ6n5pJ1tDTD1h0It49" },
  { body: 1, hook: 7,  base: "B1H7 - Lucas - UGC x Anuncios",  v9: "1cFd3d99eeTG9JrNZ_dlLBFoIm6wXrzTw", v4: "1Fi71lOu3AUDrYCDIiqLv8e7Djm0F-2j7" },
  { body: 1, hook: 8,  base: "B1H8 - Lucas - UGC x Anuncios",  v9: "1vMzBE7eBBFUF4zur-tO3zQ9IvmWB3f1f", v4: "1i4ukMdb94WWn2t41L8khihl015Ttgc19" },
  { body: 1, hook: 9,  base: "B1H9 - Lucas - UGC x Anuncios",  v9: "1stnzJBf2w6XqrsiAtrmMzM-e9z0lZ3a4", v4: "1rZLFAI00gs41Is7rW-A2dF7IJ-b-z6VZ" },
  { body: 1, hook: 10, base: "B1H10 - Lucas - UGC x Anuncios", v9: "1rt4RDnZT74NFFcCVPq5jWClY6hzJdvKI", v4: "1REPF4KhoWVRpbmWF8N_zWCbAq_jUi0KK" },
  { body: 1, hook: 11, base: "B1H11 - Lucas - UGC x Anuncios", v9: "1oKOpIiNFranO1zZSszcXttCITf6wd7es", v4: "10dn_-SWkBnXxBGZj-bB0UTRpty8ID8Ic" },
  { body: 2, hook: 1,  base: "B2H1 - Lucas - UGC x Anuncios",  v9: "1hfPh43s9NrVgR5gbKgTk7ctbFlTv7rjz", v4: "10jrDQniPbwNt75OXrEEKFvNFw-6k1amf" },
  { body: 2, hook: 2,  base: "B2H2 - Lucas - UGC x Anuncios",  v9: "1MFq1LTq41cu1cKgLSfEfUuaTlXM8uRrH", v4: "147-q9phYoLRpl7y0_zch0EiBIpZtR3HU" },
  { body: 2, hook: 3,  base: "B2H3 - Lucas - UGC x Anuncios",  v9: "17-UG5awILvu_HdIjHnjTlHCS2IF3eQCt", v4: "1HzKR0fOuXAIJrjx9K7VDJwDBBaGqtonn" },
  { body: 2, hook: 4,  base: "B2H4 - Lucas - UGC x Anuncios",  v9: "1Yf6yc1NkTAZ1vhTpka24ez1fvVZSfEzP", v4: "14xEx7ctpXzU7LNAeUir6v1x3dYb-xK9E" },
  { body: 2, hook: 5,  base: "B2H5 - Lucas - UGC x Anuncios",  v9: "12Z_MbxIJCgnrfnL610so7IoDYfLT8ghi", v4: "1dUKLkv7muJ8DwsrnDUol-ZUSAIeFozLI" },
  { body: 2, hook: 6,  base: "B2H6 - Lucas - UGC x Anuncios",  v9: "16U9XV1C-6ziHK7Xelg0sFUZ-s4sebA2H", v4: "11oEv2No_krhUtPxr1RAGb0pOB9Oe9M9j" },
  { body: 2, hook: 7,  base: "B2H7 - Lucas - UGC x Anuncios",  v9: "1dcWhLecv4egvVsmNJEoZKBhf3hu_RYh-", v4: "1RBatd7AAwMzsW9Hl04K9e8ppFsWxbyu-" },
  { body: 2, hook: 8,  base: "B2H8 - Lucas - UGC x Anuncios",  v9: "1QqbTqTAudsKfK7XpQU-YgI5pqV3g9pfd", v4: "1_TK2J7IW3S9898_MRXyf1Dczjre0UlOO" },
  { body: 2, hook: 9,  base: "B2H9 - Lucas - UGC x Anuncios",  v9: "17yIjpmRiPDmoeScKpPrw3iQW1rRgm0lL", v4: "1L3i3u9TS9gzrH-ToaSLh-VfgTV0sgi6S" },
  { body: 2, hook: 10, base: "B2H10 - Lucas - UGC x Anuncios", v9: "1jClxyF6ThjfCNDHxwLsRfkhTaQIUY6Hq", v4: "1sgUOWvaQwDU2f4Ocf6sO2yrH-8p4T_CV" },
  { body: 2, hook: 11, base: "B2H11 - Lucas - UGC x Anuncios", v9: "1FPiMr0tbTGz6E0Utcpi4Nt5jF1TqE_zC", v4: "1YkPG6jLwKV_qyAPaY-unf3SbMYetIR0z" },
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

  console.log(`Lote "${LOTE}" · ${HOOKS.length} hooks pareados (b1 h1-h11 + b2 h1-h11)`);
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
    const observacao = `Lote ${LOTE} · Lucas · h${h.hook} b${h.body} c1 · pareado 9x16+4x5 | 9x16: ${link(h.v9)} (${h.v9}) | 4x5: ${link(h.v4)} (${h.v4})`;
    const row = await createCreative({
      nomeDrive: h.base,
      linkDrive: link(h.v9),
      driveFileId: h.v9,
      personagem: "Lucas",
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
