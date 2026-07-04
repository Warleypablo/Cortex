import type { Express } from "express";
import { sql } from "drizzle-orm";
import {
  revenueChurnPct,
  resolveClienteSort,
  buildMatrizEvolucaoProduto,
  type ContratoMesRow,
} from "./ltLtvChurn.helpers";

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
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lt_meses) FILTER (WHERE is_churned AND NOT data_inconsistente)::numeric, 1) AS lt_mediana_cancelado,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lt_meses) FILTER (WHERE status IN ('ativo','onboarding','triagem') AND NOT data_inconsistente)::numeric, 1) AS lt_mediana_ativo,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lt_meses) FILTER (WHERE (status IN ('ativo','onboarding','triagem') OR is_churned) AND NOT data_inconsistente)::numeric, 1) AS lt_mediana_geral,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ltv_recorrente) FILTER (WHERE is_churned AND NOT data_inconsistente)::numeric, 0) AS ltv_mediana,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ltv_recorrente) FILTER (WHERE status IN ('ativo','onboarding','triagem') AND NOT data_inconsistente)::numeric, 0) AS ltv_mediana_ativo,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ltv_recorrente) FILTER (WHERE (status IN ('ativo','onboarding','triagem') OR is_churned) AND NOT data_inconsistente)::numeric, 0) AS ltv_mediana_geral,
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
        ltMedianaCancelado: Number(r.lt_mediana_cancelado) || 0,
        ltMedianaAtivo: Number(r.lt_mediana_ativo) || 0,
        ltMedianaGeral: Number(r.lt_mediana_geral) || 0,
        ltvMediana: Number(r.ltv_mediana) || 0,
        ltvMedianaAtivo: Number(r.ltv_mediana_ativo) || 0,
        ltvMedianaGeral: Number(r.ltv_mediana_geral) || 0,
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
          ROUND(AVG(b.valorr*b.lt)::numeric,0) AS ltv,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY b.lt)::numeric,1) AS lt_mediana,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY b.valorr*b.lt)::numeric,0) AS ltv_mediana
        FROM base b JOIN cobertura c ON c.m=b.m AND c.cob>=0.5
        WHERE b.produto IN ('Creators','Performance','Social Media')
        GROUP BY b.m, b.produto ORDER BY b.m, b.produto
      `)).rows as any[];

      const produtos = Array.from(new Set(rows.map((r) => r.produto)));
      const mesesList = Array.from(new Set(rows.map((r) => r.mes))).sort();
      const pivot = (campo: "lt" | "ltv" | "lt_mediana" | "ltv_mediana") =>
        mesesList.map((mes) => {
          const ponto: Record<string, any> = { mes };
          for (const p of produtos) {
            const r = rows.find((x) => x.mes === mes && x.produto === p);
            if (r) ponto[p] = Number(r[campo]);
          }
          return ponto;
        });
      res.json({
        produtos,
        lt: pivot("lt"),
        ltv: pivot("ltv"),
        lt_mediana: pivot("lt_mediana"),
        ltv_mediana: pivot("ltv_mediana"),
      });
    } catch (error) {
      console.error("[api] Error fetching lt-ltv-churn evolucao-produto:", error);
      res.status(500).json({ error: "Failed to fetch evolucao-produto" });
    }
  });

  app.get("/api/lt-ltv-churn/evolucao-produto-tabela", async (req, res) => {
    try {
      const raw = req.query.status as string;
      const status: "ativos" | "cancelados" | "todos" =
        raw === "cancelados" ? "cancelados" : raw === "todos" ? "todos" : "ativos";

      // Eixo de meses: do 1º snapshot (MIN(data_snapshot)) até o mês anterior — histórico
      // completo. Difere de propósito do gráfico (evolucao-produto), que usa janela móvel de
      // 12 meses; não "reconciliar" os dois.
      const mesesRows = (await db.execute(sql`
        SELECT to_char(d,'YYYY-MM') AS mes
        FROM generate_series(
          (SELECT date_trunc('month', MIN(data_snapshot)) FROM "Clickup".cup_data_hist),
          date_trunc('month', CURRENT_DATE) - interval '1 month',
          interval '1 month') d
        ORDER BY d
      `)).rows as { mes: string }[];
      const meses = mesesRows.map((r) => r.mes);

      // Guard: empty axis (cold/empty table — avoids BETWEEN undefined AND undefined)
      if (meses.length === 0) {
        return res.json({ meses: [], produtos: [], celulas: {} });
      }

      const minMes = meses[0];
      const maxMes = meses[meses.length - 1];

      // Date strings for parameterized generate_series (avoids repeated MIN scan inside ativos CTE)
      const minMesDate = `${minMes}-01`;
      const maxMesDate = `${maxMes}-01`;

      const rows: ContratoMesRow[] = [];

      if (status === "ativos" || status === "todos") {
        const ativos = (await db.execute(sql`
          WITH meses AS (
            SELECT to_char(d,'YYYY-MM') AS mes, d::date AS m
            FROM generate_series(${minMesDate}::date, ${maxMesDate}::date, interval '1 month') d
          ),
          snap_ref AS (
            SELECT meses.mes,
              (SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist
               WHERE date_trunc('month',data_snapshot)=meses.m) snap
            FROM meses
          ),
          base AS (
            SELECT sr.mes,
              -- classifica por produto e, quando ausente/instável, cai p/ servico
              -- (alinha com a aba Creators e estabiliza meses de produto corrompido)
              CASE
                WHEN TRIM(COALESCE(h.produto,'')) = 'Performance' THEN 'Performance'
                WHEN TRIM(COALESCE(h.produto,'')) = 'Creators' THEN 'Creators'
                WHEN TRIM(COALESCE(h.produto,'')) = 'Social Media' THEN 'Social Media'
                WHEN TRIM(COALESCE(h.produto,'')) <> '' THEN 'Outros'
                WHEN h.servico ILIKE '%creator%' THEN 'Creators'
                WHEN h.servico ILIKE '%performance%' THEN 'Performance'
                WHEN h.servico ILIKE '%social%' THEN 'Social Media'
                ELSE 'Outros' END AS produto,
              h.valorr,
              (h.data_snapshot - h.data_inicio)::numeric/30.44 AS lt
            FROM snap_ref sr
            JOIN "Clickup".cup_data_hist h ON h.data_snapshot = sr.snap
            WHERE h.status IN ('ativo','onboarding','triagem','pausado') AND h.valorr>0 AND h.data_snapshot >= h.data_inicio
          )
          SELECT b.mes, b.produto, b.lt::float8 AS lt, b.valorr::float8 AS valorr
          FROM base b
        `)).rows as any[];
        rows.push(...ativos.map((x) => ({
          mes: x.mes as string, produto: x.produto as string | null,
          lt: Number(x.lt), valorr: Number(x.valorr),
        })));
      }

      if (status === "cancelados" || status === "todos") {
        const cancelados = (await db.execute(sql`
          SELECT to_char(date_trunc('month', data_fim),'YYYY-MM') AS mes,
            CASE
              WHEN TRIM(COALESCE(produto,'')) = 'Performance' THEN 'Performance'
              WHEN TRIM(COALESCE(produto,'')) = 'Creators' THEN 'Creators'
              WHEN TRIM(COALESCE(produto,'')) = 'Social Media' THEN 'Social Media'
              WHEN TRIM(COALESCE(produto,'')) <> '' THEN 'Outros'
              WHEN servico ILIKE '%creator%' THEN 'Creators'
              WHEN servico ILIKE '%performance%' THEN 'Performance'
              WHEN servico ILIKE '%social%' THEN 'Social Media'
              ELSE 'Outros' END AS produto,
            lt_meses::float8 AS lt, valorr::float8 AS valorr
          FROM cortex_core.vw_lt_contratos
          WHERE tipo_receita='recorrente' AND is_churned AND NOT data_inconsistente
            AND data_fim IS NOT NULL
            AND to_char(date_trunc('month', data_fim),'YYYY-MM') BETWEEN ${minMes} AND ${maxMes}
        `)).rows as any[];
        rows.push(...cancelados.map((x) => ({
          mes: x.mes as string, produto: x.produto as string | null,
          lt: Number(x.lt), valorr: Number(x.valorr),
        })));
      }

      res.json(buildMatrizEvolucaoProduto(rows, meses));
    } catch (error) {
      console.error("[api] Error fetching lt-ltv-churn evolucao-produto-tabela:", error);
      res.status(500).json({ error: "Failed to fetch evolucao-produto-tabela" });
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

      const { col: sortCol, dir: sortDir } = resolveClienteSort(
        req.query.sort as string,
        req.query.dir as string,
      );

      const totalRes = await db.execute(sql`SELECT COUNT(*) AS total FROM (${baseAgg}) t`);
      const rows = (await db.execute(sql`
        SELECT * FROM (${baseAgg}) t
        ORDER BY ${sql.raw(sortCol)} ${sql.raw(sortDir)} NULLS LAST
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

  app.get("/api/lt-ltv-churn/evolucao-clientes", async (req, res) => {
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
        cli AS (
          SELECT sr.m, sr.snap, h.id_task,
            BOOL_OR(h.status IN ('ativo','onboarding','triagem') AND h.valorr>0) AS ativo,
            (sr.snap - MIN(h.data_inicio) FILTER (WHERE h.valorr>0 AND sr.snap>=h.data_inicio))::numeric/30.44 AS lt,
            COALESCE(SUM(h.valorr*(sr.snap-h.data_inicio)::numeric/30.44) FILTER (WHERE h.valorr>0 AND sr.snap>=h.data_inicio),0)
              + COALESCE(SUM(h.valorp) FILTER (WHERE h.valorp>0),0) AS ltv
          FROM snap_ref sr JOIN "Clickup".cup_data_hist h ON h.data_snapshot=sr.snap
          GROUP BY sr.m, sr.snap, h.id_task
        )
        SELECT to_char(m,'YYYY-MM') AS mes,
          ROUND(AVG(lt) FILTER (WHERE ativo)::numeric,1) AS lt,
          ROUND(AVG(ltv) FILTER (WHERE ativo)::numeric,0) AS ltv,
          ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY lt) FILTER (WHERE ativo))::numeric,1) AS lt_mediana,
          ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ltv) FILTER (WHERE ativo))::numeric,0) AS ltv_mediana
        FROM cli GROUP BY m ORDER BY m
      `)).rows;
      res.json({
        serie: rows.map((r: any) => ({
          mes: r.mes,
          lt: Number(r.lt) || 0,
          ltv: Number(r.ltv) || 0,
          ltMediana: Number(r.lt_mediana) || 0,
          ltvMediana: Number(r.ltv_mediana) || 0,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching lt-ltv-churn evolucao-clientes:", error);
      res.status(500).json({ error: "Failed to fetch evolucao-clientes" });
    }
  });

  // Base compartilhada da matriz de cohort e do seu drill de auditoria — mesma régua
  // da aba: só recorrentes, sem datas inconsistentes; churned sem data_fim não tem
  // lugar na linha do tempo e fica de fora (3 contratos hoje).
  const cohortBase = (produto?: string) => sql`
    SELECT id_task, id_subtask, nome_cliente, servico, valorr, status, is_ativo,
      data_inicio, data_fim,
      DATE_TRUNC('month', data_inicio)::date AS mes_ini,
      LEAST(
        DATE_TRUNC('month', CASE WHEN is_ativo THEN CURRENT_DATE ELSE data_fim END)::date,
        DATE_TRUNC('month', CURRENT_DATE)::date
      ) AS mes_fim
    FROM cortex_core.vw_lt_contratos
    WHERE tipo_receita = 'recorrente'
      AND data_inicio IS NOT NULL
      AND NOT data_inconsistente
      AND (is_ativo OR (is_churned AND data_fim IS NOT NULL))
      ${produto ? sql`AND produto = ${produto}` : sql``}
  `;

  // Matriz de cohort de retenção. unidade=contrato: safra = mês de data_inicio do
  // contrato, vivo até data_fim (cancelamento) ou hoje. unidade=cliente: safra = mês
  // do 1º contrato recorrente do cliente, vivo em cada mês em que tem >=1 contrato
  // vivo (gaps de churn-e-volta aparecem como queda e recuperação na mesma safra).
  app.get("/api/lt-ltv-churn/cohort", async (req, res) => {
    try {
      const produto = (req.query.produto as string) || undefined;
      const unidade = req.query.unidade === "contrato" ? "contrato" : "cliente";

      const base = cohortBase(produto);

      // Cada linha expandida = 1 contrato vivo naquele mês; n conta a unidade e mrr
      // soma o valorr dos contratos vivos. No modo cliente, contratos abertos DEPOIS
      // da safra também somam no MRR (expansão) — a régua de MRR vira uma NRR por
      // safra e pode passar de 100%.
      const result =
        unidade === "contrato"
          ? await db.execute(sql`
              WITH base AS (${base}),
              meses AS (
                SELECT mes_ini AS safra, valorr,
                  generate_series(mes_ini, mes_fim, interval '1 month')::date AS mes
                FROM base
              )
              SELECT TO_CHAR(safra, 'YYYY-MM') AS safra,
                (EXTRACT(YEAR FROM age(mes, safra)) * 12 + EXTRACT(MONTH FROM age(mes, safra)))::int AS offset_mes,
                COUNT(*)::int AS n,
                COALESCE(SUM(valorr), 0)::numeric AS mrr
              FROM meses
              GROUP BY safra, offset_mes
              ORDER BY safra, offset_mes
            `)
          : await db.execute(sql`
              WITH base AS (${base}),
              safra_cliente AS (
                SELECT id_task, MIN(mes_ini) AS safra FROM base GROUP BY id_task
              ),
              meses AS (
                SELECT b.id_task, s.safra, b.valorr,
                  generate_series(b.mes_ini, b.mes_fim, interval '1 month')::date AS mes
                FROM base b
                JOIN safra_cliente s USING (id_task)
              )
              SELECT TO_CHAR(safra, 'YYYY-MM') AS safra,
                (EXTRACT(YEAR FROM age(mes, safra)) * 12 + EXTRACT(MONTH FROM age(mes, safra)))::int AS offset_mes,
                COUNT(DISTINCT id_task)::int AS n,
                COALESCE(SUM(valorr), 0)::numeric AS mrr
              FROM meses
              GROUP BY safra, offset_mes
              ORDER BY safra, offset_mes
            `);

      // Monta por safra arrays densos de 0..offset máximo observável (até o mês
      // atual): offset sem linha = 0 vivos (diferente de célula futura, que não existe).
      const agora = new Date();
      const mesAtual = agora.getUTCFullYear() * 12 + agora.getUTCMonth();
      const porSafra = new Map<string, { cells: number[]; mrr: number[] }>();
      for (const r of result.rows as { safra: string; offset_mes: number; n: number; mrr: string }[]) {
        if (!porSafra.has(r.safra)) {
          const [ano, mes] = r.safra.split("-").map(Number);
          const maxOff = Math.max(0, mesAtual - (ano * 12 + (mes - 1)));
          porSafra.set(r.safra, {
            cells: new Array(maxOff + 1).fill(0),
            mrr: new Array(maxOff + 1).fill(0),
          });
        }
        const s = porSafra.get(r.safra)!;
        if (r.offset_mes < s.cells.length) {
          s.cells[r.offset_mes] = Number(r.n);
          s.mrr[r.offset_mes] = Math.round(Number(r.mrr) || 0);
        }
      }

      const safras = Array.from(porSafra.entries())
        .map(([safra, s]) => ({ safra, cells: s.cells, mrr: s.mrr }))
        .sort((a, b) => b.safra.localeCompare(a.safra));
      const maxOffset = safras.reduce((m, s) => Math.max(m, s.cells.length - 1), 0);

      res.json({ unidade, safras, maxOffset });
    } catch (error) {
      console.error("[api] Error fetching lt-ltv-churn cohort:", error);
      res.status(500).json({ error: "Failed to fetch cohort" });
    }
  });

  // Drill de auditoria de uma célula da matriz: lista nominal de quem estava vivo no
  // mês alvo (safra + offset) e de quem já tinha saído, reconciliando base -> célula.
  app.get("/api/lt-ltv-churn/cohort/detalhe", async (req, res) => {
    try {
      const produto = (req.query.produto as string) || undefined;
      const unidade = req.query.unidade === "contrato" ? "contrato" : "cliente";
      const safra = req.query.safra as string;
      const offset = parseInt(req.query.offset as string, 10);
      if (!/^\d{4}-\d{2}$/.test(safra || "") || !Number.isInteger(offset) || offset < 0) {
        return res.status(400).json({ error: "Params: safra=YYYY-MM, offset>=0" });
      }

      const base = cohortBase(produto);
      const safraDate = `${safra}-01`;

      if (unidade === "contrato") {
        const rows = (await db.execute(sql`
          WITH base AS (${base}),
          alvo AS (
            SELECT (${safraDate}::date + ${offset}::int * interval '1 month')::date AS mes
          )
          SELECT b.id_subtask, b.nome_cliente, b.servico, b.valorr, b.status,
            b.data_inicio, b.data_fim,
            (b.mes_fim >= a.mes) AS vivo
          FROM base b CROSS JOIN alvo a
          WHERE b.mes_ini = ${safraDate}::date
          ORDER BY (b.mes_fim >= a.mes) DESC, b.valorr DESC NULLS LAST
        `)).rows;
        return res.json({
          unidade, safra, offset,
          itens: rows.map((r: any) => ({
            id: r.id_subtask,
            nome: r.nome_cliente,
            servico: r.servico,
            valorr: Number(r.valorr) || 0,
            status: r.status,
            dataInicio: r.data_inicio,
            dataFim: r.data_fim,
            vivo: Boolean(r.vivo),
          })),
        });
      }

      const rows = (await db.execute(sql`
        WITH base AS (${base}),
        alvo AS (
          SELECT (${safraDate}::date + ${offset}::int * interval '1 month')::date AS mes
        ),
        safra_cliente AS (
          SELECT id_task, MIN(mes_ini) AS safra FROM base GROUP BY id_task
        )
        SELECT b.id_task,
          MAX(b.nome_cliente) AS nome_cliente,
          COUNT(*)::int AS n_contratos,
          COUNT(*) FILTER (WHERE b.mes_ini <= a.mes AND b.mes_fim >= a.mes)::int AS n_vivos,
          COALESCE(SUM(b.valorr) FILTER (WHERE b.mes_ini <= a.mes AND b.mes_fim >= a.mes), 0) AS mrr_vivo,
          BOOL_OR(b.mes_ini <= a.mes AND b.mes_fim >= a.mes) AS vivo,
          TO_CHAR(MAX(b.mes_fim) FILTER (WHERE b.mes_ini <= a.mes), 'YYYY-MM') AS ultimo_mes_vivo,
          BOOL_OR(b.mes_ini > a.mes) AS tem_contrato_posterior,
          BOOL_OR(b.is_ativo) AS ativo_hoje
        FROM base b
        JOIN safra_cliente s USING (id_task)
        CROSS JOIN alvo a
        WHERE s.safra = ${safraDate}::date
        GROUP BY b.id_task
        ORDER BY BOOL_OR(b.mes_ini <= a.mes AND b.mes_fim >= a.mes) DESC,
          COALESCE(SUM(b.valorr) FILTER (WHERE b.mes_ini <= a.mes AND b.mes_fim >= a.mes), 0) DESC
      `)).rows;
      res.json({
        unidade, safra, offset,
        itens: rows.map((r: any) => ({
          id: r.id_task,
          nome: r.nome_cliente,
          nContratos: Number(r.n_contratos) || 0,
          nVivos: Number(r.n_vivos) || 0,
          mrrVivo: Number(r.mrr_vivo) || 0,
          vivo: Boolean(r.vivo),
          ultimoMesVivo: r.ultimo_mes_vivo,
          temContratoPosterior: Boolean(r.tem_contrato_posterior),
          ativoHoje: Boolean(r.ativo_hoje),
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching lt-ltv-churn cohort detalhe:", error);
      res.status(500).json({ error: "Failed to fetch cohort detalhe" });
    }
  });
}
