/**
 * Cadastra na Biblioteca os clipes "Natural tech" (Musso / Ichino / Esther) das 2 pastas
 * de editados. SEM estrutura h/b/c e SEM formato 9x16/4x5 — são clipes soltos, então
 * cadastra todos (1 linha por clipe). Persona vem do nome do arquivo, tema da pasta.
 * TP sequencial (max+1). Dedup por driveFileId.
 *
 *   npx tsx subir-naturaltech-planilha.ts        # DRY
 *   npx tsx subir-naturaltech-planilha.ts --go   # grava
 */
import "dotenv/config";
import { getDriveClient } from "../../server/autoreport/credentials";
import { createCreative, generateNextTpId } from "../../server/services/adsCreation/creativesRepo";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { inArray } from "drizzle-orm";

const ROOTS = [
  { id: "1vikXzYagBeq1SV6hoDENVZAHGlsN4N1S", tema: "Natural tech" }, // 57 - Natural tech / 01 - Editados (Musso)
  { id: "1u9t5w_98n0FT8HIu0sKXQTLp8zT62zbi", tema: "Estratégia peculiar natural tech" }, // 56 - ... (Ichino + Esther)
];
const MIME_FOLDER = "application/vnd.google-apps.folder";
const CREATED_BY = process.env.ADS_PIPELINE_CREATED_BY || "ferramentas@turbopartners.com.br";
const go = process.argv.includes("--go");

interface F { id: string; name: string; path: string }
async function walk(id: string, prefix = "", depth = 0): Promise<F[]> {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${id}' in parents and trashed=false`,
    fields: "files(id,name,mimeType)", pageSize: 1000, supportsAllDrives: true, includeItemsFromAllDrives: true,
  });
  const out: F[] = [];
  for (const f of res.data.files ?? []) {
    if (f.mimeType === MIME_FOLDER) {
      if (/c[aâ]mera|ativos|bruto/i.test(f.name ?? "")) continue;
      if (depth < 7) out.push(...(await walk(f.id!, `${prefix}${f.name}/`, depth + 1)));
      continue;
    }
    if ((f.mimeType ?? "").startsWith("video/") || /\.(mp4|mov)$/i.test(f.name ?? "")) out.push({ id: f.id!, name: f.name ?? "?", path: prefix });
  }
  return out;
}

const stripExt = (n: string) => n.replace(/\.[^.]+$/, "");
function parsePersona(name: string): string {
  const m = /vv-natural\s?tech-([a-zà-ú]+)/i.exec(name);
  if (!m) return "?";
  return m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
}

(async () => {
  const collected: { f: F; tema: string }[] = [];
  for (const root of ROOTS) {
    const files = await walk(root.id);
    for (const f of files) collected.push({ f, tema: root.tema });
  }
  // ordena: por tema, depois persona, depois nome
  collected.sort((a, b) =>
    a.tema.localeCompare(b.tema) || parsePersona(a.f.name).localeCompare(parsePersona(b.f.name)) || a.f.name.localeCompare(b.f.name, "pt", { numeric: true }),
  );

  // dedup contra já cadastrados (driveFileId)
  const ids = collected.map((c) => c.f.id);
  const existing = ids.length ? await db.select({ d: creativesLibrary.driveFileId }).from(creativesLibrary).where(inArray(creativesLibrary.driveFileId, ids)) : [];
  const existingSet = new Set(existing.map((r) => r.d));
  const toReg = collected.filter((c) => !existingSet.has(c.f.id));

  const startTp = await generateNextTpId();
  console.log(`Natural tech: ${collected.length} clipe(s) · ${toReg.length} a cadastrar`);
  console.log(`Próximo TP: ${startTp} → até TP${parseInt(startTp.replace("TP", ""), 10) + Math.max(0, toReg.length - 1)}\n`);
  for (const c of toReg) console.log(`  • [${parsePersona(c.f.name)}] ${c.tema}  —  ${c.f.path}${c.f.name}`);
  console.log(`\nmodo: ${go ? "🔴 GRAVAR" : "DRY (não grava)"}`);
  if (!go) { console.log("(DRY) Rode com --go pra cadastrar."); process.exit(0); }
  if (!toReg.length) { console.log("Nada novo — já estão na planilha."); process.exit(0); }

  const out: { tpId: string; nomeFinal: string }[] = [];
  for (const c of toReg) {
    const persona = parsePersona(c.f.name);
    const row = await createCreative({
      nomeDrive: stripExt(c.f.name),
      linkDrive: `https://drive.google.com/file/d/${c.f.id}/view`,
      driveFileId: c.f.id,
      personagem: persona,
      tipoAd: "Vídeo",
      observacao: `Tema: ${c.tema} | Natural tech (sem h/b/c)`,
      createdBy: CREATED_BY,
    });
    out.push({ tpId: row.tpId, nomeFinal: row.nomeFinal });
    console.log(`  ✅ ${row.tpId} | ${row.nomeFinal}  (${persona})`);
  }
  console.log(`\n✅ ${out.length} cadastrados (${out[0].tpId} … ${out[out.length - 1].tpId}).`);
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
