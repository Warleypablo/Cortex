import type { Express } from "express";
import { sql } from "drizzle-orm";
import { computarBpReceitas } from "./bp2026";
import { storage } from "../storage";
import { canAccessCeo, parseMesNum, receitaCabecaCaixaFromBp, receitaRecebidaFromBp } from "./ceoDashboard.helpers";
import { montarMatrizCeo, type CeoMatrizResponse } from "./ceoDashboard.matriz.helpers";

// Matriz mês a mês do CEO Dashboard: mesma fonte dos cards (computarBpReceitas +
// fontes próprias), transposta para indicador × mês (jan → mês pedido).
export async function buildCeoMatriz(db: any, ate?: string): Promise<CeoMatrizResponse> {
  // 1) BP — série mensal (linhas[] + metricasGerais[]) numa só chamada.
  const bp: any = await computarBpReceitas(db);
  const mesNum = parseMesNum(ate, bp.mesCorrente);

  // 2) Inadimplência — série por mês de VENCIMENTO (só 2026); sem meta.
  const inadResumo = await storage.getInadimplenciaResumo();
  const inadimplenciaSeriePorMes: Record<number, number> = {};
  for (const e of inadResumo.evolucaoMensal ?? []) {
    const mm = /^2026-(\d{2})$/.exec(String((e as any).mes));
    if (mm) inadimplenciaSeriePorMes[parseInt(mm[1], 10)] = Number((e as any).valor) || 0;
  }

  // 3) LTV médio por cliente (mesma régua do card) — foto atual, sem histórico.
  const ltvRows: any = await db.execute(sql`
    SELECT ROUND(AVG(ltv_total)::numeric, 0) AS ltv FROM (
      SELECT id_task,
        SUM(COALESCE(ltv_recorrente,0)) + SUM(COALESCE(valorp,0)) AS ltv_total
      FROM cortex_core.vw_lt_contratos
      GROUP BY id_task
    ) t
  `);
  const ltvNum = Number(ltvRows.rows?.[0]?.ltv);
  const ltvAtual = Number.isNaN(ltvNum) ? null : ltvNum;

  // 4) E-NPS (empresa) — foto atual, sem histórico.
  let enpsAtual: number | null = null;
  try {
    const npsDash: any = await storage.getRhNpsDashboard();
    enpsAtual = npsDash?.empresa?.nps ?? null;
  } catch {
    enpsAtual = null;
  }

  return montarMatrizCeo({
    mesNum,
    mesFechado: bp.mesFechado ?? mesNum,
    bpLinhas: bp.linhas ?? [],
    bpMetricas: bp.metricasGerais ?? [],
    receitaRecebida: receitaRecebidaFromBp(bp),
    receitaCabecaCaixa: receitaCabecaCaixaFromBp(bp),
    inadimplenciaSeriePorMes,
    ltvAtual,
    enpsAtual,
  });
}

export function registerCeoDashboardMatrizRoutes(app: Express, db: any) {
  app.get("/api/ceo-dashboard/matriz", async (req: any, res) => {
    try {
      if (!canAccessCeo(req.user)) {
        return res.status(403).json({ error: "Acesso restrito ao CEO Dashboard" });
      }
      const ate = typeof req.query.ate === "string" ? req.query.ate
        : typeof req.query.mes === "string" ? req.query.mes : undefined;
      const payload = await buildCeoMatriz(db, ate);
      res.json(payload);
    } catch (error) {
      console.error("[api] Error building CEO matriz:", error);
      res.status(500).json({ error: "Falha ao montar a matriz do CEO Dashboard" });
    }
  });
}
