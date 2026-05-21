/**
 * Endpoints da feature de criação de campanhas Meta Ads.
 *
 * Workflow:
 *   POST   /draft                  cria/atualiza rascunho do briefing
 *   GET    /draft/:id              busca rascunho
 *   GET    /audiences              lista saved audiences (autocomplete)
 *   POST   /preview-drive          valida URL Drive e lista arquivos
 *   POST   /execute/:id            dispara criação assíncrona
 *   GET    /status/:id             polling de status
 *   GET    /whoami                 verifica se usuário pode usar a feature
 */

import type { Express, Request, Response } from "express";
import { eq, desc, and, isNotNull, sql, inArray } from "drizzle-orm";
import { db } from "../db";
import { metaCreationDrafts } from "@shared/schema";
import { requireEmail } from "../middleware/requireEmail";
import {
  createCampaignFromBriefing,
  CreationInterrupted,
  listAudiences,
  type CreationBookmark,
} from "../services/adsCreation";
import { listDriveFolder, listDriveFolderTree } from "../services/adsCreation/driveLoader";
import {
  listAllForMatching,
  parseFileNameConvention,
  bulkInsertStubs,
  type CreateCreativeInput,
} from "../services/adsCreation/creativesRepo";
import { metaGet } from "../services/adsCreation/metaApi";
import type { Briefing } from "../services/adsCreation/types";
import type { User } from "../auth/userDb";

const APPROVER_EMAILS = [
  "vinicius.ichino@turbopartners.com.br",
  "warleyreserva4@gmail.com",
  "ferramentas@turbopartners.com.br",
];

function getDefaultAdAccountId(): string {
  const id = process.env.META_DEFAULT_AD_ACCOUNT_ID;
  if (!id) throw new Error("META_DEFAULT_AD_ACCOUNT_ID não configurado");
  return id.startsWith("act_") ? id : `act_${id}`;
}

// Backoff escalonado para auto-retry após rate limit (em minutos).
// 5 → 10 → 20 → 30. Após 4 tentativas vai pra paused_manual (usuário clica Retomar).
const RATE_LIMIT_BACKOFF_MIN = [5, 10, 20, 30];

// Timers em memória (id da draft → handle do setTimeout) — limpa em restart de servidor.
// Phase B (worker): persistir e reagendar no boot.
const pendingRetries = new Map<number, NodeJS.Timeout>();

/**
 * Executa um draft (start ou retomada).
 * - Roda o pipeline completo com bookmark se fornecido (resume).
 * - Se rate limit interromper: persiste bookmark + agenda nova tentativa.
 * - Se passar todas as 4 tentativas auto: marca paused_manual (espera usuário clicar Retomar).
 */
