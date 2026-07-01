// server/routes/gestaoReceita.funil.ts
// Régua de segmentação (inbound / outbound / outros) e filtros Produto × Plataforma
// do funil da Gestão de Receita. Compartilhado entre o endpoint agregador
// (gestaoReceita.ts) e o drill-down (gestaoReceita.detalhe.ts) para não divergirem.
import { sql, type SQL } from "drizzle-orm";

const STAGE_GANHO = "Negócio Ganho";

// Inbound = régua do growth.ts. Outbound = SÓ Prospecção ativa (UC_YWZVA2) — pedido
// de 2026-07-01; antes "outbound" era tudo-que-não-é-inbound e misturava crossell,
// indicação, eventos etc. Esses agora caem em "outros" (junto com source vazio).
export const INBOUND_SOURCES = ["CALL", "EMAIL", "WEB", "ADVERTISING", "TRADE_SHOW", "WEBFORM", "OTHER", "UC_4VCKGM"];
export const OUTBOUND_SOURCE = "UC_YWZVA2"; // "Prospecção" no Bitrix

export type SegFunil = "inbound" | "outbound" | "outros";

// coluna com alias opcional (ex.: "d") — nomes fixos internos, não vêm do usuário
const col = (nome: string, alias?: string): SQL => sql.raw(alias ? `${alias}.${nome}` : nome);
const inboundIn = () => sql.join(INBOUND_SOURCES.map((s) => sql`${s}`), sql`, `);

export const segCaseSql = (alias?: string): SQL => sql`CASE
  WHEN ${col("source", alias)} IN (${inboundIn()}) THEN 'inbound'
  WHEN ${col("source", alias)} = ${OUTBOUND_SOURCE} THEN 'outbound'
  ELSE 'outros' END`;

// predicado de um segmento (p/ drill e agregações pontuais)
export function segPredSql(seg: string, alias?: string): SQL {
  const c = col("source", alias);
  if (seg === "inbound") return sql`${c} IN (${inboundIn()})`;
  if (seg === "outbound") return sql`${c} = ${OUTBOUND_SOURCE}`;
  if (seg === "outros") return sql`(${c} IS NULL OR ${c} NOT IN (${inboundIn()})) AND COALESCE(${c}, '') <> ${OUTBOUND_SOURCE}`;
  return sql`TRUE`;
}

// ---------- filtro PRODUTO (campo fnl_ngc = "funil do negócio" do Bitrix) ----------
// É a única dimensão de produto preenchida no nível do lead (Creators, Geral,
// E-commerce…); o campo `produtos` (serviços vendidos) só existe em ~3% dos deals.
export const produtoExprSql = (alias?: string): SQL =>
  sql`COALESCE(NULLIF(TRIM(${col("fnl_ngc", alias)}), ''), '(sem funil)')`;
export const produtoPredSql = (produto: string, alias?: string): SQL =>
  sql`${produtoExprSql(alias)} = ${produto}`;
export const produtoValido = (p: unknown): p is string =>
  typeof p === "string" && p.length > 0 && p.length <= 120;

// ---------- filtro PLATAFORMA (utm_source, régua alinhada a growth.ts / fca.ts) ----------
export const PLATAFORMA_LABELS: Record<string, string> = {
  meta: "Meta Ads", google: "Google Ads", tiktok: "TikTok",
  outros: "Outras origens", sem_utm: "(sem UTM)",
};
export const plataformaValida = (p: unknown): p is string =>
  typeof p === "string" && p in PLATAFORMA_LABELS;

export function plataformaPredSql(plataforma: string, alias?: string): SQL {
  const c = col("utm_source", alias);
  const meta = sql`(${c} ILIKE 'facebook%' OR ${c} ILIKE 'fb%' OR ${c} ILIKE 'meta%')`;
  const google = sql`(${c} ILIKE 'google%' OR ${c} ILIKE 'adwords%' OR ${c} = 'gads')`;
  const tiktok = sql`(${c} ILIKE 'tiktok%')`;
  switch (plataforma) {
    case "meta": return meta;
    case "google": return google;
    case "tiktok": return tiktok;
    case "sem_utm": return sql`COALESCE(${c}, '') = ''`;
    case "outros": return sql`COALESCE(${c}, '') <> '' AND NOT ${meta} AND NOT ${google} AND NOT ${tiktok}`;
    default: return sql`TRUE`;
  }
}

