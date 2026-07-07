import type { Express } from "express";
import { isAuthenticated } from "../auth/middleware";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { BP_2026_TARGETS } from "../okr2026/bp2026Targets";
import { krs, type KRDef } from "../okr2026/okrRegistry";
import { addMeses, listaMeses12, rowsParaSeries, type SeriePonto, type SerieRow } from "./scorecard.helpers";

export type ScorecardUnit = "BRL" | "PCT" | "COUNT";
export type ScorecardDirection = "up" | "down";
export type ScorecardOrigem = "bp" | "okr" | "override";

export interface ScorecardMeta {
  valor: number;
  unit: ScorecardUnit;
  direction: ScorecardDirection;
  origem: ScorecardOrigem;
  label: string;
}

export interface ScorecardMetasResult {
  metas: Record<string, ScorecardMeta>;
}

const MES_REGEX = /^\d{4}-\d{2}$/;

/**
 * Overrides fixos que não vêm do BP2026 nem do OKR (ex: metas manuais/negociadas
 * fora dos dois sistemas de planejamento).
 */
const OVERRIDES: Record<string, ScorecardMeta> = {
  receita_cabeca: {
    valor: 20000,
    unit: "BRL",
    direction: "up",
    origem: "override",
    label: "Receita por Cabeça",
  },
};

function quarterFromMes(mes: string): "Q1" | "Q2" | "Q3" | "Q4" | null {
  const mm = parseInt(mes.slice(5, 7), 10);
  if (!mm || mm < 1 || mm > 12) return null;
  if (mm <= 3) return "Q1";
  if (mm <= 6) return "Q2";
  if (mm <= 9) return "Q3";
  return "Q4";
}

function krDirectionToScorecard(direction: KRDef["direction"]): ScorecardDirection {
  return direction === "gte" ? "up" : "down";
}

/**
 * Mensaliza o target trimestral do KR de acordo com sua agregação:
 * - quarter_sum: o target é a soma do trimestre → divide por 3 para virar meta mensal.
 * - quarter_avg / quarter_end / quarter_max / quarter_min: o target já representa
 *   o valor esperado em qualquer ponto do trimestre → mantém como está.
 */
function mensalizarTargetOkr(kr: KRDef, valorTrimestre: number): number {
  if (kr.aggregation === "quarter_sum") {
    return valorTrimestre / 3;
  }
  return valorTrimestre;
}

/**
 * Monta o mapa de metas consolidadas (BP2026 + OKR) para um mês (YYYY-MM).
 * Função pura: não acessa banco nem I/O — lê apenas os registries estáticos.
 *
 * Regra de precedência quando a mesma metric_key existe nos dois sistemas
 * (ex: mrr_active, ebitda, cash_generation, cash_balance): o BP2026 vence,
 * por ser mensal (mais granular) — o OKR é só trimestral.
 */
export function montarMetasScorecard(mes: string): ScorecardMetasResult {
  const metas: Record<string, ScorecardMeta> = {};

  // BP2026 (months) e OKR 2026 (targets por trimestre) só cobrem o ano de planejamento
  // 2026 — as chaves de `months` são literalmente "2026-XX" (ver bp2026Targets.ts). O
  // seletor de mês do painel lista 12 meses para trás, o que pode incluir meses de 2025;
  // aplicar a meta de 2026 a um mês de 2025 (mesmo trimestre/mês numérico) produz um
  // status falso. Para qualquer ano != 2026 não há meta real — melhor não mostrar
  // nenhuma do que mostrar a errada.
  const anoCobertoPeloPlanejamento = mes.slice(0, 4) === "2026";

  if (anoCobertoPeloPlanejamento) {
    const quarter = quarterFromMes(mes);

    // 1) OKR primeiro (trimestral, mensalizado) — processado antes do BP para que
    //    o BP possa sobrescrever em caso de colisão de metric_key.
    if (quarter) {
      for (const kr of krs) {
        const valorTrimestre = kr.targets[quarter];
        if (valorTrimestre === undefined || valorTrimestre === null) continue;

        metas[kr.metricKey] = {
          valor: mensalizarTargetOkr(kr, valorTrimestre),
          unit: kr.unit,
          direction: krDirectionToScorecard(kr.direction),
          origem: "okr",
          label: kr.title,
        };
      }
    }

    // 2) BP2026 (mensal) — sobrescreve o OKR quando a metric_key colide.
    for (const metric of BP_2026_TARGETS) {
      const valor = metric.months[mes];
      if (valor === undefined || valor === null) continue;

      metas[metric.metric_key] = {
        valor,
        unit: metric.unit,
        // "flat" não tem um equivalente direto em "up"|"down"; tratamos como "up"
        // (neutro) já que o contrato do endpoint só suporta as duas direções.
        direction: metric.direction === "down" ? "down" : "up",
        origem: "bp",
        label: metric.title,
      };
    }
  }

  // 3) Overrides fixos por último — sempre vencem, independente do ano (ex:
  //    receita_cabeca é uma meta fixa negociada fora do BP/OKR).
  for (const [key, meta] of Object.entries(OVERRIDES)) {
    metas[key] = meta;
  }

  return { metas };
}

