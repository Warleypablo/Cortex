/**
 * "Preencher a planilha" — cadastra na Biblioteca de Criativos
 * (cortex_core.creatives_library) todos os criativos de uma pasta do Drive.
 *
 * Mesmo esquema do fluxo /preview-drive, mas standalone e tolerante a nomes fora da
 * convenção: o que não casa com {tipo}-{nomeAd}-{personagem}-{formato}-v{NN} entra como
 * stub mínimo (nomeDrive + link + driveFileId + TP/nome_final automáticos).
 *
 *   npx tsx subir-planilha-drive.ts <folderUrlOrId>          # DRY: lista e mostra o plano (não grava)
 *   npx tsx subir-planilha-drive.ts <folderUrlOrId> --go     # grava de verdade na Biblioteca
 *
 * A pasta precisa estar compartilhada (Leitor) com a Service Account do .env:
 *   report-job-sa@auto-report-turbo.iam.gserviceaccount.com
 */
import "dotenv/config";
import { getDriveClient } from "./server/autoreport/credentials";
import { extractFolderId } from "./server/services/adsCreation/driveLoader";
import {
  parseFileNameConvention,
  bulkInsertStubs,
  type CreateCreativeInput,
} from "./server/services/adsCreation/creativesRepo";
import { db } from "./server/db";
import { creativesLibrary } from "@shared/schema";
import { inArray } from "drizzle-orm";

const MIME_FOLDER = "application/vnd.google-apps.folder";
const CREATED_BY = process.env.ADS_PIPELINE_CREATED_BY || "ferramentas@turbopartners.com.br";

interface Found {
  id: string;
  name: string;
  mimeType: string;
  path: string;
}

/** Caminha a pasta (e até 2 níveis de subpastas) coletando arquivos de mídia. */
async function walk(folderId: string, prefix = "", depth = 0): Promise<Found[]> {
  const drive = getDriveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType)",
    pageSize: 1000,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const out: Found[] = [];
  for (const f of res.data.files ?? []) {
    if (f.mimeType === MIME_FOLDER) {
      if (depth < 2) out.push(...(await walk(f.id!, `${prefix}${f.name}/`, depth + 1)));
      continue;
    }
    const mt = f.mimeType ?? "";
    const isMedia = mt.startsWith("image/") || mt.startsWith("video/") || /\.(heic|heif|mp4|mov)$/i.test(f.name ?? "");
    if (isMedia) out.push({ id: f.id!, name: f.name ?? "untitled", mimeType: mt, path: prefix });
  }
  return out;
}

const stripExt = (n: string): string => n.replace(/\.[^.]+$/, "");
function tipoLabel(t: string | undefined, mime: string): string | null {
  if (t === "vv") return "Vídeo";
  if (t === "img") return "Imagem";
  if (t === "car") return "Carrossel";
  if (mime.startsWith("video/")) return "Vídeo";
  if (mime.startsWith("image/")) return "Imagem";
  return null;
}

/**
 * Parser tolerante p/ nomes fora da convenção estrita.
 * Ex: "Estartegia_peculiar_Ana_Hook2 - V4_9x16" → {personagem:"Ana", hook:2, formato:"9x16", tema:"Estartegia peculiar"}.
 */
function looseParse(name: string): {
  personagem: string | null;
  hook: number | null;
  formato: string | null;
  tema: string | null;
} {
  const base = stripExt(name);
  const hookM = base.match(/hook\s*[-_ ]?(\d+)/i);
  const fmtM = base.match(/(9x16|4x5|1x1|16x9)/i);
  // personagem = token alfabético logo antes de "Hook"; tema = o que vem antes dele
  let personagem: string | null = null;
  let tema: string | null = null;
  const pm = base.match(/^(.*?)[_\s-]+([A-Za-zÀ-ÿ]+)[_\s-]+hook/i);
  if (pm) {
    tema = pm[1].replace(/[_]+/g, " ").trim() || null;
    personagem = pm[2];
  }
  return { personagem, hook: hookM ? parseInt(hookM[1], 10) : null, formato: fmtM ? fmtM[1] : null, tema };
}

