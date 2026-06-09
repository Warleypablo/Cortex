import type { Express } from "express";
import { sql } from "drizzle-orm";

interface ViewRow {
  produto: string;
  motivo_cancelamento: string;
  cancelamentos: string | number;
  mrr_perdido: string | number;
  ticket_medio: string | number;
  pct_dentro_produto: string | number;
  pct_total: string | number;
}

export function registerChurnProdutoMotivoRoutes(app: Express, db: any) {
  app.get("/api/churn/produto-motivo", async (req, res) => {
    try {
      const now = new Date();
      const defaultStart = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().split("T")[0];
      const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

      // Aceita dataInicio e dataFim no formato YYYY-MM ou YYYY-MM-DD
      const rawInicio = String(req.query.dataInicio || "");
      const rawFim = String(req.query.dataFim || "");
      const startStr = rawInicio ? `${rawInicio.slice(0, 7)}-01` : defaultStart;
      const endStr = rawFim ? `${rawFim.slice(0, 7)}-01` : defaultEnd;

      const result = await db.execute(sql`
        SELECT produto, motivo_cancelamento,
               SUM(cancelamentos)::int AS cancelamentos,
               SUM(mrr_perdido)::numeric AS mrr_perdido,
               CASE WHEN SUM(cancelamentos) > 0
                    THEN SUM(mrr_perdido) / SUM(cancelamentos)
                    ELSE 0 END AS ticket_medio,
               0 AS pct_dentro_produto,
               0 AS pct_total
        FROM cortex_core.vw_churn_produto_motivo_mensal
        WHERE ano_mes >= ${startStr}::date
          AND ano_mes <= ${endStr}::date
        GROUP BY produto, motivo_cancelamento
        ORDER BY SUM(mrr_perdido) DESC, SUM(cancelamentos) DESC
      `);
      const data: ViewRow[] = result.rows;

      // Top 8 motivos por cancelamentos totais
      const motivoTotais = new Map<string, number>();
      data.forEach(r => {
        const m = r.motivo_cancelamento;
        motivoTotais.set(m, (motivoTotais.get(m) || 0) + Number(r.cancelamentos));
      });
      const motivosOrdenados = Array.from(motivoTotais.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([m]) => m);
      const top8 = motivosOrdenados.slice(0, 8);
      const temOutros = motivosOrdenados.length > 8;
      const motivos = temOutros ? top8.concat(["Outros"]) : top8;

      // Top 10 produtos ordenados por mrr_perdido total
      const produtoMrr = new Map<string, number>();
      data.forEach(r => {
        produtoMrr.set(r.produto, (produtoMrr.get(r.produto) || 0) + Number(r.mrr_perdido));
      });
      const produtos = Array.from(produtoMrr.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([p]) => p)
        .slice(0, 10);

      // Agregar células — apenas top10 produtos, motivos fora do top8 viram "Outros"
      const cellMap = new Map<string, {
        cancelamentos: number; mrr_perdido: number; ticket_soma: number;
      }>();
      data.forEach(r => {
        if (!produtos.includes(r.produto)) return;
        const motivo = top8.includes(r.motivo_cancelamento) ? r.motivo_cancelamento : "Outros";
        const key = `${r.produto}|||${motivo}`;
        const cur = cellMap.get(key) || { cancelamentos: 0, mrr_perdido: 0, ticket_soma: 0 };
        const qtd = Number(r.cancelamentos);
        cur.cancelamentos += qtd;
        cur.mrr_perdido += Number(r.mrr_perdido);
        cur.ticket_soma += Number(r.ticket_medio) * qtd;
        cellMap.set(key, cur);
      });

      // Recalcular pct_dentro_produto após merge de "Outros"
      const prodTotais = new Map<string, number>();
      cellMap.forEach((v, key) => {
        const prod = key.split("|||")[0];
        prodTotais.set(prod, (prodTotais.get(prod) || 0) + v.cancelamentos);
      });
      const totalCancelamentos = Array.from(prodTotais.values()).reduce((a, b) => a + b, 0);
      const totalMrr = Array.from(cellMap.values()).reduce((a, v) => a + v.mrr_perdido, 0);
      const totalTicketSoma = Array.from(cellMap.values()).reduce((a, v) => a + v.ticket_soma, 0);

      const celulas = Array.from(cellMap.entries()).map(([key, v]) => {
        const [produto, motivo_cancelamento] = key.split("|||");
        const prodTotal = prodTotais.get(produto) || 1;
        return {
          produto,
          motivo_cancelamento,
          cancelamentos: v.cancelamentos,
          mrr_perdido: Math.round(v.mrr_perdido * 100) / 100,
          ticket_medio: v.cancelamentos > 0
            ? Math.round((v.ticket_soma / v.cancelamentos) * 100) / 100
            : 0,
          pct_dentro_produto: Math.round((v.cancelamentos / prodTotal) * 10000) / 100,
          pct_total: Math.round((v.cancelamentos / totalCancelamentos) * 10000) / 100,
        };
      });

      res.json({
        produtos,
        motivos,
        celulas,
        totais: {
          cancelamentos: totalCancelamentos,
          mrr_perdido: Math.round(totalMrr * 100) / 100,
          ticket_medio: totalCancelamentos > 0
            ? Math.round((totalTicketSoma / totalCancelamentos) * 100) / 100
            : 0,
        },
      });
    } catch (error) {
      console.error("[api] Error fetching churn produto-motivo:", error);
      res.status(500).json({ error: "Failed to fetch churn produto-motivo" });
    }
  });

  app.get("/api/churn/squad-motivo", async (req, res) => {
    try {
      const now = new Date();
      const defaultStart = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().split("T")[0];
      const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

      const produto = String(req.query.produto || "");
      const rawInicio = String(req.query.dataInicio || "");
      const rawFim = String(req.query.dataFim || "");
      const startStr = rawInicio ? `${rawInicio.slice(0, 7)}-01` : defaultStart;
      const endStr = rawFim ? `${rawFim.slice(0, 7)}-01` : defaultEnd;

      if (!produto) return res.status(400).json({ error: "produto required" });

      const result = await db.execute(sql`
        SELECT
          COALESCE(squad, 'Sem Squad') AS squad,
          COALESCE(motivo_cancelamento, 'Não Informado') AS motivo_cancelamento,
          COUNT(*)::int AS cancelamentos,
          COALESCE(SUM(valor_r), 0)::numeric AS mrr_perdido
        FROM "Clickup".cup_churn
        WHERE produto = ${produto}
          AND ultimo_dia_operacao >= ${startStr}::date
          AND ultimo_dia_operacao <= ${endStr}::date
        GROUP BY 1, 2
        ORDER BY 1, 3 DESC
      `);

      const data = result.rows as { squad: string; motivo_cancelamento: string; cancelamentos: number; mrr_perdido: number }[];

      // Top 6 motivos
      const motivoTotais = new Map<string, number>();
      data.forEach(r => motivoTotais.set(r.motivo_cancelamento, (motivoTotais.get(r.motivo_cancelamento) || 0) + Number(r.cancelamentos)));
      const top6 = Array.from(motivoTotais.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([m]) => m);
      const temOutros = motivoTotais.size > 6;
      const motivos = temOutros ? [...top6, "Outros"] : top6;

      // Squads ordenados por total
      const squadTotais = new Map<string, number>();
      data.forEach(r => squadTotais.set(r.squad, (squadTotais.get(r.squad) || 0) + Number(r.cancelamentos)));
      const squads = Array.from(squadTotais.entries()).sort((a, b) => b[1] - a[1]).map(([s]) => s);

      // Células
      const cellMap = new Map<string, { cancelamentos: number; mrr_perdido: number }>();
      data.forEach(r => {
        const motivo = top6.includes(r.motivo_cancelamento) ? r.motivo_cancelamento : "Outros";
        const key = `${r.squad}|||${motivo}`;
        const cur = cellMap.get(key) || { cancelamentos: 0, mrr_perdido: 0 };
        cur.cancelamentos += Number(r.cancelamentos);
        cur.mrr_perdido += Number(r.mrr_perdido);
        cellMap.set(key, cur);
      });

      const celulas = Array.from(cellMap.entries()).map(([key, v]) => {
        const [squad, motivo_cancelamento] = key.split("|||");
        const squadTotal = squadTotais.get(squad) || 1;
        return {
          squad,
          motivo_cancelamento,
          cancelamentos: v.cancelamentos,
          mrr_perdido: Math.round(v.mrr_perdido * 100) / 100,
          pct_dentro_squad: Math.round((v.cancelamentos / squadTotal) * 10000) / 100,
        };
      });

      res.json({ squads, motivos, celulas });
    } catch (error) {
      console.error("[api] Error fetching squad-motivo:", error);
      res.status(500).json({ error: "Failed to fetch squad-motivo" });
    }
  });

  app.get("/api/churn/taxa-por-produto", async (req, res) => {
    const t0 = Date.now();
    try {
      console.log("[taxa-por-produto] iniciando query...");
      const SQUADS_EXCLUIDOS = ['🌟 Aurea','🗝️ Bloomfield','🔥 Chama','🏹 Hunters','👾 Squad X','👑 Supreme','🖥️ Tech','🚀 Turbo Interno'];

      const result = await db.execute(sql`
        WITH snapshot_datas AS (
          SELECT
            DATE_TRUNC('month', data_snapshot)::date AS mes,
            MAX(data_snapshot) AS data_snapshot
          FROM "Clickup".cup_data_hist
          WHERE data_snapshot >= CURRENT_DATE - INTERVAL '36 months'
          GROUP BY DATE_TRUNC('month', data_snapshot)::date
        ),
        mrr_por_produto AS (
          SELECT
            sd.mes,
            COALESCE(h.produto, 'Não Identificado') AS produto,
            SUM(h.valorr)::numeric AS mrr_base
          FROM snapshot_datas sd
          JOIN "Clickup".cup_data_hist h ON DATE(h.data_snapshot) = DATE(sd.data_snapshot)
          WHERE h.status IN ('ativo','onboarding','triagem')
            AND h.squad NOT IN (${SQUADS_EXCLUIDOS[0]},${SQUADS_EXCLUIDOS[1]},${SQUADS_EXCLUIDOS[2]},${SQUADS_EXCLUIDOS[3]},${SQUADS_EXCLUIDOS[4]},${SQUADS_EXCLUIDOS[5]},${SQUADS_EXCLUIDOS[6]},${SQUADS_EXCLUIDOS[7]})
          GROUP BY sd.mes, COALESCE(h.produto, 'Não Identificado')
        ),
        mrr_lagged_raw AS (
          SELECT
            mes,
            produto,
            mrr_base,
            LAG(mrr_base) OVER (PARTITION BY produto ORDER BY mes) AS mrr_base_lag
          FROM mrr_por_produto
        ),
        mrr_lagged AS (
          SELECT
            mes,
            produto,
            mrr_base,
            -- Se o snapshot anterior capturou < 30% do base atual, é anomalia de dados
            -- (ex: campo produto ausente naquele mês). Retorna NULL → COALESCE usa mrr_base atual.
            CASE
              WHEN mrr_base_lag IS NULL THEN NULL
              WHEN mrr_base > 0 AND mrr_base_lag < mrr_base * 0.3 THEN NULL
              ELSE mrr_base_lag
            END AS mrr_base_anterior
          FROM mrr_lagged_raw
        ),
        churn_por_produto AS (
          SELECT
            DATE_TRUNC('month', data_solicitacao_encerramento)::date AS mes,
            COALESCE(produto, 'Não Identificado') AS produto,
            COALESCE(SUM(valor_r), 0)::numeric AS mrr_churn,
            COUNT(*)::int AS cancelamentos
          FROM cortex_core.vw_cup_churn_ajustado
          WHERE valor_r > 0
            AND data_solicitacao_encerramento IS NOT NULL
            AND COALESCE(abonar_churn, '') != 'Sim'
            AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês','Não começou','Erro na Venda')
            AND squad NOT IN (${SQUADS_EXCLUIDOS[0]},${SQUADS_EXCLUIDOS[1]},${SQUADS_EXCLUIDOS[2]},${SQUADS_EXCLUIDOS[3]},${SQUADS_EXCLUIDOS[4]},${SQUADS_EXCLUIDOS[5]},${SQUADS_EXCLUIDOS[6]},${SQUADS_EXCLUIDOS[7]})
          GROUP BY DATE_TRUNC('month', data_solicitacao_encerramento)::date,
                   COALESCE(produto, 'Não Identificado')
        )
        SELECT
          TO_CHAR(m.mes, 'YYYY-MM') AS mes,
          m.produto,
          ROUND(COALESCE(m.mrr_base_anterior, m.mrr_base), 2) AS mrr_base,
          COALESCE(c.mrr_churn, 0) AS mrr_churn,
          COALESCE(c.cancelamentos, 0) AS cancelamentos,
          CASE WHEN COALESCE(m.mrr_base_anterior, m.mrr_base) > 0
            THEN ROUND(COALESCE(c.mrr_churn, 0) / COALESCE(m.mrr_base_anterior, m.mrr_base) * 100, 2)
            ELSE 0
          END AS taxa
        FROM mrr_lagged m
        LEFT JOIN churn_por_produto c ON c.mes = m.mes AND c.produto = m.produto
        WHERE m.mrr_base > 0 OR c.mrr_churn IS NOT NULL
        ORDER BY m.mes, m.produto
      `);

      console.log(`[taxa-por-produto] OK em ${Date.now()-t0}ms, ${result.rows.length} rows`);
      res.json({ rows: result.rows });
    } catch (error) {
      console.error(`[taxa-por-produto] ERRO em ${Date.now()-t0}ms:`, error);
      res.status(500).json({ error: "Failed to fetch taxa-por-produto" });
    }
  });

  app.get("/api/churn/taxa-mensal", async (req, res) => {
    try {
      const now = new Date();
      const defaultStart = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().split("T")[0];
      const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      const rawInicio = String(req.query.dataInicio || "");
      const rawFim = String(req.query.dataFim || "");
      const startStr = rawInicio ? `${rawInicio.slice(0, 7)}-01` : defaultStart;
      const endStr = rawFim ? `${rawFim.slice(0, 7)}-01` : defaultEnd;

      const SQUADS_EXCLUIDOS = ['🌟 Aurea','🗝️ Bloomfield','🔥 Chama','🏹 Hunters','👾 Squad X','👑 Supreme','🖥️ Tech','🚀 Turbo Interno'];

      const result = await db.execute(sql`
        WITH meses_range AS (
          SELECT generate_series(
            DATE_TRUNC('month', ${startStr}::date),
            DATE_TRUNC('month', ${endStr}::date),
            '1 month'::interval
          )::date AS mes
        ),
        snapshots_mensais AS (
          SELECT
            mr.mes,
            COALESCE(
              (SELECT data_snapshot FROM "Clickup".cup_data_hist
               WHERE data_snapshot = (mr.mes + INTERVAL '1 month')::date LIMIT 1),
              (SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist
               WHERE DATE_TRUNC('month', data_snapshot) = mr.mes)
            ) AS data_snapshot
          FROM meses_range mr
        ),
        mrr_base AS (
          SELECT
            sm.mes,
            COALESCE(SUM(h.valorr), 0)::numeric AS mrr_base
          FROM snapshots_mensais sm
          LEFT JOIN "Clickup".cup_data_hist h
            ON DATE(h.data_snapshot) = DATE(sm.data_snapshot)
            AND h.status IN ('ativo','onboarding','triagem')
            AND h.squad NOT IN (${SQUADS_EXCLUIDOS[0]},${SQUADS_EXCLUIDOS[1]},${SQUADS_EXCLUIDOS[2]},${SQUADS_EXCLUIDOS[3]},${SQUADS_EXCLUIDOS[4]},${SQUADS_EXCLUIDOS[5]},${SQUADS_EXCLUIDOS[6]},${SQUADS_EXCLUIDOS[7]})
          WHERE sm.data_snapshot IS NOT NULL
          GROUP BY sm.mes
        ),
        churn_mes AS (
          SELECT
            DATE_TRUNC('month', data_solicitacao_encerramento)::date AS mes,
            COALESCE(SUM(valor_r), 0)::numeric AS mrr_churn,
            COUNT(*)::int AS cancelamentos
          FROM cortex_core.vw_cup_churn_ajustado
          WHERE valor_r > 0
            AND data_solicitacao_encerramento IS NOT NULL
            AND data_solicitacao_encerramento >= ${startStr}::date
            AND data_solicitacao_encerramento <= ${endStr}::date
            AND COALESCE(abonar_churn, '') != 'Sim'
            AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês','Não começou','Erro na Venda')
            AND squad NOT IN (${SQUADS_EXCLUIDOS[0]},${SQUADS_EXCLUIDOS[1]},${SQUADS_EXCLUIDOS[2]},${SQUADS_EXCLUIDOS[3]},${SQUADS_EXCLUIDOS[4]},${SQUADS_EXCLUIDOS[5]},${SQUADS_EXCLUIDOS[6]},${SQUADS_EXCLUIDOS[7]})
          GROUP BY DATE_TRUNC('month', data_solicitacao_encerramento)::date
        )
        SELECT
          TO_CHAR(b.mes, 'YYYY-MM') AS mes,
          ROUND(b.mrr_base, 2) AS mrr_base,
          COALESCE(c.mrr_churn, 0) AS mrr_churn,
          COALESCE(c.cancelamentos, 0) AS cancelamentos,
          CASE WHEN b.mrr_base > 0
            THEN ROUND(COALESCE(c.mrr_churn, 0) / b.mrr_base * 100, 2)
            ELSE 0
          END AS taxa
        FROM mrr_base b
        LEFT JOIN churn_mes c ON c.mes = b.mes
        ORDER BY b.mes
      `);

      res.json({ rows: result.rows });
    } catch (error) {
      console.error("[api] Error fetching taxa-mensal:", error);
      res.status(500).json({ error: "Failed to fetch taxa-mensal" });
    }
  });

  app.get("/api/churn/taxa-por-motivo", async (req, res) => {
    const t0 = Date.now();
    try {
      const SQUADS_EXCLUIDOS = ['🌟 Aurea','🗝️ Bloomfield','🔥 Chama','🏹 Hunters','👾 Squad X','👑 Supreme','🖥️ Tech','🚀 Turbo Interno'];

      const result = await db.execute(sql`
        WITH snapshot_datas AS (
          SELECT
            DATE_TRUNC('month', data_snapshot)::date AS mes,
            MAX(data_snapshot) AS data_snapshot
          FROM "Clickup".cup_data_hist
          WHERE data_snapshot >= CURRENT_DATE - INTERVAL '36 months'
          GROUP BY DATE_TRUNC('month', data_snapshot)::date
        ),
        mrr_base AS (
          SELECT
            sd.mes,
            COALESCE(SUM(h.valorr), 0)::numeric AS mrr_base
          FROM snapshot_datas sd
          JOIN "Clickup".cup_data_hist h ON DATE(h.data_snapshot) = DATE(sd.data_snapshot)
          WHERE h.status IN ('ativo','onboarding','triagem')
            AND h.squad NOT IN (${SQUADS_EXCLUIDOS[0]},${SQUADS_EXCLUIDOS[1]},${SQUADS_EXCLUIDOS[2]},${SQUADS_EXCLUIDOS[3]},${SQUADS_EXCLUIDOS[4]},${SQUADS_EXCLUIDOS[5]},${SQUADS_EXCLUIDOS[6]},${SQUADS_EXCLUIDOS[7]})
          GROUP BY sd.mes
        ),
        churn_motivo AS (
          SELECT
            DATE_TRUNC('month', data_solicitacao_encerramento)::date AS mes,
            COALESCE(motivo_cancelamento, 'Não Informado') AS motivo,
            COALESCE(SUM(valor_r), 0)::numeric AS mrr_churn
          FROM cortex_core.vw_cup_churn_ajustado
          WHERE valor_r > 0
            AND data_solicitacao_encerramento IS NOT NULL
            AND COALESCE(abonar_churn, '') != 'Sim'
            AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês','Não começou','Erro na Venda')
            AND squad NOT IN (${SQUADS_EXCLUIDOS[0]},${SQUADS_EXCLUIDOS[1]},${SQUADS_EXCLUIDOS[2]},${SQUADS_EXCLUIDOS[3]},${SQUADS_EXCLUIDOS[4]},${SQUADS_EXCLUIDOS[5]},${SQUADS_EXCLUIDOS[6]},${SQUADS_EXCLUIDOS[7]})
          GROUP BY DATE_TRUNC('month', data_solicitacao_encerramento)::date,
                   COALESCE(motivo_cancelamento, 'Não Informado')
        )
        SELECT
          TO_CHAR(b.mes, 'YYYY-MM') AS mes,
          c.motivo,
          ROUND(b.mrr_base, 2) AS mrr_base,
          ROUND(c.mrr_churn, 2) AS mrr_churn,
          CASE WHEN b.mrr_base > 0
            THEN ROUND(c.mrr_churn / b.mrr_base * 100, 2)
            ELSE 0
          END AS taxa
        FROM mrr_base b
        JOIN churn_motivo c ON c.mes = b.mes
        ORDER BY b.mes, c.mrr_churn DESC
      `);

      console.log(`[taxa-por-motivo] OK em ${Date.now()-t0}ms, ${result.rows.length} rows`);
      res.json({ rows: result.rows });
    } catch (error) {
      console.error(`[taxa-por-motivo] ERRO em ${Date.now()-t0}ms:`, error);
      res.status(500).json({ error: "Failed to fetch taxa-por-motivo" });
    }
  });

  app.get("/api/churn/produto-mes-detalhe", async (req, res) => {
    const produto = String(req.query.produto || "");
    const mes = String(req.query.mes || ""); // formato YYYY-MM
    if (!produto || !mes) {
      return res.status(400).json({ error: "produto e mes são obrigatórios" });
    }
    if (!/^\d{4}-\d{2}$/.test(mes)) {
      return res.status(400).json({ error: "mes deve estar no formato YYYY-MM" });
    }
    const mesDate = `${mes}-01`;
    const SQUADS_EXCLUIDOS = ['🌟 Aurea','🗝️ Bloomfield','🔥 Chama','🏹 Hunters','👾 Squad X','👑 Supreme','🖥️ Tech','🚀 Turbo Interno'];

    try {
      const [totaisResult, squadResult, operadorResult, contratosResult] = await Promise.all([
        // Query 1 — totais + LTV mediano
        db.execute(sql`
          SELECT
            COUNT(*)::int AS total_cancelamentos,
            COALESCE(SUM(valor_r), 0)::numeric AS total_mrr,
            COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY
              valor_r * GREATEST(
                EXTRACT(YEAR FROM AGE(data_solicitacao_encerramento,
                  COALESCE(data_primeiro_pagamento, data_criado))) * 12
                + EXTRACT(MONTH FROM AGE(data_solicitacao_encerramento,
                  COALESCE(data_primeiro_pagamento, data_criado))),
                1
              )
            ), 0)::numeric AS ltv_mediano
          FROM cortex_core.vw_cup_churn_ajustado
          WHERE valor_r > 0
            AND data_solicitacao_encerramento IS NOT NULL
            AND DATE_TRUNC('month', data_solicitacao_encerramento)::date = ${mesDate}::date
            AND COALESCE(abonar_churn, '') != 'Sim'
            AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês','Não começou','Erro na Venda')
            AND squad NOT IN (${SQUADS_EXCLUIDOS[0]},${SQUADS_EXCLUIDOS[1]},${SQUADS_EXCLUIDOS[2]},${SQUADS_EXCLUIDOS[3]},${SQUADS_EXCLUIDOS[4]},${SQUADS_EXCLUIDOS[5]},${SQUADS_EXCLUIDOS[6]},${SQUADS_EXCLUIDOS[7]})
            AND COALESCE(produto, 'Não Identificado') = ${produto}
        `),
        // Query 2 — por squad
        db.execute(sql`
          SELECT
            COALESCE(squad, 'Não Informado') AS squad,
            COUNT(*)::int AS cancelamentos,
            COALESCE(SUM(valor_r), 0)::numeric AS mrr
          FROM cortex_core.vw_cup_churn_ajustado
          WHERE valor_r > 0
            AND data_solicitacao_encerramento IS NOT NULL
            AND DATE_TRUNC('month', data_solicitacao_encerramento)::date = ${mesDate}::date
            AND COALESCE(abonar_churn, '') != 'Sim'
            AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês','Não começou','Erro na Venda')
            AND squad NOT IN (${SQUADS_EXCLUIDOS[0]},${SQUADS_EXCLUIDOS[1]},${SQUADS_EXCLUIDOS[2]},${SQUADS_EXCLUIDOS[3]},${SQUADS_EXCLUIDOS[4]},${SQUADS_EXCLUIDOS[5]},${SQUADS_EXCLUIDOS[6]},${SQUADS_EXCLUIDOS[7]})
            AND COALESCE(produto, 'Não Identificado') = ${produto}
          GROUP BY COALESCE(squad, 'Não Informado')
          ORDER BY cancelamentos DESC
        `),
        // Query 3 — por operador
        db.execute(sql`
          SELECT
            COALESCE(responsavel_geral, 'Não Informado') AS operador,
            COUNT(*)::int AS cancelamentos,
            COALESCE(SUM(valor_r), 0)::numeric AS mrr
          FROM cortex_core.vw_cup_churn_ajustado
          WHERE valor_r > 0
            AND data_solicitacao_encerramento IS NOT NULL
            AND DATE_TRUNC('month', data_solicitacao_encerramento)::date = ${mesDate}::date
            AND COALESCE(abonar_churn, '') != 'Sim'
            AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês','Não começou','Erro na Venda')
            AND squad NOT IN (${SQUADS_EXCLUIDOS[0]},${SQUADS_EXCLUIDOS[1]},${SQUADS_EXCLUIDOS[2]},${SQUADS_EXCLUIDOS[3]},${SQUADS_EXCLUIDOS[4]},${SQUADS_EXCLUIDOS[5]},${SQUADS_EXCLUIDOS[6]},${SQUADS_EXCLUIDOS[7]})
            AND COALESCE(produto, 'Não Identificado') = ${produto}
          GROUP BY COALESCE(responsavel_geral, 'Não Informado')
          ORDER BY cancelamentos DESC
        `),
        // Query 4 — lista de contratos
        db.execute(sql`
          SELECT
            COALESCE(nome, 'Sem nome') AS nome,
            COALESCE(squad, 'Não Informado') AS squad,
            COALESCE(responsavel_geral, 'Não Informado') AS operador,
            valor_r,
            COALESCE(motivo_cancelamento, 'Não Informado') AS motivo
          FROM cortex_core.vw_cup_churn_ajustado
          WHERE valor_r > 0
            AND data_solicitacao_encerramento IS NOT NULL
            AND DATE_TRUNC('month', data_solicitacao_encerramento)::date = ${mesDate}::date
            AND COALESCE(abonar_churn, '') != 'Sim'
            AND COALESCE(motivo_cancelamento, '') NOT IN ('Inadimplente 1º Mês','Não começou','Erro na Venda')
            AND squad NOT IN (${SQUADS_EXCLUIDOS[0]},${SQUADS_EXCLUIDOS[1]},${SQUADS_EXCLUIDOS[2]},${SQUADS_EXCLUIDOS[3]},${SQUADS_EXCLUIDOS[4]},${SQUADS_EXCLUIDOS[5]},${SQUADS_EXCLUIDOS[6]},${SQUADS_EXCLUIDOS[7]})
            AND COALESCE(produto, 'Não Identificado') = ${produto}
          ORDER BY valor_r DESC
          LIMIT 200
        `),
      ]);

      const totais = totaisResult.rows[0] as { total_cancelamentos: number; total_mrr: string; ltv_mediano: string };
      const totalCancelamentos = Number(totais.total_cancelamentos) || 0;

      const squads = (squadResult.rows as { squad: string; cancelamentos: number; mrr: string }[]).map(r => ({
        squad: r.squad,
        cancelamentos: Number(r.cancelamentos),
        mrr: Number(r.mrr),
        pct: totalCancelamentos > 0 ? Math.round(Number(r.cancelamentos) / totalCancelamentos * 10000) / 100 : 0,
      }));

      const operadores = (operadorResult.rows as { operador: string; cancelamentos: number; mrr: string }[]).map(r => ({
        operador: r.operador,
        cancelamentos: Number(r.cancelamentos),
        mrr: Number(r.mrr),
        pct: totalCancelamentos > 0 ? Math.round(Number(r.cancelamentos) / totalCancelamentos * 10000) / 100 : 0,
      }));

      res.json({
        produto,
        mes,
        total_cancelamentos: totalCancelamentos,
        total_mrr: Number(totais.total_mrr),
        ltv_mediano: Number(totais.ltv_mediano),
        squads,
        operadores,
        contratos: (contratosResult.rows as { nome: string; squad: string; operador: string; valor_r: string; motivo: string }[]).map(r => ({
          nome: r.nome,
          squad: r.squad,
          operador: r.operador,
          valor_r: Number(r.valor_r) || 0,
          motivo: r.motivo,
        })),
      });
    } catch (error) {
      console.error("[produto-mes-detalhe] erro:", error);
      res.status(500).json({ error: "Failed to fetch produto-mes-detalhe" });
    }
  });

  app.get("/api/churn/produto-motivo/mensal", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          to_char(ano_mes, 'YYYY-MM-DD') AS ano_mes,
          produto,
          motivo_cancelamento,
          cancelamentos,
          mrr_perdido,
          ticket_medio
        FROM cortex_core.vw_churn_produto_motivo_mensal
        ORDER BY ano_mes DESC, mrr_perdido DESC
      `);
      res.json({ rows: result.rows });
    } catch (error) {
      console.error("[api] Error fetching churn produto-motivo mensal:", error);
      res.status(500).json({ error: "Failed to fetch churn produto-motivo mensal" });
    }
  });

}
