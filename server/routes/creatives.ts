/**
 * Endpoints da Biblioteca de Criativos da Turbo (cortex_core.creatives_library).
 *
 * Fonte de verdade do "Nome Final" usado pra batizar ads no Meta.
 * Restrito aos 3 approvers via requireEmail.
 */

import type { Express, Request, Response } from "express";
import { requireEmail } from "../middleware/requireEmail";
import {
  listCreatives,
  listCreativesWithSpend,
  getCreativeById,
  createCreative,
  updateCreative,
  softDeleteCreative,
  getDistinctOptions,
  matchDriveFilesToRows,
  listAllForMatching,
} from "../services/adsCreation/creativesRepo";
import {
  upsertBatch,
  getBatchByFolderId,
  extractDriveFolderId,
  listVocab,
  upsertVocab,
} from "../services/adsCreation/creativeBatchesRepo";
import {
  getCreativePerformance,
  getCreativeRanking,
} from "../services/adsCreation/creativePerformanceRepo";
import type { User } from "../auth/userDb";

// Janela default: últimos 30 dias (formato YYYY-MM-DD).
function defaultWindow(q: Request["query"]): { since: string; until: string } {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const until = typeof q.until === "string" ? q.until : fmt(new Date());
  let since: string;
  if (typeof q.since === "string") {
    since = q.since;
  } else {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    since = fmt(d);
  }
  return { since, until };
}

const APPROVER_EMAILS = [
  "vinicius.ichino@turbopartners.com.br",
  "warleyreserva4@gmail.com",
  "ferramentas@turbopartners.com.br",
];

function parseBoolFlag(v: unknown): boolean | undefined {
  if (v === undefined) return undefined;
  if (v === "true" || v === true || v === "1") return true;
  if (v === "false" || v === false || v === "0") return false;
  return undefined;
}