(async () => {
  const arg = process.argv[2];
  const go = process.argv.includes("--go");
  if (!arg) {
    console.error("uso: npx tsx subir-planilha-drive.ts <folderUrlOrId> [--go]");
    process.exit(1);
  }
  const folderId = extractFolderId(arg);

  console.log(`\n📁 Pasta ${folderId}  |  modo: ${go ? "🔴 GRAVAR na Biblioteca" : "DRY (não grava nada)"}`);
  let files: Found[];
  try {
    files = await walk(folderId);
  } catch (e) {
    console.error(`\n❌ Não consegui ler a pasta: ${(e as Error).message}`);
    console.error(`   → Compartilhe a pasta (Leitor) com a Service Account:`);
    console.error(`     report-job-sa@auto-report-turbo.iam.gserviceaccount.com`);
    process.exit(1);
  }
  if (!files.length) {
    console.log("Nenhum arquivo de mídia encontrado (nem em subpastas).");
    process.exit(0);
  }

  // dedup preview (por driveFileId já cadastrado)
  const existing = await db
    .select({ d: creativesLibrary.driveFileId })
    .from(creativesLibrary)
    .where(inArray(creativesLibrary.driveFileId, files.map((f) => f.id)));
  const existingSet = new Set(existing.map((r) => r.d));

  const stubs: CreateCreativeInput[] = [];
  console.log(`\nAchei ${files.length} criativo(s):\n`);
  for (const f of files) {
    const parsed = parseFileNameConvention(f.name);
    const loose = parsed ? null : looseParse(f.name);
    const personagem = parsed?.personagem ?? loose?.personagem ?? null;
    const formato = parsed?.formato ?? loose?.formato ?? null;
    const obsParts = [
      loose?.tema && `Tema: ${loose.tema}`,
      loose?.hook != null && `Hook ${loose.hook}`,
      formato,
      f.path && `Pasta: ${f.path}`,
    ].filter(Boolean) as string[];
    const dup = existingSet.has(f.id);
    if (!dup) {
      stubs.push({
        nomeDrive: stripExt(f.name),
        linkDrive: `https://drive.google.com/file/d/${f.id}/view`,
        driveFileId: f.id,
        personagem,
        tipoAd: tipoLabel(parsed?.tipo, f.mimeType),
        observacao: obsParts.length ? obsParts.join(" | ") : null,
        createdBy: CREATED_BY,
      });
    }
    console.log(`  ${dup ? "⏭  já existe" : "🆕 novo     "} | ${f.path}${f.name}`);
    console.log(
      `               ${
        parsed
          ? `convenção OK: tipo=${parsed.tipo} personagem=${parsed.personagem} formato=${parsed.formato}`
          : `solto → personagem=${personagem ?? "?"}${loose?.hook != null ? ` hook=${loose.hook}` : ""}${formato ? ` ${formato}` : ""}`
      }`,
    );
  }

  console.log(`\nResumo: ${files.length} na pasta · ${stubs.length} novo(s) · ${files.length - stubs.length} já cadastrado(s).`);

  if (!go) {
    console.log(`\n(DRY) Nada gravado. Rode com --go pra cadastrar os ${stubs.length} novo(s).`);
    process.exit(0);
  }
  if (!stubs.length) {
    console.log("\nNada novo pra cadastrar.");
    process.exit(0);
  }

  const inserted = await bulkInsertStubs(stubs, CREATED_BY);
  console.log(`\n✅ Cadastrados ${inserted.length} na Biblioteca:`);
  for (const r of inserted) console.log(`   ${r.tpId}  |  ${r.nomeFinal}`);
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e instanceof Error ? e.message : e);
  process.exit(1);
});
