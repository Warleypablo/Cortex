import type { Express } from "express";
import { sql } from "drizzle-orm";

// Creators pontual (vendas/historico): produto Creators com valor pontual.
const CREATORS = sql`produto ILIKE '%creators%' AND valorp > 0`;
// Em estoque (nao entregue/cancelado). Mesma definicao com alias para /itens.
const ESTOQUE = sql`status NOT IN ('entregue','cancelado/inativo','não usar')`;
const CREATORS_C = sql`c.produto ILIKE '%creators%' AND c.valorp > 0`;
const ESTOQUE_C = sql`c.status NOT IN ('entregue','cancelado/inativo','não usar')`;

export function registerCreatorsPontualRoutes(app: Express, db: any) {
  // KPIs do estoque de Creators
  app.get("/api/creators-pontual/overview", async (_req, res) => {
    try {
      const r = (await db.execute(sql`
        SELECT
          ROUND(SUM(valorp)::numeric, 0) AS valor_estoque,
          COUNT(*) AS qtd_itens,
          ROUND(AVG(valorp)::numeric, 0) AS ticket_medio,
          ROUND(AVG(GREATEST(CURRENT_DATE - data_criado, 0)) FILTER (WHERE data_criado IS NOT NULL), 0) AS idade_media,
          ROUND(SUM(valorp) FILTER (WHERE status = 'triagem')::numeric, 0) AS valor_triagem,
          ROUND(100.0 * SUM(valorp) FILTER (WHERE status = 'triagem') / NULLIF(SUM(valorp), 0), 1) AS pct_triagem
        FROM "Clickup".cup_contratos
        WHERE ${CREATORS} AND ${ESTOQUE}
      `)).rows[0] || {};
      res.json({
        valorEstoque: Number(r.valor_estoque) || 0,
        qtdItens: Number(r.qtd_itens) || 0,
        ticketMedio: Number(r.ticket_medio) || 0,
        idadeMedia: Number(r.idade_media) || 0,
        valorTriagem: Number(r.valor_triagem) || 0,
        pctTriagem: Number(r.pct_triagem) || 0,
      });
    } catch (error) {
      console.error("[api] Error fetching creators-pontual overview:", error);
      res.status(500).json({ error: "Failed to fetch overview" });
    }
  });

  // Funil por status do estoque
  app.get("/api/creators-pontual/funil", async (_req, res) => {
    try {
      const rows = (await db.execute(sql`
        SELECT status, COUNT(*) AS qtd, ROUND(SUM(valorp)::numeric, 0) AS valor
        FROM "Clickup".cup_contratos c
        WHERE ${CREATORS_C} AND ${ESTOQUE_C}
          AND NOT (
            c.status = 'triagem'
            AND EXISTS (
              SELECT 1 FROM "Clickup".cup_contratos c2
              WHERE c2.id_task = c.id_task
                AND c2.valorp > 0
                AND c2.status IN ('ativo','onboarding','pausado')
            )
          )
        GROUP BY status
        ORDER BY valor DESC NULLS LAST
      `)).rows;
      res.json({
        status: rows.map((r: any) => ({
          status: r.status, qtd: Number(r.qtd) || 0, valor: Number(r.valor) || 0,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching creators-pontual funil:", error);
      res.status(500).json({ error: "Failed to fetch funil" });
    }
  });

  // Fluxo: entradas (data_criado) x entregas (data_entrega) por mes — só Creators
  app.get("/api/creators-pontual/fluxo", async (req, res) => {
    try {
      const meses = Math.min(Math.max(parseInt(req.query.meses as string) || 8, 1), 24);
      const rows = (await db.execute(sql`
        WITH meses AS (
          SELECT generate_series(
            date_trunc('month', CURRENT_DATE) - (${meses - 1} || ' months')::interval,
            date_trunc('month', CURRENT_DATE), '1 month')::date AS m
        )
        SELECT to_char(meses.m, 'YYYY-MM') AS mes,
          (SELECT COUNT(*) FROM "Clickup".cup_contratos
           WHERE ${CREATORS} AND date_trunc('month', data_criado) = meses.m) AS entradas,
          (SELECT ROUND(COALESCE(SUM(valorp),0)::numeric,0) FROM "Clickup".cup_contratos
           WHERE ${CREATORS} AND date_trunc('month', data_criado) = meses.m) AS val_entrada,
          (SELECT COUNT(*) FROM "Clickup".cup_contratos
           WHERE ${CREATORS} AND date_trunc('month', data_entrega) = meses.m) AS entregas,
          (SELECT ROUND(COALESCE(SUM(valorp),0)::numeric,0) FROM "Clickup".cup_contratos
           WHERE ${CREATORS} AND date_trunc('month', data_entrega) = meses.m) AS val_entregue
        FROM meses ORDER BY meses.m
      `)).rows;
      res.json({
        serie: rows.map((r: any) => ({
          mes: r.mes,
          entradas: Number(r.entradas) || 0,
          valEntrada: Number(r.val_entrada) || 0,
          entregas: Number(r.entregas) || 0,
          valEntregue: Number(r.val_entregue) || 0,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching creators-pontual fluxo:", error);
      res.status(500).json({ error: "Failed to fetch fluxo" });
    }
  });

  // Evolucao do estoque (cup_data_hist, ILIKE '%creator%' capta compostos antigos)
  app.get("/api/creators-pontual/evolucao", async (req, res) => {
    try {
      const meses = Math.min(Math.max(parseInt(req.query.meses as string) || 8, 1), 24);
      const rows = (await db.execute(sql`
        WITH meses AS (
          SELECT generate_series(
            date_trunc('month', CURRENT_DATE) - (${meses - 1} || ' months')::interval,
            date_trunc('month', CURRENT_DATE), '1 month')::date AS m
        ),
        snap AS (
          SELECT meses.m,
            (SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist
             WHERE date_trunc('month', data_snapshot) = meses.m) AS snap_ref
          FROM meses
        )
        -- INNER JOIN intencional: meses sem snapshot sao omitidos (mostrar R$0 seria enganoso)
        SELECT to_char(s.m, 'YYYY-MM') AS mes,
          COUNT(*) FILTER (WHERE h.produto ILIKE '%creator%' AND h.valorp > 0
            AND h.status NOT IN ('entregue','cancelado/inativo','não usar')) AS qtd_estoque,
          ROUND(SUM(h.valorp) FILTER (WHERE h.produto ILIKE '%creator%' AND h.valorp > 0
            AND h.status NOT IN ('entregue','cancelado/inativo','não usar'))::numeric, 0) AS valor_estoque
        FROM snap s
        JOIN "Clickup".cup_data_hist h ON h.data_snapshot = s.snap_ref
        GROUP BY s.m ORDER BY s.m
      `)).rows;
      res.json({
        serie: rows.map((r: any) => ({
          mes: r.mes,
          valorEstoque: Number(r.valor_estoque) || 0,
          qtdEstoque: Number(r.qtd_estoque) || 0,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching creators-pontual evolucao:", error);
      res.status(500).json({ error: "Failed to fetch evolucao" });
    }
  });

  // Produtividade por operador (responsavel, com trim)
  app.get("/api/creators-pontual/operadores", async (_req, res) => {
    try {
      const rows = (await db.execute(sql`
        SELECT TRIM(responsavel) AS operador,
          COUNT(*) FILTER (WHERE ${ESTOQUE}) AS aberto,
          ROUND(SUM(valorp) FILTER (WHERE ${ESTOQUE})::numeric, 0) AS val_aberto,
          COUNT(*) FILTER (WHERE status = 'entregue') AS entregue,
          ROUND(AVG((data_entrega - data_criado)) FILTER (
            WHERE status = 'entregue' AND data_entrega >= data_criado), 0) AS ciclo_medio_dias,
          ROUND(AVG(GREATEST(CURRENT_DATE - data_criado, 0)) FILTER (WHERE ${ESTOQUE}), 0) AS idade_backlog_dias
        FROM "Clickup".cup_contratos
        WHERE ${CREATORS} AND TRIM(COALESCE(responsavel, '')) <> ''
        GROUP BY TRIM(responsavel)
        ORDER BY aberto DESC NULLS LAST
      `)).rows;
      res.json({
        operadores: rows.map((r: any) => ({
          operador: r.operador,
          aberto: Number(r.aberto) || 0,
          valAberto: Number(r.val_aberto) || 0,
          entregue: Number(r.entregue) || 0,
          cicloMedioDias: r.ciclo_medio_dias != null ? Number(r.ciclo_medio_dias) : null,
          idadeBacklogDias: r.idade_backlog_dias != null ? Number(r.idade_backlog_dias) : null,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching creators-pontual operadores:", error);
      res.status(500).json({ error: "Failed to fetch operadores" });
    }
  });

  // Ranking de vendedores (vendas = todos Creators valorp>0) + agregado sem vendedor
  app.get("/api/creators-pontual/vendedores", async (_req, res) => {
    try {
      const rows = (await db.execute(sql`
        SELECT TRIM(vendedor) AS vendedor, COUNT(*) AS qtd, ROUND(SUM(valorp)::numeric, 0) AS valor
        FROM "Clickup".cup_contratos
        WHERE ${CREATORS} AND TRIM(COALESCE(vendedor, '')) <> ''
        GROUP BY TRIM(vendedor)
        ORDER BY qtd DESC
      `)).rows;
      const sem = (await db.execute(sql`
        SELECT COUNT(*) AS qtd, ROUND(SUM(valorp)::numeric, 0) AS valor
        FROM "Clickup".cup_contratos
        WHERE ${CREATORS} AND TRIM(COALESCE(vendedor, '')) = ''
      `)).rows[0] || {};
      res.json({
        vendedores: rows.map((r: any) => ({
          vendedor: r.vendedor, qtd: Number(r.qtd) || 0, valor: Number(r.valor) || 0,
        })),
        semVendedor: { qtd: Number(sem.qtd) || 0, valor: Number(sem.valor) || 0 },
      });
    } catch (error) {
      console.error("[api] Error fetching creators-pontual vendedores:", error);
      res.status(500).json({ error: "Failed to fetch vendedores" });
    }
  });

  // Vendas por mes (entrada = data_criado, todos Creators valorp>0)
  app.get("/api/creators-pontual/vendas-mensal", async (req, res) => {
    try {
      const meses = Math.min(Math.max(parseInt(req.query.meses as string) || 8, 1), 24);
      const rows = (await db.execute(sql`
        WITH meses AS (
          SELECT generate_series(
            date_trunc('month', CURRENT_DATE) - (${meses - 1} || ' months')::interval,
            date_trunc('month', CURRENT_DATE), '1 month')::date AS m
        )
        SELECT to_char(meses.m, 'YYYY-MM') AS mes,
          (SELECT COUNT(*) FROM "Clickup".cup_contratos
           WHERE ${CREATORS} AND date_trunc('month', data_criado) = meses.m) AS qtd,
          (SELECT ROUND(COALESCE(SUM(valorp),0)::numeric,0) FROM "Clickup".cup_contratos
           WHERE ${CREATORS} AND date_trunc('month', data_criado) = meses.m) AS valor
        FROM meses ORDER BY meses.m
      `)).rows;
      res.json({
        serie: rows.map((r: any) => ({
          mes: r.mes, qtd: Number(r.qtd) || 0, valor: Number(r.valor) || 0,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching creators-pontual vendas-mensal:", error);
      res.status(500).json({ error: "Failed to fetch vendas-mensal" });
    }
  });

  // Tabela detalhada de itens em aberto (filtros status/operador)
  app.get("/api/creators-pontual/itens", async (req, res) => {
    try {
      const status = (req.query.status as string) || undefined;
      const operador = (req.query.operador as string) || undefined;
      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const pageSize = 50;
      const offset = (page - 1) * pageSize;

      const whereExtra = sql`
        ${status ? sql`AND c.status = ${status}` : sql``}
        ${operador ? sql`AND TRIM(c.responsavel) = ${operador}` : sql``}`;

      const totalRes = await db.execute(sql`
        SELECT COUNT(*) AS total
        FROM "Clickup".cup_contratos c
        WHERE ${CREATORS_C} AND ${ESTOQUE_C} ${whereExtra}`);

      const rows = (await db.execute(sql`
        SELECT c.id_subtask, cl.nome AS nome_cliente, c.produto, c.squad,
          NULLIF(TRIM(COALESCE(c.responsavel, '')), '') AS operador,
          NULLIF(TRIM(COALESCE(c.vendedor, '')), '') AS vendedor,
          ROUND(c.valorp::numeric, 0) AS valor,
          GREATEST(CURRENT_DATE - c.data_criado, 0) AS idade_dias,
          c.status
        FROM "Clickup".cup_contratos c
        LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = c.id_task
        WHERE ${CREATORS_C} AND ${ESTOQUE_C} ${whereExtra}
        ORDER BY GREATEST(CURRENT_DATE - c.data_criado, 0) DESC NULLS LAST
        LIMIT ${pageSize} OFFSET ${offset}`)).rows;

      res.json({
        total: Number(totalRes.rows[0]?.total) || 0,
        page, pageSize,
        itens: rows.map((r: any) => ({
          idSubtask: r.id_subtask,
          nomeCliente: r.nome_cliente,
          produto: r.produto,
          squad: r.squad,
          operador: r.operador,
          vendedor: r.vendedor,
          valor: Number(r.valor) || 0,
          idadeDias: Number(r.idade_dias) || 0,
          status: r.status,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching creators-pontual itens:", error);
      res.status(500).json({ error: "Failed to fetch itens" });
    }
  });
}
