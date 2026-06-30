/** Checa, pra cada pasta do Drive, se os criativos já estão cadastrados na Biblioteca (planilha). */
import "dotenv/config";
import { getDriveClient } from "../../server/autoreport/credentials";
import { extractFolderId } from "../../server/services/adsCreation/driveLoader";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { inArray } from "drizzle-orm";

const MIME_FOLDER = "application/vnd.google-apps.folder";
const FOLDERS = [
  { label: "Folder 1", url: "1IpU1g7kaQj9_6zM_MFGECsUxA5F3dEoP" },
  { label: "Folder 2", url: "1FB8y5xX_zNhfCiq3l-GGYawNNx3P77Eg" },
];

interface F { id: string; name: string; path: string }
async function walk(folderId: string, prefix = "", depth = 0): Promise<F[]> {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType)",
    pageSize: 1000,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const out: F[] = [];
  for (const f of res.data.files ?? []) {
    if (f.mimeType === MIME_FOLDER) {
      if (depth < 2) out.push(...(await walk(f.id!, `${prefix}${f.name}/`, depth + 1)));
      continue;
    }
    const mt = f.mimeType ?? "";
    if (mt.startsWith("image/") || mt.startsWith("video/") || /\.(heic|heif|mp4|mov)$/i.test(f.name ?? ""))
      out.push({ id: f.id!, name: f.name ?? "?", path: prefix });
  }
  return out;
}

(async () => {
  for (const f of FOLDERS) {
    const id = extractFolderId(f.url);
    let files: F[] = [];
    try {
      files = await walk(id);
    } catch (e) {
      console.log(`\n=== ${f.label} (${id}) === ❌ não consegui ler: ${(e as Error).message}`);
      continue;
    }
    const rows = files.length
      ? await db.select().from(creativesLibrary).where(inArray(creativesLibrary.driveFileId, files.map((x) => x.id)))
      : [];
    const byFile = new Map(rows.map((r) => [r.driveFileId, r]));
    const cadastrados = files.filter((x) => byFile.has(x.id)).length;
    console.log(`\n=== ${f.label} (${id}) — ${files.length} criativo(s) | ${cadastrados} na planilha ===`);
    for (const file of files) {
      const r = byFile.get(file.id);
      console.log(`  ${r ? "✅ " + r.tpId.padEnd(7) : "❌ não cadastrado"} | ${file.path}${file.name}`);
    }
  }
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