async function runCreationForDraft(draftId: number): Promise<void> {
  const [row] = await db.select().from(metaCreationDrafts).where(eq(metaCreationDrafts.id, draftId));
  if (!row) {
    console.warn(`[ads-creation] runCreation: draft ${draftId} não encontrado`);
    return;
  }
  if (row.status === "created") return; // já terminou
  if (row.status === "cancelled") return; // usuário cancelou

  const briefing = validateBriefing(row.briefing);
  const ctx = getCreationContext();
  const existingResult: any = row.result || {};
  const bookmark: CreationBookmark | undefined = existingResult.bookmark;
  const attempts: number = existingResult.rateLimitAttempts ?? 0;

  await db
    .update(metaCreationDrafts)
    .set({ status: "executing", updatedAt: new Date() })
    .where(eq(metaCreationDrafts.id, draftId));

  const onProgress = async (snapshot: any) => {
    try {
      // Mantém bookmark, attempts e totals/progress ao salvar
      const merged = {
        ...existingResult,
        ...snapshot,
        bookmark,
        rateLimitAttempts: attempts,
      };
      await db
        .update(metaCreationDrafts)
        .set({ result: merged as any, updatedAt: new Date() })
        .where(eq(metaCreationDrafts.id, draftId));
    } catch (err: any) {
      console.warn(`[ads-creation] persist progress falhou (id=${draftId}):`, err?.message ?? err);
    }
  };

  try {
    const result = await createCampaignFromBriefing({ briefing, ...ctx, bookmark, onProgress });
    await db
      .update(metaCreationDrafts)
      .set({
        status: "created",
        result: { ...result, rateLimitAttempts: attempts } as any,
        executedAt: new Date(),
        updatedAt: new Date(),
        errorMessage: result.errors.length > 0 ? result.errors.join("; ") : null,
      })
      .where(eq(metaCreationDrafts.id, draftId));
    pendingRetries.delete(draftId);
  } catch (err: any) {
    if (err instanceof CreationInterrupted) {
      const nextAttempt = attempts + 1;
      const isLast = nextAttempt >= RATE_LIMIT_BACKOFF_MIN.length;
      const status = isLast ? "paused_manual" : "paused_rate_limit";
      const delayMin = isLast ? null : RATE_LIMIT_BACKOFF_MIN[nextAttempt - 1];
      const nextAttemptAt = delayMin ? new Date(Date.now() + delayMin * 60_000) : null;

      console.warn(
        `[ads-creation] draft ${draftId} pausado por rate limit (tentativa ${nextAttempt}/${RATE_LIMIT_BACKOFF_MIN.length}). ` +
          `${isLast ? "Aguardando ação manual." : `Próxima tentativa em ${delayMin}min.`} ` +
          `Bookmark: ${err.bookmark.uploadedMedia.length} mídias já subidas.`,
      );

      await db
        .update(metaCreationDrafts)
        .set({
          status,
          result: {
            ...(row.result as any),
            bookmark: err.bookmark,
            rateLimitAttempts: nextAttempt,
            nextAttemptAt: nextAttemptAt?.toISOString() ?? null,
            lastError: err.message,
          } as any,
          updatedAt: new Date(),
        })
        .where(eq(metaCreationDrafts.id, draftId));

      // Agenda retomada automática (se não for a última tentativa)
      if (delayMin) {
        const handle = setTimeout(() => {
          pendingRetries.delete(draftId);
          runCreationForDraft(draftId).catch((e) =>
            console.error(`[ads-creation] retry de draft ${draftId} falhou:`, e),
          );
        }, delayMin * 60_000);
        pendingRetries.set(draftId, handle);
      }
      return;
    }

    // Erro não relacionado a rate limit — falha definitiva
    console.error(`[ads-creation] execute id=${draftId} failed:`, err);
    await db
      .update(metaCreationDrafts)
      .set({
        status: "failed",
        errorMessage: err?.message ?? "erro desconhecido",
        updatedAt: new Date(),
      })
      .where(eq(metaCreationDrafts.id, draftId));
    pendingRetries.delete(draftId);
  }
}

function getCreationContext() {
  const adAccountId = getDefaultAdAccountId();
  const pageId = process.env.META_DEFAULT_PAGE_ID;
  if (!pageId) throw new Error("META_DEFAULT_PAGE_ID não configurado");
  return {
    adAccountId,
    pageId,
    instagramActorId: process.env.META_DEFAULT_INSTAGRAM_ACTOR_ID,
    pixelId: process.env.META_DEFAULT_PIXEL_ID,
  };
}