// ---------------------------------------------------------------------------
// Séries mensais por dimensão (modo Evolução)
// ---------------------------------------------------------------------------

export interface SeriesScorecard {
  churnPorProduto: Record<string, SeriePonto[]>;
  churnPorOperador: Record<string, SeriePonto[]>;
  churnPorSquad: Record<string, SeriePonto[]>;
  entregasPorOperador: Record<string, SeriePonto[]>;
  mrrPorSquad: Record<string, SeriePonto[]>;
  mrrPorOperador: Record<string, SeriePonto[]>;
}

export interface ScorecardSeriesResult {
  series: SeriesScorecard;
}

type ChurnDim = "produto" | "responsavel_geral" | "squad";
type MrrDim = "squad" | "responsavel";

/**
 * Churn por dimensão (EVENTO — data de solicitação de encerramento), a partir da view
 * curada `vw_cup_churn_ajustado`. `dim` vem sempre de um literal fixo do nosso código
 * (nunca de input do usuário), então é seguro usar `sql.raw` só para o identificador de
 * coluna — os valores de data seguem parametrizados.
 */
async function fetchChurnPorDimensao(dim: ChurnDim, inicio: string, fim: string): Promise<SerieRow[]> {
  const result = await db.execute(sql`
    SELECT TO_CHAR(DATE_TRUNC('month', data_solicitacao_encerramento),'YYYY-MM') AS mes,
           COALESCE(NULLIF(TRIM(${sql.raw(dim)}),''),'Não Informado') AS dim,
           SUM(valor_r)::numeric AS valor
    FROM cortex_core.vw_cup_churn_ajustado
    WHERE valor_r > 0 AND data_solicitacao_encerramento IS NOT NULL
      AND data_solicitacao_encerramento >= ${inicio}::date AND data_solicitacao_encerramento < ${fim}::date
      AND COALESCE(abonar_churn,'') <> 'Sim'
      AND COALESCE(motivo_cancelamento,'') NOT IN ('Inadimplente 1º Mês','Não começou','Erro na Venda')
    GROUP BY 1,2
  `);
  return result.rows as unknown as SerieRow[];
}

/** Entregas por operador (FLUXO — data de entrega), a partir de `cup_contratos`. */
async function fetchEntregasPorOperador(inicio: string, fim: string): Promise<SerieRow[]> {
  const result = await db.execute(sql`
    SELECT TO_CHAR(data_entrega,'YYYY-MM') AS mes, TRIM(responsavel) AS dim, SUM(valorp::numeric)::numeric AS valor
    FROM "Clickup".cup_contratos
    WHERE LOWER(TRIM(status))='entregue' AND data_entrega IS NOT NULL
      AND data_entrega >= ${inicio}::date AND data_entrega < ${fim}::date
      AND valorp::numeric > 0 AND responsavel IS NOT NULL AND TRIM(responsavel) <> ''
    GROUP BY 1,2
  `);
  return result.rows as unknown as SerieRow[];
}

/**
 * MRR por dimensão (ESTOQUE — snapshot de fim de mês), a partir de `cup_data_hist`.
 * GOTCHA (ver investigação): `produto` em `cup_data_hist` é instável — por isso este
 * endpoint só expõe `squad` e `responsavel` aqui (MRR por produto usa
 * `/api/lt-ltv-churn/evolucao-produto-tabela`, que reclassifica via `servico`).
 */
async function fetchMrrPorDimensao(dim: MrrDim, inicio: string, fimUltimoMes: string): Promise<SerieRow[]> {
  const result = await db.execute(sql`
    WITH meses AS (
      SELECT to_char(d,'YYYY-MM') AS mes, d::date AS m
      FROM generate_series(${inicio}::date, ${fimUltimoMes}::date, interval '1 month') d
    ),
    snap_ref AS (
      SELECT meses.mes,
        (SELECT MAX(data_snapshot) FROM "Clickup".cup_data_hist WHERE date_trunc('month',data_snapshot)=meses.m) AS snap
      FROM meses
    )
    SELECT sr.mes, COALESCE(NULLIF(TRIM(h.${sql.raw(dim)}),''),'Não Informado') AS dim, SUM(h.valorr)::numeric AS valor
    FROM snap_ref sr JOIN "Clickup".cup_data_hist h ON h.data_snapshot = sr.snap
    WHERE h.status IN ('ativo','onboarding','triagem') AND h.valorr > 0
    GROUP BY 1,2
  `);
  return result.rows as unknown as SerieRow[];
}