export function registerCreativesRoutes(app: Express) {
  const guard = requireEmail(APPROVER_EMAILS);

  // whoami — frontend usa pra esconder item do menu pra não-approvers
  app.get("/api/growth/creatives/whoami", async (req: Request, res: Response) => {
    const user = req.user as User | undefined;
    const email = user?.email?.toLowerCase().trim();
    const isApprover = !!email && APPROVER_EMAILS.some((e) => e.toLowerCase() === email);
    res.json({ isApprover });
  });

  app.get("/api/growth/creatives/options", guard, async (_req, res) => {
    try {
      const options = await getDistinctOptions();
      res.json(options);
    } catch (err: any) {
      console.error("[creatives] options error:", err);
      res.status(500).json({ message: err.message ?? "erro" });
    }
  });

  app.get("/api/growth/creatives", guard, async (req: Request, res: Response) => {
    try {
      const filters = {
        q: typeof req.query.q === "string" ? req.query.q : undefined,
        personagem: typeof req.query.personagem === "string" ? req.query.personagem : undefined,
        produto: typeof req.query.produto === "string" ? req.query.produto : undefined,
        etapaFunil: typeof req.query.etapaFunil === "string" ? req.query.etapaFunil : undefined,
        adValidado: parseBoolFlag(req.query.adValidado),
        page: req.query.page ? parseInt(String(req.query.page), 10) : undefined,
        pageSize: req.query.pageSize ? parseInt(String(req.query.pageSize), 10) : undefined,
      };
      // "Só com investimento": filtra/ordena por gasto na janela selecionada.
      if (req.query.comInvestimento === "true") {
        const { since, until } = defaultWindow(req.query);
        const result = await listCreativesWithSpend(filters, since, until);
        return res.json(result);
      }
      const result = await listCreatives(filters);
      res.json(result);
    } catch (err: any) {
      console.error("[creatives] list error:", err);
      res.status(500).json({ message: err.message ?? "erro" });
    }
  });

  app.get("/api/growth/creatives/:id", guard, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "id inválido" });
      const row = await getCreativeById(id);
      if (!row) return res.status(404).json({ message: "não encontrado" });
      res.json(row);
    } catch (err: any) {
      res.status(500).json({ message: err.message ?? "erro" });
    }
  });

  app.post("/api/growth/creatives", guard, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const body = req.body ?? {};
      if (!body.nomeDrive || typeof body.nomeDrive !== "string") {
        return res.status(400).json({ message: "nomeDrive obrigatório" });
      }
      const created = await createCreative({
        nomeDrive: body.nomeDrive.trim(),
        linkDrive: body.linkDrive ?? null,
        driveFileId: body.driveFileId ?? null,
        angulo: body.angulo ?? null,
        hook: body.hook ?? null,
        corpo: body.corpo ?? null,
        cta: body.cta ?? null,
        etapaFunil: body.etapaFunil ?? null,
        dataPostagem: body.dataPostagem ?? null,
        produto: body.produto ?? null,
        plataforma: body.plataforma ?? null,
        personagem: body.personagem ?? null,
        formato: body.formato ?? null,
        tipoAd: body.tipoAd ?? null,
        idCopy: body.idCopy ?? null,
        observacao: body.observacao ?? null,
        adValidado: body.adValidado === true,
        createdBy: user?.email ?? null,
      });
      res.status(201).json(created);
    } catch (err: any) {
      console.error("[creatives] create error:", err);
      res.status(500).json({ message: err.message ?? "erro" });
    }
  });

  app.patch("/api/growth/creatives/:id", guard, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "id inválido" });
      const updated = await updateCreative(id, req.body ?? {});
      if (!updated) return res.status(404).json({ message: "não encontrado" });
      res.json(updated);
    } catch (err: any) {
      console.error("[creatives] update error:", err);
      res.status(500).json({ message: err.message ?? "erro" });
    }
  });

  // Bulk patch — aplica o MESMO patch a vários IDs. Body: { ids: number[], patch: Partial<...> }
  app.patch("/api/growth/creatives/bulk", guard, async (req: Request, res: Response) => {
    try {
      const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const patch = req.body?.patch ?? {};
      if (ids.length === 0) return res.status(400).json({ message: "ids vazio" });
      if (!patch || typeof patch !== "object") return res.status(400).json({ message: "patch inválido" });
      const results = await Promise.allSettled(ids.map((id) => updateCreative(id, patch)));
      const updated = results.filter((r) => r.status === "fulfilled" && r.value).length;
      const failed = results.length - updated;
      res.json({ updated, failed, total: ids.length });
    } catch (err: any) {
      console.error("[creatives] bulk update error:", err);
      res.status(500).json({ message: err.message ?? "erro" });
    }
  });

  app.delete("/api/growth/creatives/:id", guard, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "id inválido" });
      const ok = await softDeleteCreative(id);
      if (!ok) return res.status(404).json({ message: "não encontrado ou já apagado" });
      res.status(204).end();
    } catch (err: any) {
      res.status(500).json({ message: err.message ?? "erro" });
    }
  });

  // ============== Cabeçalho de batch (escrito pela skill turbo-ads-workflow) ==============
  // Idempotente por pasta do Drive. Aceita driveFolderId OU driveFolderUrl.
  app.post("/api/growth/creative-batches", guard, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const b = req.body ?? {};
      const folderId = b.driveFolderId ?? extractDriveFolderId(b.driveFolderUrl);
      if (!folderId) {
        return res.status(400).json({ message: "driveFolderId ou driveFolderUrl válido obrigatório" });
      }
      const batch = await upsertBatch({
        driveFolderId: folderId,
        nomeAd: b.nomeAd ?? null,
        produto: b.produto ?? null,
        roteiroUrl: b.roteiroUrl ?? null,
        clickupTaskId: b.clickupTaskId ?? null,
        modules: b.modules ?? null,
        createdBy: user?.email ?? null,
      });
      res.status(201).json(batch);
    } catch (err: any) {
      console.error("[creatives] batch upsert error:", err);
      res.status(500).json({ message: err.message ?? "erro" });
    }
  });

  app.get("/api/growth/creative-batches/:folderId", guard, async (req: Request, res: Response) => {
    try {
      const folderId = extractDriveFolderId(req.params.folderId) ?? req.params.folderId;
      const batch = await getBatchByFolderId(folderId);
      if (!batch) return res.status(404).json({ message: "batch não encontrado" });
      res.json(batch);
    } catch (err: any) {
      res.status(500).json({ message: err.message ?? "erro" });
    }
  });

  // ============== Vocabulário controlado (dropdowns editáveis) ==============
  app.get("/api/growth/creative-vocab", guard, async (req: Request, res: Response) => {
    try {
      const kind = typeof req.query.kind === "string" ? req.query.kind : undefined;
      const items = await listVocab(kind);
      // Agrupa por kind pra consumo direto no frontend
      const byKind: Record<string, typeof items> = {};
      for (const it of items) (byKind[it.kind] ??= []).push(it);
      res.json({ items, byKind });
    } catch (err: any) {
      console.error("[creatives] vocab list error:", err);
      res.status(500).json({ message: err.message ?? "erro" });
    }
  });

  app.post("/api/growth/creative-vocab", guard, async (req: Request, res: Response) => {
    try {
      const b = req.body ?? {};
      if (!b.kind || !b.value || !b.label) {
        return res.status(400).json({ message: "kind, value e label obrigatórios" });
      }
      const item = await upsertVocab({
        kind: String(b.kind),
        value: String(b.value),
        label: String(b.label),
        sortOrder: typeof b.sortOrder === "number" ? b.sortOrder : 0,
        active: b.active !== false,
      });
      res.status(201).json(item);
    } catch (err: any) {
      console.error("[creatives] vocab upsert error:", err);
      res.status(500).json({ message: err.message ?? "erro" });
    }
  });

  // ============== Read-back: performance por criativo (TP) ==============
  app.get("/api/growth/creative-performance", guard, async (req: Request, res: Response) => {
    try {
      const { since, until } = defaultWindow(req.query);
      const rows = await getCreativePerformance({ since, until });
      res.json({ since, until, rows });
    } catch (err: any) {
      console.error("[creatives] performance error:", err);
      res.status(500).json({ message: err.message ?? "erro" });
    }
  });

  // ============== Read-back: ranking por atributo (angulo/persona/tipo/produto/body/cta) ==============
  app.get("/api/growth/creative-ranking", guard, async (req: Request, res: Response) => {
    try {
      const { since, until } = defaultWindow(req.query);
      const dimension = typeof req.query.dimension === "string" ? req.query.dimension : "angulo";
      const rows = await getCreativeRanking({ since, until, dimension });
      res.json({ since, until, dimension, rows });
    } catch (err: any) {
      console.error("[creatives] ranking error:", err);
      res.status(400).json({ message: err.message ?? "erro" });
    }
  });

  // Match Drive ↔ Biblioteca — chamado pelo frontend ao validar uma pasta antes de subir campanha
  app.post("/api/growth/creatives/match", guard, async (req: Request, res: Response) => {
    try {
      const driveFiles = Array.isArray(req.body?.driveFiles) ? req.body.driveFiles : [];
      const rows = await listAllForMatching();
      const result = matchDriveFilesToRows(driveFiles, rows);
      res.json(result);
    } catch (err: any) {
      console.error("[creatives] match error:", err);
      res.status(500).json({ message: err.message ?? "erro" });
    }
  });
}
