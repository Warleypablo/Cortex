/**
 * API read-only do agente de subida de ads (painel no Cortex).
 *  GET /api/ads-automation/runs       — runs recentes + totais
 *  GET /api/ads-automation/runs/:id   — run + steps ordenados (timeline)
 *  GET /api/ads-automation/next       — próxima execução + lotes pendentes
 * Disparo manual (admin, fora da UI):
 *  POST /api/admin/ads-automation/run
 *
 * `/api` já passa por isAuthenticated globalmente (ver routes.ts). Aqui nada opera ads —
 * o agente (server/services/adsAutomationJob.ts) é quem executa.
 */
import type { Express } from "express";
import { db } from "../db";
import { desc, eq } from "drizzle-orm";
import { adsAutomationRuns, adsAutomationSteps } from "@shared/schema";
import { getNextRunInfo, runAdsAutomationNow } from "../services/adsAutomationJob";

function runTotals(r: typeof adsAutomationRuns.$inferSelect) {
  return {
    lotesTotal: r.lotesTotal,
    lotesDone: r.lotesDone,
    lotesAwaitingUpload: r.lotesAwaitingUpload,
    lotesFailed: r.lotesFailed,
    conjuntosCriados: r.conjuntosCriados,
    adsCriados: r.adsCriados,
  };
}

export function registerAdsAutomationRoutes(
  app: Express,
  isAuthenticated: (req: any, res: any, next: any) => void,
  isAdmin: (req: any, res: any, next: any) => void,
) {
  // Lista de runs (mais recentes primeiro)
  app.get("/api/ads-automation/runs", isAuthenticated, async (req, res) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 100);
      const rows = await db
        .select()
        .from(adsAutomationRuns)
        .orderBy(desc(adsAutomationRuns.startedAt))
        .limit(limit);
      res.json({
        runs: rows.map((r) => ({
          id: r.id,
          status: r.status,
          triggeredBy: r.triggeredBy,
          weekOf: r.weekOf,
          dryRun: r.dryRun,
          totals: runTotals(r),
          errorMessage: r.errorMessage,
          startedAt: r.startedAt,
          finishedAt: r.finishedAt,
        })),
      });
    } catch (error: any) {
      console.error("[api] ads-automation/runs:", error);
      res.status(500).json({ error: error?.message ?? "Falha ao listar runs" });
    }
  });

  // Run + steps (timeline)
  app.get("/api/ads-automation/runs/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });

      const runRows = await db.select().from(adsAutomationRuns).where(eq(adsAutomationRuns.id, id)).limit(1);
      const run = runRows[0];
      if (!run) return res.status(404).json({ error: "run não encontrado" });

      const steps = await db
        .select()
        .from(adsAutomationSteps)
        .where(eq(adsAutomationSteps.runId, id))
        .orderBy(adsAutomationSteps.ordem);

      res.json({
        run: {
          id: run.id,
          status: run.status,
          triggeredBy: run.triggeredBy,
          weekOf: run.weekOf,
          dryRun: run.dryRun,
          totals: runTotals(run),
          errorMessage: run.errorMessage,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
        },
        steps: steps.map((s) => ({
          id: s.id,
          ordem: s.ordem,
          loteNome: s.loteNome,
          clickupTaskId: s.clickupTaskId,
          clickupParentId: s.clickupParentId,
          clickupUrl: s.clickupUrl,
          status: s.status,
          detalhe: s.detalhe,
          warnings: s.warnings ?? [],
          conjuntoId: s.conjuntoId,
          adIds: Array.isArray(s.adIds) ? s.adIds : [],
          hasBookmark: s.bookmark != null,
          attempts: s.attempts,
          startedAt: s.startedAt,
          finishedAt: s.finishedAt,
        })),
      });
    } catch (error: any) {
      console.error("[api] ads-automation/runs/:id:", error);
      res.status(500).json({ error: error?.message ?? "Falha ao carregar run" });
    }
  });

  // Próxima execução + lotes pendentes (cheap, só DB + cálculo de data)
  app.get("/api/ads-automation/next", isAuthenticated, async (_req, res) => {
    try {
      res.json(await getNextRunInfo());
    } catch (error: any) {
      console.error("[api] ads-automation/next:", error);
      res.status(500).json({ error: error?.message ?? "Falha ao calcular próxima execução" });
    }
  });

  // Disparo manual (admin, fora do painel)
  app.post("/api/admin/ads-automation/run", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const result = await runAdsAutomationNow("manual");
      res.json({ ok: true, ...result });
    } catch (error: any) {
      console.error("[api] ads-automation/run:", error);
      res.status(500).json({ ok: false, error: error?.message ?? "Falha ao disparar run" });
    }
  });
}
