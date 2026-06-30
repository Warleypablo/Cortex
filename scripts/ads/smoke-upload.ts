/**
 * Smoke test do metaUploadVideo ponta-a-ponta: baixa 1 vídeo do Drive → sobe pro Gerenciador
 * → espera processar (pollVideoUntilReady) → confirma status/thumb. Sobe NADA de ad (só o vídeo).
 *
 *   npx tsx smoke-upload.ts            # DRY (não baixa, não sobe)
 *   npx tsx smoke-upload.ts --go       # baixa do Drive e sobe de verdade
 *   npx tsx smoke-upload.ts --go --cleanup   # idem + deleta o vídeo de teste no fim
 *   npx tsx smoke-upload.ts --go <driveFileId>
 */
import "dotenv/config";
import { getDriveClient } from "../../server/autoreport/credentials";
import { metaUploadVideo, pollVideoUntilReady, getVideoThumbnail, metaGet, metaBatch } from "../../server/services/adsCreation/metaApi";

const ACC = process.env.META_DEFAULT_AD_ACCOUNT_ID!;
const go = process.argv.includes("--go");
const cleanup = process.argv.includes("--cleanup");
// TP1693 - vv-naturaltech-esther-1 (vídeo real já validado no Drive). Override por arg posicional.
const DRIVE_FILE_ID = process.argv.slice(2).find((a) => !a.startsWith("--")) || "1zOsUMIeSBm-EzZ5ix6c3QGg6NyY1AxIe";

async function downloadDrive(fileId: string): Promise<{ name: string; buffer: Buffer; size: number }> {
  const drive = getDriveClient();
  const meta = await drive.files.get({ fileId, fields: "name,size,mimeType", supportsAllDrives: true });
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  const buffer = Buffer.from(res.data as ArrayBuffer);
  return { name: (meta.data.name as string) ?? `${fileId}.mp4`, buffer, size: Number(meta.data.size ?? buffer.length) };
}

(async () => {
  console.log(`Smoke test metaUploadVideo · conta ${ACC} · driveFileId ${DRIVE_FILE_ID}`);
  if (!ACC) throw new Error("META_DEFAULT_AD_ACCOUNT_ID não setado");
  if (!go) { console.log("(DRY) Rode com --go pra baixar do Drive e subir de verdade."); process.exit(0); }

  console.log("⬇️  baixando do Drive...");
  const { name, buffer } = await downloadDrive(DRIVE_FILE_ID);
  const testName = `SMOKE-TEST-${name}`;
  console.log(`   ${name} → ${(buffer.length / 1024 / 1024).toFixed(1)}MB · subindo como "${testName}"`);

  console.log("⬆️  metaUploadVideo...");
  const t0 = Date.now();
  const videoId = await metaUploadVideo(ACC, testName, buffer);
  console.log(`   ✅ upload retornou video_id=${videoId} (${((Date.now() - t0) / 1000).toFixed(0)}s) — aguardando processar...`);

  await pollVideoUntilReady(videoId, { maxWaitMs: 300_000 });
  const info = await metaGet(videoId, { fields: "id,title,status,created_time,length" });
  const thumb = await getVideoThumbnail(videoId);
  console.log(`\n✅ READY · id=${info.id} · title="${info.title}" · status=${JSON.stringify(info.status)} · thumb=${thumb ? "ok" : "—"}`);
  console.log(`   Gerenciador → Mídia/Vídeos da conta ${ACC} (procure "${testName}")`);

  if (cleanup) {
    const del = await metaBatch([{ method: "DELETE", relative_url: videoId }]);
    console.log(`🗑️  cleanup: ${JSON.stringify(del[0]?.body ?? del[0])}`);
  } else {
    console.log(`ℹ️  vídeo de teste mantido. Pra remover: npx tsx smoke-upload.ts --go --cleanup ${DRIVE_FILE_ID}  (ou delete na UI)`);
  }
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e instanceof Error ? e.message : e); process.exit(1); });
