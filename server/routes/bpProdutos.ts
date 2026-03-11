import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

// Mapeamento de produto (coluna DB) -> segmento BP
// COALESCE com fallback_produto para meses com produto NULL (ex: Janeiro/2026)
function segmentCase(produtoCol: string): string {
  return `
    CASE
      WHEN ${produtoCol} = 'Performance' THEN 'Performance'
      WHEN ${produtoCol} IN ('Creators', 'Creators - Recorrente') THEN 'Creators'
      WHEN ${produtoCol} = 'Social Media' THEN 'Social'
      WHEN ${produtoCol} = 'Gestão de Comunidade' THEN 'Gestão de Comunidade'
      ELSE 'Others'
    END
  `;
}

// Mapeamento de produto cup_churn (multi-produto separado por ;) -> segmento BP
function churnSegmentCase(produtoCol: string): string {
  return `
    CASE
      WHEN ${produtoCol} ILIKE '%Performance%' THEN 'Performance'
      WHEN ${produtoCol} ILIKE '%Creator%' THEN 'Creators'
      WHEN ${produtoCol} ILIKE '%Social%' THEN 'Social'
      WHEN ${produtoCol} ILIKE '%Gestão de comunidade%' OR ${produtoCol} ILIKE '%Gestão de Comunidade%' THEN 'Gestão de Comunidade'
      ELSE 'Others'
    END
  `;
}

export function registerBpProdutosRoutes(app: Express) {

  // GET /api/bp-produtos/mrr-mensal
  // Retorna MRR realizado por segmento BP por mês (Nov/25 a mês atual)
  app.get("/api/bp-produtos/mrr-mensal", async (req, res) => {
    try {
      const result = await db.execute(sql`
        WITH last_snapshots AS (
          SELECT
            TO_CHAR(DATE_TRUNC('month', data_snapshot), 'YYYY-MM') as mes,
            MAX(data_snapshot) as last_snap
          FROM "Clickup".cup_data_hist
          WHERE data_snapshot >= '2025-11-01'
          GROUP BY 1
        ),
        -- Fallback: para contratos com produto NULL, busca o produto
        -- do snapshot mais recente onde o mesmo id_subtask tinha produto preenchido
        produto_fallback AS (
          SELECT DISTINCT ON (id_subtask)
            id_subtask,
            produto as fallback_produto
          FROM "Clickup".cup_data_hist
          WHERE produto IS NOT NULL AND produto != ''
          ORDER BY id_subtask, data_snapshot DESC
        ),
        hist_data AS (
          SELECT
            ls.mes,
            ${sql.raw(segmentCase("COALESCE(NULLIF(h.produto, ''), pf.fallback_produto)"))} as segmento,
            COALESCE(SUM(h.valorr::numeric), 0) as mrr,
            COUNT(DISTINCT h.id_subtask) as contratos
          FROM last_snapshots ls
          JOIN "Clickup".cup_data_hist h ON h.data_snapshot = ls.last_snap
          LEFT JOIN produto_fallback pf ON pf.id_subtask = h.id_subtask
          WHERE h.valorr IS NOT NULL AND h.valorr::numeric > 0
            AND h.status IN ('ativo', 'onboarding', 'triagem')
          GROUP BY 1, 2
        ),
        current_data AS (
          SELECT
            TO_CHAR(NOW(), 'YYYY-MM') as mes,
            ${sql.raw(segmentCase("c.produto"))} as segmento,
            COALESCE(SUM(c.valorr::numeric), 0) as mrr,
            COUNT(DISTINCT c.id_subtask) as contratos
          FROM "Clickup".cup_contratos c
          WHERE c.valorr IS NOT NULL AND c.valorr::numeric > 0
            AND c.status IN ('ativo', 'onboarding', 'triagem')
          GROUP BY 1, 2
        ),
        combined AS (
          SELECT * FROM hist_data
          UNION ALL
          SELECT * FROM current_data
        )
        SELECT
          mes,
          segmento,
          MAX(mrr) as mrr,
          MAX(contratos) as contratos
        FROM combined
        GROUP BY mes, segmento
        ORDER BY mes, segmento
      `);

      // Agrupar por mês
      const byMonth: Record<string, Record<string, { mrr: number; contratos: number }>> = {};
      for (const row of result.rows as any[]) {
        if (!byMonth[row.mes]) byMonth[row.mes] = {};
        byMonth[row.mes][row.segmento] = {
          mrr: parseFloat(row.mrr) || 0,
          contratos: parseInt(row.contratos) || 0,
        };
      }

      res.json(byMonth);
    } catch (error) {
      console.error("[api] Error fetching BP produtos MRR:", error);
      res.status(500).json({ error: "Failed to fetch BP produtos MRR" });
    }
  });

  // GET /api/bp-produtos/churn-mensal
  // Retorna churn realizado por segmento BP por mês
  app.get("/api/bp-produtos/churn-mensal", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          TO_CHAR(ultimo_dia_operacao, 'YYYY-MM') as mes,
          ${sql.raw(churnSegmentCase("produto"))} as segmento,
          COUNT(*)::int as churns,
          COALESCE(SUM(valor_r), 0)::numeric as mrr_perdido
        FROM "Clickup".cup_churn
        WHERE status IN ('cancelado/inativo', 'em cancelamento')
          AND ultimo_dia_operacao >= '2025-11-01'
        GROUP BY 1, 2
        ORDER BY 1, 2
      `);

      const byMonth: Record<string, Record<string, { churns: number; mrrPerdido: number }>> = {};
      for (const row of result.rows as any[]) {
        if (!byMonth[row.mes]) byMonth[row.mes] = {};
        byMonth[row.mes][row.segmento] = {
          churns: parseInt(row.churns) || 0,
          mrrPerdido: parseFloat(row.mrr_perdido) || 0,
        };
      }

      res.json(byMonth);
    } catch (error) {
      console.error("[api] Error fetching BP produtos churn:", error);
      res.status(500).json({ error: "Failed to fetch BP produtos churn" });
    }
  });
}