// junta os predicados ativos como sufixo " AND ..." (para compor num WHERE existente)
export function filtrosFunilSql(f: { produto?: string; plataforma?: string }, alias?: string): SQL {
  let s = sql``;
  if (f.produto) s = sql`${s} AND ${produtoPredSql(f.produto, alias)}`;
  if (f.plataforma) s = sql`${s} AND ${plataformaPredSql(f.plataforma, alias)}`;
  return s;
}

export interface EtapaFunil { etapa: string; valor: number; mql: number }
export interface FunilSegmentado { inbound: EtapaFunil[]; outbound: EtapaFunil[]; outros: EtapaFunil[] }

// Funil Lead→RA→RR→Venda por segmento, com filtros opcionais de produto/plataforma.
// Cada etapa conta pelo próprio marco de data dentro do período (modelo de fluxo).
export async function computeFunil(
  db: any,
  { dIni, dFim, produto, plataforma }: { dIni: string; dFim: string; produto?: string; plataforma?: string }
): Promise<FunilSegmentado> {
  const isMql = sql`(mql::text = '1' OR lower(mql::text) = 'true')`;
  const rows = await db.execute(sql`
    SELECT ${segCaseSql()} AS seg,
      COUNT(*) FILTER (WHERE date_create >= ${dIni} AND date_create < ${dFim}) AS leads,
      COUNT(*) FILTER (WHERE date_create >= ${dIni} AND date_create < ${dFim} AND ${isMql}) AS leads_mql,
      COUNT(*) FILTER (WHERE data_reuniao_agendada >= ${dIni} AND data_reuniao_agendada < ${dFim}) AS ra,
      COUNT(*) FILTER (WHERE data_reuniao_agendada >= ${dIni} AND data_reuniao_agendada < ${dFim} AND ${isMql}) AS ra_mql,
      COUNT(*) FILTER (WHERE data_reuniao_realizada >= ${dIni} AND data_reuniao_realizada < ${dFim}) AS rr,
      COUNT(*) FILTER (WHERE data_reuniao_realizada >= ${dIni} AND data_reuniao_realizada < ${dFim} AND ${isMql}) AS rr_mql,
      COUNT(*) FILTER (WHERE stage_name = ${STAGE_GANHO} AND data_fechamento >= ${dIni} AND data_fechamento < ${dFim}) AS venda,
      COUNT(*) FILTER (WHERE stage_name = ${STAGE_GANHO} AND data_fechamento >= ${dIni} AND data_fechamento < ${dFim} AND ${isMql}) AS venda_mql
    FROM "Bitrix".crm_deal
    WHERE TRUE${filtrosFunilSql({ produto, plataforma })}
    GROUP BY 1
  `);
  const porSeg: Record<string, any> = {};
  for (const r of rows.rows as any[]) porSeg[r.seg] = r;
  const etapasDe = (r: any): EtapaFunil[] => [
    { etapa: "Lead", valor: Number(r?.leads) || 0, mql: Number(r?.leads_mql) || 0 },
    { etapa: "Reunião agendada", valor: Number(r?.ra) || 0, mql: Number(r?.ra_mql) || 0 },
    { etapa: "Reunião realizada", valor: Number(r?.rr) || 0, mql: Number(r?.rr_mql) || 0 },
    { etapa: "Venda", valor: Number(r?.venda) || 0, mql: Number(r?.venda_mql) || 0 },
  ];
  return { inbound: etapasDe(porSeg["inbound"]), outbound: etapasDe(porSeg["outbound"]), outros: etapasDe(porSeg["outros"]) };
}

// Opções do select de Produto: valores de fnl_ngc dos deals que tocam o período
// (lead criado, reunião agendada/realizada ou venda dentro do range).
export async function opcoesProdutoFunil(
  db: any,
  { dIni, dFim }: { dIni: string; dFim: string }
): Promise<{ produto: string; qtd: number }[]> {
  const rows = await db.execute(sql`
    SELECT ${produtoExprSql()} AS produto, COUNT(*) AS qtd
    FROM "Bitrix".crm_deal
    WHERE (date_create >= ${dIni} AND date_create < ${dFim})
       OR (data_reuniao_agendada >= ${dIni} AND data_reuniao_agendada < ${dFim})
       OR (data_reuniao_realizada >= ${dIni} AND data_reuniao_realizada < ${dFim})
       OR (stage_name = ${STAGE_GANHO} AND data_fechamento >= ${dIni} AND data_fechamento < ${dFim})
    GROUP BY 1 ORDER BY 2 DESC LIMIT 30
  `);
  return (rows.rows as any[]).map((r) => ({ produto: r.produto as string, qtd: Number(r.qtd) || 0 }));
}
