/**
 * Repositório da Biblioteca de Criativos da Turbo.
 *
 * Substitui `sheetReader.ts` como fonte de verdade para Nome Final / Personagem / Formato dos ads.
 * A interface `CreativeRow` é compatível com a do sheetReader pra `creator.ts` poder trocar
 * sem refator profundo.
 */

import { and, eq, isNull, ilike, or, sql, inArray } from "drizzle-orm";
import { db, pool } from "../../db";
import { creativesLibrary, type CreativeLibraryItem, type InsertCreativeLibraryItem } from "@shared/schema";

// snake_case (vindo do pg cru) → camelCase (formato CreativeLibraryItem)
function rowToCamel(row: Record<string, any>): any {
  const out: Record<string, any> = {};
  for (const k in row) out[k.replace(/_([a-z])/g, (_m, c) => c.toUpperCase())] = row[k];
  return out;
}

// ============== Tipos compatíveis com sheetReader (não quebra creator.ts) ==============
export interface CreativeRow {
  id: string; // = tpId
  nomeDrive: string;
  personagem: string;
  nomeFinal: string;
  linkDoDrive: string;
  raw: string[]; // raw vai vazio — não tem mais "linha bruta"
}

export interface MatchedCreative {
  fileName: string;
  fileId: string;
  row: CreativeRow;
}

function rowToCreativeRow(r: CreativeLibraryItem): CreativeRow {
  return {
    id: r.tpId,
    nomeDrive: r.nomeDrive,
    personagem: r.personagem ?? "",
    nomeFinal: r.nomeFinal,
    linkDoDrive: r.linkDrive ?? "",
    raw: [],
  };
}

// ============== Helpers de fórmula ==============

