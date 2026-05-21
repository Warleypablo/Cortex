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
  getCreativeById,
  createCreative,
  updateCreative,
  softDeleteCreative,
  getDistinctOptions,
  matchDriveFilesToRows,
  listAllForMatching,
} from "../services/adsCreation/creativesRepo";
import type { User } from "../auth/userDb";

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
      const result = await listCreatives({
        q: typeof req.query.q === "string" ? req.query.q : undefined,
        personagem: typeof req.query.personagem === "string" ? req.query.personagem : undefined,
        produto: typeof req.query.produto === "string" ? req.query.produto : undefined,
        etapaFunil: typeof req.query.etapaFunil === "string" ? req.query.etapaFunil : undefined,
        adValidado: parseBoolFlag(req.query.adValidado),
        page: req.query.page ? parseInt(String(req.query.page), 10) : undefined,
        pageSize: req.query.pageSize ? parseInt(String(req.query.pageSize), 10) : undefined,
      });
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
