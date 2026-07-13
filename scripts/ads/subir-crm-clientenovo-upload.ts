/**
 * Passo 2/3 — Sobe pro Gerenciador os 36 vídeos do lote "Cliente Novo x Cliente da Base"
 * (Lucas, CRM): cada par vira 2 vídeos — `${base}_9x16` e `${base}_4x5`.
 * Download do Drive → metaUploadVideo (chunked). IDEMPOTENTE: descobre por nome EXATO o que já
 * existe e pula. Backoff de 5min p/ rate limit.
 *
 *   npx tsx scripts/ads/subir-crm-clientenovo-upload.ts        # DRY (só mostra o plano)
 *   npx tsx scripts/ads/subir-crm-clientenovo-upload.ts --go   # baixa e sobe de verdade
 */
import "dotenv/config";
import { getDriveClient } from "../../server/autoreport/credentials";
import { metaGet, metaUploadVideo, metaBatch } from "../../server/services/adsCreation/metaApi";
import { withBackoff, normName } from "../../server/services/adsCreation/lotUploader";
import { PAIRS, LOTE, metaTitle9, metaTitle4 } from "./crm-clientenovo.data";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const go = process.argv.includes("--go");
const RL_MAX_RETRIES = 24; // 24 × 5min = 2h de teto
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// erro flaky/transiente de upload de vídeo (não é rate-limit): vale re-tentar com o MESMO buffer (sem re-baixar)
const isTransientUpload = (e: unknown) => /problem uploading your video|request timeout|timed out|ETIMEDOUT|ECONNRESET|socket hang up/i.test(e instanceof Error ? e.message : String(e));

// achata os 36 vídeos (9x16 + 4x5 por par)
const ITEMS = PAIRS.flatMap((p) => [
  { title: metaTitle9(p.base), driveId: p.drive9x16 },
  { title: metaTitle4(p.base), driveId: p.drive4x5 },
]);

async function downloadDrive(fileId: string): Promise<Buffer> {
  const drive = getDriveClient();
  const res = await drive.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
  return Buffer.from(res.data as ArrayBuffer);
}

(async () => {
  if (!ACC) throw new Error("META_DEFAULT_AD_ACCOUNT_ID não setado");
  const t0 = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 60000).toFixed(1)}min`;

  const want = new Map<string, (typeof ITEMS)[number]>();
  for (const it of ITEMS) want.set(normName(it.title), it);

  console.log(`Lote "${LOTE}" · ${ITEMS.length} vídeos (${PAIRS.length} pares 9x16+4x5) · conta ${ACC}`);
  console.log(`Descobrindo o que já existe no Gerenciador...`);
  const found = new Set<string>();
  let url: string | null = `${ACC}/advideos`;
  let params: Record<string, string> | undefined = { fields: "id,title", limit: "200" };
  let pages = 0;
  for (; url && pages < 40; pages++) {
    const res: any = await withBackoff("GET advideos", () => metaGet(url!, params), { max: RL_MAX_RETRIES, log: (m) => console.log(`   ${m}`) });
    for (const v of res.data ?? []) { const k = normName(v.title ?? ""); if (k && want.has(k)) found.add(k); }
    if (found.size >= want.size) { pages++; break; }
    const after = res.paging?.cursors?.after;
    if (after && res.data?.length) params = { fields: "id,title", limit: "200", after }; else url = null;
  }
  console.log(`(advideos: ${pages} página(s) · já existem ${found.size}/${want.size})`);

  const toUpload = ITEMS.filter((it) => !found.has(normName(it.title)));
  console.log(`\nA subir: ${toUpload.length}/${ITEMS.length} vídeos · modo: ${go ? "🔴 SUBIR" : "DRY (não sobe)"}`);
  if (!go) { console.log("(DRY) Rode com --go pra subir."); process.exit(0); }
  if (!toUpload.length) { console.log("Nada a subir — todos já estão no Gerenciador."); process.exit(0); }

  const uploaded: { title: string; videoId: string }[] = [];
  const failed: string[] = [];
  for (let i = 0; i < toUpload.length; i++) {
    const it = toUpload[i];
    try {
      console.log(`\n[${i + 1}/${toUpload.length}] ⬇️  ${it.title} (drive ${it.driveId.slice(0, 8)}…) — ${elapsed()}`);
      const buffer = await downloadDrive(it.driveId);
      console.log(`   ${(buffer.length / 1024 / 1024).toFixed(1)}MB baixados · ⬆️  subindo...`);
      let videoId: string | undefined;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          videoId = await withBackoff(`upload ${it.title}`, () => metaUploadVideo(ACC, `${it.title}.mp4`, buffer), { max: RL_MAX_RETRIES, log: (m) => console.log(`   ${m}`) });
          break;
        } catch (e) {
          if (attempt < 3 && isTransientUpload(e)) { console.log(`   ⏳ upload flaky — retry ${attempt}/2 em 12s (${(e instanceof Error ? e.message : String(e)).slice(0, 50)})`); await sleep(12000); continue; }
          throw e;
        }
      }
      uploaded.push({ title: it.title, videoId: videoId! });
      console.log(`   ✅ video_id=${videoId}`);
    } catch (e) {
      failed.push(`${it.title}: ${e instanceof Error ? e.message : e}`);
      console.log(`   ⛔ FALHOU: ${e instanceof Error ? e.message : e}`);
    }
  }

  if (uploaded.length) {
    try {
      const res = await withBackoff("batch status", () => metaBatch(uploaded.map((u) => ({ method: "GET" as const, relative_url: `${u.videoId}?fields=id,status` }))));
      console.log(`\nStatus dos vídeos subidos nesse run:`);
      res.forEach((r: any, i: number) => {
        const body = typeof r?.body === "string" ? JSON.parse(r.body) : r?.body;
        console.log(`  ${uploaded[i].title} → ${body?.status?.video_status ?? JSON.stringify(body?.status) ?? "?"}`);
      });
    } catch (e) { console.log(`(status batch falhou — sem drama: ${e instanceof Error ? e.message : e})`); }
  }

  console.log(`\nResumo: ${uploaded.length} subido(s) · ${failed.length} falha(s) · total ${elapsed()}`);
  if (failed.length) { console.log(failed.map((f) => `  ⛔ ${f}`).join("\n")); process.exit(1); }
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });
