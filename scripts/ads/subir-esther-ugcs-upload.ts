/**
 * Sobe pro Gerenciador os 40 vídeos do lote "Esther - UGCs x Anuncios" (TP1751-1770):
 * 20 hooks pareados (b1/b2 × h1-h10), 9x16 + 4x5. Download do Drive → metaUploadVideo
 * (chunked, arquivos ~110-140MB). Título no Meta = "<base>_9x16" / "<base>_4x5" (convenção
 * do match estrito do lotUploader). IDEMPOTENTE: descobre o que já existe e pula.
 * Aguenta rate limit: backoff de 5min com teto alto (a conta pode estar saturada no início).
 *
 *   npx tsx scripts/ads/subir-esther-ugcs-upload.ts        # DRY (só mostra o plano)
 *   npx tsx scripts/ads/subir-esther-ugcs-upload.ts --go   # baixa e sobe de verdade
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
  console.log(`Lote Esther UGCs x Anuncios · ${HOOKS.length} hooks → ${HOOKS.length * 2} vídeos · conta ${ACC}`);
  console.log(`Descobrindo o que já existe no Gerenciador...`);
  const { pairs, pagesRead } = await findPairedVideosByExactName(ACC, targets, {
    log: (m) => console.log(`   ${m}`),
  });
  console.log(`(advideos: ${pagesRead} página(s) lidas)`);

  type Up = { title: string; driveId: string; mb?: number };
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
