import type { Express } from "express";
import { sql } from "drizzle-orm";
import { computarBpReceitas } from "./bp2026";
import { storage } from "../storage";
import { canAccessCeo, geracaoCaixaFromBp, parseMesNum, receitaCabecaCaixaFromBp, receitaRecebidaFromBp } from "./ceoDashboard.helpers";
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

  // 3) LTV FAT × LTV DFC — medianas dos ativos POR MÊS (spec: docs/superpowers/specs/2026-07-09-ltv-dfc-fat-ceo-dashboard-design.md).
  // FAT (faturável, ClickUp): valorr × meses de vida até o snapshot + valorp dos pontuais entregues.
  // DFC (caixa, híbrido): teórico até 30/set/2025 + pago real Conta Azul (via CNPJ) até a entrada do mês;
  // clientes sem match CNPJ caem no FAT. População: ativos no snapshot do dia 1º (ou 1º snapshot do mês).
  // MATERIALIZED é obrigatório: sem ele o planner re-executa as subqueries ~16k vezes (25s vs 0,9s).
  const ltvFatSeriePorMes: Record<number, number> = {};
  const ltvDfcSeriePorMes: Record<number, number> = {};
  try {
    const ltvRows: any = await db.execute(sql`
      WITH meses AS (
        SELECT generate_series('2026-01-01'::date, make_date(2026, ${mesNum}, 1), '1 month')::date m
      ),
      snap_ref AS MATERIALIZED (
        SELECT meses.m, COALESCE(
          (SELECT data_snapshot FROM "Clickup".cup_data_hist WHERE data_snapshot = meses.m LIMIT 1),
          (SELECT MIN(data_snapshot) FROM "Clickup".cup_data_hist WHERE date_trunc('month', data_snapshot) = meses.m)
        ) AS snap FROM meses
      ),
      ativos AS MATERIALIZED (
        SELECT sr.m, sr.snap, h.id_task
        FROM snap_ref sr
        JOIN "Clickup".cup_data_hist h ON h.data_snapshot = sr.snap
        WHERE sr.snap IS NOT NULL
        GROUP BY sr.m, sr.snap, h.id_task
        HAVING BOOL_OR(h.status IN ('ativo','onboarding','triagem') AND h.valorr > 0)
      ),
      click_norm AS MATERIALIZED (
        SELECT cl.task_id, regexp_replace(cl.cnpj::text, '\\D', '', 'g') AS cnpj_norm
        FROM "Clickup".cup_clientes cl
        WHERE LENGTH(regexp_replace(cl.cnpj::text, '\\D', '', 'g')) IN (11, 14)
      ),
      caz_norm AS MATERIALIZED (
        SELECT c.ids, regexp_replace(c.cnpj::text, '\\D', '', 'g') AS cnpj_norm
        FROM "Conta Azul".caz_clientes c
        WHERE LENGTH(regexp_replace(c.cnpj::text, '\\D', '', 'g')) IN (11, 14)
      ),
      caz_map AS MATERIALIZED (
        SELECT DISTINCT k.task_id, z.ids
        FROM click_norm k JOIN caz_norm z USING (cnpj_norm)
      ),
      match_task AS MATERIALIZED (SELECT DISTINCT task_id FROM caz_map),
      rec_contratos AS MATERIALIZED (
        SELECT v.id_task, v.valorr, v.data_inicio, v.data_fim
        FROM cortex_core.vw_lt_contratos v
        WHERE v.tipo_receita = 'recorrente' AND v.data_inicio IS NOT NULL
      ),
      pont_task AS MATERIALIZED (
        SELECT co.id_task, co.valorp, COALESCE(co.data_entrega, co.data_criado) AS data_ref
        FROM "Clickup".cup_contratos co
        WHERE co.valorp > 0 AND (co.valorr IS NULL OR co.valorr = 0) AND co.status = 'entregue'
      ),
      teo AS MATERIALIZED (
        SELECT a.m, a.id_task,
          COALESCE(SUM(r.valorr * GREATEST((LEAST(COALESCE(r.data_fim, a.snap), a.snap) - r.data_inicio)::numeric, 0) / 30.44), 0) AS rec_full,
          COALESCE(SUM(r.valorr * GREATEST((LEAST(COALESCE(r.data_fim, DATE '2025-09-30'), DATE '2025-09-30') - r.data_inicio)::numeric, 0) / 30.44), 0) AS rec_pre
        FROM ativos a
        LEFT JOIN rec_contratos r ON r.id_task = a.id_task
        GROUP BY a.m, a.id_task
      ),
      pont_agg AS MATERIALIZED (
        SELECT a.m, a.id_task,
          COALESCE(SUM(p.valorp) FILTER (WHERE p.data_ref < a.snap), 0) AS pont_full,
          COALESCE(SUM(p.valorp) FILTER (WHERE p.data_ref < DATE '2025-10-01'), 0) AS pont_pre
        FROM ativos a
        JOIN pont_task p ON p.id_task = a.id_task
        GROUP BY a.m, a.id_task
      ),
      real_task_mes AS MATERIALIZED (
        SELECT cm.task_id, date_trunc('month', pa.data_quitacao)::date AS mes_q, SUM(pa.valor_pago) AS pago
        FROM caz_map cm
        JOIN "Conta Azul".caz_parcelas pa ON pa.id_cliente::text = cm.ids
        WHERE pa.tipo_evento = 'RECEITA' AND pa.data_quitacao >= DATE '2025-10-01'
        GROUP BY cm.task_id, date_trunc('month', pa.data_quitacao)
      ),
      real_cum AS MATERIALIZED (
        SELECT ms.m, r.task_id, SUM(r.pago) AS pago
        FROM meses ms JOIN real_task_mes r ON r.mes_q < ms.m
        GROUP BY ms.m, r.task_id
      ),
      por_cliente AS (
        SELECT a.m,
          t.rec_full + COALESCE(pg.pont_full, 0) AS ltv_fat,
          CASE WHEN mt.task_id IS NOT NULL
               THEN t.rec_pre + COALESCE(pg.pont_pre, 0) + COALESCE(rc.pago, 0)
               ELSE t.rec_full + COALESCE(pg.pont_full, 0)
          END AS ltv_dfc
        FROM ativos a
        JOIN teo t ON t.m = a.m AND t.id_task = a.id_task
        LEFT JOIN pont_agg pg ON pg.m = a.m AND pg.id_task = a.id_task
        LEFT JOIN real_cum rc ON rc.m = a.m AND rc.task_id = a.id_task
        LEFT JOIN match_task mt ON mt.task_id = a.id_task
      )
      SELECT EXTRACT(MONTH FROM m)::int AS mes,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ltv_fat)::numeric, 0) AS ltv_fat,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ltv_dfc)::numeric, 0) AS ltv_dfc
      FROM por_cliente
      GROUP BY m ORDER BY m
    `);
    for (const r of ltvRows.rows ?? []) {
      const mes = Number((r as any).mes);
      if (!mes) continue;
      const fat = Number((r as any).ltv_fat);
      const dfc = Number((r as any).ltv_dfc);
      if (!Number.isNaN(fat)) ltvFatSeriePorMes[mes] = fat;
      if (!Number.isNaN(dfc)) ltvDfcSeriePorMes[mes] = dfc;
    }
  } catch (e) {
    console.error("[api] CEO matriz — falha na série de LTV FAT/DFC:", e);
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
    geracaoCaixa: geracaoCaixaFromBp(bp),
    inadimplenciaSeriePorMes,
    ltvFatSeriePorMes,
    ltvDfcSeriePorMes,
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