function validateBriefing(b: any): Briefing {
  if (!b || typeof b !== "object") throw new Error("Briefing inválido");

  // Default e validação do modo
  if (!b.campaignMode) b.campaignMode = "new";
  if (!["new", "existing"].includes(b.campaignMode)) {
    throw new Error("campaignMode deve ser 'new' ou 'existing'");
  }

  // Campos sempre obrigatórios (qualquer modo)
  // audienceName é opcional: vazio → usa Advantage+ Audience (sem público específico)
  const alwaysRequired = [
    "dailyBudgetCents",
    "startDate",
    "primaryText",
    "callToAction",
    "destinationUrl",
    "driveFolderUrl",
  ];
  // Campos só obrigatórios em modo "new" (criação de campanha)
  const newOnly = ["campaignName", "objective", "budgetMode"];

  const required = b.campaignMode === "existing" ? alwaysRequired : [...alwaysRequired, ...newOnly];
  for (const k of required) {
    if (b[k] === undefined || b[k] === null || b[k] === "") {
      throw new Error(`Campo obrigatório ausente: ${k}`);
    }
  }
  if (b.campaignMode === "existing" && !b.existingCampaignId) {
    throw new Error("existingCampaignId obrigatório quando campaignMode='existing'");
  }
  if (typeof b.dailyBudgetCents !== "number" || b.dailyBudgetCents < 100) {
    throw new Error("dailyBudgetCents deve ser >= 100 (R$1)");
  }
  if (b.campaignMode === "new" && !["ABO", "CBO"].includes(b.budgetMode)) {
    throw new Error("budgetMode deve ser 'ABO' ou 'CBO'");
  }
  if (b.placements === undefined) b.placements = "auto";
  if (b.excludedAudienceNames !== undefined && !Array.isArray(b.excludedAudienceNames)) {
    throw new Error("excludedAudienceNames deve ser array de strings");
  }
  if (b.disableAdvantageExpansion !== undefined && typeof b.disableAdvantageExpansion !== "boolean") {
    throw new Error("disableAdvantageExpansion deve ser boolean");
  }
  if (b.conjuntoOverrides !== undefined) {
    if (!Array.isArray(b.conjuntoOverrides)) {
      throw new Error("conjuntoOverrides deve ser array");
    }
    for (const ov of b.conjuntoOverrides) {
      if (typeof ov?.folderName !== "string" || !ov.folderName.trim()) {
        throw new Error("conjuntoOverrides[].folderName obrigatório");
      }
      if (ov.dailyBudgetCents !== undefined && (typeof ov.dailyBudgetCents !== "number" || ov.dailyBudgetCents < 100)) {
        throw new Error(`conjuntoOverrides[${ov.folderName}].dailyBudgetCents deve ser número >= 100`);
      }
    }
  }
  return b as Briefing;
}