/**
 * Monta as 6 séries mensais por dimensão do modo Evolução, para a janela de 12 meses
 * terminando em `mes` (inclusive). Cada série vem com os 12 meses preenchidos (0 onde
 * não há dado) — ver `rowsParaSeries`.
 */
export async function montarSeriesScorecard(mes: string): Promise<ScorecardSeriesResult> {
  const meses = listaMeses12(mes);
  const inicio = `${meses[0]}-01`;
  const fim = `${addMeses(mes, 1)}-01`;
  const fimUltimoMes = `${mes}-01`;

  const [churnProdutoRows, churnOperadorRows, churnSquadRows, entregasRows, mrrSquadRows, mrrOperadorRows] =
    await Promise.all([
      fetchChurnPorDimensao("produto", inicio, fim),
      fetchChurnPorDimensao("responsavel_geral", inicio, fim),
      fetchChurnPorDimensao("squad", inicio, fim),
      fetchEntregasPorOperador(inicio, fim),
      fetchMrrPorDimensao("squad", inicio, fimUltimoMes),
      fetchMrrPorDimensao("responsavel", inicio, fimUltimoMes),
    ]);

  return {
    series: {
      churnPorProduto: rowsParaSeries(churnProdutoRows, meses),
      churnPorOperador: rowsParaSeries(churnOperadorRows, meses),
      churnPorSquad: rowsParaSeries(churnSquadRows, meses),
      entregasPorOperador: rowsParaSeries(entregasRows, meses),
      mrrPorSquad: rowsParaSeries(mrrSquadRows, meses),
      mrrPorOperador: rowsParaSeries(mrrOperadorRows, meses),
    },
  };
}

export function registerScorecardRoutes(app: Express) {
  app.get("/api/scorecard/metas", isAuthenticated, (req, res) => {
    const mes = req.query.mes as string | undefined;

    if (!mes || !MES_REGEX.test(mes)) {
      return res.status(400).json({ error: "Parâmetro 'mes' inválido. Use o formato YYYY-MM." });
    }

    try {
      const result = montarMetasScorecard(mes);
      res.json(result);
    } catch (error) {
      console.error("[api] Error building scorecard metas:", error);
      res.status(500).json({ error: "Failed to build scorecard metas" });
    }
  });

  // Séries mensais por dimensão (modo Evolução) — janela de 12 meses até `mes`, inclusive.
  app.get("/api/scorecard/series", isAuthenticated, async (req, res) => {
    const mes = req.query.mes as string | undefined;

    if (!mes || !MES_REGEX.test(mes)) {
      return res.status(400).json({ error: "Parâmetro 'mes' inválido. Use o formato YYYY-MM." });
    }

    try {
      const result = await montarSeriesScorecard(mes);
      res.json(result);
    } catch (error) {
      console.error("[api] Error building scorecard series:", error);
      res.status(500).json({ error: "Failed to build scorecard series" });
    }
  });

  // Responsáveis editáveis por métrica (quem é o dono de cada metric_key no scorecard).
  app.get("/api/scorecard/responsaveis", isAuthenticated, async (_req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT metrica_key, responsavel
        FROM cortex_core.scorecard_responsaveis
      `);
      const itens = result.rows.map((row: any) => ({
        metrica_key: row.metrica_key as string,
        responsavel: row.responsavel as string | null,
      }));
      res.json({ itens });
    } catch (error) {
      console.error("[api] Error em GET /api/scorecard/responsaveis:", error);
      res.status(500).json({ error: "Falha ao buscar responsáveis do scorecard" });
    }
  });

  app.put("/api/scorecard/responsaveis", isAuthenticated, async (req, res) => {
    try {
      const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
      const validos = itens.filter(
        (item: any) => typeof item?.metrica_key === "string" && item.metrica_key.trim().length > 0
      );

      for (const item of validos) {
        const responsavel = typeof item.responsavel === "string" ? item.responsavel : null;
        await db.execute(sql`
          INSERT INTO cortex_core.scorecard_responsaveis (metrica_key, responsavel, atualizado_em)
          VALUES (${item.metrica_key}, ${responsavel}, NOW())
          ON CONFLICT (metrica_key) DO UPDATE SET responsavel = EXCLUDED.responsavel, atualizado_em = NOW()
        `);
      }

      res.json({ ok: true, salvos: validos.length });
    } catch (error) {
      console.error("[api] Error em PUT /api/scorecard/responsaveis:", error);
      res.status(500).json({ error: "Falha ao salvar responsáveis do scorecard" });
    }
  });
}
