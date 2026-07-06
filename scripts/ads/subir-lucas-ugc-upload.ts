/**
 * Sobe pro Gerenciador os 44 vídeos do lote "Lucas - UGC x Anuncios" (TP1771-1792):
 * 22 hooks pareados (b1/b2 × h1-h11), 9x16 + 4x5. Download do Drive → metaUploadVideo
 * (chunked, arquivos ~110-125MB). Título no Meta = "<base>_9x16" / "<base>_4x5" (convenção
 * do match estrito do lotUploader). IDEMPOTENTE: descobre o que já existe e pula.
 * Aguenta rate limit: backoff de 5min com teto alto.
 *
 *   npx tsx scripts/ads/subir-lucas-ugc-upload.ts        # DRY (só mostra o plano)
 *   npx tsx scripts/ads/subir-lucas-ugc-upload.ts --go   # baixa e sobe de verdade
 */
import "dotenv/config";
import { getDriveClient } from "../../server/autoreport/credentials";
import { metaUploadVideo, metaBatch } from "../../server/services/adsCreation/metaApi";
import { findPairedVideosByExactName, withBackoff, type PairTarget } from "../../server/services/adsCreation/lotUploader";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const go = process.argv.includes("--go");
const RL_MAX_RETRIES = 24; // 24 × 5min = 2h de teto p/ atravessar janela de rate limit

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

async function downloadDrive(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(res.data as ArrayBuffer);
}

(async () => {
  if (!ACC) throw new Error("META_DEFAULT_AD_ACCOUNT_ID não setado");
  const t0 = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 60000).toFixed(1)}min`;

  // 1) o que já existe no Gerenciador (idempotência / retomada)
  const targets: PairTarget[] = HOOKS.map((h) => ({ key: `b${h.body}h${h.hook}`, base: h.base }));
  console.log(`Lote Lucas UGC x Anuncios · ${HOOKS.length} hooks → ${HOOKS.length * 2} vídeos · conta ${ACC}`);
  console.log(`Descobrindo o que já existe no Gerenciador...`);
  const { pairs, pagesRead } = await findPairedVideosByExactName(ACC, targets, {
    log: (m) => console.log(`   ${m}`),
  });
  console.log(`(advideos: ${pagesRead} página(s) lidas)`);

  type Up = { title: string; driveId: string };
  const toUpload: Up[] = [];
  for (const h of HOOKS) {
    const p = pairs.get(`b${h.body}h${h.hook}`)!;
    if (!p.v9) toUpload.push({ title: `${h.base}_9x16`, driveId: h.v9 });
    else console.log(`  ↻ já existe: ${h.base}_9x16 (${p.v9})`);
    if (!p.v4) toUpload.push({ title: `${h.base}_4x5`, driveId: h.v4 });
    else console.log(`  ↻ já existe: ${h.base}_4x5 (${p.v4})`);
  }
  console.log(`\nA subir: ${toUpload.length}/${HOOKS.length * 2} vídeos · modo: ${go ? "🔴 SUBIR" : "DRY (não sobe)"}`);
  if (!go) { console.log("(DRY) Rode com --go pra subir."); process.exit(0); }
  if (!toUpload.length) { console.log("Nada a subir — todos já estão no Gerenciador."); process.exit(0); }

  // 2) download → upload, um por vez (arquivos grandes; chunked cuida do resto)
  const uploaded: { title: string; videoId: string }[] = [];
  const failed: string[] = [];
  for (let i = 0; i < toUpload.length; i++) {
    const u = toUpload[i];
    try {
      console.log(`\n[${i + 1}/${toUpload.length}] ⬇️  ${u.title} (drive ${u.driveId.slice(0, 8)}…) — ${elapsed()}`);
      const buffer = await downloadDrive(u.driveId);
      console.log(`   ${(buffer.length / 1024 / 1024).toFixed(1)}MB baixados · ⬆️  subindo...`);
      const videoId = await withBackoff(`upload ${u.title}`, () => metaUploadVideo(ACC, `${u.title}.mp4`, buffer), {
        max: RL_MAX_RETRIES,
        log: (m) => console.log(`   ${m}`),
      });
      uploaded.push({ title: u.title, videoId });
      console.log(`   ✅ video_id=${videoId}`);
    } catch (e) {
      failed.push(`${u.title}: ${e instanceof Error ? e.message : e}`);
      console.log(`   ⛔ FALHOU: ${e instanceof Error ? e.message : e}`);
    }
  }

  // 3) status final em 1 batch (sem poll individual pra poupar quota)
  if (uploaded.length) {
    try {
      const res = await withBackoff("batch status", () =>
        metaBatch(uploaded.map((u) => ({ method: "GET" as const, relative_url: `${u.videoId}?fields=id,status` }))),
      );
      console.log(`\nStatus dos vídeos subidos nesse run:`);
      res.forEach((r: any, i: number) => {
        const body = typeof r?.body === "string" ? JSON.parse(r.body) : r?.body;
        console.log(`  ${uploaded[i].title} → ${body?.status?.video_status ?? JSON.stringify(body?.status) ?? "?"}`);
      });
    } catch (e) {
      console.log(`(status batch falhou — sem drama, o Gerenciador processa sozinho: ${e instanceof Error ? e.message : e})`);
    }
  }

  console.log(`\nResumo: ${uploaded.length} subido(s) · ${failed.length} falha(s) · total ${elapsed()}`);
  if (failed.length) { console.log(failed.map((f) => `  ⛔ ${f}`).join("\n")); process.exit(1); }
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });
