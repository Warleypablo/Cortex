// server/routes/creatorsModelo.ts
import type { Express } from "express";
import { sql } from "drizzle-orm";
import {
  buildRedesignPayload, buildClientesDetalhe, buildEvolucaoClientes,
  type RawRow, type Modelo, type EstadoFiltro, type EvoSnapRow,
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
  app.get("/api/creators-modelo/evolucao", async (req, res) => {
    try {
      const unidade = req.query.unidade === "contrato" ? "contrato" : "cliente";
      const agregador = req.query.agregador === "mediana" ? "mediana" : "media";
      const estadoQ = String(req.query.estado ?? "todos");
      const estado = estadoQ === "ativo" || estadoQ === "cancelado" ? estadoQ : "todos";
      // período = coorte por data_inicio + recorta os meses do snapshot ('YYYY-MM').
      const de = typeof req.query.de === "string" && /^\d{4}-\d{2}$/.test(req.query.de) ? req.query.de : null;
      const ate = typeof req.query.ate === "string" && /^\d{4}-\d{2}$/.test(req.query.ate) ? req.query.ate : null;
      const mesDe = de ? sql`AND to_char(data_snapshot::date,'YYYY-MM') >= ${de}` : sql``;
      const mesAte = ate ? sql`AND to_char(data_snapshot::date,'YYYY-MM') <= ${ate}` : sql``;
      const cohortDe = de ? sql`AND to_char(h.data_inicio::date,'YYYY-MM') >= ${de}` : sql``;
      const cohortAte = ate ? sql`AND to_char(h.data_inicio::date,'YYYY-MM') <= ${ate}` : sql``;

      // grão do recorrente: contrato = por subtask; cliente = por task. Pontual
      // é sempre por task (a jornada é o contrato), espelhando a tabela do topo.
      const grainRec = unidade === "contrato" ? sql`id_subtask` : sql`id_task`;
      // agregador (média/mediana) aplicado por coluna
      const agg = (col: any) =>
        agregador === "mediana"
          ? sql`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${col})`
          : sql`AVG(${col})`;
      // filtro de estado (classificação client-level, espelha a tabela):
      // recorrente ativo = tem linha ativa; cancelado = só cancelada (sem ativa).
      // pontual cancelado = sem em-produção e com cancelada; ativo = o resto.
      const recPred =
        estado === "ativo" ? sql`tem_ativo`
        : estado === "cancelado" ? sql`(NOT tem_ativo AND tem_cancel)`
        : sql`(tem_ativo OR tem_cancel)`;
      const pontPred =
        estado === "ativo" ? sql`(tem_emprod OR NOT tem_cancel)`
        : estado === "cancelado" ? sql`(NOT tem_emprod AND tem_cancel)`
        : sql`TRUE`;

      const result = await db.execute(sql`
        WITH meses AS (
          SELECT to_char(data_snapshot::date,'YYYY-MM') AS m, MAX(data_snapshot::date) AS fim
          FROM "Clickup".cup_data_hist
          WHERE TRUE ${mesDe} ${mesAte}
          GROUP BY 1
        ),
        snap AS (
          SELECT mz.m, mz.fim, h.id_task, h.id_subtask,
            LOWER(TRIM(COALESCE(h.status,''))) AS status,
            COALESCE(h.valorr::numeric,0) AS vr,
            COALESCE(h.valorp::numeric,0) AS vp,
            h.data_inicio::date AS di
          FROM meses mz
          JOIN "Clickup".cup_data_hist h ON h.data_snapshot::date = mz.fim
          WHERE h.servico ILIKE '%creator%' ${cohortDe} ${cohortAte}
        ),
        rec_unit AS (
          SELECT m, ${grainRec} AS uid,
            GREATEST(0,(fim - MIN(di)))/30.44 AS lt,
            SUM(vr * GREATEST(0,(fim - di))/30.44) AS ltv,
            -- MRR ativo do mês = Σ valorr da base que está faturando (ativo/onboarding/triagem)
            SUM(vr) FILTER (WHERE status IN ('ativo','onboarding','triagem')) AS mrr,
            bool_or(status IN ('ativo','onboarding','triagem','pausado')) AS tem_ativo,
            bool_or(status IN ('cancelado/inativo','em cancelamento')) AS tem_cancel
          FROM snap WHERE vr > 0 GROUP BY m, fim, ${grainRec}
        ),
        pont_unit AS (
          SELECT m, id_task AS uid,
            COUNT(*) FILTER (WHERE status='entregue')::numeric AS entregues,
            COALESCE(SUM(vp) FILTER (WHERE status='entregue'),0) AS ltv,
            bool_or(status NOT IN ('entregue','cancelado/inativo','não usar')) AS tem_emprod,
            bool_or(status IN ('cancelado/inativo','não usar')) AS tem_cancel
          FROM snap WHERE vp > 0 GROUP BY m, id_task
        ),
        -- Faturamento pontual = entregue NO mês: 1º snapshot em que cada entrega
        -- (id_subtask) ficou 'entregue' marca o mês; soma o valorp nesse mês.
        entregue_mes AS (
          SELECT DISTINCT ON (id_subtask) id_subtask, id_task, m AS mes_ent, vp
          FROM snap WHERE vp > 0 AND status = 'entregue' AND id_subtask IS NOT NULL
          ORDER BY id_subtask, m
        ),
        rec_agg AS (
          SELECT m, COUNT(*) AS cli, ${agg(sql`lt`)} AS lt, ${agg(sql`ltv`)} AS ltv,
            SUM(mrr) AS fat
          FROM rec_unit WHERE ${recPred} GROUP BY m
        ),
        pont_agg AS (
          SELECT m, COUNT(*) AS cli,
            ${agg(sql`CASE WHEN entregues >= 2 THEN entregues END`)} AS lt,
            ${agg(sql`CASE WHEN entregues >= 2 THEN ltv END`)} AS ltv
          FROM pont_unit WHERE ${pontPred} GROUP BY m
        ),
        pont_fat AS (
          SELECT e.mes_ent AS m, SUM(e.vp) AS fat
          FROM entregue_mes e
          JOIN pont_unit pu ON pu.m = e.mes_ent AND pu.uid = e.id_task
          WHERE ${pontPred}
          GROUP BY e.mes_ent
        )
        SELECT mz.m AS mes,
          COALESCE(r.cli,0)::int AS rec_cli, r.lt AS rec_lt, r.ltv AS rec_ltv, r.fat AS rec_fat,
          COALESCE(p.cli,0)::int AS pont_cli, p.lt AS pont_lt, p.ltv AS pont_ltv, pf.fat AS pont_fat
        FROM (SELECT DISTINCT m FROM meses) mz
        LEFT JOIN rec_agg r ON r.m = mz.m
        LEFT JOIN pont_agg p ON p.m = mz.m
        LEFT JOIN pont_fat pf ON pf.m = mz.m
        ORDER BY mz.m
      `);
      const r1 = (n: any) => (n == null ? null : Math.round(Number(n) * 10) / 10);
      const r0 = (n: any) => (n == null ? null : Math.round(Number(n)));
      const meses = (result.rows as any[]).map((r) => ({
        mes: r.mes,
        recorrente: { clientes: Number(r.rec_cli), lt: r1(r.rec_lt), ltv: r0(r.rec_ltv), faturamento: r0(r.rec_fat) },
        pontual: { clientes: Number(r.pont_cli), lt: r1(r.pont_lt), ltv: r0(r.pont_ltv), faturamento: r0(r.pont_fat) },
      }));
      res.json({ meses });
    } catch (error) {
      console.error("[api] Error fetching creators-modelo evolucao:", error);
      res.status(500).json({ error: "Failed to fetch creators-modelo evolucao" });
    }
  });

  // Auditoria de uma célula da evolução: clientes de um modelo no snapshot de
  // fim do mês `mes`, com LT/LTV (régua da evolução) e detalhe das entregas.
  app.get("/api/creators-modelo/evolucao/clientes", async (req, res) => {
    try {
      const mes = String(req.query.mes ?? "");
      const modelo: Modelo = req.query.modelo === "recorrente" ? "recorrente" : "pontual";
      const estadoQ = String(req.query.estado ?? "ambos");
      const estado: EstadoFiltro = estadoQ === "ativo" || estadoQ === "cancelado" ? estadoQ : "ambos";
      if (!/^\d{4}-\d{2}$/.test(mes)) return res.status(400).json({ error: "mes inválido" });
      // mesma coorte por data_inicio do resto da sub-aba
      const de = typeof req.query.de === "string" && /^\d{4}-\d{2}$/.test(req.query.de) ? req.query.de : null;
      const ate = typeof req.query.ate === "string" && /^\d{4}-\d{2}$/.test(req.query.ate) ? req.query.ate : null;
      const cohortDe = de ? sql`AND to_char(h.data_inicio::date,'YYYY-MM') >= ${de}` : sql``;
      const cohortAte = ate ? sql`AND to_char(h.data_inicio::date,'YYYY-MM') <= ${ate}` : sql``;

      const result = await db.execute(sql`
        WITH alvo AS (
          SELECT MAX(data_snapshot::date) AS d FROM "Clickup".cup_data_hist
          WHERE to_char(data_snapshot::date,'YYYY-MM') = ${mes}
        )
        SELECT h.id_task,
          NULLIF(TRIM(cl.nome), '') AS nome,
          h.status,
          COALESCE(h.valorr::numeric,0) AS valorr,
          COALESCE(h.valorp::numeric,0) AS valorp,
          h.servico,
          to_char(h.data_inicio::date,'YYYY-MM-DD') AS data_inicio,
          to_char((SELECT d FROM alvo),'YYYY-MM-DD') AS fim
        FROM "Clickup".cup_data_hist h
        JOIN alvo ON h.data_snapshot::date = alvo.d
        LEFT JOIN "Clickup".cup_clientes cl ON cl.task_id = h.id_task
        WHERE h.servico ILIKE '%creator%' ${cohortDe} ${cohortAte}
      `);
      const rows = result.rows as any[];
      if (!rows.length) return res.json({ mes, modelo, clientes: [] });
      const fim = rows[0].fim as string;
      const snap: EvoSnapRow[] = rows.map((r) => ({
        idTask: r.id_task, nome: r.nome ?? null, status: r.status ?? null,
        valorr: Number(r.valorr) || 0, valorp: Number(r.valorp) || 0,
        servico: r.servico ?? "", dataInicio: r.data_inicio ?? null,
      }));
      res.json({ mes, modelo, clientes: buildEvolucaoClientes(snap, modelo, estado, fim) });
    } catch (error) {
      console.error("[api] Error fetching creators-modelo evolucao/clientes:", error);
      res.status(500).json({ error: "Failed to fetch creators-modelo evolucao clientes" });
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