export function registerAdsCreationRoutes(app: Express) {
  const guard = requireEmail(APPROVER_EMAILS);

  app.get(
    "/api/growth/ads-creation/whoami",
    async (req: Request, res: Response) => {
      const user = req.user as User | undefined;
      const email = user?.email?.toLowerCase().trim();
      const isApprover = !!email && APPROVER_EMAILS.some((e) => e.toLowerCase() === email);
      res.json({ isApprover });
    },
  );

  app.get(
    "/api/growth/ads-creation/campaigns",
    guard,
    async (req: Request, res: Response) => {
      try {
        const adAccountId = getDefaultAdAccountId();

        // Lê do banco local (populado pelo metaAdsSync) — evita rate limit do Meta.
        // Para forçar leitura direto da API, passar ?fresh=1 (uso raro/admin).
        const fresh = req.query.fresh === '1' || req.query.fresh === 'true';

        if (!fresh) {
          const result = await db.execute(sql`
            SELECT
              campaign_id as id,
              campaign_name as name,
              objective,
              status,
              effective_status,
              created_time
            FROM meta_ads.meta_campaigns
            WHERE account_id = ${adAccountId}
              AND COALESCE(effective_status, 'ACTIVE') NOT IN ('DELETED', 'ARCHIVED')
            ORDER BY created_time DESC NULLS LAST
            LIMIT 500
          `);
          const campaigns = (result.rows as any[]).map((r) => ({
            id: String(r.id),
            name: r.name,
            objective: r.objective,
            status: r.status,
            effective_status: r.effective_status,
            created_time: r.created_time ? new Date(r.created_time).toISOString() : null,
          }));
          return res.json({ adAccountId, campaigns, source: 'cache' });
        }

        // Fallback: bater na API direto (só quando explicitamente pedido com ?fresh=1).
        const data = await metaGet(`${adAccountId}/campaigns`, {
          fields: "id,name,objective,status,effective_status,created_time",
          limit: "200",
          effective_status: JSON.stringify(["ACTIVE", "PAUSED", "IN_PROCESS", "WITH_ISSUES"]),
        });
        const campaigns = (data?.data ?? []).sort((a: any, b: any) =>
          (b.created_time ?? "").localeCompare(a.created_time ?? ""),
        );
        res.json({ adAccountId, campaigns, source: 'meta-api' });
      } catch (err: any) {
        console.error("[ads-creation] GET campaigns error:", err);
        res.status(500).json({ message: err.message ?? "erro" });
      }
    },
  );

  app.get(
    "/api/growth/ads-creation/audiences",
    guard,
    async (_req: Request, res: Response) => {
      try {
        const adAccountId = getDefaultAdAccountId();
        const audiences = await listAudiences(adAccountId);
        res.json({ adAccountId, audiences });
      } catch (err: any) {
        console.error("[ads-creation] GET audiences error:", err);
        res.status(500).json({ message: err.message ?? "erro" });
      }
    },
  );

  app.post(
    "/api/growth/ads-creation/preview-drive",
    guard,
    async (req: Request, res: Response) => {
      try {
        const { driveFolderUrl } = req.body ?? {};
        if (!driveFolderUrl) {
          return res.status(400).json({ message: "driveFolderUrl obrigatório" });
        }
        const tree = await listDriveFolderTree(driveFolderUrl);

        // Match contra a Biblioteca pra sinalizar arquivos sem cadastro
        const libraryRows = await listAllForMatching();
        const byFileId = new Map<string, true>();
        const byNomeDrive = new Map<string, true>();
        for (const r of libraryRows) {
          if (r.linkDoDrive) {
            const m = r.linkDoDrive.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            const id = m ? m[1] : r.linkDoDrive.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1];
            if (id) byFileId.set(id, true);
          }
          if (r.nomeDrive) byNomeDrive.set(r.nomeDrive.trim().toLowerCase(), true);
        }
        const stripExt = (n: string) => n.replace(/\.[^.]+$/, "");
        const isMatched = (f: { id: string; name: string }) =>
          byFileId.has(f.id) || byNomeDrive.has(stripExt(f.name).trim().toLowerCase());

        // Acumula stubs (auto-cadastro no submit) — populados varrendo todos os arquivos
        const autoStubs: CreateCreativeInput[] = [];
        const unparseableStubs: CreateCreativeInput[] = [];

        const buildStub = (f: { id: string; name: string }): "matched" | "auto" | "unparseable" => {
          if (isMatched(f)) return "matched";
          const nomeDrive = stripExt(f.name);
          const linkDrive = `https://drive.google.com/file/d/${f.id}/view`;
          const parsed = parseFileNameConvention(f.name);
          if (parsed) {
            autoStubs.push({
              nomeDrive,
              linkDrive,
              driveFileId: f.id,
              personagem: parsed.personagem,
              angulo: parsed.nomeAd,
            });
            return "auto";
          }
          unparseableStubs.push({
            nomeDrive,
            linkDrive,
            driveFileId: f.id,
          });
          return "unparseable";
        };

        if (tree.mode === "single") {
          const files = tree.files.map((f) => {
            const status = buildStub(f);
            return {
              id: f.id,
              name: f.name,
              mimeType: f.mimeType,
              kind: f.kind,
              inLibrary: status === "matched",
              status, // "matched" | "auto" | "unparseable"
            };
          });
          const unmatched = files.filter((f) => !f.inLibrary).map((f) => f.name);
          return res.json({
            mode: "single",
            files,
            totalFiles: files.length,
            unmatchedFiles: unmatched,
            autoStubs,
            unparseableStubs,
          });
        }

        // bulk
        const conjuntos = tree.conjuntos.map((c) => {
          const formats: Record<string, { count: number; files: any[] }> = {};
          let total = 0;
          for (const [tag, fs] of Object.entries(c.formats) as Array<
            [string, typeof tree.conjuntos[number]["formats"][keyof typeof tree.conjuntos[number]["formats"]]]
          >) {
            const arr = fs ?? [];
            formats[tag] = {
              count: arr.length,
              files: arr.map((f) => {
                const status = buildStub(f);
                return {
                  id: f.id,
                  name: f.name,
                  kind: f.kind,
                  inLibrary: status === "matched",
                  status,
                };
              }),
            };
            total += arr.length;
          }
          return { folderName: c.folderName, totalFiles: total, formats };
        });
        const totalFiles = conjuntos.reduce((acc, c) => acc + c.totalFiles, 0);
        const unmatched: string[] = [];
        for (const c of conjuntos) {
          for (const fmt of Object.values(c.formats)) {
            for (const f of fmt.files) if (!f.inLibrary) unmatched.push(f.name);
          }
        }
        res.json({
          mode: "bulk",
          conjuntos,
          totalConjuntos: conjuntos.length,
          totalFiles,
          unmatchedFiles: unmatched,
          autoStubs,
          unparseableStubs,
        });
      } catch (err: any) {
        console.error("[ads-creation] preview-drive error:", err);
        res.status(400).json({ message: err.message ?? "erro" });
      }
    },
  );

  app.post(
    "/api/growth/ads-creation/draft",
    guard,
    async (req: Request, res: Response) => {
      try {
        const user = req.user as User;
        const briefing = validateBriefing(req.body?.briefing);
        const adAccountId = getDefaultAdAccountId();

        const [row] = await db
          .insert(metaCreationDrafts)
          .values({
            userEmail: user.email,
            adAccountId,
            status: "draft",
            briefing: briefing as any,
            driveFolderUrl: briefing.driveFolderUrl,
          })
          .returning();

        res.json({ draft: row });
      } catch (err: any) {
        console.error("[ads-creation] POST draft error:", err);
        res.status(400).json({ message: err.message ?? "erro" });
      }
    },
  );

  app.get(
    "/api/growth/ads-creation/draft/:id",
    guard,
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) return res.status(400).json({ message: "id inválido" });
        const [row] = await db
          .select()
          .from(metaCreationDrafts)
          .where(eq(metaCreationDrafts.id, id));
        if (!row) return res.status(404).json({ message: "rascunho não encontrado" });
        res.json({ draft: row });
      } catch (err: any) {
        res.status(500).json({ message: err.message ?? "erro" });
      }
    },
  );

  app.get(
    "/api/growth/ads-creation/last-draft",
    guard,
    async (req: Request, res: Response) => {
      try {
        const userEmail = (req.user as User | undefined)?.email;
        if (!userEmail) return res.status(401).json({ message: "sem usuário" });
        const [row] = await db
          .select()
          .from(metaCreationDrafts)
          .where(eq(metaCreationDrafts.userEmail, userEmail))
          .orderBy(desc(metaCreationDrafts.createdAt))
          .limit(1);
        if (!row) return res.json({ briefing: null });
        // Retorna só o briefing — sem result/IDs (pra duplicar em form novo)
        res.json({ briefing: row.briefing, createdAt: row.createdAt });
      } catch (err: any) {
        res.status(500).json({ message: err.message ?? "erro" });
      }
    },
  );

  app.get(
    "/api/growth/ads-creation/history",
    guard,
    async (req: Request, res: Response) => {
      try {
        const userEmail = (req.user as User | undefined)?.email;
        if (!userEmail) return res.status(401).json({ message: "sem usuário" });
        const limit = Math.min(parseInt((req.query.limit as string) ?? "10", 10) || 10, 50);
        const rows = await db
          .select({
            id: metaCreationDrafts.id,
            status: metaCreationDrafts.status,
            briefing: metaCreationDrafts.briefing,
            result: metaCreationDrafts.result,
            executedAt: metaCreationDrafts.executedAt,
            createdAt: metaCreationDrafts.createdAt,
          })
          .from(metaCreationDrafts)
          .where(
            and(
              eq(metaCreationDrafts.userEmail, userEmail),
              isNotNull(metaCreationDrafts.executedAt),
            ),
          )
          .orderBy(desc(metaCreationDrafts.executedAt))
          .limit(limit);
        res.json({ items: rows });
      } catch (err: any) {
        res.status(500).json({ message: err.message ?? "erro" });
      }
    },
  );

  app.get(
    "/api/growth/ads-creation/status/:id",
    guard,
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) return res.status(400).json({ message: "id inválido" });
        const [row] = await db
          .select()
          .from(metaCreationDrafts)
          .where(eq(metaCreationDrafts.id, id));
        if (!row) return res.status(404).json({ message: "rascunho não encontrado" });
        res.json({
          id: row.id,
          status: row.status,
          result: row.result,
          errorMessage: row.errorMessage,
          executedAt: row.executedAt,
        });
      } catch (err: any) {
        res.status(500).json({ message: err.message ?? "erro" });
      }
    },
  );

  app.post(
    "/api/growth/ads-creation/execute/:id",
    guard,
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) return res.status(400).json({ message: "id inválido" });

        const [row] = await db
          .select()
          .from(metaCreationDrafts)
          .where(eq(metaCreationDrafts.id, id));
        if (!row) return res.status(404).json({ message: "rascunho não encontrado" });
        if (row.status === "executing") {
          return res.status(409).json({ message: "rascunho já está em execução" });
        }
        if (row.status === "created") {
          return res.status(409).json({ message: "rascunho já foi criado no Meta" });
        }

        // Stubs vindos do preview: auto-cadastra na Biblioteca antes de subir.
        const incomingAutoStubs = Array.isArray(req.body?.autoStubs) ? req.body.autoStubs : [];
        const incomingUnparseable = Array.isArray(req.body?.unparseableStubs)
          ? req.body.unparseableStubs
          : [];
        const allStubs: CreateCreativeInput[] = [...incomingAutoStubs, ...incomingUnparseable];
        const userEmail = (req.user as User | undefined)?.email ?? null;

        if (allStubs.length > 0) {
          try {
            const inserted = await bulkInsertStubs(allStubs, userEmail);
            if (inserted.length > 0) {
              console.log(
                `[ads-creation] auto-cadastrou ${inserted.length} criativos na Biblioteca (draft id=${id})`,
              );
            }
          } catch (err: any) {
            console.error(`[ads-creation] bulkInsertStubs falhou (draft id=${id}):`, err);
            return res.status(500).json({
              message: `Falha ao cadastrar criativos na Biblioteca: ${err.message ?? "erro"}`,
            });
          }
        }

        // Resposta imediata; criação roda em background.
        res.json({ id, status: "executing" });

        // Pipeline com retomada automática em caso de rate limit (5/10/20/30min)
        runCreationForDraft(id).catch((err) =>
          console.error(`[ads-creation] runCreation falhou (id=${id}):`, err),
        );
      } catch (err: any) {
        console.error("[ads-creation] POST execute error:", err);
        if (!res.headersSent) {
          res.status(500).json({ message: err.message ?? "erro" });
        }
      }
    },
  );

  // Retomar manualmente um draft pausado (rate limit ou paused_manual)
  app.post(
    "/api/growth/ads-creation/resume/:id",
    guard,
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) return res.status(400).json({ message: "id inválido" });
        const [row] = await db.select().from(metaCreationDrafts).where(eq(metaCreationDrafts.id, id));
        if (!row) return res.status(404).json({ message: "rascunho não encontrado" });
        if (!["paused_rate_limit", "paused_manual", "failed"].includes(row.status)) {
          return res.status(409).json({
            message: `Draft está em status '${row.status}' — não pode retomar.`,
          });
        }

        // Cancela timer pendente (se houver) e dispara retomada imediata
        const pending = pendingRetries.get(id);
        if (pending) {
          clearTimeout(pending);
          pendingRetries.delete(id);
        }
        res.json({ id, status: "executing", manual: true });
        runCreationForDraft(id).catch((err) =>
          console.error(`[ads-creation] resume falhou (id=${id}):`, err),
        );
      } catch (err: any) {
        if (!res.headersSent) res.status(500).json({ message: err.message ?? "erro" });
      }
    },
  );

  // Cancelar definitivamente um draft (pausado ou em execução)
  app.post(
    "/api/growth/ads-creation/cancel/:id",
    guard,
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) return res.status(400).json({ message: "id inválido" });
        const pending = pendingRetries.get(id);
        if (pending) {
          clearTimeout(pending);
          pendingRetries.delete(id);
        }
        await db
          .update(metaCreationDrafts)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(metaCreationDrafts.id, id));
        res.json({ id, status: "cancelled" });
      } catch (err: any) {
        res.status(500).json({ message: err.message ?? "erro" });
      }
    },
  );

  // Job ativo do usuário atual (pra banner no /criativos)
  app.get(
    "/api/growth/ads-creation/active",
    guard,
    async (req: Request, res: Response) => {
      try {
        const userEmail = (req.user as User | undefined)?.email ?? null;
        if (!userEmail) return res.json({ active: null });

        const [row] = await db
          .select({
            id: metaCreationDrafts.id,
            status: metaCreationDrafts.status,
            briefing: metaCreationDrafts.briefing,
            result: metaCreationDrafts.result,
            errorMessage: metaCreationDrafts.errorMessage,
            updatedAt: metaCreationDrafts.updatedAt,
          })
          .from(metaCreationDrafts)
          .where(
            and(
              eq(metaCreationDrafts.userEmail, userEmail),
              inArray(metaCreationDrafts.status, [
                "executing",
                "paused_rate_limit",
                "paused_manual",
              ] as any),
            ),
          )
          .orderBy(desc(metaCreationDrafts.updatedAt))
          .limit(1);

        if (!row) return res.json({ active: null });

        const result: any = row.result || {};
        const bookmark = result.bookmark || null;
        const totals = result.totals as { files?: number; conjuntos?: number } | undefined;
        const progress = result.progress as { phase?: string; filesDone?: number; conjuntosDone?: number } | undefined;

        // Cálculo de %: pesos download=5, upload=70, create=25
        let percent: number | null = null;
        if (totals?.files && totals.files > 0) {
          const filesDone = progress?.filesDone ?? bookmark?.uploadedMedia?.length ?? 0;
          const conjuntosDone = progress?.conjuntosDone ?? (result.adsetIds?.length ?? 0);
          const totalConjuntos = totals.conjuntos ?? 1;
          const uploadPct = (Math.min(filesDone, totals.files) / totals.files) * 70;
          const createPct = totalConjuntos > 0 ? (Math.min(conjuntosDone, totalConjuntos) / totalConjuntos) * 25 : 0;
          percent = Math.round(5 + uploadPct + createPct);
          if (row.status === "created") percent = 100;
        }

        res.json({
          active: {
            id: row.id,
            status: row.status,
            campaignName: (row.briefing as any)?.campaignName ?? null,
            uploadedCount: progress?.filesDone ?? bookmark?.uploadedMedia?.length ?? 0,
            totalFiles: totals?.files ?? null,
            phase: progress?.phase ?? null, // 'upload' | 'create'
            percent, // 0-100 ou null se ainda não tem totals
            attempts: result.rateLimitAttempts ?? 0,
            nextAttemptAt: result.nextAttemptAt ?? null,
            lastError: result.lastError ?? row.errorMessage ?? null,
          },
        });
      } catch (err: any) {
        res.status(500).json({ message: err.message ?? "erro" });
      }
    },
  );
}

export { APPROVER_EMAILS as ADS_CREATION_APPROVERS };
