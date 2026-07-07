/**
 * Sobe pro Gerenciador os 12 vídeos do lote "4 - Creators Summit - Creator" (TP1793-1798):
 * 6 hooks pareados (Victor h1-3 + Lucas h1-3), 9x16 + 4x5. Download do Drive → metaUploadVideo
 * (chunked, arquivos GRANDES ~600-760MB). Título no Meta = "<base>_9x16" / "<base>_4x5"
 * (mesmo nome do arquivo do Drive sem extensão — convenção do match estrito).
 * IDEMPOTENTE: descobre o que já existe e pula. Backoff de 5min p/ rate limit.
 *
 *   npx tsx scripts/ads/subir-summit-creator-upload.ts        # DRY (só mostra o plano)
 *   npx tsx scripts/ads/subir-summit-creator-upload.ts --go   # baixa e sobe de verdade
 */
import "dotenv/config";
import { getDriveClient } from "../../server/autoreport/credentials";
import { metaUploadVideo, metaBatch } from "../../server/services/adsCreation/metaApi";
import { findPairedVideosByExactName, withBackoff, type PairTarget } from "../../server/services/adsCreation/lotUploader";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const go = process.argv.includes("--go");
const RL_MAX_RETRIES = 24; // 24 × 5min = 2h de teto p/ atravessar janela de rate limit

interface Hook { persona: string; hook: number; base: string; v9: string; v4: string }
const HOOKS: Hook[] = [
  { persona: "Victor", hook: 1, base: "Summit_Creator_Victor_h1b1c1", v9: "1id4h9wNLTJMouXpoV8IQ--SmFwTEzuNF", v4: "1tOaf1MMP_JfH5kKuw43i5hpaVfExF7AQ" },
  { persona: "Victor", hook: 2, base: "Summit_Creator_Victor_h2b1c1", v9: "1-LmPfAjFzNIqhsFSiezjShqARCiMUZ3q", v4: "1HrRl8lM6N9jXN1t5R7zsy2MFPvBoet-V" },
  { persona: "Victor", hook: 3, base: "Summit_Creator_Victor_h3b1c1", v9: "1JePCwp1LqBIPuwbZDio5SCb0FKkz0WDU", v4: "1dCYZc5JTyCZ0Z5QSWY4K9vH9WdQi7Kqs" },
  { persona: "Lucas", hook: 1, base: "Summit_Creator_Lucas_h1b1c1", v9: "1rD5xjg6b770ISZRbnwzCEorIFqDI0auv", v4: "1KRVkvCyqbQya1Z-FNeAFzaku9KqeC9hL" },
  { persona: "Lucas", hook: 2, base: "Summit_Creator_Lucas_h2b1c1", v9: "1jCMPyo8WT8YNiSMgiQU94OoFMbO278vl", v4: "1-osvrSmen8X9oMsO8P1oC0dgrAjPnQwQ" },
  { persona: "Lucas", hook: 3, base: "Summit_Creator_Lucas_h3b1c1", v9: "1w1MgICMAcZ-gYO5Pzvkf1bAhq1QPo6JP", v4: "1W8ZqbBm2LDniMhejj-kBJSX5QEa-NKD2" },
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
  const targets: PairTarget[] = HOOKS.map((h) => ({ key: `${h.persona}-h${h.hook}`, base: h.base }));
  console.log(`Lote 4 - Creators Summit - Creator · ${HOOKS.length} hooks → ${HOOKS.length * 2} vídeos · conta ${ACC}`);
  console.log(`Descobrindo o que já existe no Gerenciador...`);
  const { pairs, pagesRead } = await findPairedVideosByExactName(ACC, targets, {
    log: (m) => console.log(`   ${m}`),
  });
  console.log(`(advideos: ${pagesRead} página(s) lidas)`);

  type Up = { title: string; driveId: string };
  const toUpload: Up[] = [];
  for (const h of HOOKS) {
    const p = pairs.get(`${h.persona}-h${h.hook}`)!;
    if (!p.v9) toUpload.push({ title: `${h.base}_9x16`, driveId: h.v9 });
    else console.log(`  ↻ já existe: ${h.base}_9x16 (${p.v9})`);
    if (!p.v4) toUpload.push({ title: `${h.base}_4x5`, driveId: h.v4 });
    else console.log(`  ↻ já existe: ${h.base}_4x5 (${p.v4})`);
  }
  console.log(`\nA subir: ${toUpload.length}/${HOOKS.length * 2} vídeos · modo: ${go ? "🔴 SUBIR" : "DRY (não sobe)"}`);
  if (!go) { console.log("(DRY) Rode com --go pra subir."); process.exit(0); }
  if (!toUpload.length) { console.log("Nada a subir — todos já estão no Gerenciador."); process.exit(0); }

  // 2) download → upload, um por vez (arquivos ~600-760MB; chunked cuida do resto)
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
