import type { Express } from "express";
import { sql } from "drizzle-orm";
import { upsertCapacitySchema } from "@shared/schema";

export function registerCapacityRoutes(app: Express, db: any) {

  // GET /api/capacity — lista todas as capacities com utilizacao calculada
  app.get("/api/capacity", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          cap.id,
          cap.operador,
          cap.produto,
          cap.squad,
          cap.max_contratos,
          cap.atualizado_por,
          cap.atualizado_em,
          COALESCE(ctr.contratos_atuais, 0)::int as contratos_atuais,
          (cap.max_contratos - COALESCE(ctr.contratos_atuais, 0))::int as vagas_livres,
          CASE
            WHEN cap.max_contratos > 0
            THEN ROUND((COALESCE(ctr.contratos_atuais, 0)::numeric / cap.max_contratos) * 100, 1)
            ELSE 0
          END as utilizacao_pct
        FROM cortex_core.capacity_operador cap
        LEFT JOIN (
          SELECT
            responsavel,
            produto,
            COUNT(*)::int as contratos_atuais
          FROM "Clickup".cup_contratos
          WHERE status IN ('ativo', 'onboarding', 'triagem')
          GROUP BY responsavel, produto
        ) ctr ON cap.operador = ctr.responsavel AND cap.produto = ctr.produto
        ORDER BY cap.squad, cap.operador, cap.produto
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching capacity:", error);
      res.status(500).json({ error: "Failed to fetch capacity" });
    }
  });

  // GET /api/capacity/consolidado — dados agregados por squad e produto
  app.get("/api/capacity/consolidado", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          cap.squad,
          cap.produto,
          SUM(cap.max_contratos)::int as capacity_total,
          SUM(COALESCE(ctr.contratos_atuais, 0))::int as contratos_total,
          (SUM(cap.max_contratos) - SUM(COALESCE(ctr.contratos_atuais, 0)))::int as vagas_livres,
          CASE
            WHEN SUM(cap.max_contratos) > 0
            THEN ROUND((SUM(COALESCE(ctr.contratos_atuais, 0))::numeric / SUM(cap.max_contratos)) * 100, 1)
            ELSE 0
          END as utilizacao_pct
        FROM cortex_core.capacity_operador cap
        LEFT JOIN (
          SELECT
            responsavel,
            produto,
            COUNT(*)::int as contratos_atuais
          FROM "Clickup".cup_contratos
          WHERE status IN ('ativo', 'onboarding', 'triagem')
          GROUP BY responsavel, produto
        ) ctr ON cap.operador = ctr.responsavel AND cap.produto = ctr.produto
        GROUP BY cap.squad, cap.produto
        ORDER BY cap.squad, cap.produto
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching capacity consolidado:", error);
      res.status(500).json({ error: "Failed to fetch capacity consolidado" });
    }
  });

  // POST /api/capacity — upsert (cria ou atualiza)
  app.post("/api/capacity", async (req, res) => {
    try {
      const validation = upsertCapacitySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error });
      }
      const { operador, produto, squad, max_contratos } = validation.data;
      const email = (req as any).user?.email || "unknown";

      const result = await db.execute(sql`
        INSERT INTO cortex_core.capacity_operador (operador, produto, squad, max_contratos, atualizado_por, atualizado_em)
        VALUES (${operador}, ${produto}, ${squad}, ${max_contratos}, ${email}, NOW())
        ON CONFLICT (operador, produto)
        DO UPDATE SET
          max_contratos = ${max_contratos},
          squad = ${squad},
          atualizado_por = ${email},
          atualizado_em = NOW()
        RETURNING *
      `);
      res.json(result.rows[0]);
    } catch (error) {
      console.error("[api] Error upserting capacity:", error);
      res.status(500).json({ error: "Failed to upsert capacity" });
    }
  });

  // DELETE /api/capacity/:id
  app.delete("/api/capacity/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await db.execute(sql`DELETE FROM cortex_core.capacity_operador WHERE id = ${parseInt(id)}`);
      res.json({ success: true });
    } catch (error) {
      console.error("[api] Error deleting capacity:", error);
      res.status(500).json({ error: "Failed to delete capacity" });
    }
  });
}
