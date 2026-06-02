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
          -- "ativo faturando" = ativo + onboarding + triagem (carteira recorrente viva); is_churned = cancelado/inativo
          ROUND(SUM(valorr) FILTER (WHERE status IN ('ativo','onboarding','triagem'))::numeric, 0) AS mrr_ativo,
          ROUND(AVG(lt_meses) FILTER (WHERE tipo_receita='recorrente' AND status IN ('ativo','onboarding','triagem') AND NOT data_inconsistente), 1) AS lt_medio_ativo,
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
          -- "ativo faturando" = ativo + onboarding + triagem (carteira recorrente viva); is_churned = cancelado/inativo
          COUNT(*) FILTER (WHERE status IN ('ativo','onboarding','triagem')) AS n_ativos,
          COUNT(*) FILTER (WHERE is_churned) AS n_cancelados,
          ROUND(AVG(lt_meses) FILTER (WHERE is_churned AND NOT data_inconsistente), 1) AS lt_medio_cancelado,
          ROUND(AVG(lt_meses) FILTER (WHERE status IN ('ativo','onboarding','triagem') AND NOT data_inconsistente), 1) AS lt_medio_ativo,
          ROUND(AVG(lt_meses) FILTER (WHERE (status IN ('ativo','onboarding','triagem') OR is_churned) AND NOT data_inconsistente), 1) AS lt_medio_geral,
          ROUND(AVG(ltv_recorrente) FILTER (WHERE is_churned AND NOT data_inconsistente), 0) AS ltv_medio,
          ROUND(AVG(ltv_recorrente) FILTER (WHERE status IN ('ativo','onboarding','triagem') AND NOT data_inconsistente), 0) AS ltv_medio_ativo,
          ROUND(AVG(ltv_recorrente) FILTER (WHERE (status IN ('ativo','onboarding','triagem') OR is_churned) AND NOT data_inconsistente), 0) AS ltv_medio_geral,
          ROUND(SUM(valorr) FILTER (WHERE status IN ('ativo','onboarding','triagem'))::numeric, 0) AS mrr_ativo,
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
        ltMedioGeral: Number(r.lt_medio_geral) || 0,
        ltvMedio: Number(r.ltv_medio) || 0,
        ltvMedioAtivo: Number(r.ltv_medio_ativo) || 0,
        ltvMedioGeral: Number(r.ltv_medio_geral) || 0,
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
      // Sem filtro de produto: cup_data_hist e vw_cup_churn_ajustado usam taxonomias de
      // produto incompativeis (nomes limpos vs compostos com ';'), entao o revenue churn
      // mensal e sempre da OPERACAO INTEIRA (geral), como o benchmark.

      // MRR do inicio do mes vem do SNAPSHOT diario (cup_data_hist) — dado historico real,
      // nao reconstruido por datas. Churn vem da view curada vw_cup_churn_ajustado (por
      // data_solicitacao_encerramento; exclui churn abonado e motivos que nao sao churn de
      // cliente retido). O mes corrente (incompleto) e excluido.
      const rows = (await db.execute(sql`
        WITH meses AS (
          SELECT generate_series(
            date_trunc('month', CURRENT_DATE) - (${meses} || ' months')::interval,
            date_trunc('month', CURRENT_DATE) - interval '1 month', '1 month')::date AS m
        ),
        snap_ref AS (
          SELECT meses.m,
            COALESCE(
              (SELECT data_snapshot FROM "Clickup".cup_data_hist WHERE data_snapshot = meses.m LIMIT 1),
              (SELECT MIN(data_snapshot) FROM "Clickup".cup_data_hist WHERE date_trunc('month', data_snapshot) = meses.m)
            ) AS snap
          FROM meses
        ),
        mrr_ini AS (
          SELECT sr.m,
            ROUND(SUM(h.valorr) FILTER (WHERE h.status IN ('ativo','onboarding','triagem'))::numeric, 0) AS mrr
          FROM snap_ref sr
          JOIN "Clickup".cup_data_hist h ON h.data_snapshot = sr.snap
          GROUP BY sr.m
        ),
        churn AS (
          SELECT date_trunc('month', data_solicitacao_encerramento)::date AS m,
            ROUND(SUM(valor_r)::numeric, 0) AS perdido
          FROM cortex_core.vw_cup_churn_ajustado
          WHERE valor_r > 0
            AND COALESCE(abonar_churn,'') != 'Sim'
            AND COALESCE(motivo_cancelamento,'') NOT IN ('Inadimplente 1º Mês','Não começou','Erro na Venda')
          GROUP BY 1
        )
        SELECT to_char(mi.m,'YYYY-MM') AS mes,
          mi.mrr AS mrr_ativo_inicio,
          COALESCE(c.perdido, 0) AS mrr_perdido,
          ROUND((COALESCE(c.perdido,0)::numeric / NULLIF(mi.mrr,0) * 100), 1) AS rev_churn_pct
        FROM mrr_ini mi
        LEFT JOIN churn c ON c.m = mi.m
        ORDER BY mi.m
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

  app.get("/api/lt-ltv-churn/overview-clientes", async (req, res) => {
    try {
      const produto = (req.query.produto as string) || undefined;
      const status = (req.query.status as string) || undefined; // 'ativo' | 'cancelado'
      const situacao = status === "ativo" ? sql`ativo` : status === "cancelado" ? sql`NOT ativo` : sql`TRUE`;
      const r = (await db.execute(sql`
        SELECT
          COUNT(*) AS total_clientes,
          ROUND(AVG(ltv_total)::numeric, 0) AS ltv_medio_cliente,
          ROUND(AVG(lt_meses)::numeric, 1) AS lt_medio_cliente,
          ROUND(SUM(ltv_total)::numeric, 0) AS ltv_total_clientes
        FROM (
          SELECT id_task,
            BOOL_OR(is_ativo) AS ativo,
            SUM(COALESCE(ltv_recorrente,0)) + SUM(COALESCE(valorp,0)) AS ltv_total,
            -- LT do cliente = span SO dos contratos recorrentes (consistente com a tela de contratos)
            CASE WHEN BOOL_OR(is_ativo) FILTER (WHERE tipo_receita='recorrente') THEN (CURRENT_DATE - MIN(data_inicio) FILTER (WHERE tipo_receita='recorrente'))::numeric / 30.44
                 WHEN MAX(data_fim) FILTER (WHERE tipo_receita='recorrente' AND NOT data_inconsistente) >= MIN(data_inicio) FILTER (WHERE tipo_receita='recorrente')
                   THEN (MAX(data_fim) FILTER (WHERE tipo_receita='recorrente' AND NOT data_inconsistente) - MIN(data_inicio) FILTER (WHERE tipo_receita='recorrente'))::numeric / 30.44
                 ELSE NULL END AS lt_meses
          FROM cortex_core.vw_lt_contratos
          WHERE data_inicio IS NOT NULL
            ${produto ? sql`AND produto = ${produto}` : sql``}
          GROUP BY id_task
        ) cli
        WHERE ${situacao}
      `)).rows[0] || {};
      res.json({
        totalClientes: Number(r.total_clientes) || 0,
        ltvMedioCliente: Number(r.ltv_medio_cliente) || 0,
        ltMedioCliente: Number(r.lt_medio_cliente) || 0,
        ltvTotalClientes: Number(r.ltv_total_clientes) || 0,
      });
    } catch (error) {
      console.error("[api] Error fetching lt-ltv-churn overview-clientes:", error);
      res.status(500).json({ error: "Failed to fetch overview-clientes" });
    }
  });

  // Histograma de LT dos contratos (ativos vs cancelados por faixa)
  app.get("/api/lt-ltv-churn/dist-lt-contratos", async (req, res) => {
    try {
      const produto = (req.query.produto as string) || undefined;
      const rows = (await db.execute(sql`
        WITH f AS (
          SELECT is_ativo, is_churned,
            CASE WHEN lt_meses<3 THEN 1 WHEN lt_meses<6 THEN 2 WHEN lt_meses<12 THEN 3 WHEN lt_meses<24 THEN 4 ELSE 5 END AS ord
          FROM cortex_core.vw_lt_contratos
          WHERE tipo_receita='recorrente' AND lt_meses IS NOT NULL AND NOT data_inconsistente
            ${produto ? sql`AND produto = ${produto}` : sql``}
        )
        SELECT ord, (ARRAY['0-3m','3-6m','6-12m','12-24m','24m+'])[ord] AS faixa,
          COUNT(*) FILTER (WHERE is_ativo) AS ativos,
          COUNT(*) FILTER (WHERE is_churned) AS cancelados
        FROM f GROUP BY ord ORDER BY ord
      `)).rows;
      res.json({
        buckets: rows.map((r: any) => ({
          faixa: r.faixa,
          ativos: Number(r.ativos) || 0,
          cancelados: Number(r.cancelados) || 0,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching lt-ltv-churn dist-lt-contratos:", error);
      res.status(500).json({ error: "Failed to fetch dist-lt-contratos" });
    }
  });

  // Distribuicoes por cliente: LTV por faixa e LT por faixa
  app.get("/api/lt-ltv-churn/dist-clientes", async (req, res) => {
    try {
      const produto = (req.query.produto as string) || undefined;
      const status = (req.query.status as string) || undefined;
      const situacao = status === "ativo" ? sql`ativo` : status === "cancelado" ? sql`NOT ativo` : sql`TRUE`;
      const cli = sql`
        SELECT id_task,
          BOOL_OR(is_ativo) AS ativo,
          SUM(COALESCE(ltv_recorrente,0)) + SUM(COALESCE(valorp,0)) AS ltv,
          CASE WHEN BOOL_OR(is_ativo) FILTER (WHERE tipo_receita='recorrente') THEN (CURRENT_DATE - MIN(data_inicio) FILTER (WHERE tipo_receita='recorrente'))::numeric/30.44
               WHEN MAX(data_fim) FILTER (WHERE tipo_receita='recorrente' AND NOT data_inconsistente) >= MIN(data_inicio) FILTER (WHERE tipo_receita='recorrente')
                 THEN (MAX(data_fim) FILTER (WHERE tipo_receita='recorrente' AND NOT data_inconsistente) - MIN(data_inicio) FILTER (WHERE tipo_receita='recorrente'))::numeric/30.44
               ELSE NULL END AS lt
        FROM cortex_core.vw_lt_contratos
        WHERE data_inicio IS NOT NULL
          ${produto ? sql`AND produto = ${produto}` : sql``}
        GROUP BY id_task`;

      const ltvRows = (await db.execute(sql`
        SELECT ord, (ARRAY['0-5k','5-10k','10-20k','20-50k','50k+'])[ord] AS faixa, COUNT(*) AS qtd FROM (
          SELECT CASE WHEN ltv<5000 THEN 1 WHEN ltv<10000 THEN 2 WHEN ltv<20000 THEN 3 WHEN ltv<50000 THEN 4 ELSE 5 END AS ord
          FROM (${cli}) c WHERE ${situacao}
        ) a GROUP BY ord ORDER BY ord
      `)).rows;

      const ltRows = (await db.execute(sql`
        SELECT ord, (ARRAY['0-3m','3-6m','6-12m','12-24m','24m+'])[ord] AS faixa, COUNT(*) AS qtd FROM (
          SELECT CASE WHEN lt<3 THEN 1 WHEN lt<6 THEN 2 WHEN lt<12 THEN 3 WHEN lt<24 THEN 4 ELSE 5 END AS ord
          FROM (${cli}) c WHERE ${situacao} AND lt IS NOT NULL
        ) a GROUP BY ord ORDER BY ord
      `)).rows;

      res.json({
        ltv: ltvRows.map((r: any) => ({ faixa: r.faixa, qtd: Number(r.qtd) || 0 })),
        lt: ltRows.map((r: any) => ({ faixa: r.faixa, qtd: Number(r.qtd) || 0 })),
      });
    } catch (error) {
      console.error("[api] Error fetching lt-ltv-churn dist-clientes:", error);
      res.status(500).json({ error: "Failed to fetch dist-clientes" });
    }
  });

  app.get("/api/lt-ltv-churn/evolucao-produto", async (req, res) => {
    try {
      const rows = (await db.execute(sql`
        WITH meses AS (
          SELECT generate_series(date_trunc('month',CURRENT_DATE) - interval '12 months', date_trunc('month',CURRENT_DATE) - interval '1 month', '1 month')::date m
        ),
        snap_ref AS (
          SELECT meses.m, COALESCE(
            (SELECT data_snapshot FROM "Clickup".cup_data_hist WHERE data_snapshot = meses.m LIMIT 1),
            (SELECT MIN(data_snapshot) FROM "Clickup".cup_data_hist WHERE date_trunc('month',data_snapshot)=meses.m)
          ) snap FROM meses
        ),
        base AS (
          SELECT sr.m, h.produto, h.valorr, (h.data_snapshot - h.data_inicio)::numeric/30.44 AS lt
          FROM snap_ref sr JOIN "Clickup".cup_data_hist h ON h.data_snapshot = sr.snap
          WHERE h.status IN ('ativo','onboarding','triagem') AND h.valorr>0 AND h.data_snapshot >= h.data_inicio
        ),
        cobertura AS (
          SELECT m, COUNT(*) FILTER (WHERE produto IS NOT NULL)::numeric / NULLIF(COUNT(*),0) cob FROM base GROUP BY m
        )
        SELECT to_char(b.m,'YYYY-MM') AS mes, b.produto,
          ROUND(AVG(b.lt)::numeric,1) AS lt,
          ROUND(AVG(b.valorr*b.lt)::numeric,0) AS ltv
        FROM base b JOIN cobertura c ON c.m=b.m AND c.cob>=0.5
        WHERE b.produto IN ('Creators','Performance','Social Media')
        GROUP BY b.m, b.produto ORDER BY b.m, b.produto
      `)).rows as any[];

      const produtos = Array.from(new Set(rows.map((r) => r.produto)));
      const mesesList = Array.from(new Set(rows.map((r) => r.mes))).sort();
      const pivot = (campo: "lt" | "ltv") =>
        mesesList.map((mes) => {
          const ponto: Record<string, any> = { mes };
          for (const p of produtos) {
            const r = rows.find((x) => x.mes === mes && x.produto === p);
            if (r) ponto[p] = Number(r[campo]);
          }
          return ponto;
        });
      res.json({ produtos, lt: pivot("lt"), ltv: pivot("ltv") });
    } catch (error) {
      console.error("[api] Error fetching lt-ltv-churn evolucao-produto:", error);
      res.status(500).json({ error: "Failed to fetch evolucao-produto" });
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
          ROUND(SUM(COALESCE(valorp,0))::numeric, 0) AS ltv_pontual,
          ROUND((SUM(COALESCE(ltv_recorrente,0)) + SUM(COALESCE(valorp,0)))::numeric, 0) AS ltv_total,
          CASE
            WHEN BOOL_OR(is_ativo) FILTER (WHERE tipo_receita='recorrente')
              THEN ROUND((CURRENT_DATE - MIN(data_inicio) FILTER (WHERE tipo_receita='recorrente'))::numeric / 30.44, 1)
            WHEN MAX(data_fim) FILTER (WHERE tipo_receita='recorrente' AND NOT data_inconsistente) >= MIN(data_inicio) FILTER (WHERE tipo_receita='recorrente')
              THEN ROUND((MAX(data_fim) FILTER (WHERE tipo_receita='recorrente' AND NOT data_inconsistente) - MIN(data_inicio) FILTER (WHERE tipo_receita='recorrente'))::numeric / 30.44, 1)
            ELSE NULL
          END AS lt_meses,
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
          ltMeses: r.lt_meses != null ? Number(r.lt_meses) : null, ativo: r.ativo,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching lt-ltv-churn clientes:", error);
      res.status(500).json({ error: "Failed to fetch clientes" });
    }
  });
}
