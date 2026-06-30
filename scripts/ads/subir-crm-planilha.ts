/**
 * Cadastra na Biblioteca (planilha) os criativos 9x16 do lote CRM Recompra (Lucas),
 * direto da pasta de editados do Drive. TPs sequenciais (createCreative = max+1, sem gap-fill),
 * na ordem body → cta → hook (todos os hooks de b1c1, depois b1c2, b2c1, b2c2).
 * Só 9x16 entra na planilha (padrão de sempre).
 *
 *   npx tsx subir-crm-planilha.ts        # DRY
 *   npx tsx subir-crm-planilha.ts --go   # grava
 */
import "dotenv/config";
import { getDriveClient } from "../../server/autoreport/credentials";
import { createCreative, generateNextTpId } from "../../server/services/adsCreation/creativesRepo";
import { db } from "../../server/db";
import { creativesLibrary } from "@shared/schema";
import { inArray } from "drizzle-orm";

const ROOT = "10t0p2nJ_n7BfBx9CPFF9OgwwlAEAc8zn"; // CRM (vv-crm-recompra) — brutos & editados
const PERSONAGEM = "Lucas";
const TEMA = "CRM Recompra";
const MIME_FOLDER = "application/vnd.google-apps.folder";
const CREATED_BY = process.env.ADS_PIPELINE_CREATED_BY || "ferramentas@turbopartners.com.br";
const go = process.argv.includes("--go");

interface F { id: string; name: string; path: string }
async function walk(id: string, prefix = "", depth = 0): Promise<F[]> {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${id}' in parents and trashed=false`,
    fields: "files(id,name,mimeType)",
    pageSize: 1000,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const out: F[] = [];
  for (const f of res.data.files ?? []) {
    if (f.mimeType === MIME_FOLDER) {
      if (/c[aâ]mera|ativos|bruto/i.test(f.name ?? "")) continue; // pula brutos
      if (depth < 6) out.push(...(await walk(f.id!, `${prefix}${f.name}/`, depth + 1)));
      continue;
    }
    const mt = f.mimeType ?? "";
    if (mt.startsWith("video/") || /\.(mp4|mov)$/i.test(f.name ?? "")) out.push({ id: f.id!, name: f.name ?? "?", path: prefix });
  }
  return out;
}

const parse = (name: string) => ({
  h: parseInt((name.match(/h(\d+)/i) || [])[1] || "0", 10),
  b: parseInt((name.match(/b(\d+)/i) || [])[1] || "0", 10),
  c: parseInt((name.match(/c(\d+)/i) || [])[1] || "0", 10),
});
const stripExt = (n: string) => n.replace(/\.[^.]+$/, "");

(async () => {
  const all = await walk(ROOT);
  // só 9x16 (padrão da planilha)
  const files = all
    .filter((f) => /9x16/i.test(f.name) || /9x16/i.test(f.path))
    .sort((a, b) => {
      const pa = parse(a.name);
      const pb = parse(b.name);
      return pa.b - pb.b || pa.c - pb.c || pa.h - pb.h; // ordem: body → cta → hook
    });

  // dedup contra já cadastrados (driveFileId)
  const existing = files.length
    ? await db.select({ d: creativesLibrary.driveFileId }).from(creativesLibrary).where(inArray(creativesLibrary.driveFileId, files.map((f) => f.id)))
    : [];
  const existingSet = new Set(existing.map((r) => r.d));
  const toReg = files.filter((f) => !existingSet.has(f.id));

  const startTp = await generateNextTpId();
  console.log(`CRM 9x16 no Drive: ${files.length} arquivo(s) · ${toReg.length} a cadastrar (ordem body→cta→hook)`);
  console.log(`Próximo TP: ${startTp}  →  iria de ${startTp} até TP${parseInt(startTp.replace("TP", ""), 10) + toReg.length - 1}\n`);
  for (const f of toReg) console.log(`  • ${f.name}`);
  console.log(`\nmodo: ${go ? "🔴 GRAVAR" : "DRY (não grava)"}`);
  if (!go) {
    console.log("(DRY) Rode com --go pra cadastrar.");
    process.exit(0);
  }
  if (!toReg.length) {
    console.log("Nada novo — já estão na planilha.");
    process.exit(0);
  }

  const out: { tpId: string; nomeFinal: string }[] = [];
  for (const f of toReg) {
    const p = parse(f.name);
    const row = await createCreative({
      nomeDrive: stripExt(f.name),
      linkDrive: `https://drive.google.com/file/d/${f.id}/view`,
      driveFileId: f.id,
      personagem: PERSONAGEM,
      tipoAd: "Vídeo",
      observacao: `Tema: ${TEMA} | Hook ${p.h} | b${p.b} c${p.c} | 9x16`,
      createdBy: CREATED_BY,
    });
    out.push({ tpId: row.tpId, nomeFinal: row.nomeFinal });
    console.log(`  ✅ ${row.tpId} | ${row.nomeFinal}`);
  }
  console.log(`\n✅ ${out.length} cadastrados (${out[0].tpId} … ${out[out.length - 1].tpId}).`);
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
