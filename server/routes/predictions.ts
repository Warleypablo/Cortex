import type { Express } from "express";

export function registerPredictionRoutes(app: Express) {
  // Summary (Hero KPIs)
  app.get("/api/predictions/summary", async (req, res) => {
    try {
      const { getPredictionSummary } = await import("../services/predictiveEngine");
      const horizonte = parseInt(req.query.horizonte as string) || 6;
      const summary = await getPredictionSummary(horizonte);
      res.json(summary);
    } catch (error) {
      console.error("[api] Error fetching prediction summary:", error);
      res.status(500).json({ error: "Falha ao buscar resumo de predições" });
    }
  });

  // MRR Forecast
  app.get("/api/predictions/mrr-forecast", async (req, res) => {
    try {
      const { calculateMrrForecast } = await import("../services/predictiveEngine");
      const horizonte = parseInt(req.query.horizonte as string) || 6;
      const result = await calculateMrrForecast(horizonte);
      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching MRR forecast:", error);
      res.status(500).json({ error: "Falha ao buscar forecast de MRR" });
    }
  });

  // Churn Forecast
  app.get("/api/predictions/churn-forecast", async (req, res) => {
    try {
      const { calculateChurnForecast } = await import("../services/predictiveEngine");
      const horizonte = parseInt(req.query.horizonte as string) || 6;
      const result = await calculateChurnForecast(horizonte);
      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching churn forecast:", error);
      res.status(500).json({ error: "Falha ao buscar forecast de churn" });
    }
  });

  // NRR Projection
  app.get("/api/predictions/nrr-projection", async (req, res) => {
    try {
      const { calculateNrrProjection } = await import("../services/predictiveEngine");
      const horizonte = parseInt(req.query.horizonte as string) || 6;
      const result = await calculateNrrProjection(horizonte);
      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching NRR projection:", error);
      res.status(500).json({ error: "Falha ao buscar projeção de NRR" });
    }
  });

  // Inadimplência Forecast
  app.get("/api/predictions/inadimplencia-forecast", async (req, res) => {
    try {
      const { calculateInadimplenciaForecast } = await import("../services/predictiveEngine");
      const horizonte = parseInt(req.query.horizonte as string) || 6;
      const result = await calculateInadimplenciaForecast(horizonte);
      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching inadimplencia forecast:", error);
      res.status(500).json({ error: "Falha ao buscar forecast de inadimplência" });
    }
  });

  // Revenue at Risk
  app.get("/api/predictions/revenue-at-risk", async (req, res) => {
    try {
      const { calculateRevenueAtRisk } = await import("../services/predictiveEngine");
      const horizonte = parseInt(req.query.horizonte as string) || 6;
      const result = await calculateRevenueAtRisk(horizonte);
      res.json(result);
    } catch (error) {
      console.error("[api] Error fetching revenue at risk:", error);
      res.status(500).json({ error: "Falha ao buscar revenue at risk" });
    }
  });

  // Accuracy history
  app.get("/api/predictions/accuracy", async (req, res) => {
    try {
      const { db } = await import("../db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql`
        SELECT tipo, data_alvo, valor_previsto::numeric, valor_real::numeric, erro_percentual::numeric, criado_em
        FROM cortex_core.predictions_accuracy
        ORDER BY criado_em DESC
        LIMIT 100
      `);
      res.json(result.rows);
    } catch (error) {
      console.error("[api] Error fetching prediction accuracy:", error);
      res.status(500).json({ error: "Falha ao buscar acurácia" });
    }
  });
}
