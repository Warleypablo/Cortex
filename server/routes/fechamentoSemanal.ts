import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

export function registerFechamentoSemanalRoutes(app: Express) {
  // Novos contratos assinados na semana
  app.get("/api/fechamento-semanal/novos-contratos", async (req, res) => {
    try {
      const { semanaInicio, semanaFim } = req.query;

      if (!semanaInicio || !semanaFim) {
        return res.status(400).json({ error: "semanaInicio e semanaFim são obrigatórios" });
      }

      const result = await db.execute(sql`
        SELECT
          c.id_subtask,
          c.nome AS contrato_nome,
          cl.nome AS cliente_nome,
          c.produto,
          c.squad,
          c.cs_responsavel,
          c.vendedor,
          COALESCE(c.valorr::numeric, 0) AS valor_mrr,
          c.data_inicio
        FROM "Clickup".cup_contratos c
        LEFT JOIN "Clickup".cup_clientes cl ON c.id_task = cl.task_id
        WHERE c.data_inicio >= ${semanaInicio}::date
          AND c.data_inicio <= ${semanaFim}::date
          AND c.status IN ('ativo', 'onboarding', 'triagem')
          AND c.valorr IS NOT NULL
          AND c.valorr::numeric > 0
        ORDER BY c.valorr::numeric DESC
      `);

      const contratos = result.rows.map((row: any) => ({
        id: row.id_subtask,
        contratoNome: row.contrato_nome || "Sem nome",
        clienteNome: row.cliente_nome || "Cliente não identificado",
        produto: row.produto || "Não especificado",
        squad: row.squad || "Sem Squad",
        csResponsavel: row.cs_responsavel || "—",
        vendedor: row.vendedor || "—",
        valorMrr: parseFloat(row.valor_mrr) || 0,
        dataInicio: row.data_inicio,
      }));

      res.json(contratos);
    } catch (error) {
      console.error("[api] Error fetching novos contratos semanal:", error);
      res.status(500).json({ error: "Failed to fetch novos contratos" });
    }
  });

  // Saúde dos squads na semana
  app.get("/api/fechamento-semanal/saude-squads", async (req, res) => {
    try {
      const { semanaInicio, semanaFim } = req.query;

      if (!semanaInicio || !semanaFim) {
        return res.status(400).json({ error: "semanaInicio e semanaFim são obrigatórios" });
      }

      // MRR atual por squad (dados ao vivo)
      const mrrResult = await db.execute(sql`
        SELECT
          COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad') AS squad,
          COALESCE(SUM(valorr::numeric), 0) AS mrr,
          COUNT(DISTINCT id_task) AS clientes,
          COUNT(DISTINCT id_subtask) AS contratos
        FROM "Clickup".cup_contratos
        WHERE status IN ('ativo', 'onboarding', 'triagem')
          AND valorr IS NOT NULL AND valorr::numeric > 0
        GROUP BY COALESCE(NULLIF(TRIM(squad), ''), 'Sem Squad')
        ORDER BY mrr DESC
      `);

      // Churn da semana por squad
      const churnResult = await db.execute(sql`
        SELECT
          COALESCE(NULLIF(TRIM(c.squad), ''), 'Sem Squad') AS squad,
          COUNT(*) AS churns,
          COALESCE(SUM(c.valor_r::numeric), 0) AS mrr_perdido
        FROM cortex_core.vw_cup_churn_ajustado c
        WHERE c.data_solicitacao_encerramento >= ${semanaInicio}::date
          AND c.data_solicitacao_encerramento <= ${semanaFim}::date
          AND c.data_solicitacao_encerramento IS NOT NULL
        GROUP BY COALESCE(NULLIF(TRIM(c.squad), ''), 'Sem Squad')
      `);

      // Mapa de churn por squad
      const churnMap = new Map<string, { churns: number; mrrPerdido: number }>();
      for (const row of churnResult.rows as any[]) {
        churnMap.set(row.squad, {
          churns: parseInt(row.churns) || 0,
          mrrPerdido: parseFloat(row.mrr_perdido) || 0,
        });
      }

      const squads = (mrrResult.rows as any[]).map((row) => {
        const mrr = parseFloat(row.mrr) || 0;
        const churn = churnMap.get(row.squad) || { churns: 0, mrrPerdido: 0 };
        const churnRate = mrr > 0 ? (churn.mrrPerdido / mrr) * 100 : 0;
        const saude =
          churnRate === 0 ? "verde" : churnRate < 3 ? "amarelo" : "vermelho";

        return {
          squad: row.squad,
          mrr,
          clientes: parseInt(row.clientes) || 0,
          contratos: parseInt(row.contratos) || 0,
          churns: churn.churns,
          mrrPerdido: churn.mrrPerdido,
          churnRate: parseFloat(churnRate.toFixed(2)),
          saude,
        };
      });

      res.json(squads);
    } catch (error) {
      console.error("[api] Error fetching saude squads semanal:", error);
      res.status(500).json({ error: "Failed to fetch saude squads" });
    }
  });
}
