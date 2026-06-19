// server/routes/bp2026.reconciliacao.ts
// Waterfall de reconciliação de MRR por produto×mês (snapshot M-1 -> M).
import type { Express } from "express";
import { sql } from "drizzle-orm";
import { computeReconciliacao, type SnapRow } from "./bp2026.reconciliacao.helpers";
import { CASE_PRODUTO } from "./bp2026.revenue";

const ANO = 2026;
const PRODUTOS = ["performance", "creators", "social", "gc", "others"];

export async function fetchSnapRows(db: any, dia: string): Promise<SnapRow[]> {
  // CASE_PRODUTO roda em CTE isolada sobre cup_data_hist (sem JOIN com cup_clientes,
  // que também tem coluna servico/produto — evita ambiguidade de coluna).
  // O JOIN com cup_clientes é feito na query externa, sobre o alias da CTE.
  const result = await db.execute(sql`
    WITH base AS (
      SELECT h.id_subtask, h.id_task,
             COALESCE(h.servico, '') AS servico,
             LOWER(COALESCE(h.status, '')) AS status,
             ${CASE_PRODUTO} AS linha,
             COALESCE(h.valorr::numeric, 0) AS valorr
      FROM "Clickup".cup_data_hist h
      WHERE h.data_snapshot::date = ${dia}::date
    )
    SELECT b.id_subtask,
           COALESCE(NULLIF(TRIM(cl.nome), ''), '(sem cliente)') AS cliente,
           b.servico, b.status, b.linha, b.valorr
    FROM base b
    LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = b.id_task
  `);
  return (result.rows as any[]).map((r: any) => ({
    id_subtask: r.id_subtask, cliente: r.cliente, servico: r.servico,
    status: r.status, linha: r.linha, valorr: parseFloat(r.valorr),
  }));
}

export function registerBp2026ReconciliacaoRoutes(app: Express, db: any) {
  app.get("/api/bp2026/reconciliacao", async (req, res) => {
    try {
      const produto = String(req.query.produto ?? "");
      const mes = Number(req.query.mes);
      if (!PRODUTOS.includes(produto) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
        return res.status(400).json({ error: "produto/mes inválidos" });
      }

      // datas dos snapshots: cur = último do mês; prev = último do mês anterior
      const datas = await db.execute(sql`
        SELECT
          (SELECT MAX(data_snapshot::date) FROM "Clickup".cup_data_hist
           WHERE data_snapshot::date >= make_date(${ANO}, ${mes}, 1)
             AND data_snapshot::date < (make_date(${ANO}, ${mes}, 1) + INTERVAL '1 month')) AS cur,
          (SELECT MAX(data_snapshot::date) FROM "Clickup".cup_data_hist
           WHERE data_snapshot::date >= (make_date(${ANO}, ${mes}, 1) - INTERVAL '1 month')
             AND data_snapshot::date < make_date(${ANO}, ${mes}, 1)) AS prev
      `);
      const curD = (datas.rows[0] as any).cur;
      const prevD = (datas.rows[0] as any).prev;
      if (!curD || !prevD) {
        return res.json({ produto, mes, mrrInicio: 0, mrrFim: 0, reconcilia: true, componentes: [] });
      }

      const [prevRows, curRows] = await Promise.all([
        fetchSnapRows(db, prevD), fetchSnapRows(db, curD),
      ]);
      const rec = computeReconciliacao(produto, prevRows, curRows);

      // enriquecer saídas sem rastreio: último snapshot visto + presença em cup_churn
      const saidas = rec.componentes.find((c) => c.chave === "saidas_sem_rastreio");
      let contratosPorComp = rec.componentes.map((c) => ({
        chave: c.chave, titulo: c.titulo, valor: c.valor, n: c.n,
        contratos: c.contratos as any[],
      }));
      if (saidas && saidas.contratos.length) {
        const ids = saidas.contratos.map((m) => m.id_subtask);
        const enr = await db.execute(sql`
          SELECT h.id_subtask,
                 (SELECT MAX(x.data_snapshot::date)::text FROM "Clickup".cup_data_hist x WHERE x.id_subtask = h.id_subtask) AS ultimo,
                 EXISTS (SELECT 1 FROM "Clickup".cup_churn ch WHERE ch.task_id = h.id_subtask) AS em_churn
          FROM (SELECT DISTINCT unnest(${ids}::text[]) AS id_subtask) h
        `);
        const meta = new Map((enr.rows as any[]).map((r) => [r.id_subtask, r]));
        contratosPorComp = contratosPorComp.map((c) =>
          c.chave !== "saidas_sem_rastreio" ? c : {
            ...c,
            contratos: c.contratos.map((m) => ({
              ...m,
              ultimoSnapshot: meta.get(m.id_subtask)?.ultimo ?? null,
              emCupChurn: meta.get(m.id_subtask)?.em_churn ?? false,
            })),
          }
        );
      }

      res.json({
        produto, mes,
        mrrInicio: rec.mrrInicio, mrrFim: rec.mrrFim, reconcilia: rec.reconcilia,
        componentes: contratosPorComp,
      });
    } catch (error) {
      console.error("[bp2026] Erro em /api/bp2026/reconciliacao:", error);
      res.status(500).json({ error: "Erro ao montar reconciliação" });
    }
  });
}
