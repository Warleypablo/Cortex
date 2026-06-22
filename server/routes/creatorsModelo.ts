// server/routes/creatorsModelo.ts
import type { Express } from "express";
import { sql } from "drizzle-orm";
import {
  buildRedesignPayload, buildClientesDetalhe,
  type RawRow, type Modelo,
} from "./creatorsModelo.helpers";

/** Busca as linhas de Creators (recorrente + pontual) da view e mapeia para RawRow. */
async function fetchCreatorsRows(db: any): Promise<RawRow[]> {
  const result = (await db.execute(sql`
    SELECT
      id_task, id_subtask, nome_cliente, produto, servico, status, tipo_receita,
      valorr, valorp, lt_meses, ltv_recorrente,
      is_ativo, is_churned, data_inconsistente,
      to_char(data_inicio, 'YYYY-MM-DD') AS data_inicio,
      to_char(data_fim, 'YYYY-MM-DD')    AS data_fim
    FROM cortex_core.vw_lt_contratos
    WHERE produto = 'Creators' AND tipo_receita IN ('recorrente','pontual')
  `)).rows as any[];

  return result.map((r) => ({
    idTask: r.id_task ?? null,
    idSubtask: r.id_subtask ?? null,
    nome: r.nome_cliente ?? null,
    produto: r.produto ?? null,
    servico: r.servico ?? "",
    status: r.status ?? null,
    tipoReceita: r.tipo_receita ?? null,
    valorr: r.valorr != null ? Number(r.valorr) : 0,
    valorp: r.valorp != null ? Number(r.valorp) : 0,
    ltMeses: r.lt_meses != null ? Number(r.lt_meses) : null,
    ltvRecorrente: r.ltv_recorrente != null ? Number(r.ltv_recorrente) : null,
    isAtivo: !!r.is_ativo,
    isChurned: !!r.is_churned,
    dataInconsistente: !!r.data_inconsistente,
    dataInicio: r.data_inicio ?? null,
    dataFim: r.data_fim ?? null,
  }));
}

export function registerCreatorsModeloRoutes(app: Express, db: any) {
  app.get("/api/creators-modelo", async (req, res) => {
    try {
      const de = (req.query.de as string) || undefined;
      const ate = (req.query.ate as string) || undefined;
      const rows = await fetchCreatorsRows(db);
      const hoje = new Date().toISOString().slice(0, 10);
      res.json(buildRedesignPayload(rows, { de, ate, hoje }));
    } catch (error) {
      console.error("[api] Error fetching creators-modelo:", error);
      res.status(500).json({ error: "Failed to fetch creators-modelo" });
    }
  });

  // Auditoria/drill-down: clientes de um modelo, com LT/LTV e detalhe das entregas.
  app.get("/api/creators-modelo/clientes", async (req, res) => {
    try {
      const modelo: Modelo = req.query.modelo === "recorrente" ? "recorrente" : "pontual";
      const de = (req.query.de as string) || undefined;
      const ate = (req.query.ate as string) || undefined;
      const rows = await fetchCreatorsRows(db);
      const hoje = new Date().toISOString().slice(0, 10);
      res.json({ modelo, clientes: buildClientesDetalhe(rows, modelo, { de, ate, hoje }) });
    } catch (error) {
      console.error("[api] Error fetching creators-modelo clientes:", error);
      res.status(500).json({ error: "Failed to fetch creators-modelo clientes" });
    }
  });
}
