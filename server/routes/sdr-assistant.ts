import type { Express, Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import { isAuthenticated } from "../auth/middleware";

export type DealStatus = "ativo" | "ganho" | "perdido";

export function classifyDealStatus(stageName: string): DealStatus {
  const s = (stageName || "").toLowerCase();
  if (
    s.includes("perdido") ||
    s.includes("lose") ||
    s.includes("descartado") ||
    s.includes("descarte")
  ) {
    return "perdido";
  }
  if (
    s.includes("ganho") ||
    s.includes("won") ||
    s.includes("contrato assinado")
  ) {
    return "ganho";
  }
  return "ativo";
}

export interface CompanyMatch {
  company_name: string;
  deal_count: number;
  last_deal_id: number;
  last_stage: string;
}

export async function searchCompanies(
  db: any,
  query: string
): Promise<CompanyMatch[]> {
  const trimmed = (query || "").trim();
  if (trimmed.length < 3) {
    throw new Error("query precisa ter pelo menos 3 caracteres");
  }
  const pattern = `%${trimmed}%`;
  const result = await db.execute(sql`
    SELECT
      d.company_name,
      COUNT(*)::int AS deal_count,
      MAX(d.id)::int AS last_deal_id,
      (ARRAY_AGG(d.stage_name ORDER BY d.date_create DESC NULLS LAST))[1] AS last_stage
    FROM "Bitrix".crm_deal d
    WHERE d.company_name IS NOT NULL
      AND (d.company_name ILIKE ${pattern} OR d.title ILIKE ${pattern})
    GROUP BY d.company_name
    ORDER BY deal_count DESC, last_deal_id DESC
    LIMIT 10
  `);
  return (result.rows || []) as CompanyMatch[];
}

export interface DealDetails {
  id: number;
  title: string;
  stage: string;
  categoria: string | null;
  sdr: string | null;
  closer: string | null;
  criado_em: string | null;
  fechado_em: string | null;
  valor_mrr: number | null;
  valor_pontual: number | null;
  status: DealStatus;
  motivo_perda: string | null;
  origem: string | null;
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const str = String(value);
  if (str.length >= 10) return str.slice(0, 10);
  return null;
}

export async function getCompanyTimeline(
  db: any,
  companyName: string
): Promise<DealDetails[]> {
  const result = await db.execute(sql`
    SELECT
      d.id, d.title, d.stage_name,
      d.category_name AS categoria,
      d.source,
      d.valor_recorrente, d.valor_pontual,
      d.date_create, d.data_fechamento,
      d.comments,
      NULL::text AS motivo_perda,
      d.assigned_by_name AS responsavel,
      d.closer
    FROM "Bitrix".crm_deal d
    WHERE d.company_name = ${companyName}
    ORDER BY d.date_create DESC NULLS LAST
  `);

  return (result.rows || []).map((row: any): DealDetails => ({
    id: Number(row.id),
    title: row.title,
    stage: row.stage_name,
    categoria: row.categoria,
    sdr: row.responsavel ?? null,
    closer: row.closer ?? null,
    criado_em: toIsoDate(row.date_create),
    fechado_em: toIsoDate(row.data_fechamento),
    valor_mrr: row.valor_recorrente != null ? Number(row.valor_recorrente) : null,
    valor_pontual: row.valor_pontual != null ? Number(row.valor_pontual) : null,
    status: classifyDealStatus(row.stage_name),
    motivo_perda: row.motivo_perda,
    origem: row.source,
  }));
}

const ALLOWED_DEPARTMENTS = new Set(["admin", "comercial"]);

function requireInternalCollaborator(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: "not authenticated" });
  }
  if (!ALLOWED_DEPARTMENTS.has(user.department)) {
    return res
      .status(403)
      .json({ error: "forbidden — internal collaborators only (admin/comercial)" });
  }
  next();
}

export function registerSdrAssistantRoutes(app: Express, db: any) {
  app.post(
    "/api/sdr-assistant/chat",
    isAuthenticated,
    requireInternalCollaborator,
    async (_req: Request, res: Response) => {
      return res.json({ response: "skeleton ok", tool_calls: [], usage: null });
    }
  );
}
