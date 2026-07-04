import type { Express } from "express";
import { sql } from "drizzle-orm";
import { computarBpReceitas } from "./bp2026";
import { storage } from "../storage";
import {
  assembleCeoKpis,
  canAccessCeo,
  type CeoDashboardResponse,
} from "./ceoDashboard.helpers";

// "2026-06" -> 6. BP é fixo em ANO=2026; fora disso cai no mês corrente do payload.
function parseMesNum(mes: string | undefined, mesCorrente: number): number {
  if (!mes) return mesCorrente;
  const m = /^2026-(\d{2})$/.exec(mes);
  if (!m) return mesCorrente;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 12 ? n : mesCorrente;
}

export async function buildCeoDashboard(db: any, mes?: string): Promise<CeoDashboardResponse> {
  // 1) BP — 7 KPIs de uma só chamada (linhas[] do DRE + metricasGerais[]).
  const bp: any = await computarBpReceitas(db);
  const mesNum = parseMesNum(mes, bp.mesCorrente);

  // 2) Inadimplência (foto atual) + série mensal p/ sparkline/MoM.
  const inadResumo = await storage.getInadimplenciaResumo();
  const inadSerie = (inadResumo.evolucaoMensal ?? []).map((e: any) => Number(e.valor) || 0);

  // 3) LTV médio por cliente (mesma régua do /api/lt-ltv-churn/overview).
  const ltvRows: any = await db.execute(sql`
    SELECT ROUND(AVG(ltv_total)::numeric, 0) AS ltv FROM (
      SELECT id_task,
        SUM(COALESCE(ltv_recorrente,0)) + SUM(COALESCE(valorp,0)) AS ltv_total
      FROM cortex_core.vw_lt_contratos
      GROUP BY id_task
    ) t
  `);
  const ltv = Number(ltvRows.rows?.[0]?.ltv) || null;

  // 4) E-NPS (empresa) — mais recente disponível.
  let enpsScore: number | null = null;
  try {
    const npsDash: any = await storage.getRhNpsDashboard();
    enpsScore = npsDash?.empresa?.nps ?? null;
  } catch {
    enpsScore = null;
  }

  const kpis = assembleCeoKpis({
    bpLinhas: bp.linhas ?? [],
    bpMetricas: bp.metricasGerais ?? [],
    mesNum,
    inadimplencia: {
      total: inadResumo.totalInadimplente ?? null,
      serie: inadSerie.length ? inadSerie : null,
    },
    ltvMedioCliente: ltv,
    enpsScore,
  });

  return { mes: `2026-${String(mesNum).padStart(2, "0")}`, kpis };
}

export function registerCeoDashboardRoutes(app: Express, db: any) {
  app.get("/api/ceo-dashboard", async (req: any, res) => {
    try {
      if (!canAccessCeo(req.user)) {
        return res.status(403).json({ error: "Acesso restrito ao CEO Dashboard" });
      }
      const mes = typeof req.query.mes === "string" ? req.query.mes : undefined;
      const payload = await buildCeoDashboard(db, mes);
      res.json(payload);
    } catch (error) {
      console.error("[api] Error building CEO dashboard:", error);
      res.status(500).json({ error: "Falha ao montar o CEO Dashboard" });
    }
  });
}
