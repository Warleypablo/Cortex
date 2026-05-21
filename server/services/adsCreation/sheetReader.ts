/**
 * @deprecated Substituído por `creativesRepo.ts` (cortex_core.creatives_library).
 * Mantido temporariamente como referência do schema da Sheet "Criativos" usada
 * no backfill (`scripts/create-creatives-library-table.ts`). Não é mais consumido
 * pelo orquestrador de criação de campanhas.
 *
 * Estrutura da Sheet "Criativos":
 *   ID | Nome Drive | Angulo | Hook | Corpo | CTA | Etapa do Funil | Data Postagem |
 *   Produto | Plataforma | Personagem | Formato | Tipo de AD | ID Copy | Observação |
 *   Link do Drive | Nome Final | Ad validado? | ...
 */

import { getSheetsClient } from "../../autoreport/credentials";

const SHEET_ID_REGEX = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/;
const TAB_NAME = "Criativos";

export interface CreativeRow {
  id: string;
  nomeDrive: string;
  personagem: string;
  nomeFinal: string;
  linkDoDrive: string;
  formato: string;
  raw: string[];
}

export function extractSpreadsheetId(url: string): string {
  const m = url.match(SHEET_ID_REGEX);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{30,}$/.test(url.trim())) return url.trim();
  throw new Error(`URL do Sheet inválida: ${url}`);
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function extractFileIdFromDriveLink(link: string): string | null {
  const m1 = link.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
}

export async function readCreativesSheet(sheetUrl: string): Promise<CreativeRow[]> {
  const id = extractSpreadsheetId(sheetUrl);
  const sheets = getSheetsClient();
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: id,
    range: `${TAB_NAME}!A1:Z2000`,
  });
  const rows = r.data.values || [];
  if (rows.length < 2) throw new Error(`Aba "${TAB_NAME}" do Sheet está vazia`);

  const headers = (rows[0] || []).map((h) => String(h || "").trim());
  const idx = (label: string) =>
    headers.findIndex((h) => h.toLowerCase() === label.toLowerCase());

  const colId = idx("ID");
  const colNomeDrive = idx("Nome Drive");
  const colPersonagem = idx("Personagem");
  const colNomeFinal = idx("Nome Final");
  const colLink = idx("Link do Drive");
  const colFormato = idx("Formato");

  if (colNomeDrive < 0) throw new Error(`Coluna "Nome Drive" não encontrada no Sheet`);
  if (colNomeFinal < 0) throw new Error(`Coluna "Nome Final" não encontrada no Sheet`);

  const out: CreativeRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const nomeDrive = (r[colNomeDrive] ?? "").trim();
    if (!nomeDrive) continue;
    out.push({
      id: (colId >= 0 ? r[colId] ?? "" : "").trim(),
      nomeDrive,
      personagem: (colPersonagem >= 0 ? r[colPersonagem] ?? "" : "").trim(),
      nomeFinal: (colNomeFinal >= 0 ? r[colNomeFinal] ?? "" : "").trim(),
      linkDoDrive: (colLink >= 0 ? r[colLink] ?? "" : "").trim(),
      formato: (colFormato >= 0 ? r[colFormato] ?? "" : "").trim(),
      raw: r.map((c) => String(c ?? "")),
    });
  }
  return out;
}

export interface MatchedCreative {
  fileName: string;
  fileId: string;
  row: CreativeRow;
}

/**
 * Faz match entre arquivos do Drive e linhas do Sheet.
 * Estratégia: 1) por File ID extraído do Link do Drive; 2) por filename (sem extensão).
 */
export function matchDriveFilesToRows(
  driveFiles: { id: string; name: string }[],
  rows: CreativeRow[],
): { matched: MatchedCreative[]; unmatchedFiles: string[] } {
  const matched: MatchedCreative[] = [];
  const unmatchedFiles: string[] = [];

  // Index pelo File ID e pelo nome normalizado
  const byFileId = new Map<string, CreativeRow>();
  const byName = new Map<string, CreativeRow>();
  for (const row of rows) {
    if (row.linkDoDrive) {
      const fid = extractFileIdFromDriveLink(row.linkDoDrive);
      if (fid) byFileId.set(fid, row);
    }
    if (row.nomeDrive) {
      byName.set(normalizeName(row.nomeDrive), row);
    }
  }

  for (const f of driveFiles) {
    let row = byFileId.get(f.id);
    if (!row) {
      const nameWithoutExt = normalizeName(stripExtension(f.name));
      row = byName.get(nameWithoutExt);
    }
    if (!row) {
      unmatchedFiles.push(f.name);
      continue;
    }
    matched.push({ fileName: f.name, fileId: f.id, row });
  }

  return { matched, unmatchedFiles };
}
