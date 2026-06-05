import type { Express } from "express";
import { sql } from "drizzle-orm";

const GRUPOS = [
  { prefixo: "06.04", nome: "06.04 Equipe Comercial" },
  { prefixo: "06.06", nome: "06.06 Growth" },
  { prefixo: "06.07", nome: "06.07 Eventos/Marketing" },
];

function safeDiv(num: number, den: number): number | null {
  return den === 0 ? null : Math.round((num / den) * 10) / 10;
}

export function registerGrowthDfcCacRoutes(app: Express, db: any) {
  app.get("/api/growth/dfc-cac", async (req, res) => {
    const meses = Math.min(Math.max(parseInt(req.query.meses as string) || 6, 1), 24);
    try {
      const custosRows = (await db.execute(sql`
        SELECT
          to_char(date_trunc('month', p.data_pagamento_previsto), 'YYYY-MM') AS mes,
          REGEXP_REPLACE(TRIM(cat.categoria), '\\s+', ' ', 'g') AS categoria,
          ROUND(SUM(p.valor_liquido)::numeric, 0) AS total
        FROM "Conta Azul".caz_parcelas p,
          regexp_split_to_table(p.categoria_nome, ';') AS cat(categoria)
        WHERE p.tipo_evento = 'DESPESA'
          AND p.status = 'QUITADO'
          AND (
            REGEXP_REPLACE(TRIM(cat.categoria), '\\s+', ' ', 'g') LIKE '06.04%'
            OR REGEXP_REPLACE(TRIM(cat.categoria), '\\s+', ' ', 'g') LIKE '06.06%'
            OR REGEXP_REPLACE(TRIM(cat.categoria), '\\s+', ' ', 'g') LIKE '06.07%'
          )
          AND p.data_pagamento_previsto >= date_trunc('month', CURRENT_DATE) - (${meses} || ' months')::interval
          AND p.data_pagamento_previsto < date_trunc('month', CURRENT_DATE)
        GROUP BY 1, 2
        ORDER BY 1, 2
      `)).rows as { mes: string; categoria: string; total: string }[];

      const receitaRows = (await db.execute(sql`
        SELECT
          to_char(date_trunc('month', data_fechamento), 'YYYY-MM') AS mes,
          COUNT(*)::int AS contratos,
          ROUND(COALESCE(SUM(valor_recorrente), 0)::numeric, 0) AS mrr,
          ROUND(COALESCE(SUM(valor_pontual), 0)::numeric, 0) AS pontual
        FROM "Bitrix".crm_deal
        WHERE stage_name = 'Negócio Ganho'
          AND data_fechamento >= date_trunc('month', CURRENT_DATE) - (${meses} || ' months')::interval
          AND data_fechamento < date_trunc('month', CURRENT_DATE)
        GROUP BY 1
        ORDER BY 1
      `)).rows as { mes: string; contratos: string; mrr: string; pontual: string }[];

      const mesSet = new Set<string>();
      custosRows.forEach(r => mesSet.add(r.mes));
      receitaRows.forEach(r => mesSet.add(r.mes));
      const mesesList = Array.from(mesSet).sort();

      const recorrente: Record<string, number> = {};
      const pontual: Record<string, number> = {};
      const total: Record<string, number> = {};
      const contratos: Record<string, number> = {};
      for (const r of receitaRows) {
        recorrente[r.mes] = Number(r.mrr) || 0;
        pontual[r.mes] = Number(r.pontual) || 0;
        total[r.mes] = (Number(r.mrr) || 0) + (Number(r.pontual) || 0);
        contratos[r.mes] = Number(r.contratos) || 0;
      }

      const custoTotal: Record<string, number> = {};
      const grupos = GRUPOS.map(({ prefixo, nome }) => {
        const linhasMap = new Map<string, Record<string, number>>();
        for (const r of custosRows) {
          if (!r.categoria.startsWith(prefixo)) continue;
          if (!linhasMap.has(r.categoria)) linhasMap.set(r.categoria, {});
          linhasMap.get(r.categoria)![r.mes] = Number(r.total) || 0;
          custoTotal[r.mes] = (custoTotal[r.mes] || 0) + (Number(r.total) || 0);
        }
        const subtotais: Record<string, number> = {};
        linhasMap.forEach((valores) => {
          for (const [mes, val] of Object.entries(valores)) {
            subtotais[mes] = (subtotais[mes] || 0) + (val as number);
          }
        });
        return {
          grupo: nome,
          prefixo,
          linhas: Array.from(linhasMap.entries()).map(([categoria, valores]) => ({ categoria, valores })),
          subtotais,
        };
      });

      const cac: Record<string, number | null> = {};
      const ticketMedioRec: Record<string, number | null> = {};
      const payback: Record<string, number | null> = {};
      const roi: Record<string, number | null> = {};
      for (const mes of mesesList) {
        const c = contratos[mes] || 0;
        const custo = custoTotal[mes] || 0;
        const mrr = recorrente[mes] || 0;
        const rec = total[mes] || 0;
        const cacVal = safeDiv(custo, c);
        const ticketVal = safeDiv(mrr, c);
        cac[mes] = cacVal !== null ? Math.round(cacVal) : null;
        ticketMedioRec[mes] = ticketVal !== null ? Math.round(ticketVal) : null;
        payback[mes] = cacVal !== null && ticketVal !== null ? safeDiv(cacVal, ticketVal) : null;
        roi[mes] = safeDiv((rec - custo) * 100, custo);
      }

      const ultimoMes = mesesList[mesesList.length - 1];
      const resumo = {
        cac: ultimoMes ? cac[ultimoMes] ?? null : null,
        ticketMedioRec: ultimoMes ? ticketMedioRec[ultimoMes] ?? null : null,
        payback: ultimoMes ? payback[ultimoMes] ?? null : null,
        roi: ultimoMes ? roi[ultimoMes] ?? null : null,
      };

      res.json({
        meses: mesesList,
        receita: { recorrente, pontual, total, contratos },
        custos: { grupos, total: custoTotal },
        metricas: { cac, ticketMedioRec, payback, roi },
        resumo,
      });
    } catch (error) {
      console.error("[api] Error fetching growth dfc-cac:", error);
      res.status(500).json({ error: "Failed to fetch dfc-cac" });
    }
  });
}
