import type { Express } from "express";
import { sql } from "drizzle-orm";
import type { IStorage } from "../storage";

export function registerReceitaRecorrenteRoutes(app: Express, db: any, storage: IStorage) {
  app.get("/api/financeiro/receita-recorrente/resumo", async (req, res) => {
    try {
      res.json({
        meses: [],
        cards: {
          mrr_recorrente_atual: 0,
          mrr_recorrente_delta_pct: 0,
          pontual_atual: 0,
          pontual_delta_pct: 0,
          mix_recorrente_pct: 0,
          realizado_pct: 0,
          gap_contratado: null,
          ticket_medio_recorrente: 0,
          novos_recorrente: 0,
          churned_recorrente: 0,
        },
        range: { data_ini: "", data_fim: "" },
        empresa_filtro: null,
      });
    } catch (error: any) {
      console.error("[api] Error fetching receita-recorrente/resumo:", error);
      res.status(500).json({ error: error.message || "Failed to fetch resumo" });
    }
  });

  app.get("/api/financeiro/receita-recorrente/drilldown", async (req, res) => {
    try {
      res.json([]);
    } catch (error: any) {
      console.error("[api] Error fetching receita-recorrente/drilldown:", error);
      res.status(500).json({ error: error.message || "Failed to fetch drilldown" });
    }
  });
}
