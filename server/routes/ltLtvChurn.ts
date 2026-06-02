import type { Express } from "express";
import { sql } from "drizzle-orm";
import { revenueChurnPct } from "./ltLtvChurn.helpers";

export function registerLtLtvChurnRoutes(app: Express, db: any) {
  // KPIs gerais
  app.get("/api/lt-ltv-churn/overview", async (req, res) => {
    try {
      const produto = (req.query.produto as string) || undefined;
      const squad = (req.query.squad as string) || undefined;

      const kpis = await db.execute(sql`
        SELECT
          -- status='ativo' = MRR realizado; is_ativo = todos nao-churnados (LT em curso)
          ROUND(SUM(valorr) FILTER (WHERE status='ativo')::numeric, 0) AS mrr_ativo,
          ROUND(AVG(lt_meses) FILTER (WHERE tipo_receita='recorrente' AND is_ativo), 1) AS lt_medio_ativo,
          ROUND(AVG(lt_meses) FILTER (WHERE tipo_receita='recorrente' AND is_churned AND NOT data_inconsistente), 1) AS lt_medio_cancelado,
          COUNT(*) FILTER (WHERE tipo_receita='recorrente') AS total_recorrentes,
          COUNT(*) FILTER (WHERE data_inconsistente) AS total_inconsistentes
        FROM cortex_core.vw_lt_contratos
        WHERE 1=1
          ${produto ? sql`AND produto = ${produto}` : sql``}
          ${squad ? sql`AND squad = ${squad}` : sql``}
      `);

      const ltvCliente = await db.execute(sql`
        SELECT ROUND(AVG(ltv_total)::numeric, 0) AS ltv_medio_cliente FROM (
          SELECT id_task,
            SUM(COALESCE(ltv_recorrente,0)) + SUM(COALESCE(valorp,0)) AS ltv_total
          FROM cortex_core.vw_lt_contratos
          WHERE 1=1
            ${produto ? sql`AND produto = ${produto}` : sql``}
            ${squad ? sql`AND squad = ${squad}` : sql``}
          GROUP BY id_task
        ) t
      `);

      const k = kpis.rows[0] || {};
      res.json({
        mrrAtivo: Number(k.mrr_ativo) || 0,
        ltMedioAtivo: Number(k.lt_medio_ativo) || 0,
        ltMedioCancelado: Number(k.lt_medio_cancelado) || 0,
        totalRecorrentes: Number(k.total_recorrentes) || 0,
        totalInconsistentes: Number(k.total_inconsistentes) || 0,
        ltvMedioCliente: Number(ltvCliente.rows[0]?.ltv_medio_cliente) || 0,
      });
    } catch (error) {
      console.error("[api] Error fetching lt-ltv-churn overview:", error);
      res.status(500).json({ error: "Failed to fetch overview" });
    }
  });

  app.get("/api/lt-ltv-churn/benchmark", async (req, res) => {
    try {
      const squad = (req.query.squad as string) || undefined;
      const rows = (await db.execute(sql`
        SELECT
          produto,
          -- status='ativo' = MRR realizado; is_ativo = todos nao-churnados (LT em curso)
          COUNT(*) FILTER (WHERE status='ativo') AS n_ativos,
          COUNT(*) FILTER (WHERE is_churned) AS n_cancelados,
          ROUND(AVG(lt_meses) FILTER (WHERE is_churned AND NOT data_inconsistente), 1) AS lt_medio_cancelado,
          ROUND(AVG(lt_meses) FILTER (WHERE is_ativo), 1) AS lt_medio_ativo,
          ROUND(AVG(ltv_recorrente) FILTER (WHERE is_churned AND NOT data_inconsistente), 0) AS ltv_medio,
          ROUND(SUM(valorr) FILTER (WHERE status='ativo')::numeric, 0) AS mrr_ativo,
          ROUND(SUM(valorr) FILTER (WHERE is_churned)::numeric, 0) AS mrr_perdido
        FROM cortex_core.vw_lt_contratos
        WHERE tipo_receita='recorrente'
          ${squad ? sql`AND squad = ${squad}` : sql``}
        GROUP BY produto
        ORDER BY mrr_ativo DESC NULLS LAST
      `)).rows;

      const produtos = rows.map((r: any) => ({
        produto: r.produto,
        nAtivos: Number(r.n_ativos) || 0,
        nCancelados: Number(r.n_cancelados) || 0,
        ltMedioCancelado: Number(r.lt_medio_cancelado) || 0,
        ltMedioAtivo: Number(r.lt_medio_ativo) || 0,
        ltvMedio: Number(r.ltv_medio) || 0,
        mrrAtivo: Number(r.mrr_ativo) || 0,
        mrrPerdido: Number(r.mrr_perdido) || 0,
        revChurnPct: revenueChurnPct(Number(r.mrr_perdido) || 0,
          (Number(r.mrr_ativo) || 0) + (Number(r.mrr_perdido) || 0)),
      }));
      res.json({ produtos });
    } catch (error) {
      console.error("[api] Error fetching lt-ltv-churn benchmark:", error);
      res.status(500).json({ error: "Failed to fetch benchmark" });
    }
  });

  app.get("/api/lt-ltv-churn/churn-mensal", async (req, res) => {
    try {
      const meses = Math.min(Math.max(parseInt(req.query.meses as string) || 8, 1), 24);
      const produto = (req.query.produto as string) || undefined;
      const squad = (req.query.squad as string) || undefined;

      const rows = (await db.execute(sql`
        WITH serie_meses AS (
          SELECT generate_series(
            date_trunc('month', CURRENT_DATE) - (${meses - 1} || ' months')::interval,
            date_trunc('month', CURRENT_DATE), '1 month')::date AS m
        ),
        rec AS (
          SELECT valorr, data_inicio, data_fim, is_churned
          FROM cortex_core.vw_lt_contratos
          WHERE tipo_receita='recorrente'
            ${produto ? sql`AND produto = ${produto}` : sql``}
            ${squad ? sql`AND squad = ${squad}` : sql``}
        )
        SELECT to_char(serie_meses.m,'YYYY-MM') AS mes,
          ROUND(SUM(rec.valorr) FILTER (WHERE rec.data_inicio < serie_meses.m AND (rec.data_fim IS NULL OR rec.data_fim >= serie_meses.m))::numeric, 0) AS mrr_ativo_inicio,
          ROUND(SUM(rec.valorr) FILTER (WHERE rec.is_churned AND rec.data_fim >= serie_meses.m AND rec.data_fim < serie_meses.m + interval '1 month')::numeric, 0) AS mrr_perdido,
          ROUND((SUM(rec.valorr) FILTER (WHERE rec.is_churned AND rec.data_fim >= serie_meses.m AND rec.data_fim < serie_meses.m + interval '1 month')
                / NULLIF(SUM(rec.valorr) FILTER (WHERE rec.data_inicio < serie_meses.m AND (rec.data_fim IS NULL OR rec.data_fim >= serie_meses.m)),0) * 100)::numeric, 1) AS rev_churn_pct
        FROM serie_meses CROSS JOIN rec
        GROUP BY serie_meses.m ORDER BY serie_meses.m
      `)).rows;

      res.json({
        serie: rows.map((r: any) => ({
          mes: r.mes,
          mrrAtivoInicio: Number(r.mrr_ativo_inicio) || 0,
          mrrPerdido: Number(r.mrr_perdido) || 0,
          revChurnPct: Number(r.rev_churn_pct) || 0,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching lt-ltv-churn churn-mensal:", error);
      res.status(500).json({ error: "Failed to fetch churn-mensal" });
    }
  });

  app.get("/api/lt-ltv-churn/contratos", async (req, res) => {
    try {
      const status = (req.query.status as string) || undefined;
      const produto = (req.query.produto as string) || undefined;
      const squad = (req.query.squad as string) || undefined;
      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const pageSize = 50;
      const offset = (page - 1) * pageSize;

      const whereExtra = sql`
        ${status ? sql`AND status = ${status}` : sql``}
        ${produto ? sql`AND produto = ${produto}` : sql``}
        ${squad ? sql`AND squad = ${squad}` : sql``}`;

      const totalRes = await db.execute(sql`
        SELECT COUNT(*) AS total FROM cortex_core.vw_lt_contratos
        WHERE tipo_receita='recorrente' ${whereExtra}`);

      const rows = (await db.execute(sql`
        SELECT id_subtask, nome_cliente, produto, squad, status, valorr,
               lt_meses, ltv_recorrente, is_ativo, data_inconsistente,
               data_inicio, data_fim
        FROM cortex_core.vw_lt_contratos
        WHERE tipo_receita='recorrente' ${whereExtra}
        ORDER BY valorr DESC NULLS LAST
        LIMIT ${pageSize} OFFSET ${offset}`)).rows;

      res.json({
        total: Number(totalRes.rows[0]?.total) || 0,
        page, pageSize,
        contratos: rows.map((r: any) => ({
          idSubtask: r.id_subtask, nomeCliente: r.nome_cliente, produto: r.produto,
          squad: r.squad, status: r.status, valorr: Number(r.valorr) || 0,
          ltMeses: r.lt_meses != null ? Number(r.lt_meses) : null,
          ltvRecorrente: r.ltv_recorrente != null ? Number(r.ltv_recorrente) : null,
          isAtivo: r.is_ativo, dataInconsistente: r.data_inconsistente,
          dataInicio: r.data_inicio, dataFim: r.data_fim,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching lt-ltv-churn contratos:", error);
      res.status(500).json({ error: "Failed to fetch contratos" });
    }
  });

  app.get("/api/lt-ltv-churn/clientes", async (req, res) => {
    try {
      const apenas = (req.query.status as string) || undefined; // 'ativo' | 'cancelado'
      const produto = (req.query.produto as string) || undefined;
      const squad = (req.query.squad as string) || undefined;
      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const pageSize = 50;
      const offset = (page - 1) * pageSize;

      const havingClause =
        apenas === "ativo" ? sql`HAVING BOOL_OR(is_ativo)`
        : apenas === "cancelado" ? sql`HAVING NOT BOOL_OR(is_ativo)`
        : sql``;

      const baseAgg = sql`
        SELECT id_task,
          MAX(nome_cliente) AS nome_cliente,
          COUNT(*) FILTER (WHERE tipo_receita='recorrente') AS n_contratos_rec,
          ROUND(SUM(COALESCE(ltv_recorrente,0))::numeric, 0) AS ltv_recorrente,
          ROUND(SUM(CASE WHEN tipo_receita='pontual' THEN valorp ELSE 0 END)::numeric, 0) AS ltv_pontual,
          ROUND((SUM(COALESCE(ltv_recorrente,0)) + SUM(CASE WHEN tipo_receita='pontual' THEN valorp ELSE 0 END))::numeric, 0) AS ltv_total,
          ROUND(GREATEST(MAX(CASE WHEN is_ativo THEN (CURRENT_DATE - data_inicio) ELSE (data_fim - data_inicio) END),0)::numeric / 30.44, 1) AS lt_meses,
          BOOL_OR(is_ativo) AS ativo
        FROM cortex_core.vw_lt_contratos
        WHERE data_inicio IS NOT NULL
          ${produto ? sql`AND produto = ${produto}` : sql``}
          ${squad ? sql`AND squad = ${squad}` : sql``}
        GROUP BY id_task ${havingClause}`;

      const totalRes = await db.execute(sql`SELECT COUNT(*) AS total FROM (${baseAgg}) t`);
      const rows = (await db.execute(sql`
        SELECT * FROM (${baseAgg}) t ORDER BY ltv_total DESC NULLS LAST
        LIMIT ${pageSize} OFFSET ${offset}`)).rows;

      res.json({
        total: Number(totalRes.rows[0]?.total) || 0,
        page, pageSize,
        clientes: rows.map((r: any) => ({
          idTask: r.id_task, nomeCliente: r.nome_cliente,
          nContratosRec: Number(r.n_contratos_rec) || 0,
          ltvRecorrente: Number(r.ltv_recorrente) || 0,
          ltvPontual: Number(r.ltv_pontual) || 0,
          ltvTotal: Number(r.ltv_total) || 0,
          ltMeses: Number(r.lt_meses) || 0, ativo: r.ativo,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching lt-ltv-churn clientes:", error);
      res.status(500).json({ error: "Failed to fetch clientes" });
    }
  });
}
