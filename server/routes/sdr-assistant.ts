import type { Express, Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import { isAuthenticated } from "../auth/middleware";

const ALLOWED_DEPARTMENTS = new Set(["admin", "comercial"]);

function requireInternalCollaborator(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: "not authenticated" });
  }
  if (!ALLOWED_DEPARTMENTS.has(user.department)) {
    return res
      .status(403)
      .json({ error: "forbidden — internal collaborators only (admin/comercial)" });
  }
  next();
}

export function registerSdrAssistantRoutes(app: Express, db: any) {
  app.post(
    "/api/sdr-assistant/chat",
    isAuthenticated,
    requireInternalCollaborator,
    async (_req: Request, res: Response) => {
      return res.json({ response: "skeleton ok", tool_calls: [], usage: null });
    }
  );
}
