/**
 * Cadastra na Biblioteca (planilha) os 3 criativos da Ana "Super Produção" (Folder 1 do Drive),
 * com TPs SEQUENCIAIS a partir do último (createCreative usa max+1) e na ordem dos hooks (h1,h2,h3).
 * NÃO usa bulkInsertStubs (que preenche buracos e espalha os TPs).
 *
 *   npx tsx subir-superproducao-planilha.ts        # DRY
 *   npx tsx subir-superproducao-planilha.ts --go   # grava
 */
import "dotenv/config";
import { getDriveClient } from "../../server/autoreport/credentials";
import { extractFolderId } from "../../server/services/adsCreation/driveLoader";
import { createCreative } from "../../server/services/adsCreation/creativesRepo";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { inArray } from "drizzle-orm";

const FOLDER = "1IpU1g7kaQj9_6zM_MFGECsUxA5F3dEoP";
const MIME_FOLDER = "application/vnd.google-apps.folder";
const CREATED_BY = process.env.ADS_PIPELINE_CREATED_BY || "ferramentas@turbopartners.com.br";
const go = process.argv.includes("--go");

interface F { id: string; name: string }
async function walk(folderId: string): Promise<F[]> {
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
    if (f.mimeType === MIME_FOLDER) continue;
    const mt = f.mimeType ?? "";
    if (mt.startsWith("image/") || mt.startsWith("video/") || /\.(mp4|mov|heic|heif)$/i.test(f.name ?? ""))
      out.push({ id: f.id!, name: f.name ?? "?" });
  }
  return out;
}

function parseSuper(name: string) {
  return {
    hook: parseInt((name.match(/h(\d+)/i) || [])[1] || "0", 10),
    body: (name.match(/b(\d+)/i) || [])[1] || "",
    cta: (name.match(/c(?:ta)?(\d+)/i) || [])[1] || "",
    fmt: (name.match(/(9x16|4x5|1x1|16x9)/i) || [])[1] || "",
    personagem: (name.match(/_([A-Za-zÀ-ÿ]+)_h\d/i) || [])[1] || "",
  };
}

(async () => {
  const files = await walk(FOLDER);
  const existing = files.length
    ? await db.select({ d: creativesLibrary.driveFileId }).from(creativesLibrary).where(inArray(creativesLibrary.driveFileId, files.map((f) => f.id)))
    : [];
  const existingSet = new Set(existing.map((r) => r.d));
  const toReg = files.filter((f) => !existingSet.has(f.id)).sort((a, b) => parseSuper(a.name).hook - parseSuper(b.name).hook);

  console.log(`Folder 1 — ${files.length} arquivo(s) · ${toReg.length} a cadastrar (na ordem dos hooks):`);
  for (const f of toReg) {
    const p = parseSuper(f.name);
    console.log(`  • ${f.name}  (personagem=${p.personagem} hook=${p.hook} b${p.body} c${p.cta} ${p.fmt})`);
  }
  console.log(`\nmodo: ${go ? "🔴 GRAVAR" : "DRY (não grava)"}`);
  if (!go) {
    console.log("(DRY) rode com --go pra cadastrar (TPs sequenciais a partir do último).");
    process.exit(0);
  }
  if (!toReg.length) {
    console.log("Nada novo — já estão na planilha.");
    process.exit(0);
  }

  for (const f of toReg) {
    const p = parseSuper(f.name);
    const row = await createCreative({
      nomeDrive: f.name.replace(/\.[^.]+$/, ""),
      linkDrive: `https://drive.google.com/file/d/${f.id}/view`,
      driveFileId: f.id,
      personagem: p.personagem,
      tipoAd: "Vídeo",
      observacao: `Tema: Super Produção | Hook ${p.hook}${p.body ? ` | b${p.body}` : ""}${p.cta ? ` c${p.cta}` : ""}${p.fmt ? ` | ${p.fmt}` : ""}`,
      createdBy: CREATED_BY,
    });
    console.log(`  ✅ ${row.tpId} | ${row.nomeFinal}`);
  }
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
