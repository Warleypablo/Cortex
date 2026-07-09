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

  // 3) LTV MEDIANO dos ativos POR MÊS — reconstruído de snapshots diários (cup_data_hist),
  // régua da aba /lt-ltv-churn (valorr×lt no snapshot + valorp, só ativos). Mediana (não média)
  // p/ não ser distorcida por poucos clientes de ticket altíssimo (ex.: R$25k/mês → LTV R$214k).
  // Snapshot de referência = dia 1º do mês ou o 1º snapshot disponível dele.
  const ltvSeriePorMes: Record<number, number> = {};
  try {
    const ltvRows: any = await db.execute(sql`
      WITH meses AS (
        SELECT generate_series('2026-01-01'::date, make_date(2026, ${mesNum}, 1), '1 month')::date m
      ),
      snap_ref AS (
        SELECT meses.m, COALESCE(
          (SELECT data_snapshot FROM "Clickup".cup_data_hist WHERE data_snapshot = meses.m LIMIT 1),
          (SELECT MIN(data_snapshot) FROM "Clickup".cup_data_hist WHERE date_trunc('month',data_snapshot)=meses.m)
        ) snap FROM meses
      ),
      cli AS (
        SELECT sr.m, h.id_task,
          BOOL_OR(h.status IN ('ativo','onboarding','triagem') AND h.valorr>0) AS ativo,
          COALESCE(SUM(h.valorr*(sr.snap-h.data_inicio)::numeric/30.44) FILTER (WHERE h.valorr>0 AND sr.snap>=h.data_inicio),0)
            + COALESCE(SUM(h.valorp) FILTER (WHERE h.valorp>0),0) AS ltv
        FROM snap_ref sr JOIN "Clickup".cup_data_hist h ON h.data_snapshot=sr.snap
        WHERE sr.snap IS NOT NULL
        GROUP BY sr.m, h.id_task
      )
      SELECT EXTRACT(MONTH FROM m)::int AS mes,
        ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ltv) FILTER (WHERE ativo))::numeric,0) AS ltv
      FROM cli GROUP BY m ORDER BY m
    `);
    for (const r of ltvRows.rows ?? []) {
      const v = Number((r as any).ltv);
      if ((r as any).mes != null && !Number.isNaN(v)) ltvSeriePorMes[Number((r as any).mes)] = v;
    }
  } catch (e) {
    console.error("[api] CEO matriz — falha na série de LTV:", e);
  }

  // 4) E-NPS (empresa) POR MÊS — NPS de cada onda de pesquisa ("Inhire".rh_nps, mes_referencia).
  // Régua: promotor score≥9, detrator ≤6; NPS = (promo−detra)/respondentes*100. Meses sem onda → ausente (gap).
  const enpsSeriePorMes: Record<number, number> = {};
  try {
    const enpsRows: any = await db.execute(sql`
      SELECT split_part(mes_referencia,'-',2)::int AS mes,
        ROUND(
          (COUNT(*) FILTER (WHERE score_empresa >= 9) - COUNT(*) FILTER (WHERE score_empresa <= 6))::numeric
          / NULLIF(COUNT(*) FILTER (WHERE score_empresa IS NOT NULL), 0) * 100
        ) AS nps
      FROM "Inhire".rh_nps
      WHERE mes_referencia LIKE '2026-%'
      GROUP BY mes_referencia
    `);
    for (const r of enpsRows.rows ?? []) {
      const v = Number((r as any).nps);
      if ((r as any).mes != null && (r as any).nps != null && !Number.isNaN(v)) {
        enpsSeriePorMes[Number((r as any).mes)] = v;
      }
    }
  } catch (e) {
    console.error("[api] CEO matriz — falha na série de E-NPS:", e);
  }

  return montarMatrizCeo({
    mesNum,
    mesFechado: bp.mesFechado ?? mesNum,
    bpLinhas: bp.linhas ?? [],
    bpMetricas: bp.metricasGerais ?? [],
    receitaRecebida: receitaRecebidaFromBp(bp),
    receitaCabecaCaixa: receitaCabecaCaixaFromBp(bp),
    inadimplenciaSeriePorMes,
    ltvSeriePorMes,
    enpsSeriePorMes,
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
