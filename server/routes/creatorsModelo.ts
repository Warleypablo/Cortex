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

  // Evolução mensal de LT/LTV por modalidade, reconstruída dos snapshots de
  // fim de mês (cup_data_hist). Mede a BASE PRESENTE em cada mês:
  //  - recorrente: LT = idade média da base (1ª compra → snapshot); LTV =
  //    realizado até o mês (valorr × idade). Exclui churnados que já saíram,
  //    então lê mais alto que o total blended da tabela do topo.
  //  - pontual: LT = nº médio de entregas entregues até o mês (1 entrega = 1 mês,
  //    só ≥1); LTV = média do valorp entregue (realizado).
  app.get("/api/creators-modelo/evolucao", async (_req, res) => {
    try {
      const result = await db.execute(sql`
        WITH meses AS (
          SELECT to_char(data_snapshot::date,'YYYY-MM') AS m, MAX(data_snapshot::date) AS fim
          FROM "Clickup".cup_data_hist GROUP BY 1
        ),
        snap AS (
          SELECT mz.m, mz.fim, h.id_task,
            LOWER(TRIM(COALESCE(h.status,''))) AS status,
            COALESCE(h.valorr::numeric,0) AS vr,
            COALESCE(h.valorp::numeric,0) AS vp,
            h.data_inicio::date AS di
          FROM meses mz
          JOIN "Clickup".cup_data_hist h ON h.data_snapshot::date = mz.fim
          WHERE h.servico ILIKE '%creator%'
        ),
        rec AS (
          SELECT m, id_task,
            GREATEST(0,(MAX(fim) - MIN(di)))/30.44 AS lt,
            SUM(vr * GREATEST(0,(fim - di))/30.44) AS ltv
          FROM snap WHERE vr > 0 GROUP BY m, id_task
        ),
        pont AS (
          SELECT m, id_task,
            COUNT(*) FILTER (WHERE status='entregue') AS entregues,
            COALESCE(SUM(vp) FILTER (WHERE status='entregue'),0) AS ltv
          FROM snap WHERE vp > 0 GROUP BY m, id_task
        ),
        rec_agg AS (
          SELECT m, COUNT(*) AS cli, AVG(lt) AS lt, AVG(ltv) AS ltv FROM rec GROUP BY m
        ),
        pont_agg AS (
          SELECT m, COUNT(*) AS cli, AVG(NULLIF(entregues,0)) AS lt, AVG(ltv) AS ltv FROM pont GROUP BY m
        )
        SELECT mz.m AS mes,
          COALESCE(r.cli,0)::int AS rec_cli, r.lt AS rec_lt, r.ltv AS rec_ltv,
          COALESCE(p.cli,0)::int AS pont_cli, p.lt AS pont_lt, p.ltv AS pont_ltv
        FROM (SELECT DISTINCT m FROM meses) mz
        LEFT JOIN rec_agg r ON r.m = mz.m
        LEFT JOIN pont_agg p ON p.m = mz.m
        ORDER BY mz.m
      `);
      const r1 = (n: any) => (n == null ? null : Math.round(Number(n) * 10) / 10);
      const r0 = (n: any) => (n == null ? null : Math.round(Number(n)));
      const meses = (result.rows as any[]).map((r) => ({
        mes: r.mes,
        recorrente: { clientes: Number(r.rec_cli), lt: r1(r.rec_lt), ltv: r0(r.rec_ltv) },
        pontual: { clientes: Number(r.pont_cli), lt: r1(r.pont_lt), ltv: r0(r.pont_ltv) },
      }));
      res.json({ meses });
    } catch (error) {
      console.error("[api] Error fetching creators-modelo evolucao:", error);
      res.status(500).json({ error: "Failed to fetch creators-modelo evolucao" });
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
