import type { Express } from "express";
import { runSnapshotJob } from "../services/saldoDiarioSnapshotJob";

export function registerSaldoDiarioRoutes(
  app: Express,
  isAuthenticated: (req: any, res: any, next: any) => void,
  isAdmin: (req: any, res: any, next: any) => void,
) {
  app.post(
    "/api/admin/saldo-diario/snapshot/run",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const data =
          typeof req.body?.data === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(req.body.data)
            ? req.body.data
            : undefined;

        const record = await runSnapshotJob(data);
        res.json({ ok: true, snapshot: record });
      } catch (error: any) {
        console.error("[api] Error running saldo diario snapshot:", error);
        res.status(500).json({
          ok: false,
          error: error?.message ?? "Failed to run snapshot",
        });
      }
    },
  );
}
