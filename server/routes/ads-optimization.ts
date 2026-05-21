import type { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import { eq, and, inArray } from "drizzle-orm";
import { db, pool } from "../db";
import { metaOptimizationProposals } from "@shared/schema";
import { requireEmail } from "../middleware/requireEmail";
import { syncMetaAds } from "../services/metaAdsSync";
import {
  loadPlaybook,
  isWhitelisted,
} from "../services/adsOptimization/playbook";
import {
  loadEntitySnapshots,
  getRecentlyTouchedEntityIds,
  summarizeForAgent,
} from "../services/adsOptimization/dataLoader";
import { loadTargetsForCurrentMonth } from "../services/adsOptimization/targets";
import { runOptimizationAgent } from "../services/adsOptimization/agent";
import {
  MetaGraphExecutor,
  executeAction,
} from "../services/adsOptimization/executor";
import type { User } from "../auth/userDb";
import type { EntityType } from "../services/adsOptimization/types";

const APPROVER_EMAILS = [
  "vinicius.ichino@turbopartners.com.br",
  "warleyreserva4@gmail.com",
];
const ON_DEMAND_SYNC_TTL_MS = 15 * 60 * 1000;

let lastSyncAt: number | null = null;

async function ensureFreshSync(): Promise<{ ranSync: boolean; lastSyncAt: Date }> {
  const now = Date.now();
  if (lastSyncAt && now - lastSyncAt < ON_DEMAND_SYNC_TTL_MS) {
    return { ranSync: false, lastSyncAt: new Date(lastSyncAt) };
  }
  // Sync sempre os últimos 14 dias (janela máxima usada pelas regras).
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const sinceStr = since.toISOString().slice(0, 10);
  await syncMetaAds(pool, { since: sinceStr });
  lastSyncAt = Date.now();
  return { ranSync: true, lastSyncAt: new Date(lastSyncAt) };
}

export function registerAdsOptimizationRoutes(app: Express) {
  const guard = requireEmail(APPROVER_EMAILS);

  // Lista propostas de um batch (após gerar/editar).
  app.get(
    "/api/growth/ads-optimization/proposals/:batchId",
    guard,
    async (req: Request, res: Response) => {
      try {
        const { batchId } = req.params;
        const rows = await db
          .select()
          .from(metaOptimizationProposals)
          .where(eq(metaOptimizationProposals.batchId, batchId));
        res.json({ batchId, proposals: rows });
      } catch (err: any) {
        console.error("[ads-optimization] GET proposals error:", err);
        res.status(500).json({ message: err.message ?? "erro" });
      }
    },
  );

  // Gera novas propostas (sync sob demanda + agente).
  app.post(
    "/api/growth/ads-optimization/propose",
    guard,
    async (_req: Request, res: Response) => {
      try {
        const playbook = await loadPlaybook();
        const targets = await loadTargetsForCurrentMonth();
        if (Object.keys(targets).length === 0) {
          return res.status(400).json({
            message:
              "Sem targets do mês corrente em meta_ads.growth_budgets. " +
              "Edite a página /planejamento-metas e preencha cpmql/percMqls por funil.",
          });
        }

        const { ranSync, lastSyncAt } = await ensureFreshSync();

        const cooldownIds = await getRecentlyTouchedEntityIds(playbook.cooldownHoras);
        const allSnapshots = await loadEntitySnapshots(
          playbook.knownProdutos,
          targets,
        );

        const ignored: { id: string; name: string; reason: string }[] = [];
        const filtered = [];
        for (const s of allSnapshots) {
          if (cooldownIds.has(s.entityId)) {
            ignored.push({ id: s.entityId, name: s.entityName, reason: "cooldown_48h" });
            continue;
          }
          // Whitelist match em adset_name OU campaign_name OU id direto.
          const whitelisted =
            isWhitelisted(s.entityName, s.entityId, playbook.whitelistPatterns) ||
            isWhitelisted(s.adsetName, s.entityId, playbook.whitelistPatterns) ||
            isWhitelisted(s.campaignName, s.entityId, playbook.whitelistPatterns);
          if (whitelisted) {
            ignored.push({ id: s.entityId, name: s.entityName, reason: "whitelist" });
            continue;
          }
          filtered.push(s);
        }

        const summary = summarizeForAgent(filtered, targets);
        ignored.push(...summary.ignored);

        const proposals = await runOptimizationAgent({
          playbook,
          payload: summary.payload,
        });

        const batchId = randomUUID();

        if (proposals.length > 0) {
          await db.insert(metaOptimizationProposals).values(
            proposals.map((p) => ({
              batchId,
              proposedEntityType: p.proposedEntityType,
              proposedEntityId: p.proposedEntityId,
              proposedEntityName: p.proposedEntityName,
              proposedAction: p.proposedAction,
              produto: p.produto,
              reason: p.reason,
              currentMetrics: p.currentMetrics,
              playbookRule: p.playbookRule,
              status: "pending" as const,
            })),
          );
        }

        const inserted = await db
          .select()
          .from(metaOptimizationProposals)
          .where(eq(metaOptimizationProposals.batchId, batchId));

        res.json({
          batchId,
          ranSync,
          lastSyncAt,
          totalCandidates: allSnapshots.length,
          totalEvaluated: summary.payload.length,
          proposals: inserted,
          ignored,
        });
      } catch (err: any) {
        console.error("[ads-optimization] POST propose error:", err);
        res.status(500).json({ message: err.message ?? "erro" });
      }
    },
  );

  // Atualiza estado de uma proposta (approve / reject / edit).
  app.patch(
    "/api/growth/ads-optimization/proposals/:id",
    guard,
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) {
          return res.status(400).json({ message: "id inválido" });
        }
        const user = req.user as User;
        const {
          status,
          finalEntityType,
          finalEntityId,
          finalEntityName,
          finalAction,
          editNotes,
        } = req.body ?? {};

        if (!["approved", "rejected", "edited"].includes(status)) {
          return res.status(400).json({ message: "status inválido" });
        }

        const update: Record<string, unknown> = {
          status,
          reviewedBy: user.email,
          reviewedAt: new Date(),
          editNotes: editNotes ?? null,
        };

        if (status === "edited") {
          if (!finalAction || !finalEntityType || !finalEntityId) {
            return res.status(400).json({
              message:
                "Para status=edited, finalAction, finalEntityType e finalEntityId são obrigatórios.",
            });
          }
          update.finalAction = finalAction;
          update.finalEntityType = finalEntityType;
          update.finalEntityId = finalEntityId;
          update.finalEntityName = finalEntityName ?? null;
        }

        const [row] = await db
          .update(metaOptimizationProposals)
          .set(update)
          .where(eq(metaOptimizationProposals.id, id))
          .returning();

        if (!row) return res.status(404).json({ message: "proposta não encontrada" });
        res.json({ proposal: row });
      } catch (err: any) {
        console.error("[ads-optimization] PATCH proposal error:", err);
        res.status(500).json({ message: err.message ?? "erro" });
      }
    },
  );

  // Executa todas as propostas approved/edited de um batch.
  app.post(
    "/api/growth/ads-optimization/execute",
    guard,
    async (req: Request, res: Response) => {
      try {
        const { batchId } = req.body ?? {};
        if (!batchId) return res.status(400).json({ message: "batchId obrigatório" });

        const playbook = await loadPlaybook();
        const executor = new MetaGraphExecutor();

        const targets = await db
          .select()
          .from(metaOptimizationProposals)
          .where(
            and(
              eq(metaOptimizationProposals.batchId, batchId),
              inArray(metaOptimizationProposals.status, ["approved", "edited"]),
            ),
          );

        const results: Array<{
          id: number;
          status: "executed" | "failed";
          note?: string;
          error?: string;
        }> = [];

        // Sequencial — não paraleliza para respeitar rate limit (R2).
        for (const p of targets) {
          const entityType = (p.finalEntityType ?? p.proposedEntityType) as EntityType;
          const entityId = p.finalEntityId ?? p.proposedEntityId;
          const entityName = p.finalEntityName ?? p.proposedEntityName ?? entityId;
          const action = (p.finalAction ?? p.proposedAction) as
            | "pause"
            | "reactivate"
            | "skip";

          const whitelistedNow = isWhitelisted(
            entityName,
            entityId,
            playbook.whitelistPatterns,
          );

          try {
            const out = await executeAction({
              executor,
              entityType,
              entityId,
              entityName,
              action,
              isWhitelisted: whitelistedNow,
            });
            await db
              .update(metaOptimizationProposals)
              .set({
                status: "executed",
                executedAt: new Date(),
                executionError: null,
                editNotes: out.note
                  ? p.editNotes
                    ? `${p.editNotes}\n[exec] ${out.note}`
                    : `[exec] ${out.note}`
                  : p.editNotes,
              })
              .where(eq(metaOptimizationProposals.id, p.id));
            results.push({ id: p.id, status: "executed", note: out.note });
          } catch (err: any) {
            const msg = err?.message ?? "erro desconhecido";
            await db
              .update(metaOptimizationProposals)
              .set({ status: "failed", executionError: msg })
              .where(eq(metaOptimizationProposals.id, p.id));
            results.push({ id: p.id, status: "failed", error: msg });
          }
        }

        res.json({ batchId, results });
      } catch (err: any) {
        console.error("[ads-optimization] POST execute error:", err);
        res.status(500).json({ message: err.message ?? "erro" });
      }
    },
  );

  // Endpoint utilitário: expõe o email do aprovador para o frontend
  // saber se deve renderizar o botão. Não vaza informação sensível.
  app.get(
    "/api/growth/ads-optimization/whoami",
    async (req: Request, res: Response) => {
      const user = req.user as User | undefined;
      const email = user?.email?.toLowerCase().trim();
      const isApprover = !!email && APPROVER_EMAILS.some((e) => e.toLowerCase() === email);
      res.json({ isApprover });
    },
  );
}

export { APPROVER_EMAILS };
