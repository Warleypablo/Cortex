import type { Express } from "express";
import { sql } from "drizzle-orm";
import { buildPayload, type RawRow, type Filtros } from "./churnPontorrente.helpers";

export function registerChurnPontorrenteRoutes(app: Express, db: any) {
  // Snapshot completo do churn de contratos ponto-recorrentes (filtros aplicados em memória).
  app.get("/api/churn-pontorrente", async (req, res) => {
    try {
      const base = req.query.base === "entregue" ? "entregue" : "vendido";
      const filtros: Filtros = {
        produto: (req.query.produto as string) || undefined,
        squad: (req.query.squad as string) || undefined,
        responsavel: (req.query.responsavel as string) || undefined,
        de: (req.query.de as string) || undefined,
        ate: (req.query.ate as string) || undefined,
      };

      const result = (await db.execute(sql`
        SELECT
          c.id_task                       AS "idTask",
          c.produto                       AS produto,
          c.servico                       AS servico,
          c.status                        AS status,
          c.valorp                        AS valorp,
          c.squad                         AS squad,
          c.responsavel                   AS responsavel,
          c.cs_responsavel                AS "csResponsavel",
          c.vendedor                      AS vendedor,
          c.motivo_cancelamento           AS "motivoCancelamento",
          to_char(c.data_inicio, 'YYYY-MM-DD')                   AS "dataInicio",
          to_char(c.data_solicitacao_encerramento, 'YYYY-MM-DD') AS "dataEncerramento",
          cl.nome                         AS "nomeCliente"
        FROM "Clickup".cup_contratos c
        LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = c.id_task
        WHERE c.servico ILIKE '%entrega%'
      `)).rows as any[];

      const rows: RawRow[] = result.map((r) => ({
        idTask: r.idTask ?? null,
        produto: r.produto ?? null,
        servico: r.servico ?? "",
        status: r.status ?? null,
        valorp: r.valorp != null ? Number(r.valorp) : null,
        squad: r.squad ?? null,
        responsavel: r.responsavel ?? null,
        csResponsavel: r.csResponsavel ?? null,
        vendedor: r.vendedor ?? null,
        motivoCancelamento: r.motivoCancelamento ?? null,
        dataInicio: r.dataInicio ?? null,
        dataEncerramento: r.dataEncerramento ?? null,
        nomeCliente: r.nomeCliente ?? null,
      }));

      res.json(buildPayload(rows, base, filtros));
    } catch (error) {
      console.error("[api] Error fetching churn-pontorrente:", error);
      res.status(500).json({ error: "Failed to fetch churn-pontorrente" });
    }
  });
}