function formatBrDate(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(d.getUTCFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

export function buildNomeFinal(input: {
  tpId: string;
  nomeDrive: string;
  dataPostagem?: string | Date | null;
}): string {
  const parts = [
    input.tpId,
    input.nomeDrive,
    formatBrDate(input.dataPostagem),
  ].filter(Boolean);
  return parts.join(" - ");
}

function makeTpId(seq: number): string {
  return `TP${String(seq).padStart(2, "0")}`;
}

export async function generateNextTpId(): Promise<string> {
  // NB: usar [0-9] em vez de \d — dentro do template literal `sql`...`` o JS
  // colapsa "\d" para "d", o que gera a regex inválida ^TP(d+)$ (casa zero linhas)
  // e fazia esta função retornar sempre TP01.
  const r = await db.execute(sql`
    SELECT MAX(CAST(SUBSTRING(tp_id FROM '^TP([0-9]+)$') AS INTEGER)) AS max_seq
    FROM cortex_core.creatives_library
    WHERE tp_id ~ '^TP[0-9]+$'
  `);
  const row = (r as any).rows?.[0] ?? (r as any)[0];
  const max = Number(row?.max_seq ?? 0) || 0;
  return makeTpId(max + 1);
}

// ============== Drive helpers ==============

function extractFileIdFromDriveLink(link: string): string | null {
  if (!link) return null;
  const m1 = link.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

// ============== Parser da convenção de nome de arquivo ==============
// Padrão POSICIONAL (campos separados por "-", valores compostos com "_"):
//   {tipo}-{nomeAd}-{formato}-{angulo}-{persona}-{proporção}-{h#_b#_c#}-v{NN}
//   vv-bastidores_ana-react-prova_social-ana-9x16-h1_b1_c1-v1.mp4
// - tipo: vv|img|car · proporção: 9x16|4x5|1x1|16x9 · bloco h/b/c: hook obrig., body/cta opcionais
// - ângulo é o ÂNGULO DO HOOK; vem direto do nome (o h# fica de identificador/backup)
// - "_" → espaço (nomeAd/persona) ou "-" (slug de vocabulário: formato/angulo)

export interface ParsedConvention {
  tipo: "vv" | "img" | "car";
  nomeAd: string;
  produto: string | null;   // creators, ecommerce, estruturacao
  formato: string | null;   // formato de ad (react, caixinha-de-perguntas)
  angulo: string | null;    // ângulo do hook (prova-social)
  personagem: string;
  proporcao: "9x16" | "4x5" | "1x1" | "16x9";
  hookCode?: string; // "h1"
  bodyCode?: string; // "b1"
  ctaCode?: string;  // "c1"
  variacao: string;  // "v1"
}

const VALID_EXT = /\.(mp4|mov|jpg|jpeg|png)$/i;
const PROPORCOES = ["9x16", "4x5", "1x1", "16x9"];
const toSpace = (s: string) => s.replace(/_/g, " ").trim();   // nomeAd, persona
const toSlug = (s: string) => s.replace(/_/g, "-").trim();    // vocab (produto, formato, angulo)

// Núcleo: parseia a string da convenção já sem extensão e minúscula.
// Ordem: {tipo}-{nomead}-{produto}-{formato}-{angulo}-{persona}-{proporção}-{h#_b#_c#}-v{N}
function parseConventionParts(base: string): ParsedConvention | null {
  const parts = base.split("-");

  const tipo = parts[0];
  if (tipo !== "vv" && tipo !== "img" && tipo !== "car") return null;

  const mVar = parts[parts.length - 1].match(/^v(\d{1,2})$/);
  if (!mVar) return null;
  const variacao = `v${mVar[1]}`;

  const block = parts[parts.length - 2];
  if (!/^h\d/.test(block)) return null;
  let hookCode: string | undefined, bodyCode: string | undefined, ctaCode: string | undefined;
  for (const code of block.split("_")) {
    const mh = code.match(/^h(\d{1,2})$/); if (mh) { hookCode = `h${mh[1]}`; continue; }
    const mb = code.match(/^b(\d{1,2})$/); if (mb) { bodyCode = `b${mb[1]}`; continue; }
    const mc = code.match(/^c(?:ta)?(\d{1,2})$/); if (mc) { ctaCode = `c${mc[1]}`; continue; }
  }

  const proporcao = parts[parts.length - 3];
  if (!PROPORCOES.includes(proporcao)) return null;

  // Campos da frente: [nomeAd, produto, formato, angulo, persona] — pela cauda;
  // o resto (inclui hífen acidental no nomeAd) vira nomeAd.
  const front = parts.slice(1, parts.length - 3);
  if (front.length < 5) return null;
  const personagem = front[front.length - 1];
  const angulo = front[front.length - 2];
  const formato = front[front.length - 3];
  const produto = front[front.length - 4];
  const nomeAd = front.slice(0, front.length - 4).join("-");

  return {
    tipo,
    nomeAd: toSpace(nomeAd),
    produto: produto ? toSlug(produto) : null,
    formato: formato ? toSlug(formato) : null,
    angulo: angulo ? toSlug(angulo) : null,
    personagem: toSpace(personagem),
    proporcao: proporcao as ParsedConvention["proporcao"],
    hookCode, bodyCode, ctaCode,
    variacao,
  };
}

/** Parseia o nome de um ARQUIVO (com extensão). */
export function parseFileNameConvention(filename: string): ParsedConvention | null {
  if (!filename || !VALID_EXT.test(filename)) return null;
  return parseConventionParts(filename.replace(VALID_EXT, "").toLowerCase());
}

/**
 * Extrai a convenção de DENTRO do nome do anúncio do Meta e parseia.
 * O Nome Final é `TP## - {convenção} - {data}`; ads manuais podem ter só a convenção.
 * Cobre os dois caminhos (Cortex e manual) → o sync usa isto pra popular a Biblioteca.
 */
export function parseConventionFromAdName(adName: string): ParsedConvention | null {
  if (!adName) return null;
  const m = adName.toLowerCase().match(/(?:vv|img|car)(?:-[a-z0-9_]+)+-v\d{1,2}/);
  return m ? parseConventionParts(m[0]) : null;
}

/** A string canônica da convenção (= nomeDrive), extraída do nome do ad. */
export function extractConventionString(adName: string): string | null {
  if (!adName) return null;
  const m = adName.toLowerCase().match(/(?:vv|img|car)(?:-[a-z0-9_]+)+-v\d{1,2}/);
  return m ? m[0] : null;
}

// ============== Listagem / busca ==============

export interface ListFilters {
  q?: string;
  personagem?: string;
  produto?: string;
  etapaFunil?: string;
  adValidado?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ListResult {
  rows: CreativeLibraryItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listCreatives(filters: ListFilters = {}): Promise<ListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 50));

  const conds = [isNull(creativesLibrary.deletedAt)];
  if (filters.q) {
    const q = `%${filters.q}%`;
    conds.push(
      or(
        ilike(creativesLibrary.nomeDrive, q),
        ilike(creativesLibrary.tpId, q),
        ilike(creativesLibrary.nomeFinal, q),
        ilike(creativesLibrary.personagem, q),
      )!,
    );
  }
  if (filters.personagem) conds.push(eq(creativesLibrary.personagem, filters.personagem));
  if (filters.produto) conds.push(eq(creativesLibrary.produto, filters.produto));
  if (filters.etapaFunil) conds.push(eq(creativesLibrary.etapaFunil, filters.etapaFunil));
  if (typeof filters.adValidado === "boolean")
    conds.push(eq(creativesLibrary.adValidado, filters.adValidado));

  const where = and(...conds);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(creativesLibrary)
    .where(where);

  const rows = await db
    .select()
    .from(creativesLibrary)
    .where(where)
    // Ordena por TP numérico (decrescente — mais novo primeiro), igual à lógica da planilha.
    // createdAt embaralha porque a migração inseriu tudo no mesmo instante.
    .orderBy(sql`CAST(SUBSTRING(${creativesLibrary.tpId} FROM '^TP([0-9]+)$') AS INTEGER) DESC NULLS LAST`)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return { rows, total: Number(count) || 0, page, pageSize };
}

/**
 * Variante "Só com investimento": lista apenas criativos que tiveram spend > 0 na janela,
 * ordenados por gasto (maior primeiro). Mantém os mesmos filtros (q/persona/produto/validado)
 * e o mesmo formato de retorno, então a UI reusa o mesmo caminho (paginação/edição intactos).
 */
export async function listCreativesWithSpend(
  filters: ListFilters,
  since: string,
  until: string,
): Promise<ListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 50));

  const params: any[] = [since, until];
  const conds: string[] = ["c.deleted_at IS NULL"];
  if (filters.q) {
    params.push(`%${filters.q}%`);
    const i = params.length;
    conds.push(`(c.nome_drive ILIKE $${i} OR c.tp_id ILIKE $${i} OR c.nome_final ILIKE $${i} OR c.personagem ILIKE $${i})`);
  }
  if (filters.personagem) { params.push(filters.personagem); conds.push(`c.personagem = $${params.length}`); }
  if (filters.produto) { params.push(filters.produto); conds.push(`c.produto = $${params.length}`); }
  if (typeof filters.adValidado === "boolean") { params.push(filters.adValidado); conds.push(`c.ad_validado = $${params.length}`); }

  const base = `
    FROM cortex_core.creatives_library c
    JOIN (
      SELECT l.creative_id, SUM(i.spend) AS spend
      FROM cortex_core.creative_ad_links l
      JOIN meta_ads.meta_insights_daily i
        ON i.ad_id = l.ad_id AND i.date_start >= $1::date AND i.date_start <= $2::date
      GROUP BY l.creative_id
      HAVING SUM(i.spend) > 0
    ) s ON s.creative_id = c.id
    WHERE ${conds.join(" AND ")}
  `;

  const totalRes = await pool.query(`SELECT COUNT(*)::int AS n ${base}`, params);
  const total = Number(totalRes.rows[0]?.n) || 0;

  const rowsRes = await pool.query(
    `SELECT c.* ${base} ORDER BY s.spend DESC, c.id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    params,
  );
  return { rows: rowsRes.rows.map(rowToCamel) as CreativeLibraryItem[], total, page, pageSize };
}

export async function getCreativeById(id: number): Promise<CreativeLibraryItem | null> {
  const [row] = await db
    .select()
    .from(creativesLibrary)
    .where(and(eq(creativesLibrary.id, id), isNull(creativesLibrary.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getCreativeByTpId(tpId: string): Promise<CreativeLibraryItem | null> {
  const [row] = await db
    .select()
    .from(creativesLibrary)
    .where(and(eq(creativesLibrary.tpId, tpId), isNull(creativesLibrary.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function getCreativeByDriveFileId(
  fileId: string,
): Promise<CreativeLibraryItem | null> {
  const [row] = await db
    .select()
    .from(creativesLibrary)
    .where(and(eq(creativesLibrary.driveFileId, fileId), isNull(creativesLibrary.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function listAllForMatching(): Promise<CreativeRow[]> {
  const rows = await db
    .select()
    .from(creativesLibrary)
    .where(isNull(creativesLibrary.deletedAt));
  return rows.map(rowToCreativeRow);
}

// ============== Match Drive ↔ biblioteca ==============

export function matchDriveFilesToRows(
  driveFiles: { id: string; name: string }[],
  rows: CreativeRow[],
): { matched: MatchedCreative[]; unmatchedFiles: string[] } {
  const matched: MatchedCreative[] = [];
  const unmatchedFiles: string[] = [];

  const byFileId = new Map<string, CreativeRow>();
  const byName = new Map<string, CreativeRow>();
  for (const row of rows) {
    if (row.linkDoDrive) {
      const fid = extractFileIdFromDriveLink(row.linkDoDrive);
      if (fid) byFileId.set(fid, row);
    }
    if (row.nomeDrive) byName.set(normalizeName(row.nomeDrive), row);
  }

  for (const f of driveFiles) {
    let row = byFileId.get(f.id);
    if (!row) {
      const noExt = normalizeName(stripExtension(f.name));
      row = byName.get(noExt);
    }
    if (!row) {
      unmatchedFiles.push(f.name);
      continue;
    }
    matched.push({ fileName: f.name, fileId: f.id, row });
  }

  return { matched, unmatchedFiles };
}

// ============== Mutations ==============

export interface CreateCreativeInput {
  nomeDrive: string;
  linkDrive?: string | null;
  driveFileId?: string | null;
  angulo?: string | null;
  etapaFunil?: string | null;
  dataPostagem?: string | null;
  produto?: string | null;
  plataforma?: string | null;
  personagem?: string | null;
  tipoAd?: string | null;
  formatoAd?: string | null;
  proporcao?: string | null;
  observacao?: string | null;
  bodyTipo?: string | null;
  ctaTipo?: string | null;
  roteiroUrl?: string | null;
  clickupTaskId?: string | null;
  driveFolderId?: string | null;
  adValidado?: boolean;
  createdBy?: string | null;
}

export async function createCreative(input: CreateCreativeInput): Promise<CreativeLibraryItem> {
  const tpId = await generateNextTpId();
  const driveFileId =
    input.driveFileId ||
    (input.linkDrive ? extractFileIdFromDriveLink(input.linkDrive) : null);
  const nomeFinal = buildNomeFinal({
    tpId,
    nomeDrive: input.nomeDrive,
    dataPostagem: input.dataPostagem,
  });

  const values: InsertCreativeLibraryItem = {
    tpId,
    nomeDrive: input.nomeDrive,
    linkDrive: input.linkDrive ?? null,
    driveFileId: driveFileId ?? null,
    angulo: input.angulo ?? null,
    etapaFunil: input.etapaFunil ?? null,
    dataPostagem: input.dataPostagem ?? null,
    produto: input.produto ?? null,
    plataforma: input.plataforma ?? null,
    personagem: input.personagem ?? null,
    tipoAd: input.tipoAd ?? null,
    formatoAd: input.formatoAd ?? null,
    proporcao: input.proporcao ?? null,
    observacao: input.observacao ?? null,
    bodyTipo: input.bodyTipo ?? null,
    ctaTipo: input.ctaTipo ?? null,
    roteiroUrl: input.roteiroUrl ?? null,
    clickupTaskId: input.clickupTaskId ?? null,
    driveFolderId: input.driveFolderId ?? null,
    nomeFinal,
    adValidado: input.adValidado ?? false,
    createdBy: input.createdBy ?? null,
  };

  const [row] = await db.insert(creativesLibrary).values(values).returning();
  return row;
}

/**
 * Insere múltiplos criativos numa execução só. Usado pelo fluxo de "Subir campanha"
 * quando o usuário cola uma pasta do Drive: stubs auto-cadastrados (parser ok) e stubs
 * mínimos (parser falha) são persistidos em batch antes de subir a campanha no Meta.
 *
 * Dedup por `driveFileId` antes de inserir — se o arquivo já existe na biblioteca,
 * o stub correspondente é silenciosamente ignorado (idempotente).
 *
 * `tpId` é gerado sequencial a partir do maior existente, incrementando localmente
 * pra evitar N round-trips ao banco.
 */
export async function bulkInsertStubs(
  stubs: CreateCreativeInput[],
  createdBy: string | null,
): Promise<CreativeLibraryItem[]> {
  if (stubs.length === 0) return [];

  // Dedup contra o que já existe por driveFileId
  const fileIds = stubs
    .map((s) => s.driveFileId || (s.linkDrive ? extractFileIdFromDriveLink(s.linkDrive) : null))
    .filter((x): x is string => Boolean(x));
  const existing =
    fileIds.length > 0
      ? await db
          .select({ driveFileId: creativesLibrary.driveFileId })
          .from(creativesLibrary)
          .where(
            and(
              isNull(creativesLibrary.deletedAt),
              inArray(creativesLibrary.driveFileId, fileIds),
            ),
          )
      : [];
  const existingIds = new Set(existing.map((r) => r.driveFileId));

  const toInsert = stubs.filter((s) => {
    const fid = s.driveFileId || (s.linkDrive ? extractFileIdFromDriveLink(s.linkDrive) : null);
    return !fid || !existingIds.has(fid);
  });
  if (toInsert.length === 0) return [];

  // Gera tpIds: lê TODOS os IDs já usados e escolhe os próximos livres em ordem.
  // Mais robusto que MAX+1 (cobre gaps, IDs em formato inesperado, e race conditions parciais).
  const usedRows = await db
    .select({ tpId: creativesLibrary.tpId })
    .from(creativesLibrary);
  const usedSeqs = new Set<number>();
  for (const r of usedRows) {
    const m = r.tpId?.match(/^TP(\d+)$/);
    if (m) usedSeqs.add(parseInt(m[1], 10));
  }
  const allocateNextSeq = (): number => {
    let s = 1;
    while (usedSeqs.has(s)) s++;
    usedSeqs.add(s);
    return s;
  };

  const values: InsertCreativeLibraryItem[] = toInsert.map((input) => {
    const tpId = makeTpId(allocateNextSeq());
    const driveFileId =
      input.driveFileId ||
      (input.linkDrive ? extractFileIdFromDriveLink(input.linkDrive) : null);
    const nomeFinal = buildNomeFinal({
      tpId,
      nomeDrive: input.nomeDrive,
      dataPostagem: input.dataPostagem,
    });
    return {
      tpId,
      nomeDrive: input.nomeDrive,
      linkDrive: input.linkDrive ?? null,
      driveFileId: driveFileId ?? null,
      angulo: input.angulo ?? null,
      etapaFunil: input.etapaFunil ?? null,
      dataPostagem: input.dataPostagem ?? null,
      produto: input.produto ?? null,
      plataforma: input.plataforma ?? null,
      personagem: input.personagem ?? null,
      tipoAd: input.tipoAd ?? null,
      formatoAd: input.formatoAd ?? null,
      proporcao: input.proporcao ?? null,
      observacao: input.observacao ?? null,
      bodyTipo: input.bodyTipo ?? null,
      ctaTipo: input.ctaTipo ?? null,
      roteiroUrl: input.roteiroUrl ?? null,
      clickupTaskId: input.clickupTaskId ?? null,
      driveFolderId: input.driveFolderId ?? null,
      nomeFinal,
      adValidado: input.adValidado ?? false,
      createdBy: input.createdBy ?? createdBy ?? null,
    };
  });

  // ON CONFLICT (tp_id) DO NOTHING — cinto de segurança extra contra race conditions
  // Em caso de conflito (raro: 2 jobs paralelos calculando ao mesmo tempo), o stub é pulado
  // silenciosamente em vez de quebrar a execução inteira.
  return await db
    .insert(creativesLibrary)
    .values(values)
    .onConflictDoNothing({ target: creativesLibrary.tpId })
    .returning();
}

const TIPO_LABEL: Record<string, string> = { vv: "vídeo", img: "estático", car: "carrossel" };

/**
 * Garante uma linha na Biblioteca pra cada convenção parseada (chave = nomeDrive = a string da
 * convenção). Cria as faltantes (gera TP) e PREENCHE dimensões faltantes nas existentes
 * (sem sobrescrever edições manuais). Idempotente. Usado pelo sync pra cobrir ads manuais.
 * Retorna mapa nomeDrive → { id, tpId }.
 */
export async function upsertCreativesFromConvention(
  items: { nomeDrive: string; parsed: ParsedConvention }[],
  createdBy: string | null = null,
): Promise<Map<string, { id: number; tpId: string }>> {
  const out = new Map<string, { id: number; tpId: string }>();
  const byName = new Map<string, ParsedConvention>();
  for (const it of items) if (it.nomeDrive && !byName.has(it.nomeDrive)) byName.set(it.nomeDrive, it.parsed);
  const names = Array.from(byName.keys());
  if (names.length === 0) return out;

  const existing = await db
    .select({
      id: creativesLibrary.id, tpId: creativesLibrary.tpId, nomeDrive: creativesLibrary.nomeDrive,
      angulo: creativesLibrary.angulo, produto: creativesLibrary.produto, personagem: creativesLibrary.personagem,
      tipoAd: creativesLibrary.tipoAd, formatoAd: creativesLibrary.formatoAd, proporcao: creativesLibrary.proporcao,
    })
    .from(creativesLibrary)
    .where(and(isNull(creativesLibrary.deletedAt), inArray(creativesLibrary.nomeDrive, names)));
  const existingByName = new Map(existing.map((r) => [r.nomeDrive, r]));

  // 1) Criar as que faltam (gera TPs em lote)
  const toCreate = names.filter((n) => !existingByName.has(n));
  if (toCreate.length > 0) {
    const usedRows = await db.select({ tpId: creativesLibrary.tpId }).from(creativesLibrary);
    const usedSeqs = new Set<number>();
    for (const r of usedRows) { const m = r.tpId?.match(/^TP(\d+)$/); if (m) usedSeqs.add(parseInt(m[1], 10)); }
    const allocate = () => { let s = 1; while (usedSeqs.has(s)) s++; usedSeqs.add(s); return s; };

    const values: InsertCreativeLibraryItem[] = toCreate.map((name) => {
      const p = byName.get(name)!;
      const tpId = makeTpId(allocate());
      return {
        tpId, nomeDrive: name, nomeFinal: buildNomeFinal({ tpId, nomeDrive: name }),
        angulo: p.angulo ?? null, produto: p.produto ?? null, personagem: p.personagem || null,
        tipoAd: TIPO_LABEL[p.tipo] ?? null, formatoAd: p.formato ?? null, proporcao: p.proporcao ?? null,
        adValidado: false, createdBy,
      };
    });
    const inserted = await db
      .insert(creativesLibrary).values(values)
      .onConflictDoNothing({ target: creativesLibrary.tpId })
      .returning({ id: creativesLibrary.id, tpId: creativesLibrary.tpId, nomeDrive: creativesLibrary.nomeDrive });
    for (const r of inserted) out.set(r.nomeDrive, { id: r.id, tpId: r.tpId });
  }

  // 2) Existentes: mapeia e preenche só as dimensões faltantes (não sobrescreve)
  for (const [name, r] of existingByName) {
    out.set(name, { id: r.id, tpId: r.tpId });
    const p = byName.get(name)!;
    const patch: Record<string, any> = {};
    if (!r.angulo && p.angulo) patch.angulo = p.angulo;
    if (!r.produto && p.produto) patch.produto = p.produto;
    if (!r.personagem && p.personagem) patch.personagem = p.personagem;
    if (!r.tipoAd && TIPO_LABEL[p.tipo]) patch.tipoAd = TIPO_LABEL[p.tipo];
    if (!r.formatoAd && p.formato) patch.formatoAd = p.formato;
    if (!r.proporcao && p.proporcao) patch.proporcao = p.proporcao;
    if (Object.keys(patch).length > 0) {
      patch.updatedAt = new Date();
      await db.update(creativesLibrary).set(patch).where(eq(creativesLibrary.id, r.id));
    }
  }

  return out;
}

export type UpdateCreativeInput = Partial<CreateCreativeInput>;

export async function updateCreative(
  id: number,
  patch: UpdateCreativeInput,
): Promise<CreativeLibraryItem | null> {
  const current = await getCreativeById(id);
  if (!current) return null;

  const merged = {
    ...current,
    ...patch,
    driveFileId:
      patch.driveFileId !== undefined
        ? patch.driveFileId
        : patch.linkDrive !== undefined
          ? extractFileIdFromDriveLink(patch.linkDrive ?? "")
          : current.driveFileId,
  };

  // Regera Nome Final se algum input da fórmula mudar
  const formulaChanged =
    patch.nomeDrive !== undefined ||
    patch.dataPostagem !== undefined;
  const nomeFinal = formulaChanged
    ? buildNomeFinal({
        tpId: current.tpId,
        nomeDrive: merged.nomeDrive,
        dataPostagem: merged.dataPostagem as any,
      })
    : current.nomeFinal;

  const [row] = await db
    .update(creativesLibrary)
    .set({
      nomeDrive: merged.nomeDrive,
      linkDrive: merged.linkDrive,
      driveFileId: merged.driveFileId,
      angulo: merged.angulo,
      etapaFunil: merged.etapaFunil,
      dataPostagem: merged.dataPostagem,
      produto: merged.produto,
      plataforma: merged.plataforma,
      personagem: merged.personagem,
      tipoAd: merged.tipoAd,
      formatoAd: merged.formatoAd,
      proporcao: merged.proporcao,
      observacao: merged.observacao,
      bodyTipo: merged.bodyTipo,
      ctaTipo: merged.ctaTipo,
      roteiroUrl: merged.roteiroUrl,
      clickupTaskId: merged.clickupTaskId,
      driveFolderId: merged.driveFolderId,
      nomeFinal,
      adValidado: merged.adValidado,
      updatedAt: new Date(),
    })
    .where(eq(creativesLibrary.id, id))
    .returning();
  return row ?? null;
}

export async function softDeleteCreative(id: number): Promise<boolean> {
  const [row] = await db
    .update(creativesLibrary)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(creativesLibrary.id, id), isNull(creativesLibrary.deletedAt)))
    .returning({ id: creativesLibrary.id });
  return !!row;
}

// ============== Opções pra dropdowns autocomplete ==============

export interface DistinctOptions {
  personagem: string[];
  produto: string[];
  etapaFunil: string[];
  plataforma: string[];
  tipoAd: string[];
}

export async function getDistinctOptions(): Promise<DistinctOptions> {
  const r = await db.execute(sql`
    SELECT
      ARRAY(SELECT DISTINCT personagem  FROM cortex_core.creatives_library WHERE deleted_at IS NULL AND personagem  IS NOT NULL AND personagem  <> '' ORDER BY personagem)  AS personagem,
      ARRAY(SELECT DISTINCT produto     FROM cortex_core.creatives_library WHERE deleted_at IS NULL AND produto     IS NOT NULL AND produto     <> '' ORDER BY produto)     AS produto,
      ARRAY(SELECT DISTINCT etapa_funil FROM cortex_core.creatives_library WHERE deleted_at IS NULL AND etapa_funil IS NOT NULL AND etapa_funil <> '' ORDER BY etapa_funil) AS etapa_funil,
      ARRAY(SELECT DISTINCT plataforma  FROM cortex_core.creatives_library WHERE deleted_at IS NULL AND plataforma  IS NOT NULL AND plataforma  <> '' ORDER BY plataforma)  AS plataforma,
      ARRAY(SELECT DISTINCT tipo_ad     FROM cortex_core.creatives_library WHERE deleted_at IS NULL AND tipo_ad     IS NOT NULL AND tipo_ad     <> '' ORDER BY tipo_ad)     AS tipo_ad
  `);
  const row = (r as any).rows?.[0] ?? (r as any)[0] ?? {};
  return {
    personagem: row.personagem ?? [],
    produto: row.produto ?? [],
    etapaFunil: row.etapa_funil ?? [],
    plataforma: row.plataforma ?? [],
    tipoAd: row.tipo_ad ?? [],
  };
}
