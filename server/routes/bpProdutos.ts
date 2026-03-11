import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

// Mapeamento de produto (coluna DB) -> segmento BP
const PRODUCT_SEGMENT_SQL = `
  CASE
    WHEN h.produto = 'Performance' THEN 'Performance'
    WHEN h.produto IN ('Creators', 'Creators - Recorrente') THEN 'Creators'
    WHEN h.produto = 'Social Media' THEN 'Social'
    WHEN h.produto = 'Gestão de Comunidade' THEN 'Gestão de Comunidade'
    ELSE 'Others'
  END
`;

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
        hist_data AS (
          SELECT
            ls.mes,
            ${sql.raw(PRODUCT_SEGMENT_SQL)} as segmento,
            COALESCE(SUM(h.valorr::numeric), 0) as mrr,
            COUNT(DISTINCT h.id_subtask) as contratos
          FROM last_snapshots ls
          JOIN "Clickup".cup_data_hist h ON h.data_snapshot = ls.last_snap
          WHERE h.valorr IS NOT NULL AND h.valorr::numeric > 0
            AND h.status IN ('ativo', 'onboarding', 'triagem')
          GROUP BY 1, 2
        ),
        current_data AS (
          SELECT
            TO_CHAR(NOW(), 'YYYY-MM') as mes,
            CASE
              WHEN c.produto = 'Performance' THEN 'Performance'
              WHEN c.produto IN ('Creators', 'Creators - Recorrente') THEN 'Creators'
              WHEN c.produto = 'Social Media' THEN 'Social'
              WHEN c.produto = 'Gestão de Comunidade' THEN 'Gestão de Comunidade'
              ELSE 'Others'
            END as segmento,
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
}
