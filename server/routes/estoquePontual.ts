import type { Express } from "express";
import { sql } from "drizzle-orm";
import { groupAging } from "./estoquePontual.helpers";

// Estoque = pontual vendido, não entregue, não cancelado.
const ESTOQUE_WHERE = sql`valorp > 0 AND status NOT IN ('entregue','cancelado/inativo','não usar')`;

export function registerEstoquePontualRoutes(app: Express, db: any) {
  // KPIs do estoque atual
  app.get("/api/estoque-pontual/overview", async (_req, res) => {
    try {
      const r = (await db.execute(sql`
        SELECT
          ROUND(SUM(valorp)::numeric, 0) AS valor_estoque,
          COUNT(*) AS qtd_itens,
          ROUND(AVG(GREATEST(CURRENT_DATE - data_criado, 0)) FILTER (WHERE data_criado IS NOT NULL), 0) AS idade_media,
          COUNT(*) FILTER (WHERE GREATEST(CURRENT_DATE - data_criado, 0) >= 90) AS qtd_envelhecidos,
          ROUND(SUM(valorp) FILTER (WHERE GREATEST(CURRENT_DATE - data_criado, 0) >= 90)::numeric, 0) AS valor_envelhecidos
        FROM "Clickup".cup_contratos
        WHERE ${ESTOQUE_WHERE}
      `)).rows[0] || {};
      res.json({
        valorEstoque: Number(r.valor_estoque) || 0,
        qtdItens: Number(r.qtd_itens) || 0,
        idadeMedia: Number(r.idade_media) || 0,
        qtdEnvelhecidos: Number(r.qtd_envelhecidos) || 0,
        valorEnvelhecidos: Number(r.valor_envelhecidos) || 0,
      });
    } catch (error) {
      console.error("[api] Error fetching estoque-pontual overview:", error);
      res.status(500).json({ error: "Failed to fetch overview" });
    }
  });

  // Evolução do estoque mês a mês (snapshots de cup_data_hist; último snapshot de cada mês)
  app.get("/api/estoque-pontual/evolucao", async (req, res) => {
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
        SELECT to_char(s.m, 'YYYY-MM') AS mes,
          COUNT(*) FILTER (WHERE ${ESTOQUE_WHERE}) AS qtd_estoque,
          ROUND(SUM(h.valorp) FILTER (WHERE ${ESTOQUE_WHERE})::numeric, 0) AS valor_estoque
        FROM snap s
        JOIN "Clickup".cup_data_hist h ON h.data_snapshot = s.snap_ref
        GROUP BY s.m
        ORDER BY s.m
      `)).rows;
      res.json({
        serie: rows.map((r: any) => ({
          mes: r.mes,
          valorEstoque: Number(r.valor_estoque) || 0,
          qtdEstoque: Number(r.qtd_estoque) || 0,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching estoque-pontual evolucao:", error);
      res.status(500).json({ error: "Failed to fetch evolucao" });
    }
  });

  // Fluxo: entradas (data_criado) x entregas (data_entrega) por mês
  app.get("/api/estoque-pontual/fluxo", async (req, res) => {
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
           WHERE valorp > 0 AND date_trunc('month', data_criado) = meses.m) AS entradas,
          (SELECT ROUND(COALESCE(SUM(valorp),0)::numeric,0) FROM "Clickup".cup_contratos
           WHERE valorp > 0 AND date_trunc('month', data_criado) = meses.m) AS val_entrada,
          (SELECT COUNT(*) FROM "Clickup".cup_contratos
           WHERE valorp > 0 AND date_trunc('month', data_entrega) = meses.m) AS entregas,
          (SELECT ROUND(COALESCE(SUM(valorp),0)::numeric,0) FROM "Clickup".cup_contratos
           WHERE valorp > 0 AND date_trunc('month', data_entrega) = meses.m) AS val_entregue
        FROM meses
        ORDER BY meses.m
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
      console.error("[api] Error fetching estoque-pontual fluxo:", error);
      res.status(500).json({ error: "Failed to fetch fluxo" });
    }
  });

  // Distribuição por produto
  app.get("/api/estoque-pontual/por-produto", async (_req, res) => {
    try {
      const rows = (await db.execute(sql`
        SELECT COALESCE(NULLIF(produto, ''), '(sem produto)') AS produto,
          COUNT(*) AS qtd,
          ROUND(SUM(valorp)::numeric, 0) AS valor,
          ROUND(AVG(GREATEST(CURRENT_DATE - data_criado, 0)) FILTER (WHERE data_criado IS NOT NULL), 0) AS idade_media
        FROM "Clickup".cup_contratos
        WHERE ${ESTOQUE_WHERE}
        GROUP BY COALESCE(NULLIF(produto, ''), '(sem produto)')
        ORDER BY valor DESC NULLS LAST
      `)).rows;
      res.json({
        produtos: rows.map((r: any) => ({
          produto: r.produto,
          qtd: Number(r.qtd) || 0,
          valor: Number(r.valor) || 0,
          idadeMedia: Number(r.idade_media) || 0,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching estoque-pontual por-produto:", error);
      res.status(500).json({ error: "Failed to fetch por-produto" });
    }
  });

  // Distribuição por squad
  app.get("/api/estoque-pontual/por-squad", async (_req, res) => {
    try {
      const rows = (await db.execute(sql`
        SELECT COALESCE(NULLIF(squad, ''), '(sem squad)') AS squad,
          COUNT(*) AS qtd,
          ROUND(SUM(valorp)::numeric, 0) AS valor,
          ROUND(AVG(GREATEST(CURRENT_DATE - data_criado, 0)) FILTER (WHERE data_criado IS NOT NULL), 0) AS idade_media
        FROM "Clickup".cup_contratos
        WHERE ${ESTOQUE_WHERE}
        GROUP BY COALESCE(NULLIF(squad, ''), '(sem squad)')
        ORDER BY valor DESC NULLS LAST
      `)).rows;
      res.json({
        squads: rows.map((r: any) => ({
          squad: r.squad,
          qtd: Number(r.qtd) || 0,
          valor: Number(r.valor) || 0,
          idadeMedia: Number(r.idade_media) || 0,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching estoque-pontual por-squad:", error);
      res.status(500).json({ error: "Failed to fetch por-squad" });
    }
  });

  // Aging: agrupado no JS via helper (DRY com o helper testado)
  app.get("/api/estoque-pontual/aging", async (_req, res) => {
    try {
      const rows = (await db.execute(sql`
        SELECT GREATEST(CURRENT_DATE - data_criado, 0) AS idade_dias, valorp AS valor
        FROM "Clickup".cup_contratos
        WHERE ${ESTOQUE_WHERE} AND data_criado IS NOT NULL
      `)).rows;
      const buckets = groupAging(
        rows.map((r: any) => ({ idadeDias: Number(r.idade_dias) || 0, valor: Number(r.valor) || 0 })),
      );
      res.json({ buckets });
    } catch (error) {
      console.error("[api] Error fetching estoque-pontual aging:", error);
      res.status(500).json({ error: "Failed to fetch aging" });
    }
  });

  // Tabela de gestão: itens em aberto, paginada, ordenada por idade DESC
  app.get("/api/estoque-pontual/itens", async (req, res) => {
    try {
      const produto = (req.query.produto as string) || undefined;
      const squad = (req.query.squad as string) || undefined;
      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const pageSize = 50;
      const offset = (page - 1) * pageSize;

      const whereExtra = sql`
        ${produto ? sql`AND c.produto = ${produto}` : sql``}
        ${squad ? sql`AND c.squad = ${squad}` : sql``}`;

      const totalRes = await db.execute(sql`
        SELECT COUNT(*) AS total
        FROM "Clickup".cup_contratos c
        WHERE c.valorp > 0
          AND c.status NOT IN ('entregue','cancelado/inativo','não usar')
          ${whereExtra}`);

      const rows = (await db.execute(sql`
        SELECT c.id_subtask, cl.nome AS nome_cliente, c.produto, c.squad,
          COALESCE(NULLIF(c.responsavel, ''), c.cs_responsavel) AS responsavel,
          ROUND(c.valorp::numeric, 0) AS valor,
          GREATEST(CURRENT_DATE - c.data_criado, 0) AS idade_dias,
          c.status
        FROM "Clickup".cup_contratos c
        LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = c.id_task
        WHERE c.valorp > 0
          AND c.status NOT IN ('entregue','cancelado/inativo','não usar')
          ${whereExtra}
        ORDER BY GREATEST(CURRENT_DATE - c.data_criado, 0) DESC NULLS LAST
        LIMIT ${pageSize} OFFSET ${offset}`)).rows;

      res.json({
        total: Number(totalRes.rows[0]?.total) || 0,
        page,
        pageSize,
        itens: rows.map((r: any) => ({
          idSubtask: r.id_subtask,
          nomeCliente: r.nome_cliente,
          produto: r.produto,
          squad: r.squad,
          responsavel: r.responsavel,
          valor: Number(r.valor) || 0,
          idadeDias: Number(r.idade_dias) || 0,
          status: r.status,
        })),
      });
    } catch (error) {
      console.error("[api] Error fetching estoque-pontual itens:", error);
      res.status(500).json({ error: "Failed to fetch itens" });
    }
  });
}
