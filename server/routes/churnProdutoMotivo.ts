import type { Express } from "express";
import { sql } from "drizzle-orm";

interface ViewRow {
  produto: string;
  motivo_cancelamento: string;
  cancelamentos: string | number;
  mrr_perdido: string | number;
  ticket_medio: string | number;
  pct_dentro_produto: string | number;
  pct_total: string | number;
}

export function registerChurnProdutoMotivoRoutes(app: Express, db: any) {
  app.get("/api/churn/produto-motivo", async (req, res) => {
    try {
      const now = new Date();
      const defaultStart = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().split("T")[0];
      const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

      // Aceita dataInicio e dataFim no formato YYYY-MM ou YYYY-MM-DD
      const rawInicio = String(req.query.dataInicio || "");
      const rawFim = String(req.query.dataFim || "");
      const startStr = rawInicio ? `${rawInicio.slice(0, 7)}-01` : defaultStart;
      const endStr = rawFim ? `${rawFim.slice(0, 7)}-01` : defaultEnd;

      const result = await db.execute(sql`
        SELECT produto, motivo_cancelamento,
               SUM(cancelamentos)::int AS cancelamentos,
               SUM(mrr_perdido)::numeric AS mrr_perdido,
               CASE WHEN SUM(cancelamentos) > 0
                    THEN SUM(mrr_perdido) / SUM(cancelamentos)
                    ELSE 0 END AS ticket_medio,
               0 AS pct_dentro_produto,
               0 AS pct_total
        FROM cortex_core.vw_churn_produto_motivo_mensal
        WHERE ano_mes >= ${startStr}::date
          AND ano_mes <= ${endStr}::date
        GROUP BY produto, motivo_cancelamento
        ORDER BY SUM(mrr_perdido) DESC, SUM(cancelamentos) DESC
      `);
      const data: ViewRow[] = result.rows;

      // Top 8 motivos por cancelamentos totais
      const motivoTotais = new Map<string, number>();
      data.forEach(r => {
        const m = r.motivo_cancelamento;
        motivoTotais.set(m, (motivoTotais.get(m) || 0) + Number(r.cancelamentos));
      });
      const motivosOrdenados = Array.from(motivoTotais.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([m]) => m);
      const top8 = motivosOrdenados.slice(0, 8);
      const temOutros = motivosOrdenados.length > 8;
      const motivos = temOutros ? top8.concat(["Outros"]) : top8;

      // Top 10 produtos ordenados por mrr_perdido total
      const produtoMrr = new Map<string, number>();
      data.forEach(r => {
        produtoMrr.set(r.produto, (produtoMrr.get(r.produto) || 0) + Number(r.mrr_perdido));
      });
      const produtos = Array.from(produtoMrr.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([p]) => p)
        .slice(0, 10);

      // Agregar células — apenas top10 produtos, motivos fora do top8 viram "Outros"
      const cellMap = new Map<string, {
        cancelamentos: number; mrr_perdido: number; ticket_soma: number;
      }>();
      data.forEach(r => {
        if (!produtos.includes(r.produto)) return;
        const motivo = top8.includes(r.motivo_cancelamento) ? r.motivo_cancelamento : "Outros";
        const key = `${r.produto}|||${motivo}`;
        const cur = cellMap.get(key) || { cancelamentos: 0, mrr_perdido: 0, ticket_soma: 0 };
        const qtd = Number(r.cancelamentos);
        cur.cancelamentos += qtd;
        cur.mrr_perdido += Number(r.mrr_perdido);
        cur.ticket_soma += Number(r.ticket_medio) * qtd;
        cellMap.set(key, cur);
      });

      // Recalcular pct_dentro_produto após merge de "Outros"
      const prodTotais = new Map<string, number>();
      cellMap.forEach((v, key) => {
        const prod = key.split("|||")[0];
        prodTotais.set(prod, (prodTotais.get(prod) || 0) + v.cancelamentos);
      });
      const totalCancelamentos = Array.from(prodTotais.values()).reduce((a, b) => a + b, 0);
      const totalMrr = Array.from(cellMap.values()).reduce((a, v) => a + v.mrr_perdido, 0);
      const totalTicketSoma = Array.from(cellMap.values()).reduce((a, v) => a + v.ticket_soma, 0);

      const celulas = Array.from(cellMap.entries()).map(([key, v]) => {
        const [produto, motivo_cancelamento] = key.split("|||");
        const prodTotal = prodTotais.get(produto) || 1;
        return {
          produto,
          motivo_cancelamento,
          cancelamentos: v.cancelamentos,
          mrr_perdido: Math.round(v.mrr_perdido * 100) / 100,
          ticket_medio: v.cancelamentos > 0
            ? Math.round((v.ticket_soma / v.cancelamentos) * 100) / 100
            : 0,
          pct_dentro_produto: Math.round((v.cancelamentos / prodTotal) * 10000) / 100,
          pct_total: Math.round((v.cancelamentos / totalCancelamentos) * 10000) / 100,
        };
      });

      res.json({
        produtos,
        motivos,
        celulas,
        totais: {
          cancelamentos: totalCancelamentos,
          mrr_perdido: Math.round(totalMrr * 100) / 100,
          ticket_medio: totalCancelamentos > 0
            ? Math.round((totalTicketSoma / totalCancelamentos) * 100) / 100
            : 0,
        },
      });
    } catch (error) {
      console.error("[api] Error fetching churn produto-motivo:", error);
      res.status(500).json({ error: "Failed to fetch churn produto-motivo" });
    }
  });

  app.get("/api/churn/produto-motivo/mensal", async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT
          to_char(ano_mes, 'YYYY-MM-DD') AS ano_mes,
          produto,
          motivo_cancelamento,
          cancelamentos,
          mrr_perdido,
          ticket_medio
        FROM cortex_core.vw_churn_produto_motivo_mensal
        ORDER BY ano_mes DESC, mrr_perdido DESC
      `);
      res.json({ rows: result.rows });
    } catch (error) {
      console.error("[api] Error fetching churn produto-motivo mensal:", error);
      res.status(500).json({ error: "Failed to fetch churn produto-motivo mensal" });
    }
  });
}
