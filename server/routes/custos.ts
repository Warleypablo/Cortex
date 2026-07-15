import type { Express } from "express";
import { sql } from "drizzle-orm";
import { consolidarMes, evolucao } from "../services/custos/consolidacao";
import { upsertTaxaMes, mesAtualBR } from "../services/custos/cambio";

function isAdmin(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden - Admin access required" });
  }
  next();
}

export function registerCustosRoutes(app: Express, db: any) {
  // Consolidado de um mês
  app.get("/api/custos/consolidado", async (req, res) => {
    try {
      const mes = (req.query.mes as string) || mesAtualBR();
      res.json(await consolidarMes(db, mes));
    } catch (error) {
      console.error("[custos] consolidado:", error);
      res.status(500).json({ error: "Failed to build consolidado" });
    }
  });

  // Evolução mês a mês (default: últimos 6 meses até o mês atual)
  app.get("/api/custos/evolucao", async (req, res) => {
    try {
      const ate = (req.query.ate as string) || mesAtualBR();
      let de = req.query.de as string;
      if (!de) {
        const [y, m] = ate.split("-").map(Number);
        const d = new Date(Date.UTC(y, m - 1 - 5, 1));
        de = d.toISOString().slice(0, 7);
      }
      res.json(await evolucao(db, de, ate));
    } catch (error) {
      console.error("[custos] evolucao:", error);
      res.status(500).json({ error: "Failed to build evolucao" });
    }
  });

  // Câmbio: lista
  app.get("/api/custos/cambio", async (_req, res) => {
    try {
      const r = await db.execute(sql`
        SELECT ano_mes, taxa_usd_brl, fonte, updated_at
        FROM cortex_core.custo_cambio_mensal ORDER BY ano_mes DESC
      `);
      res.json(r.rows.map((row: any) => ({
        anoMes: row.ano_mes, taxa: parseFloat(row.taxa_usd_brl), fonte: row.fonte, updatedAt: row.updated_at,
      })));
    } catch (error) {
      console.error("[custos] cambio list:", error);
      res.status(500).json({ error: "Failed to list cambio" });
    }
  });

  // Câmbio: override manual
  app.put("/api/custos/cambio/:anoMes", isAdmin, async (req, res) => {
    try {
      const { anoMes } = req.params;
      const taxa = parseFloat(req.body?.taxa);
      if (!taxa || Number.isNaN(taxa)) return res.status(400).json({ error: "taxa inválida" });
      await upsertTaxaMes(db, anoMes, taxa, "manual");
      res.json({ anoMes, taxa, fonte: "manual" });
    } catch (error) {
      console.error("[custos] cambio put:", error);
      res.status(500).json({ error: "Failed to set cambio" });
    }
  });

  // Pessoas do RH (para o multi-select de usuários das assinaturas)
  app.get("/api/custos/pessoas", async (_req, res) => {
    try {
      const r = await db.execute(sql`
        SELECT id, nome FROM "Inhire".rh_pessoal
        WHERE LOWER(status) = 'ativo' ORDER BY nome
      `);
      res.json(r.rows.map((row: any) => ({ id: row.id, nome: row.nome })));
    } catch (error) {
      console.error("[custos] pessoas:", error);
      res.status(500).json({ error: "Failed to list pessoas" });
    }
  });
}
